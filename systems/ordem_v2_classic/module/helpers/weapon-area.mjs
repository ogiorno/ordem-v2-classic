/**
 * Regras puras das armas de área (docs/spec-armas-area-recarga.md, seções 5 e 6): Bazuca (raio) e Lança-chamas (linha).
 * Posições em quadrados do mapa, sempre o centro do ser.
 */

const strip = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Bazuca: raio de 3 m = 2 quadrados. Lança-chamas: linha de 1 quadrado até o alcance curto (6 quadrados). */
export const BAZOOKA_RADIUS_SQUARES = 2;
export const FLAME_LENGTH_SQUARES = 6;
export const FLAME_WIDTH_SQUARES = 1;

/** "radius" (Bazuca), "line" (Lança-chamas) ou null. */
export function areaKind(name) {
	const key = strip(name);
	if (key === "bazuca") return "radius";
	if (key === "lanca-chamas" || key === "lanca chamas") return "line";
	return null;
}

const EPS = 1e-9;

/** Ids dos seres a até `radius` quadrados do centro (linha reta entre centros). */
export function radiusHits(center, beings, radius = BAZOOKA_RADIUS_SQUARES) {
	return beings.filter((b) => Math.hypot(b.x - center.x, b.y - center.y) <= radius + EPS).map((b) => b.id);
}

/**
 * Ids dos seres que a linha cobre: sai de `from` na direção de `to`, tem `length` quadrados e `width` de largura.
 * Quem está atrás de `from`, além do comprimento ou a mais de meia largura do eixo fica de fora.
 */
export function lineHits(from, to, beings, { length = FLAME_LENGTH_SQUARES, width = FLAME_WIDTH_SQUARES } = {}) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const norm = Math.hypot(dx, dy);
	if (norm < EPS) return [];
	const ux = dx / norm;
	const uy = dy / norm;
	return beings
		.filter((b) => {
			const rx = b.x - from.x;
			const ry = b.y - from.y;
			const along = rx * ux + ry * uy;
			const across = Math.abs(rx * uy - ry * ux);
			return along > EPS && along <= length + EPS && across <= width / 2 + EPS;
		})
		.map((b) => b.id);
}

/** DT do teste de Reflexos contra a Bazuca: 10 + Agilidade de quem atirou. */
export const reflexDT = (agility) => 10 + (Number(agility) || 0);

/** Dano de quem está no raio: metade (para baixo) se passou no teste, inteiro se falhou. */
export const radiusDamage = (amount, passed) => (passed ? Math.floor(amount / 2) : amount);

/** O único ataque do Lança-chamas atinge um ser cuja Defesa o total alcança. */
export const flameHit = (attackTotal, defense) => Number(attackTotal) >= Number(defense);
