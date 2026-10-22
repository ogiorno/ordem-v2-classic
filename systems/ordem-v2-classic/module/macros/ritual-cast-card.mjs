// Cartão de conjuração rápida: clique no ritual da ficha → (variante) → alvo ou área → Conjurar.
// Spec: docs/arquivo/spec-fluxo-conjuracao-rapida.md. Lógica pura em ritual-profiles.mjs e ritual-flow-logic.mjs.
// O pagamento, os testes e a resolução continuam em ritual-caster.mjs (resolveCast).

import {
	buildRitualSelection, checkRitualTargets, distanceToCaster, elementInfo, escapeHtml, getRitualForms, localizeChoice, resolveCast,
	ritualFormBodyOf, ritualImage, runRitualCasterMacro,
} from "./ritual-caster.mjs";
import { inspectRitualResource, ritualDescriptionText } from "./ritual-caster-logic.mjs";
import { areaChoicesFor } from "./ritual-area-rules.mjs";
import { MODIFIER, PROFILE, PROFILE_LABELS, classifyRitual } from "./ritual-profiles.mjs";
import { BUTTON_STATE, castButtonState, defaultTarget, needsSpendConfirm } from "./ritual-flow-logic.mjs";
import { ritualTargets } from "./ritual-targeting.mjs";
import { hasConditionProp } from "../helpers/conditions.mjs";
import { isWeaponCurseRitual } from "../helpers/weapon-curse.mjs";
import { curseLinkOptions } from "../helpers/weapon-curse-runtime.mjs";
import { FLOW_SETTING, flowSetting } from "../helpers/ritual-flow-settings.mjs";
import { catalystOptions } from "../helpers/paranormal-items.mjs";

const SYSTEM = "ordem-v2-classic";

/* -------------------------------------------- */
/*  Mapa                                        */
/* -------------------------------------------- */

const casterTokenOf = (actor) => actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene?.id) ?? null;
const markedIds = () => [...(game.user.targets ?? [])].map((token) => token.id);
const hpOfToken = (token) => Number(token.actor?.type === "threat" ? token.actor.system.attributes?.hp?.value : token.actor?.system?.PV?.value);

/** Tokens que o cartão oferece como alvo: aliados (agentes, menos o próprio conjurador) ou inimigos (ameaças em pé). */
export function candidateTokens(actor, intent) {
	const own = casterTokenOf(actor)?.id;
	return (canvas?.tokens?.placeables ?? []).filter((token) => {
		if (!token.actor || token.id === own) return false;
		if (intent === "enemy") return token.actor.type === "threat" && hpOfToken(token) > 0;
		return token.actor.type === "agent";
	});
}

