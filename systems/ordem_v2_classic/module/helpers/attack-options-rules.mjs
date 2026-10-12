/**
 * Regras puras da tela de ataque (sem Foundry — testável em Node). Ver docs/arquivo/spec-tela-de-ataque.md.
 *
 * Uma "opção de ataque" é um Efeito Ativo desligado com `flags.ordem_v2_classic.onUse`. Aqui ficam
 * o filtro por arma, o custo, os acúmulos e a soma dos bônus escolhidos.
 */

/** Etiquetas da arma: all, melee|ranged e, quando existirem, fire, shoot, throw. */
export function weaponTags(system = {}) {
	const tags = new Set(["all"]);
	const range = system.types?.rangeType?.name;
	const sub = system.types?.rangeType?.subRangeType;
	if (range === "melee" || range === "ranged") tags.add(range);
	if (sub) tags.add(sub); // fire, shoot, throw
	if (system.conditions?.throwable) tags.add("throw");
	return tags;
}

/** A opção vale para esta arma? `applies` vazio equivale a "all". */
export function appliesTo(applies, tags) {
	const wanted = String(applies || "all");
	return wanted === "all" || tags.has(wanted);
}

/**
 * A opção vale para esta arma? Além de `applies` (tipo de arma), a opção pode exigir `proficiency` (ex.: "tacticalWeapons"),
 * `ammo` (tipo de munição, ex.: "longBullets") e recusar uma etiqueta em `exclude` (ex.: "fire").
 */
export function weaponMatches(onUse, system = {}) {
	const tags = weaponTags(system);
	if (!appliesTo(onUse.applies, tags)) return false;
	if (onUse.exclude && tags.has(onUse.exclude)) return false;
	if (onUse.proficiency && system.proficiency !== onUse.proficiency) return false;
	if (onUse.ammo && system.types?.ammunitionType !== onUse.ammo) return false;
	return true;
}

/**
 * Valores da opção que dependem do personagem: `byLevel` ([[nível, "2d6"], …]) escolhe o bônus de dano da faixa alcançada
 * (Ataque Furtivo: 1d6 → 4d6) e `doubleUnit` dobra o valor de cada acúmulo (Potência Máxima, NEX 99%, no Ataque Especial corpo a corpo).
 */
export function scaleOnUse(onUse, { nivel = 1, doubleUnit = false } = {}) {
	const out = { ...onUse };
	if (Array.isArray(onUse.byLevel) && onUse.byLevel.length) {
		const reached = onUse.byLevel.filter(([level]) => Number(nivel) >= Number(level));
		out.damageBonus = reached.length ? reached[reached.length - 1][1] : "";
	}
	if (doubleUnit && onUse.pool) out.unit = (Number(onUse.unit) || 5) * 2;
	return out;
}

/** Custo em PE de usar a opção `count` vezes: o primeiro uso custa `cost`, cada seguinte `stepCost` (padrão = cost). */
export function optionCost(onUse, count) {
	const n = Math.max(0, Math.trunc(Number(count)) || 0);
	if (!n) return 0;
	const first = Number(onUse.cost) || 0;
	const step = onUse.stepCost === undefined || onUse.stepCost === null || onUse.stepCost === "" ? first : Number(onUse.stepCost) || 0;
	return first + (n - 1) * step;
}

/** Quantos acúmulos o nível permite no Ataque Especial: 1 → 2 → 3 → 4 em 5%, 25%, 55% e 85% (níveis 1, 5, 11, 17). */
export function specialAttackMax(nivel) {
	const n = Number(nivel) || 1;
	return 1 + (n >= 5 ? 1 : 0) + (n >= 11 ? 1 : 0) + (n >= 17 ? 1 : 0);
}

/**
 * Teto de acúmulos de uma opção com acúmulos: o menor entre o limite da habilidade (`abilityMax`, no Ataque Especial pelo nível)
 * e o que cabe no limite de PE por turno (`perTurn`, o gasto total da opção não passa dele), garantido ao menos 1 acúmulo.
 * @returns {{ max: number, abilityMax: number, limit: "ability"|"turn" }} limit = o que está barrando o próximo acúmulo.
 */
export function poolCap(onUse, abilityMax, perTurn) {
	const ability = Math.max(0, Math.trunc(Number(abilityMax)) || 0);
	const turn = Number(perTurn);
	let max = ability;
	// o primeiro acúmulo é sempre permitido: o custo e o limite da própria habilidade valem sobre o limite geral (Ataque Especial custa 2 PE já em NEX 5%)
	if (Number.isFinite(turn) && turn > 0) while (max > 1 && optionCost(onUse, max) > turn) max--;
	return { max, abilityMax: ability, limit: max < ability ? "turn" : "ability" };
}

/**
 * Estado dos dois selects (ataque e dano) de uma opção com acúmulos que dividem o mesmo teto `max`.
 * @returns {{ total: number, atMax: boolean, attackRoom: number, damageRoom: number, flag: null|{key:string, max:number} }}
 * attackRoom/damageRoom = até quantos acúmulos cada select ainda pode ir; flag = aviso de teto atingido.
 */
export function poolState({ max, limit, attack = 0, damage = 0 }) {
	const cap = Math.max(0, Math.trunc(Number(max)) || 0);
	const a = Math.max(0, Math.trunc(Number(attack)) || 0);
	const d = Math.max(0, Math.trunc(Number(damage)) || 0);
	const total = Math.min(a + d, cap);
	const atMax = total >= cap;
	return {
		total,
		atMax,
		attackRoom: Math.max(0, cap - d),
		damageRoom: Math.max(0, cap - a),
		flag: atMax ? { key: limit === "turn" ? "turn" : "ability", max: cap } : null,
	};
}

