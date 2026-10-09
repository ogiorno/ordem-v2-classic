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

/** Veterano numa perícia = grau de treinamento 10 (Livro de Regras v1.3, cap. 2). */
export const VETERAN_DEGREE = 10;
export const isVeteran = (degree) => (Number(degree) || 0) >= VETERAN_DEGREE;

/** Armas que, pela regra do livro, podem ser empunhadas com uma mão por quem é veterano em Luta (ex.: Katana). */
const ADAPTABLE_BY_NAME = ["katana"];
const VETERAN_ONE_HAND = ["katana"];

/** Dano por empunhadura das armas que mudam de dado (Bastão e Espada: uma mão / duas mãos). */
const GRIP_DAMAGE = {
	bastao: { oneHand: "1d6", twoHands: "1d8" },
	espada: { oneHand: "1d8", twoHands: "1d10" },
};

/** Armas que exigem uma ação de movimento para recarregar a cada disparo. */
const RELOAD_WEAPONS = ["balestra", "besta", "bazuca"];

/** O ataque com essa arma e esse modo é um disparo que deixa a recarga pendente? */
export function consumesReload(name, mode = "normal") {
	return RELOAD_WEAPONS.includes(strip(name)) && (mode === "normal" || mode === "point");
}

export const isMelee = (system) => system?.types?.rangeType?.name === "melee";
export const isRanged = (system) => system?.types?.rangeType?.name === "ranged";

/**
 * Empunhaduras possíveis, na ordem em que aparecem na tela.
 * `locked` lista as que a ficha ainda não pode usar (Katana com uma mão exige veterano em Luta).
 */
export function gripChoices(system, name = "", { fightingDegree = 0 } = {}) {
	const base = system?.types?.gripType || "oneHand";
	const adaptable = Boolean(system?.conditions?.adaptableGrip) || ADAPTABLE_BY_NAME.includes(strip(name));
	if (!adaptable) return { base, adaptable: false, options: [base], locked: [] };
	const locked = VETERAN_ONE_HAND.includes(strip(name)) && !isVeteran(fightingDegree) ? ["oneHand"] : [];
	return { base: base === "light" ? "oneHand" : base, adaptable: true, options: ["twoHands", "oneHand"], locked };
}

/** Empunhadura que vale no ataque: a escolhida, se for permitida; senão a da arma. */
export function effectiveGrip(system, name, picked, ctx = {}) {
	const g = gripChoices(system, name, ctx);
	const grip = picked || g.base;
	return g.options.includes(grip) && !g.locked.includes(grip) ? grip : g.base;
}

/** Dado de dano que a empunhadura dá à arma (Bastão, Espada), ou null se não muda. */
export function gripDamage(name, grip) {
	return GRIP_DAMAGE[strip(name)]?.[grip] ?? null;
}