/** Mira de um clique no mapa: devolve o token clicado ou null (Esc). */
function pickTokenOnMap(label) {
	return new Promise((resolve) => {
		const canvasEl = canvas.app.canvas ?? canvas.app.view;
		const banner = document.createElement("div");
		banner.className = "ritual-area-banner";
		banner.setAttribute("role", "status");
		banner.textContent = `${label} · clique no token · Esc cancela`;
		document.body.appendChild(banner);
		const previous = canvasEl.style.cursor;
		canvasEl.style.cursor = "crosshair";
		canvas.tokens.activate();
		const finish = (token) => {
			canvasEl.removeEventListener("pointerdown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
			canvasEl.style.cursor = previous;
			banner.remove();
			resolve(token);
		};
		const onDown = (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
			const token = canvas.tokens.placeables.find((entry) => entry.actor && entry.visible !== false && entry.bounds.contains(point.x, point.y));
			if (token) finish(token);
			else ui.notifications.info("Nenhum token nesse ponto.");
		};
		const onKey = (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			finish(null);
		};
		canvasEl.addEventListener("pointerdown", onDown, true);
		document.addEventListener("keydown", onKey, true);
	});
}

/* -------------------------------------------- */
/*  Estado e visão do cartão                    */
/* -------------------------------------------- */

/** Última forma e variante usadas por este agente neste ritual (UI-07); só neste navegador. */
const memoryKey = (actor, item) => `ordem-v2-classic.ritualFlow.${actor.id}.${item.id}`;

function readMemory(actor, item) {
	try {
		const saved = JSON.parse(localStorage.getItem(memoryKey(actor, item)) ?? "null") ?? {};
		const formId = saved.formId && buildRitualSelection(item, saved.formId, actor).ok ? saved.formId : "basic";
		const choiceId = saved.choiceId && areaChoicesFor(item)?.[saved.choiceId] ? saved.choiceId : null;
		return { formId, choiceId };
	} catch {
		return { formId: "basic", choiceId: null };
	}
}

function writeMemory(actor, item, state) {
	try {
		localStorage.setItem(memoryKey(actor, item), JSON.stringify({ formId: state.formId, choiceId: state.choiceId }));
	} catch { /* sem armazenamento: ignora */ }
}

function initialState(actor, item, advanced) {
	const remembered = readMemory(actor, item);
	const cls = classifyRitual(item, { formId: remembered.formId, choiceId: remembered.choiceId, formBody: ritualFormBodyOf(item, remembered.formId) });
	const target = defaultTarget({ profile: cls.profile, markedIds: markedIds(), maxTargets: cls.maxTargets });
	return {
		formId: remembered.formId, choiceId: remembered.choiceId,
		mode: target.mode, ids: target.ids, byDefault: target.byDefault, explicitSelf: false,
		linkId: null, concentration: "none", damageDt: null, fearConfirmed: false, configureRoll: false, paranormalCost: false, catalystId: "",
			};
}

/** Tudo o que o cartão mostra, calculado do estado atual. */
export function cardView(actor, item, state) {
	const formBody = ritualFormBodyOf(item, state.formId);
	const cls = classifyRitual(item, { formId: state.formId, choiceId: state.choiceId, formBody });
	const sel = buildRitualSelection(item, state.formId, actor);
	const pd = Number(actor.system.PD.value);
	const choices = areaChoicesFor(item);
	let problems = [];
	const targets = ritualTargets(item, formBody);
	if (state.mode === "marked" && state.ids.length && [PROFILE.ALLY, PROFILE.HOSTILE].includes(cls.profile) && ["creature", "object"].includes(targets.kind)) {
		const check = checkRitualTargets(actor, item, state.formId, state.ids);
		if (!check.ok) problems = check.problems;
	}
	// arma de quem recebe a maldição (Amaldiçoar Arma)
	let weapons = [];
	if (isWeaponCurseRitual(item)) {
		const recipient = state.mode === "marked" ? canvas.tokens.get(state.ids[0])?.actor : actor;
		weapons = recipient ? curseLinkOptions(recipient) : [];
	}
	const linkId = weapons.some((entry) => entry.id === state.linkId) ? state.linkId : (weapons[0]?.id ?? null);
	const button = castButtonState({
		profile: cls.profile, cost: sel.ok ? sel.cost : null, pd, silenced: hasConditionProp(actor, "noRituals"),
		variantRequired: Boolean(choices), variantChosen: Boolean(state.choiceId),
		target: { mode: state.mode, ids: state.ids }, targetProblems: problems,
		fearRequired: cls.modifiers.includes(MODIFIER.FEAR), fearConfirmed: state.fearConfirmed,
		validCost: sel.ok,
	});
	return { cls, sel, pd, choices, problems, weapons, linkId, button, formBody, targets };
}

/* -------------------------------------------- */
/*  HTML                                        */
/* -------------------------------------------- */

const chipImage = (token) => escapeHtml(token.document?.texture?.src ?? token.actor?.img ?? "");

const ELEMENT_ICONS = { blood: "droplet", death: "skull", energy: "bolt", knowledge: "graduation-cap", fear: "ghost" };

/** Cabeçalho de painel (ícone, título em caixa alta e legenda). */
const panelHead = (icon, title, hint) => `<div class="rc-panel-head"><i class="fa-solid fa-${icon}" aria-hidden="true"></i><div><span class="rc-panel-title">${title}</span><small>${hint}</small></div></div>`;

/** Classe do agente (ou "Recruta"/"Agente" quando não há) para a legenda das linhas de alvo. */
function agentRole(actor) {
	const cls = actor?.items?.find((entry) => entry.type === "class")?.name;
	if (cls) return cls;
	return Number(actor?.system?.NEX?.value) <= 5 ? "Recruta" : "Agente";
}

function targetRow({ img, name, sub, state }) {
	return `<div class="rc-person" data-state="${state ?? ""}">
		<img src="${img}" alt="" width="32" height="32"><span class="rc-person-text"><strong>${name}</strong><small>${sub}</small></span></div>`;
}

function targetBlock(actor, item, state, view) {
	const { cls } = view;
	if (cls.profile === PROFILE.PERSONAL) return "";
	if (cls.profile === PROFILE.ARE) {
		return `<div class="rc-block rc-area"><span class="rc-label">Área</span><p>${cls.centered ? "A área nasce em você; não precisa clicar no mapa." : "Depois de Conjurar, clique no mapa para colocar a área. Esc cancela e nada é gasto."}</p></div>`;
	}
	if (cls.profile === PROFILE.MANUAL) {
		return `<div class="rc-block rc-manual"><span class="rc-label">Resolução</span><p><strong>Este ritual é resolvido pelo Mestre.</strong> O PD e o teste são cobrados; o efeito não é automático.</p></div>`;
	}
	const hostile = cls.profile === PROFILE.HOSTILE;
	const rowState = view.problems.length ? "bad" : "ok";
	let rows = "";
	if (state.mode === "marked" && state.ids.length) {
		rows = state.ids.map((id) => {
			const token = canvas.tokens.get(id);
			if (!token) return targetRow({ img: "", name: "Alvo removido", sub: "", state: "bad" });
			const meters = distanceToCaster(actor, id);
			const where = meters === null ? "" : ` · ${Math.round(meters * 10) / 10} m`;
			const role = hostile ? `PV ${hpOfToken(token) || 0}` : agentRole(token.actor);
			return targetRow({ img: chipImage(token), name: escapeHtml(token.name), sub: `${escapeHtml(role)}${where}`, state: rowState });
		}).join("");
	} else if (state.mode === "self") {
		rows = targetRow({ img: escapeHtml(actor.img ?? ""), name: `Você (${escapeHtml(actor.name)} — ${escapeHtml(agentRole(actor))})`, sub: state.byDefault ? "Padrão" : "Conjurador", state: state.byDefault ? "default" : "ok" });
	} else rows = '<small class="rc-hint" data-state="empty">Nenhum alvo escolhido</small>';
	const range = view.targets
		? `<small class="rc-hint" data-state="${view.problems.length ? "bad" : "ok"}">${view.problems.length ? `✘ ${escapeHtml(view.problems.join(" "))}` : state.mode === "marked" && state.ids.length ? "✔ dentro do alcance" : ""}</small>`
		: "";
	const resist = hostile && view.cls.resisted
		? `<p class="rc-resist"><span class="rc-label">Resistência</span> ${escapeHtml(localizeChoice("dropdownSkillResis", item.system.skillResis, item.system.skillResis))} · ${escapeHtml(localizeChoice("dropdownResistance", item.system.resistance, item.system.resistance))} · DT de ritual ${Number(actor.system.ritual?.DT) || "—"}</p>`
		: "";
	return `<section class="rc-panel rc-target">${panelHead("users", hostile ? "Alvo" : "Alvo (quem recebe)", hostile ? "Escolha o inimigo que sofre o ritual." : "Escolha quem será o alvo do ritual.")}
		<div class="rc-people">${rows}</div>
		${range}${resist}
		<div class="rc-actions"><button type="button" data-act="map"><i class="fa-solid fa-crosshairs"></i> Escolher no mapa</button>${hostile ? "" : '<button type="button" data-act="self"><i class="fa-solid fa-user"></i> Em mim</button>'}</div>
	</section>`;
}

function weaponBlock(state, view) {
	if (view.weapons.length < 2) return "";
	const options = view.weapons.map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === view.linkId ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("");
	return `<div class="rc-block"><label class="rc-label" for="rc-link">Arma</label><select id="rc-link" name="link">${options}</select></div>`;
}

function variantBlock(state, view) {
	if (!view.choices) return "";
	const rows = Object.entries(view.choices).map(([id, entry], index) => `<label class="rc-variant"><input type="radio" name="variant" value="${escapeHtml(id)}" ${state.choiceId === id ? "checked" : ""}><span><kbd>${index + 1}</kbd> ${escapeHtml(entry.label)}</span></label>`).join("");
	return `<fieldset class="rc-block rc-variants"><legend class="rc-label">Variante</legend>${rows}</fieldset>`;
}

function adjustBlock(state, item, actor) {
	const fear = item.system.element === "fear";
	const hint = fear ? "Ritual de Medo: você perde +custo PD, descontado na hora." : "Se você falhar no teste de Ocultismo, perde +custo PD, descontado na hora.";
	const paranormal = `<label class="rc-paranormal${state.paranormalCost ? " is-on" : ""}"><input type="checkbox" name="paranormalCost" ${state.paranormalCost ? "checked" : ""}><i class="fa-solid fa-dice-d20" aria-hidden="true"></i><span><strong>Custo do Paranormal</strong><small>${hint}</small></span></label>`;
	const option = (value, label) => `<option value="${value}" ${state.concentration === value ? "selected" : ""}>${label}</option>`;
	const catalysts = actor ? catalystOptions(actor, item.system.element) : [];
	const catalyst = catalysts.length
		? `<div class="rc-conc"><label class="rc-label" for="rc-catalyst">Catalisador</label><select id="rc-catalyst" name="catalystId"><option value="">Nenhum</option>${catalysts.map((c) => `<option value="${escapeHtml(c.id)}" ${state.catalystId === c.id ? "selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}</select></div>`
		: "";
	return `<section class="rc-panel rc-adjust">${panelHead("gear", "Ajustes", "Configure opções do ritual.")}
		${paranormal}
		${catalyst}
		<div class="rc-conc"><label class="rc-label" for="rc-conc">Concentração</label>
			<select id="rc-conc" name="concentration">${option("none", "Nenhuma")}${option("bad", "Condição ruim (Vontade DT 15 + custo)")}${option("terrible", "Condição terrível (Vontade DT 20 + custo)")}${option("damage", "Sofreu dano (DT = dano)")}</select>
			${state.concentration === "damage" ? `<input type="number" name="damageDt" min="1" value="${state.damageDt ?? ""}" placeholder="DT" aria-label="DT da concentração por dano">` : ""}</div>
		<label class="rc-check rc-roll"><input type="checkbox" name="configureRoll" ${state.configureRoll ? "checked" : ""}><span><strong>Configurar a rolagem do Ocultismo</strong><small>Abre a janela de rolagem com forma, concentração e outros detalhes.</small></span></label>
	</section>`;
}

/** Custo, saldo de PD e teste: vai no rodapé do diálogo, entre Cancelar e Conjurar. */
function costSummary(view, state) {
	const { cls, sel } = view;
	const cost = sel.ok ? sel.cost : null;
	const occultism = cls.modifiers.includes(MODIFIER.FEAR)
		? (cost === null ? "" : `Ritual de Medo: sem teste de Ocultismo${state.paranormalCost ? `; perde +${cost} PD na hora` : ""}.`)
		: cost === null ? "" : `Ocultismo vs DT ${20 + cost}${state.paranormalCost ? ` · Falha: perde +${cost} PD` : ""}`;
	return `<i class="fa-solid fa-wallet rc-cost-icon" aria-hidden="true"></i>
		<div class="rc-cost-text"><span class="rc-label">Custo do ritual</span>
			<p class="rc-cost-line"><strong>${cost === null ? "—" : `${cost} PD`}</strong>${cost === null ? "" : `<span class="rc-pd">Reserva ${view.pd} → ${view.pd - cost}</span>`}</p>
			<p class="rc-test">${escapeHtml(occultism)}</p></div>`;
}

function renderBody(actor, item, state, view) {
	const info = elementInfo(item);
	const { cls } = view;
	const execution = localizeChoice("dropdownExecution", item.system.execution);
	const range = localizeChoice("dropdownRange", item.system.range);
	const badges = cls.modifiers.map((modifier) => ({ RAP: "rápido", SUS: "sustentado", MED: "Medo", ADV: "formas", VAR: "variante" }[modifier])).filter(Boolean);
	const fact = (icon, text) => `<span class="rc-fact"><i class="fa-solid fa-${icon}" aria-hidden="true"></i>${escapeHtml(text)}</span>`;
	const fear = cls.modifiers.includes(MODIFIER.FEAR)
		? `<label class="rc-block rc-check rc-fear"><input type="checkbox" name="fear" ${state.fearConfirmed ? "checked" : ""}> Personagem Marcado (obrigatório para rituais de Medo)</label>`
		: "";
	return `<header class="rc-head" style="--ritual-accent:${info.color}">
			${ritualImage(item, info, 88)}
			<div class="rc-head-text"><h3>${escapeHtml(item.name)}</h3>
				<div class="rc-facts">${fact("book-open", `${Number(item.system.circle)}º círculo`)}${fact(ELEMENT_ICONS[item.system.element] ?? "star", info.label)}${fact("sun", execution)}${fact("hand", range)}</div>
				<div class="rc-facts rc-profile">${fact("diagram-project", `${PROFILE_LABELS[cls.profile] ?? ""}${badges.length ? ` · ${badges.join(" · ")}` : ""}`)}</div></div>
		</header>
		<div class="rc-cols">
			<div class="rc-main">
				${variantBlock(state, view)}${targetBlock(actor, item, state, view)}${weaponBlock(state, view)}${fear}
				${adjustBlock(state, item, actor)}
			</div>
			${loreBlock(item, state, actor)}
		</div>`;
}

/** Coluna da direita: o texto base do ritual e as formas (Básico, Discente, Verdadeiro) como opções; a escolhida fica destacada. */
function loreBlock(item, state, actor) {
	const forms = getRitualForms(item);
	const rows = [["basic", "Básico"], ["student", "Discente"], ["true", "Verdadeiro"]].filter(([id]) => id === "basic" || forms[id]).map(([id, label]) => {
		const option = buildRitualSelection(item, id, actor);
		const meta = option.ok ? `${option.circle}º círculo · ${option.cost} PD` : option.reason?.startsWith("Exige afinidade") ? option.reason.replace(/\.$/, "") : "indisponível";
		return `<label class="rc-form rc-lore-form ${state.formId === id ? "is-selected" : ""} ${option.ok ? "" : "is-disabled"}"><input type="radio" name="form" value="${id}" ${state.formId === id ? "checked" : ""} ${option.ok ? "" : "disabled"}>
			<span class="rc-form-text"><h4>${label} <small>${meta}</small></h4></span></label>`;
	}).join("");
	const base = escapeHtml(ritualDescriptionText(item.system.description).split(/(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/i)[0].replace(/(?:\s*[-–—•])+\s*$/, "").trim());
	return `<aside class="rc-panel rc-lore" aria-label="Descrição do ritual">${panelHead("book-open", "O que faz", "Resumo do efeito do ritual.")}
		<div class="rc-lore-text rc-lore-summary">${base ? `<p>${base}</p>` : "<p><em>Sem descrição.</em></p>"}</div>
		<hr>
		${panelHead("layer-group", "Forma do ritual", "Escolha a forma, que define o custo e o efeito.")}
		<div class="rc-forms" role="radiogroup" aria-label="Forma do ritual">${rows}</div>
	</aside>`;
}

/* -------------------------------------------- */
/*  Diálogo                                     */
/* -------------------------------------------- */

function selectionFrom(actor, item, state, view) {
	const { sel, cls } = view;
	const marked = state.mode === "marked" && [PROFILE.ALLY, PROFILE.HOSTILE, PROFILE.MANUAL].includes(cls.profile);
	return {
		itemId: item.id, formId: state.formId, circle: sel.circle, cost: sel.cost, effect: sel.effect,
		preparationConfirmed: true, markedConfirmed: true,
		targetIds: marked ? state.ids : [],
		concentration: state.concentration, damageDt: Number(state.damageDt) || null, paranormalCost: Boolean(state.paranormalCost),
		choiceId: state.choiceId, linkId: view.linkId, configureRoll: state.configureRoll, catalystId: state.catalystId || null,
		targetChosen: true, cancelIfNoArea: true, profile: cls.profile,
	};
}

function openCard(actor, item, advanced) {
	const state = initialState(actor, item, advanced);
	let view = cardView(actor, item, state);
	let rootNode = null;
	let dialogNode = null;
	let costNode = null;
	let dialogApp = null;
	const refresh = () => {
		if (!rootNode) return;
		view = cardView(actor, item, state);
		const scroll = rootNode.scrollTop;
		rootNode.innerHTML = renderBody(actor, item, state, view);
		rootNode.scrollTop = scroll;
		if (costNode) costNode.innerHTML = costSummary(view, state);
		const conjure = dialogNode?.querySelector('[data-action="conjure"]');
		if (conjure) {
			conjure.disabled = !view.button.enabled;
			conjure.dataset.state = view.button.state;
			conjure.title = view.button.reason;
			conjure.innerHTML = `<i class="fa-solid fa-wand-sparkles"></i> ${escapeHtml(view.button.label)}`;
		}
	};
	// alvos marcados no mapa (tecla T) mudam o cartão enquanto ele está aberto
	const syncTargets = () => {
		if (!rootNode) return;
		// o perfil pode mudar com a forma ou a variante escolhida (Esfolar Discente vira área): usa o perfil atual
		const cls = classifyRitual(item, { formId: state.formId, choiceId: state.choiceId, formBody: ritualFormBodyOf(item, state.formId) });
		const fresh = defaultTarget({ profile: cls.profile, markedIds: markedIds(), maxTargets: cls.maxTargets });
		if (state.explicitSelf && fresh.mode === "self") return;
		state.mode = fresh.mode;
		state.ids = fresh.ids;
		state.byDefault = fresh.byDefault;
		refresh();
	};
	const hookId = Hooks.on("targetToken", (user) => { if (user?.id === game.user.id) syncTargets(); });

	const setTokenTarget = (token) => {
		state.explicitSelf = false;
		// marcar no Foundry dispara o hook, que atualiza o cartão; força o refresh caso o hook não dispare
		token.setTarget(true, { releaseOthers: true, groupSelection: true });
		const fresh = defaultTarget({ profile: view.cls.profile, markedIds: [token.id], maxTargets: view.cls.maxTargets });
		state.mode = fresh.mode; state.ids = fresh.ids; state.byDefault = false;
		refresh();
	};

	const onClick = async (event) => {
		const node = event.target.closest("[data-act]");
		if (!node) return;
		event.preventDefault();
		if (node.dataset.act === "pick-token") {
			const token = canvas.tokens.get(node.dataset.tokenId);
			if (token) setTokenTarget(token);
		} else if (node.dataset.act === "self") {
			game.user.targets.forEach((token) => token.setTarget(false, { releaseOthers: false }));
			state.explicitSelf = true;
			state.mode = "self"; state.ids = []; state.byDefault = false;
			refresh();
		} else if (node.dataset.act === "map") {
			// ficha e cartão saem da frente do mapa enquanto o alvo é escolhido
			const covering = [actor.sheet, dialogApp].filter((app) => app?.rendered && !app.minimized);
			await Promise.all(covering.map((app) => app.minimize()));
			let token = null;
			try {
				token = await pickTokenOnMap(view.cls.profile === PROFILE.HOSTILE ? "Alvo" : "Quem recebe");
			} finally {
				await Promise.all(covering.map((app) => app.rendered && app.maximize()));
			}
			if (token) setTokenTarget(token);
		}
	};
	const onChange = (event) => {
		const field = event.target;
		if (field.name === "variant") state.choiceId = field.value;
		else if (field.name === "form") { state.formId = field.value; state.explicitSelf = false; syncTargets(); return; }
		else if (field.name === "concentration") state.concentration = field.value;
		else if (field.name === "damageDt") state.damageDt = field.value;
		else if (field.name === "link") state.linkId = field.value;
		else if (field.name === "fear") state.fearConfirmed = field.checked;
		else if (field.name === "catalystId") state.catalystId = field.value;
		else if (field.name === "configureRoll") state.configureRoll = field.checked;
			else if (field.name === "paranormalCost") state.paranormalCost = field.checked;
		else return;
		refresh();
	};
	const onKey = (event) => {
		if (event.target.matches?.("input[type=number], select, textarea")) return;
		const choices = view.choices ? Object.keys(view.choices) : [];
		const index = Number(event.key) - 1;
		if (choices[index]) { state.choiceId = choices[index]; refresh(); }
	};

	const promise = foundry.applications.api.DialogV2.wait({
		window: { title: `Conjurar · ${item.name}`, icon: "fa-solid fa-wand-sparkles", minimizable: true },
		classes: ["ritual-cast-dialog"],
		position: { width: 920 },
		content: `<div class="ritual-cast-card-root" data-ritual-id="${escapeHtml(item.id)}">${renderBody(actor, item, state, view)}</div>`,
		buttons: [
			{ action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark", callback: () => null },
			{
				action: "conjure", label: view.button.label, icon: "fa-solid fa-wand-sparkles", default: true, disabled: !view.button.enabled,
				callback: () => {
					view = cardView(actor, item, state);
					if (view.button.enabled) writeMemory(actor, item, state);
					return view.button.enabled ? selectionFrom(actor, item, state, view) : { invalid: view.button.reason };
				},
			},
		],
		render: (_event, dialog) => {
			dialogApp = dialog;
			dialogNode = dialog.element;
			rootNode = dialogNode.querySelector(".ritual-cast-card-root");
			costNode = document.createElement("div");
			costNode.className = "rc-footer-cost";
			dialogNode.querySelector('[data-action="conjure"]')?.before(costNode);
			rootNode.addEventListener("click", onClick);
			rootNode.addEventListener("change", onChange);
			dialogNode.addEventListener("keydown", onKey);
			refresh();
			(dialogNode.querySelector('[data-action="conjure"]:not([disabled])') ?? dialogNode.querySelector("input, select, button[data-act]"))?.focus();
		},
		rejectClose: false,
	});
	return promise.finally(() => Hooks.off("targetToken", hookId));
}

/* -------------------------------------------- */
/*  Entrada                                     */
/* -------------------------------------------- */

/**
 * O clique no ritual vai direto, sem cartão? (pessoal, reação/livre, área sem escolha). Medo, variante e Shift pedem o cartão.
 * @returns {{quick:boolean, confirm:boolean, cost:number|null, cls:object}}
 */
export function quickPlan(actor, item, { advanced = false } = {}) {
	const cls = classifyRitual(item, { formId: "basic" });
	const sel = buildRitualSelection(item, "basic");
	const blocked = advanced || !sel.ok || cls.modifiers.includes(MODIFIER.VARIANT) || cls.modifiers.includes(MODIFIER.FEAR);
	const centeredArea = cls.profile === PROFILE.AREA && cls.centered;
	const quick = !blocked && (cls.profile === PROFILE.PERSONAL || cls.modifiers.includes(MODIFIER.QUICK) || cls.profile === PROFILE.AREA);
	const confirm = quick && Boolean(flowSetting(FLOW_SETTING.confirmSpend))
		&& needsSpendConfirm({ profile: centeredArea ? PROFILE.PERSONAL : cls.profile, modifiers: cls.modifiers, cost: sel.cost });
	return { quick, confirm, cost: sel.ok ? sel.cost : null, cls, sel };
}

/**
 * Conjura um ritual da ficha com o fluxo rápido.
 * @param {Actor} actor
 * @param {Item} item
 * @param {object} [options]
 * @param {boolean} [options.advanced]    Shift: sempre abre o cartão, mesmo nos rituais de clique direto
 * @param {boolean} [options.skipConfirm] a confirmação de gasto já foi feita (botão armado na ficha)
 */
export async function castRitualFast(actor, item, { advanced = false, skipConfirm = false } = {}) {
	if (game.system.id !== SYSTEM) return ui.notifications.error("Esta macro foi criada para o sistema Ordem Paranormal v2 Classic.");
	if (!item || item.type !== "ritual" || actor?.type !== "agent") return ui.notifications.warn("Escolha um ritual de um Agente.");
	if (!(game.user.isGM || actor.isOwner)) return ui.notifications.warn("Você não controla este Agente.");
	const withoutSanity = game.settings.get(SYSTEM, "globalPlayingWithoutSanity");
	if (!withoutSanity || !inspectRitualResource(actor, withoutSanity).ok) return ui.notifications.error("A macro usa PD. Ative a regra global ‘Jogando sem Sanidade’ para conjurar.");
	if (hasConditionProp(actor, "noRituals")) return ui.notifications.warn(`${actor.name} está Silenciado e não pode conjurar rituais.`);

	// a ficha aberta cobre o mapa: fecha ao conjurar
	if (actor.sheet?.rendered) await actor.sheet.close();

	const plan = quickPlan(actor, item, { advanced });
	if (!plan.sel.ok) {
		// custo que depende do texto do ritual: o grimório pede o valor
		ui.notifications.info(plan.sel.reason);
		return runRitualCasterMacro(actor, item.id);
	}
	if (plan.quick) {
		if (plan.confirm && !skipConfirm) {
			const ok = await foundry.applications.api.DialogV2.confirm({
				window: { title: item.name },
				content: `<p>Gastar <strong>${plan.cost} PD</strong> e conjurar <strong>${escapeHtml(item.name)}</strong>?</p>`,
				yes: { label: `Conjurar (${plan.cost} PD)`, icon: "fa-solid fa-wand-sparkles" },
				no: { label: "Cancelar" },
				rejectClose: false,
			});
			if (!ok) return null;
		}
		return resolveCast(actor, {
			itemId: item.id, formId: "basic", circle: plan.sel.circle, cost: plan.sel.cost, effect: plan.sel.effect,
			preparationConfirmed: true, markedConfirmed: true, targetIds: [], concentration: "none", damageDt: null,
			targetChosen: true, cancelIfNoArea: true, profile: plan.cls.profile,
		});
	}
	const selection = await openCard(actor, item, advanced);
	// Cancelar devolve o id do botão ("cancel") em vez de null: só um objeto de seleção segue adiante
	if (!selection || typeof selection !== "object") return null;
	if (selection.invalid) return ui.notifications.warn(selection.invalid);
	return resolveCast(actor, selection);
}

export { BUTTON_STATE };
