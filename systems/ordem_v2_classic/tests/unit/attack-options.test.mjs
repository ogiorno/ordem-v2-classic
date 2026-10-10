// Rodar: npm test. Regras puras da tela de ataque (docs/spec-tela-de-ataque.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appliesTo, combineSelection, damageFormulaParts, optionCost, parseBonus, poolCap, poolChoices, poolState, specialAttackMax, weaponTags } from "../../module/helpers/attack-options-rules.mjs";
import { attackConditionDetails, conditionDicePenalty } from "../../module/helpers/conditions.mjs";

const fire = { types: { rangeType: { name: "ranged", subRangeType: "fire" } } };
const sword = { types: { rangeType: { name: "melee", subRangeType: "" } } };
const knife = { types: { rangeType: { name: "melee", subRangeType: "throw" } }, conditions: { throwable: true } };

describe("filtro por arma", () => {
	it("etiquetas da arma", () => {
		assert.deepEqual([...weaponTags(fire)].sort(), ["all", "fire", "ranged"]);
		assert.deepEqual([...weaponTags(sword)].sort(), ["all", "melee"]);
		assert.ok(weaponTags(knife).has("throw") && weaponTags(knife).has("melee"));
	});
	it("applies decide se a opção vale", () => {
		assert.ok(appliesTo("melee", weaponTags(sword)));
		assert.ok(!appliesTo("melee", weaponTags(fire)));
		assert.ok(appliesTo("fire", weaponTags(fire)));
		assert.ok(appliesTo("", weaponTags(fire)) && appliesTo(undefined, weaponTags(sword)));
	});
});

describe("custo e acúmulos", () => {
	it("Ataque Especial: 2 PE o primeiro, +1 PE cada seguinte", () => {
		const u = { cost: 2, stepCost: 1 };
		assert.deepEqual([0, 1, 2, 3, 4].map((n) => optionCost(u, n)), [0, 2, 3, 4, 5]);
	});
	it("sem stepCost, cada uso custa o mesmo", () => {
		assert.equal(optionCost({ cost: 2 }, 3), 6);
		assert.equal(optionCost({ cost: 2, stepCost: null }, 2), 4);
	});
	it("limite do Ataque Especial por nível (NEX 5%, 25%, 55%, 85%)", () => {
		assert.deepEqual([1, 4, 5, 10, 11, 16, 17, 20].map(specialAttackMax), [1, 1, 2, 2, 3, 3, 4, 4]);
	});
});

describe("bônus escritos pelo jogador", () => {
	it("números, dados e dados de d20", () => {
		assert.deepEqual(parseBonus("+2"), { flat: 2, dice: [], d20: 0 });
		assert.deepEqual(parseBonus("−3"), { flat: -3, dice: [], d20: 0 });
		assert.deepEqual(parseBonus("+1d6+2"), { flat: 2, dice: ["+1d6"], d20: 0 });
		assert.deepEqual(parseBonus("-1d", { allowD20: true }), { flat: 0, dice: [], d20: -1 });
		assert.deepEqual(parseBonus("1d", { allowD20: false }), { flat: 0, dice: [], d20: 0 });
		assert.deepEqual(parseBonus("  "), { flat: 0, dice: [], d20: 0 });
	});
});

const pool = { id: "ae", label: "Ataque Especial", onUse: { pool: true, unit: 5, cost: 2, stepCost: 1 }, max: 3 };
const pb = { id: "pb", label: "Pancada Forte", onUse: { cost: 1, attackDice: 1 }, max: 1 };
const bellum = { id: "bel", label: "Para Bellum", onUse: { auto: true, damageBonus: 2 }, auto: true, max: 1 };
const sharp = { id: "sh", label: "Lâmina", onUse: { cost: 1, damageDice: 1, damageBonus: "1d4" }, max: 2 };

describe("combineSelection", () => {
	it("automáticas valem sem escolha e sem custo", () => {
		const r = combineSelection([bellum, pb], {});
		assert.equal(r.damageFlat, 2);
		assert.equal(r.cost, 0);
		assert.deepEqual(r.lines, ["Para Bellum"]);
	});
	it("Ataque Especial divide os +5 entre ataque e dano e cobra o total", () => {
		const r = combineSelection([pool], { counts: { ae: { attack: 1, damage: 2 } } });
		assert.equal(r.attackFlat, 5);
		assert.equal(r.damageFlat, 10);
		assert.equal(r.cost, 4);
		assert.deepEqual(r.lines, ["Ataque Especial ×3"]);
	});
	it("Ataque Especial não passa do limite do nível", () => {
		const r = combineSelection([pool], { counts: { ae: { attack: 3, damage: 3 } } });
		assert.equal(r.attackFlat + r.damageFlat, 15);
		assert.equal(r.cost, 4);
	});
	it("opção simples: dado extra no ataque e custo", () => {
		const r = combineSelection([pb], { counts: { pb: 1 } });
		assert.equal(r.attackDice, 1);
		assert.equal(r.cost, 1);
	});
	it("opção acumulável soma dados, bônus e custo", () => {
		const r = combineSelection([sharp], { counts: { sh: 2 } });
		assert.equal(r.damageDice, 2);
		assert.deepEqual(r.damageTerms, ["+1d4", "+1d4"]);
		assert.equal(r.cost, 2);
		const capped = combineSelection([sharp], { counts: { sh: 9 } });
		assert.equal(capped.damageDice, 2);
	});
	it("campos livres de ataque e dano", () => {
		const r = combineSelection([], { freeAttack: "+2", freeDamage: "+1d6+1" });
		assert.equal(r.attackFlat, 2);
		assert.equal(r.damageFlat, 1);
		assert.deepEqual(r.damageTerms, ["+1d6"]);
		const d = combineSelection([], { freeAttack: "-1d" });
		assert.equal(d.attackDice, -1);
	});
	it("nada escolhido não custa nada", () => {
		const r = combineSelection([pool, pb, sharp], {});
		assert.equal(r.cost, 0);
		assert.deepEqual(r.lines, []);
	});
});

