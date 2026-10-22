/**
 * Maldições de itens — parte que fala com o Foundry (regras puras em curse-rules.mjs).
 * Especificação: docs/spec-modificacoes-paranormais.md.
 *
 * Uma maldição fica guardada em `system.curses` do item (arma, proteção ou acessório). Dali o sistema monta:
 *  - um Efeito Ativo `transfer` no item com os bônus de ficha (liga com o item equipado e desliga ao guardar);
 *  - uma opção da tela de ataque (Efeito Ativo "ao usar") para as maldições de arma que custam PE ou mexem no ataque;
 *  - dano extra do elemento em carta própria;
 *  - botões de uso na ficha do item.
 * A maldição avulsa do compêndio (item `curse`) escolhe o item que ela vai amaldiçoar e some da mochila (applyCurseDocument).
 */
import { changeData } from "./passive-effects-rules.mjs";
import {
	CURSES, CURSE_FLAG, CURSE_USE_FLAG, ELEMENTS, ITEM_KIND, KINDS, SYSTEM_ID, changesFor, countByElement, curseCategoryBonus, curseCost,
	curseCostLabels, cursesForKind, doubledMarginBonus, elementOf, elementsForAttribute, isOpposed, isUnlocked, protectionClass, resolveActive,
	sadicaBonus, validateAdd, ATTRIBUTE_NAMES, DAY,
} from "./curse-rules.mjs";
import { damageApplicationMode, requestCardDamage } from "./card-damage.mjs";
import { gmNotice } from "./gm-notice.mjs";
import { conditionEffectData } from "./conditions.mjs";

const esc = (t) => foundry.utils.escapeHTML(String(t ?? ""));
const PHYSICAL = ["armament", "protection", "generalEquipment"];
/** Ícone da maldição (assets/curse-icons, ver docs/spec-icones-maldicoes.md). */
const iconOf = (key) => `systems/${SYSTEM_ID}/assets/curse-icons/${key}.webp`;

export const isCursable = (item) => PHYSICAL.includes(item?.type);
export const entriesOf = (item) => Array.from(item?.system?.curses ?? []).map((c) => ({ key: c.key, chosen: c.chosen ?? "", since: c.since ?? null }));
const isEquipped = (item) => item?.system?.using?.state !== false;
const weaponRange = (item) => item?.system?.types?.rangeType?.name ?? null;

/* -------------------------------------------- */
/*  Efeitos montados a partir das regras         */
/* -------------------------------------------- */

const effectMatches = (effect, flag, key) => effect.getFlag(SYSTEM_ID, flag) === key;
const sameChanges = (effect, data) => JSON.stringify((effect.system?.changes ?? []).map((c) => [c.key, c.type, String(c.value)])) === JSON.stringify((data.system?.changes ?? []).map((c) => [c.key, c.type, String(c.value)]));

/** Efeito de ficha da maldição (transfer): bônus de atributo, Defesa, RD, perícias, PV/PE, DT. Null se a maldição não tem bônus de ficha. */
export function curseEffectData(item, entry, active) {
	const def = CURSES[entry.key];
	const changes = changesFor(entry, { protectionClass: item.type === "protection" ? protectionClass(item) : "light" });
	if (!def || !changes.length) return null;
	return {
		name: `Maldição: ${def.label}`,
		img: iconOf(entry.key),
		type: "base",
		transfer: true,
		disabled: !active,
		description: `${def.label} (${ELEMENTS[elementOf(entry)]?.label ?? ""}): ${changes.map((c) => c.label).join("; ")}`,
		system: { changes: changes.map(changeData) },
		flags: { [SYSTEM_ID]: { [CURSE_FLAG]: entry.key } },
	};
}

/** Opção "ao usar" da tela de ataque para as maldições de arma (custo, bônus no ataque, margem de ameaça, dado de dano). */
export function curseUseEffectData(item, entry) {
	const def = CURSES[entry.key];
	if (!def || item.type !== "armament" || !(def.attack || def.doubleCritMargin)) return null;
	const a = def.attack ?? {};
	const onUse = { enabled: true, applies: a.applies ?? "all" };
	if (a.cost) onUse.cost = a.cost;
	if (a.attackBonus) onUse.attackBonus = a.attackBonus;
	if (a.damageDice) onUse.damageDice = a.damageDice;
	if (def.doubleCritMargin) {
		onUse.auto = true;
		onUse.critMargin = doubledMarginBonus(item.system?.critical);
	}
	if (a.convertType) onUse.convertType = a.convertType;
	if (a.ignoreRd) onUse.ignoreRd = true;
	return {
		name: a.label ?? `Maldição: ${def.label}`,
		img: iconOf(entry.key),
		disabled: true,
		transfer: false,
		description: a.hint ?? def.text,
		flags: { [SYSTEM_ID]: { onUse, [CURSE_USE_FLAG]: entry.key } },
	};
}

