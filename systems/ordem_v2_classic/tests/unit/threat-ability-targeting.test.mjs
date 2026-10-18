import { test } from "node:test";
import assert from "node:assert/strict";
import { areaGeometry, coverage, geometryContains, inRange, isEligible, planAreaUse, rectCenter, resolveAreaHits, validatePlacement, validateTargets } from "../../module/helpers/threat-ability-targeting.mjs";

const PX = 100 / 1.5; // grid de 100 px = 1,5 m
const sq = 100;
const tok = (id, gx, gy, kind = "agent", extra = {}) => ({ id, name: id, kind, x: gx * sq, y: gy * sq, w: sq, h: sq, ...extra });
const caster = tok("monstro", 0, 0, "threat");

test("self não precisa de cena nem token; sem alvo definido é manual", () => {
	assert.equal(validateTargets({ targeting: { kind: "self" }, caster: null, pxPerMeter: PX }).ok, true);
	const m = validateTargets({ targeting: null, caster, pxPerMeter: PX });
	assert.deepEqual([m.ok, m.manual], [false, true]);
});

test("cena ou token de origem ausente cai em modo manual com aviso", () => {
	for (const args of [{ hasScene: false, caster }, { caster: null }]) {
		const r = validateTargets({ targeting: { kind: "token", range: 9, relation: "any" }, selected: [tok("a", 1, 0)], pxPerMeter: PX, ...args });
		assert.equal(r.manual, true);
		assert.match(r.reason, /token do agente/);
		assert.equal(r.sideEffects, "none");
	}
});

test("alvo único: dentro, na borda e fora do alcance (inclui diagonal)", () => {
	const t = { kind: "token", range: 9, relation: "any" };
	// 9 m = 600 px; gap = distância borda a borda
	assert.equal(validateTargets({ targeting: t, caster, selected: [tok("borda", 7, 0)], pxPerMeter: PX }).ok, true); // gap 600
	assert.equal(validateTargets({ targeting: t, caster, selected: [tok("fora", 8, 0)], pxPerMeter: PX }).ok, false); // gap 700
	assert.equal(validateTargets({ targeting: t, caster, selected: [tok("diag", 5, 5)], pxPerMeter: PX }).ok, true); // gap ≈ 565
	assert.equal(validateTargets({ targeting: t, caster, selected: [tok("diag", 6, 6)], pxPerMeter: PX }).ok, false); // gap ≈ 707
	assert.equal(validateTargets({ targeting: t, caster, selected: [tok("colado", 1, 0)], pxPerMeter: PX }).ok, true); // gap 0
});

test("quantidade: token aceita 1; tokens respeita count; nenhum marcado recusa", () => {
	const one = { kind: "token", range: 30, relation: "any" };
	const many = { kind: "tokens", range: 30, count: 2, relation: "any" };
	const [a, b, c] = [tok("a", 2, 0), tok("b", 3, 0), tok("c", 4, 0)];
	assert.equal(validateTargets({ targeting: one, caster, selected: [a, b], pxPerMeter: PX }).ok, false);
	assert.equal(validateTargets({ targeting: many, caster, selected: [a, b], pxPerMeter: PX }).ok, true);
	const r = validateTargets({ targeting: many, caster, selected: [a, b, c], pxPerMeter: PX });
	assert.equal(r.ok, false);
	assert.match(r.problems.join(), /Máximo de 2/);
	assert.deepEqual(validateTargets({ targeting: many, caster, selected: [], pxPerMeter: PX }).problems, ["Nenhum alvo marcado."]);
});

test("elegibilidade por relação; mortos e o próprio token ficam de fora", () => {
	const agent = tok("ag", 1, 0, "agent"), threat = tok("am", 1, 1, "threat");
	assert.equal(isEligible(agent, { relation: "agent" }), true);
	assert.equal(isEligible(threat, { relation: "agent" }), false);
	assert.equal(isEligible(threat, { relation: "threat" }), true);
	assert.equal(isEligible(agent, { relation: "any" }), true);
	assert.equal(isEligible(tok("m", 0, 0, "agent", { dead: true }), { relation: "any" }), false);
	assert.equal(isEligible(agent, { relation: "any", sourceId: "ag" }), false);
	const r = validateTargets({ targeting: { kind: "token", range: 30, relation: "agent" }, caster, selected: [threat], pxPerMeter: PX });
	assert.equal(r.ok, false);
});

test("unidades: o mesmo alcance em metros vale em grids diferentes", () => {
	assert.equal(inRange(9, 600, PX), true);
	assert.equal(inRange(9, 601, PX), false);
	const px2 = 50 / 1.5; // grid menor
	assert.equal(inRange(9, 300, px2), true);
	assert.equal(inRange(9, 301, px2), false);
});

test("linha 9 m × 3 m a partir do conjurador atinge só quem está no corredor", () => {
	const area = { shape: "line", length: 9, width: 3, origin: "caster" };
	const cands = [tok("frente", 3, 0), tok("fim", 6, 0), tok("alem", 8, 0), tok("lado", 3, 3), tok("meio-corredor", 4, 1)];
	const r = planAreaUse({ targeting: { kind: "area", relation: "any" }, area, caster, direction: 0, candidates: cands, pxPerMeter: PX });
	assert.equal(r.ok, true);
	const ids = r.hits.map((h) => h.id).sort();
	assert.deepEqual(ids, ["fim", "frente", "meio-corredor"]);
	assert.ok(r.hits.every((h) => h.coverage > 0 && h.coverage <= 1));
});