/** Modos de ataque que a arma permite (o primeiro é sempre o normal). */
export function weaponModes(system, name = "") {
	const modes = ["normal"];
	if (system?.conditions?.automatic && isRanged(system)) modes.push("burst");
	if (system?.conditions?.throwable || (isMelee(system) && !system?.conditions?.improvised)) modes.push("throw");
	if (strip(name) === "bazuca") modes.push("point");
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
	if (mode === "point") {
		// Bazuca num ponto qualquer em alcance médio: sem ataque, não erra, não atinge ninguém diretamente.
		return { ...out, noRoll: true, melee: false, squares: RANGE_SQUARES.medio, label: "Disparar num ponto" };
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

/**
 * Regras próprias de cada arma (Livro de Regras v1.3, cap. 3, "Descrição das armas").
 * Devolve o que a regra muda no ataque e no dano, o texto de cada uma (`notes`, sempre mostrado)
 * e as escolhas que só o jogador sabe responder (`choices`).
 * @param {object} ctx  mode, grip (escolhida), str (valor de Força), fightingDegree, aimDegree, distance (quadrados ou null),
 *                      picked: { tripod, aimed, far } (caixas marcadas na tela)
 * @returns {{ attackDice:number, attackFlat:number, critMargin:number, damageFormula:string|null, explode:boolean, halve:boolean, lines:string[], notes:{text:string,state:"good"|"bad"|"info"}[], choices:{id:string,label:string,checked:boolean}[] }}
 */
export function weaponRules(system, name = "", ctx = {}) {
	const { mode = "normal", str = 0, fightingDegree = 0, aimDegree = 0, distance = null, picked = {} } = ctx;
	const out = { attackDice: 0, attackFlat: 0, critMargin: 0, damageFormula: null, explode: false, halve: false, block: null, lines: [], notes: [], choices: [] };
	const key = strip(name);
	const shot = mode === "normal" || mode === "burst";

	// Empunhadura muda o dano (Bastão, Espada) e a Katana de uma mão exige veterano em Luta.
	if (mode === "normal" && gripChoices(system, name, { fightingDegree }).adaptable) {
		const grip = effectiveGrip(system, name, ctx.grip, { fightingDegree });
		const formula = gripDamage(name, grip);
		if (formula) {
			out.damageFormula = formula;
			out.notes.push({ state: "info", text: `${grip === "twoHands" ? "Duas mãos" : "Uma mão"}: dano ${formula}.` });
			if (ctx.grip && ctx.grip !== system?.types?.gripType) out.lines.push(`${grip === "twoHands" ? "duas mãos" : "uma mão"}: dano ${formula}`);
		}
		if (VETERAN_ONE_HAND.includes(key)) {
			const ok = isVeteran(fightingDegree);
			out.notes.push({ state: ok ? "good" : "bad", text: ok ? "Veterano em Luta: pode empunhar com uma mão." : "Uma mão exige veterano em Luta (grau 10); sem isso, só com as duas mãos." });
			if (ctx.grip === "oneHand" && !ok) out.lines.push("uma mão indisponível (exige veterano em Luta)");
		}
	}

	if (key === "motoserra" && mode === "normal") {
		out.attackDice = -1;
		out.explode = true;
		out.notes.push({ state: "bad", text: "Desajeitada: −1d20 em todos os testes de ataque." });
		out.notes.push({ state: "good", text: "Cada 6 num dado de dano rola um dado de dano adicional." });
		out.lines.push("Motosserra: −1d20 no ataque, dado extra a cada 6 no dano");
	}

	if (key === "metralhadora" && shot) {
		if (num(str) >= 4) out.notes.push({ state: "good", text: `Força ${num(str)}: empunha sem tripé, sem penalidade.` });
		else {
			const supported = Boolean(picked.tripod);
			out.choices.push({ id: "ruleTripod", label: "Apoiada no tripé (gastou uma ação de movimento)", checked: supported });
			out.notes.push({ state: supported ? "good" : "bad", text: supported ? "Apoiada no tripé: sem penalidade." : `Força ${num(str)} (precisa de 4) sem tripé: −5 no ataque.` });
			if (!supported) {
				out.attackFlat = -5;
				out.lines.push("Metralhadora sem Força 4 nem tripé: −5 no ataque");
			}
		}
	}

	if (key === "espingarda" || key === "espingarda de cano duplo") {
		if (shot) {
			const known = distance !== null && distance !== undefined;
			const far = known ? distance > RANGE_SQUARES.curto : Boolean(picked.far);
			if (!known) out.choices.push({ id: "ruleFar", label: "Alvo em alcance médio ou maior (mais de 9 m)", checked: far });
			out.halve = far;
			out.notes.push({ state: far ? "bad" : "info", text: far ? "Alvo em alcance médio ou maior: metade do dano." : "Alcance curto: dano inteiro (metade do dano em alcance médio ou maior)." });
			if (far) out.lines.push("alcance médio ou maior: metade do dano");
		}
	}

	if (key === "fuzil de precisao" && mode === "normal") {
		if (isVeteran(aimDegree)) {
			const aimed = Boolean(picked.aimed);
			out.choices.push({ id: "ruleAim", label: "Mirou (ação de movimento)", checked: aimed });
			if (aimed) {
				out.critMargin = 5;
				out.lines.push("Fuzil de Precisão mirando: +5 na margem de ameaça");
			}
			out.notes.push({ state: aimed ? "good" : "info", text: aimed ? "Veterano em Pontaria mirando: +5 na margem de ameaça." : "Veterano em Pontaria: mirando, +5 na margem de ameaça." });
		} else out.notes.push({ state: "info", text: "Veterano em Pontaria que mira recebe +5 na margem de ameaça (você ainda não é veterano)." });
	}

	if (key === "corrente" && mode === "normal") {
		const on = Boolean(picked.maneuver);
		out.choices.push({ id: "ruleManeuver", label: "Desarmar ou derrubar (+2)", checked: on });
		if (on) {
			out.attackFlat += 2;
			out.lines.push("Corrente: +2 para desarmar/derrubar");
		}
		out.notes.push({ state: on ? "good" : "info", text: on ? "Desarmar ou derrubar: +2 no teste." : "A corrente dá +2 em testes para desarmar e derrubar." });
	}

	if (consumesReload(name, mode) && ctx.reload?.pending) {
		const done = Boolean(picked.reloaded);
		out.choices.push({ id: "ruleReload", label: "Recarreguei (ação de movimento)", checked: done });
		if (!done) out.block = "Recarregue a arma (ação de movimento) antes de atacar de novo.";
		out.notes.push({ state: done ? "good" : "bad", text: done ? "Arma recarregada." : "Exige uma ação de movimento para recarregar a cada disparo." });
	}

	if (key === "cajado") out.notes.push({ state: "info", text: "Conta como arma de uma mão e uma arma leve para Combater com Duas Armas e poderes parecidos." });
	return out;
}

const num = (v) => Number(v) || 0;
