/**
 * Categoria dos itens e limite da patente (sem Foundry — testável em Node). Ver docs/arquivo/spec-categoria-de-itens.md.
 *
 * Cada modificação de arma ou proteção aumenta a categoria do item em I (Livro de Regras, "Modificações").
 * A patente limita quantos itens de cada categoria o agente escolhe por missão (Tabela 3.1). Passar do limite não
 * trava nada: a ficha só mostra o número em vermelho.
 */

/** Modificações de armas corpo a corpo, de disparo, de fogo e de munição (Tabela 3.5). */
export const WEAPON_MODIFICATIONS = Object.freeze({
	alongada: "Alongada",
	calibreGrosso: "Calibre Grosso",
	certeira: "Certeira",
	compensador: "Compensador",
	cruel: "Cruel",
	discreta: "Discreta",
	dumDum: "Munição Dum dum",
	explosiva: "Munição Explosiva",
	ferrolhoAutomatico: "Ferrolho Automático",
	miraLaser: "Mira Laser",
	miraTelescopica: "Mira Telescópica",
	perigosa: "Perigosa",
	silenciador: "Silenciador",
	tatica: "Tática",
	visaoDeCalor: "Visão de Calor",
});

/** Modificações de proteções (Tabela 3.7). */
export const PROTECTION_MODIFICATIONS = Object.freeze({
	antibombas: "Antibombas",
	blindada: "Blindada",
	discreta: "Discreta",
	reforcada: "Reforçada",
});

export const ROMAN = Object.freeze(["0", "I", "II", "III", "IV"]);
import { curseCategoryBonus, curseCount } from "./curse-rules.mjs";
const PHYSICAL = ["armament", "protection", "generalEquipment"];

const int = (v) => Math.max(0, Math.trunc(Number(v)) || 0);

/** Quantas modificações o item tem (cada uma sobe a categoria em 1). */
export function modificationCount(system = {}) {
	const mods = system.modifications;
	if (!mods) return 0;
	return new Set(Array.from(mods).filter(Boolean)).size;
}

/** Bônus de categoria das maldições do item: a primeira soma II e cada seguinte I (curse-rules.mjs). */
export function curseBonus(system = {}) {
	return curseCategoryBonus(curseCount(system));
}

/** Categoria do item: a escrita nele mais uma por modificação e as maldições, menos a redução das habilidades (nunca abaixo de 0). */
export function effectiveCategory(item, reduceFn = noReduction) {
	const base = int(item?.system?.category);
	return Math.max(0, base + modificationCount(item?.system) + curseBonus(item?.system) - int(reduceFn(item)));
}

const noReduction = () => 0;
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Habilidades que reduzem a categoria de um item para o agente (Livro de Regras):
 * - Aniquilador: A Favorita (arma favorita −I), Técnica Secreta (−II), Máquina de Matar (−III); não somam, vale a maior.
 * - Ferramentas Favoritas (origem): um item à escolha, exceto arma, −I.
 * - Remendão (Técnico): todo equipamento geral −I.
 * @param {string[]} abilityNames nomes das habilidades que o agente possui
 * @returns {(item:{type:string, system:object}) => number} quanto a categoria do item diminui
 */
export function categoryReducer(abilityNames = []) {
	const names = abilityNames.map(norm);
	const has = (suffix) => names.some((n) => n.endsWith(suffix));
	const weaponTier = has("maquinadematar") ? 3 : has("tecnicasecreta") ? 2 : has("afavorita") ? 1 : 0;
	const favoriteTool = has("ferramentasfavoritas") ? 1 : 0;
	const mender = has("remendao") ? 1 : 0;
	return (item) => {
		const favorite = Boolean(item?.system?.favorite);
		if (item?.type === "armament") return favorite ? weaponTier : 0;
		let r = favorite ? favoriteTool : 0;
		if (item?.type === "generalEquipment") r += mender;
		return r;
	};
}

/** Rótulo da categoria: 0, I…IV, depois V, VI… */
export function categoryLabel(n) {
	const v = int(n);
	if (v < ROMAN.length) return ROMAN[v];
	return ["V", "VI", "VII", "VIII", "IX", "X"][v - 5] ?? String(v);
}

/** Itens da ficha que contam para o limite (armas, proteções e equipamentos; categoria 0 não conta). */
const counted = (item, reduceFn) => PHYSICAL.includes(item?.type) && effectiveCategory(item, reduceFn) > 0;

/** Quantas unidades do item contam: a quantidade (cada exemplar é um item da missão). */
const units = (item) => Math.max(1, int(item?.system?.quantity ?? 1));

/**
 * Uso do limite por categoria.
 * @param {Array<{type:string, system:object}>} items itens da ficha
 * @param {{itemLimit1?:number|null, itemLimit2?:number|null, itemLimit3?:number|null, itemLimit4?:number|null}} patent
 * @returns {{ rows: Array<{cat:number, label:string, used:number, limit:number, over:boolean}>, above: {used:number, over:boolean}, anyOver:boolean }}
 * Limite vazio (patente sem aquela categoria) vale 0: qualquer item dela passa do limite. Acima de IV não há limite.
 */
export function categoryUsage(items = [], patent = {}, reduceFn = noReduction) {
	const used = { 1: 0, 2: 0, 3: 0, 4: 0, above: 0 };
	for (const item of items) {
		if (!counted(item, reduceFn)) continue;
		const cat = effectiveCategory(item, reduceFn);
		used[cat > 4 ? "above" : cat] += units(item);
	}
	const rows = [1, 2, 3, 4].map((cat) => {
		const limit = int(patent?.[`itemLimit${cat}`]);
		return { cat, label: ROMAN[cat], used: used[cat], limit, over: used[cat] > limit };
	});
	const above = { used: used.above, over: used.above > 0 };
	return { rows, above, anyOver: rows.some((r) => r.over) || above.over };
}

/**
 * Situação de um item: categoria final, de onde ela vem e se a categoria dele está passando do limite.
 * @returns {{ category:number, label:string, base:number, mods:number, reduced:number, over:boolean, tip:string }}
 */
export function itemCategoryInfo(item, usage, reduceFn = noReduction) {
	const base = int(item?.system?.category);
	const mods = modificationCount(item?.system);
	const curses = curseCount(item?.system);
	const cursed = curseCategoryBonus(curses);
	const reduced = Math.min(int(reduceFn(item)), base + mods + cursed);
	const category = base + mods + cursed - reduced;
	const row = usage?.rows?.find((r) => r.cat === category);
	const over = category > 4 ? Boolean(usage?.above?.over) : Boolean(row?.over);
	const parts = [`Categoria ${categoryLabel(base)}`];
	if (mods) parts.push(`+ ${mods} ${mods === 1 ? "modificação" : "modificações"}`);
	if (curses) parts.push(`+ ${categoryLabel(cursed)} (${curses} ${curses === 1 ? "maldição" : "maldições"})`);
	if (reduced) parts.push(`− ${reduced} (habilidade)`);
	const tip = parts.length > 1 ? `${parts.join(" ")} = ${categoryLabel(category)}` : parts[0];
	return { category, label: categoryLabel(category), base, mods, curses, cursed, reduced, over: over && category > 0, tip };
}
