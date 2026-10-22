import { test } from "node:test";
import assert from "node:assert/strict";
import { BLEED_DT, bleedCardOpen, bleedDamageFormula, bleedMode, bleedOutcome, bleedStacks, canRollBleed } from "../../module/helpers/turn-effects-rules.mjs";

test("Sangrando acumula: 1d6 por acúmulo, mínimo 1", () => {
	assert.equal(bleedStacks(undefined), 1);
	assert.equal(bleedStacks({}), 1);
	assert.equal(bleedStacks({ stacks: 0 }), 1);
	assert.equal(bleedStacks({ stacks: 3 }), 3);
	assert.equal(bleedDamageFormula(1), "1d6");
	assert.equal(bleedDamageFormula(2), "2d6");
	assert.equal(bleedDamageFormula(undefined), "1d6");
});

test("pergunta só para agente com dono jogador conectado e opção 'ask'", () => {
	assert.equal(bleedMode({ setting: "ask", actorType: "agent", hasOnlineOwner: true }), "ask");
	assert.equal(bleedMode({ setting: "ask", actorType: "agent", hasOnlineOwner: false }), "auto");
	assert.equal(bleedMode({ setting: "ask", actorType: "threat", hasOnlineOwner: true }), "auto");
	assert.equal(bleedMode({ setting: "auto", actorType: "agent", hasOnlineOwner: true }), "auto");
});

test("Vigor DT 20: 20 estanca, 19 continua sangrando", () => {
	assert.equal(BLEED_DT, 20);
	assert.equal(bleedOutcome(20), "stanched");
	assert.equal(bleedOutcome(19), "bleeds");
	assert.equal(bleedOutcome(undefined), "bleeds");
});

test("só o Mestre ou o dono rola; o cartão aceita uma vez", () => {
	assert.equal(canRollBleed({ isGM: false, isOwner: false }), false);
	assert.equal(canRollBleed({ isGM: false, isOwner: true }), true);
	assert.equal(canRollBleed({ isGM: true, isOwner: false }), true);
	assert.equal(bleedCardOpen({ resolved: false }), true);
	assert.equal(bleedCardOpen({ resolved: true }), false);
	assert.equal(bleedCardOpen(undefined), false);
});
