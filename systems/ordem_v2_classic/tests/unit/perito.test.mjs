// Rodar: npm test. Perito (Tabela 1.4) e a mesma progressão do Ataque Especial (Tabela 1.3). Ver docs/spec-perito.md.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { peritoOption, peritoPlan, peritoSkillAllowed, peritoTier } from "../../module/helpers/perito-rules.mjs";
import { optionCost, specialAttackMax } from "../../module/helpers/attack-options-rules.mjs";
import { levelFeatures } from "../../module/helpers/level-up-rules.mjs";

describe("Perito: faixas por nível (NEX 5%, 25%, 55%, 85%)", () => {
	it("custo e dado da Tabela 1.4", () => {
		const table = [[1, 2, "1d6"], [4, 2, "1d6"], [5, 3, "1d8"], [10, 3, "1d8"], [11, 4, "1d10"], [16, 4, "1d10"], [17, 5, "1d12"], [20, 5, "1d12"]];
		for (const [nivel, pe, die] of table) {
			const o = peritoOption(nivel);
			assert.equal(o.pe, pe, `nível ${nivel}`);
			assert.equal(o.die, die, `nível ${nivel}`);
		}
	});
	it("nível ausente ou inválido cai na primeira faixa", () => {
		for (const n of [undefined, null, 0, "x"]) assert.equal(peritoTier(n), 0);
	});
	it("as faixas andam junto com o Ataque Especial", () => {
		for (let nivel = 1; nivel <= 20; nivel++) assert.equal(peritoTier(nivel) + 1, specialAttackMax(nivel), `nível ${nivel}`);
	});
	it("o custo do Perito é o mesmo gasto total do Ataque Especial com a faixa cheia (2, 3, 4, 5 PE)", () => {
		for (let nivel = 1; nivel <= 20; nivel++) {
			const special = optionCost({ cost: 2, stepCost: 1 }, specialAttackMax(nivel));
			assert.equal(peritoOption(nivel).pe, special, `nível ${nivel}`);
		}
	});
	it("a tela de nível anuncia o mesmo custo e dado", () => {
		for (const nivel of [1, 5, 11, 17]) {
			const f = levelFeatures("Especialista", nivel).find((x) => x.id === "expert");
			assert.deepEqual({ pe: f.params.pe, die: f.params.die }, { pe: peritoOption(nivel).pe, die: peritoOption(nivel).die });
			const c = levelFeatures("Combatente", nivel).find((x) => x.id === "specialAttack");
			assert.equal(c.params.pe, peritoOption(nivel).pe);
		}
	});
});

describe("Perito: quando vale", () => {
	it("só perícia treinada", () => {
		assert.ok(peritoSkillAllowed("investigation", { degree: 5 }));
		assert.ok(!peritoSkillAllowed("investigation", { degree: 0 }));
		assert.ok(!peritoSkillAllowed("investigation", {}));
	});
	it("nunca Luta nem Pontaria", () => {
		assert.ok(!peritoSkillAllowed("fighting", { degree: 10 }));
		assert.ok(!peritoSkillAllowed("aim", { degree: 10 }));
	});
	it("com duas perícias escolhidas, só elas", () => {
		const chosen = ["investigation", "tactics"];
		assert.ok(peritoSkillAllowed("tactics", { degree: 5, chosen }));
		assert.ok(!peritoSkillAllowed("stealth", { degree: 5, chosen }));
		assert.ok(peritoSkillAllowed("stealth", { degree: 5, chosen: [] }));
	});
});

describe("Perito: saldo", () => {
	it("avisa quanto falta", () => {
		const p = peritoPlan({ nivel: 11, skill: "tactics", degree: 5, balance: 3 });
		assert.deepEqual({ available: p.available, pe: p.pe, canPay: p.canPay, missing: p.missing }, { available: true, pe: 4, canPay: false, missing: 1 });
	});
	it("saldo exato paga", () => {
		const p = peritoPlan({ nivel: 17, skill: "tactics", degree: 5, balance: 5 });
		assert.ok(p.canPay && p.missing === 0 && p.die === "1d12");
	});
	it("o limite de PE por turno não bloqueia (a faixa do nível sempre pode ser paga)", () => {
		// nível 1: limite por turno 1, custo 2 — mesma regra do Ataque Especial
		assert.ok(peritoPlan({ nivel: 1, skill: "tactics", degree: 5, balance: 2 }).canPay);
	});
});
