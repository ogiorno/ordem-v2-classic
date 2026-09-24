/**
 * Cálculos puros da ficha de ameaça (sem dependência do Foundry — testáveis em Node).
 * Regras: Livro de Regras de Ordem Paranormal, Cap. 7 (Ameaças).
 */

/** Tabela 7.1 — tamanho de seres. `stealth`/`maneuvers` são os modificadores; `space` em metros. */
export const SIZE_INFO = Object.freeze({
	tiny: { stealth: 5, maneuvers: -5, space: 1.5 },
	small: { stealth: 2, maneuvers: -2, space: 1.5 },
	medium: { stealth: 0, maneuvers: 0, space: 1.5 },
	large: { stealth: -2, maneuvers: 2, space: 3 },
	huge: { stealth: -5, maneuvers: 5, space: 4.5 },
	colossal: { stealth: -10, maneuvers: 10, space: 9 },
});

/**
 * @param {string} size  Chave de tamanho (tiny…colossal). Desconhecido/vazio vira "medium".
 * @returns {{stealth:number, maneuvers:number, space:number}}
 */
export function sizeInfo(size) {
	return SIZE_INFO[size] ?? SIZE_INFO.medium;
}

const int = (n, fallback = 0) => (Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : fallback);

/**
 * Notação do livro: `3O+10` = 3d20 (maior resultado) + 10. `O` = 1d20 sem bônus.
 * @param {number} dice   Quantidade de d20 (< 1 é tratado como 1 na notação).
 * @param {number} bonus  Bônus fixo.
 * @returns {string}
 */
export function formatTest(dice, bonus = 0) {
	const d = Math.max(1, int(dice, 1));
	const b = int(bonus);
	const head = d === 1 ? "O" : `${d}O`;
	if (b === 0) return head;
	return b > 0 ? `${head}+${b}` : `${head}${b}`;
}

/**
 * Fórmula Foundry de um teste. Mantém a regra do sistema: atributo 0 (ou menos) rola 2d20 e fica com o pior.
 * @param {number} dice
 * @param {number} bonus
 * @returns {string}
 */
export function testFormula(dice, bonus = 0) {
	const d = int(dice);
	const b = int(bonus);
	const base = d < 1 ? "2d20kl" : `${d}d20kh`;
	if (b === 0) return base;
	return b > 0 ? `${base} + ${b}` : `${base} - ${Math.abs(b)}`;
}

/** Metade dos PV (arredondada para baixo): o "machucado" do livro. */
export function bruisedThreshold(maxHp) {
	return Math.floor(Math.max(0, int(maxHp)) / 2);
}

/** @returns {boolean} true se os PV atuais estão na metade ou menos (e > 0). */
export function isBruised(hp, maxHp) {
	const v = int(hp);
	return v > 0 && v <= bruisedThreshold(maxHp);
}

/** Quadrados de 1,5m a partir de metros. */
export function squaresFromMeters(meters) {
	const m = Number(meters);
	if (!Number.isFinite(m) || m <= 0) return 0;
	return Math.round(m / 1.5);
}

/** Texto "9m | 6" do livro. */
export function movementLabel(meters) {
	const m = Number(meters);
	const shown = Number.isFinite(m) ? Math.round(m * 10) / 10 : 0;
	return `${shown}m | ${squaresFromMeters(m)}`;
}

/**
 * Calcula o dano final contra uma ameaça.
 * Ordem: imunidade → vulnerabilidade (dobra) → RD (tipada ou geral com exceção; vale a maior).
 *
 * @param {number} amount
 * @param {string|undefined} damageType      Chave do tipo (ex.: "deathDamage").
 * @param {object} [defs]
 * @param {Record<string,{value?:number, vulnerable?:boolean, immune?:boolean}>} [defs.resistances]
 * @param {{value?:number, except?:string[]}} [defs.genericRd]  "RD N/tipo": vale para todo tipo fora de `except`.
 * @param {number} [defs.extraRd=0]
 * @param {boolean} [defs.ignoreRd=false]
 * @returns {{finalDamage:number, blocked:number, rd:number, multiplier:number, immune:boolean}}
 */
