/**
 * Regras puras de ferimentos e morte do agente (sem Foundry — testável em Node). Ver docs/arquivo/spec-morte-do-jogador.md.
 * Livro v1.3, "Ferimentos & Morte": Morrendo, Dano Massivo, Dano Não Letal; Medicina, "Primeiros Socorros".
 */

/** Turnos iniciados morrendo, na mesma cena, para morrer de vez. */
export const DYING_TURN_LIMIT = 3;
/** DT do teste de Medicina que encerra Morrendo (e DT-base de Primeiros Socorros). */
export const STABILIZE_BASE_DT = 20;
/** Aumento da DT para cada vez que o personagem já foi estabilizado na cena. */
export const STABILIZE_DT_STEP = 5;
/** PV de quem é estabilizado. */
export const STABILIZED_PV = 1;

/** DT de Medicina para estabilizar, dado quantas vezes ele já foi estabilizado na cena. */
export function stabilizeDT(timesStabilized = 0) {
	return STABILIZE_BASE_DT + STABILIZE_DT_STEP * Math.max(0, Math.floor(Number(timesStabilized) || 0));
}

/** DT do Fortitude do Dano Massivo: 15 + 2 para cada 10 pontos de dano sofridos. */
export function massiveDamageDT(damage) {
	return 15 + 2 * Math.floor(Math.max(0, Number(damage) || 0) / 10);
}

/** Dano de uma só vez ≥ metade dos PV totais sem zerar os PV → pede teste de Fortitude. */
export function triggersMassiveDamage({ damage, maxPV, newPV }) {
	const dmg = Number(damage) || 0;
	const max = Number(maxPV) || 0;
	return dmg > 0 && max > 0 && Number(newPV) > 0 && dmg * 2 >= max;
}

/**
 * Condições de queda: PV em 0 = inconsciente + morrendo. O dano não letal soma ao letal só para ficar
 * inconsciente (não para morrendo).
 */
export function downedState({ pv, nonLethal = 0 }) {
	const hp = Number(pv) || 0;
	const dying = hp <= 0;
	const unconscious = dying || hp - Math.max(0, Number(nonLethal) || 0) <= 0;
	return { dying, unconscious };
}

/** Ao iniciar o turno morrendo: `count` é o número de turnos iniciados morrendo, já contando este. */
export function dyingTurnOutcome(count) {
	return Number(count) >= DYING_TURN_LIMIT ? "dead" : "dying";
}

/**
 * Dois tokens estão adjacentes (quadrados encostando, inclusive na diagonal)? Retângulos `{ x, y, width, height }` em pixels.
 * `tolerance` absorve arredondamento de posição.
 */
export function tokensAdjacent(a, b, tolerance = 2) {
	const gapX = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
	const gapY = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
	return gapX <= tolerance && gapY <= tolerance;
}

/** Ameaça (monstro) com 0 PV ou menos morre na hora; sem PV máximo definido não morre sozinha. */
export function threatShouldDie({ hp, max }) {
	if (hp === undefined || hp === null || hp === "") return false;
	return Number(max) > 0 && Number(hp) <= 0;
}
