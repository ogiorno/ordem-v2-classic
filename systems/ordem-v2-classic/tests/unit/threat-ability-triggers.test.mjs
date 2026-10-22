import { test } from "node:test";
import assert from "node:assert/strict";
import { addLink, canFire, claimForTargets, claimFire, cleanupScene, emptyState, endPersistent, fireKey, isLinked, pruneCombat, removeLink, scopeKey } from "../../module/helpers/threat-ability-triggers.mjs";
import { validateExecution } from "../../module/helpers/threat-ability-execution.mjs";

const exec = (over = {}) => ({ mode: "triggered", trigger: { event: "turnStart", owner: "self" }, requirements: [], ...over });
const ctx = (over = {}) => ({ event: "turnStart", ownerRelation: "self", inCombat: true, sceneId: "s1", combatId: "c1", round: 2, turn: 0, ...over });

test("evento explícito: só dispara no evento configurado e para o dono certo", () => {
	assert.equal(canFire({ execution: exec(), executionId: "x", ctx: ctx(), state: emptyState() }).ok, true);
	assert.equal(canFire({ execution: exec(), executionId: "x", ctx: ctx({ event: "turnEnd" }), state: emptyState() }).reason, "wrong-event");
	assert.equal(canFire({ execution: exec(), executionId: "x", ctx: ctx({ ownerRelation: "target" }), state: emptyState() }).reason, "wrong-owner");
	assert.equal(canFire({ execution: exec({ trigger: { event: "turnStart", owner: "any" } }), executionId: "x", ctx: ctx({ ownerRelation: "target" }), state: emptyState() }).ok, true);
	assert.equal(canFire({ execution: { mode: "triggered" }, executionId: "x", ctx: ctx(), state: emptyState() }).reason, "no-trigger");
});

test("não duplica: o mesmo turno só dispara uma vez; turno seguinte dispara", () => {
	const first = claimFire({ execution: exec(), executionId: "x", ctx: ctx(), state: emptyState(), now: 1 });
	assert.equal(first.claimed, true);
	const again = claimFire({ execution: exec(), executionId: "x", ctx: ctx(), state: first.state });
	assert.deepEqual([again.claimed, again.reason], [false, "duplicate"]);
	assert.equal(claimFire({ execution: exec(), executionId: "x", ctx: ctx({ round: 3 }), state: first.state }).claimed, true);
	assert.equal(claimFire({ execution: exec(), executionId: "y", ctx: ctx(), state: first.state }).claimed, true); // outra execução
});

test("concorrência: sequencial vence uma vez; leitura velha repetiria, por isso o runner serializa", () => {
	const base = emptyState();
	const a = claimFire({ execution: exec(), executionId: "x", ctx: ctx(), state: base });
	const b = claimFire({ execution: exec(), executionId: "x", ctx: ctx(), state: a.state });
	assert.deepEqual([a.claimed, b.claimed, b.reason], [true, false, "duplicate"]);
	assert.deepEqual(base, emptyState()); // estado original intacto (sem mutação)
	// duas leituras do mesmo estado antigo concederiam os dois: só a serialização do runner impede
	assert.equal(claimFire({ execution: exec(), executionId: "x", ctx: ctx(), state: base }).claimed, true);
});

test("limite por cena persiste no estado; cena nova libera; cleanup remove", () => {
	const e = exec({ requirements: [{ kind: "perScene", count: 1 }] });
	let s = claimFire({ execution: e, executionId: "x", ctx: ctx(), state: emptyState() }).state;
	const next = claimFire({ execution: e, executionId: "x", ctx: ctx({ round: 3 }), state: s });
	assert.deepEqual([next.claimed, next.reason], [false, "scene-limit"]);
	assert.equal(claimFire({ execution: e, executionId: "x", ctx: ctx({ sceneId: "s2", round: 3 }), state: s }).claimed, true);
	s = cleanupScene(s, "s1");
	assert.equal(claimFire({ execution: e, executionId: "x", ctx: ctx({ round: 4 }), state: s }).claimed, true);
	const twice = exec({ requirements: [{ kind: "perScene", count: 2 }] });
	let t = claimFire({ execution: twice, executionId: "x", ctx: ctx(), state: emptyState() }).state;
	t = claimFire({ execution: twice, executionId: "x", ctx: ctx({ round: 3 }), state: t }).state;
	assert.equal(claimFire({ execution: twice, executionId: "x", ctx: ctx({ round: 4 }), state: t }).reason, "scene-limit");
});

