/**
 * Regras puras da tela de recompensa de Nível (sem dependências do Foundry — testável em Node).
 *
 * Nível N equivale a NEX N×5% (nível 20 = NEX 99%). As tabelas 1.3 a 1.5 do Livro de Regras dizem o que cada
 * classe recebe em cada NEX; aqui elas viram "o que o personagem ganhou ao chegar neste nível".
 */
import { normalizeName } from "./level-progression-rules.mjs";

const RESOURCE_KEYS = ["PV", "PE", "PD", "SAN"];

/** Níveis (NEX 10/40/65/99) em que a classe recebe uma habilidade de trilha. */
const PATH_LEVELS = [2, 8, 13, 20];
/** Níveis (NEX 15/30/45/60/75/90) em que a classe recebe um poder de classe. */
const POWER_LEVELS = [3, 6, 9, 12, 15, 18];
/** Níveis (NEX 20/50/80/95) de Aumento de Atributo. */
const ATTRIBUTE_LEVELS = [4, 10, 16, 19];
/** Níveis (NEX 35/70) de Grau de Treinamento. */
const TRAINING_LEVELS = [7, 14];
/** Nível (NEX 50) de Versatilidade. */
const VERSATILITY_LEVEL = 10;

/** Habilidade especial de cada classe que escala por faixas de NEX 5/25/55/85 (níveis 1/5/11/17). */
const TIER_LEVELS = [1, 5, 11, 17];

const CLASS_KEYS = { combatente: "combatente", especialista: "especialista", ocultista: "ocultista" };

/** Chave da classe a partir do nome do item de classe (null se não for uma das três do livro). */
export function classKey(className) {
	return CLASS_KEYS[normalizeName(className)] ?? null;
}

/**
 * Habilidades e escolhas que a classe recebe ao alcançar exatamente este nível.
 * @param {string} className nome do item de classe
 * @param {number} level 1–20
 * @returns {{id: string, params?: object, choice?: boolean}[]} `choice` = o jogador ainda precisa escolher algo
 */
export function levelFeatures(className, level, { possessed = false } = {}) {
	const key = classKey(className);
	const features = [];
	if (!key) return features;
	const tier = TIER_LEVELS.indexOf(level);

	if (key === "combatente" && tier >= 0) {
		features.push({ id: "specialAttack", params: { pe: tier + 2, bonus: (tier + 1) * 5 } });
	}
	if (key === "especialista") {
		if (level === 1) features.push({ id: "eclectic" });
		if (tier >= 0) features.push({ id: "expert", params: { pe: tier + 2, die: ["1d6", "1d8", "1d10", "1d12"][tier] } });
		if (level === 8) features.push({ id: "ingenuity", params: { degree: "veterano" } });
		if (level === 15) features.push({ id: "ingenuity", params: { degree: "expert" } });
	}
	if (key === "ocultista" && tier >= 0) {
		features.push({ id: "chosenByOtherSide", params: { circle: tier + 1 } });
	}

	if (PATH_LEVELS.includes(level)) features.push({ id: "pathAbility" });
	// Possuído (Sobrevivendo ao Horror): o poder de ocultista vira o poder Transcender, que soma 2 PP.
	if (POWER_LEVELS.includes(level)) features.push({ id: possessed && key === "ocultista" ? "transcender" : `${key}Power`, choice: true });
	if (ATTRIBUTE_LEVELS.includes(level)) features.push({ id: "attributeIncrease", choice: true });
	if (TRAINING_LEVELS.includes(level)) features.push({ id: "trainingDegree", choice: true });
	if (level === VERSATILITY_LEVEL) features.push({ id: "versatility", choice: true });
	return features;
}

/**
 * O que a classe ganhou ao ir de `from` para `to` (somente subindo), agrupado por nível.
 * @returns {{level: number, features: object[]}[]}
 */
export function featuresBetween(className, from, to, options) {
	const result = [];
	for (let level = from + 1; level <= to; level++) {
		const features = levelFeatures(className, level, options);
		if (features.length) result.push({ level, features });
	}
	return result;
}

/**
 * Ganho de cada recurso (apenas os que subiram).
 * @param {Record<string, number>} before máximos antes
 * @param {Record<string, number>} after  máximos depois
 * @returns {{key: string, before: number, after: number, gain: number}[]}
 */
export function resourceGains(before = {}, after = {}) {
	return RESOURCE_KEYS.map((key) => {
		const b = Number(before[key]) || 0;
		const a = Number(after[key]) || 0;
		return { key, before: b, after: a, gain: a - b };
	}).filter((r) => r.gain > 0);
}

/** O nível subiu de verdade? (descer de nível ou salvar o mesmo valor não gera tela.) */
export function isLevelUp(from, to) {
	return Number.isFinite(from) && Number.isFinite(to) && to > from;
}

/**
 * Quem vê a tela: o jogador dono do personagem. O Mestre só a vê quando ele mesmo subiu o nível e nenhum
 * jogador dono está conectado para receber (assim o Mestre não é interrompido a cada evolução da mesa).
 * @param {{isGM: boolean, isOwner: boolean, isUpdater: boolean, activePlayerOwners: number}} ctx
 */
export function shouldShowLevelUp({ isGM, isOwner, isUpdater, activePlayerOwners }) {
	if (!isOwner) return false;
	if (!isGM) return true;
	return isUpdater && activePlayerOwners === 0;
}

/** A trilha é a "Possuído" do Sobrevivendo ao Horror (a que dá pontos de possessão, PP)? */
export function isPossessedPath(pathName) {
	return normalizeName(pathName).includes("possuido");
}

/**
 * Total de PP do Possuído no nível dado: nada antes do NEX 10% (nível 2); depois 3, mais 2 por poder
 * Transcender. Como o poder de ocultista vira Transcender, cada nível de poder após o 2 soma 2 PP.
 */
export function possessionPointsAt(level) {
	if (level < 2) return 0;
	return 3 + 2 * POWER_LEVELS.filter((l) => l <= level).length;
}

/** Ganho de PP ao ir de `from` para `to` (null se não houve ganho). */
export function possessionGain(from, to) {
	const before = possessionPointsAt(from);
	const after = possessionPointsAt(to);
	return after > before ? { key: "PP", before, after, gain: after - before } : null;
}

/**
 * Jogando sem Sanidade (regra do livro novo), a tela não mostra SAN e o custo das habilidades é em PD, não PE.
 * @param {{key: string}[]} gains ganhos já calculados
 * @param {boolean} withoutSanity
 */
export function visibleGains(gains, withoutSanity) {
	return withoutSanity ? gains.filter((g) => g.key !== "SAN" && g.key !== "PE") : gains.filter((g) => g.key !== "PD");
}

/** Unidade de custo das habilidades: PD sem Sanidade, PE com ela. */
export function costUnit(withoutSanity) {
	return withoutSanity ? "PD" : "PE";
}
