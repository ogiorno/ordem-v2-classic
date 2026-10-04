import assert from "node:assert/strict";
import test from "node:test";
import {
	pointGap, rectGap, ritualRange, ritualTargets, validateAreaPlacement, validateTargetSelection, withinRange,
} from "../../module/macros/ritual-targeting.mjs";

const item = (range, target) => ({ system: { range, target } });
const PX = 100 / 1.5; // 100 px por quadrado de 1,5 m
const square = (col, row, size = 1) => ({ x: col * 100, y: row * 100, w: size * 100, h: size * 100 });

test("alcance: sem informação no item vale curto (9 m)", () => {
	for (const empty of ["", undefined, null, "desconhecido"]) {
		const range = ritualRange(item(empty, "1 ser"));
		assert.equal(range.kind, "meters");
		assert.equal(range.meters, 9);
	}
});

test("alcance: curto, médio, longo, extremo, toque, pessoal e ilimitado", () => {
	assert.equal(ritualRange(item("short")).meters, 9);
	assert.equal(ritualRange(item("medium")).meters, 18);
	assert.equal(ritualRange(item("long")).meters, 36);
	assert.equal(ritualRange(item("extreme")).meters, 90);
	assert.equal(ritualRange(item("touch")).kind, "touch");
	assert.equal(ritualRange(item("personal")).kind, "personal");
	assert.equal(ritualRange(item("unlimited")).kind, "unlimited");
});

test("alcance: a forma Discente/Verdadeira pode mudar o alcance", () => {
	assert.equal(ritualRange(item("touch"), "alcance longo, até 5 seres e 3d6+3 de dano").key, "long");
	assert.equal(ritualRange(item("short"), "muda o alcance para “pessoal” o alvo para “área”").kind, "personal");
	assert.equal(ritualRange(item("short"), "alcance toque; 1 ser voluntário").kind, "touch");
	assert.equal(ritualRange(item("short"), "dano maior, sem mencionar alcance").key, "short");
});

test("toque exige o espaço ao lado, não 9 metros", () => {
	const touch = ritualRange(item("touch"));
	const caster = square(5, 5);
	assert.equal(withinRange(touch, rectGap(caster, square(6, 5)), PX), true, "lado a lado");
	assert.equal(withinRange(touch, rectGap(caster, square(6, 6)), PX), true, "diagonal");
	assert.equal(withinRange(touch, rectGap(caster, square(7, 5)), PX), false, "um quadrado de distância");
	const curto = ritualRange(item("short"));
	assert.equal(withinRange(curto, rectGap(caster, square(11, 5)), PX), true, "5 quadrados = 7,5 m");
	assert.equal(withinRange(curto, rectGap(caster, square(13, 5)), PX), false, "7 quadrados de intervalo = 10,5 m");
});

test("alvos: leitura do texto do item", () => {
	assert.deepEqual(ritualTargets(item("personal", "você")), { kind: "self", max: 0, label: "você" });
	assert.equal(ritualTargets(item("short", "1 ser")).max, 1);
	assert.equal(ritualTargets(item("short", "1 pessoa")).max, 1);
	assert.equal(ritualTargets(item("short", "até 5 seres voluntários")).max, 5);
	assert.equal(ritualTargets(item("short", "1 ser ou 2 pessoas")).max, 2);
	assert.equal(ritualTargets(item("touch", "1 arma corpo a corpo")).kind, "object");
	assert.equal(ritualTargets(item("short", "Veja descrição da área")).kind, "area");
	assert.equal(ritualTargets(item("short", "área de 6m de raio")).kind, "area");
	assert.equal(ritualTargets(item("short", "Veja texto")).kind, "unknown");
});

test("alvos: a forma pode mudar o alvo", () => {
	assert.equal(ritualTargets(item("short", "1 ser"), "muda o alvo para “alvos escolhidos”. Em vez do normal").max, null);
	assert.equal(ritualTargets(item("short", "1 ser com cérebro"), "alcance longo, até 5 seres escolhidos e 3d6+3 de dano").max, 5);
	assert.equal(ritualTargets(item("short", "1 ser"), "muda o alvo para “área: explosão com 6m de raio”").kind, "area");
	assert.equal(ritualTargets(item("touch", "1 ser"), "alcance toque; até dois seres").max, 2);
});

test("seleção: quantidade e alcance", () => {
	const range = ritualRange(item("short"));
	const targets = ritualTargets(item("short", "1 ser"));
	const caster = square(5, 5);
	const a = { id: "a", name: "A", ...square(8, 5) };
	const b = { id: "b", name: "B", ...square(9, 5) };
	const far = { id: "far", name: "Longe", ...square(40, 5) };

	assert.deepEqual(validateTargetSelection({ range, targets, caster, selected: [], pxPerMeter: PX }).ok, false);
	const one = validateTargetSelection({ range, targets, caster, selected: [a], pxPerMeter: PX });
	assert.equal(one.ok, true);
	assert.deepEqual(one.valid, ["a"]);
	const tooMany = validateTargetSelection({ range, targets, caster, selected: [a, b], pxPerMeter: PX });
	assert.equal(tooMany.ok, false);
	assert.match(tooMany.problems[0], /no máximo 1 alvo/);
	const tooFar = validateTargetSelection({ range, targets, caster, selected: [far], pxPerMeter: PX });
	assert.equal(tooFar.ok, false);
	assert.match(tooFar.problems.join(" "), /Longe está fora do alcance/);

	const five = ritualTargets(item("short", "até 5 seres voluntários"));
	assert.equal(validateTargetSelection({ range, targets: five, caster, selected: [a, b], pxPerMeter: PX }).ok, true);
});

test("seleção: ritual pessoal não precisa de alvo", () => {
	const range = ritualRange(item("personal"));
	const targets = ritualTargets(item("personal", "você"));
	assert.equal(validateTargetSelection({ range, targets, caster: square(1, 1), selected: [], pxPerMeter: PX }).ok, true);
});

test("área: o ponto escolhido respeita o alcance", () => {
	const caster = square(5, 5);
	const curto = ritualRange(item("short"));
	assert.equal(validateAreaPlacement({ range: curto, caster, point: { x: 800, y: 550 }, pxPerMeter: PX }).ok, true);
	const longe = validateAreaPlacement({ range: curto, caster, point: { x: 2000, y: 550 }, pxPerMeter: PX });
	assert.equal(longe.ok, false);
	assert.match(longe.reason, /9 m/);
	assert.equal(validateAreaPlacement({ range: ritualRange(item("touch")), caster, point: { x: 650, y: 550 }, pxPerMeter: PX }).ok, true);
	assert.equal(validateAreaPlacement({ range: ritualRange(item("touch")), caster, point: { x: 900, y: 550 }, pxPerMeter: PX }).ok, false);
	assert.equal(validateAreaPlacement({ range: ritualRange(item("unlimited")), caster, point: { x: 9000, y: 9000 }, pxPerMeter: PX }).ok, true);
	assert.equal(pointGap({ x: 0, y: 0 }, { x: 100, y: 0, w: 100, h: 100 }), 100);
});
