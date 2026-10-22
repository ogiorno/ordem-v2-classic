// Rodar: npm test. A Bazuca e o Lança-chamas têm animação própria, diferente da pistola (docs/arquivo/spec-area-da-bazuca.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
// o módulo registra ganchos do Foundry ao carregar: um Hooks de mentira basta aqui
globalThis.Hooks = { once() {}, on() {} };
const { ATTACK_EFFECTS } = await import("../../module/integrations/attack-animations.mjs");
const { AREA_EFFECTS } = await import("../../module/helpers/weapon-area-visual.mjs");

describe("animações das armas de área", () => {
	it("foguete e chama não usam o efeito do tiro de pistola", () => {
		assert.notDeepEqual(ATTACK_EFFECTS.rocket.files, ATTACK_EFFECTS.shot.files);
		assert.notDeepEqual(ATTACK_EFFECTS.flame.files, ATTACK_EFFECTS.shot.files);
	});
	it("a explosão da área é um efeito próprio", () => {
		assert.ok(AREA_EFFECTS.explosion.length > 0);
		assert.ok(!AREA_EFFECTS.explosion.some((f) => ATTACK_EFFECTS.shot.files.includes(f)));
	});
});
