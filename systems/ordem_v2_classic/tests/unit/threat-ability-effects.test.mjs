import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEffectPlan, durationPlan, isExpired, ownedBy, resolveCondition, sourceFlag } from "../../module/helpers/threat-ability-effects.mjs";

const combat = { round: 3 };

test("condições do piloto: Surdo e Atordoado usam a mecânica do sistema", () => {
	const surdo = resolveCondition("Surdo");
	assert.deepEqual([surdo.support, surdo.id], ["mechanical", "deaf"]);
	assert.equal(resolveCondition("atordoado").id, "stun");
	assert.equal(resolveCondition("Em Chamas").id, "burning");
	assert.equal(resolveCondition("enjoado").id, "nauseated");
	assert.equal(resolveCondition("agarrado").id, "grabbed");
});

test("condição sem mecânica no sistema vira marcador manual, nunca automática", () => {
	for (const nome of ["Frustrado", "Lento", "Fascinado", "Confuso", "Asfixiado", "Debilitado"]) {
		const c = resolveCondition(nome);
		assert.deepEqual([c.support, c.id], ["marker", null], nome);
	}
	assert.equal(resolveCondition("Caído").status, "prone");
	assert.equal(resolveCondition(""), null);
	assert.equal(resolveCondition(undefined), null);
});

test("duração em rodadas: expira depois da rodada configurada, no turno do alvo", () => {
	const d = durationPlan({ duration: { value: 3, unit: "rounds" }, combat });
	assert.deepEqual([d.rounds, d.startRound, d.expiresRound, d.expires, d.manual], [3, 3, 5, true, false]);
	assert.equal(isExpired(d.expiresRound, 5), false);
	assert.equal(isExpired(d.expiresRound, 6), true);
	assert.equal(isExpired(null, 99), false);
	assert.equal(durationPlan({ duration: { value: 1, unit: "rounds" }, combat }).expiresRound, 3);
});

test("duração em fórmula usa o valor rolado; turnos contam como rodadas; minutos = 10 rodadas", () => {
	assert.equal(durationPlan({ duration: { value: "1d4", unit: "rounds" }, rolled: 2, combat }).rounds, 2);
	assert.equal(durationPlan({ duration: { value: 2, unit: "turns" }, combat }).rounds, 2);
	assert.equal(durationPlan({ duration: { value: 2, unit: "minutes" }, combat }).rounds, 20);
});

test("fora de combate ou sem número válido: expiração manual explicada", () => {
	const noCombat = durationPlan({ duration: { value: 2, unit: "rounds" }, combat: null });
	assert.deepEqual([noCombat.expires, noCombat.manual, noCombat.note], [false, true, "noCombat"]);
	assert.equal(durationPlan({ duration: { value: "abc", unit: "rounds" }, combat }).kind, "invalid");
	assert.equal(durationPlan({ duration: { value: 0, unit: "rounds" }, combat }).kind, "invalid");
	assert.equal(durationPlan({ duration: { unit: "dias" }, combat }).kind, "invalid");
});

test("cena, até passar no teste, instantâneo e permanente", () => {
	assert.deepEqual([durationPlan({ duration: { unit: "scene" } }).manual, durationPlan({ duration: { unit: "scene" } }).note], [true, "scene"]);
	assert.equal(durationPlan({ duration: { unit: "untilSaved" } }).note, "untilSaved");
	assert.equal(durationPlan({ duration: { unit: "instant" } }).kind, "instant");
	const perm = durationPlan({ duration: { unit: "permanent" } });
	assert.deepEqual([perm.expires, perm.manual], [false, false]);
});

test("plano: Surdo por 1d4 rodadas só na falha (Mal Sintonizado)", () => {
	const effect = { condition: "Surdo", duration: { value: "1d4", unit: "rounds" }, onSave: "fail", support: "mechanical" };
	const fail = buildEffectPlan({ effect, passed: false, rolled: 3, combat });
	assert.equal(fail.applies, true);
	assert.deepEqual([fail.support, fail.manual, fail.duration.expiresRound, fail.condition.id], ["mechanical", false, 5, "deaf"]);
	const pass = buildEffectPlan({ effect, passed: true, rolled: 3, combat });
	assert.deepEqual([pass.applies, pass.reason], [false, "save-outcome"]);
	assert.equal(buildEffectPlan({ effect, passed: null, rolled: 3, combat }).applies, false);
});

test("plano: marcador manual e duração inválida", () => {
	const marker = buildEffectPlan({ effect: { condition: "Frustrado", duration: { value: 2, unit: "rounds" }, onSave: "always", support: "marker" }, passed: false, combat });
	assert.equal(marker.applies, true);
	assert.deepEqual([marker.support, marker.manual], ["marker", true]);
	assert.ok(marker.notes.includes("markerCondition"));
	const forcedMarker = buildEffectPlan({ effect: { condition: "Surdo", duration: { value: 2, unit: "rounds" }, support: "marker" }, combat });
	assert.equal(forcedMarker.support, "marker");
	const noCombat = buildEffectPlan({ effect: { condition: "Surdo", duration: { value: 2, unit: "rounds" }, support: "mechanical" }, combat: null });
	assert.deepEqual([noCombat.applies, noCombat.manual, noCombat.notes.includes("noCombat")], [true, true, true]);
	assert.deepEqual([buildEffectPlan({ effect: { condition: "Surdo", duration: { value: "x", unit: "rounds" } }, combat }).applies], [false]);
	assert.equal(buildEffectPlan({ effect: { condition: "", duration: { unit: "scene" } }, combat }).reason, "no-condition");
});

test("remoção seletiva: só efeitos da execução (e do índice) pedida", () => {
	const plan = buildEffectPlan({ effect: { condition: "Surdo", duration: { value: 2, unit: "rounds" } }, combat });
	const fx = (executionId, effectIndex) => ({ id: `${executionId}-${effectIndex}`, flags: { ordem_v2_classic: { abilityExec: sourceFlag({ executionId, effectIndex, plan }) } } });
	const effects = [fx("exec1", 0), fx("exec1", 1), fx("exec2", 0), { id: "manual", flags: {} }];
	assert.deepEqual(ownedBy(effects, "exec1").map((e) => e.id), ["exec1-0", "exec1-1"]);
	assert.deepEqual(ownedBy(effects, "exec1", 1).map((e) => e.id), ["exec1-1"]);
	assert.deepEqual(ownedBy(effects, "exec3"), []);
});

test("o sinalizador de origem guarda a expiração e se é manual", () => {
	const plan = buildEffectPlan({ effect: { condition: "Surdo", duration: { value: 2, unit: "rounds" } }, combat });
	const flag = sourceFlag({ executionId: "e", itemUuid: "Item.x", sourceActorUuid: "Actor.y", targetId: "t", plan });
	assert.deepEqual([flag.expiresRound, flag.startRound, flag.manual, flag.itemUuid, flag.targetId], [4, 3, false, "Item.x", "t"]);
});

test("duração não informada vira marcador que o Mestre encerra", () => {
	const d = durationPlan({ duration: { unit: "unspecified" }, combat });
	assert.deepEqual([d.kind, d.manual, d.expires, d.note], ["unspecified", true, false, "unspecified"]);
	const plan = buildEffectPlan({ effect: { condition: "Enjoado", duration: { unit: "unspecified" }, support: "mechanical" }, combat });
	assert.deepEqual([plan.applies, plan.manual, plan.notes.includes("unspecified")], [true, true, true]);
});
