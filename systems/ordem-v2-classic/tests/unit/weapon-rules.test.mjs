// Rodar: npm test. Peculiaridades da arma na tela de ataque (docs/arquivo/spec-tela-de-ataque.md, seção "A arma").
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actionBlock, applyMode, canChooseAttribute, consumesReload, effectiveGrip, gripChoices, gripDamage, isVeteran, rangeCheck, rangeSquares, squaresBetween, weaponModes, weaponRules } from "../../module/helpers/weapon-rules.mjs";
import { combineSelection, damageFormulaParts } from "../../module/helpers/attack-options-rules.mjs";
import { POWER_EFFECTS, powerEffectData, powerEffectFor } from "../../module/helpers/attack-power-effects.mjs";

const katana = { types: { rangeType: { name: "melee" }, gripType: "twoHands" }, conditions: { agile: true } };
const faca = { range: "Curto", types: { rangeType: { name: "melee" }, gripType: "light" }, conditions: { agile: true, throwable: true } };
const machete = { types: { rangeType: { name: "melee" }, gripType: "oneHand" }, conditions: {} };
const fuzil = { range: "Médio", types: { rangeType: { name: "ranged", subRangeType: "fire" }, gripType: "twoHands" }, conditions: { automatic: true, pistolBlow: true } };
const pistola = { range: "Curto", types: { rangeType: { name: "ranged", subRangeType: "fire" }, gripType: "light" }, conditions: { pistolBlow: true } };

describe("modos de ataque da arma", () => {
	it("cada arma oferece só o que o livro permite", () => {
		assert.deepEqual(weaponModes(machete), ["normal", "throw"]); // sem alcance: arremesso improvisado
		assert.deepEqual(weaponModes(faca), ["normal", "throw"]);
		assert.deepEqual(weaponModes(fuzil), ["normal", "burst", "blow"]);
		assert.deepEqual(weaponModes(pistola), ["normal", "blow"]);
	});
	it("rajada: −1d20 no ataque e +1 dado de dano", () => {
		const m = applyMode(fuzil, "burst");
		assert.equal(m.attackDice, -1);
		assert.equal(m.damageDice, 1);
	});
	it("arremesso: Pontaria com Agilidade, soma Força; sem alcance paga −1d20 e vai até o curto", () => {
		const knife = applyMode(faca, "throw");
		assert.deepEqual([knife.skill, knife.attr, knife.damageAttr, knife.attackDice, knife.squares], ["aim", "dex", "str", 0, 6]);
		const bad = applyMode(machete, "throw");
		assert.deepEqual([bad.attackDice, bad.squares], [-1, 6]);
	});
	it("coronhada: corpo a corpo, 1d4 (leve/uma mão) ou 1d6 (duas mãos), impacto", () => {
		assert.equal(applyMode(pistola, "blow").damageFormula, "1d4");
		assert.equal(applyMode(fuzil, "blow").damageFormula, "1d6");
		const b = applyMode(pistola, "blow");
		assert.deepEqual([b.skill, b.attr, b.damageType, b.melee], ["fighting", "str", "impactDamage", true]);
	});
});

describe("arma ágil e empunhadura", () => {
	it("arma ágil corpo a corpo escolhe Agilidade ou Força; outras armas não", () => {
		assert.ok(canChooseAttribute(katana) && canChooseAttribute(faca));
		assert.ok(!canChooseAttribute(machete) && !canChooseAttribute(fuzil));
		assert.ok(!canChooseAttribute(faca, "throw"));
	});
	it("Katana é adaptável (veterano em Luta usa com uma mão); Machete não", () => {
		assert.deepEqual(gripChoices(katana, "Katana", { fightingDegree: 10 }).options, ["twoHands", "oneHand"]);
		assert.deepEqual(gripChoices(machete, "Machete").options, ["oneHand"]);
		assert.ok(gripChoices({ ...machete, conditions: { adaptableGrip: true } }, "Espada").adaptable);
	});
});