export function resolveDamage(amount, damageType, { resistances = {}, genericRd = null, extraRd = 0, ignoreRd = false } = {}) {
	const raw = Math.max(0, int(amount));
	const entry = (damageType && resistances?.[damageType]) || {};

	if (entry.immune === true) {
		return { finalDamage: 0, blocked: raw, rd: 0, multiplier: 0, immune: true };
	}

	const multiplier = entry.vulnerable === true ? 2 : 1;
	const scaled = raw * multiplier;

	let rd = 0;
	if (!ignoreRd) {
		const typed = Math.max(0, int(entry.value));
		const except = Array.isArray(genericRd?.except) ? genericRd.except : [];
		const generic = damageType && except.includes(damageType) ? 0 : Math.max(0, int(genericRd?.value));
		rd = Math.max(typed, generic);
	}
	rd += Math.max(0, int(extraRd));

	const finalDamage = Math.max(0, scaled - rd);
	return { finalDamage, blocked: scaled - finalDamage, rd, multiplier, immune: false };
}

/**
 * Cura Acelerada: PV recuperados no início do turno.
 * Não cura se o último dano recebido foi de um tipo listado em `except` (ex.: "Cura Acelerada 10/químico").
 *
 * @param {{value?:number, except?:string[]}} fastHealing
 * @param {string|null} [lastDamageType]
 * @param {number} hp
 * @param {number} maxHp
 * @returns {number} quantidade efetivamente recuperada (nunca passa do máximo).
 */
export function fastHealingAmount(fastHealing, lastDamageType = null, hp = 0, maxHp = 0) {
	const value = Math.max(0, int(fastHealing?.value));
	if (value === 0) return 0;
	const except = Array.isArray(fastHealing?.except) ? fastHealing.except : [];
	if (lastDamageType && except.includes(lastDamageType)) return 0;
	return Math.max(0, Math.min(value, int(maxHp) - int(hp)));
}

/**
 * Presença Perturbadora com várias criaturas: usa a de maior VD, +1d6 de dano mental por criatura adicional.
 * @param {string} baseFormula  Ex.: "3d6".
 * @param {number} extraCreatures  Criaturas além da de maior VD.
 * @returns {string}
 */
export function groupPresenceFormula(baseFormula, extraCreatures = 0) {
	const base = String(baseFormula ?? "").trim();
	const extra = Math.max(0, int(extraCreatures));
	if (!base) return extra > 0 ? `${extra}d6` : "";
	return extra > 0 ? `${base} + ${extra}d6` : base;
}

/**
 * Converte o modelo antigo de resistências (`resistances.<tipo>.vulnerable/immune`) em listas legíveis.
 * @param {Record<string,{value?:number, vulnerable?:boolean, immune?:boolean}>} resistances
 * @returns {{rd:{type:string,value:number}[], vulnerable:string[], immune:string[]}}
 */
export function summarizeResistances(resistances = {}) {
	const rd = [];
	const vulnerable = [];
	const immune = [];
	for (const [type, r] of Object.entries(resistances ?? {})) {
		if (!r) continue;
		if (int(r.value) > 0) rd.push({ type, value: int(r.value) });
		if (r.vulnerable === true) vulnerable.push(type);
		if (r.immune === true) immune.push(type);
	}
	return { rd, vulnerable, immune };
}

/**
 * Corrige perícias de ameaças antigas cujo atributo ficou no padrão errado ["dex"].
 * Só mexe em quem tem exatamente ["dex"] e cujo padrão do livro é outro; não toca em escolhas explícitas.
 * @param {Record<string,{attr?:string[]}>} skills   Muda no lugar.
 * @param {Record<string,string>} defaults           Atributo padrão de cada perícia.
 * @returns {string[]} chaves corrigidas
 */
export function fixLegacySkillAttrs(skills, defaults) {
	const fixed = [];
	for (const [key, skill] of Object.entries(skills ?? {})) {
		const want = defaults?.[key];
		const attr = skill?.attr;
		if (!want || want === "dex" || !Array.isArray(attr)) continue;
		if (attr.length === 1 && attr[0] === "dex") {
			skill.attr = [want];
			fixed.push(key);
		}
	}
	return fixed;
}

/**
 * Mesmo teste de `formatTest`, mas com o ícone de d20 no lugar do "O" (como no livro; "O" parece zero na tela).
 * Só gera números e um <i> fixo, então é seguro usar com {{{ }}}.
 * @param {number} dice
 * @param {number} bonus
 * @returns {string}
 */
export function formatTestHtml(dice, bonus = 0) {
	const d = Math.max(1, int(dice, 1));
	const b = int(bonus);
	const icon = '<i class="fa-solid fa-dice-d20 sb-d20" aria-label="d20"></i>';
	const head = d === 1 ? icon : `${d}${icon}`;
	if (b === 0) return head;
	return b > 0 ? `${head}+${b}` : `${head}${b}`;
}