test("limite por rodada (reação uma vez por rodada)", () => {
	const e = exec({ trigger: { event: "reaction", owner: "any" }, requirements: [{ kind: "perRound", count: 1 }] });
	const c1 = ctx({ event: "reaction", turn: 0 });
	let s = claimFire({ execution: e, executionId: "x", ctx: c1, state: emptyState() }).state;
	assert.equal(claimFire({ execution: e, executionId: "x", ctx: { ...c1, turn: 1 }, state: s }).reason, "round-limit");
	assert.equal(claimFire({ execution: e, executionId: "x", ctx: { ...c1, round: 3 }, state: s }).claimed, true);
	s = pruneCombat(s, "c1");
	assert.deepEqual(s.uses, {});
});

test("pré-requisitos: combate, narrativo e vínculo", () => {
	assert.equal(canFire({ execution: exec({ requirements: [{ kind: "combat" }] }), executionId: "x", ctx: ctx({ inCombat: false }), state: emptyState() }).reason, "needs-combat");
	assert.equal(canFire({ execution: exec({ requirements: [{ kind: "narrative", text: "se estiver à vista" }] }), executionId: "x", ctx: ctx(), state: emptyState() }).reason, "needs-gm-confirmation");
	const e = exec({ trigger: { event: "manual", owner: "any" }, requirements: [{ kind: "affectedBy", ref: "falsa-nostalgia" }] });
	const c = ctx({ event: "manual", targetId: "alvo" });
	assert.equal(canFire({ execution: e, executionId: "abs", ctx: c, state: emptyState() }).reason, "not-linked");
	const linked = addLink(emptyState(), { ref: "falsa-nostalgia", sourceId: "desalento", targetId: "alvo", sceneId: "s1" });
	assert.equal(isLinked(linked, { ref: "falsa-nostalgia", targetId: "alvo" }), true);
	assert.equal(canFire({ execution: e, executionId: "abs", ctx: c, state: linked }).ok, true);
	assert.equal(canFire({ execution: e, executionId: "abs", ctx: { ...c, targetId: "outro" }, state: linked }).reason, "not-linked");
});

test("remover o vínculo invalida usos futuros sem apagar disparos já resolvidos", () => {
	const e = exec({ trigger: { event: "manual", owner: "any" }, requirements: [{ kind: "affectedBy", ref: "fn" }] });
	const c = ctx({ event: "manual", targetId: "alvo" });
	let s = addLink(emptyState(), { ref: "fn", sourceId: "d", targetId: "alvo" });
	s = claimFire({ execution: e, executionId: "abs", ctx: c, state: s, now: 5 }).state;
	const key = fireKey("abs", c);
	s = removeLink(s, { ref: "fn", targetId: "alvo" });
	assert.equal(s.fired[key], 5); // histórico mantido
	assert.equal(canFire({ execution: e, executionId: "abs", ctx: { ...c, round: 9 }, state: s }).reason, "not-linked");
	assert.equal(addLink(addLink(emptyState(), { ref: "a", sourceId: "s", targetId: "t" }), { ref: "a", sourceId: "s", targetId: "t" }).links.length, 1);
});

test("vários alvos: uso contado uma vez, cada alvo uma vez, só os vinculados", () => {
	const e = exec({ trigger: { event: "manual", owner: "any" }, requirements: [{ kind: "perScene", count: 1 }, { kind: "affectedBy", ref: "fn" }] });
	let s = addLink(addLink(emptyState(), { ref: "fn", sourceId: "d", targetId: "a" }), { ref: "fn", sourceId: "d", targetId: "b" });
	const r = claimForTargets({ execution: e, executionId: "x", ctx: ctx({ event: "manual" }), targetIds: ["a", "b", "c"], state: s });
	assert.deepEqual(r.claimed, ["a", "b"]);
	assert.deepEqual(r.skipped, [{ targetId: "c", reason: "not-linked" }]);
	const again = claimForTargets({ execution: e, executionId: "x", ctx: ctx({ event: "manual", round: 5 }), targetIds: ["a"], state: r.state });
	assert.equal(again.claimed.length, 0);
	assert.equal(again.skipped[0].reason, "scene-limit");
	const dup = claimForTargets({ execution: exec(), executionId: "x", ctx: ctx(), targetIds: ["a", "a"], state: emptyState() });
	assert.deepEqual([dup.claimed, dup.skipped.map((x) => x.reason)], [["a"], ["duplicate"]]);
});

test("persistente encerra sob comando e deixa de disparar", () => {
	const e = exec({ trigger: { event: "turnStart", owner: "any" } });
	let s = claimFire({ execution: e, executionId: "zona", ctx: ctx(), state: emptyState() }).state;
	s = endPersistent(s, "zona");
	assert.equal(canFire({ execution: e, executionId: "zona", ctx: ctx({ round: 9 }), state: s }).reason, "ended");
});

