/**
 * Itens paranormais em jogo: usar o item (custo, teste do alvo, condição, cartão) e catalisadores do conjurador.
 * Regras puras em paranormal-item-rules.mjs; especificação em docs/spec-itens-paranormais.md.
 */
import {
	catalystCheck, catalystEffect, catalystLabel, catalystOf, elementName, empowerDamageParts, itemUseDt, paranormalItemInfo, usableCatalysts, useCostPd,
	PARANORMAL_ELEMENTS,
} from "./paranormal-item-rules.mjs";
import { CONDITIONS, conditionEffectData } from "./conditions.mjs";
import { gmNotice } from "./gm-notice.mjs";

const SYSTEM = "ordem_v2_classic";
const esc = (text) => foundry.utils.escapeHTML(String(text ?? ""));
const isEquipped = (item) => item?.system?.using?.state !== false;
const resourceOf = (actor) => (actor.usingWithoutSanityRule ? "PD" : "PE");
const ACTIONS = { standard: "ação padrão", complete: "ação completa", move: "ação de movimento", free: "ação livre" };
const RANGES = { short: "curto", medium: "médio", long: "longo", extreme: "extremo" };
const SKILLS = { will: "Vontade", reflexes: "Reflexos", resilience: "Fortitude" };
const ATTRIBUTES = { AGI: "Agilidade", INT: "Intelecto", PRE: "Presença", FOR: "Força", VIG: "Vigor" };

const attributesOf = (actor) => Object.fromEntries(["AGI", "INT", "PRE", "FOR", "VIG"].map((key) => [key, Number(actor.system.attributes?.[key.toLowerCase()]?.value) || 0]));

/* -------------------------------------------- */
/*  Usar o item                                 */
/* -------------------------------------------- */

/** O item tem alguma forma de uso ("Usar" na ficha e na barra)? */
export const itemUses = (item) => (item?.type === "generalEquipment" ? paranormalItemInfo(item.name)?.uses ?? [] : []);

async function spend(actor, cost, label) {
	if (!cost) return true;
	const key = resourceOf(actor);
	const current = Number(actor.system[key]?.value) || 0;
	if (current < cost) {
		ui.notifications.warn(`${actor.name} tem ${current} ${key}; ${label} custa ${cost}.`);
		return false;
	}
	await actor.update({ [`system.${key}.value`]: current - cost });
	return true;
}

async function chooseUse(item, uses) {
	if (uses.length === 1) return uses[0];
	const options = uses.map((entry) => `<option value="${entry.id}">${esc(entry.label)} (${esc(ACTIONS[entry.action] ?? "")}${entry.cost ? `, ${useCostPd(entry)} PE` : ""})</option>`).join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: item.name },
		content: `<div class="standard-form"><div class="form-group"><label>Forma de uso</label><select name="use">${options}</select></div></div>`,
		ok: { label: "Usar" },
		rejectClose: false,
	}).catch(() => null);
	return uses.find((entry) => entry.id === result?.use) ?? null;
}

async function chooseElement(item) {
	const options = Object.entries(PARANORMAL_ELEMENTS).map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: item.name },
		content: `<div class="standard-form"><div class="form-group"><label>Elemento</label><select name="element">${options}</select></div></div>`,
		ok: { label: "Continuar" },
		rejectClose: false,
	}).catch(() => null);
	return result?.element ?? null;
}

/** Teste de resistência do alvo (rolado sozinho, sem janela), com a carta normal da perícia. */
async function rollTargetSave(token, usage, dt) {
	const target = token.actor;
	const rolls = await target.rollSkill({ skill: usage.save.skill, rolls: [{ options: { target: dt } }] }, { configure: false }, { create: false });
	const roll = Array.isArray(rolls) ? rolls[0] : rolls;
	if (!roll || !Number.isFinite(Number(roll.total))) return null;
	await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target, token: token.document }) }, target.type === "threat" ? { rollMode: CONST.DICE_ROLL_MODES.PRIVATE } : {});
	return { total: Number(roll.total), passed: Number(roll.total) >= dt };
}

async function applyUseCondition(target, usage, source) {
	const id = usage.condition;
	if (!CONDITIONS[id]) return `Aplique "${usage.condition}" em ${target.name} à mão.`;
	const lasting = id === "paralyzed" ? 1 : null;
	const data = conditionEffectData(id, { rounds: lasting, origin: source.uuid, startRound: game.combat?.round ?? null });
	if (target.isOwner) {
		await target.createEmbeddedDocuments("ActiveEffect", [data]);
		return `${target.name} ficou ${CONDITIONS[id].name.toLowerCase()}${lasting ? " até o início do próximo turno" : " até o fim da cena"}.`;
	}
	await gmNotice(`${source.name}: aplique "${CONDITIONS[id].name}" em ${target.name}${lasting ? " até o início do próximo turno" : " até o fim da cena"}.`);
	return `${target.name} deve ficar ${CONDITIONS[id].name.toLowerCase()}; o Mestre foi avisado.`;
}

