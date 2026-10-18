import { test } from "node:test";
import assert from "node:assert/strict";
import { doorLine, resourcesToFill, tokenNeedsVisionWarning } from "../../module/helpers/player-onboarding.mjs";

test("aviso de visão: só token de jogador, em cena com visão de token, sem visão ligada", () => {
	assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: true, tokenSightEnabled: false, ownedByPlayer: true }), true);
	assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: true, tokenSightEnabled: true, ownedByPlayer: true }), false);
	assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: false, tokenSightEnabled: false, ownedByPlayer: true }), false);
	assert.equal(tokenNeedsVisionWarning({ sceneTokenVision: true, tokenSightEnabled: false, ownedByPlayer: false }), false);
	assert.equal(tokenNeedsVisionWarning({}), false);
});

test("classe nova: enche só o que ainda está no valor inicial 5 e tem máximo maior", () => {
	const system = {
		PV: { value: 5, max: 20 },
		PE: { value: 5, max: 5 },
		PD: { value: 5, max: 9 },
		SAN: { value: 12, max: 30 },
	};
	assert.deepEqual(resourcesToFill(system), { "system.PV.value": 20, "system.PD.value": 9 });
});

test("classe nova: ignora recurso ausente ou com máximo zero e aceita outro valor inicial", () => {
	assert.deepEqual(resourcesToFill({ PV: { value: 5, max: 0 }, PE: null }), {});
	assert.deepEqual(resourcesToFill(undefined), {});
	assert.deepEqual(resourcesToFill({ PV: { value: 1, max: 8 } }, 1), { "system.PV.value": 8 });
});

test("linha de porta no chat usa o texto de aberta, trancada ou fechada", () => {
	const antes = { CONST: globalThis.CONST, game: globalThis.game };
	globalThis.CONST = { WALL_DOOR_STATES: { CLOSED: 0, OPEN: 1, LOCKED: 2 } };
	globalThis.game = { i18n: { format: (key, data) => `${key}|${data.name}` } };
	try {
		assert.equal(doorLine("Porta 1", 1), "op.door.opened|Porta 1");
		assert.equal(doorLine("Porta 1", 2), "op.door.locked|Porta 1");
		assert.equal(doorLine("Porta 1", 0), "op.door.closed|Porta 1");
	} finally {
		for (const [k, v] of Object.entries(antes)) {
			if (v === undefined) delete globalThis[k];
			else globalThis[k] = v;
		}
	}
});