const inFlight = new Map();
const serial = (key, fn) => {
	const run = (inFlight.get(key) ?? Promise.resolve()).catch(() => null).then(fn);
	inFlight.set(key, run);
	run.finally(() => { if (inFlight.get(key) === run) inFlight.delete(key); }).catch(() => null);
	return run;
};

/** Itens físicos do ator no formato que resolveActive espera. */
const snapshot = (actor) => actor.items.filter(isCursable).map((i) => ({ itemId: i.id, using: isEquipped(i), curses: entriesOf(i) }));

/** Deixa os efeitos do item iguais ao que as maldições dele pedem (cria, atualiza ou apaga). */
async function syncItemEffects(item, activeMap) {
	const entries = entriesOf(item);
	const wantFicha = new Map();
	const wantUse = new Map();
	for (const entry of entries) {
		const active = activeMap.get(`${item.id}:${entry.key}`) ?? false;
		const ficha = curseEffectData(item, entry, active);
		if (ficha) wantFicha.set(entry.key, ficha);
		const use = curseUseEffectData(item, entry);
		if (use) wantUse.set(entry.key, use);
	}
	const toDelete = [];
	const toCreate = [];
	const seen = new Set();
	for (const effect of item.effects) {
		const fichaKey = effect.getFlag(SYSTEM_ID, CURSE_FLAG);
		const useKey = effect.getFlag(SYSTEM_ID, CURSE_USE_FLAG);
		if (!fichaKey && !useKey) continue;
		const want = fichaKey ? wantFicha.get(fichaKey) : wantUse.get(useKey);
		const id = `${fichaKey ? "f" : "u"}:${fichaKey ?? useKey}`;
		if (!want || seen.has(id)) { toDelete.push(effect.id); continue; }
		seen.add(id);
		const stale = fichaKey
			? !sameChanges(effect, want) || effect.disabled !== want.disabled
			: JSON.stringify(effect.getFlag(SYSTEM_ID, "onUse")) !== JSON.stringify(want.flags[SYSTEM_ID].onUse) || effect.name !== want.name;
		if (stale) {
			const update = { _id: effect.id, name: want.name, disabled: want.disabled, description: want.description };
			if (fichaKey) update["system.changes"] = want.system.changes;
			else update[`flags.${SYSTEM_ID}.onUse`] = want.flags[SYSTEM_ID].onUse;
			await item.updateEmbeddedDocuments("ActiveEffect", [update], { diff: false, recursive: true });
		}
	}
	for (const [key, data] of wantFicha) if (!seen.has(`f:${key}`)) toCreate.push(data);
	for (const [key, data] of wantUse) if (!seen.has(`u:${key}`)) toCreate.push(data);
	if (toDelete.length) await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
	if (toCreate.length) await item.createEmbeddedDocuments("ActiveEffect", toCreate);
}

/** Marca (ou limpa) o início do uso das maldições com trava de tempo, conforme o item está equipado. */
async function syncSince(item) {
	const entries = entriesOf(item);
	const equipped = isEquipped(item);
	let changed = false;
	const next = entries.map((entry) => {
		if (!CURSES[entry.key]?.lock) return entry;
		if (equipped && entry.since === null) { changed = true; return { ...entry, since: game.time.worldTime || 1 }; }
		if (!equipped && entry.since !== null) { changed = true; return { ...entry, since: null }; }
		return entry;
	});
	if (changed) await item.update({ "system.curses": next });
	return changed;
}

/** Sincroniza todos os itens amaldiçoados do ator (maldições iguais não se acumulam entre itens). */
export function syncActorCurses(actor) {
	if (!actor || !actor.isOwner) return Promise.resolve();
	return serial(actor.uuid, async () => {
		for (const item of actor.items.filter(isCursable)) await syncSince(item);
		const active = resolveActive(snapshot(actor), game.time.worldTime);
		for (const item of actor.items.filter(isCursable)) await syncItemEffects(item, active);
	}).catch((err) => console.warn("Ordem Paranormal | maldições:", err));
}

