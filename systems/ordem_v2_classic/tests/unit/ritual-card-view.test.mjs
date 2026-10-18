import assert from "node:assert/strict";
import test from "node:test";
import {
	activeSum, breakdownText, chips, damageButtonLabel, damageGate, damageView, diceChips, effectSentence, extraCostCharge, extractDice,
	findRitualEntry, firstSentence, damageTypeIcon, costNote, nameKey, resultBanner, rollBreakdown, testBlocks,
} from "../../module/macros/ritual-card-view.mjs";

const d20 = (...values) => ({ faces: 20, results: values.map((result, i) => ({ result, active: i === 0 })) });

test("CR-04: acha o ritual pelo nome, sem acento nem caixa; nome inexistente devolve null", () => {
	const index = [{ kind: "power", name: "Amaldiçoar Arma" }, { kind: "ritual", name: "Amaldiçoar Arma", uuid: "r1" }, { kind: "ritual", name: "Decadência", uuid: "r2" }];
	assert.equal(findRitualEntry(index, "  amaldicoar   ARMA ").uuid, "r1", "ignora poder de mesmo nome");
	assert.equal(findRitualEntry(index, "Decadencia").uuid, "r2");
	assert.equal(findRitualEntry(index, "Inexistente"), null);
	assert.equal(findRitualEntry(index, ""), null);
	assert.equal(findRitualEntry(null, "x"), null);
	assert.equal(nameKey("Não"), "nao");
});

test("CR-18: dado e bônus saem da rolagem; vantagem fica com o maior e apaga os outros", () => {
	const one = rollBreakdown({ dice: [d20(12)], total: 19 });
	assert.deepEqual([one.die, one.bonus, one.others, one.crit], [12, 7, [], null]);
	assert.deepEqual(one.dice, [{ value: 12, state: "" }]);
	const adv = rollBreakdown({ dice: [{ faces: 20, results: [{ result: 4, active: false, discarded: true }, { result: 15, active: true }] }], total: 18 });
	assert.equal(adv.die, 15);
	assert.equal(adv.bonus, 3);
	assert.deepEqual(adv.others, [4]);
	assert.deepEqual(adv.dice, [{ value: 4, state: "off" }, { value: 15, state: "" }]);
	assert.equal(rollBreakdown({ dice: [d20(20)], total: 27 }).crit, "crit");
	assert.equal(rollBreakdown({ dice: [d20(20)], total: 27 }).dice[0].state, "max");
	assert.equal(rollBreakdown({ dice: [d20(1)], total: 8 }).crit, "fumble");
	assert.equal(rollBreakdown({ dice: [d20(1)], total: 8 }).dice[0].state, "min");
	assert.equal(rollBreakdown({ dice: [], total: 10 }), null);
	assert.equal(rollBreakdown(null), null);
});

test("CR-18: pastilhas de dados — maior verde, 1 vermelho, descartado apagado", () => {
	const chipsOf = diceChips([{ result: 6 }, { result: 3 }, { result: 1 }, { result: 6, active: false }, { result: 4, discarded: true }], 6);
	assert.deepEqual(chipsOf.map((chip) => chip.state), ["max", "", "min", "off", "off"]);
	assert.deepEqual(chipsOf.map((chip) => chip.value), [6, 3, 1, 6, 4]);
	assert.deepEqual(diceChips(null, 6), []);
});

test("CR-18/20: extrai os dados de uma rolagem e soma só o que valeu", () => {
	const roll = { total: 33, dice: [{ faces: 6, results: [{ result: 6, active: true }, { result: 3, active: true }] }, { faces: 4, results: [{ result: 2, active: false }, { result: 4, active: true }] }] };
	const dice = extractDice(roll);
	assert.equal(dice.length, 2);
	assert.deepEqual(dice[1].results, [{ result: 2, active: false }, { result: 4, active: true }]);
	assert.equal(activeSum(dice), 13);
	assert.equal(roll.total - activeSum(dice), 20, "o resto do total é o bônus fixo");
	assert.deepEqual(extractDice({ dice: [{ faces: 6, results: [] }] }), []);
	assert.deepEqual(extractDice(null), []);
});

