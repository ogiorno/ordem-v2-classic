import { test } from "node:test";
import assert from "node:assert/strict";
import { addAttempt, buildSaveRecord, damageForMode, damageMode, effectApplies, resolveManually, resolveSaves, resolveSkillKey, saveReadiness, savePassed } from "../../module/helpers/threat-ability-resistance.mjs";
import { validateExecution } from "../../module/helpers/threat-ability-execution.mjs";

const save = (extra = {}) => ({ skill: "reflexes", dc: 18, onSuccess: "half", retry: false, ...extra });

test("empate com a DT passa; um ponto abaixo falha", () => {
	assert.equal(savePassed(18, 18), true);
	assert.equal(savePassed(17, 18), false);
	assert.equal(savePassed(30, 18), true);
});

test("perícias em português e em inglês resolvem para a chave do sistema", () => {
	assert.equal(resolveSkillKey("Reflexos"), "reflexes");
	assert.equal(resolveSkillKey("reflexes"), "reflexes");
	assert.equal(resolveSkillKey("Fortitude"), "resilience");
	assert.equal(resolveSkillKey(" Vontade "), "will");
	assert.equal(resolveSkillKey("xyz"), null);
	assert.equal(resolveSkillKey(""), null);
});

test("resultado segue a configuração: metade, anula, sem redução", () => {
	assert.equal(damageMode(save({ onSuccess: "half" }), true), "half");
	assert.equal(damageMode(save({ onSuccess: "negate" }), true), "negate");
	assert.equal(damageMode(save({ onSuccess: "none" }), true), "full");
	assert.equal(damageMode(save({ onSuccess: "half" }), false), "full");
	assert.equal(damageMode(save(), null), "full");
	assert.equal(damageMode(null, true), "full");
	assert.equal(damageForMode(15, "half"), 7);
	assert.equal(damageForMode(15, "negate"), 0);
	assert.equal(damageForMode(15, "full"), 15);
	assert.equal(damageForMode(-3, "full"), 0);
});

test("efeito só na falha, só no sucesso ou sempre; sem resultado fica para o Mestre", () => {
	assert.equal(effectApplies({ onSave: "fail" }, false), true);
	assert.equal(effectApplies({ onSave: "fail" }, true), false);
	assert.equal(effectApplies({ onSave: "success" }, true), true);
	assert.equal(effectApplies({ onSave: "always" }, true), true);
	assert.equal(effectApplies({}, false), true);
	assert.equal(effectApplies({ onSave: "fail" }, null), false);
});

test("múltiplos alvos têm resultados independentes", () => {
	const r = resolveSaves({ save: save(), targets: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }], rolls: { a: 25, b: 9, c: 18 } });
	assert.equal(r.ok, true);
	const by = Object.fromEntries(r.records.map((x) => [x.targetId, x]));
	assert.deepEqual([by.a.passed, by.a.mode], [true, "half"]);
	assert.deepEqual([by.b.passed, by.b.mode], [false, "full"]);
	assert.deepEqual([by.c.passed, by.c.mode], [true, "half"]); // empate
	assert.equal(by.a.dc, 18);
	assert.equal(by.a.skill, "reflexes");
	assert.equal(by.a.attempts[0].total, 25);
});

test("DT ausente, perícia desconhecida ou sem resistência impedem a automação", () => {
	assert.deepEqual(saveReadiness(save({ dc: null })), { ok: false, reason: "missing-dc" });
	assert.deepEqual(saveReadiness(save({ dc: 0 })), { ok: false, reason: "missing-dc" });
	assert.deepEqual(saveReadiness(save({ skill: "xyz" })), { ok: false, reason: "unknown-skill" });
	assert.deepEqual(saveReadiness(null), { ok: false, reason: "no-save" });
	const r = resolveSaves({ save: save({ dc: null }), targets: [{ id: "a" }], rolls: { a: 99 } });
	assert.equal(r.ok, false);
	assert.equal(r.records[0].status, "unavailable");
	assert.equal(r.records[0].reason, "missing-dc");
	assert.equal(r.records[0].passed, null);
});

test("o validador de execução recusa perícia desconhecida (sem inferir)", () => {
	const e = { mode: "active", automation: "automatic", save: { skill: "xyz", dc: 18 } };
	const r = validateExecution(e, { activation: "standard" });
	assert.ok(r.errors.some((x) => x.path === "save.skill" && x.code === "unknown-skill"));
	assert.equal(r.effective, "manual");
});

test("alvo sem rolagem fica pendente e o Mestre informa o total", () => {
	const rec = buildSaveRecord({ save: save(), targetId: "a", name: "A", total: null });
	assert.deepEqual([rec.status, rec.passed], ["pending", null]);
	const done = resolveManually(rec, save(), 20);
	assert.equal(done.ok, true);
	assert.deepEqual([done.record.status, done.record.passed, done.record.mode], ["resolved", true, "half"]);
	assert.equal(done.record.attempts[0].source, "manual");
	assert.equal(resolveManually(done.record, save(), 5).ok, false);
});

test("novas tentativas só quando permitidas; valem as mais recentes e o histórico fica", () => {
	const s = save({ retry: true, onSuccess: "negate" });
	const rec = buildSaveRecord({ save: s, targetId: "a", total: 10 });
	assert.deepEqual([rec.passed, rec.mode], [false, "full"]);
	const again = addAttempt(rec, s, { total: 22, rollRef: "msg2" });
	assert.equal(again.ok, true);
	assert.deepEqual([again.record.passed, again.record.mode, again.record.attempts.length], [true, "negate", 2]);
	assert.equal(again.record.attempts[1].rollRef, "msg2");
	assert.equal(again.record.attempts[0].total, 10);
	const noRetry = addAttempt(buildSaveRecord({ save: save(), targetId: "a", total: 10 }), save(), { total: 22 });
	assert.deepEqual([noRetry.ok, noRetry.reason], [false, "no-retry"]);
	assert.equal(addAttempt({ status: "unavailable" }, s, { total: 5 }).ok, false);
});