/** Sincroniza um item (dentro de uma ficha, a ficha inteira; solto no mundo, só ele). */
export function syncItemCurses(item) {
	if (!isCursable(item)) return Promise.resolve();
	if (item.parent) return syncActorCurses(item.parent);
	if (!item.isOwner) return Promise.resolve();
	return serial(item.uuid, async () => {
		const active = resolveActive([{ itemId: item.id, using: isEquipped(item), curses: entriesOf(item) }], game.time.worldTime);
		await syncItemEffects(item, active);
	}).catch((err) => console.warn("Ordem Paranormal | maldições:", err));
}

/* -------------------------------------------- */
/*  Acrescentar e tirar maldições               */
/* -------------------------------------------- */

/** Pergunta a escolha da maldição (elemento ou ritual); devolve o texto escolhido, "" se não precisa, ou null se cancelou. */
async function promptChoice(item, def) {
	if (!def.choice) return "";
	const actor = item.parent;
	if (def.choice === "element") {
		const options = Object.entries(ELEMENTS).filter(([k]) => k !== "fear").map(([value, e]) => `<option value="${value}">${esc(e.label)}</option>`).join("");
		const hint = def.key === "antielemento" ? "Elemento das criaturas contra as quais a arma é letal (role 1d4 para sortear: 1 Conhecimento, 2 Energia, 3 Morte, 4 Sangue)." : "Elemento contra o qual o acessório dá resistência 10.";
		const result = await foundry.applications.api.DialogV2.input({
			window: { title: def.label },
			content: `<div class="standard-form"><p>${esc(hint)}</p><div class="form-group"><label>Elemento</label><select name="choice">${options}</select></div></div>`,
			ok: { label: "Confirmar" },
			rejectClose: false,
			position: { width: 440 },
		}).catch(() => null);
		return result?.choice ?? null;
	}
	const rituals = actor ? actor.items.filter((i) => i.type === "ritual").map((i) => i.name) : [];
	const list = rituals.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
	const hint = def.key === "conjuracao" ? "Ritual de 1º círculo guardado no acessório." : "Ritual de alvo ou de área guardado na arma (pague os PE como se o conjurasse).";
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: def.label },
		content: `<div class="standard-form"><p>${esc(hint)}</p>${list ? `<div class="form-group"><label>Ritual da ficha</label><select name="pick"><option value="">— outro —</option>${list}</select></div>` : ""}<div class="form-group"><label>Nome do ritual</label><input type="text" name="typed" placeholder="Ex.: Cicatrização"/></div></div>`,
		ok: { label: "Guardar" },
		rejectClose: false,
		position: { width: 440 },
	}).catch(() => null);
	if (!result) return null;
	return (result.pick || result.typed || "").trim();
}

/**
 * Acrescenta a maldição ao item. Devolve true se entrou.
 * Repetida ou de tipo errado bloqueia; elementos opressores só avisam (o Mestre decide).
 */
export async function addCurse(item, key, { chosen = null, silent = false } = {}) {
	if (!isCursable(item) || !item.isOwner) return false;
	const def = CURSES[key];
	const verdict = validateAdd(entriesOf(item), key, { itemType: item.type, weaponRange: weaponRange(item) });
	if (!verdict.ok) {
		if (!silent) ui.notifications.warn(verdict.error);
		return false;
	}
	let pick = chosen;
	if (pick === null) pick = await promptChoice(item, def);
	if (pick === null) return false;
	if (def.choice === "ritual" && !pick) { ui.notifications.warn(`${def.label}: informe o ritual guardado.`); return false; }
	const entry = { key, chosen: pick, since: null };
	await item.update({ "system.curses": [...entriesOf(item), entry] });
	for (const warning of verdict.warnings) ui.notifications.warn(warning, { permanent: false });
	await syncItemCurses(item);
	return true;
}

export async function removeCurse(item, key) {
	if (!item.isOwner) return;
	await item.update({ "system.curses": entriesOf(item).filter((c) => c.key !== key) });
	await syncItemCurses(item);
}

/** Itens da ficha que a maldição pode amaldiçoar (arma, proteção ou acessório conforme o tipo dela). */
export function eligibleItems(actor, key) {
	const def = CURSES[key];
	if (!def || !actor) return [];
	return actor.items.filter((i) => ITEM_KIND[i.type] === def.kind && validateAdd(entriesOf(i), key, { itemType: i.type, weaponRange: weaponRange(i) }).ok);
}