test("CR-17: texto da conta do dado", () => {
	assert.equal(breakdownText({ die: 12, bonus: 7, others: [], crit: null }), "d20 12 + 7");
	assert.equal(breakdownText({ die: 12, bonus: -2, others: [], crit: null }), "d20 12 − 2");
	assert.equal(breakdownText({ die: 15, bonus: 0, others: [4], crit: null }), "d20 15 (4)");
	assert.equal(breakdownText(null), "");
});

test("CR-22: a carta só tem os testes do conjurador; resistência de criatura não entra", () => {
	const blocks = testBlocks({
		occultism: { dt: 25, total: 19, success: false, breakdown: { die: 12, bonus: 7, others: [], crit: null } },
		resistances: [{ name: "Cultista", skill: "Fortitude", total: 14, dt: 21, success: false }],
	});
	assert.equal(blocks.length, 1);
	assert.deepEqual([blocks[0].kind, blocks[0].total, blocks[0].dt, blocks[0].success], ["occultism", 19, 25, false]);
	assert.deepEqual(testBlocks({}), []);
	assert.deepEqual(testBlocks({ concentration: { dt: 15, total: 9, success: false }, occultism: { dt: 21, total: 25, success: true } }).map((block) => block.kind), ["concentration", "occultism"]);
});

test("CR-20: dano rolado — total, tipos e pastilhas de cada dado", () => {
	const view = damageView({
		kind: "damage", total: 16,
		parts: [{ type: "eletricDamage", formula: "3d6", total: 16, flat: 0, dice: [{ faces: 6, results: [{ result: 6, active: true }, { result: 5, active: true }, { result: 5, active: true }] }] }],
	});
	assert.equal(view.total, 16);
	assert.equal(view.kind, "damage");
	assert.equal(view.groups.length, 1);
	assert.deepEqual(view.groups[0].dice[0].chips.map((chip) => chip.state), ["max", "", ""]);
	assert.equal(view.groups[0].formula, "3d6");
});

test("CR-20: mais de um tipo de dano agrupa com o subtotal de cada", () => {
	const view = damageView({ total: 14, parts: [{ type: "fire", total: 8, dice: [] }, { type: "cut", total: 6, dice: [], flat: 2 }] });
	assert.deepEqual(view.groups.map((group) => [group.type, group.subtotal, group.flat]), [["fire", 8, 0], ["cut", 6, 2]]);
});

test("CR-21: cura usa o mesmo bloco; sem rolagem não há bloco", () => {
	assert.equal(damageView({ kind: "healing", total: 5, parts: [] }).kind, "healing");
	assert.equal(damageView(null), null);
	assert.equal(damageView({ parts: [] }), null);
});

test("CR-19: o ritual com dano ou cura rolados pede o botão", () => {
	assert.equal(damageGate({ ruleDamage: true }), "damage");
	assert.equal(damageGate({ effect: { kind: "healing", formula: "2d8" } }), "healing");
	assert.equal(damageGate({ effect: { kind: "damage", formula: "1d6" } }), "damage");
	assert.equal(damageGate({ effect: { kind: "damage" } }), null);
	assert.equal(damageGate({}), null);
	assert.equal(damageButtonLabel("healing"), "Rolar cura");
	assert.equal(damageButtonLabel("damage"), "Rolar dano");
});

