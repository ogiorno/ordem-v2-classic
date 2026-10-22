import { test } from "node:test";
import assert from "node:assert/strict";
import { getDodgeReactionBonus, getReactionEligibility, getSkillBonus, hasReactionAvailable, isMeleeAttack, isTrainedIn, recomputeHit, shouldShowReactionButton } from "../../module/helpers/reaction-helpers.mjs";

const skill = (degree, mod = 0, value = 0) => ({ degree: { value: degree }, mod, value });
const agente = (skills = {}, attrs = {}) => ({ type: "agent", system: { skills, attributes: attrs } });
const corpo = { system: { types: { rangeType: { name: "melee" } } } };
const distancia = { system: { types: { rangeType: { name: "ranged" } } } };

test("corpo a corpo: pelo tipo de alcance; sem tipo, pela perícia Luta", () => {
	assert.equal(isMeleeAttack(corpo), true);
	assert.equal(isMeleeAttack(distancia), false);
	assert.equal(isMeleeAttack({ system: { formulas: { attack: { skill: "fighting" } } } }), true);
	assert.equal(isMeleeAttack({ system: { formulas: { attack: { skill: "aim" } } } }), false);
	assert.equal(isMeleeAttack({ system: { types: { rangeType: { name: "ranged" } }, formulas: { attack: { skill: "fighting" } } } }), false);
	assert.equal(isMeleeAttack(null), false);
});

test("treinado a partir do grau 5 (Treinado); grau 0 e ausente não", () => {
	assert.equal(isTrainedIn(agente({ reflexes: skill(5) }), "reflexes"), true);
	assert.equal(isTrainedIn(agente({ reflexes: skill(10) }), "reflexes"), true);
	assert.equal(isTrainedIn(agente({ reflexes: skill(0) }), "reflexes"), false);
	assert.equal(isTrainedIn(agente({ reflexes: skill(4) }), "reflexes"), false);
	assert.equal(isTrainedIn(agente({}), "reflexes"), false);
	assert.equal(isTrainedIn(null, "reflexes"), false);
});

test("bônus da perícia soma atributo + grau + mod + valor; atributo certo por perícia", () => {
	const a = agente({ reflexes: skill(5, 1, 2), resilience: skill(10, 0, 0), fighting: skill(5) }, { dex: { value: 3 }, vit: { value: 2 }, str: { value: 4 } });
	assert.equal(getSkillBonus(a, "reflexes"), 3 + 5 + 1 + 2);
	assert.equal(getSkillBonus(a, "resilience"), 2 + 10);
	assert.equal(getSkillBonus(a, "fighting"), 4 + 5);
	assert.equal(getSkillBonus(a, "inexistente"), 0);
	assert.equal(getSkillBonus(null, "reflexes"), 0);
});

test("Esquiva soma só a perícia Reflexos: AGI já está na Defesa e não pode contar duas vezes", () => {
	const a = agente({ reflexes: skill(5, 1, 2) }, { dex: { value: 9 } });
	assert.equal(getDodgeReactionBonus(a), 8);
	assert.equal(getDodgeReactionBonus(agente({})), 0);
	assert.equal(getDodgeReactionBonus(null), 0);
});

test("uma reação por rodada; fora de combate (rodada 0) sempre disponível", () => {
	assert.equal(hasReactionAvailable(null, 1), true);
	assert.equal(hasReactionAvailable(1, 1), false);
	assert.equal(hasReactionAvailable(1, 2), true);
	assert.equal(hasReactionAvailable(0, 0), true);
	assert.equal(hasReactionAvailable(5, 0), true);
});

test("elegibilidade: só agentes reagem", () => {
	const r = getReactionEligibility({ type: "threat" }, corpo, 1, null);
	for (const k of ["dodge", "block", "counterAttack"]) {
		assert.equal(r[k].eligible, false);
		assert.equal(r[k].reason, "notAgent");
	}
	assert.equal(getReactionEligibility(null, corpo, 1, null).dodge.reason, "notAgent");
});

test("elegibilidade: Esquiva vale contra qualquer ataque; Bloqueio e Contra-ataque só corpo a corpo", () => {
	const a = agente({ reflexes: skill(5), resilience: skill(5), fighting: skill(5) });
	const melee = getReactionEligibility(a, corpo, 1, null);
	assert.deepEqual([melee.dodge.eligible, melee.block.eligible, melee.counterAttack.eligible], [true, true, true]);
	const longe = getReactionEligibility(a, distancia, 1, null);
	assert.equal(longe.dodge.eligible, true);
	assert.deepEqual([longe.block.eligible, longe.block.reason], [false, "notMelee"]);
	assert.deepEqual([longe.counterAttack.eligible, longe.counterAttack.reason], [false, "notMelee"]);
});

test("elegibilidade: sem treino e reação já usada têm motivo próprio; sem treino vem antes", () => {
	const semTreino = getReactionEligibility(agente({ reflexes: skill(0), resilience: skill(0), fighting: skill(0) }), corpo, 1, 1);
	for (const k of ["dodge", "block", "counterAttack"]) assert.equal(semTreino[k].reason, "notTrained");
	const gasta = getReactionEligibility(agente({ reflexes: skill(5), resilience: skill(5), fighting: skill(5) }), corpo, 3, 3);
	for (const k of ["dodge", "block", "counterAttack"]) {
		assert.equal(gasta[k].eligible, false);
		assert.equal(gasta[k].reason, "alreadyUsed");
	}
	const naoGasta = getReactionEligibility(agente({ reflexes: skill(5) }), corpo, 4, 3);
	assert.equal(naoGasta.dodge.eligible, true);
});

test("elegibilidade informa o bônus mesmo quando a reação não é possível", () => {
	const a = agente({ reflexes: skill(0, 2, 1), resilience: skill(0, 1) }, { vit: { value: 3 } });
	const r = getReactionEligibility(a, corpo, 1, null);
	assert.equal(r.dodge.bonus, 3);
	assert.equal(r.block.bonus, 4);
	assert.equal(r.dodge.eligible, false);
});

test("recalcular o acerto contra a Defesa com a esquiva: empate acerta", () => {
	assert.deepEqual(recomputeHit(15, 15), { hit: true, targetDefense: 15 });
	assert.deepEqual(recomputeHit(15, 12, 5), { hit: false, targetDefense: 17 });
	assert.deepEqual(recomputeHit(17, 12, 5), { hit: true, targetDefense: 17 });
	assert.deepEqual(recomputeHit(10, 12, undefined), { hit: false, targetDefense: 12 });
});

test("botão de reação: dono ou mestre, nunca depois de aplicada; pular sempre aparece para quem pode", () => {
	const eligibility = { dodge: { eligible: true } };
	const ok = { type: "dodge", eligibility, isOwnerOfDefender: true, isGM: false };
	assert.equal(shouldShowReactionButton(ok), true);
	assert.equal(shouldShowReactionButton({ ...ok, isOwnerOfDefender: false, isGM: true }), true);
	assert.equal(shouldShowReactionButton({ ...ok, isOwnerOfDefender: false }), false);
	assert.equal(shouldShowReactionButton({ ...ok, alreadyApplied: true }), false);
	assert.equal(shouldShowReactionButton({ ...ok, type: "block" }), false);
	assert.equal(shouldShowReactionButton({ ...ok, type: "skip", eligibility: null }), true);
	assert.equal(shouldShowReactionButton({ ...ok, type: "skip", isOwnerOfDefender: false }), false);
});