async function chooseTargetItem(actor, def) {
	const items = eligibleItems(actor, def.key);
	if (!items.length) {
		ui.notifications.warn(`${actor.name} não tem ${KINDS[def.kind] === "Arma" ? "arma" : KINDS[def.kind] === "Proteção" ? "proteção" : "acessório (equipamento geral)"} que aceite ${def.label}.`);
		return null;
	}
	const options = items.map((i) => {
		const n = entriesOf(i).length;
		return `<option value="${i.id}">${esc(i.name)}${n ? ` — ${n} ${n === 1 ? "maldição" : "maldições"}` : ""}</option>`;
	}).join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: `Amaldiçoar um item: ${def.label}` },
		content: `<div class="standard-form"><p>Qual item de <strong>${esc(actor.name)}</strong> recebe <strong>${esc(def.label)}</strong>?</p><p class="hint">${esc(def.text)}</p><div class="form-group"><label>Item</label><select name="item">${options}</select></div><p class="hint">A categoria do item sobe: +II na primeira maldição e +I nas seguintes.</p></div>`,
		ok: { label: "Amaldiçoar" },
		rejectClose: false,
		position: { width: 480 },
	}).catch(() => null);
	return items.find((i) => i.id === result?.item) ?? null;
}

/**
 * Aplica uma maldição avulsa (item `curse`) a um item: o jogador escolhe qual item da ficha vira amaldiçoado.
 * A maldição que estava na mochila some (virou parte do item).
 * @param {Item} curseDoc  item `curse` (do compêndio, do mundo ou da ficha)
 * @param {{actor?: Actor, target?: Item}} options  ficha dona do item e, se já souber, o item a amaldiçoar
 */
export async function applyCurseDocument(curseDoc, { actor = null, target = null } = {}) {
	const key = curseDoc?.system?.curseKey;
	const def = CURSES[key];
	if (!def) { ui.notifications.warn("Maldição desconhecida."); return false; }
	const owner = target?.parent ?? actor ?? curseDoc.parent ?? game.user.character ?? canvas?.tokens?.controlled?.[0]?.actor ?? null;
	if (!owner) { ui.notifications.warn("Abra a ficha de um agente (ou arraste a maldição para ela) para escolher o item a amaldiçoar."); return false; }
	const item = target ?? (await chooseTargetItem(owner, def));
	if (!item) return false;
	const ok = await addCurse(item, key);
	if (!ok) return false;
	if (curseDoc.parent === owner) await curseDoc.delete();
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: owner }),
		content: `<div class="op-curse-card"><strong>${esc(owner.name)}</strong> amaldiçoou <strong>${esc(item.name)}</strong> com <strong>${esc(def.label)}</strong> <em>(${esc(ELEMENTS[elementOf({ key })].label)})</em>.</div>`,
	});
	return true;
}

/* -------------------------------------------- */
/*  Visão para a ficha do item                   */
/* -------------------------------------------- */

const ACTIONS = { standard: "ação padrão", movement: "ação de movimento", free: "ação livre", reaction: "reação" };

/** Dados da lista de maldições da ficha do item. */
export function cursesView(item) {
	const kind = ITEM_KIND[item.type];
	if (!kind) return null;
	const entries = entriesOf(item);
	const labels = curseCostLabels(entries.length);
	const equipped = isEquipped(item);
	const now = game.time?.worldTime ?? 0;
	const list = entries.map((entry, i) => {
		const def = CURSES[entry.key];
		const element = elementOf(entry);
		const locked = Boolean(def.lock) && !isUnlocked(entry, now);
		const waiting = locked && entry.since ? Math.max(0, DAY - (now - entry.since)) : DAY;
		return {
			key: entry.key,
			label: def.label,
			element,
			elementLabel: ELEMENTS[element]?.label ?? "",
			color: ELEMENTS[element]?.color ?? "#888",
			text: def.text,
			mode: { auto: "automática", semi: "semi", manual: "manual" }[def.mode],
			cost: labels[i],
			chosen: entry.chosen ? (ELEMENTS[entry.chosen]?.label ?? entry.chosen) : "",
			status: !equipped ? "guardada (item não equipado)" : locked ? `liga após um dia de uso${entry.since ? ` (faltam ${Math.ceil(waiting / 3600)} h)` : ""}` : "ativa",
			inactive: !equipped || locked,
			use: def.use ? { label: item.parent ? def.use.label.replace(/PE/, resourceOf(item.parent)) : def.use.label, cost: def.use.cost, action: ACTIONS[def.use.action] ?? "" } : null,
			effect: changesFor(entry, { protectionClass: item.type === "protection" ? protectionClass(item) : "light" }).map((c) => c.label),
		};
	});
	const taken = new Set(entries.map((e) => e.key));
	const addable = cursesForKind(kind).filter((c) => !taken.has(c.key) && (c.only !== "melee" || weaponRange(item) !== "ranged"));
	const grouped = Object.entries(ELEMENTS).filter(([k]) => k !== "fear").map(([element, e]) => ({
		label: e.label,
		options: addable.filter((c) => c.element === element).map((c) => ({ key: c.key, label: c.label })),
	})).filter((g) => g.options.length);
	return {
		kindLabel: KINDS[kind],
		list,
		has: list.length > 0,
		groups: grouped,
		canAdd: grouped.length > 0,
		category: `+${curseCategoryBonusLabel(entries.length)} na categoria`,
		warnings: opposedWarnings(entries),
		notAgent: !item.parent,
	};
}

