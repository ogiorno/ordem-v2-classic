/**
 * Regras puras da progressão por Nível (sem dependências do Foundry — testável em Node).
 *
 * Nível 1 equivale a NEX 5%, nível 20 a NEX 99%. As habilidades de trilha
 * ("NEX 10% - ...", "NEX 40% - ...") são liberadas no nível equivalente
 * (2, 8, 13 e 20).
 */

/** Poderes de origem cujo nome não aparece na descrição da origem. */
export const ORIGIN_POWER_ALIASES = {
	engenheiro: "Ferramentas Favoritas",
	operario: "Ferramentas de Trabalho",
};

/** Remove acentos/pontuação e põe em minúsculas, para comparar nomes. */
export function normalizeName(text) {
	return String(text ?? "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

/** @param {number} nex 0–99 @returns {number} nível 1–20 */
export function nexToLevel(nex) {
	const value = Number(nex) || 0;
	if (value >= 99) return 20;
	return Math.max(1, Math.floor(value / 5));
}

/**
 * Nível (ou estágio, para o Sobrevivente) em que uma habilidade de trilha é liberada:
 * "NEX 40% - Nome" → nível 8; "Estágio 2 - Nome" → estágio 2. Null se o nome não indicar.
 */
export function abilityUnlockLevel(name) {
	const text = String(name ?? "");
	const nex = /nex\s*(\d+)\s*%/i.exec(text);
	if (nex) return nexToLevel(Number(nex[1]));
	const stage = /est[aá]gio\s*(\d+)/i.exec(text);
	return stage ? Number(stage[1]) : null;
}

/** Habilidades de classe do Sobrevivente e o estágio em que cada uma chega (Tabela 1.2 do suplemento). */
export const SURVIVOR_CLASS_ABILITIES = { empenho: 1, aumentodeatributo: 3, cicatrizado: 5 };

/** Estágio de uma habilidade de classe do Sobrevivente (null se o nome não for uma delas). */
export function survivorClassStage(name) {
	return SURVIVOR_CLASS_ABILITIES[normalizeName(name)] ?? null;
}

/**
 * A pasta de habilidades pertence a esta trilha? Aceita o nome da própria pasta ("Caçador") ou o nome
 * composto com a pasta-mãe ("Monstruoso" + "Sangue" = trilha "Monstruoso - Sangue").
 * @param {string[]} chain  nomes das pastas da raiz até a pasta da habilidade
 * @param {string} pathName nome do item de trilha do personagem
 */
export function folderMatchesPath(chain, pathName) {
	const wanted = normalizeName(pathName);
	if (!chain.length || !wanted) return false;
	const leaf = normalizeName(chain[chain.length - 1]);
	if (leaf === wanted) return true;
	const parent = chain.length > 1 ? normalizeName(chain[chain.length - 2]) : "";
	return Boolean(parent) && parent + leaf === wanted;
}

/** Texto puro de um HTML de descrição. */
export function stripHtml(html) {
	return String(html ?? "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&([a-zA-Z])(?:acute|grave|circ|tilde|cedil|uml);/g, "$1");
}

/**
 * Descobre qual poder de origem pertence a uma origem.
 * @param {string} originName
 * @param {string} originDescription  HTML da descrição da origem
 * @param {string[]} powerNames        nomes dos poderes disponíveis
 * @returns {string|null}
 */
export function findOriginPower(originName, originDescription, powerNames) {
	const alias = ORIGIN_POWER_ALIASES[normalizeName(originName)];
	if (alias) return powerNames.find((n) => normalizeName(n) === normalizeName(alias)) ?? null;
	const text = normalizeName(stripHtml(originDescription));
	return powerNames.find((n) => text.includes(normalizeName(n))) ?? null;
}