describe("alcance", () => {
	it("categorias em quadrados (1 quadrado = 1,5 m)", () => {
		assert.deepEqual(["Curto", "Médio", "Longo", "Extremo", "", null].map(rangeSquares), [6, 12, 24, 60, null, null]);
	});
	it("distância entre tokens: adjacente vale 1 quadrado", () => {
		const t = (x, y) => ({ x, y, w: 100, h: 100 });
		assert.equal(squaresBetween(t(0, 0), t(100, 0), 100), 1);
		assert.equal(squaresBetween(t(0, 0), t(100, 100), 100), 1);
		assert.equal(squaresBetween(t(0, 0), t(600, 0), 100), 6);
	});
	it("corpo a corpo só alcança adjacente", () => {
		const reach = applyMode(machete, "normal");
		assert.equal(rangeCheck(reach, 1).state, "ok");
		assert.equal(rangeCheck(reach, 2).state, "blocked");
	});
	it("à distância: dentro, até o dobro com −1d20, além bloqueia", () => {
		const reach = applyMode(pistola, "normal"); // curto = 6 quadrados
		assert.equal(rangeCheck(reach, 6).state, "ok");
		const pen = rangeCheck(reach, 7);
		assert.deepEqual([pen.state, pen.attackDice], ["penalty", -1]);
		assert.equal(rangeCheck(reach, 12).state, "penalty");
		assert.equal(rangeCheck(reach, 13).state, "blocked");
	});
	it("sem alvo ou sem mapa nada é exigido", () => {
		assert.equal(rangeCheck(applyMode(pistola), null).state, "unknown");
	});
});

describe("condições que impedem o ataque", () => {
	it("Atordoado (sem ações) bloqueia; Agarrado não", () => {
		assert.ok(actionBlock([{ noActions: true }]));
		assert.equal(actionBlock([{ dice: { attack: 1 } }]), null);
	});
});

describe("poderes integrados ao ataque", () => {
	const opt = (name) => ({ id: name, label: name, auto: true, max: 1, onUse: POWER_EFFECTS[name].onUse });
	it("Golpe Pesado dá +1 dado de dano; Técnica Letal +2 na margem; Tiro Certeiro soma Agilidade", () => {
		assert.equal(combineSelection([opt("golpe pesado")], {}).damageDice, 1);
		assert.equal(combineSelection([opt("tecnica letal")], {}).critMargin, 2);
		assert.deepEqual(combineSelection([opt("tiro certeiro")], {}).damageAttrs, ["dex"]);
	});
	it("Combate Defensivo e Golpe Demolidor são escolhas, com custo quando há", () => {
		const defensive = { ...opt("combate defensivo"), auto: false };
		assert.equal(combineSelection([defensive], { counts: { [defensive.id]: 1 } }).attackDice, -1);
		const demolidor = { ...opt("golpe demolidor"), auto: false };
		const r = combineSelection([demolidor], { counts: { [demolidor.id]: 1 } });
		assert.deepEqual([r.damageDice, r.cost], [2, 1]);
	});
	it("o registro acha o poder pelo fim do nome (trilhas têm prefixo de NEX)", () => {
		assert.ok(powerEffectFor("Golpe Pesado"));
		assert.ok(powerEffectFor("NEX 10% - Técnica Letal"));
		assert.equal(powerEffectFor("Saque Rápido"), null);
		const data = powerEffectData("Golpe Pesado", powerEffectFor("Golpe Pesado"));
		assert.equal(data.flags["ordem-v2-classic"].onUse.damageDice, 1);
		assert.equal(data.disabled, true);
	});
});

// Regras próprias de cada arma (docs/arquivo/spec-tela-de-ataque.md, "Regras próprias de cada arma").
const bastao = { types: { rangeType: { name: "melee" }, gripType: "oneHand" }, conditions: { adaptableGrip: true } };
const espada = bastao;
const motoserra = { types: { rangeType: { name: "melee" }, gripType: "twoHands" }, conditions: {} };
const metralhadora = { range: "Médio", types: { rangeType: { name: "ranged", subRangeType: "fire" }, gripType: "twoHands" }, conditions: { automatic: true, pistolBlow: true } };
const espingarda = { range: "Curto", types: { rangeType: { name: "ranged", subRangeType: "fire" }, gripType: "twoHands" }, conditions: { pistolBlow: true } };
const precisao = { range: "Longo", types: { rangeType: { name: "ranged", subRangeType: "fire" }, gripType: "twoHands" }, conditions: { pistolBlow: true } };