const ROMAN_BONUS = ["", "II", "III", "IV", "V", "VI"];
const curseCategoryBonusLabel = (n) => ROMAN_BONUS[curseCategoryBonus(n) - 1] ?? "";

function opposedWarnings(entries) {
	const out = [];
	for (let i = 0; i < entries.length; i++) {
		for (let j = i + 1; j < entries.length; j++) {
			const a = elementOf(entries[i]);
			const b = elementOf(entries[j]);
			if (a && b && isOpposed(a, b)) out.push(`${CURSES[entries[i].key].label} (${ELEMENTS[a].label}) e ${CURSES[entries[j].key].label} (${ELEMENTS[b].label}) são elementos opressores: o livro não permite os dois no mesmo item.`);
		}
	}
	return out;
}

/* -------------------------------------------- */
/*  Uso: botão da ficha do item                  */
/* -------------------------------------------- */

const resourceOf = (actor) => (actor.usingWithoutSanityRule ? "PD" : "PE");

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

/** Usa a habilidade ativa da maldição: gasta PE/PD, rola o que o livro manda e posta o cartão. */
export async function useCurse(item, key) {
	const actor = item.parent;
	const def = CURSES[key];
	const use = def?.use;
	if (!actor || !use) { ui.notifications.warn("Coloque o item numa ficha para usar a maldição."); return null; }
	const entry = entriesOf(item).find((e) => e.key === key);
	if (!entry) return null;
	if (!isEquipped(item)) { ui.notifications.warn(`${item.name} não está equipado.`); return null; }
	if (!(await spend(actor, use.cost, use.label))) return null;
	let roll = null;
	let extra = "";
	if (use.calc === "sadica") {
		const result = await foundry.applications.api.DialogV2.input({
			window: { title: "Sádica" },
			content: `<div class="standard-form"><p>Quanto dano você sofreu desde o fim do seu último turno?</p><div class="form-group"><label>Dano sofrido</label><input type="number" name="damage" min="0" value="0"/></div></div>`,
			ok: { label: "Calcular" },
			rejectClose: false,
		}).catch(() => null);
		if (!result) return null;
		const bonus = sadicaBonus(result.damage);
		extra = `<p><strong>+${bonus}</strong> em testes de ataque e rolagens de dano neste turno (${esc(result.damage)} de dano sofrido).</p>`;
	} else if (key === "letargica") {
		const cls = protectionClass(item);
		const chance = def.chanceByClass[cls];
		roll = await new Roll("1d100").evaluate();
		extra = `<p>Chance de ignorar o dano extra: <strong>${chance}%</strong> (${roll.total <= chance ? "<strong>ignora</strong>" : "não ignora"}).</p>`;
	} else if (use.roll) {
		roll = await new Roll(use.roll).evaluate();
	}
	if (use.heal && roll) {
		const max = actor.system.PV?.max ?? actor.system.PV?.value;
		const now = Number(actor.system.PV?.value) || 0;
		const healed = Math.max(0, Math.min(roll.total, max - now));
		await actor.update({ "system.PV.value": now + healed });
		extra = `<p>Recupera <strong>${healed}</strong> PV.</p>`;
	}
	if (use.tempPV && roll) extra = `<p>Ganha <strong>${roll.total}</strong> PV temporários e o alvo fica fraco.</p>`;
	const costText = use.cost ? ` · ${use.cost} ${resourceOf(actor)}` : "";
	const content = `<div class="op-curse-card"><h3>${esc(def.label)} <small>(${esc(ELEMENTS[elementOf(entry)].label)})</small></h3><p><em>${esc(use.label)} · ${esc(ACTIONS[use.action] ?? "")}${costText}</em></p><p>${esc(use.text)}</p>${use.rollNote ? `<p>${esc(use.roll)} ${esc(use.rollNote)}</p>` : ""}${extra}<p class="hint">${esc(item.name)}</p></div>`;
	const data = { speaker: ChatMessage.getSpeaker({ actor }), content };
	if (roll) return roll.toMessage(data, { rollMode: game.settings.get("core", "rollMode") });
	return ChatMessage.create(data);
}

