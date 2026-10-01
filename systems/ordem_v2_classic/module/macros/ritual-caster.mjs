import { gmNotice } from "../helpers/gm-notice.mjs";
import {
	inspectRitualResource,
	ritualBaseCost,
	ritualDescriptionText,
	ritualEffectFromText,
	ritualFormOptions,
	ritualFinalCost,
	ritualResistanceTarget,
	RITUAL_ELEMENTS,
	validateRitualCast,
} from "./ritual-caster-logic.mjs";
import { areaTemplateData, placeAreaTemplate } from "./ritual-area.mjs";
import { ritualRange, ritualTargets, validateTargetSelection } from "./ritual-targeting.mjs";
import { hasConditionProp } from "../helpers/conditions.mjs";
import { areaChoicesFor, areaRuleFor } from "./ritual-area-rules.mjs";
import { registerAreaHooks, resolveAreaCast, setRuleResolver } from "./ritual-area-engine.mjs";

/** Liga os gatilhos das zonas de ritual (início de turno, saída da área). Chamado uma vez ao carregar o mundo. */
export function registerRitualAreaHooks() {
	setRuleResolver(areaRuleFor);
	registerAreaHooks();
}

async function chooseAreaEffect(item, choices) {
	const options = Object.entries(choices).map(([id, entry]) => `<option value="${id}">${escapeHtml(entry.label)}</option>`).join("");
	return foundry.applications.api.DialogV2.prompt({
		window: { title: item.name },
		content: `<div class="form-group"><label>Efeito</label><select name="choice">${options}</select></div>`,
		ok: { label: "Escolher", callback: (_event, button) => button.form.elements.choice.value },
		rejectClose: false,
	});
}

const ICON_SHEET = "/systems/ordem_v2_classic/assets/ritual-elementos.png";
const MACRO_IMG = "icons/svg/book.svg";
const spendingActorIds = new Set();
const LOCALIZED = (key, fallback) => {
	const label = game.i18n.localize(key);
	return label === key ? fallback : label;
};

function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => {
		const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
		return entities[character];
	});
}

function uniqueAgents(actors) {
	return [...new Map(actors.filter((actor) => actor?.type === "agent").map((actor) => [actor.id, actor])).values()];
}

function macroCandidates() {
	const candidates = [];
	for (const token of canvas?.tokens?.controlled ?? []) candidates.push(token.actor);

	const speaker = ChatMessage.getSpeaker();
	if (speaker.token) candidates.push(canvas?.tokens?.get(speaker.token)?.actor);
	if (speaker.actor) candidates.push(game.actors.get(speaker.actor));
	if (game.user.character) candidates.push(game.user.character);

	const controlledAgents = uniqueAgents(candidates).filter((actor) => game.user.isGM || actor.isOwner);
	if (controlledAgents.length) return controlledAgents;
	return [...game.actors].filter((actor) => actor.type === "agent" && (game.user.isGM || actor.isOwner));
}

