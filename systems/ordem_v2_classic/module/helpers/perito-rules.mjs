/**
 * Regras puras do Perito (Especialista, Tabela 1.4; sem Foundry — testável em Node).
 *
 * Mesma progressão do Ataque Especial: o custo e o bônus crescem em NEX 5%, 25%, 55% e 85% (níveis 1, 5, 11, 17).
 * Perito: 2 PE → +1d6, 3 PE → +1d8, 4 PE → +1d10, 5 PE → +1d12 num teste de perícia.
 */

export const PERITO_TIER_LEVELS = Object.freeze([1, 5, 11, 17]);
export const PERITO_DICE = Object.freeze(["1d6", "1d8", "1d10", "1d12"]);
/** Perícias que o Perito nunca pode escolher. */
export const PERITO_EXCLUDED = Object.freeze(["fighting", "aim"]);

/** Faixa (0–3) do Perito no nível dado. */
export function peritoTier(nivel) {
	const n = Number(nivel) || 1;
	return Math.max(0, PERITO_TIER_LEVELS.filter((level) => n >= level).length - 1);
}

/** Custo em PE e dado de bônus no nível dado. */
export function peritoOption(nivel) {
	const tier = peritoTier(nivel);
	return { tier, pe: tier + 2, die: PERITO_DICE[tier] };
}

/**
 * A perícia aceita o Perito? Precisa ser treinada, não ser Luta nem Pontaria e, se a ficha registrou as duas
 * perícias escolhidas (`chosen`), estar entre elas. Sem escolha registrada, vale para qualquer perícia treinada.
 */
export function peritoSkillAllowed(skill, { degree = 0, chosen = [] } = {}) {
	if (!skill || PERITO_EXCLUDED.includes(skill)) return false;
	if (!(Number(degree) > 0)) return false;
	return !Array.isArray(chosen) || chosen.length === 0 || chosen.includes(skill);
}

/**
 * O que a janela do teste mostra e cobra.
 * @returns {{ available: boolean, pe: number, die: string, tier: number, canPay: boolean, missing: number }}
 * `available` = há opção para esta perícia; `canPay` = o saldo cobre o custo (o limite de PE por turno não bloqueia:
 * sempre dá para usar uma habilidade pelo custo da própria faixa, como no Ataque Especial).
 */
export function peritoPlan({ nivel, skill, degree, chosen, balance = 0 } = {}) {
	const option = peritoOption(nivel);
	const available = peritoSkillAllowed(skill, { degree, chosen });
	const have = Number(balance) || 0;
	return { available, ...option, canPay: have >= option.pe, missing: Math.max(0, option.pe - have) };
}