/* -------------------------------------------- */
/*  Dano extra e efeitos do ataque               */
/* -------------------------------------------- */

const num = (v) => Number(v) || 0;

/** Efeitos "ao usar" de maldições marcados na seleção do ataque (`selection.used`: ids `${itemId}-${effectId}`). */
function usedCurseEffects(weapon, used = []) {
	const out = [];
	for (const u of used ?? []) {
		const effectId = String(u.id).split("-").slice(1).join("-");
		const effect = weapon.effects.get(effectId);
		const key = effect?.getFlag(SYSTEM_ID, CURSE_USE_FLAG);
		if (key) out.push({ key, effect, onUse: effect.getFlag(SYSTEM_ID, "onUse") ?? {} });
	}
	return out;
}

/** Tipo de dano trocado pela seleção do ataque (Energética), ou null. */
export function convertedDamageType(weapon, attackOptions) {
	return usedCurseEffects(weapon, attackOptions?.used).find((u) => u.onUse.convertType)?.onUse.convertType ?? null;
}

/** A seleção do ataque ignora a RD do alvo (Energética)? */
export const ignoresRd = (weapon, attackOptions) => usedCurseEffects(weapon, attackOptions?.used).some((u) => u.onUse.ignoreRd);

const diceMultiplied = (formula, mult) => String(formula).replace(/^(\d+)d(\d+)$/, (_m, n, f) => `${Number(n) * mult}d${f}`);

/** Maldições de dano da arma que valem neste ataque (sempre ligadas, ou escolhidas na tela de ataque). */
export function damageCursesFor(weapon, used = []) {
	if (weapon?.type !== "armament" || !isEquipped(weapon)) return [];
	const chosenKeys = new Set(usedCurseEffects(weapon, used).map((u) => u.key));
	const active = weapon.parent ? resolveActive(snapshot(weapon.parent), game.time.worldTime) : null;
	return entriesOf(weapon).filter((entry) => {
		const def = CURSES[entry.key];
		if (!def?.damage) return false;
		if (active && !active.get(`${weapon.id}:${entry.key}`)) return false;
		return def.damage.always || chosenKeys.has(entry.key);
	}).map((entry) => ({ entry, def: CURSES[entry.key] }));
}

/**
 * Rola o dano extra das maldições da arma, uma carta por maldição, separada do dano da arma.
 * Lancinante multiplica no crítico (único caso do livro); os outros não.
 */