async function chooseAgent(agents) {
	if (agents.length === 1) return agents[0];
	if (!agents.length) {
		ui.notifications.warn("Nenhum Agente acessível foi encontrado. Selecione um token de Agente ou confira as permissões.");
		return null;
	}

	const options = agents
		.map((actor) => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`)
		.join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: "Escolher Agente" },
		content: `<div class="standard-form"><p>Escolha o Agente que conjurará o ritual.</p><div class="form-group"><label>Agente</label><select name="actorId">${options}</select></div></div>`,
		ok: { label: "Continuar" },
		position: { width: 420 },
	});
	return result?.actorId ? game.actors.get(result.actorId) : null;
}

const RITUAL_PT_BR_CHOICES = {
	dropdownExecution: { passive: "Passiva", free: "Livre", movement: "Movimento", default: "Padrão", complete: "Ação completa", reaction: "Reação" },
	dropdownRange: { personal: "Pessoal", touch: "Toque", short: "Curto", medium: "Médio", long: "Longo", extreme: "Extremo", unlimited: "Ilimitado" },
	dropdownResistance: { nullifies: "Anula", discredits: "Desacredita", partial: "Parcial", reducesByHalf: "Reduz à metade" },
	dropdownSkillResis: { resilience: "Fortitude", reflexes: "Reflexos", will: "Vontade" },
	dropdownArea: { cone: "Cone", cube: "Cubo", sphere: "Esfera", line: "Linha" },
	dropdownAreaType: { radius: "Raio", diameter: "Diâmetro" },
};

function localizeChoice(group, value, fallback = "—") {
	if (!value) return fallback;
	const portuguese = RITUAL_PT_BR_CHOICES[group]?.[value];
	if (portuguese) return portuguese;
	const key = CONFIG.op?.[group]?.[value];
	return key ? LOCALIZED(key, value) : value;
}

function elementInfo(item) {
	const key = item.system.element;
	const known = RITUAL_ELEMENTS[key];
	return known ?? { label: key || "Sem afinidade", color: "#8b8490", iconIndex: 0 };
}

export function getRitualForms(item) {
	const forms = ritualFormOptions(item);
	const saved = item.flags?.ordem_v2_classic?.ritualLibrary?.forms;
	if (!Array.isArray(saved)) return forms;
	for (const entry of saved) {
		const id = entry.name === "Discente" ? "student" : entry.name === "Verdadeiro" ? "true" : null;
		if (!id) continue;
		forms[id] = {
			additionalCost: Number(entry.additionalCost),
			body: String(entry.description ?? ""),
			requiredCircle: Number(entry.minCircle) || null,
			requiredAffinity: entry.affinity ? "afinidade" : null,
		};
	}
	return forms;
}

function ritualImage(item, info, size = 48) {
	const image = item.img && item.img !== "icons/svg/mystery-man.svg" ? item.img : null;
	if (image) return `<img class="ritual-caster-icon" alt="" src="${escapeHtml(image)}" style="--ritual-accent:${info.color};box-sizing:border-box;width:${size}px;height:${size}px;object-fit:cover;border:2px solid ${info.color};padding:2px;border-radius:12px;background:rgba(12,16,29,.9);box-shadow:0 0 14px ${info.color}66;">`;
	const offset = 20 - info.iconIndex * 60;
	return `<span class="ritual-caster-icon ritual-caster-icon-sprite" aria-hidden="true" style="--ritual-accent:${info.color};box-sizing:border-box;position:relative;display:inline-block;overflow:hidden;flex:0 0 ${size}px;width:${size}px;height:${size}px;border:2px solid ${info.color};padding:2px;border-radius:12px;background:radial-gradient(circle,${info.color}55,rgba(10,14,27,.96));box-shadow:0 0 14px ${info.color}66;"><img alt="" src="${ICON_SHEET}" style="position:absolute;left:${offset}%;top:0;width:300%;height:100%;max-width:none;" /></span>`;
}

function getTokensForDialog() {
	return (canvas?.tokens?.placeables ?? [])
		.filter((token) => token.actor)
		.map((token) => ({
			id: token.document.id,
			name: token.name || token.actor.name,
			actor: token.actor,
			selected: game.user.targets?.has(token),
		}));
}

function ritualCard(item) {
	const circle = Number(item.system.circle);
	const info = elementInfo(item);
	const execution = localizeChoice("dropdownExecution", item.system.execution);
	const range = localizeChoice("dropdownRange", item.system.range);
	const cost = ritualBaseCost(circle);
	return `<button type="button" class="ritual-caster-option ${item.system.element === "fear" ? "ritual-fear-option" : ""}" data-element="${escapeHtml(item.system.element)}" data-ritual-id="${escapeHtml(item.id)}" data-circle="${escapeHtml(circle)}" data-search="${escapeHtml(`${item.name} ${info.label}`.toLocaleLowerCase())}" aria-pressed="false" style="--ritual-accent:${info.color};display:flex;align-items:center;gap:9px;width:100%;min-height:64px;height:auto;box-sizing:border-box;padding:7px;margin:0 0 5px;border:1px solid ${info.color};border-radius:8px;background:rgba(0,0,0,.12);text-align:left;white-space:normal;line-height:1.25;color:inherit;cursor:pointer;">
		${ritualImage(item, info)}
		<span style="display:grid;gap:2px;min-width:0;flex:1;overflow-wrap:anywhere"><strong style="font-size:.96rem;line-height:1.15">${escapeHtml(item.name)}</strong><small>${circle}º círculo · ${escapeHtml(info.label)}</small><small>${escapeHtml(execution)} · ${escapeHtml(range)} · ${cost === null ? "custo inválido" : `${cost} PD`}</small></span>
	</button>`;
}

function getSelectedTargetIds() {
	return [...(game.user.targets ?? [])].map((token) => token.document.id);
}

function getFormSelection(form, actor, itemsById, withoutSanity) {
	const item = itemsById.get(form.elements.ritualId.value);
	if (!item) return { ok: false, reason: "Escolha um ritual da lista." };
	const formId = form.elements.ritualForm?.value ?? "basic";
	const options = getRitualForms(item);
	const chosenForm = options[formId];
	if (!chosenForm) return { ok: false, reason: "Esta versão do ritual não está disponível.", item };
	const circle = Math.max(Number(item.system.circle), Number(chosenForm.requiredCircle) || Number(item.system.circle));
	if (!Number.isInteger(circle) || circle < Number(item.system.circle) || circle > 4) {
		return { ok: false, reason: "Escolha um círculo válido para este ritual.", item, circle };
	}
	const cost = ritualFinalCost(circle, formId, chosenForm);
	const resourceState = inspectRitualResource(actor, withoutSanity);
	if (!resourceState.ok) return { ok: false, reason: "Ative a regra global ‘Jogando sem Sanidade’ para usar PD como recurso de conjuração nesta macro." };
	const resource = resourceState.resource;
	const validation = validateRitualCast({
		cost,
		balance: resource.value,
		preparationConfirmed: true,
		specialRequirementConfirmed: true,
	});
	if (!validation.ok) {
		const reason = validation.errors.map((error) => ({
			"custo-invalido": "O círculo selecionado não tem um custo válido.",
			"preparacao-nao-confirmada": "Confirme que consegue realizar os gestos e componentes exigidos.",
			"requisito-especial-nao-confirmado": formId === "true" && chosenForm.requiredAffinity && !form.elements.affinityConfirmed?.checked
				? "A forma Verdadeira exige afinidade."
				: "Rituais de Medo só podem ser conjurados por personagens Marcados.",
			"pd-insuficiente": `PD insuficiente: saldo ${resource.value}, custo de ${circle}º círculo ${cost ?? "—"} PD.`,
		}[error])).join(" ");
		return { ok: false, reason, item, circle, cost };
	}

	const targetIds = getSelectedTargetIds();
	const effectText = formId === "basic"
		? String(item.system.description ?? "").split(/\b(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/i)[0]
		: chosenForm.body;
	const effect = ritualEffectFromText(effectText);
	return { ok: true, item, formId, circle, cost, targetIds, effect };
}

function createPickerContent(actor, items, tokens) {
	const itemCards = items.map(ritualCard).join("");
	const compact = window.innerWidth < 820;
	return `<style>
		.ritual-caster-root{--ritual-gold:#f4b942;--ritual-gold-soft:#ffda7a;--ritual-ink:#0b1020;--ritual-panel:#12182a;--ritual-violet:#7865a7;color:#f6f1e8!important;font-family:var(--font-primary,serif)}
		.ritual-caster-root input:not([type=checkbox]),.ritual-caster-root select{background:#1a2034!important;border:1px solid #454660!important;border-radius:9px!important;color:#f6f1e8!important;min-height:42px;padding:8px 12px}
		.ritual-caster-root input::placeholder{color:#a9a5bd!important}
		.ritual-caster-root .ritual-caster-browser{padding-top:34px}
		.ritual-caster-root .ritual-caster-details{container-type:inline-size;container-name:ritual-detail;background:radial-gradient(ellipse at 88% 0%,rgba(103,55,127,.18),transparent 33%),linear-gradient(145deg,rgba(20,25,43,.97),rgba(9,13,25,.98))!important;border:1px solid #383852!important;border-radius:12px!important;box-shadow:0 8px 24px rgba(0,0,0,.26)}
		.ritual-caster-root .ritual-caster-option{background:linear-gradient(145deg,rgba(28,33,52,.95),rgba(13,18,31,.98))!important;border:1px solid var(--ritual-accent,#8b8490)!important;border-radius:9px!important;box-shadow:0 3px 12px rgba(0,0,0,.14);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
		.ritual-caster-root .ritual-caster-option:hover,.ritual-caster-root .ritual-caster-option[aria-pressed=true]{border-color:var(--ritual-accent,#8b8490)!important;box-shadow:0 0 0 1px var(--ritual-accent,#8b8490),0 5px 14px color-mix(in srgb,var(--ritual-accent,#8b8490) 22%,transparent);transform:translateY(-1px)}
		.ritual-caster-root .ritual-fear-option{position:relative;animation:ritual-fear-edge 3.2s ease-in-out infinite}
		.ritual-caster-root .ritual-fear-edge{position:absolute;z-index:2;inset:1px;border:1px solid rgba(165,132,220,.5);border-radius:7px;pointer-events:none;animation:ritual-fear-border 3.2s ease-in-out infinite}
		.ritual-caster-root .ritual-fear-option:after{content:"";position:absolute;pointer-events:none;inset:1px;border:1px solid rgba(165,132,220,.2);border-radius:7px;animation:ritual-fear-border 3.2s ease-in-out infinite}
		@keyframes ritual-fear-edge{0%,100%{box-shadow:inset 0 0 0 1px rgba(116,89,173,.2),0 2px 8px rgba(83,56,134,.06)}50%{box-shadow:inset 0 0 0 1px rgba(171,139,235,.55),0 0 10px rgba(127,91,201,.22)}}
		@keyframes ritual-fear-border{0%,100%{border-color:rgba(165,132,220,.18)}50%{border-color:rgba(190,164,255,.7)}}
		@media(prefers-reduced-motion:reduce){.ritual-caster-root .ritual-fear-option{animation:none}.ritual-caster-root .ritual-fear-edge{animation:none}}
		.ritual-caster-root .ritual-caster-option strong{font-size:1.05rem;color:#fff6e8}
		.ritual-caster-root .ritual-form-option>span{display:grid;gap:2px;min-width:0}
		.ritual-caster-root .ritual-detail-hero{position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;gap:12px;min-height:76px;padding:10px;border:1px solid rgba(244,185,66,.4);border-radius:10px;background:radial-gradient(ellipse at 82% 50%,rgba(99,48,122,.25),transparent 44%),linear-gradient(105deg,rgba(28,32,50,.97),rgba(13,17,31,.72))}
		.ritual-caster-root .ritual-detail-hero:after{content:"";position:absolute;z-index:-1;inset:0;background:radial-gradient(circle at 82% 50%,transparent 0 20%,rgba(183,136,242,.12) 20.2% 20.5%,transparent 20.8% 29%,rgba(183,136,242,.08) 29.2% 29.5%,transparent 29.8%);opacity:.8}
		.ritual-caster-root .ritual-detail-hero h3{font-family:var(--font-sans,Arial,sans-serif);font-size:clamp(1.15rem,2.2vw,1.65rem);letter-spacing:.01em;color:#fff5e8}
		.ritual-caster-root .ritual-detail-hero .ritual-detail-subtitle{font-size:.86rem;color:#d7c9dd}
		.ritual-caster-root .ritual-detail-hero .ritual-caster-icon{width:60px!important;height:60px!important;flex:0 0 60px!important}
		.ritual-caster-root .ritual-detail-hero .ritual-caster-icon-sprite{flex:0 0 60px!important;width:60px!important;height:60px!important}
		.ritual-caster-root .ritual-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:7px 0}
		.ritual-caster-root .ritual-stat{min-width:0;padding:6px;border:1px solid #343952;border-radius:8px;background:linear-gradient(145deg,rgba(30,35,57,.9),rgba(15,20,34,.95))}
		.ritual-caster-root .ritual-stat-label{display:block;margin-bottom:2px;color:#b9add5;font-size:.72rem}
		.ritual-caster-root .ritual-stat-value{display:block;font-weight:700;overflow-wrap:anywhere}
		.ritual-caster-root .ritual-cost-box{padding:13px;border:1px solid rgba(244,185,66,.48)!important;border-radius:11px;background:linear-gradient(120deg,rgba(70,48,29,.4),rgba(23,21,36,.92))!important;font-weight:700}
		.ritual-caster-root .ritual-circle-rules{padding:13px;margin:10px 0!important;border:1px solid #35334c;border-radius:12px;background:rgba(14,18,32,.76)!important}
		.ritual-caster-root .ritual-circle-chip{display:inline-flex;align-items:center;justify-content:center;min-width:76px;padding:7px 10px;border:1px solid #51456d;border-radius:20px;background:#211d35;color:#f5d995;font-weight:700}
		.ritual-caster-root .ritual-occultism-note{padding:12px!important;border:1px solid rgba(236,143,55,.6)!important;border-left:4px solid #ec8f37!important;border-radius:10px;background:linear-gradient(120deg,rgba(80,47,29,.38),rgba(22,20,31,.94))!important}
		.ritual-caster-root .ritual-cast-summary{padding:10px;border-left:3px solid var(--ritual-gold);background:rgba(244,185,66,.08);border-radius:7px}
		.ritual-caster-root fieldset{border:0!important;border-radius:0!important;background:transparent}
		.ritual-caster-root fieldset legend{padding:0 7px;color:#f4cf82;font-weight:700}
		.ritual-caster-root .ritual-form-list{border:0!important;padding:0!important;margin:6px 0!important}
		.ritual-caster-root .ritual-form-option{display:grid;grid-template-columns:18px minmax(0,1fr);gap:4px;align-items:start;padding:4px 4px;margin:0 0 2px;border:0;border-left:2px solid var(--ritual-accent);border-radius:0;background:rgba(18,20,35,.55);cursor:pointer}
		.ritual-caster-root .ritual-form-option input{margin:2px 0 0}
		.ritual-caster-root .ritual-form-option strong,.ritual-caster-root .ritual-form-option small{display:block;line-height:1.25}
		.ritual-caster-root details{border:1px solid #373850;border-radius:10px;background:rgba(24,28,44,.76)}
		.ritual-caster-root details summary{padding:11px;color:#eee5f2;font-weight:700;cursor:pointer}
		.ritual-caster-root details p{padding:0 12px 12px}
		@media(max-width:820px){.ritual-caster-root .ritual-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
		@container ritual-detail (max-width:600px){.ritual-caster-root .ritual-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
	</style><div class="standard-form ritual-caster-root" style="box-sizing:border-box;width:100%;flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden;">
		<p style="flex:none;margin:0 0 12px;padding:10px 14px;border-left:3px solid var(--color-border-highlight,#c9a94a);background:linear-gradient(100deg,rgba(244,185,66,.12),rgba(255,255,255,.025));border-radius:8px;">Conjurador: <strong style="color:#ffca62">${escapeHtml(actor.name)}</strong> · ${actor.system.PD.value} / ${actor.system.PD.max} PD</p>
		<div class="ritual-caster-layout" style="display:grid;grid-template-columns:minmax(250px,.78fr) minmax(0,1.25fr);gap:10px;align-items:stretch;flex:1;min-height:0;overflow:hidden;">
			<section class="ritual-caster-browser" style="display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;">
				<div class="ritual-caster-filters" style="display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:8px;margin-bottom:9px;flex:none;">
					<input type="search" name="search" placeholder="⌕  Buscar ritual…" aria-label="Buscar ritual" style="box-sizing:border-box;min-width:0;min-height:44px;padding:9px 13px;border:1px solid #454660;border-radius:10px;background:#1a2034;color:#f6f1e8;">
					<select name="circleFilter" aria-label="Filtrar por círculo" style="box-sizing:border-box;min-width:0;min-height:44px;padding:9px 11px;border:1px solid #454660;border-radius:10px;background:#1a2034;color:#f6f1e8;"><option value="">Todos</option><option value="1">1º círculo</option><option value="2">2º círculo</option><option value="3">3º círculo</option><option value="4">4º círculo</option></select>
				</div>
				<div class="ritual-caster-list" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:2px 7px 8px 1px;">${itemCards || "<p>Este Agente não tem rituais cadastrados.</p>"}</div>
			</section>
			<section class="ritual-caster-details" style="box-sizing:border-box;min-width:0;min-height:0;height:100%;max-height:100%;overflow-y:auto;overflow-x:hidden;padding:8px 10px;border:1px solid #383852;border-radius:16px;background:radial-gradient(ellipse at 88% 0%,rgba(103,55,127,.23),transparent 33%),linear-gradient(145deg,rgba(20,25,43,.97),rgba(9,13,25,.98));box-shadow:0 12px 38px rgba(0,0,0,.3);">
				<input type="hidden" name="ritualId" value="">
				<div class="ritual-caster-empty"><h3 style="margin-top:0">Escolha um ritual</h3><p>Busque ou filtre a lista, selecione um ritual e confira o círculo, alvos e custo antes de conjurar.</p></div>
			</section>
		</div>
	</div>`;
}

function renderRitualDetails(section, item, actor) {
	const info = elementInfo(item);
	const forms = getRitualForms(item);
	const minimumCircle = Number(item.system.circle);
	const targetText = item.system.target || "Definido pelo texto do ritual";
	const areaText = [item.system.area?.name, item.system.area?.size, item.system.area?.type].filter(Boolean)
		.map((value) => localizeChoice("dropdownArea", value, value)).join(" · ");
	const fullDescription = ritualDescriptionText(item.system.description);
	const baseDescription = escapeHtml(fullDescription.split(/\b(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/i)[0]);
	const resistanceSkill = ritualResistanceTarget(item);
	const resistance = resistanceSkill
		? `${localizeChoice("dropdownSkillResis", resistanceSkill, resistanceSkill)} · ${escapeHtml(localizeChoice("dropdownResistance", item.system.resistance, item.system.resistance))}`
		: "Nenhuma";
	const availableForms = [
		{ id: "basic", label: "Básico", detail: null, circle: minimumCircle, cost: ritualBaseCost(minimumCircle) },
		...[ ["student", "Discente"], ["true", "Verdadeiro"] ].map(([id, label]) => {
			const detail = forms[id];
			if (!detail) return null;
			const circle = Math.max(minimumCircle, Number(detail.requiredCircle) || minimumCircle);
			return { id, label, detail, circle, cost: ritualFinalCost(circle, id, detail) };
		}).filter(Boolean),
	];
	const formCards = availableForms.map((option, index) => {
		const effect = option.id === "basic" ? "" : escapeHtml(option.detail.body || "Descrição indisponível.");
		const requirement = option.id === "true" && option.detail.requiredAffinity ? "Exige afinidade" : option.id === "basic" ? "Efeito original" : "Forma aprimorada";
		return `<label class="ritual-form-option" style="--ritual-accent:${info.color};display:grid;grid-template-columns:18px minmax(0,1fr);gap:4px;align-items:start;padding:4px 4px;margin:0 0 2px;border:0;border-left:2px solid ${info.color};border-radius:0;background:rgba(18,20,35,.55);cursor:pointer;"><input type="radio" name="ritualForm" value="${option.id}" ${index === 0 ? "checked" : ""} style="margin:2px 0 0;"><span style="display:grid;gap:2px;min-width:0"><strong>${option.label}</strong><small>${requirement} · ${option.circle}º círculo · ${option.cost ?? "—"} PD</small>${effect ? `<span style="display:block;margin-top:2px;line-height:1.3">${effect}</span>` : ""}</span></label>`;
	}).join("");
	section.innerHTML = `<input type="hidden" name="ritualId" value="${escapeHtml(item.id)}">
		<header class="ritual-detail-hero" style="--ritual-accent:${info.color};display:grid!important;grid-template-columns:60px minmax(0,1fr)!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;gap:12px!important;border-color:${info.color};border-left:3px solid ${info.color};">
			${ritualImage(item, info, 60)}
			<div style="position:relative;z-index:1;min-width:0"><h3 style="margin:0;font-family:var(--font-sans,Arial,sans-serif);font-size:clamp(1.15rem,2.2vw,1.65rem);letter-spacing:.01em;color:#fff5e8">${escapeHtml(item.name)}</h3><small class="ritual-detail-subtitle">${minimumCircle}º círculo · ${escapeHtml(info.label)}</small></div>
		</header>
		<div class="ritual-stat-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:7px 0">
			<div class="ritual-stat" style="min-width:0;padding:6px;border:1px solid #343952;border-radius:8px;background:linear-gradient(145deg,rgba(30,35,57,.9),rgba(15,20,34,.95))"><span class="ritual-stat-label" style="display:block;margin-bottom:2px;color:#b9add5;font-size:.72rem;line-height:1.25"><i class="fa-solid fa-hourglass-half"></i> Execução</span><span class="ritual-stat-value" style="display:block;font-weight:700;line-height:1.3;overflow-wrap:anywhere">${escapeHtml(localizeChoice("dropdownExecution", item.system.execution))}</span></div>
			<div class="ritual-stat" style="min-width:0;padding:6px;border:1px solid #343952;border-radius:8px;background:linear-gradient(145deg,rgba(30,35,57,.9),rgba(15,20,34,.95))"><span class="ritual-stat-label" style="display:block;margin-bottom:2px;color:#b9add5;font-size:.72rem;line-height:1.25"><i class="fa-solid fa-bullseye"></i> Alcance</span><span class="ritual-stat-value" style="display:block;font-weight:700;line-height:1.3;overflow-wrap:anywhere">${escapeHtml(localizeChoice("dropdownRange", item.system.range))}</span></div>
			<div class="ritual-stat" style="min-width:0;padding:6px;border:1px solid #343952;border-radius:8px;background:linear-gradient(145deg,rgba(30,35,57,.9),rgba(15,20,34,.95))"><span class="ritual-stat-label" style="display:block;margin-bottom:2px;color:#b9add5;font-size:.72rem;line-height:1.25"><i class="fa-solid fa-users"></i> Alvo</span><span class="ritual-stat-value" style="display:block;font-weight:700;line-height:1.3;overflow-wrap:anywhere">${escapeHtml(targetText)}${areaText ? ` · ${escapeHtml(areaText)}` : ""}</span></div>
			<div class="ritual-stat" style="min-width:0;padding:6px;border:1px solid #343952;border-radius:8px;background:linear-gradient(145deg,rgba(30,35,57,.9),rgba(15,20,34,.95))"><span class="ritual-stat-label" style="display:block;margin-bottom:2px;color:#b9add5;font-size:.72rem;line-height:1.25"><i class="fa-solid fa-shield-halved"></i> Resistência</span><span class="ritual-stat-value" style="display:block;font-weight:700;line-height:1.3;overflow-wrap:anywhere">${resistance}</span></div>
		</div>
		<section class="ritual-description-visible" aria-label="Descrição do ritual" style="margin:6px 0;padding:9px;border:1px solid #51405a;border-radius:9px;background:rgba(11,15,27,.58);"><strong style="color:#f4cf82">Descrição do ritual</strong><p style="margin:5px 0 0;line-height:1.45">${baseDescription || "Sem descrição cadastrada."}</p></section>
		<fieldset class="ritual-form-list" style="margin:6px 0;padding:0;border:0;"><legend>Escolha o efeito</legend>${formCards}</fieldset>
		<p class="ritual-cast-summary" style="margin-bottom:0;font-weight:600"></p>`;

	const form = section.closest("form");
	form.elements.ritualId.value = item.id;
	const updateFormNote = () => {
		const selected = getFormSelection(form, actor, new Map([[item.id, item]]), game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity"));
		const summary = section.querySelector(".ritual-cast-summary");
		const button = form.querySelector('button[data-action="conjure"]');
		const targetCount = getSelectedTargetIds().length;
		summary.textContent = selected.ok ? `${form.elements.ritualForm.value === "basic" ? "Básico" : form.elements.ritualForm.value === "student" ? "Discente" : "Verdadeiro"} · ${selected.circle}º círculo · ${selected.cost} PD · saldo após pagar: ${actor.system.PD.value - selected.cost} PD${targetCount ? ` · alvos marcados: ${targetCount}` : " · sem alvo marcado; resolução manual conforme a descrição"}` : selected.reason ?? "Revise as opções do ritual.";
		button.disabled = !selected.ok;
	};
	section._refresh = updateFormNote;
	section.querySelectorAll('[name="ritualForm"]').forEach((control) => control.addEventListener("change", updateFormNote));
	updateFormNote();
}

function renderPicker(actor, items, tokens, preferredItemId = null) {
	const itemsById = new Map(items.map((item) => [item.id, item]));
	const withoutSanity = game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity");
	const dialogWidth = Math.max(380, Math.min(820, window.innerWidth - 56));
	const dialogHeight = Math.max(320, Math.min(700, window.innerHeight - 72));
	const resultPromise = foundry.applications.api.DialogV2.wait({
		window: { title: "Conjurar Ritual", icon: "fa-solid fa-book-sparkles" },
		position: { width: dialogWidth, height: dialogHeight },
		content: createPickerContent(actor, items, tokens),
		buttons: [
			{ action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark", callback: () => null },
			{
				action: "conjure",
				label: "Conjurar e pagar PD",
				icon: "fa-solid fa-wand-sparkles",
				default: true,
				disabled: true,
				callback: (_event, button) => {
					const form = button.form;
					const selection = getFormSelection(form, actor, itemsById, withoutSanity);
					if (!selection.ok) return { invalid: selection.reason };
					return {
						itemId: selection.item.id,
						formId: selection.formId,
						circle: selection.circle,
						cost: selection.cost,
						effect: selection.effect,
						preparationConfirmed: true,
						markedConfirmed: true,
						targetIds: selection.targetIds,
						concentration: form.elements.concentration?.value ?? "none",
						damageDt: Number(form.elements.damageDt?.value) || null,
					};
				},
			},
		],
		render: (_event, dialog) => {
			const form = dialog.element.querySelector("form");
			// Mantém o rodapé (Cancelar / Conjurar) sempre visível: o corpo encolhe e rola, os botões não saem da janela.
			Object.assign(form.style, { display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: "0" });
			const body = form.querySelector(".dialog-content");
			if (body) Object.assign(body.style, { display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: "0" });
			const footer = form.querySelector(".form-footer");
			if (footer) footer.style.flex = "none";
			const list = form.querySelector(".ritual-caster-list");
			const detailsSection = form.querySelector(".ritual-caster-details");
			const search = form.querySelector('[name="search"]');
			const circleFilter = form.querySelector('[name="circleFilter"]');

			const filterCards = () => {
				const term = search.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
				for (const card of list.querySelectorAll(".ritual-caster-option")) {
					const cardTerm = card.dataset.search.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
					card.style.display = (!term || cardTerm.includes(term)) && (!circleFilter.value || card.dataset.circle === circleFilter.value) ? "flex" : "none";
				}
			};
			search.addEventListener("input", filterCards);
			circleFilter.addEventListener("change", filterCards);
			list.addEventListener("click", (event) => {
				const card = event.target.closest("[data-ritual-id]");
				if (!card) return;
				form.elements.ritualId.value = card.dataset.ritualId;
				for (const option of list.querySelectorAll(".ritual-caster-option")) {
					option.setAttribute("aria-pressed", String(option === card));
					option.style.outline = option === card ? "2px solid var(--ritual-accent,#8b8490)" : "none";
				}
				renderRitualDetails(detailsSection, itemsById.get(card.dataset.ritualId), actor);
			});
			for (const eventName of ["change", "input"]) {
				detailsSection.addEventListener(eventName, (event) => {
					if (!event.target.matches('[name="ritualForm"]')) return;
					detailsSection._refresh?.();
				});
			}
			filterCards();
			const initialItem = itemsById.get(preferredItemId);
			if (initialItem) {
				const initialCard = [...list.querySelectorAll(".ritual-caster-option")].find((card) => card.dataset.ritualId === initialItem.id);
				if (initialCard) {
					initialCard.setAttribute("aria-pressed", "true");
					initialCard.style.outline = "2px solid var(--ritual-accent,#8b8490)";
					renderRitualDetails(detailsSection, initialItem, actor);
					initialCard.scrollIntoView({ block: "nearest" });
				}
			}
		},
	});

	return resultPromise;
}

function getRoll(rolls) {
	return Array.isArray(rolls) ? rolls[0] : rolls;
}

async function rollSkill(actor, skill, target) {
	const rolls = await actor.rollSkill(
		{ skill, rolls: [{ options: { target } }] },
		{},
		{ create: false },
	);
	const roll = getRoll(rolls);
	// create:false devolve só o D20Roll; postamos a carta normal de perícia (com "SUCESSO/FALHA (DT)") no chat
	if (roll && Number.isFinite(Number(roll.total))) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
	return roll;
}

function rollOutcome(roll, target) {
	if (!roll || !Number.isFinite(Number(roll.total))) return { status: "cancelled", total: null, margin: null };
	const total = Number(roll.total);
	return { status: total >= target ? "success" : "failure", total, margin: total - target };
}

async function spendPd(actor, amount) {
	if (spendingActorIds.has(actor.id)) return false;
	spendingActorIds.add(actor.id);
	try {
		const current = Number(actor.system.PD.value);
		if (!Number.isFinite(current) || current < amount) return false;
		await actor.update({ "system.PD.value": current - amount });
		return true;
	} finally {
		spendingActorIds.delete(actor.id);
	}
}

async function applySanityCostToPd(actor, amount) {
	if (!amount) return 0;
	const current = Math.max(0, Number(actor.system.PD.value) || 0);
	const applied = Math.min(current, amount);
	if (applied) await actor.update({ "system.PD.value": current - applied });
	return applied;
}

function getConcentrationDt(selection) {
	if (selection.concentration === "bad") return 15 + selection.cost;
	if (selection.concentration === "terrible") return 20 + selection.cost;
	if (selection.concentration === "damage") return selection.damageDt;
	return null;
}

function buildChatCard(actor, item, selection, outcome) {
	const info = elementInfo(item);
	const targetNames = selection.targetIds.map((id) => canvas.tokens.get(id)?.name ?? "Alvo removido da cena");
	const selectedCircle = Number(selection.circle ?? item.system.circle);
	const tests = [];
	if (outcome.concentration) tests.push(`<li><strong>Concentração, Vontade DT ${outcome.concentration.dt}:</strong> ${escapeHtml(outcome.concentration.text)}</li>`);
	if (outcome.occultism) tests.push(`<li><strong>Teste de Ocultismo (Custo do Paranormal), DT ${outcome.occultism.dt}:</strong> ${escapeHtml(outcome.occultism.text)}</li>`);
	for (const target of outcome.resistances ?? []) {
		tests.push(`<li><strong>Resistência de ${escapeHtml(target.name)} (${escapeHtml(target.skill)}):</strong> ${escapeHtml(target.text)}</li>`);
	}
	const sanity = outcome.sanityNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
	const effects = (outcome.effects ?? []).map((effect) => `<li>${escapeHtml(effect)}</li>`).join("");
	const areaLines = (outcome.areaLines ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
	const statusText = outcome.awaitingArea
		? "Testes do conjurador feitos. Falta escolher a área: clique em Selecionar área, posicione e clique no mapa."
		: outcome.awaitingTargets
		? "Testes do conjurador feitos, mas nenhum alvo foi marcado. Marque o(s) alvo(s) no mapa (tecla T sobre o token) e clique em Selecionar alvos e rolar dano."
		: outcome.effectsPending
		? "Testes do conjurador feitos. Aguardando o Mestre aplicar resistência e efeitos nos alvos."
		: outcome.pending
		? "Ritual preparado. Clique no botão para rolar o teste e resolver o efeito. O custo de conjuração já foi pago."
		: outcome.interrupted
			? "Ritual interrompido: o efeito não acontece. O custo de conjuração foi pago."
			: outcome.areaLines?.length
				? "Ritual conjurado. A área foi resolvida automaticamente (resistência, dano e condições abaixo)."
			: outcome.effects?.length
				? "Ritual conjurado e efeito aplicado."
				: "Ritual conjurado. O mestre aplica o efeito conforme a descrição.";
	const description = foundry.utils.cleanHTML(String(item.system.chatDescription || item.system.description || ""));
	return `<article class="ritual-cast-card" style="border:1px solid ${info.color};border-radius:10px;padding:12px;background:rgba(0,0,0,.08);">
		<header style="display:flex;align-items:center;gap:10px;border-bottom:1px solid ${info.color};padding-bottom:8px;margin-bottom:8px;">
			${ritualImage(item, info)}<div><h3 style="margin:0">${escapeHtml(item.name)}</h3><small>${escapeHtml(actor.name)} · ${selectedCircle}º círculo escolhido · ${escapeHtml(info.label)}</small></div>
		</header>
		<p><strong>${statusText}</strong></p>
		<p><strong>Custo:</strong> ${selection.cost} PD${outcome.sanityPd ? ` (mais ${outcome.sanityPd} PD perdidos pela falha no teste)` : ""}. <strong>Execução:</strong> ${escapeHtml(localizeChoice("dropdownExecution", item.system.execution))}. <strong>Alcance:</strong> ${escapeHtml(localizeChoice("dropdownRange", item.system.range))}.</p>
		${selection.areaNote ? `<p><em>${escapeHtml(selection.areaNote)}</em></p>` : ""}
		${targetNames.length ? `<p><strong>Alvo(s):</strong> ${escapeHtml(targetNames.join(", "))}</p>` : ""}
		${outcome.awaitingArea ? '<p><button type="button" data-action="ritual-area-place"><i class="fa-solid fa-draw-polygon"></i> Selecionar área</button></p>' : ""}
		${outcome.awaitingTargets ? '<p><button type="button" data-action="ritual-area-roll"><i class="fa-solid fa-crosshairs"></i> Selecionar alvos e rolar dano</button></p>' : ""}
		${outcome.pending ? '<button type="button" data-action="ritual-test"><i class="fa-solid fa-dice-d20"></i> Rolar teste do ritual</button>' : ""}
		${tests.length ? `<h4>Testes</h4><ul>${tests.join("")}</ul>` : ""}
		${effects ? `<h4>Efeitos aplicados</h4><ul>${effects}</ul>` : ""}
		${areaLines ? `<h4>Ritual de área</h4><ul>${areaLines}</ul>` : ""}
		${sanity ? `<h4>Consequências</h4><ul>${sanity}</ul>` : ""}
		<details><summary>Descrição do ritual</summary>${description}</details>
	</article>`;
}

const tokenRect = (token) => {
	const size = canvas.grid.size;
	// ampliado para os quadrados inteiros que o token ocupa (um token de 0,7 ainda "toca" o quadrado ao lado)
	const x0 = Math.floor(token.document.x / size) * size;
	const y0 = Math.floor(token.document.y / size) * size;
	const x1 = Math.ceil((token.document.x + token.document.width * size - 1) / size) * size;
	const y1 = Math.ceil((token.document.y + token.document.height * size - 1) / size) * size;
	return { id: token.id, name: token.name, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

function ritualFormBodyOf(item, formId) {
	return formId === "basic" ? "" : (ritualFormOptions(item)[formId]?.body ?? "");
}

/**
 * Confere os alvos marcados contra o que o ritual pede (quantidade e alcance).
 * Sem informação de alcance vale curto; "toque" exige o espaço ao lado; "pessoal" não usa alvos.
 */
export function checkRitualTargets(actor, item, formId, tokenIds) {
	const body = ritualFormBodyOf(item, formId);
	const targets = ritualTargets(item, body);
	const range = ritualRange(item, body);
	const casterToken = actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id);
	if (!casterToken) return { ok: true, valid: tokenIds, problems: [], targets, range };
	const selected = tokenIds.map((id) => canvas.tokens.get(id)).filter(Boolean).map(tokenRect);
	const result = validateTargetSelection({ range, targets, caster: tokenRect(casterToken), selected, pxPerMeter: canvas.dimensions.size / canvas.dimensions.distance });
	return { ...result, targets, range };
}

async function resolveCast(actor, selection) {
	const item = actor.items.get(selection.itemId);
	if (!item || item.type !== "ritual") {
		ui.notifications.error("O ritual não está mais na ficha do Agente.");
		return;
	}
	const withoutSanity = game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity");
	const resource = inspectRitualResource(actor, withoutSanity);
	if (!resource.ok) {
		ui.notifications.error("Esta macro cobra PD. Ative ‘Jogando sem Sanidade’ e tente novamente.");
		return;
	}
	const latest = validateRitualCast({
		cost: selection.cost,
		balance: actor.system.PD.value,
		preparationConfirmed: true,
		specialRequirementConfirmed: true,
	});
	if (!latest.ok) {
		ui.notifications.warn("O PD disponível não cobre o custo escolhido. Confira o saldo e tente novamente.");
		return;
	}
	// Ritual de área: o jogador posiciona a área no mapa antes de pagar; cancelar aqui não gasta nada.
	// Condições que mexem na conjuração: Silenciado não conjura; Surdo conta como condição ruim (concentração).
	if (hasConditionProp(actor, "noRituals")) {
		ui.notifications.warn(`${actor.name} está Silenciado e não pode conjurar rituais.`);
		return;
	}
	if (hasConditionProp(actor, "badCasting") && (!selection.concentration || selection.concentration === "none")) {
		selection = { ...selection, concentration: "bad" };
		ui.notifications.info(`${actor.name} está Surdo: conjurar conta como condição ruim (teste de Vontade de concentração).`);
	}
	let areaNote = null;
	let templateId = null;
	let choiceId = null;
	const choices = areaChoicesFor(item);
	if (choices) {
		choiceId = await chooseAreaEffect(item, choices);
		if (!choiceId) {
			ui.notifications.info("Efeito não escolhido; o ritual não foi conjurado e nada foi gasto.");
			return;
		}
	}
	const rule = areaRuleFor(item, selection.formId, choiceId);
	const formBody = ritualFormBodyOf(item, selection.formId);
	const targetReq = ritualTargets(item, formBody);
	const rangeReq = ritualRange(item, formBody);
	// Alvos já marcados precisam cumprir o ritual (quantidade e alcance) antes de pagar qualquer coisa.
	if (!rule?.area && selection.targetIds.length && ["creature", "object"].includes(targetReq.kind)) {
		const check = checkRitualTargets(actor, item, selection.formId, selection.targetIds);
		if (!check.ok) {
			ui.notifications.warn(`${check.problems.join(" ")} Nada foi gasto.`);
			return;
		}
		selection = { ...selection, targetIds: check.valid };
	}
	let deferArea = false;
	if (areaTemplateData(item, rule)) {
		const placed = await placeAreaTemplate(actor, item, rule, { range: rangeReq });
		if (!placed) {
			// sem área agora: o custo é pago e a carta do chat traz o botão para escolher a área depois
			deferArea = true;
			ui.notifications.info("Área não colocada agora. Use o botão Selecionar área na carta do ritual.");
		} else {
			templateId = placed.template.id;
			if (!rule?.chosen) selection = { ...selection, targetIds: placed.tokenIds };
			areaNote = `Área colocada no mapa; ${placed.tokenIds.length} token(s) dentro dela.`;
		}
	}
	if (!(await spendPd(actor, selection.cost))) {
		ui.notifications.warn("Não foi possível pagar o custo em PD; o ritual não foi iniciado.");
		return;
	}
	const cast = {
		actorId: actor.id,
		itemId: item.id,
		formId: selection.formId,
		circle: selection.circle,
		cost: selection.cost,
		targetIds: selection.targetIds,
		concentration: selection.concentration,
		damageDt: selection.damageDt,
		effect: selection.effect,
		areaNote,
		templateId,
		choiceId,
		casterTokenId: actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id)?.id ?? null,
	};
	// Os testes do conjurador saem como rolagens normais de perícia, logo após o pagamento.
	const outcome = await runCasterTests(actor, item, cast);
	if (!outcome) {
		// O jogador desistiu da rolagem: o custo já foi pago, então a carta com botão fica como alternativa.
		await ChatMessage.create({
			content: buildChatCard(actor, item, cast, { pending: true, sanityNotes: [], resistances: [] }),
			speaker: ChatMessage.getSpeaker({ actor }),
			flags: { ordem_v2_classic: { ritualCast: { ...cast, status: "pending" } } },
		});
		return;
	}
	// Falta área ou alvo: a carta fica esperando o jogador (botões Selecionar área / Selecionar alvos).
	const selfOnly = targetReq.kind === "self" || rangeReq.kind === "personal";
	const wantsArea = rule?.area && !templateId && !rule.chosen;
	const wantsTargets = rule && !rule.narrative && !selfOnly && !rule.area ? !cast.targetIds.length : rule?.chosen ? !cast.targetIds.length : false;
	if (rule && !outcome.interrupted && (wantsArea || wantsTargets || (deferArea && rule.area))) {
		const waiting = { ...outcome, awaitingArea: !!(wantsArea || deferArea), awaitingTargets: !wantsArea && !deferArea };
		await ChatMessage.create({
			content: buildChatCard(actor, item, cast, waiting),
			speaker: ChatMessage.getSpeaker({ actor }),
			flags: { ordem_v2_classic: { ritualCast: { ...cast, status: "needsTargets", outcome: waiting } } },
		});
		return;
	}
	const needsGm = !outcome.interrupted && (rule ? true : cast.targetIds.length && (item.system.skillResis || cast.effect));
	const message = await ChatMessage.create({
		content: buildChatCard(actor, item, cast, { ...outcome, effectsPending: !!needsGm }),
		speaker: ChatMessage.getSpeaker({ actor }),
		flags: { ordem_v2_classic: { ritualCast: { ...cast, status: needsGm ? "effects" : "resolved", outcome } } },
	});
	if (!needsGm) return playRitualAnimation(actor, item, cast, outcome);
	gmNotice(game.i18n.format("op.gmNotice.ritualPending", { actor: actor.name, ritual: item.name }), { kind: "ritual" });
	// Resistência e dano/cura dos alvos precisam de permissão do Mestre.
	if (game.user.isGM) await resolvePendingCast(message);
	else game.socket.emit("system.ordem_v2_classic", { type: "ritualCastTest", messageId: message.id, userId: game.user.id });
}

/** Testes do conjurador (Vontade de concentração e Ocultismo de custo). Devolve null se a rolagem foi cancelada. */
async function runCasterTests(actor, item, cast) {
	const outcome = { interrupted: false, sanityPd: 0, sanityNotes: [], resistances: [] };
	const concentrationDt = getConcentrationDt(cast);
	if (concentrationDt !== null) {
		const result = await rollUntilDone(actor, "will", concentrationDt);
		if (!result) return null;
		outcome.concentration = { dt: concentrationDt, text: `${result.total} — ${result.status === "success" ? "sucesso" : "falha"}` };
		outcome.interrupted = result.status === "failure";
	}
	if (!outcome.interrupted && item.system.element !== "fear") {
		const dt = 20 + cast.cost;
		ui.notifications.info(`Custo do Paranormal: teste de Ocultismo contra DT ${dt} (20 + custo do círculo). Se falhar, você perde mais ${cast.cost} PD.`);
		const result = await rollUntilDone(actor, "occultism", dt);
		if (!result) return null;
		outcome.occultism = { dt, text: `${result.total} — ${result.status === "success" ? "sucesso" : "falha"}` };
		if (result.status === "failure") {
			outcome.sanityPd = await applySanityCostToPd(actor, cast.cost);
			outcome.sanityNotes.push(`Você falhou no teste de Ocultismo e perde mais ${outcome.sanityPd} PD.`);
			if (outcome.sanityPd < cast.cost) outcome.sanityNotes.push(`Faltaram ${cast.cost - outcome.sanityPd} PD para cobrir toda a perda; o mestre resolve o restante.`);
			if (result.margin <= -5) outcome.sanityNotes.push("A falha foi grave: o mestre aplica também uma perda permanente de 1 de Sanidade.");
		}
	} else if (!outcome.interrupted) {
		outcome.sanityPd = await applySanityCostToPd(actor, cast.cost);
		const permanentLoss = cast.formId === "basic" ? 1 : cast.formId === "student" ? 2 : 3;
		outcome.sanityNotes.push(`Ritual de Medo: você perde mais ${outcome.sanityPd} PD.`);
		outcome.sanityNotes.push(`O mestre aplica também uma perda permanente de ${permanentLoss} de Sanidade.`);
	}
	return outcome;
}

/** Rola a perícia; se o jogador fechar a janela, pergunta se quer rolar de novo. Devolve null se desistir. */
async function rollUntilDone(actor, skill, dt) {
	for (;;) {
		const result = rollOutcome(await rollSkill(actor, skill, dt), dt);
		if (result.status !== "cancelled") return result;
		const again = await foundry.applications.api.DialogV2.confirm({
			window: { title: "Teste do ritual" },
			content: "<p>O custo do ritual já foi pago. Rolar o teste agora?</p>",
			yes: { label: "Rolar" },
			no: { label: "Depois" },
			rejectClose: false,
		});
		if (!again) return null;
	}
}

function playRitualAnimation(actor, item, cast, outcome) {
	if (outcome.interrupted || item.type !== "ritual" || !game.modules.get("autoanimations")?.active) return;
	// o Automated Animations só funciona com as configurações dele registradas; sem elas ele lança erro a cada conjuração
	if (!game.settings.settings.has("autoanimations.aaAutorec-templatefx")) return;
	try {
		const sourceToken = actor.getActiveTokens().find((token) => token.document?.parent?.id === canvas.scene?.id);
		const targets = cast.targetIds.map((id) => canvas.tokens.get(id)).filter(Boolean);
		// Mapped animations are casting visuals on the caster, so a target is optional.
		if (sourceToken) Hooks.callAll("aa.workflow", sourceToken, item, { targets });
	} catch (animationError) {
		console.warn("Animação do ritual indisponível:", animationError);
	}
}

/** Resolve a carta: se vier dos testes já rolados (stage "effects"), só aplica resistência e efeitos; senão rola tudo. */
async function resolvePendingCast(message) {
	const cast = message?.getFlag("ordem_v2_classic", "ritualCast");
	if (!cast || !["pending", "effects"].includes(cast.status)) return;
	const actor = game.actors.get(cast.actorId);
	const item = actor?.items.get(cast.itemId);
	if (!actor || !item) return ui.notifications.error("Não encontrei o Agente ou ritual desta mensagem.");
	if (!game.user.isGM && !actor.isOwner) return ui.notifications.warn("Somente o Agente ou o Mestre pode rolar este ritual.");
	const previousStatus = cast.status;
	await message.setFlag("ordem_v2_classic", "ritualCast", { ...cast, status: "rolling" });
	const selection = cast;
	try {
		let outcome = cast.outcome;
		if (previousStatus === "pending") {
			outcome = await runCasterTests(actor, item, selection);
			if (!outcome) {
				await message.setFlag("ordem_v2_classic", "ritualCast", { ...cast, status: "pending" });
				return ui.notifications.info("O teste foi cancelado; a carta continua disponível para tentar novamente.");
			}
		}
		outcome.resistances = [];
		// Rituais mapeados em ritual-area-rules.mjs: o motor de área cuida de resistência, dano e condições.
		const rule = areaRuleFor(item, selection.formId, selection.choiceId);
		if (rule && !outcome.interrupted) {
			const lines = await resolveAreaCast(selection, rule);
			// Ritual que age nos alvos marcados e nenhum foi marcado: a carta ganha botões para escolher a área / rolar o dano.
			if (previousStatus === "effects" && rule.onCast && !selection.templateId && lines.affected === 0) {
				outcome.awaitingTargets = true;
				outcome.areaLines = [];
				await message.update({ content: buildChatCard(actor, item, selection, outcome) });
				await message.setFlag("ordem_v2_classic", "ritualCast", { ...cast, status: "needsTargets", outcome });
				return;
			}
			delete outcome.awaitingTargets;
			outcome.areaLines = lines;
		}
		if (!rule && !outcome.interrupted && selection.targetIds.length && item.system.skillResis) {
			const skill = ritualResistanceTarget(item);
			const dt = Number(actor.system.ritual?.DT);
			if (!skill || !Number.isFinite(dt)) {
				outcome.resistances.push({ name: "Alvos", skill: skill ?? item.system.skillResis, text: "perícia ou DT indisponível; resolva manualmente" });
			} else {
				for (const id of selection.targetIds) {
					const token = canvas.tokens.get(id);
					if (!token?.actor) continue;
					const roll = await rollSkill(token.actor, skill, dt);
					const result = rollOutcome(roll, dt);
					outcome.resistances.push({
						name: token.name,
						skill: localizeChoice("dropdownSkillResis", skill, skill),
						text: result.status === "cancelled" ? "rolagem cancelada" : `${result.total} — ${result.status === "success" ? "passou" : "falhou"} (DT ${dt})`,
					});
				}
			}
		}
		if (!rule && !outcome.interrupted && selection.effect) {
			for (const id of selection.targetIds) {
				const token = canvas.tokens.get(id);
				const target = token?.actor;
				if (!target) continue;
				const roll = await new Roll(selection.effect.formula).evaluate({ async: true });
				const amount = Math.max(0, Math.floor(Number(roll.total)));
				if (selection.effect.kind === "healing") {
					// agentes guardam o PV em system.PV; ameaças em system.attributes.hp
					const isThreat = target.type === "threat";
					const resource = isThreat ? target.system.attributes?.hp : target.system.PV;
					const before = Number(resource?.value);
					const maximum = Number(resource?.max);
					if (!Number.isFinite(before) || !Number.isFinite(maximum)) throw new Error("Alvo sem PV estruturado na ficha.");
					const after = Math.min(maximum, before + amount);
					await target.update({ [isThreat ? "system.attributes.hp.value" : "system.PV.value"]: after });
					outcome.effects = outcome.effects ?? [];
					outcome.effects.push(`${token.name}: cura ${amount} PV (${before} → ${after}; máximo ${maximum}).`);
				} else {
					const result = await target.applyDamage(amount);
					outcome.effects = outcome.effects ?? [];
					outcome.effects.push(`${token.name}: dano rolado ${amount} PV; ${result.newPV === null ? "aplicação delegada ao Mestre" : `PV restantes ${result.newPV}`} (bloqueado: ${result.blocked}).`);
				}
			}
		}
		delete outcome.effectsPending;
		await message.update({ content: buildChatCard(actor, item, selection, outcome) });
		await message.setFlag("ordem_v2_classic", "ritualCast", { ...cast, status: "resolved", outcome });
		playRitualAnimation(actor, item, selection, outcome);
	} catch (error) {
		await message.setFlag("ordem_v2_classic", "ritualCast", { ...cast, status: previousStatus });
		ui.notifications.error(`Não foi possível resolver o ritual: ${error.message}`);
	}
}

/** Botão "Rolar dano" da carta de um ritual conjurado sem alvo: usa os alvos marcados agora e resolve. */
async function continueAreaCast(messageId, mode) {
	const message = game.messages.get(messageId);
	const cast = message?.getFlag("ordem_v2_classic", "ritualCast");
	if (!cast || cast.status !== "needsTargets") return ui.notifications.warn("Este ritual já foi resolvido.");
	const actor = game.actors.get(cast.actorId);
	const item = actor?.items.get(cast.itemId);
	if (!actor || !item) return ui.notifications.error("Não encontrei o Agente ou ritual desta mensagem.");
	if (!game.user.isGM && !actor.isOwner) return ui.notifications.warn("Somente o Agente ou o Mestre pode usar esta carta.");
	const rule = areaRuleFor(item, cast.formId, cast.choiceId);
	const update = { ...cast, status: "effects" };
	if (mode === "place") {
		const range = ritualRange(item, ritualFormBodyOf(item, cast.formId));
		const placed = await placeAreaTemplate(actor, item, rule, { range });
		if (!placed) return ui.notifications.info("Área não colocada.");
		update.templateId = placed.template.id;
		if (!rule?.chosen) update.targetIds = placed.tokenIds;
		update.areaNote = `Área colocada no mapa; ${placed.tokenIds.length} token(s) dentro dela.`;
		if (rule?.chosen && !(update.targetIds ?? []).length) {
			// "alvos a sua escolha": a área só marca onde; os alvos vêm dos tokens marcados
			update.targetIds = [...game.user.targets].map((token) => token.id);
		}
	} else {
		const marked = [...game.user.targets].map((token) => token.id);
		if (!marked.length) return ui.notifications.warn("Marque pelo menos um alvo (tecla T sobre o token) e clique de novo.");
		const check = checkRitualTargets(actor, item, cast.formId, marked);
		if (!check.ok) return ui.notifications.warn(check.problems.join(" "));
		update.targetIds = check.valid;
	}
	await message.setFlag("ordem_v2_classic", "ritualCast", update);
	if (game.user.isGM) await resolvePendingCast(message);
	else game.socket.emit("system.ordem_v2_classic", { type: "ritualCastTest", messageId, userId: game.user.id });
}

export const rollRitualAreaDamage = (messageId) => continueAreaCast(messageId, "roll");
export const placeRitualArea = (messageId) => continueAreaCast(messageId, "place");

export async function resolvePendingRitualCast(messageId) {
	const message = game.messages.get(messageId);
	if (!message) return ui.notifications.warn("Não encontrei a mensagem do ritual no chat.");
	return resolvePendingCast(message);
}

export async function runRitualCasterMacro(preferredAgent = null, preferredItemId = null) {
	if (game.system.id !== "ordem_v2_classic") {
		ui.notifications.error("Esta macro foi criada para o sistema Ordem Paranormal v2 Classic.");
		return;
	}
	const preferredIsUsable = preferredAgent?.type === "agent" && (game.user.isGM || preferredAgent.isOwner);
	const agent = preferredIsUsable ? preferredAgent : await chooseAgent(macroCandidates());
	if (!agent) return;
	const withoutSanity = game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity");
	if (!withoutSanity || !inspectRitualResource(agent, withoutSanity).ok) {
		ui.notifications.error("A macro usa PD. Ative a regra global ‘Jogando sem Sanidade’ para conjurar.");
		return;
	}
	const items = agent.items
		.filter((item) => item.type === "ritual")
		.sort((a, b) => Number(a.system.circle) - Number(b.system.circle) || a.name.localeCompare(b.name, "pt-BR"));
	if (!items.length) {
		ui.notifications.info(`${agent.name} não tem rituais cadastrados na ficha.`);
		return;
	}
	const selection = await renderPicker(agent, items, getTokensForDialog(), preferredItemId);
	if (!selection) return;
	if (selection.invalid) {
		ui.notifications.warn(selection.invalid);
		return;
	}
	await resolveCast(agent, selection);
}

export const ritualCasterMacroImage = MACRO_IMG;