describe("empunhadura muda o dano", () => {
	it("veterano = grau 10", () => {
		assert.ok(!isVeteran(5) && isVeteran(10) && isVeteran(15));
	});
	it("Bastão 1d6 com uma mão e 1d8 com duas; Espada 1d8 e 1d10", () => {
		assert.deepEqual([gripDamage("Bastão", "oneHand"), gripDamage("Bastão", "twoHands")], ["1d6", "1d8"]);
		assert.deepEqual([gripDamage("Espada", "oneHand"), gripDamage("Espada", "twoHands")], ["1d8", "1d10"]);
		assert.equal(gripDamage("Machete", "twoHands"), null);
	});
	it("as regras devolvem o dado da empunhadura escolhida e registram no cartão quando muda", () => {
		const one = weaponRules(bastao, "Bastão", { grip: "oneHand" });
		const two = weaponRules(bastao, "Bastão", { grip: "twoHands" });
		assert.equal(one.damageFormula, "1d6");
		assert.equal(two.damageFormula, "1d8");
		assert.ok(two.lines.some((l) => l.includes("1d8")));
		assert.equal(weaponRules(espada, "Espada", { grip: "twoHands" }).damageFormula, "1d10");
		assert.equal(weaponRules(espada, "Espada", {}).damageFormula, "1d8");
	});
	it("Katana com uma mão exige veterano em Luta; não veterano cai para as duas mãos", () => {
		assert.deepEqual(gripChoices(katana, "Katana", { fightingDegree: 5 }).locked, ["oneHand"]);
		assert.deepEqual(gripChoices(katana, "Katana", { fightingDegree: 10 }).locked, []);
		assert.equal(effectiveGrip(katana, "Katana", "oneHand", { fightingDegree: 5 }), "twoHands");
		assert.equal(effectiveGrip(katana, "Katana", "oneHand", { fightingDegree: 10 }), "oneHand");
		const bad = weaponRules(katana, "Katana", { grip: "oneHand", fightingDegree: 5 });
		assert.ok(bad.lines.some((l) => l.includes("veterano")));
		assert.equal(bad.damageFormula, null, "a Katana não muda de dado");
	});
	it("só no ataque normal (coronhada e arremesso não usam a empunhadura)", () => {
		assert.equal(weaponRules(bastao, "Bastão", { mode: "throw", grip: "twoHands" }).damageFormula, null);
	});
});

describe("Motosserra", () => {
	it("−1d20 no ataque e dado extra a cada 6 no dano", () => {
		const r = weaponRules(motoserra, "Motoserra", {});
		assert.deepEqual([r.attackDice, r.explode], [-1, true]);
		assert.deepEqual(damageFormulaParts("3d6", { explode: true }), ["3d6x"]);
		assert.deepEqual(damageFormulaParts("3d6", { explode: true, critMultiplier: 2, extraDice: 1 }), ["8d6x"]);
		assert.deepEqual(damageFormulaParts("3d6"), ["3d6"]);
	});
	it("não vale no arremesso (que já paga −1d20) nem em outra arma", () => {
		assert.equal(weaponRules(motoserra, "Motoserra", { mode: "throw" }).attackDice, 0);
		assert.equal(weaponRules(machete, "Machete", {}).attackDice, 0);
	});
});

describe("Metralhadora", () => {
	it("−5 no ataque sem Força 4 e sem tripé", () => {
		const r = weaponRules(metralhadora, "Metralhadora", { str: 3 });
		assert.equal(r.attackFlat, -5);
		assert.deepEqual(r.choices.map((c) => c.id), ["ruleTripod"]);
	});
	it("com o tripé, ou com Força 4 ou mais, não há penalidade", () => {
		assert.equal(weaponRules(metralhadora, "Metralhadora", { str: 3, picked: { tripod: true } }).attackFlat, 0);
		const strong = weaponRules(metralhadora, "Metralhadora", { str: 4 });
		assert.equal(strong.attackFlat, 0);
		assert.equal(strong.choices.length, 0);
	});
	it("vale também na rajada, mas não na coronhada", () => {
		assert.equal(weaponRules(metralhadora, "Metralhadora", { str: 1, mode: "burst" }).attackFlat, -5);
		assert.equal(weaponRules(metralhadora, "Metralhadora", { str: 1, mode: "blow" }).attackFlat, 0);
	});
});

describe("Espingarda", () => {
	it("metade do dano quando o alvo está além do alcance curto (6 quadrados)", () => {
		assert.equal(weaponRules(espingarda, "Espingarda", { distance: 6 }).halve, false);
		assert.equal(weaponRules(espingarda, "Espingarda", { distance: 7 }).halve, true);
		assert.equal(weaponRules(espingarda, "Espingarda de Cano Duplo", { distance: 12 }).halve, true);
	});
	it("sem alvo marcado, a tela pergunta", () => {
		const ask = weaponRules(espingarda, "Espingarda", { distance: null });
		assert.deepEqual(ask.choices.map((c) => c.id), ["ruleFar"]);
		assert.equal(ask.halve, false);
		assert.equal(weaponRules(espingarda, "Espingarda", { distance: null, picked: { far: true } }).halve, true);
	});
	it("não vale na coronhada", () => {
		assert.equal(weaponRules(espingarda, "Espingarda", { distance: 12, mode: "blow" }).halve, false);
	});
});