export async function rollCurseDamage(weapon, { attackOptions = null, hitResult = null, critical = null, attackMessageId = null, attackIndex = null, attackTotal = null } = {}) {
	const actor = weapon.parent;
	if (!actor) return [];
	const messages = [];
	for (const { entry, def } of damageCursesFor(weapon, attackOptions?.used)) {
		const d = def.damage;
		const mult = d.multiplyOnCrit && critical?.isCritical ? Math.max(1, critical.multiplier ?? 2) : 1;
		const formula = diceMultiplied(d.formula, mult);
		const type = d.typeFromChoice ? ELEMENTS[entry.chosen]?.damage : d.type;
		if (!type) continue;
		const roll = await new Roll(formula).evaluate();
		let targetName = null;
		if (hitResult?.actorUuid) {
			try { targetName = fromUuidSync(hitResult.actorUuid)?.name ?? null; } catch { targetName = null; }
		}
		const typeLabel = game.i18n.has(`op.damageTypeAbv.${type}`) ? game.i18n.localize(`op.damageTypeAbv.${type}`) : type;
		const flags = { [SYSTEM_ID]: { curseDamage: { key: entry.key, weapon: weapon.name } } };
		if (hitResult?.actorUuid) {
			flags[SYSTEM_ID].damageTarget = { actorUuid: hitResult.actorUuid, targetName, damageType: type, attackMessageId };
			flags[SYSTEM_ID].damageInfo = { formula, isCritical: mult > 1, multiplier: mult, weapon: `${weapon.name} (Maldição ${def.label})` };
		}
		const message = await roll.toMessage(
			{
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: `Maldição ${def.label}: +${formula} de ${typeLabel} (${weapon.name})${attackIndex ? ` (${attackIndex}/${attackTotal})` : ""}${targetName ? ` → ${targetName}` : ""}`,
				flags,
			},
			{ rollMode: game.settings.get("core", "rollMode") }
		);
		messages.push(message);
		if (message && flags[SYSTEM_ID].damageTarget && damageApplicationMode() === "auto" && hitResult?.hit === true && hitResult?.revealed !== false) {
			requestCardDamage(message).catch((err) => console.error("Ordem Paranormal | dano da maldição falhou", err));
		}
	}
	await afterHitEffects(weapon, { attackOptions, hitResult });
	return messages;
}

/** Efeitos de quem foi atingido com a opção escolhida: Imóvel (Consumidora) e dano contínuo (Erosiva). */
async function afterHitEffects(weapon, { attackOptions, hitResult }) {
	if (!hitResult?.hit || !hitResult.actorUuid) return;
	const used = usedCurseEffects(weapon, attackOptions?.used);
	if (!used.length) return;
	const target = await fromUuid(hitResult.actorUuid).catch(() => null);
	if (!target) return;
	for (const { key } of used) {
		const hit = CURSES[key]?.afterHit;
		if (!hit) continue;
		if (hit.condition) {
			const origin = weapon.parent?.uuid ?? null;
			const data = conditionEffectData("immobile", { rounds: hit.rounds ?? 1, origin, startRound: game.combat?.round ?? null });
			if (target.isOwner) await target.createEmbeddedDocuments("ActiveEffect", [data]);
			else await gmNotice(`${CURSES[key].label}: aplique "Imóvel" por ${hit.rounds ?? 1} rodada em ${target.name}.`);
		} else if (hit.dot) {
			await gmNotice(`${CURSES[key].label}: ${target.name} sofre ${hit.dot.formula} de dano de Morte no início de cada turno seu pelas próximas ${hit.dot.rounds} rodadas.`);
		}
	}
}

/* -------------------------------------------- */
/*  Preço da maldição                            */
/* -------------------------------------------- */

/** Maldições em uso por elemento, somando todos os itens equipados do agente. */
export const curseCounts = (actor) => countByElement(snapshot(actor));

/**
 * Cobra o preço da maldição de um elemento: 2 de Sanidade por maldição desse elemento nos itens em uso.
 * Sem Sanidade (modo "Jogando sem Sanidade") a perda é de PD, no mesmo valor — o livro não define outra coisa (D3 da spec).
 */
