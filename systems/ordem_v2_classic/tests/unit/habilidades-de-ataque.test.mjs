// Rodar: npm test. Poderes que mexem em ataque/dano e entram na tela de ataque (docs/spec-tela-de-ataque.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { combineSelection, scaleOnUse, specialAttackMax, weaponMatches } from "../../module/helpers/attack-options-rules.mjs";
import { POWER_EFFECTS, powerEffectFor } from "../../module/helpers/attack-power-effects.mjs";

const arma = (proficiency, range, sub = "", ammo = "") => ({ proficiency, types: { rangeType: { name: range, subRangeType: sub }, ammunitionType: ammo } });
const pistolaTatica = arma("tacticalWeapons", "ranged", "fire", "shortBullets");
const fuzilLongo = arma("tacticalWeapons", "ranged", "fire", "longBullets");
const arco = arma("tacticalWeapons", "ranged", "shoot", "arrows");
const katana = arma("tacticalWeapons", "melee");
const faca = arma("simpleWeapons", "melee");
const bazuca = arma("heavyWeapons", "ranged", "fire", "rocket");

const opt = (nome, nivel = 1, doubleUnit = false) => {
	const raw = powerEffectFor(nome).onUse;
	return { id: nome, label: nome, auto: Boolean(raw.auto), max: 1, onUse: scaleOnUse(raw, { nivel, doubleUnit }) };
};
const aplica = (nome, arma) => weaponMatches(powerEffectFor(nome).onUse, arma);

describe("filtro por proficiência, munição e exclusão", () => {
	it("Balística Avançada: só armas táticas de fogo", () => {
		assert.ok(aplica("Balística Avançada", pistolaTatica));
		assert.ok(!aplica("Balística Avançada", katana));
		assert.ok(!aplica("Balística Avançada", arco));
		assert.ok(!aplica("Balística Avançada", arma("simpleWeapons", "ranged", "fire")));
	});
	it("Ninja Urbano: táticas corpo a corpo e de disparo, nunca de fogo", () => {
		assert.ok(aplica("Ninja Urbano", katana));
		assert.ok(aplica("Ninja Urbano", arco));
		assert.ok(!aplica("Ninja Urbano", pistolaTatica));
		assert.ok(!aplica("Ninja Urbano", faca));
		assert.ok(!aplica("Ninja Urbano", bazuca));
	});
	it("Mira de Elite: só fogo com balas longas", () => {
		assert.ok(aplica("Mira de Elite", fuzilLongo));
		assert.ok(!aplica("Mira de Elite", pistolaTatica));
		assert.ok(!aplica("Mira de Elite", arco));
	});
	it("Disparo Letal: só armas de ataque à distância", () => {
		assert.ok(aplica("Disparo Letal", pistolaTatica) && aplica("Disparo Letal", arco));
		assert.ok(!aplica("Disparo Letal", katana));
	});
});

describe("o que cada poder soma", () => {
	it("Balística Avançada e Ninja Urbano: +2 no dano, sem custo", () => {
		for (const nome of ["Balística Avançada", "Ninja Urbano"]) {
			const r = combineSelection([opt(nome)]);
			assert.equal(r.damageFlat, 2, nome);
			assert.equal(r.cost, 0, nome);
			assert.equal(r.attackFlat, 0, nome);
		}
	});
	it("Mira de Elite soma o Intelecto no dano (atributo escolhido na ficha)", () => {
		assert.deepEqual(combineSelection([opt("Mira de Elite")]).damageAttrs, ["int"]);
	});
	it("Ataque Furtivo: 1 PE e 1d6 → 2d6 → 3d6 → 4d6 em NEX 10, 40, 65 e 99", () => {
		const casos = [[1, ""], [2, "+1d6"], [7, "+1d6"], [8, "+2d6"], [12, "+2d6"], [13, "+3d6"], [19, "+3d6"], [20, "+4d6"]];
		for (const [nivel, termo] of casos) {
			const r = combineSelection([opt("Ataque Furtivo", nivel)], { counts: { "Ataque Furtivo": 1 } });
			assert.deepEqual(r.damageTerms, termo ? [termo] : [], `nível ${nivel}`);
			assert.equal(r.cost, 1, `nível ${nivel}`);
		}
	});
	it("Ataque Furtivo desmarcado não custa nem soma", () => {
		const r = combineSelection([opt("Ataque Furtivo", 20)]);
		assert.deepEqual([r.cost, r.damageTerms.length], [0, 0]);
	});
	it("Disparo Letal: 1 PE e +2 na margem de ameaça", () => {
		const r = combineSelection([opt("Disparo Letal")], { counts: { "Disparo Letal": 1 } });
		assert.deepEqual([r.critMargin, r.cost], [2, 1]);
	});
});

describe("Potência Máxima dobra o Ataque Especial corpo a corpo", () => {
	const ataqueEspecial = (nivel, dobra) => {
		const raw = POWER_EFFECTS["ataque especial"]?.onUse ?? { enabled: true, pool: true, maxMode: "special", unit: 5, cost: 2, stepCost: 1 };
		return { id: "ae", label: "Ataque Especial", auto: false, max: specialAttackMax(nivel), onUse: scaleOnUse(raw, { nivel, doubleUnit: dobra }) };
	};
	const base = { enabled: true, pool: true, maxMode: "special", unit: 5, cost: 2, stepCost: 1 };
	const usa = (dobra, attack, damage) => {
		const o = { id: "ae", label: "AE", auto: false, max: 4, onUse: scaleOnUse(base, { doubleUnit: dobra }) };
		return combineSelection([o], { counts: { ae: { attack, damage } } });
	};
	it("exemplo do livro: 5 PE, +5 no ataque e +15 no dano viram +10 e +30", () => {
		const normal = usa(false, 1, 3);
		assert.deepEqual([normal.attackFlat, normal.damageFlat, normal.cost], [5, 15, 5]);
		const dobrado = usa(true, 1, 3);
		assert.deepEqual([dobrado.attackFlat, dobrado.damageFlat, dobrado.cost], [10, 30, 5]);
	});
	it("o custo em PE não dobra", () => {
		assert.equal(usa(true, 2, 0).cost, usa(false, 2, 0).cost);
	});
	it("Ataque Especial comum não é afetado", () => {
		assert.equal(ataqueEspecial(11, false).onUse.unit, 5);
	});
});

describe("registro", () => {
	it("os nomes dos poderes do livro encontram a entrada", () => {
		for (const nome of ["NEX 10% - Ataque Furtivo", "NEX 40% - Disparo Letal", "NEX 10% - Mira de Elite", "Balística Avançada", "Ninja Urbano"]) {
			assert.ok(powerEffectFor(nome), nome);
		}
		assert.equal(powerEffectFor("Perito em Explosivos"), null);
	});
});
