import { test } from "node:test";
import assert from "node:assert/strict";
import { DYING_TURN_LIMIT, downedState, dyingTurnOutcome, massiveDamageDT, stabilizeDT, triggersMassiveDamage } from "../../module/helpers/death-rules.mjs";

test("Dano Massivo: DT 15 +2 para cada 10 pontos de dano", () => {
	assert.equal(massiveDamageDT(9), 15);
	assert.equal(massiveDamageDT(10), 17);
	assert.equal(massiveDamageDT(25), 19);
	assert.equal(massiveDamageDT(0), 15);
});

test("Dano Massivo só vale com dano ≥ metade dos PV totais sem zerar os PV", () => {
	assert.equal(triggersMassiveDamage({ damage: 10, maxPV: 20, newPV: 10 }), true);
	assert.equal(triggersMassiveDamage({ damage: 9, maxPV: 20, newPV: 11 }), false);
	assert.equal(triggersMassiveDamage({ damage: 11, maxPV: 21, newPV: 5 }), true);
	assert.equal(triggersMassiveDamage({ damage: 10, maxPV: 21, newPV: 11 }), false);
	assert.equal(triggersMassiveDamage({ damage: 30, maxPV: 20, newPV: 0 }), false, "já zerou: já está morrendo");
	assert.equal(triggersMassiveDamage({ damage: 0, maxPV: 20, newPV: 20 }), false);
});

test("0 PV = inconsciente e morrendo; com PV, nada", () => {
	assert.deepEqual(downedState({ pv: 0 }), { dying: true, unconscious: true });
	assert.deepEqual(downedState({ pv: 1 }), { dying: false, unconscious: false });
});

test("dano não letal soma ao letal só para inconsciente, não para morrendo", () => {
	assert.deepEqual(downedState({ pv: 5, nonLethal: 5 }), { dying: false, unconscious: true });
	assert.deepEqual(downedState({ pv: 5, nonLethal: 4 }), { dying: false, unconscious: false });
});

test("três turnos iniciados morrendo = morte", () => {
	assert.equal(DYING_TURN_LIMIT, 3);
	assert.equal(dyingTurnOutcome(1), "dying");
	assert.equal(dyingTurnOutcome(2), "dying");
	assert.equal(dyingTurnOutcome(3), "dead");
});

test("estabilizar: Medicina DT 20, +5 para cada vez já estabilizado na cena", () => {
	assert.equal(stabilizeDT(0), 20);
	assert.equal(stabilizeDT(1), 25);
	assert.equal(stabilizeDT(2), 30);
	assert.equal(stabilizeDT(undefined), 20);
});

import { tokensAdjacent } from "../../module/helpers/death-rules.mjs";

test("adjacência: quadrados encostando valem (inclusive diagonal); um quadrado de distância não", () => {
	const at = (x, y) => ({ x, y, width: 100, height: 100 });
	assert.equal(tokensAdjacent(at(0, 0), at(100, 0)), true);
	assert.equal(tokensAdjacent(at(0, 0), at(100, 100)), true);
	assert.equal(tokensAdjacent(at(0, 0), at(0, 100)), true);
	assert.equal(tokensAdjacent(at(0, 0), at(200, 0)), false);
	assert.equal(tokensAdjacent(at(0, 0), at(100, 200)), false);
	assert.equal(tokensAdjacent(at(0, 0), { x: 0, y: 0, width: 200, height: 200 }), true, "token grande sobreposto");
});
