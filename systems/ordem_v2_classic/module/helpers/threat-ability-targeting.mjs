// Alvos, alcance e áreas das habilidades de ameaça (lógica pura, sem Foundry).
// Coordenadas em pixels da cena; `pxPerMeter` converte para metros. Retângulos: { x, y, w, h }.
// Nada aqui rola dado, cobra recurso ou cria efeito: só valida e mede.
import { pointGap, rectGap } from "../macros/ritual-targeting.mjs";

export const CONE_ANGLE = 90; // igual ao cone dos rituais (ritual-area.mjs)
const EPS = 1e-6;
const SAMPLES = 5; // grade 5×5 de pontos por token para estimar a cobertura

export const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const rad = (deg) => (deg * Math.PI) / 180;

/** Elegibilidade pela relação declarada (`agent`, `threat`, `any`). Mortos e o próprio token não entram. */
export function isEligible(candidate, { relation = "any", sourceId = null } = {}) {
	if (!candidate || candidate.id === sourceId || candidate.dead) return false;
	if (relation === "any") return true;
	return candidate.kind === relation;
}

/** Geometria da área em pixels. Direção em graus (0 = leste, sentido horário como o Foundry). */
export function areaGeometry(area, { origin, direction = 0, pxPerMeter, casterRect = null }) {
	const m = (v) => (Number(v) || 0) * pxPerMeter;
	const d = rad(direction);
	const dir = { x: Math.cos(d), y: Math.sin(d) };
	const normal = { x: -dir.y, y: dir.x };
	const o = origin;
	switch (area.shape) {
		case "line": {
			const half = m(area.width) / 2, len = m(area.length);
			return { kind: "polygon", points: [
				{ x: o.x + normal.x * half, y: o.y + normal.y * half },
				{ x: o.x - normal.x * half, y: o.y - normal.y * half },
				{ x: o.x - normal.x * half + dir.x * len, y: o.y - normal.y * half + dir.y * len },
				{ x: o.x + normal.x * half + dir.x * len, y: o.y + normal.y * half + dir.y * len }
			] };
		}
		case "cone": {
			const len = m(area.length), half = rad((area.angle ?? CONE_ANGLE) / 2);
			const steps = Math.max(6, Math.ceil((area.angle ?? CONE_ANGLE) / 3));
			const points = [{ x: o.x, y: o.y }];
			for (let i = 0; i <= steps; i++) {
				const a = d - half + (2 * half * i) / steps;
				points.push({ x: o.x + Math.cos(a) * len, y: o.y + Math.sin(a) * len });
			}
			return { kind: "polygon", points };
		}
		case "cube": case "rect": {
			const side = m(area.length) / 2;
			return { kind: "polygon", points: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({
				x: o.x + (dir.x * sx + normal.x * sy) * side, y: o.y + (dir.y * sx + normal.y * sy) * side
			})) };
		}
		default: { // sphere / circle; emanação a partir do conjurador cresce até a borda do token
			const grow = area.origin === "caster" && casterRect ? Math.max(casterRect.w, casterRect.h) / 2 : 0;
			return { kind: "circle", cx: o.x, cy: o.y, r: m(area.radius) + grow };
		}
	}
}

function inPolygon(points, p) {
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const a = points[i], b = points[j];
		if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
	}
	return inside;
}

export const geometryContains = (g, p) => (g.kind === "circle" ? Math.hypot(p.x - g.cx, p.y - g.cy) <= g.r + EPS : inPolygon(g.points, p));

/** Fração (0–1) do retângulo coberta pela forma, por amostragem em grade. */
export function coverage(geometry, rect) {
	let hit = 0;
	for (let i = 0; i < SAMPLES; i++) for (let j = 0; j < SAMPLES; j++) {
		const p = { x: rect.x + ((i + 0.5) / SAMPLES) * rect.w, y: rect.y + ((j + 0.5) / SAMPLES) * rect.h };
		if (geometryContains(geometry, p)) hit++;
	}
	return hit / (SAMPLES * SAMPLES);
}