test("troca de cena nos escopos de chave", () => {
	assert.notEqual(scopeKey({ event: "manual", sceneId: "s1" }), scopeKey({ event: "manual", sceneId: "s2" }));
	assert.equal(scopeKey({ event: "manual", sceneId: "s1", round: 1 }), scopeKey({ event: "manual", sceneId: "s1", round: 1 }));
	assert.notEqual(scopeKey({ event: "manual", sceneId: "s1", round: 1 }), scopeKey({ event: "manual", sceneId: "s1", round: 2 }));
	assert.notEqual(scopeKey({ event: "turnStart", combatId: "c", round: 1, turn: 0 }), scopeKey({ event: "turnStart", combatId: "c", round: 1, turn: 1 }));
});

test("validador de execução: gatilho exige evento válido; limite deve ser inteiro; vínculo exige origem", () => {
	const act = { activation: "free" };
	assert.ok(validateExecution({ mode: "triggered", automation: "assisted" }, act).errors.some((e) => e.path === "trigger"));
	assert.ok(validateExecution({ mode: "triggered", trigger: { event: "x" } }, act).errors.some((e) => e.path === "trigger.event"));
	assert.deepEqual(validateExecution({ mode: "triggered", automation: "assisted", trigger: { event: "turnStart" } }, act).errors, []);
	assert.ok(validateExecution({ mode: "active", requirements: [{ kind: "perScene", count: 0 }] }, act).errors.some((e) => e.code === "invalid-count"));
	assert.ok(validateExecution({ mode: "active", requirements: [{ kind: "affectedBy", ref: "" }] }, act).errors.some((e) => e.path === "requirements[0].ref"));
});

test("executionId com pontos (UUID do item) não vira chave aninhada ao gravar flags", () => {
	const e = exec({ requirements: [{ kind: "perScene", count: 1 }] });
	const id = "Actor.abc.Item.def";
	const r = claimFire({ execution: e, executionId: id, ctx: ctx(), state: emptyState() });
	const stored = JSON.parse(JSON.stringify(r.state));
	for (const bag of [stored.fired, stored.uses]) for (const key of Object.keys(bag)) assert.ok(!key.includes("."), key);
	assert.equal(claimFire({ execution: e, executionId: id, ctx: ctx(), state: stored }).reason, "duplicate");
	const ended = endPersistent(stored, id);
	assert.ok(Object.keys(ended.ended).every((k) => !k.includes(".")));
	assert.equal(canFire({ execution: e, executionId: id, ctx: ctx({ round: 9 }), state: ended }).reason, "ended");
});

test("uso manual pelo botão Usar: habilidade ativa sem gatilho vale como evento manual; limites contam", () => {
	const e = { mode: "active", requirements: [{ kind: "perScene", count: 1 }] };
	const c = { event: "manual", sceneId: "s1", combatId: null, round: null, turn: 1 };
	const first = claimFire({ execution: e, executionId: "Actor.a.Item.i", ctx: c, state: emptyState() });
	assert.equal(first.claimed, true);
	assert.equal(claimFire({ execution: e, executionId: "Actor.a.Item.i", ctx: { ...c, turn: 2 }, state: first.state }).reason, "scene-limit");
	assert.equal(canFire({ execution: { mode: "triggered" }, executionId: "x", ctx: c, state: emptyState() }).reason, "no-trigger");
});

test("pré-requisito narrativo passa quando o Mestre confirma", () => {
	const e = { mode: "active", requirements: [{ kind: "narrative", text: "alvo à vista" }] };
	const c = { event: "manual", sceneId: "s1", round: null, turn: 1 };
	assert.equal(canFire({ execution: e, executionId: "x", ctx: c, state: emptyState() }).reason, "needs-gm-confirmation");
	assert.equal(canFire({ execution: e, executionId: "x", ctx: c, state: emptyState(), confirmedNarrative: true }).ok, true);
	assert.equal(claimFire({ execution: e, executionId: "x", ctx: c, state: emptyState(), confirmedNarrative: true }).claimed, true);
	const many = claimForTargets({ execution: e, executionId: "x", ctx: c, targetIds: ["a", "b"], state: emptyState(), confirmedNarrative: true });
	assert.deepEqual(many.claimed, ["a", "b"]);
});

test("stableId: 16 caracteres base 62, determinístico e distinto entre chaves", async () => {
	const { stableId } = await import("../../module/helpers/threat-ability-triggers.mjs");
	const a = stableId("Actor.a.Item.i|turnStart|combat1|2|0");
	assert.match(a, /^[0-9A-Za-z]{16}$/);
	assert.equal(a, stableId("Actor.a.Item.i|turnStart|combat1|2|0"));
	const keys = ["x", "y", "Actor.a.Item.i|turnStart|combat1|2|1", "Actor.a.Item.i|turnStart|combat1|3|0", "Actor.b.Item.i|turnStart|combat1|2|0"];
	assert.equal(new Set(keys.map(stableId)).size, keys.length);
});
