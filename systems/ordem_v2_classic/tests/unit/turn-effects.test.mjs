import { test } from "node:test";
import assert from "node:assert/strict";
import { BLEED_DT, bleedCardOpen, bleedMode, bleedOutcome, canRollBleed } from "../../module/helpers/turn-effects-rules.mjs";

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
