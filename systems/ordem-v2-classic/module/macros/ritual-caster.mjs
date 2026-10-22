import { gmNotice } from "../helpers/gm-notice.mjs";
import { castRequirements } from "../helpers/affinity.mjs";
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
import { rectGap, ritualRange, ritualTargets, validateTargetSelection } from "./ritual-targeting.mjs";
import { hasConditionProp } from "../helpers/conditions.mjs";
import { areaChoicesFor, areaRuleFor } from "./ritual-area-rules.mjs";
import { damageLabel, registerAreaHooks, resolveAreaCast, setRuleResolver, undoAreaRow } from "./ritual-area-engine.mjs";
import { isWeaponCurseRitual } from "../helpers/weapon-curse.mjs";
import { ritualAnimationName } from "../integrations/ritual-animations.mjs";
import { applyWeaponCurse } from "../helpers/weapon-curse-runtime.mjs";
import { FLOW_SETTING, flowSetting } from "../helpers/ritual-flow-settings.mjs";
import { catalystOptions, consumeCatalyst, empowerDamageParts, planCatalyst } from "../helpers/paranormal-items.mjs";
import { addOneDie } from "../helpers/paranormal-item-rules.mjs";
import { MODIFIER, classifyRitual } from "./ritual-profiles.mjs";
import { canEndRitual, canSwapTarget, cardTone, summaryLine } from "./ritual-flow-logic.mjs";
import {
	activeSum, chips, damageButtonLabel, damageGate, damageView, effectSentence, extractDice, resultBanner, rollBreakdown, testBlocks, damageTypeIcon, costNote,
} from "./ritual-card-view.mjs";