describe("fórmula do dano", () => {
	it("dados extras entram antes do crítico", () => {
		assert.deepEqual(damageFormulaParts("2d8"), ["2d8"]);
		assert.deepEqual(damageFormulaParts("2d8", { extraDice: 1 }), ["3d8"]);
		assert.deepEqual(damageFormulaParts("2d8", { critMultiplier: 3, extraDice: 1 }), ["9d8"]);
		assert.deepEqual(damageFormulaParts("5", { critMultiplier: 2 }), ["5"]);
	});
});

describe("condições no ataque", () => {
	const effect = (id, name, data, disabled = false) => ({
		id,
		name,
		disabled,
		getFlag: (_system, key) => (key === "condition" ? data : null),
	});

	it("soma a penalidade específica do ataque com a penalidade geral", () => {
		const actor = { effects: [effect("grab", "Agarrado", { dice: { attack: 1 } }), effect("all", "Exausto", { dice: { all: 1 } })] };
		assert.equal(conditionDicePenalty(actor, "attack"), 2);
	});

	it("lista nome e efeitos mecânicos, ignorando condições desativadas", () => {
		const actor = {
			effects: [
				effect("grab", "Agarrado", { dice: { attack: 1 }, defense: -5, immobile: true }),
				effect("gone", "Vulnerável", { defense: -2 }, true),
			],
		};
		assert.deepEqual(attackConditionDetails(actor), [
			{ id: "grab", name: "Agarrado", detail: "−1 dado no ataque · −5 Defesa · imóvel", description: "", attackPenalty: 1 },
		]);
	});

	it("traz o texto da regra da condição do catálogo, ou o do próprio efeito", () => {
		const actor = {
			effects: [
				effect("a", "Atordoado", { id: "stun", defense: -5 }),
				{ ...effect("b", "Medo", {}), description: "<p>Tem  <b>medo</b>.</p>" },
			],
		};
		const [stun, fear] = attackConditionDetails(actor);
		assert.match(stun.description, /não pode realizar ações/);
		assert.equal(fear.description, "Tem medo .");
	});
});

describe("Ataque Especial em acúmulos de +5 (select)", () => {
	const ae = { pool: true, unit: 5, cost: 2, stepCost: 1 };
	it("select oferece 0, +5, +10… até o teto", () => {
		assert.deepEqual(poolChoices(5, 3).map((c) => c.label), ["—", "+5", "+10", "+15"]);
		assert.deepEqual(poolChoices(5, 0).map((c) => c.stacks), [0]);
	});
	it("cada +5 soma 1 PE (2, 3, 4, 5)", () => {
		assert.deepEqual(poolChoices(5, 4).map((c) => optionCost(ae, c.stacks)), [0, 2, 3, 4, 5]);
	});
	it("limite da habilidade vale quando o PE por turno sobra", () => {
		assert.deepEqual(poolCap(ae, 2, 10), { max: 2, abilityMax: 2, limit: "ability" });
	});
	it("limite de PE por turno corta os acúmulos (4 PE por turno = 3 acúmulos)", () => {
		assert.deepEqual(poolCap(ae, 4, 4), { max: 3, abilityMax: 4, limit: "turn" });
		assert.deepEqual(poolCap(ae, 4, 3), { max: 2, abilityMax: 4, limit: "turn" });
	});
	it("PE por turno menor que o custo inicial não anula a habilidade: sobra o primeiro acúmulo", () => {
		assert.deepEqual(poolCap(ae, 1, 1), { max: 1, abilityMax: 1, limit: "ability" });
		assert.equal(poolCap(ae, 3, 1).max, 1);
	});
	it("sem PE por turno conhecido, vale só o limite da habilidade", () => {
		assert.equal(poolCap(ae, 3, undefined).max, 3);
		assert.equal(poolCap(ae, 3, 0).max, 3);
	});
	it("ataque e dano dividem o mesmo teto e o aviso aparece no máximo", () => {
		let s = poolState({ max: 3, limit: "ability", attack: 1, damage: 1 });
		assert.deepEqual([s.total, s.atMax, s.attackRoom, s.damageRoom, s.flag], [2, false, 2, 2, null]);
		s = poolState({ max: 3, limit: "ability", attack: 2, damage: 1 });
		assert.deepEqual([s.total, s.atMax, s.attackRoom, s.damageRoom], [3, true, 2, 1]);
		assert.deepEqual(s.flag, { key: "ability", max: 3 });
		assert.deepEqual(poolState({ max: 2, limit: "turn", attack: 2, damage: 0 }).flag, { key: "turn", max: 2 });
	});
	it("o excesso escolhido é cortado e o custo segue o teto", () => {
		const opt = { id: "ae", label: "Ataque Especial", onUse: ae, max: poolCap(ae, 4, 4).max };
		const r = combineSelection([opt], { counts: { ae: { attack: 2, damage: 2 } } });
		assert.equal(r.attackFlat + r.damageFlat, 15);
		assert.equal(r.cost, 4);
	});
});