/** Valores do select de um bônus em acúmulos: 0, +5, +10… até `room` acúmulos (os acima ficam fora). */
export function poolChoices(unit, room) {
	const step = Number(unit) || 5;
	return Array.from({ length: Math.max(0, Math.trunc(room)) + 1 }, (_, n) => ({ stacks: n, bonus: n * step, label: n ? `+${n * step}` : "—" }));
}

/**
 * Lê um bônus escrito pelo jogador: "+2", "-3", "1d4", "+1d6" ou "-1d" (dados de d20 no ataque).
 * @returns {{ flat: number, dice: string[], d20: number }} flat = parte numérica; dice = termos "NdX" com sinal; d20 = dados de d20 (só ataque).
 */
export function parseBonus(text, { allowD20 = false } = {}) {
	const out = { flat: 0, dice: [], d20: 0 };
	const clean = String(text ?? "").replace(/\s+/g, "").replace(/−|–/g, "-");
	if (!clean) return out;
	for (const m of clean.matchAll(/([+-]?)(\d*)(d(\d*))?/g)) {
		if (!m[0]) continue;
		const sign = m[1] === "-" ? -1 : 1;
		const qty = m[2] === "" ? (m[3] ? 1 : 0) : Number(m[2]);
		if (!qty) continue;
		if (!m[3]) out.flat += sign * qty;
		else if (!m[4]) {
			if (allowD20) out.d20 += sign * qty;
		} else out.dice.push(`${sign < 0 ? "-" : "+"}${qty}d${m[4]}`);
	}
	return out;
}

/**
 * Soma o que o jogador escolheu.
 * @param {Array<{id:string,label:string,onUse:object,auto:boolean,max:number}>} options
 * @param {{counts?:Object<string,number|{attack:number,damage:number}>, freeAttack?:string, freeDamage?:string}} selection
 * @returns {{attackDice:number, attackFlat:number, attackTerms:string[], damageFlat:number, damageTerms:string[], damageDice:number, cost:number, lines:string[], used:Array}}
 */
export function combineSelection(options, selection = {}) {
	const result = { attackDice: 0, attackFlat: 0, attackTerms: [], damageFlat: 0, damageTerms: [], damageDice: 0, critMargin: 0, damageAttrs: [], cost: 0, lines: [], used: [] };
	const add = (opt, times, split) => {
		const u = opt.onUse;
		if (u.pool) {
			const unit = Number(u.unit) || 5;
			const a = split?.attack ?? 0;
			const d = split?.damage ?? 0;
			result.attackFlat += unit * a;
			result.damageFlat += unit * d;
			return;
		}
		result.attackDice += (Number(u.attackDice) || 0) * times;
		result.attackFlat += (Number(u.attackBonus) || 0) * times;
		result.damageDice += (Number(u.damageDice) || 0) * times;
		result.critMargin += (Number(u.critMargin) || 0) * times;
		if (u.damageAttr) for (let i = 0; i < times; i++) result.damageAttrs.push(u.damageAttr);
		const dmg = u.damageBonus;
		if (dmg !== undefined && dmg !== null && dmg !== "" && dmg !== 0) {
			const parsed = parseBonus(String(dmg));
			result.damageFlat += parsed.flat * times;
			for (let i = 0; i < times; i++) result.damageTerms.push(...parsed.dice);
		}
	};
	for (const opt of options) {
		const u = opt.onUse;
		let times = 0;
		let split = null;
		if (opt.auto) times = 1;
		else if (u.pool) {
			const raw = selection.counts?.[opt.id] ?? {};
			const room = opt.max ?? Infinity;
			const a = Math.max(0, Math.trunc(Number(raw.attack) || 0));
			const d = Math.max(0, Math.trunc(Number(raw.damage) || 0));
			// nunca passa do limite do nível: o excesso é cortado do dano e depois do ataque
			const total = Math.min(a + d, room);
			const keepA = Math.min(a, total);
			split = { attack: keepA, damage: total - keepA };
			times = total;
			if (times) result.cost += optionCost(u, times);
		} else {
			const raw = selection.counts?.[opt.id];
			const n = typeof raw === "number" ? raw : raw ? 1 : 0;
			times = Math.max(0, Math.min(Math.trunc(n) || 0, opt.max ?? 1));
			if (times) result.cost += optionCost(u, times);
		}
		if (!times) continue;
		add(opt, times, split);
		result.used.push({ id: opt.id, label: opt.label, times, ...(split ? { split } : {}) });
		result.lines.push(times > 1 || u.pool ? `${opt.label} ×${times}` : opt.label);
	}
	const fa = parseBonus(selection.freeAttack, { allowD20: true });
	result.attackDice += fa.d20;
	result.attackFlat += fa.flat;
	result.attackTerms.push(...fa.dice);
	const fd = parseBonus(selection.freeDamage);
	result.damageFlat += fd.flat;
	result.damageTerms.push(...fd.dice);
	if (selection.freeAttack?.trim()) result.lines.push(`ataque ${selection.freeAttack.trim()}`);
	if (selection.freeDamage?.trim()) result.lines.push(`dano ${selection.freeDamage.trim()}`);
	return result;
}

/** Fórmula do dano com os bônus escolhidos: dados extras antes do crítico, depois bônus. */
export function damageFormulaParts(baseFormula, { critMultiplier = 1, extraDice = 0, explode = false } = {}) {
	const [count, faces] = String(baseFormula).split("d");
	if (faces === undefined) return [String(baseFormula)];
	const total = (Number(count) || 0) + (Number(extraDice) || 0);
	return [`${total * (critMultiplier || 1)}d${faces}${explode ? "x" : ""}`]; // "x": cada resultado máximo rola outro dado (Motosserra)
}
