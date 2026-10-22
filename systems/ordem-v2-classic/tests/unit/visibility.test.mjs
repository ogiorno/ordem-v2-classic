import { test } from "node:test";
import assert from "node:assert/strict";
import { damageRecipients, gmDefenseValue, hasDefenseFields, isAttackParticipant, shouldShowCombatantHP, shouldShowDefenseValue, stripDefenseFields } from "../../module/helpers/visibility.mjs";

const gm = { id: "gm", isGM: true };
const dono = { id: "dono", isGM: false };
const outro = { id: "outro", isGM: false };
const agente = (donos) => ({ type: "agent", testUserPermission: (u) => donos.includes(u.id) });

test("dano: ameaça só avisa o mestre; agente avisa mestre e dono", () => {
	assert.deepEqual(damageRecipients(agente([]), [gm, dono, outro]), ["gm"]);
	assert.deepEqual(damageRecipients(agente(["dono"]), [gm, dono, outro]), ["gm", "dono"]);
	assert.deepEqual(damageRecipients(null, [gm, dono]), ["gm"]);
	assert.deepEqual(damageRecipients(agente(["dono"]), null), []);
});

test("dano: não repete o mesmo usuário e o mestre nunca depende da permissão", () => {
	assert.deepEqual(damageRecipients(agente([]), [gm, gm]), ["gm"]);
	assert.deepEqual(damageRecipients({ type: "agent" }, [gm, dono]), ["gm"]);
});

test("PV no rastreador de combate: mestre vê tudo, jogador só o próprio agente, nunca ameaça", () => {
	assert.equal(shouldShowCombatantHP(null, true), false);
	assert.equal(shouldShowCombatantHP({ type: "threat" }, true), true);
	assert.equal(shouldShowCombatantHP({ type: "threat" }, false, true), false);
	assert.equal(shouldShowCombatantHP({ type: "agent" }, false, false), false);
	assert.equal(shouldShowCombatantHP({ type: "agent" }, false, true), true);
	assert.equal(shouldShowCombatantHP({ type: "agent" }, false), false);
});

test("número da Defesa: só o mestre, nem o dono do alvo", () => {
	assert.equal(shouldShowDefenseValue({ viewerIsGM: true }), true);
	assert.equal(shouldShowDefenseValue({ viewerIsGM: false, viewerOwnsTarget: true }), false);
	assert.equal(shouldShowDefenseValue({}), false);
});

test("stripDefenseFields tira Defesa do resultado e dos resultados aninhados sem mexer no original", () => {
	const hit = { hit: true, targetDefense: 15, baseDefense: 13, attackResults: [{ hit: false, targetDefense: 20, baseDefense: 18 }] };
	const limpo = stripDefenseFields(hit);
	assert.deepEqual(limpo, { hit: true, attackResults: [{ hit: false }] });
	assert.equal(hit.targetDefense, 15);
	assert.equal(hit.attackResults[0].baseDefense, 18);
	assert.equal(stripDefenseFields(null), null);
	assert.equal(stripDefenseFields(undefined), undefined);
	assert.equal(stripDefenseFields(7), 7);
});

test("hasDefenseFields enxerga o campo secreto na raiz e nos resultados aninhados", () => {
	assert.equal(hasDefenseFields({ targetDefense: 1 }), true);
	assert.equal(hasDefenseFields({ baseDefense: 0 }), true);
	assert.equal(hasDefenseFields({ attackResults: [{ hit: true }, { baseDefense: 9 }] }), true);
	assert.equal(hasDefenseFields({ hit: true, attackResults: [{ hit: true }] }), false);
	assert.equal(hasDefenseFields(null), false);
	assert.equal(hasDefenseFields("x"), false);
	assert.equal(hasDefenseFields(stripDefenseFields({ targetDefense: 1, attackResults: [{ baseDefense: 2 }] })), false);
});

test("Defesa mostrada ao mestre: valor da flag antiga vale mesmo sendo 0; senão Defesa atual + esquiva", () => {
	assert.equal(gmDefenseValue({ legacy: 12, live: 20, dodgeBonus: 5 }), 12);
	assert.equal(gmDefenseValue({ legacy: 0, live: 20 }), 0);
	assert.equal(gmDefenseValue({ legacy: null, live: 15, dodgeBonus: 3 }), 18);
	assert.equal(gmDefenseValue({ legacy: undefined, live: 15 }), 15);
	assert.equal(gmDefenseValue({ legacy: null, live: 0, dodgeBonus: 2 }), 2);
	assert.equal(gmDefenseValue({ legacy: null, live: null, dodgeBonus: 3 }), null);
	assert.equal(gmDefenseValue({ legacy: null, live: undefined }), null);
});

test("quem vê o resultado do ataque: mestre, quem atacou e dono do alvo; terceiros não", () => {
	assert.equal(isAttackParticipant({ viewerIsGM: true, viewerId: "x", attackerUserId: "y", viewerOwnsTarget: false }), true);
	assert.equal(isAttackParticipant({ viewerIsGM: false, viewerId: "u1", attackerUserId: "u1", viewerOwnsTarget: false }), true);
	assert.equal(isAttackParticipant({ viewerIsGM: false, viewerId: "u2", attackerUserId: "u1", viewerOwnsTarget: true }), true);
	assert.equal(isAttackParticipant({ viewerIsGM: false, viewerId: "u2", attackerUserId: "u1", viewerOwnsTarget: false }), false);
	assert.equal(isAttackParticipant({ viewerIsGM: false, viewerId: null, attackerUserId: null, viewerOwnsTarget: false }), false);
	assert.equal(isAttackParticipant({ viewerIsGM: false, viewerId: undefined, attackerUserId: undefined, viewerOwnsTarget: false }), false);
});