/** Liga os gatilhos das zonas de ritual (início de turno, saída da área). Chamado uma vez ao carregar o mundo. */
export function registerRitualAreaHooks() {
	registerRitualChatHooks();
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

const ICON_SHEET = "/systems/ordem-v2-classic/assets/ritual-elementos.png";
const MACRO_IMG = "icons/svg/book.svg";
const spendingActorIds = new Set();
const LOCALIZED = (key, fallback) => {
	const label = game.i18n.localize(key);
	return label === key ? fallback : label;
};

export function escapeHtml(value) {
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

export function localizeChoice(group, value, fallback = "—") {
	if (!value) return fallback;
	const portuguese = RITUAL_PT_BR_CHOICES[group]?.[value];
	if (portuguese) return portuguese;
	const key = CONFIG.op?.[group]?.[value];
	return key ? LOCALIZED(key, value) : value;
}

export function elementInfo(item) {
	const key = item.system.element;
	const known = RITUAL_ELEMENTS[key];
	return known ?? { label: key || "Sem afinidade", color: "#8b8490", iconIndex: 0 };
}

export function getRitualForms(item) {
	const forms = ritualFormOptions(item);
	const saved = item.flags?.["ordem-v2-classic"]?.ritualLibrary?.forms;
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

export function ritualImage(item, info, size = 48) {
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
	// Afinidade exigida pela forma (impede) e componentes do elemento (só avisa)
	const requirements = castRequirements(actor, item.system.element, formId === "basic" ? null : chosenForm.requiredAffinity);
	if (!requirements.affinity.ok) return { ok: false, reason: `Esta forma exige afinidade com ${requirements.affinity.label}.`, item, circle, cost };
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
	// Amaldiçoar Arma não causa dano ao alvo: o +Nd6 vai para a arma (ver weapon-curse-runtime.mjs).
	const effect = isWeaponCurseRitual(item) ? null : ritualEffectFromText(effectText);
	return { ok: true, item, formId, circle, cost, targetIds, effect, componentNote: requirements.components.note };
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

/** Campo "Catalisador": só aparece quando a ficha tem catalisador empunhado do elemento do ritual. */
function catalystSelectHtml(actor, item) {
	const options = catalystOptions(actor, item.system.element);
	if (!options.length) return "";
	return `<div class="form-group ritual-catalyst" style="margin:6px 0"><label for="ritual-catalyst">Catalisador</label><select id="ritual-catalyst" name="catalystId"><option value="">Nenhum</option>${options.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join("")}</select></div>`;
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
		${catalystSelectHtml(actor, item)}
		<p class="ritual-cast-summary" style="margin-bottom:0;font-weight:600"></p>`;

	const form = section.closest("form");
	form.elements.ritualId.value = item.id;
	const updateFormNote = () => {
		const selected = getFormSelection(form, actor, new Map([[item.id, item]]), game.settings.get("ordem-v2-classic", "globalPlayingWithoutSanity"));
		const summary = section.querySelector(".ritual-cast-summary");
		const button = form.querySelector('button[data-action="conjure"]');
		const targetCount = getSelectedTargetIds().length;
		summary.textContent = selected.ok ? `${form.elements.ritualForm.value === "basic" ? "Básico" : form.elements.ritualForm.value === "student" ? "Discente" : "Verdadeiro"} · ${selected.circle}º círculo · ${selected.cost} PD · saldo após pagar: ${actor.system.PD.value - selected.cost} PD${targetCount ? ` · alvos marcados: ${targetCount}` : " · sem alvo marcado; resolução manual conforme a descrição"}` : selected.reason ?? "Revise as opções do ritual.";
		if (selected.ok && selected.componentNote) summary.textContent += ` · ${selected.componentNote}`;
		button.disabled = !selected.ok;
	};
	section._refresh = updateFormNote;
	section.querySelectorAll('[name="ritualForm"]').forEach((control) => control.addEventListener("change", updateFormNote));
	updateFormNote();
}

function renderPicker(actor, items, tokens, preferredItemId = null) {
	const itemsById = new Map(items.map((item) => [item.id, item]));
	const withoutSanity = game.settings.get("ordem-v2-classic", "globalPlayingWithoutSanity");
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
						catalystId: form.elements.catalystId?.value || null,
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

/** `configure: false` rola direto (sem a janela de rolagem); `true` abre a janela do sistema (Ajustes → Configurar a rolagem). */
async function rollSkill(actor, skill, target, { configure = true, whisper = false, effectElement = "" } = {}) {
	const rolls = await actor.rollSkill(
		{ skill, effectElement, rolls: [{ options: { target } }] },
		configure ? {} : { configure: false },
		{ create: false },
	);
	const roll = getRoll(rolls);
	// create:false devolve só o D20Roll; postamos a carta normal de perícia (com "SUCESSO/FALHA (DT)") no chat
	if (roll && Number.isFinite(Number(roll.total))) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) }, whisper ? { rollMode: CONST.DICE_ROLL_MODES.PRIVATE } : {});
	return roll;
}

function rollOutcome(roll, target) {
	if (!roll || !Number.isFinite(Number(roll.total))) return { status: "cancelled", total: null, margin: null };
	const total = Number(roll.total);
	return { status: total >= target ? "success" : "failure", total, margin: total - target, breakdown: rollBreakdown(roll) };
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

const SYSTEM_ID = "ordem-v2-classic";

/** Botão da carta que só o conjurador (dono do Agente) e o Mestre enxergam; o clique também confere a permissão. */
function ownerButton(action, actor, icon, label, extra = "") {
	return `<button type="button" data-action="${action}" data-owner-actor="${escapeHtml(actor.id)}"${extra}><i class="fa-solid ${icon}"></i> ${label}</button>`;
}

const grimoireOn = () => {
	try { return Boolean(game.settings.get(SYSTEM_ID, "grimoireEnabled")); } catch { return false; }
};

const iconTag = (icon, extra = "") => `<i class="fa-solid fa-${icon}${extra ? ` ${extra}` : ""}" aria-hidden="true"></i>`;

const gmIds = () => ChatMessage.getWhisperRecipients("GM").map((user) => user.id);

/** Pastilhas dos dados: uma por dado, o maior verde, o 1 vermelho, o descartado apagado. */
const chipsHtml = (chipList) => chipList.map((chip) => `<span class="rc2-die-chip" data-state="${chip.state}">${chip.value}</span>`).join("");

/** Teste do conjurador: número grande, só o ícone ✔/✖ embaixo; tocar abre cada dado e o bônus. */
function rollBlockHtml(block) {
	const known = block.success !== null && block.success !== undefined;
	const state = !known ? "none" : block.success ? "ok" : "bad";
	const verdict = "";
	if (block.total === null || block.total === undefined) return `<div class="rc2-test" data-state="${state}">${iconTag("dice-d20", "rc2-die")}<span class="rc2-test-text">${escapeHtml(block.text || "")}</span>${verdict}</div>`;
	const breakdown = block.breakdown;
	const crit = breakdown?.crit === "crit" ? '<span class="rc2-crit" title="20 natural">✦ 20 natural</span>' : breakdown?.crit === "fumble" ? '<span class="rc2-crit rc2-fumble" title="1 natural">☠ 1 natural</span>' : "";
	const bonus = breakdown?.bonus ? `<span class="rc2-bonus">${breakdown.bonus < 0 ? "−" : "+"} ${Math.abs(breakdown.bonus)}</span>` : "";
	const body = breakdown
		? `<div class="rc2-roll-body"><span class="rc2-faces">d20</span>${chipsHtml(breakdown.dice)}${bonus}<span class="rc2-eq">= ${block.total}</span>${crit}</div>`
		: `<div class="rc2-roll-body">${escapeHtml(block.text || "")}</div>`;
	return `<details class="rc2-roll" data-state="${state}" data-kind="${block.kind}"><summary>
		<span class="rc2-sum-main">${iconTag("dice-d20", "rc2-die")}<span class="rc2-total">${block.total}</span>${iconTag("chevron-down", "rc2-chevron")}</span>${verdict}<small class="rc2-label">${escapeHtml(block.label)}</small></summary>${body}</details>`;
}

/** Dano ou cura rolados na carta: o total e, aberto, cada dado por tipo de dano. */
function damageBlockHtml(view) {
	const healing = view.kind === "healing";
	const groups = view.groups.map((group) => {
		const dice = group.dice.map((term) => `<span class="rc2-faces">d${term.faces}</span>${chipsHtml(term.chips)}`).join("");
		const flat = group.flat ? `<span class="rc2-bonus">${group.flat < 0 ? "−" : "+"} ${Math.abs(group.flat)}</span>` : "";
		const label = group.type ? escapeHtml(damageLabel(group.type)) : "Total";
		return `<div class="rc2-dmg-group"><span class="rc2-dmg-type">${group.type && !healing ? `${iconTag(damageTypeIcon(group.type))} ` : ""}${label}${group.formula ? ` <small>${escapeHtml(group.formula)}</small>` : ""}</span><div class="rc2-dmg-dice">${dice}${flat}<span class="rc2-eq">= ${group.subtotal}</span></div></div>`;
	}).join("");
	const types = [...new Set(view.groups.map((group) => group.type).filter(Boolean))];
	const typedLabel = types.length ? `dano ${types.map((type) => `${iconTag(damageTypeIcon(type))} ${escapeHtml(damageLabel(type))}`).join(" · ")}` : "dano rolado";
	return `<details class="rc2-dmg" data-kind="${view.kind}"><summary>${iconTag(healing ? "heart-pulse" : damageTypeIcon(view.groups.length === 1 ? view.groups[0].type : ""), "rc2-dmg-icon")}<strong class="rc2-amount">${healing ? "+" : ""}${view.total} PV</strong>${iconTag("chevron-down", "rc2-chevron")}<small class="rc2-label">${healing ? "cura" : typedLabel}</small></summary><div class="rc2-roll-body rc2-dmg-body">${groups}</div></details>`;
}

export function buildChatCard(actor, item, selection, outcome) {
	const info = elementInfo(item);
	const swapNames = (outcome.swap?.created ?? []).map((entry) => entry.actorName);
	const targetNames = swapNames.length ? swapNames : (selection.targetIds ?? []).map((id) => canvas.tokens.get(id)?.name ?? "Alvo removido da cena");
	const selectedCircle = Number(selection.circle ?? item.system.circle);
	const waiting = Boolean(outcome.awaitingCurse || outcome.awaitingArea || outcome.awaitingTargets || outcome.effectsPending || outcome.pending);
	const tone = cardTone({ pending: waiting, interrupted: outcome.interrupted, occultismFailed: outcome.occultism?.success === false });
	const toneColor = tone === "failure" ? "#b3262d" : tone === "pending" ? "#8b8490" : info.color;
	const banner = resultBanner(outcome);
	const extra = outcome.extra?.applied ? Number(outcome.extra.appliedAmount) || 0 : 0;
	const fichas = chips({ cost: selection.cost, extra, dt: outcome.occultism?.dt, concentrationDt: outcome.concentration?.dt, targetNames }).map((chip) => `<span class="rc2-chip" data-kind="${chip.kind}"${chip.title ? ` title="${escapeHtml(chip.title)}"` : ""}>${iconTag(chip.icon)} ${escapeHtml(chip.text)}${chip.extra ? ` <b class="rc2-extra">${chip.extra}</b>` : ""}</span>`).join("");
	const tests = testBlocks(outcome).map(rollBlockHtml).join("");
	const view = damageView(outcome.damageRoll);
	const damageHtml = view ? damageBlockHtml(view) : "";
	const baseText = ritualDescriptionText(item.system.description).split(/\b(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/i)[0];
	const effectLine = effectSentence({ effects: outcome.effects ?? [], baseText });
	const summary = summaryLine({
		casterName: actor.name, ritualName: item.name, targetNames, cost: selection.cost,
		occultism: outcome.occultism?.total !== undefined ? { total: outcome.occultism.total, dt: outcome.occultism.dt, success: outcome.occultism.success } : null,
		interrupted: outcome.interrupted,
	});
	// a frase do efeito já mostra o primeiro efeito inteiro; os Detalhes listam só o que sobra
	const shown = (outcome.effects ?? []).find((line) => String(line).trim());
	const hidden = shown && effectLine === shown ? shown : null;
	const effects = [...(outcome.effects ?? []).filter((line) => line !== hidden), ...(outcome.swapLog ?? [])].map((effect) => `<li>${escapeHtml(effect)}</li>`).join("");
	const sanity = (outcome.sanityNotes ?? []).filter((note) => !/sanidade|\bSAN\b/i.test(note)).map((note) => `<li>${escapeHtml(note)}</li>`).join("");
	const swapButton = outcome.swap?.created?.length && !outcome.swap.closed ? `<p>${ownerButton("ritual-swap-target", actor, "fa-rotate", "Trocar alvo")}</p>` : "";
	const endButton = outcome.active && !outcome.active.ended ? `<p>${ownerButton("ritual-end", actor, "fa-stop", "Encerrar", ` data-effect-uuid="${escapeHtml(outcome.active.effectUuid)}"`)}</p>` : "";
	const damageButton = outcome.awaitingDamage ? `<p>${ownerButton("ritual-roll-damage", actor, "fa-burst", damageButtonLabel(outcome.awaitingDamage))}</p>` : "";
	const panelNote = outcome.areaManual && outcome.panelMessageId ? '<p class="ritual-gm-only"><em>Painel de resolução enviado ao Mestre.</em></p>' : "";
	const link = grimoireOn();
	const name = link
		? `<button type="button" class="rc2-name" data-action="ritual-open-grimoire" data-ritual-name="${escapeHtml(item.name)}" data-form="${escapeHtml(selection.formId ?? "basic")}" aria-label="Abrir ${escapeHtml(item.name)} no Grimório" title="Abrir no Grimório">${escapeHtml(item.name)} ${iconTag("arrow-up-right-from-square", "rc2-link-icon")}</button>`
		: `<span class="rc2-name">${escapeHtml(item.name)}</span>`;
	const grimoireButton = link ? `<button type="button" class="rc2-grimoire" data-action="ritual-open-grimoire" data-ritual-name="${escapeHtml(item.name)}" data-form="${escapeHtml(selection.formId ?? "basic")}">${iconTag("book-open")} Ler no Grimório</button>` : "<span></span>";
	const chosenCircle = selectedCircle > Number(item.system.circle) ? ` · ${selectedCircle}º círculo escolhido` : ` · ${selectedCircle}º círculo`;
	const costLine = costNote({ cost: selection.cost, extra });
	const hasDetails = costLine || effects || sanity;
	return `<article class="ritual-cast-card ritual-tone-${tone}" data-tone="${tone}" aria-label="${escapeHtml(summary)}" style="--rc2-tone:${toneColor};">
		<header class="rc2-head">
			${ritualImage(item, info, 44)}<div class="rc2-head-text"><h3>${name}</h3><small>${escapeHtml(actor.name)}${chosenCircle} · ${escapeHtml(info.label)}</small></div>
		</header>
		${banner ? `<div class="rc2-banner" data-state="${banner.state}">${iconTag(banner.icon)}<div><strong>${escapeHtml(banner.label)}</strong><span>${escapeHtml(banner.text)}</span></div></div>` : ""}
		${fichas ? `<div class="rc2-chips">${fichas}</div>` : ""}
		${tests ? `<div class="rc2-tests">${tests}</div>` : ""}
		${damageHtml}
		${effectLine ? `<p class="rc2-effect">${escapeHtml(effectLine)}</p>` : ""}
		${selection.areaNote ? `<p class="rc2-note"><em>${escapeHtml(selection.areaNote)}</em></p>` : ""}
		${selection.catalystNote ? `<p class="rc2-note"><em>${escapeHtml(selection.catalystNote)}</em></p>` : ""}
		<div class="rc2-actions">
			${outcome.awaitingCurse ? '<p><button type="button" data-action="ritual-curse-self"><i class="fa-solid fa-user"></i> Aplicar em você</button> <button type="button" data-action="ritual-curse-target"><i class="fa-solid fa-crosshairs"></i> Selecionar alvo</button></p>' : ""}
			${outcome.awaitingArea ? '<p><button type="button" data-action="ritual-area-place"><i class="fa-solid fa-draw-polygon"></i> Selecionar área</button></p>' : ""}
			${outcome.awaitingTargets ? '<p><button type="button" data-action="ritual-area-roll"><i class="fa-solid fa-crosshairs"></i> Selecionar alvos e rolar dano</button></p>' : ""}
			${outcome.pending ? '<button type="button" data-action="ritual-test"><i class="fa-solid fa-dice-d20"></i> Rolar teste do ritual</button>' : ""}
			${damageButton}${swapButton}${endButton}${panelNote}
		</div>
		<footer class="rc2-foot">${grimoireButton}${hasDetails ? `<details class="ritual-card-details"><summary>Detalhes</summary>
			${costLine ? `<p class="rc2-cost-note">${iconTag("droplet")} ${escapeHtml(costLine)}</p>` : ""}
			${effects ? `<h4>Efeitos aplicados</h4><ul>${effects}</ul>` : ""}
			${sanity ? `<h4>Consequências</h4><ul>${sanity}</ul>` : ""}
		</details>` : ""}</footer>
	</article>`;
}

/* -------------------------------------------- */
/*  Mensagem das criaturas (só o Mestre)        */
/* -------------------------------------------- */

const SKILL_NAMES = { will: "Vontade", resilience: "Fortitude", reflexes: "Reflexos", fighting: "Luta" };

/** Linhas da mensagem das criaturas a partir das linhas do motor de área (cada uma com `save`, `parts` e `applied`). */
function creatureRowsFromEngine(rows = []) {
	return rows.filter((row) => !["disabled", "ignored"].includes(row.state)).map((row) => ({
		name: row.name, img: row.img ?? "", save: row.save ?? null, saveRule: row.saveRule ?? null,
		parts: (row.parts ?? []).map((part) => ({ type: part.type, full: part.full, amount: part.amount })),
		dealt: row.applied?.dealt ?? null, hpBefore: row.applied?.hpBefore ?? null, state: row.state === "applied" ? "applied" : "pending",
		notes: [...(row.notes ?? []), ...(row.conditions ?? []).map((cond) => cond.label ?? cond.key).filter(Boolean)],
	}));
}

function creatureRowHtml(row) {
	const save = row.save
		? `<span class="rc2-c-save" data-state="${row.save.passed ? "ok" : "bad"}">${escapeHtml(SKILL_NAMES[row.save.skill] ?? row.save.skill ?? "")} <b>${row.save.total ?? "—"}</b> vs ${row.save.dt} ${iconTag(row.save.passed ? "circle-check" : "circle-xmark")}</span>${row.save.breakdown ? `<details class="rc2-c-dice"><summary>dados</summary><div class="rc2-roll-body">${chipsHtml(row.save.breakdown.dice ?? [])}${row.save.breakdown.bonus ? `<span class="rc2-bonus">${row.save.breakdown.bonus < 0 ? "−" : "+"} ${Math.abs(row.save.breakdown.bonus)}</span>` : ""}</div></details>` : ""}`
		: '<span class="rc2-c-save">sem resistência</span>';
	const rolled = row.parts.reduce((total, part) => total + (Number(part.full ?? part.amount) || 0), 0);
	const final = row.parts.reduce((total, part) => total + (Number(part.amount) || 0), 0);
	const mode = row.save ? (row.save.passed ? (final < rolled ? "metade" : final === 0 ? "anulado" : "total") : "total") : "total";
	const dmg = row.parts.length ? `<span class="rc2-c-dmg">${rolled !== final ? `rolou ${rolled} · ${mode} → ` : ""}<b>${row.dealt ?? final} PV</b>${Number.isFinite(Number(row.hpBefore)) ? ` · PV ${row.hpBefore} → ${Number(row.hpBefore) - (Number(row.dealt) || 0)}` : ""}</span>` : "";
	const state = row.state === "applied" ? '<span class="rc2-state" data-state="applied">aplicado</span>' : '<span class="rc2-state" data-state="pending">pendente</span>';
	return `<li class="rc2-creature"><img src="${escapeHtml(row.img)}" alt="" width="28" height="28"><div class="rc2-c-main"><strong>${escapeHtml(row.name)}</strong>${save}${dmg}${row.notes.length ? `<small>${row.notes.map(escapeHtml).join(" · ")}</small>` : ""}</div>${state}</li>`;
}

/** Posta (só ao Mestre) a mensagem das criaturas: resistências, dano final, PV e o botão Desfazer. Devolve o id. */
async function postCreatureMessage(actor, item, cardMessageId, rows, { undo = false } = {}) {
	if (!rows.length) return null;
	const content = `<article class="ritual-creatures" data-card-id="${escapeHtml(cardMessageId)}">
		<header class="rc2-c-head">${iconTag("skull")} <strong>${escapeHtml(item.name)}</strong> <small>· criaturas</small></header>
		<ul class="rc2-creatures">${rows.map(creatureRowHtml).join("")}</ul>
		${undo ? `<p class="rc2-c-undo"><button type="button" data-action="ritual-undo-hostile" data-card-id="${escapeHtml(cardMessageId)}"><i class="fa-solid fa-rotate-left"></i> Desfazer</button></p>` : ""}
	</article>`;
	const message = await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }), whisper: gmIds(), flags: { [SYSTEM_ID]: { ritualCreatures: { cardMessageId } } } });
	return message?.id ?? null;
}

/* -------------------------------------------- */
/*  Rolar o dano na carta                       */
/* -------------------------------------------- */

/** Rola cada parte do dano (ou a cura) e guarda os dados como dados simples na mensagem; nada vai para o chat à parte. */
async function rollCardDamage(parts, kind) {
	const rolled = [];
	let total = 0;
	for (const part of parts) {
		const roll = await new Roll(part.formula).evaluate();
		try { await game.dice3d?.showForRoll(roll, game.user, true); } catch { /* sem Dice So Nice: segue */ }
		const dice = extractDice(roll);
		const amount = Math.max(0, Math.floor(Number(roll.total)));
		total += amount;
		rolled.push({ type: part.type ?? "", formula: part.formula, total: amount, dice, flat: Number(roll.total) - activeSum(dice) });
	}
	return { kind, total, parts: rolled };
}

/** As partes de dano de um ritual: as do motor de área, ou a fórmula do efeito simples. */
function damagePartsOf(item, cast) {
	const rule = areaRuleFor(item, cast.formId, cast.choiceId);
	if (rule?.onCast?.damage?.length) return { kind: "damage", parts: cast.extraDie ? empowerDamageParts(rule.onCast.damage) : rule.onCast.damage };
	if (cast.effect?.formula) return { kind: cast.effect.kind === "healing" ? "healing" : "damage", parts: [{ formula: cast.effect.formula, type: "" }] };
	return null;
}

/**
 * Botão "Rolar dano" (ou "Rolar cura") da carta: quem conjurou ou o Mestre rola os dados na própria mensagem do ritual.
 * Depois a resolução nas criaturas roda no cliente do Mestre (por socket quando quem clicou é jogador).
 */
export async function rollRitualDamage(messageId) {
	const { message, cast, actor, item } = castOfMessage(messageId);
	if (!message || !actor || !item) return ui.notifications.warn("Não encontrei o ritual desta carta.");
	if (cast.status !== "needsDamage") return ui.notifications.info("O dano deste ritual já foi rolado.");
	if (!game.user.isGM && !actor.isOwner) return ui.notifications.warn("Só o conjurador ou o Mestre rola o dano.");
	const lock = `damage:${messageId}`;
	if (spendingActorIds.has(lock)) return;
	spendingActorIds.add(lock);
	try {
		const plan = damagePartsOf(item, cast);
		if (!plan) return ui.notifications.warn("Este ritual não tem dano para rolar.");
		const damageRoll = await rollCardDamage(plan.parts, plan.kind);
		const outcome = { ...cast.outcome, damageRoll };
		delete outcome.awaitingDamage;
		const update = { ...cast, status: "effects", damageRequested: true, outcome };
		await message.update({ content: buildChatCard(actor, item, cast, { ...outcome, effectsPending: true }) });
		await message.setFlag(SYSTEM_ID, "ritualCast", update);
	} finally {
		spendingActorIds.delete(lock);
	}
	if (game.user.isGM) await resolvePendingCast(game.messages.get(messageId));
	else game.socket.emit("system.ordem-v2-classic", { type: "ritualCastTest", messageId, userId: game.user.id });
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

export function ritualFormBodyOf(item, formId) {
	return formId === "basic" ? "" : (ritualFormOptions(item)[formId]?.body ?? "");
}

/**
 * Confere os alvos marcados contra o que o ritual pede (quantidade e alcance).
 * Sem informação de alcance vale curto; "toque" exige o espaço ao lado; "pessoal" não usa alvos.
 */
export function checkRitualTargets(actor, item, formId, tokenIds, rangeKey = null) {
	const body = ritualFormBodyOf(item, formId);
	const targets = ritualTargets(item, body);
	const range = rangeKey ? ritualRange({ system: { range: rangeKey } }) : ritualRange(item, body);
	const casterToken = actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id);
	if (!casterToken) return { ok: true, valid: tokenIds, problems: [], targets, range };
	const selected = tokenIds.map((id) => canvas.tokens.get(id)).filter(Boolean).map(tokenRect);
	const result = validateTargetSelection({ range, targets, caster: tokenRect(casterToken), selected, pxPerMeter: canvas.dimensions.size / canvas.dimensions.distance });
	return { ...result, targets, range };
}

/** Distância em metros entre o conjurador e um token (para o chip "✔ 6 m" do cartão). null se não houver token do conjurador. */
export function distanceToCaster(actor, tokenId) {
	const casterToken = actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id);
	const token = canvas.tokens.get(tokenId);
	if (!casterToken || !token) return null;
	const gap = rectGap(tokenRect(casterToken), tokenRect(token));
	return gap / (canvas.dimensions.size / canvas.dimensions.distance);
}

function playCastSound() {
	if (!flowSetting(FLOW_SETTING.sound)) return;
	try {
		foundry.audio.AudioHelper.play({ src: "sounds/notify.wav", volume: 0.6, autoplay: true, loop: false }, false);
	} catch (error) {
		console.debug("Som de conjuração indisponível", error);
	}
}

export async function resolveCast(actor, selection) {
	const item = actor.items.get(selection.itemId);
	if (!item || item.type !== "ritual") {
		ui.notifications.error("O ritual não está mais na ficha do Agente.");
		return;
	}
	// Ficha aberta cobre o mapa e a área do ritual: minimiza ao conjurar
	try {
		const sheet = actor.sheet;
		if (sheet?.rendered && !sheet.minimized) await sheet.minimize();
	} catch (error) {
		console.debug("Não consegui minimizar a ficha", error);
	}
	const withoutSanity = game.settings.get("ordem-v2-classic", "globalPlayingWithoutSanity");
	const resource = inspectRitualResource(actor, withoutSanity);
	if (!resource.ok) {
		ui.notifications.error("Esta macro cobra PD. Ative ‘Jogando sem Sanidade’ e tente novamente.");
		return;
	}
	const castForm = selection.formId && selection.formId !== "basic" ? getRitualForms(item)[selection.formId] : null;
	const requirements = castRequirements(actor, item.system.element, castForm?.requiredAffinity);
	if (!requirements.affinity.ok) {
		ui.notifications.warn(`${actor.name} não tem afinidade com ${requirements.affinity.label}: a forma escolhida não pode ser conjurada.`);
		return;
	}
	if (requirements.components.state === "missing") ui.notifications.warn(`${requirements.components.note} Confirme com o Mestre antes de conjurar.`);
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
	let choiceId = selection.choiceId ?? null;
	const choices = areaChoicesFor(item);
	if (choices && !choiceId) {
		choiceId = await chooseAreaEffect(item, choices);
		if (!choiceId) {
			ui.notifications.info("Efeito não escolhido; o ritual não foi conjurado e nada foi gasto.");
			return;
		}
	}
	let rule = areaRuleFor(item, selection.formId, choiceId);
	const formBody = ritualFormBodyOf(item, selection.formId);
	const targetReq = ritualTargets(item, formBody);
	let rangeReq = ritualRange(item, formBody);
	// Catalisador ritualístico: confere as regras e muda DT, dano, alcance, área ou duração; só é gasto depois do pagamento.
	let catalystPlan = null;
	if (selection.catalystId) {
		catalystPlan = await planCatalyst(actor, item, selection, {
			hasDamage: Boolean(rule?.onCast?.damage?.length || selection.effect?.kind === "damage"), hasArea: Boolean(rule?.area), rangeKey: rangeReq.key,
		});
		if (!catalystPlan.ok) {
			ui.notifications.warn(`${catalystPlan.reason} Nada foi gasto.`);
			return;
		}
		if (catalystPlan.rangeKey) rangeReq = ritualRange({ system: { range: catalystPlan.rangeKey } });
		if (catalystPlan.areaFactor && rule?.area) rule = { ...rule, area: { ...rule.area, distance: rule.area.distance * catalystPlan.areaFactor } };
		if (catalystPlan.extraDie && !rule && selection.effect?.formula) selection = { ...selection, effect: { ...selection.effect, formula: addOneDie(selection.effect.formula) } };
	}
	// Alvos já marcados precisam cumprir o ritual (quantidade e alcance) antes de pagar qualquer coisa.
	if (!rule?.area && selection.targetIds.length && ["creature", "object"].includes(targetReq.kind)) {
		const check = checkRitualTargets(actor, item, selection.formId, selection.targetIds, catalystPlan?.rangeKey ?? null);
		if (!check.ok) {
			ui.notifications.warn(`${check.problems.join(" ")} Nada foi gasto.`);
			return;
		}
		selection = { ...selection, targetIds: check.valid };
	}
	let deferArea = false;
	if (areaTemplateData(item, rule)) {
		const pd = Number(actor.system.PD.value);
		const banner = `✦ ${item.name} · ${selection.cost} PD (PD ${pd} → ${pd - selection.cost}) · Clique no mapa para conjurar · Roda gira · Esc cancela`;
		const placed = await placeAreaTemplate(actor, item, rule, { range: rangeReq, banner });
		if (!placed) {
			if (selection.cancelIfNoArea) {
				// fluxo rápido (FC-42): Esc ou botão direito cancela sem gastar nada
				ui.notifications.info("Conjuração cancelada; nada foi gasto.");
				return;
			}
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
	if (catalystPlan?.consumes) await consumeCatalyst(actor, catalystPlan.itemId);
	playCastSound();
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
		linkId: selection.linkId ?? null,
		configureRoll: Boolean(selection.configureRoll),
		paranormalCost: Boolean(selection.paranormalCost),
		dtBonus: catalystPlan?.dtBonus ?? 0,
		extraDie: Boolean(catalystPlan?.extraDie),
		catalystNote: catalystPlan?.note ?? null,
		casterTokenId: actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id)?.id ?? null,
	};
	// Os testes do conjurador saem como rolagens normais de perícia, logo após o pagamento.
	const outcome = await runCasterTests(actor, item, cast);
	if (!outcome) {
		// O jogador desistiu da rolagem: o custo já foi pago, então a carta com botão fica como alternativa.
		await ChatMessage.create({
			content: buildChatCard(actor, item, cast, { pending: true, sanityNotes: [], resistances: [] }),
			speaker: ChatMessage.getSpeaker({ actor }),
			flags: { "ordem-v2-classic": { ritualCast: { ...cast, status: "pending" } } },
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
			flags: { "ordem-v2-classic": { ritualCast: { ...cast, status: "needsTargets", outcome: waiting } } },
		});
		return;
	}
	// Amaldiçoar Arma sem alvo marcado: a carta pergunta em quem fica a maldição (em você ou num alvo).
	// No fluxo rápido o alvo já foi escolhido no cartão (inclusive "você"), então vai direto.
	if (!outcome.interrupted && isWeaponCurseRitual(item) && !cast.targetIds.length && !selection.targetChosen) {
		const waiting = { ...outcome, awaitingCurse: true };
		await ChatMessage.create({
			content: buildChatCard(actor, item, cast, waiting),
			speaker: ChatMessage.getSpeaker({ actor }),
			flags: { "ordem-v2-classic": { ritualCast: { ...cast, status: "needsTargets", outcome: waiting } } },
		});
		return;
	}
	const needsGm = !outcome.interrupted && (rule || isWeaponCurseRitual(item) ? true : cast.targetIds.length && (item.system.skillResis || cast.effect));
	if (!needsGm && !outcome.interrupted) await createActiveMarker(actor, item, cast, outcome);
	const message = await ChatMessage.create({
		content: buildChatCard(actor, item, cast, { ...outcome, effectsPending: !!needsGm }),
		speaker: ChatMessage.getSpeaker({ actor }),
		flags: { "ordem-v2-classic": { ritualCast: { ...cast, status: needsGm ? "effects" : "resolved", outcome } } },
	});
	if (!needsGm) return playRitualAnimation(actor, item, cast, outcome);
	gmNotice(game.i18n.format("op.gmNotice.ritualPending", { actor: actor.name, ritual: item.name }), { kind: "ritual" });
	// Resistência e dano/cura dos alvos precisam de permissão do Mestre.
	if (game.user.isGM) await resolvePendingCast(message);
	else game.socket.emit("system.ordem-v2-classic", { type: "ritualCastTest", messageId: message.id, userId: game.user.id });
}

/** Desconta o PD extra (falha no Custo do Paranormal ou Invocando o Medo), no máximo o que o agente tem. */
async function chargeExtraCost(actor, outcome, amount, kind) {
	const applied = await applySanityCostToPd(actor, amount);
	outcome.sanityPd = applied;
	outcome.extra = { amount, applied: true, appliedAmount: applied, kind };
	if (applied < amount) outcome.sanityNotes.push(`Faltaram ${amount - applied} PD para cobrir toda a perda; o mestre resolve o restante.`);
}

/** Testes do conjurador (Vontade de concentração e Ocultismo de custo). Devolve null se a rolagem foi cancelada. */
async function runCasterTests(actor, item, cast) {
	const outcome = { interrupted: false, sanityPd: 0, sanityNotes: [], resistances: [] };
	const rollOptions = { configure: Boolean(cast.configureRoll) };
	const concentrationDt = getConcentrationDt(cast);
	if (concentrationDt !== null) {
		const result = await rollUntilDone(actor, "will", concentrationDt, rollOptions);
		if (!result) return null;
		outcome.concentration = { dt: concentrationDt, total: result.total, success: result.status === "success", breakdown: result.breakdown, text: `${result.total} — ${result.status === "success" ? "sucesso" : "falha"}` };
		outcome.interrupted = result.status === "failure";
	}
	// o teste de Ocultismo (DT 20 + custo) é de todo ritual, menos Medo; só o PD extra da falha depende do Custo do Paranormal
	if (!outcome.interrupted && item.system.element !== "fear") {
		const dt = 20 + cast.cost;
		ui.notifications.info(`Custo do Paranormal: teste de Ocultismo contra DT ${dt} (20 + custo do círculo). Se falhar, você perde mais ${cast.cost} PD.`);
		const result = await rollUntilDone(actor, "occultism", dt, rollOptions);
		if (!result) return null;
		outcome.occultism = { dt, total: result.total, success: result.status === "success", breakdown: result.breakdown, text: `${result.total} — ${result.status === "success" ? "sucesso" : "falha"}` };
		if (result.status === "failure") {
			// Custo do Paranormal ligado no cartão: a falha custa +custo PD, descontado na hora (sem botão)
			if (cast.paranormalCost) await chargeExtraCost(actor, outcome, cast.cost, "occultism");
		}
	} else if (!outcome.interrupted && item.system.element === "fear" && cast.paranormalCost) {
		// Medo não tem teste de Ocultismo; a perda que o livro cobra em Sanidade vira PD e é o Custo do Paranormal (ligado no cartão)
		await chargeExtraCost(actor, outcome, cast.cost, "fear");
	}
	return outcome;
}

/** Rola a perícia; se o jogador fechar a janela, pergunta se quer rolar de novo. Devolve null se desistir. */
async function rollUntilDone(actor, skill, dt, options = {}) {
	for (;;) {
		const result = rollOutcome(await rollSkill(actor, skill, dt, options), dt);
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
		const animationName = ritualAnimationName(item);
		const animated = animationName === item.name ? item : item.clone({ name: animationName });
		if (sourceToken) Hooks.callAll("aa.workflow", sourceToken, animated, { targets });
	} catch (animationError) {
		console.warn("Animação do ritual indisponível:", animationError);
	}
}

/* -------------------------------------------- */
/*  Rituais ativos (sustentados e buffs)        */
/* -------------------------------------------- */

/** Ritual sustentado: um efeito marcador no conjurador, para a lista "Rituais ativos" e o botão Encerrar (FC-63). */
async function createActiveMarker(actor, item, cast, outcome) {
	if (outcome.active || outcome.interrupted) return null;
	const profile = classifyRitual(item, { formId: cast.formId, choiceId: cast.choiceId });
	if (!profile.modifiers.includes(MODIFIER.SUSTAINED)) return null;
	const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
		name: `${item.name} (sustentado)`,
		img: item.img && item.img !== "icons/svg/mystery-man.svg" ? item.img : "icons/svg/aura.svg",
		origin: item.uuid,
		description: `<p>Ritual sustentado: segue ativo até ser encerrado. ${escapeHtml(localizeChoice("dropdownExecution", item.system.execution))} para manter, conforme o texto do ritual.</p>`,
		flags: { [SYSTEM_ID]: { ritualActive: { itemId: item.id, itemName: item.name, casterId: actor.id, formId: cast.formId, templateId: cast.templateId ?? null, sustained: true } } },
	}]);
	outcome.active = effect ? { effectUuid: effect.uuid, ended: false } : null;
	return effect;
}

/** Rituais ativos de um Agente: sustentados pendentes de encerrar e buffs que ele conjurou (Arma Amaldiçoada). */
export function activeRitualsOf(actor) {
	if (!actor) return [];
	const list = [];
	const actors = new Map();
	for (const entry of game.actors ?? []) actors.set(entry.uuid, entry);
	for (const token of canvas?.tokens?.placeables ?? []) if (token.actor) actors.set(token.actor.uuid, token.actor);
	for (const holder of actors.values()) {
		for (const effect of holder.effects ?? []) {
			const marker = effect.flags?.[SYSTEM_ID]?.ritualActive;
			if (marker && marker.casterId === actor.id) {
				list.push({ uuid: effect.uuid, name: effect.name, img: effect.img, kind: "sustained", target: holder.id === actor.id ? "" : holder.name, duration: "Sustentado" });
				continue;
			}
			const curse = effect.flags?.[SYSTEM_ID]?.weaponCurse;
			if (curse && typeof effect.origin === "string" && effect.origin.startsWith(`${actor.uuid}.`)) {
				list.push({ uuid: effect.uuid, name: effect.name, img: effect.img, kind: "buff", target: holder.id === actor.id ? "" : holder.name, duration: "Até o fim da cena" });
			}
		}
	}
	return list;
}

/** Encerra um ritual ativo (marcador de sustentado ou buff). Quem pode: conjurador (dono) e Mestre. */
export async function endRitualEffect(effectUuid, { byUser = game.user } = {}) {
	const effect = await fromUuid(effectUuid);
	if (!effect) return { ok: false, reason: "O efeito não existe mais." };
	const marker = effect.flags?.[SYSTEM_ID]?.ritualActive;
	const caster = marker ? game.actors.get(marker.casterId) : (typeof effect.origin === "string" ? await fromUuid(effect.origin.replace(/\.Item\..*$/, "")) : null);
	const isCaster = Boolean(caster?.testUserPermission?.(byUser, "OWNER"));
	if (!canEndRitual({ isGM: byUser.isGM, isCaster, effectActive: true })) return { ok: false, reason: "Só o conjurador ou o Mestre encerra este ritual." };
	const name = effect.name;
	const templateId = marker?.templateId ?? null;
	await effect.delete();
	if (templateId) {
		const region = canvas.scene?.regions.get(templateId);
		if (region) {
			const { removeZone } = await import("./ritual-area-engine.mjs");
			await removeZone(region);
		}
	}
	// a carta que criou o marcador passa a mostrar que o ritual terminou
	for (const message of game.messages.contents.slice(-80)) {
		const cast = message.getFlag(SYSTEM_ID, "ritualCast");
		if (cast?.outcome?.active?.effectUuid === effectUuid && !cast.outcome.active.ended) {
			const actor = game.actors.get(cast.actorId);
			const item = actor?.items.get(cast.itemId);
			const outcome = { ...cast.outcome, active: { ...cast.outcome.active, ended: true } };
			if (actor && item) await message.update({ content: buildChatCard(actor, item, cast, outcome), [`flags.${SYSTEM_ID}.ritualCast.outcome`]: outcome });
		}
	}
	await gmNotice(`${name} foi encerrado${caster ? ` (${caster.name})` : ""}.`);
	return { ok: true };
}

/* -------------------------------------------- */
/*  Ações depois de conjurar                    */
/* -------------------------------------------- */

function castOfMessage(messageId) {
	const message = game.messages.get(messageId);
	const cast = message?.getFlag(SYSTEM_ID, "ritualCast");
	const actor = cast ? game.actors.get(cast.actorId) : null;
	const item = actor?.items.get(cast?.itemId);
	return { message, cast, actor, item };
}

const isOwnerOf = (actor, user) => Boolean(actor?.testUserPermission?.(user, "OWNER"));

/** O Mestre desfaz o dano e as condições de um ritual em alvo escolhido (Decadência, Eletrocussão...): devolve os PV e apaga os efeitos. */
export async function undoHostileCast(messageId, { byUser = game.user } = {}) {
	const { message, cast, actor, item } = castOfMessage(messageId);
	if (!message || !actor || !item) return { ok: false, reason: "Não encontrei o ritual desta carta." };
	if (!byUser.isGM) return { ok: false, reason: "Só o Mestre desfaz o efeito de um ritual." };
	const rows = cast.outcome?.undoRows ?? [];
	if (!rows.length || cast.outcome.undone) return { ok: false, reason: "Não há nada para desfazer." };
	const restored = [];
	for (const row of rows) {
		const result = await undoAreaRow(row);
		if (result.ok) restored.push(`${row.name}${result.restored ? ` (+${result.restored} PV)` : ""}`);
	}
	const outcome = { ...cast.outcome, undone: true };
	await message.update({ content: buildChatCard(actor, item, cast, outcome), [`flags.${SYSTEM_ID}.ritualCast.outcome`]: outcome });
	const creatures = outcome.creatureMessageId ? game.messages.get(outcome.creatureMessageId) : null;
	if (creatures) await creatures.update({ content: creatures.content.replace(/<p class="rc2-c-undo">[\s\S]*?<\/p>/, '<p class="rc2-c-undo"><em>Efeito desfeito.</em></p>') });
	await gmNotice(`Desfeito: ${item.name} (${restored.join(", ") || "nada a restaurar"}).`);
	return { ok: true, restored };
}

/** O buff do ritual já foi usado de forma relevante (a arma amaldiçoada causou dano)? */
async function swapUsed(created) {
	for (const entry of created ?? []) {
		const effect = await fromUuid(`${entry.actorUuid}.ActiveEffect.${entry.effectId}`).catch(() => null);
		if (effect?.getFlag(SYSTEM_ID, "used")) return true;
	}
	return false;
}

/** Estado do botão "Trocar alvo" de uma carta (FC-93): efeito ainda existe e se já foi usado. */
export async function swapState(messageId, { user = game.user } = {}) {
	const { cast, actor, item } = castOfMessage(messageId);
	const swap = cast?.outcome?.swap;
	if (!swap?.created?.length || swap.closed || !item) return { available: false, effectActive: false, used: false };
	let effectActive = false;
	for (const entry of swap.created) {
		if (await fromUuid(`${entry.actorUuid}.ActiveEffect.${entry.effectId}`).catch(() => null)) effectActive = true;
	}
	const used = await swapUsed(swap.created);
	const profile = classifyRitual(item, { formId: cast.formId, choiceId: cast.choiceId }).profile;
	return { available: canSwapTarget({ profile, effectActive, used, isGM: user.isGM, isCaster: isOwnerOf(actor, user) }), effectActive, used };
}

/**
 * Passa o buff para outro alvo, sem cobrar PD nem rolar de novo (FC-90 a FC-93). Roda no cliente do Mestre
 * (o jogador pede por socket), porque quem conjura não é dono do novo alvo.
 * @param {string} messageId
 * @param {{tokenId?:string|null, byUser?:User}} options   tokenId do novo alvo; sem ele, o próprio conjurador
 */
export async function swapRitualTarget(messageId, { tokenId = null, byUser = game.user } = {}) {
	const { message, cast, actor, item } = castOfMessage(messageId);
	if (!message || !actor || !item) return { ok: false, reason: "Não encontrei o ritual desta carta." };
	const state = await swapState(messageId, { user: byUser });
	if (!state.available) return { ok: false, reason: state.used ? "O efeito já foi usado; só o Mestre troca o alvo." : "Este ritual não pode mais trocar de alvo." };
	const newToken = tokenId ? canvas.tokens.get(tokenId) : null;
	if (tokenId && !newToken?.actor) return { ok: false, reason: "O novo alvo não está na cena." };
	if (newToken && !byUser.isGM) {
		const check = checkRitualTargets(actor, item, cast.formId, [newToken.id]);
		if (!check.ok) return { ok: false, reason: check.problems.join(" ") };
	}
	const swap = cast.outcome.swap;
	// apaga o efeito do alvo anterior e aplica no novo
	for (const entry of swap.created) {
		const effect = await fromUuid(`${entry.actorUuid}.ActiveEffect.${entry.effectId}`).catch(() => null);
		if (effect) await effect.delete();
	}
	const recipient = newToken?.actor ?? actor;
	const previous = swap.created.map((entry) => entry.actorName).join(", ");
	const lines = await applyWeaponCurse({ caster: actor, item, formId: cast.formId, targets: newToken ? [recipient] : [], linkId: swap.created[0]?.linkId ?? null, silent: true });
	const outcome = {
		...cast.outcome,
		swap: { created: lines.created ?? [], closed: false },
		swapLog: [...(cast.outcome.swapLog ?? []), `Alvo trocado de ${previous} para ${recipient.name} (por ${byUser.name}).`],
	};
	const nextCast = { ...cast, targetIds: newToken ? [newToken.id] : [] };
	await message.update({ content: buildChatCard(actor, item, nextCast, outcome), [`flags.${SYSTEM_ID}.ritualCast`]: { ...nextCast, outcome } });
	return { ok: true, from: previous, to: recipient.name };
}

/** Resolve a carta: se vier dos testes já rolados (stage "effects"), só aplica resistência e efeitos; senão rola tudo. */
async function resolvePendingCast(message) {
	const cast = message?.getFlag("ordem-v2-classic", "ritualCast");
	if (!cast || !["pending", "effects", "needsDamage"].includes(cast.status)) return;
	const actor = game.actors.get(cast.actorId);
	const item = actor?.items.get(cast.itemId);
	if (!actor || !item) return ui.notifications.error("Não encontrei o Agente ou ritual desta mensagem.");
	if (!game.user.isGM && !actor.isOwner) return ui.notifications.warn("Somente o Agente ou o Mestre pode rolar este ritual.");
	const previousStatus = cast.status;
	await message.setFlag("ordem-v2-classic", "ritualCast", { ...cast, status: "rolling" });
	const selection = cast;
	try {
		let outcome = cast.outcome;
		if (previousStatus === "pending") {
			outcome = await runCasterTests(actor, item, selection);
			if (!outcome) {
				await message.setFlag("ordem-v2-classic", "ritualCast", { ...cast, status: "pending" });
				return ui.notifications.info("O teste foi cancelado; a carta continua disponível para tentar novamente.");
			}
		}
		outcome.resistances = [];
		let creatureRows = [];
		// Rituais mapeados em ritual-area-rules.mjs: o motor de área cuida de resistência, dano e condições.
		const rule = areaRuleFor(item, selection.formId, selection.choiceId);
		// Ritual com dano ou cura: a carta espera o botão "Rolar dano" (a rolagem acontece na própria mensagem do ritual).
		const gate = damageGate({ ruleDamage: Boolean(rule?.onCast?.damage?.length), effect: rule ? null : selection.effect });
		if (gate && !outcome.interrupted && !selection.damageRequested) {
			outcome.awaitingDamage = gate;
			delete outcome.effectsPending;
			await message.update({ content: buildChatCard(actor, item, selection, outcome) });
			await message.setFlag("ordem-v2-classic", "ritualCast", { ...cast, status: "needsDamage", outcome });
			return;
		}
		// dano já rolado na carta: o motor e o efeito simples usam esses valores, sem rolar de novo
		const damageRolls = outcome.damageRoll?.parts?.map((part) => ({ type: part.type, formula: part.formula, amount: Math.max(0, Math.floor(Number(part.total))) })) ?? null;
		if (rule && !outcome.interrupted) {
			const lines = await resolveAreaCast(selection, rule, { damageRolls });
			// Ritual que age nos alvos marcados e nenhum foi marcado: a carta ganha botões para escolher a área / rolar o dano.
			if (previousStatus === "effects" && rule.onCast && !selection.templateId && lines.affected === 0) {
				outcome.awaitingTargets = true;
				outcome.areaLines = [];
				await message.update({ content: buildChatCard(actor, item, selection, outcome) });
				await message.setFlag("ordem-v2-classic", "ritualCast", { ...cast, status: "needsTargets", outcome });
				return;
			}
			delete outcome.awaitingTargets;
			outcome.areaLines = lines;
			if (!lines.manual) creatureRows = creatureRowsFromEngine(lines.damageRows);
			if (lines.manual) {
				outcome.areaManual = true;
				outcome.panelMessageId = lines.panelMessageId ?? null;
			}
			if (lines.applied?.length) outcome.undoRows = lines.applied;
		}
		const genericSaves = new Map();
		if (!rule && !outcome.interrupted && selection.targetIds.length && item.system.skillResis) {
			const skill = ritualResistanceTarget(item);
			const dt = Number(actor.system.ritual?.DT) + (Number(selection.dtBonus) || 0);
			if (!skill || !Number.isFinite(dt)) {
				ui.notifications.warn("Perícia ou DT de resistência indisponível: resolva a resistência dos alvos manualmente.");
			} else {
				for (const id of selection.targetIds) {
					const token = canvas.tokens.get(id);
					if (!token?.actor) continue;
					// a resistência do alvo é rolada sozinha, sem diálogo (FC-32)
					const roll = await rollSkill(token.actor, skill, dt, { configure: false, whisper: token.actor.type === "threat", effectElement: item.system.element });
					const result = rollOutcome(roll, dt);
					if (result.status !== "cancelled") genericSaves.set(token.id, { skill, total: result.total, dt, passed: result.status === "success", breakdown: result.breakdown });
				}
			}
		}
		// Amaldiçoar Arma: cria o efeito "Arma Amaldiçoada" no alvo (ou no próprio conjurador, sem alvo).
		if (!outcome.interrupted && isWeaponCurseRitual(item)) {
			const targets = selection.targetIds.map((id) => canvas.tokens.get(id)?.actor).filter(Boolean);
			const lines = await applyWeaponCurse({ caster: actor, item, formId: selection.formId, targets, linkId: selection.linkId ?? null });
			outcome.effects = [...(outcome.effects ?? []), ...lines];
			outcome.swap = { created: lines.created ?? [], closed: false };
		}
		if (!rule && !outcome.interrupted && selection.effect) {
			for (const id of selection.targetIds) {
				const token = canvas.tokens.get(id);
				const target = token?.actor;
				if (!target) continue;
				const amount = damageRolls?.[0]?.amount ?? Math.max(0, Math.floor(Number((await new Roll(selection.effect.formula).evaluate()).total)));
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
					const hpResource = target.type === "threat" ? target.system.attributes?.hp : target.system.PV;
					const hpBefore = Number(hpResource?.value);
					const result = await target.applyDamage(amount);
					const dealt = Number.isFinite(hpBefore) && Number.isFinite(Number(result.newPV)) ? Math.max(0, hpBefore - Number(result.newPV)) : amount;
					creatureRows.push({
						name: token.name, img: token.document?.texture?.src ?? target.img, save: genericSaves.get(token.id) ?? null,
						parts: [{ type: "", full: amount, amount }], dealt, hpBefore: Number.isFinite(hpBefore) ? hpBefore : null, state: "applied",
						notes: result.newPV === null ? ["aplicação delegada ao Mestre"] : [],
					});
				}
			}
		}
		delete outcome.effectsPending;
		delete outcome.awaitingCurse;
		delete outcome.awaitingDamage;
		// as criaturas têm a própria mensagem, só do Mestre (resistência, dano final, PV e Desfazer)
		if (creatureRows.length) outcome.creatureMessageId = await postCreatureMessage(actor, item, message.id, creatureRows, { undo: Boolean(outcome.undoRows?.length) });
		await createActiveMarker(actor, item, selection, outcome);
		await message.update({ content: buildChatCard(actor, item, selection, outcome) });
		await message.setFlag("ordem-v2-classic", "ritualCast", { ...cast, status: "resolved", outcome });
		playRitualAnimation(actor, item, selection, outcome);
	} catch (error) {
		await message.setFlag("ordem-v2-classic", "ritualCast", { ...cast, status: previousStatus });
		ui.notifications.error(`Não foi possível resolver o ritual: ${error.message}`);
	}
}

/** Botão "Rolar dano" da carta de um ritual conjurado sem alvo: usa os alvos marcados agora e resolve. */
async function continueAreaCast(messageId, mode) {
	const message = game.messages.get(messageId);
	const cast = message?.getFlag("ordem-v2-classic", "ritualCast");
	if (!cast || cast.status !== "needsTargets") return ui.notifications.warn("Este ritual já foi resolvido.");
	const actor = game.actors.get(cast.actorId);
	const item = actor?.items.get(cast.itemId);
	if (!actor || !item) return ui.notifications.error("Não encontrei o Agente ou ritual desta mensagem.");
	if (!game.user.isGM && !actor.isOwner) return ui.notifications.warn("Somente o Agente ou o Mestre pode usar esta carta.");
	const rule = areaRuleFor(item, cast.formId, cast.choiceId);
	const update = { ...cast, status: "effects" };
	if (mode === "curseSelf") {
		// em você: sem alvos, o efeito vai para quem conjurou
		update.targetIds = [];
	} else if (mode === "place") {
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
	await message.setFlag("ordem-v2-classic", "ritualCast", update);
	if (game.user.isGM) await resolvePendingCast(message);
	else game.socket.emit("system.ordem-v2-classic", { type: "ritualCastTest", messageId, userId: game.user.id });
}

export const rollRitualAreaDamage = (messageId) => continueAreaCast(messageId, "roll");
export const placeRitualArea = (messageId) => continueAreaCast(messageId, "place");
export const applyRitualCurseSelf = (messageId) => continueAreaCast(messageId, "curseSelf");
export const applyRitualCurseTarget = (messageId) => continueAreaCast(messageId, "roll");

export async function resolvePendingRitualCast(messageId) {
	const message = game.messages.get(messageId);
	if (!message) return ui.notifications.warn("Não encontrei a mensagem do ritual no chat.");
	return resolvePendingCast(message);
}

export async function runRitualCasterMacro(preferredAgent = null, preferredItemId = null) {
	if (game.system.id !== "ordem-v2-classic") {
		ui.notifications.error("Esta macro foi criada para o sistema Ordem Paranormal v2 Classic.");
		return;
	}
	const preferredIsUsable = preferredAgent?.type === "agent" && (game.user.isGM || preferredAgent.isOwner);
	const agent = preferredIsUsable ? preferredAgent : await chooseAgent(macroCandidates());
	if (!agent) return;
	const withoutSanity = game.settings.get("ordem-v2-classic", "globalPlayingWithoutSanity");
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
	// Cancelar devolve o id do botão ("cancel"), não null: só um objeto de seleção segue adiante
	if (!selection || typeof selection !== "object") return;
	if (selection.invalid) {
		ui.notifications.warn(selection.invalid);
		return;
	}
	await resolveCast(agent, selection);
}

/**
 * Círculo, custo e efeito automático de um ritual numa forma (Básico, Discente, Verdadeiro), sem depender da janela.
 * Usado pelo cartão de conjuração rápida (ritual-cast-card.mjs).
 */
export function buildRitualSelection(item, formId = "basic", actor = null) {
	const options = getRitualForms(item);
	const chosen = options[formId];
	if (!chosen) return { ok: false, reason: "Esta versão do ritual não está disponível." };
	const circle = Math.max(Number(item.system.circle), Number(chosen.requiredCircle) || Number(item.system.circle));
	if (!Number.isInteger(circle) || circle < Number(item.system.circle) || circle > 4) return { ok: false, reason: "Escolha um círculo válido para este ritual.", circle };
	if (actor && formId !== "basic") {
		const affinity = castRequirements(actor, item.system.element, chosen.requiredAffinity).affinity;
		if (!affinity.ok) return { ok: false, reason: `Exige afinidade com ${affinity.label}.`, circle };
	}
	const cost = ritualFinalCost(circle, formId, chosen);
	if (!Number.isInteger(cost)) return { ok: false, reason: "O custo desta forma depende do texto do ritual; use a janela do grimório.", circle };
	const effectText = formId === "basic"
		? String(item.system.description ?? "").split(/\b(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/i)[0]
		: chosen.body;
	// Amaldiçoar Arma não causa dano ao alvo: o +Nd6 vai para a arma (ver weapon-curse-runtime.mjs).
	const effect = isWeaponCurseRitual(item) ? null : ritualEffectFromText(effectText);
	return { ok: true, formId, circle, cost, effect, chosen, requiresAffinity: Boolean(formId === "true" && chosen.requiredAffinity) };
}

export const ritualCasterMacroImage = MACRO_IMG;

/* -------------------------------------------- */
/*  Pedidos do jogador ao Mestre                */
/* -------------------------------------------- */

/** Executa uma ação da carta (custo extra, trocar alvo, encerrar) em nome de `byUser`. Roda no cliente do Mestre. */
export async function runRitualPostAction(action, payload = {}, byUser = game.user) {
	switch (action) {
		case "swap": return swapRitualTarget(payload.messageId, { tokenId: payload.tokenId ?? null, byUser });
		case "end": return endRitualEffect(payload.effectUuid, { byUser });
		case "undo": return undoHostileCast(payload.messageId, { byUser });
		default: return { ok: false, reason: "Ação desconhecida." };
	}
}

/** O Mestre executa na hora; o jogador pede por socket (o Mestre responde com `ritualPostResult`). */
export async function requestRitualAction(action, payload = {}) {
	if (game.user.isGM) {
		const result = await runRitualPostAction(action, payload, game.user);
		if (!result?.ok && result?.reason) ui.notifications.warn(result.reason);
		return result;
	}
	game.socket.emit("system.ordem-v2-classic", { type: "ritualPostAction", action, payload, userId: game.user.id });
	return { ok: true, requested: true };
}

/** Escolhe o novo alvo do buff (aliado da cena, "em mim" ou o token marcado) e pede a troca. */
export async function promptSwapTarget(messageId) {
	const { actor, item } = castOfMessage(messageId);
	if (!actor || !item) return ui.notifications.warn("Não encontrei o ritual desta carta.");
	const state = await swapState(messageId);
	if (!state.available) {
		ui.notifications.warn(state.used && !game.user.isGM ? "O efeito já foi usado; só o Mestre troca o alvo." : "Este ritual não pode mais trocar de alvo.");
		return null;
	}
	const own = actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id);
	const marked = [...(game.user.targets ?? [])][0] ?? null;
	const people = (canvas.tokens?.placeables ?? []).filter((token) => token.actor?.type === "agent" && token.id !== own?.id);
	const options = [`<option value="">Em mim (${escapeHtml(actor.name)})</option>`, ...people.map((token) => `<option value="${escapeHtml(token.id)}" ${marked?.id === token.id ? "selected" : ""}>${escapeHtml(token.name)}</option>`)].join("");
	const answer = await foundry.applications.api.DialogV2.input({
		window: { title: "Trocar alvo" },
		content: `<div class="standard-form"><p>Quem recebe o efeito de <strong>${escapeHtml(item.name)}</strong>? Não custa PD e não rola de novo.</p><div class="form-group"><label>Novo alvo</label><select name="tokenId">${options}</select></div></div>`,
		ok: { label: "Trocar" },
		rejectClose: false,
	}).catch(() => null);
	if (!answer) return null;
	return requestRitualAction("swap", { messageId, tokenId: answer.tokenId || null });
}

/** Esconde da carta do chat os botões que o usuário não pode usar e abre os detalhes para o Mestre. */
export function registerRitualChatHooks() {
	// IM-03: um texto sobe do token quando um ritual põe um efeito nele (buff ou sustentado)
	Hooks.on("createActiveEffect", (effect) => {
		const flags = effect.flags?.[SYSTEM_ID];
		if (!flags?.weaponCurse && !flags?.ritualActive) return;
		const token = effect.parent?.getActiveTokens?.()?.[0];
		if (!token || !canvas?.interface?.createScrollingText) return;
		try {
			canvas.interface.createScrollingText(token.center, `✦ ${effect.name}`, { anchor: CONST.TEXT_ANCHOR_POINTS.TOP, fill: "#f4b942", stroke: "#000000", strokeThickness: 4, jitter: 0.25 });
		} catch (error) {
			console.debug("Texto flutuante do ritual indisponível", error);
		}
	});
	Hooks.on("renderChatMessageHTML", (_message, html) => {
		const root = html?.querySelector ? html : html?.[0];
		if (!root?.querySelectorAll) return;
		for (const button of root.querySelectorAll("[data-owner-actor]")) {
			const actor = game.actors.get(button.dataset.ownerActor);
			if (!game.user.isGM && !actor?.isOwner) button.closest("p")?.remove() ?? button.remove();
		}
		if (!game.user.isGM) root.querySelectorAll(".ritual-gm-only").forEach((node) => node.remove());
		else root.querySelectorAll(".ritual-card-details").forEach((node) => { node.open = true; });
	});
}
