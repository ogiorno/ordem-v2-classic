import { test, before, after } from "node:test";
import assert from "node:assert/strict";

let areaTemplateData, regionShapeFromTemplate, regionContains;
const antes = {};
const GLOBAIS = ["game", "canvas"];

before(async () => {
	for (const k of GLOBAIS) antes[k] = globalThis[k];
	// 1 quadrado = 1,5 m = 100 px, como nas cenas do mundo.
	globalThis.game = { user: { color: { css: "#112233" } } };
	globalThis.canvas = { dimensions: { distance: 1.5, distancePixels: 100 / 1.5 } };
	Math.toRadians ??= (deg) => (deg * Math.PI) / 180;
	({ areaTemplateData, regionShapeFromTemplate, regionContains } = await import("../../module/macros/ritual-area.mjs"));
});

after(() => {
	for (const k of GLOBAIS) {
		if (antes[k] === undefined) delete globalThis[k];
		else globalThis[k] = antes[k];
	}
});

const ritual = (target, areaName = "") => ({ system: { target, area: { name: areaName } } });
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("texto livre: esfera, cone, linha e cubo viram o modelo certo", () => {
	assert.deepEqual(areaTemplateData(ritual("área", "esfera com 6m de raio")), { fillColor: "#112233", t: "circle", distance: 6 });
	assert.deepEqual(areaTemplateData(ritual("área", "cone de 4,5m")), { fillColor: "#112233", t: "cone", angle: 90, distance: 4.5 });
	assert.deepEqual(areaTemplateData(ritual("área", "linha de 9m")), { fillColor: "#112233", t: "ray", distance: 9, width: 1.5 });
});

test("texto livre: cubo usa a diagonal para o lado valer o tamanho dito", () => {
	const d = areaTemplateData(ritual("área", "cubo com 3m de lado"));
	assert.equal(d.t, "rect");
	perto(d.distance, 3 * Math.SQRT2);
});

test("texto livre: diâmetro divide pela metade; raio de luz é linha, 'de raio' é esfera", () => {
	assert.equal(areaTemplateData(ritual("área", "esfera com 6m de diâmetro")).distance, 3);
	assert.equal(areaTemplateData(ritual("área", "raio de luz de 12m")).t, "ray");
	assert.equal(areaTemplateData(ritual("área", "círculo com 3m de raio")).t, "circle");
});

test("texto livre: ritual sem área, sem tamanho ou sem forma conhecida devolve null", () => {
	assert.equal(areaTemplateData(ritual("1 ser")), null);
	assert.equal(areaTemplateData(ritual("área", "esfera sem tamanho")), null);
	assert.equal(areaTemplateData(ritual("área", "algo com 6m")), null);
	assert.equal(areaTemplateData(ritual("área", "esfera com 0m de raio")), null);
	assert.equal(areaTemplateData({ system: {} }), null);
});

test("pela regra: a forma da regra vence o texto; regra sem área age só nos alvos marcados", () => {
	const item = ritual("área", "esfera com 6m de raio");
	assert.deepEqual(areaTemplateData(item, { area: { shape: "cone", distance: 9 } }), { fillColor: "#112233", t: "cone", angle: 90, distance: 9 });
	assert.deepEqual(areaTemplateData(item, { area: { shape: "ray", distance: 18 } }), { fillColor: "#112233", t: "ray", distance: 18, width: 1.5 });
	assert.deepEqual(areaTemplateData(item, { area: { shape: "ray", distance: 18, width: 3 } }).width, 3);
	assert.deepEqual(areaTemplateData(item, { area: { shape: "sphere", distance: 4.5 } }), { fillColor: "#112233", t: "circle", distance: 4.5 });
	assert.equal(areaTemplateData(item, {}), null);
	const rect = areaTemplateData(item, { area: { shape: "rect", distance: 3 } });
	assert.equal(rect.direction, 45);
	perto(rect.distance, 3 * Math.SQRT2);
});

test("região do círculo: raio em pixels a partir da origem", () => {
	const s = regionShapeFromTemplate({ t: "circle", distance: 6 }, { x: 500, y: 300 });
	assert.deepEqual(s, { type: "circle", x: 500, y: 300, radius: 400 });
});

test("região do cubo: retângulo alinhado aos eixos de lado igual ao pedido, na direção da diagonal", () => {
	const d = { t: "rect", distance: 3 * Math.SQRT2, direction: 45 };
	const s = regionShapeFromTemplate(d, { x: 1000, y: 1000 });
	assert.equal(s.type, "rectangle");
	perto(s.x, 1000);
	perto(s.y, 1000);
	perto(s.width, 200);
	perto(s.height, 200);
	const contra = regionShapeFromTemplate({ ...d, direction: 225 }, { x: 1000, y: 1000 });
	perto(contra.x, 800);
	perto(contra.y, 800);
});

test("região do cone: começa na origem e abre 90 graus com todos os pontos à distância certa", () => {
	const s = regionShapeFromTemplate({ t: "cone", distance: 6, angle: 90, direction: 0 }, { x: 0, y: 0 });
	assert.equal(s.type, "polygon");
	assert.deepEqual(s.points.slice(0, 2), [0, 0]);
	const pontos = [];
	for (let i = 2; i < s.points.length; i += 2) pontos.push([s.points[i], s.points[i + 1]]);
	for (const [x, y] of pontos) perto(Math.hypot(x, y), 400);
	const angulos = pontos.map(([x, y]) => (Math.atan2(y, x) * 180) / Math.PI);
	perto(Math.min(...angulos), -45);
	perto(Math.max(...angulos), 45);
	assert.ok(pontos.length >= 7);
});

test("região da linha: retângulo fino com o comprimento e a largura pedidos", () => {
	const s = regionShapeFromTemplate({ t: "ray", distance: 9, width: 1.5, direction: 0 }, { x: 0, y: 0 });
	assert.equal(s.type, "polygon");
	assert.equal(s.points.length, 8);
	const xs = s.points.filter((_, i) => i % 2 === 0);
	const ys = s.points.filter((_, i) => i % 2 === 1);
	perto(Math.max(...xs) - Math.min(...xs), 600);
	perto(Math.max(...ys) - Math.min(...ys), 100);
});

test("ponto dentro da região: usa a árvore de polígonos e aceita região sem ela", () => {
	const regiao = { polygonTree: { testPoint: ({ x, y }) => x === 1 && y === 2 } };
	assert.equal(regionContains(regiao, { x: 1, y: 2, extra: 9 }), true);
	assert.equal(regionContains(regiao, { x: 3, y: 2 }), false);
	assert.equal(regionContains({}, { x: 1, y: 2 }), false);
});