async function consumeOne(item) {
	const quantity = Number(item.system.quantity) || 0;
	if (quantity <= 1) return item.delete();
	return item.update({ "system.quantity": quantity - 1 });
}

/** Escuta: o +5 em Ocultismo fica na ficha como efeito até o jogador identificar a criatura (e apagar o efeito). */
async function grantListeningBonus(actor, usage, source) {
	const key = "system.skills.occultism.mod";
	const existing = actor.effects.find((fx) => fx.getFlag(SYSTEM, "paranormalItemBonus") === usage.bonus.label);
	if (existing) return existing;
	const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [{
		name: `${usage.bonus.label}: +${usage.bonus.value} em Ocultismo (identificar criatura)`, img: "icons/svg/sound.svg", origin: source.uuid, type: "base",
		description: "Vale só para identificar a criatura gravada; apague o efeito depois do teste.",
		system: { changes: [{ key, type: "add", value: usage.bonus.value, phase: "initial", priority: null }] },
		flags: { [SYSTEM]: { paranormalItemBonus: usage.bonus.label } },
	}]);
	return created;
}

/**
 * Usa uma forma do item: confere o equipamento, cobra PE (PD sem Sanidade), faz o teste dos alvos marcados,
 * aplica a condição a quem falha e posta o cartão.
 */
export async function useParanormalItem(item, useId = null) {
	const actor = item.parent;
	const uses = itemUses(item);
	if (!actor || !uses.length) { ui.notifications.warn("Coloque o item numa ficha para usá-lo."); return null; }
	if (!isEquipped(item)) { ui.notifications.warn(`${item.name} não está equipado.`); return null; }
	const info = paranormalItemInfo(item.name);
	const usage = (useId ? uses.find((entry) => entry.id === useId) : null) ?? await chooseUse(item, uses);
	if (!usage) return null;
	if (usage.consumesItem && !((Number(item.system.quantity) || 0) > 0)) { ui.notifications.warn(`${item.name} acabou.`); return null; }
	let element = info.element;
	if (usage.chooseElement && !element) {
		element = await chooseElement(item);
		if (!element) return null;
	}
	if (!(await spend(actor, useCostPd(usage), usage.label))) return null;

	const dt = itemUseDt(usage, attributesOf(actor));
	const lines = [];
	const targets = usage.save ? [...(game.user.targets ?? [])].filter((token) => token.actor) : [];
	for (const token of targets) {
		const result = await rollTargetSave(token, usage, dt);
		if (!result) continue;
		lines.push(`${token.name}: ${SKILLS[usage.save.skill]} ${result.total} vs DT ${dt} — ${result.passed ? "resiste" : "falha"}.`);
		if (!result.passed && usage.condition) lines.push(await applyUseCondition(token.actor, usage, item));
	}
	if (usage.bonus) {
		await grantListeningBonus(actor, usage, item);
		lines.push(`+${usage.bonus.value} em Ocultismo (identificar a criatura): efeito na ficha; apague-o depois do teste.`);
	}
	if (usage.consumesItem) await consumeOne(item);

	const cost = usage.cost ? ` · ${useCostPd(usage)} ${resourceOf(actor)}${usage.perRound ? " por rodada" : ""}` : "";
	const where = usage.range ? ` · alcance ${RANGES[usage.range] ?? usage.range}` : "";
	const area = usage.area ? ` · área ${esc(usage.area)}` : "";
	const dtLine = usage.save && dt !== null
		? `<p><strong>${esc(SKILLS[usage.save.skill])}</strong> do alvo contra <strong>DT ${dt}</strong> (10 + ${esc(ATTRIBUTES[usage.save.dtAttribute])})${targets.length ? "" : "; marque os alvos antes de usar para o sistema rolar"}.</p>`
		: "";
	const upkeep = usage.upkeep ? `<p>Manter custa ${usage.upkeep.value} PE por rodada.</p>` : usage.perRound ? "<p>Cobra o custo a cada rodada em que continuar ativo; use de novo para pagar a rodada seguinte.</p>" : "";
	const elementLine = element ? ` <small>(${esc(elementName(element))})</small>` : "";
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="op-paranormal-item-card"><h3>${esc(item.name)}${elementLine}</h3><p><em>${esc(usage.label)} · ${esc(ACTIONS[usage.action] ?? "")}${cost}${where}${area}</em></p><p>${esc(usage.note ?? "")}</p>${dtLine}${upkeep}${lines.length ? `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}${usage.consumesItem ? "<p><em>O item foi consumido.</em></p>" : ""}</div>`,
		flags: { [SYSTEM]: { paranormalItemUse: { itemId: item.id, use: usage.id } } },
	});
	return usage;
}

