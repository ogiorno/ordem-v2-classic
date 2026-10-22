/**
 * Regras puras da barra inferior automática (docs/arquivo/spec-hotbar-automatica.md). Sem Foundry: roda em Node nos testes.
 */
import { paranormalItemInfo } from "./paranormal-item-rules.mjs";

export const SYSTEM = "ordem-v2-classic";
export const HOTBAR_SLOTS = 50;
export const PAGE_SIZE = 10;
export const MAX_ROWS = 3;
export const PAGES = 5;
export const HOTBAR_FLAG = "hotbarMacro";
export const WEAPON_FLAG = "weaponMacro";

/** Execuções que se usam (tudo menos passiva). */
export const ACTIVE_EXECUTIONS = Object.freeze(["free", "movement", "default", "complete", "reaction"]);

/** Que tipo de item entra na barra: weapon | ritual | ability | paranormal | null (HB-01 a HB-06). */
export function hotbarKind(item) {
	if (item?.parent?.type !== "agent") return null;
	if (item.type === "armament") return "weapon";
	if (item.type === "ritual") return "ritual";
	if (item.type === "ability") return "ability";
	if (item.type === "generalEquipment" && paranormalItemInfo(item.name)?.uses.length) return "paranormal";
	return null;
}

/** O item deve ter macro na barra? Arma sempre; ritual salvo passivo (vazio entra); habilidade só com execução ativa (vazia = passiva). */
export function belongsOnHotbar(item) {
	const kind = hotbarKind(item);
	if (kind === "weapon" || kind === "paranormal") return true;
	if (kind === "ritual") return item.system?.execution !== "passive";
	if (kind === "ability") return ACTIVE_EXECUTIONS.includes(item.system?.activation);
	return false;
}

/** Passou a ser (ou deixou de ser) elegível? `was` indefinido = não sabemos: só remove, nunca cria (HB-33). */
export function hotbarTransition(was, is) {
	if (!is) return was === false ? "none" : "remove";
	return was === false ? "add" : "none";
}

/** Primeiro espaço vazio da barra (1 a 50), ou null se estiver cheia (HB-10a, HB-10b). */
export function freeHotbarSlot(hotbar = {}) {
	for (let slot = 1; slot <= HOTBAR_SLOTS; slot++) if (!hotbar[slot]) return slot;
	return null;
}

/** Espaços da barra que apontam para uma destas macros. */
export function hotbarSlotsOf(hotbar = {}, macroIds = []) {
	const ids = new Set(macroIds);
	return Object.entries(hotbar).filter(([, id]) => ids.has(id)).map(([slot]) => slot);
}

const quote = (text) => String(text).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Dados da macro de um item: usa o id do agente e do item, então não depende de seleção nem de nome único (HB-24). */
export function hotbarMacroData(item) {
	const actorId = item.parent?.id ?? null;
	const info = { actorId, itemId: item.id, kind: hotbarKind(item) };
	return {
		name: item.name,
		type: "script",
		scope: "actor",
		img: item.img,
		command: `ordemparanormal.documents.macro.rollItemById('${quote(actorId)}', '${quote(item.id)}')`,
		flags: { [SYSTEM]: { itemMacro: true, [HOTBAR_FLAG]: info, ...(info.kind === "weapon" ? { [WEAPON_FLAG]: { actorId, itemId: item.id } } : {}) } },
	};
}

/** A macro foi criada pelo sistema para um item (de qual agente e item)? Lê também a marca antiga das armas. */
export function hotbarMacroInfo(macro) {
	const flags = macro?.flags?.[SYSTEM];
	return flags?.[HOTBAR_FLAG] ?? flags?.[WEAPON_FLAG] ?? null;
}

/** Macros marcadas cujo item ou agente não existe mais, ou que deixou de ser elegível (HB-11e). `lookup(actorId, itemId)` devolve o item ou null. */
export function orphanMacroIds(macros, lookup) {
	const ids = [];
	for (const macro of macros) {
		const info = hotbarMacroInfo(macro);
		if (!info) continue;
		const item = lookup(info.actorId, info.itemId);
		if (!item || !belongsOnHotbar(item)) ids.push(macro.id);
	}
	return ids;
}

/* ---------------- linhas visíveis (spec §7a) ---------------- */

export const ROW_STEPS = Object.freeze(["auto", 1, 2, 3]);

/** Valor da configuração normalizado: "auto" ou 1 a 3 (4 e 5 viram 3; lixo cai em "auto"). */
export function normalizeRows(value) {
	if (value === "auto" || value === undefined || value === null || value === "") return "auto";
	const n = Number(value);
	if (!Number.isInteger(n) || n < 1) return "auto";
	return Math.min(n, MAX_ROWS);
}

/** Linhas a desenhar: fixo devolve o valor; automático conta até o maior espaço ocupado (HB-52). */
export function visibleRows(setting, hotbar = {}) {
	const value = normalizeRows(setting);
	if (value !== "auto") return value;
	const highest = Math.max(0, ...Object.entries(hotbar).filter(([, id]) => id).map(([slot]) => Number(slot)));
	return Math.min(MAX_ROWS, Math.max(1, Math.ceil(highest / PAGE_SIZE)));
}

/** Passo do componente −/+ : Auto → 1 → 2 → 3 (HB-58). */
export function stepRows(setting, direction) {
	const index = ROW_STEPS.indexOf(normalizeRows(setting));
	return ROW_STEPS[Math.min(ROW_STEPS.length - 1, Math.max(0, index + (direction > 0 ? 1 : -1)))];
}

/** Páginas das linhas extras, da mais distante (topo) para a mais próxima da linha de baixo; a página cicla de 5 para 1 (HB-51). */
export function extraRowPages(currentPage, rows) {
	const pages = [];
	for (let k = rows - 1; k >= 1; k--) pages.push(((currentPage - 1 + k) % PAGES) + 1);
	return pages;
}