/** Tokens alcançados por uma área (cobertura > 0), com distância em metros ao ponto de origem. */
export function resolveAreaHits(geometry, candidates, { relation = "any", sourceId = null, origin, pxPerMeter }) {
	return candidates
		.filter((c) => isEligible(c, { relation, sourceId }))
		.map((c) => ({ id: c.id, name: c.name, coverage: coverage(geometry, c), distance: pointGap(origin, c) / pxPerMeter }))
		.filter((h) => h.coverage > 0)
		.sort((a, b) => b.coverage - a.coverage || a.distance - b.distance);
}

/** Alcance em metros: gap (borda a borda) ≤ alcance. */
export function inRange(rangeMeters, gapPx, pxPerMeter) {
	return gapPx / pxPerMeter <= rangeMeters + EPS;
}

const manual = (reason) => ({ ok: false, manual: true, reason, problems: [], valid: [], sideEffects: "none" });
const refuse = (problems) => ({ ok: false, manual: false, problems, valid: [], sideEffects: "none" });

/** Confere a seleção de alvos (`self`, `token`, `tokens`) antes de qualquer rolagem ou cobrança. */
export function validateTargets({ targeting, caster, selected = [], pxPerMeter, hasScene = true }) {
	if (!targeting) return manual("sem alvo definido");
	if (targeting.kind === "self") return { ok: true, manual: false, problems: [], valid: [], self: true, sideEffects: "none" };
	if (!hasScene || !caster) return manual("sem token do agente na cena");
	const problems = [];
	const max = targeting.kind === "token" ? 1 : targeting.count;
	const eligible = selected.filter((t) => isEligible(t, { relation: targeting.relation, sourceId: caster.id }));
	for (const t of selected) {
		if (!eligible.includes(t)) problems.push(`${t.name ?? t.id} não é um alvo permitido.`);
	}
	if (!selected.length) return refuse(["Nenhum alvo marcado."]);
	if (max && eligible.length > max) problems.push(`Máximo de ${max} alvo(s); marcados ${eligible.length}.`);
	const valid = [];
	for (const t of eligible) {
		const gap = rectGap(caster, t);
		if (targeting.range !== null && targeting.range !== undefined && !inRange(targeting.range, gap, pxPerMeter)) {
			problems.push(`${t.name ?? t.id} está fora do alcance (${targeting.range} m).`);
		} else valid.push(t.id);
	}
	return { ok: !problems.length && valid.length > 0, manual: false, problems, valid, sideEffects: "none" };
}

/** O ponto escolhido para a área respeita o alcance? Origem no conjurador não precisa de ponto. */
export function validatePlacement({ targeting, area, caster, point, pxPerMeter }) {
	if (!area) return manual("sem área definida");
	if (area.origin !== "point") return { ok: true, manual: false, problems: [], sideEffects: "none" };
	if (!caster) return manual("sem token do agente na cena");
	if (!point) return refuse(["Nenhum ponto escolhido."]);
	const range = targeting?.range;
	if (range === null || range === undefined) return { ok: true, manual: false, problems: [], sideEffects: "none" };
	return inRange(range, pointGap(point, caster), pxPerMeter)
		? { ok: true, manual: false, problems: [], sideEffects: "none" }
		: refuse([`Fora do alcance: a área só pode ser colocada até ${range} m.`]);
}

/**
 * Resolve a área já posicionada: valida e devolve os tokens alcançados. Cancelamento (`cancelled`) e
 * cena/origem ausente nunca produzem alvos nem efeitos.
 */
export function planAreaUse({ targeting, area, caster, point = null, direction = 0, candidates = [], pxPerMeter, hasScene = true, cancelled = false }) {
	if (cancelled) return { ok: false, manual: false, cancelled: true, problems: [], hits: [], sideEffects: "none" };
	if (!hasScene || !caster) return { ...manual("sem token do agente na cena"), hits: [] };
	const placement = validatePlacement({ targeting, area, caster, point, pxPerMeter });
	if (!placement.ok) return { ...placement, hits: [] };
	const origin = area.origin === "point" ? point : rectCenter(caster);
	const geometry = areaGeometry(area, { origin, direction, pxPerMeter, casterRect: caster });
	const hits = resolveAreaHits(geometry, candidates, { relation: targeting?.relation ?? "any", sourceId: caster.id, origin, pxPerMeter });
	return { ok: true, manual: false, problems: [], geometry, origin, direction, hits, sideEffects: "none" };
}