test("CR-06: sucesso e falha do Ocultismo não têm faixa; os estados sem teste têm", () => {
	assert.equal(resultBanner({ occultism: { success: false }, extra: { amount: 5 }, effects: ["x"] }), null);
	assert.equal(resultBanner({ occultism: { success: true }, effects: ["x"] }), null);
	assert.equal(resultBanner({}), null);
	assert.equal(resultBanner({ interrupted: true }).label, "Concentração perdida");
	assert.equal(resultBanner({ pending: true }).state, "ready");
	assert.equal(resultBanner({ effectsPending: true }).state, "gm");
	assert.equal(resultBanner({ areaManual: true }).state, "gm");
	for (const key of ["awaitingCurse", "awaitingArea", "awaitingTargets"]) {
		const banner = resultBanner({ [key]: true });
		assert.equal(banner.state, "waiting", key);
		assert.ok(banner.text.length > 10, key);
	}
});

test("CR-08: fichas de custo (com o extra), DT e alvo", () => {
	assert.deepEqual(chips({ cost: 5, extra: 5, dt: 25, targetNames: ["Cultista"] }).map((chip) => [chip.kind, chip.text, chip.extra ?? ""]), [
		["cost", "5 PD", "+5"], ["dt", "DT 25", ""], ["target", "Cultista", ""],
	]);
	assert.equal(chips({ cost: 1 })[0].extra, "");
	assert.equal(chips({ cost: 1 }).length, 1, "sem teste não há ficha de DT");
	assert.equal(chips({ cost: 1, dt: 21, concentrationDt: 15 }).map((chip) => chip.text).join("|"), "1 PD|DT 21|Conc. DT 15");
	assert.equal(chips({ cost: 1, targetNames: ["A", "B"] })[1].text, "A, B");
	const many = chips({ cost: 1, targetNames: ["A", "B", "C", "D"] })[1];
	assert.equal(many.text, "4 alvos");
	assert.equal(many.title, "A, B, C, D");
});

test("CR-28: o custo extra nunca passa do PD que o agente tem", () => {
	assert.deepEqual(extraCostCharge(5, 20), { charged: 5, missing: 0 });
	assert.deepEqual(extraCostCharge(5, 3), { charged: 3, missing: 2 });
	assert.deepEqual(extraCostCharge(5, 0), { charged: 0, missing: 5 });
	assert.deepEqual(extraCostCharge(-2, 10), { charged: 0, missing: 0 });
	assert.deepEqual(extraCostCharge("x", "y"), { charged: 0, missing: 0 });
});

test("CR-10: frase do efeito tem no máximo 140 caracteres e não parte palavra", () => {
	assert.equal(firstSentence("Você domina a mente do alvo. Ele obedece."), "Você domina a mente do alvo.");
	const long = firstSentence(`${"palavra ".repeat(40)}fim.`);
	assert.ok(long.length <= 140);
	assert.ok(long.endsWith("…"));
	assert.doesNotMatch(long, /palavr…$/);
	assert.equal(firstSentence(""), "");
	assert.equal(firstSentence(null), "");
});

test("CR-10: a frase usa o efeito aplicado; sem ele, o texto base", () => {
	assert.equal(effectSentence({ effects: ["Arma amaldiçoada: +2d6 até o fim da cena."], baseText: "Texto base." }), "Arma amaldiçoada: +2d6 até o fim da cena.");
	assert.equal(effectSentence({ effects: [], baseText: "Texto base. Segunda." }), "Texto base.");
	assert.equal(effectSentence({}), "");
});

test("cartão: ícone por tipo de dano e linha do PD gasto nos Detalhes", () => {
	assert.equal(damageTypeIcon("eletricDamage"), "bolt-lightning");
	assert.equal(damageTypeIcon("fireDamage"), "fire");
	assert.equal(damageTypeIcon("tipoNovo"), "burst", "tipo desconhecido usa o ícone genérico");
	assert.equal(costNote({ cost: 1 }), "Gastou 1 PD");
	assert.equal(costNote({ cost: 3, extra: 1 }), "Gastou 4 PD (3 de custo + 1 pela falha)");
	assert.equal(costNote({}), "");
});
