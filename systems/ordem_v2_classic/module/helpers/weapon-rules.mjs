/**
 * Regras puras das peculiaridades da arma na tela de ataque (docs/spec-tela-de-ataque.md, seção "A arma").
 * Livro de Regras v1.3, cap. 3: arma ágil, automática (rajada), arremesso, coronhada, empunhadura e alcance.
 */

const strip = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Alcance em quadrados do mapa (1 quadrado = 1,5 m): curto 9 m, médio 18 m, longo 36 m, extremo 90 m. */
const RANGE_SQUARES = { curto: 6, medio: 12, longo: 24, extremo: 60 };

/** Quadrados de alcance de uma arma ("Curto", "Médio"...), ou null se a arma não tem alcance. */
export function rangeSquares(rangeText) {
	return RANGE_SQUARES[strip(rangeText)] ?? null;
}

/** Armas que, pela regra do livro, podem ser empunhadas com uma mão por quem é veterano em Luta (ex.: Katana). */
const ADAPTABLE_BY_NAME = ["katana"];

export const isMelee = (system) => system?.types?.rangeType?.name === "melee";
export const isRanged = (system) => system?.types?.rangeType?.name === "ranged";

/** Empunhaduras possíveis, na ordem em que aparecem na tela. */
export function gripChoices(system, name = "") {
	const base = system?.types?.gripType || "oneHand";
	const adaptable = Boolean(system?.conditions?.adaptableGrip) || ADAPTABLE_BY_NAME.includes(strip(name));
	if (!adaptable) return { base, adaptable: false, options: [base] };
	return { base: base === "light" ? "oneHand" : base, adaptable: true, options: ["twoHands", "oneHand"] };
}

/** Modos de ataque que a arma permite (o primeiro é sempre o normal). */
export function weaponModes(system, name = "") {
	const modes = ["normal"];
	if (system?.conditions?.automatic && isRanged(system)) modes.push("burst");
	if (system?.conditions?.throwable || (isMelee(system) && !system?.conditions?.improvised)) modes.push("throw");
	if (system?.conditions?.pistolBlow && isRanged(system)) modes.push("blow");
	return modes;
}

/** O ataque pode usar Agilidade no lugar de Força? (arma ágil, corpo a corpo, modo normal) */
export function canChooseAttribute(system, mode = "normal") {
	return Boolean(system?.conditions?.agile) && isMelee(system) && mode === "normal";
}

/**
 * O que o modo escolhido muda no ataque.
 * @returns {{ attackDice:number, damageDice:number, skill?:string, attr?:string, damageFormula?:string, damageType?:string, damageAttr?:string, melee:boolean, squares:number|null, label:string }}
 */
export function applyMode(system, mode = "normal") {
	const melee = isMelee(system);
	const squares = rangeSquares(system?.range);
	const out = { attackDice: 0, damageDice: 0, melee, squares: melee ? 1 : squares, label: "" };
	if (mode === "burst") {
		// Rajada: –d20 no ataque e 1 dado de dano adicional do mesmo tipo.
		return { ...out, attackDice: -1, damageDice: 1, label: "Rajada" };
	}
	if (mode === "throw") {
		// Arremesso: Pontaria, soma Força no dano; armas sem alcance só vão até o curto e sofrem –d20.
		const hasRange = Boolean(system?.conditions?.throwable);
		return { ...out, skill: "aim", attr: "dex", damageAttr: "str", melee: false, attackDice: hasRange ? 0 : -1, squares: (hasRange && squares) || RANGE_SQUARES.curto, label: hasRange ? "Arremesso" : "Arremesso improvisado" };
	}
	if (mode === "blow") {
		// Coronhada: a arma de fogo vira corpo a corpo, 1d4 (leve/uma mão) ou 1d6 (duas mãos), impacto.
		const heavy = system?.types?.gripType === "twoHands";
		return { ...out, skill: "fighting", attr: "str", melee: true, squares: 1, damageFormula: heavy ? "1d6" : "1d4", damageType: "impactDamage", damageAttr: "str", label: "Coronhada" };
	}
	return out;
}

/** Distância em quadrados entre duas caixas de token (bordas), em quadrados contados como o jogo: 1 = adjacente. */
export function squaresBetween(a, b, size) {
	const gx = Math.max(0, Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) - (a.w + b.w) / 2) / size;
	const gy = Math.max(0, Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) - (a.h + b.h) / 2) / size;
	return Math.round(Math.max(gx, gy) + 1);
}

/**
 * Alcance do ataque.
 * @param {{ squares:number|null, melee:boolean }} reach  do applyMode
 * @param {number|null} distance  quadrados até o alvo, ou null sem alvo/mapa
 * @returns {{ state:"unknown"|"ok"|"penalty"|"blocked", attackDice:number, text:string }}
 */
export function rangeCheck(reach, distance) {
	if (distance === null || distance === undefined) return { state: "unknown", attackDice: 0, text: "" };
	const meters = Math.round(distance * 1.5 * 10) / 10;
	if (reach.melee) {
		return distance <= 1
			? { state: "ok", attackDice: 0, text: `Alvo adjacente (${meters} m).` }
			: { state: "blocked", attackDice: 0, text: `Alvo a ${meters} m: arma corpo a corpo só alcança quem está adjacente.` };
	}
	if (!reach.squares) return { state: "unknown", attackDice: 0, text: `Alvo a ${meters} m.` };
	const limit = Math.round(reach.squares * 1.5 * 10) / 10;
	if (distance <= reach.squares) return { state: "ok", attackDice: 0, text: `Alvo a ${meters} m, dentro do alcance (${limit} m).` };
	if (distance <= reach.squares * 2) return { state: "penalty", attackDice: -1, text: `Alvo a ${meters} m, além do alcance (${limit} m): −1d20 no ataque.` };
	return { state: "blocked", attackDice: 0, text: `Alvo a ${meters} m, além do dobro do alcance (${limit * 2} m).` };
}

/** Ataque de quem está sob condição que impede ações (Atordoado). */
export function actionBlock(conditionFlags) {
	return conditionFlags.some((c) => c?.noActions) ? "Atordoado: não pode realizar ações." : null;
}
