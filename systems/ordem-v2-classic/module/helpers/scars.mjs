/**
 * Cicatrizes Psicológicas no modo "Jogando sem Sanidade" (Sobrevivendo ao Horror, p. 104–105): sem Sanidade o poder não dá
 * +1 SAN por 5% de NEX; em vez disso concede um dado adicional em Vontade contra efeitos de medo (Presença Perturbadora e
 * dano mental de criaturas de Medo). Regras puras, sem Foundry.
 */
import { passiveKey } from "./passive-effects-rules.mjs";

export const SCARS_KEY = "cicatrizes psicologicas";

/** A ficha tem o poder? `names` = nomes dos poderes. */
export const hasScars = (names = []) => names.some((n) => passiveKey(n) === SCARS_KEY);

/** O teste oferece a opção "contra efeito de medo" (+1 dado)? Só Vontade, só no modo sem Sanidade, só com o poder. */
export function fearDieAvailable({ withoutSanity = false, names = [], skill } = {}) {
	return Boolean(withoutSanity) && skill === "will" && hasScars(names);
}

/** Dados a mais no teste (0 ou 1): o jogador marcou que o efeito é de medo e a opção está disponível. */
export function fearDieBonus({ marked = false, ...rest } = {}) {
	return marked && fearDieAvailable(rest) ? 1 : 0;
}