/** Dados da seção "Usos" da ficha do item. */
export function paranormalItemView(item) {
	const info = paranormalItemInfo(item?.name);
	if (!info || item.type !== "generalEquipment") return null;
	return {
		kindLabel: { tool: "Ferramenta paranormal", component: "Componente ritualístico", catalyst: "Catalisador ritualístico" }[info.kind],
		element: elementName(info.element),
		automation: { auto: "automático", semi: "semi-automático", manual: "manual" }[info.automation],
		reason: info.reason,
		uses: info.uses.map((entry) => ({
			id: entry.id, label: entry.label, action: ACTIONS[entry.action] ?? "",
			cost: entry.cost ? `${useCostPd(entry)} PE${entry.perRound ? " por rodada" : ""}` : "sem custo", note: entry.note ?? "",
		})),
		consumable: info.consumable,
	};
}

/* -------------------------------------------- */
/*  Catalisadores no conjurador                 */
/* -------------------------------------------- */

/** Catalisadores que o agente pode usar num ritual do elemento (empunhados, com unidade). */
export const catalystOptions = (actor, ritualElement) => usableCatalysts(actor.items, ritualElement).map((c) => ({ id: c.id, kind: c.kind, label: catalystLabel(c) }));

const confirm = (title, content) => foundry.applications.api.DialogV2.confirm({ window: { title }, content: `<p>${esc(content)}</p>`, rejectClose: false, modal: true }).catch(() => false);

async function chooseAmplifier() {
	const choice = await foundry.applications.api.DialogV2.wait({
		window: { title: "Ampliador" },
		content: "<p>Aumentar o alcance em um passo ou dobrar a área?</p>",
		buttons: [
			{ action: "range", label: "Alcance +1 passo", default: true },
			{ action: "area", label: "Área ×2" },
		],
		rejectClose: false,
	}).catch(() => null);
	return choice === "area" ? "area" : choice === "range" ? "range" : null;
}

/**
 * Prepara o catalisador de um ritual: confere as regras, pergunta o que for preciso e devolve o que mudar na conjuração.
 * Sem efeito no ritual: o jogador confirma e o catalisador não é consumido.
 * @returns {Promise<{ok:boolean, reason?:string, catalyst?:object, itemId?:string, note?:string, dtBonus?:number, rangeKey?:string, areaFactor?:number, extraDie?:boolean, durationFactor?:number, consumes:boolean}>}
 */
export async function planCatalyst(actor, ritual, selection, { hasDamage = false, hasArea = false, rangeKey = "short" } = {}) {
	const catalystItem = actor.items.get(selection.catalystId);
	const catalyst = catalystOf(catalystItem);
	const check = catalystCheck({
		catalyst, ritualElement: ritual.system.element, equipped: isEquipped(catalystItem), quantity: Number(catalystItem?.system?.quantity) || 0,
	});
	if (!check.ok) return { ok: false, reason: check.reason, consumes: false };
	const context = { duration: ritual.system.duration, range: rangeKey, hasDamage, hasArea };
	if (catalyst.kind === "amplifier") {
		const choice = await chooseAmplifier();
		if (!choice) return { ok: false, reason: "Catalisador não escolhido.", consumes: false };
		context.ampliador = choice;
	}
	const effect = catalystEffect(catalyst.kind, context);
	if (!effect.applies) {
		const go = await confirm(catalystLabel(catalyst), `${effect.note} O catalisador não teria efeito neste ritual. Conjurar sem gastá-lo?`);
		return go ? { ok: true, consumes: false, note: `${catalystLabel(catalyst)}: sem efeito (${effect.note}); não foi consumido.` } : { ok: false, reason: "Conjuração cancelada.", consumes: false };
	}
	return { ok: true, consumes: true, catalyst, itemId: catalystItem.id, ...effect, note: `${catalystLabel(catalyst)}: ${effect.note} (consumido).` };
}

/** Gasta uma unidade do catalisador depois que o ritual foi pago. */
export async function consumeCatalyst(actor, itemId) {
	const item = actor.items.get(itemId);
	if (item) await consumeOne(item);
}

export { empowerDamageParts };