describe("Fuzil de Precisão", () => {
	it("veterano em Pontaria que mira: +5 na margem de ameaça", () => {
		assert.equal(weaponRules(precisao, "Fuzil de Precisão", { aimDegree: 10, picked: { aimed: true } }).critMargin, 5);
	});
	it("sem mirar, ou sem ser veterano, não ganha", () => {
		assert.equal(weaponRules(precisao, "Fuzil de Precisão", { aimDegree: 10 }).critMargin, 0);
		const novice = weaponRules(precisao, "Fuzil de Precisão", { aimDegree: 5, picked: { aimed: true } });
		assert.equal(novice.critMargin, 0);
		assert.equal(novice.choices.length, 0);
	});
	it("outras armas não têm a regra", () => {
		assert.equal(weaponRules(fuzil, "Fuzil de Assalto", { aimDegree: 15, picked: { aimed: true } }).critMargin, 0);
	});
});

// Corrente, recarga e Cajado (docs/arquivo/spec-armas-area-recarga.md, seções 1 a 3)
const corrente = { types: { rangeType: { name: "melee" }, gripType: "oneHand" }, conditions: {} };
const besta = { range: "Médio", types: { rangeType: { name: "ranged", subRangeType: "shoot" }, gripType: "twoHands" }, conditions: {} };
const bazuca = { range: "Médio", types: { rangeType: { name: "ranged", subRangeType: "fire" }, gripType: "twoHands" }, conditions: { pistolBlow: true } };
const cajado = { types: { rangeType: { name: "melee" }, gripType: "twoHands" }, conditions: { agile: true } };

describe("Corrente", () => {
	it("oferece 'desarmar ou derrubar' e dá +2 só quando marcado", () => {
		const off = weaponRules(corrente, "Corrente", {});
		assert.deepEqual(off.choices.map((c) => c.id), ["ruleManeuver"]);
		assert.equal(off.attackFlat, 0);
		const on = weaponRules(corrente, "Corrente", { picked: { maneuver: true } });
		assert.equal(on.attackFlat, 2);
		assert.ok(on.lines.some((l) => l.includes("Corrente")));
	});
	it("não vale no arremesso nem em outras armas", () => {
		assert.equal(weaponRules(corrente, "Corrente", { mode: "throw", picked: { maneuver: true } }).attackFlat, 0);
		assert.equal(weaponRules(machete, "Machete", {}).choices.length, 0);
	});
});

describe("recarga (Balestra, Besta, Bazuca)", () => {
	it("sem recarga pendente: ataca livre e nada é perguntado", () => {
		const r = weaponRules(besta, "Besta", { reload: { pending: false } });
		assert.equal(r.block, null);
		assert.equal(r.choices.length, 0);
	});
	it("com recarga pendente: pergunta e bloqueia até marcar", () => {
		const r = weaponRules(besta, "Besta", { reload: { pending: true } });
		assert.deepEqual(r.choices.map((c) => c.id), ["ruleReload"]);
		assert.match(r.block, /Recarregue/);
		const ok = weaponRules(besta, "Besta", { reload: { pending: true }, picked: { reloaded: true } });
		assert.equal(ok.block, null);
	});
	it("vale para Balestra e Bazuca; coronhada e arremesso não gastam nem exigem", () => {
		assert.ok(weaponRules(bazuca, "Bazuca", { reload: { pending: true } }).block);
		assert.ok(weaponRules(besta, "Balestra", { reload: { pending: true } }).block);
		assert.equal(weaponRules(bazuca, "Bazuca", { mode: "blow", reload: { pending: true } }).block, null);
		assert.equal(weaponRules(pistola, "Pistola", { reload: { pending: true } }).block, null);
	});
	it("informa quais armas gastam a recarga ao disparar", () => {
		assert.ok(consumesReload("Besta") && consumesReload("Balestra") && consumesReload("Bazuca"));
		assert.ok(!consumesReload("Pistola"));
		assert.ok(consumesReload("Bazuca", "normal") && !consumesReload("Bazuca", "blow"));
	});
});

describe("Cajado", () => {
	it("mostra a linha informativa e não muda o ataque", () => {
		const r = weaponRules(cajado, "Cajado", {});
		assert.ok(r.notes.some((n) => /Combater com Duas Armas/.test(n.text)));
		assert.deepEqual([r.attackDice, r.attackFlat, r.critMargin], [0, 0, 0]);
	});
});

describe("Bazuca: modo disparar num ponto", () => {
	it("a Bazuca oferece o modo ponto; outras armas não", () => {
		assert.deepEqual(weaponModes(bazuca, "Bazuca"), ["normal", "point", "blow"]);
		assert.ok(!weaponModes(fuzil, "Fuzil de Assalto").includes("point"));
	});
	it("no ponto não há rolagem de ataque e o alcance é o médio", () => {
		const m = applyMode(bazuca, "point");
		assert.equal(m.noRoll, true);
		assert.equal(m.squares, 12);
	});
});