test("rotação: a mesma linha apontada para baixo muda os atingidos", () => {
	const area = { shape: "line", length: 9, width: 3, origin: "caster" };
	const cands = [tok("leste", 3, 0), tok("sul", 0, 3)];
	const leste = planAreaUse({ targeting: { kind: "area" }, area, caster, direction: 0, candidates: cands, pxPerMeter: PX });
	const sul = planAreaUse({ targeting: { kind: "area" }, area, caster, direction: 90, candidates: cands, pxPerMeter: PX });
	assert.deepEqual(leste.hits.map((h) => h.id), ["leste"]);
	assert.deepEqual(sul.hits.map((h) => h.id), ["sul"]);
});

test("cone de 90° e esfera por ponto; borda da esfera inclusa", () => {
	const cone = { shape: "cone", length: 6, origin: "caster" };
	const c = planAreaUse({ targeting: { kind: "area" }, area: cone, caster, direction: 0, candidates: [tok("dentro", 2, 0), tok("atras", -2, 0), tok("ao-lado", 0, 3)], pxPerMeter: PX });
	assert.deepEqual(c.hits.map((h) => h.id), ["dentro"]);
	const sphere = { shape: "sphere", radius: 3, origin: "point" };
	const s = planAreaUse({ targeting: { kind: "area", range: 30 }, area: sphere, caster, point: { x: 1000, y: 50 }, candidates: [tok("centro", 9, 0), tok("vizinho", 11, 0), tok("longe", 14, 0)], pxPerMeter: PX });
	assert.deepEqual(s.hits.map((h) => h.id).sort(), ["centro", "vizinho"]);
});

test("emanação do conjurador conta a partir da borda do token", () => {
	const area = { shape: "sphere", radius: 3, origin: "caster" }; // 3 m = 200 px
	const near = tok("a", 3, 0); // centro a 350 px; borda do monstro em 50 → alcance efetivo 250 px, a borda do alvo em 300
	const nearer = tok("b", 2, 0); // borda do alvo em 200
	const r = planAreaUse({ targeting: { kind: "area" }, area, caster, candidates: [near, nearer], pxPerMeter: PX });
	assert.deepEqual(r.hits.map((h) => h.id), ["b"]);
});

test("cubo/retângulo e cobertura parcial", () => {
	const g = areaGeometry({ shape: "cube", length: 3 }, { origin: { x: 500, y: 500 }, direction: 0, pxPerMeter: PX });
	assert.equal(geometryContains(g, { x: 550, y: 550 }), true);
	assert.equal(geometryContains(g, { x: 620, y: 500 }), false);
	assert.equal(coverage(g, { x: 500, y: 500, w: 200, h: 200 }), 0.16); // amostragem 5×5: 2×2 pontos dentro (real: 0,25));
	assert.equal(coverage(g, { x: 450, y: 450, w: 100, h: 100 }), 1);
	assert.equal(coverage(g, { x: 900, y: 900, w: 100, h: 100 }), 0);
});

test("área por ponto: fora do alcance recusa, dentro aceita; sem ponto recusa", () => {
	const area = { shape: "sphere", radius: 3, origin: "point" };
	const targeting = { kind: "area", range: 9 };
	assert.equal(validatePlacement({ targeting, area, caster, point: { x: 500, y: 50 }, pxPerMeter: PX }).ok, true);
	const bad = validatePlacement({ targeting, area, caster, point: { x: 900, y: 50 }, pxPerMeter: PX });
	assert.equal(bad.ok, false);
	assert.match(bad.problems[0], /Fora do alcance/);
	assert.equal(validatePlacement({ targeting, area, caster, point: null, pxPerMeter: PX }).ok, false);
	assert.equal(validatePlacement({ targeting, area: { ...area, origin: "caster" }, caster, point: null, pxPerMeter: PX }).ok, true);
});

test("cancelamento e cena vazia: sem alvos, sem efeitos", () => {
	const area = { shape: "line", length: 9, width: 3, origin: "caster" };
	const cancel = planAreaUse({ targeting: { kind: "area" }, area, caster, candidates: [tok("a", 1, 0)], pxPerMeter: PX, cancelled: true });
	assert.deepEqual([cancel.ok, cancel.cancelled, cancel.hits, cancel.sideEffects], [false, true, [], "none"]);
	const semCena = planAreaUse({ targeting: { kind: "area" }, area, caster: null, hasScene: false, candidates: [], pxPerMeter: PX });
	assert.deepEqual([semCena.ok, semCena.manual, semCena.hits.length], [false, true, 0]);
	const vazia = planAreaUse({ targeting: { kind: "area" }, area, caster, candidates: [], pxPerMeter: PX });
	assert.deepEqual([vazia.ok, vazia.hits.length], [true, 0]);
});

test("relação filtra atingidos pela área e exclui o próprio conjurador", () => {
	const area = { shape: "sphere", radius: 9, origin: "caster" };
	const cands = [caster, tok("ag", 1, 0, "agent"), tok("am", 1, 1, "threat")];
	const r = planAreaUse({ targeting: { kind: "area", relation: "agent" }, area, caster, candidates: cands, pxPerMeter: PX });
	assert.deepEqual(r.hits.map((h) => h.id), ["ag"]);
	assert.deepEqual(rectCenter(caster), { x: 50, y: 50 });
	assert.deepEqual(resolveAreaHits({ kind: "circle", cx: 0, cy: 0, r: 0 }, [], { origin: { x: 0, y: 0 }, pxPerMeter: PX }), []);
});
