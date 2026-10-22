/**
 * Textos de jogador para fórmulas de dados (puro, testável em Node).
 * "3d20kh + 5" -> "3 dados, vale o maior + 5".
 */

const POOL = /^\s*(\d+)d20(kh|kl)?(?![\w])(.*)$/i;

/**
 * @param {string} formula
 * @returns {string} descrição amigável, ou a própria fórmula quando não é um teste de d20 conhecido.
 */
export function describeD20Pool(formula) {
	const text = String(formula ?? "");
	const match = POOL.exec(text);
	if (!match) return text;
	const count = Number(match[1]);
	const mode = (match[2] ?? "").toLowerCase();
	const rest = match[3].trim();
	const noun = count === 1 ? "1 dado" : `${count} dados`;
	let label = noun;
	if (count > 1 && mode === "kh") label = `${noun}, vale o maior`;
	else if (count > 1 && mode === "kl") label = `${noun}, vale o menor`;
	return rest ? `${label} ${rest}` : label;
}