export async function payCursePrice(actor, element) {
	const counts = curseCounts(actor);
	const cost = curseCost(counts, element);
	if (!cost) { ui.notifications.info(`${actor.name} não tem maldição de ${ELEMENTS[element].label} em uso.`); return 0; }
	const key = actor.usingWithoutSanityRule ? "PD" : "SAN";
	const current = Number(actor.system[key]?.value) || 0;
	const paid = Math.min(cost, current);
	await actor.update({ [`system.${key}.value`]: current - paid });
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="op-curse-card"><strong>Preço da maldição</strong> (${esc(ELEMENTS[element].label)}): ${esc(actor.name)} perde <strong>${paid}</strong> de ${key === "PD" ? "Determinação" : "Sanidade"} (2 por maldição, ${counts[element]} em uso).</div>`,
	});
	return paid;
}

/** Janela para o agente cobrar o preço de um elemento (botão da ficha e oferta depois de falhar num teste). */
export async function promptCursePrice(actor, { attribute = null } = {}) {
	const counts = curseCounts(actor);
	const elements = (attribute ? elementsForAttribute(attribute) : Object.keys(ELEMENTS)).filter((e) => counts[e] > 0 || e === "fear");
	if (!elements.length) { ui.notifications.info("Nenhuma maldição em uso cobra preço para este teste."); return null; }
	const options = elements.map((e) => `<option value="${e}">${esc(ELEMENTS[e].label)} — ${counts[e]} ${counts[e] === 1 ? "maldição" : "maldições"} = ${curseCost(counts, e)}</option>`).join("");
	const attrNote = attribute ? `Falha em teste de ${ATTRIBUTE_NAMES[attribute]}. ` : "";
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: "Preço da maldição" },
		content: `<div class="standard-form"><p>${attrNote}Quem falha em teste do atributo do elemento perde 2 de Sanidade por maldição desse elemento (Medo: o preço é definido pelo Mestre).</p><div class="form-group"><label>Elemento</label><select name="element">${options}</select></div></div>`,
		ok: { label: "Pagar o preço" },
		rejectClose: false,
	}).catch(() => null);
	if (!result?.element || result.element === "fear") return null;
	return payCursePrice(actor, result.element);
}

/* -------------------------------------------- */
/*  Compêndio                                    */
/* -------------------------------------------- */

/**
 * Completa o compêndio "Maldições Paranormais" a partir de fixtures/curses-pack.json (gerado junto com o pacote compilado).
 * Serve quando o pacote compilado ainda não foi copiado para o Data do Foundry: o Mestre ativo importa o que falta.
 * @returns {Promise<number>} quantos itens criou
 */
export async function ensureCursePack() {
	const pack = game.packs.get(`${SYSTEM_ID}.curses`);
	if (!pack) return 0;
	const response = await fetch(`systems/${SYSTEM_ID}/fixtures/curses-pack.json`);
	if (!response.ok) return 0;
	const bundle = await response.json();
	const index = await pack.getIndex();
	const have = new Set(index.map((e) => e._id));
	const items = bundle.items.filter((i) => !have.has(i._id));
	if (!items.length) return 0;
	const strip = (d) => { const { _key, _stats, ...rest } = d; return rest; };
	const wasLocked = pack.locked;
	if (wasLocked) await pack.configure({ locked: false });
	try {
		const folders = await Folder.implementation.createDocuments(bundle.folders.filter((f) => !pack.folders.has(f._id)).map(strip), { pack: pack.collection, keepId: true });
		void folders;
		await Item.implementation.createDocuments(items.map(strip), { pack: pack.collection, keepId: true });
	} finally {
		if (wasLocked) await pack.configure({ locked: true });
	}
	return items.length;
}

/* -------------------------------------------- */
/*  Ganchos                                      */
/* -------------------------------------------- */

const mine = (userId) => userId === game.user.id;
const relevant = (changes) => changes.system?.curses !== undefined || changes.system?.using?.state !== undefined || changes.system?.critical !== undefined || changes.name !== undefined || changes.system?.types !== undefined;

export function registerCurseHooks() {
	Hooks.on("createItem", (item, _options, userId) => {
		if (!mine(userId) || !isCursable(item) || !item.system.curses?.length) return;
		setTimeout(() => syncItemCurses(item), 300);
	});
	Hooks.on("updateItem", (item, changes, _options, userId) => {
		if (!mine(userId) || !isCursable(item) || !relevant(changes)) return;
		setTimeout(() => syncItemCurses(item), 200);
	});
	Hooks.on("deleteItem", (item, _options, userId) => {
		if (!mine(userId) || !isCursable(item) || !item.parent || !item.system.curses?.length) return;
		setTimeout(() => syncActorCurses(item.parent), 200);
	});
	// Esforço Adicional e Vitalidade ligam um dia depois: o Mestre reconfere quando o tempo do mundo anda.
	Hooks.on("updateWorldTime", () => {
		if (game.users.activeGM?.id !== game.user.id) return;
		for (const actor of game.actors.filter((a) => a.type === "agent")) {
			if (actor.items.some((i) => isCursable(i) && entriesOf(i).some((e) => CURSES[e.key]?.lock))) syncActorCurses(actor);
		}
	});
	Hooks.once("ready", () => {
		if (game.users.activeGM?.id !== game.user.id) return;
		ensureCursePack().catch((err) => console.warn("Ordem Paranormal | compêndio de maldições:", err));
		(async () => {
			for (const actor of game.actors.filter((a) => a.type === "agent")) {
				if (actor.items.some((i) => isCursable(i) && entriesOf(i).length)) await syncActorCurses(actor);
			}
		})().catch((err) => console.warn("Ordem Paranormal | sincronização das maldições falhou:", err));
	});
}
