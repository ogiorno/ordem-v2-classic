import { test } from "node:test";
import assert from "node:assert/strict";
import { canSee, executionAuthority, findSecrets, htmlLeaks, mayApplyPanel, mayResolveRequest, ownerNote, recipients, resolveRollMode, stripSecrets, visibilityOf } from "../../module/helpers/threat-ability-visibility.mjs";
import { createRow, beginApply, markApplied, createPanel, publicLine } from "../../module/helpers/threat-ability-panel.mjs";
import { previewChange, auditRecord } from "../../module/helpers/threat-ability-damage.mjs";

const gm = { id: "gm1", isGM: true }, gm2 = { id: "gm2", isGM: true }, player = { id: "p1", isGM: false }, other = { id: "p2", isGM: false };
const threat = (owners = []) => ({ type: "threat", testUserPermission: (u) => owners.includes(u.id) });
const agent = (owners = []) => ({ type: "agent", testUserPermission: (u) => owners.includes(u.id) });

test("jogador sem permissão não executa; dono de ameaça delega ao Mestre ativo", () => {
	assert.deepEqual(executionAuthority({ user: player, actor: threat(), activeGmId: "gm1" }), { allowed: false, reason: "not-authorized" });
	assert.deepEqual(executionAuthority({ user: other, actor: threat(["p1"]), activeGmId: "gm1" }), { allowed: false, reason: "not-authorized" });
	assert.deepEqual(executionAuthority({ user: player, actor: threat(["p1"]), activeGmId: "gm1" }), { allowed: true, mode: "delegate", resolver: "gm1" });
	assert.equal(executionAuthority({ user: player, actor: agent(["p1"]), activeGmId: "gm1" }).reason, "not-a-threat");
});

test("multi-GM: só o Mestre ativo resolve; os outros delegam", () => {
	assert.deepEqual(executionAuthority({ user: gm, actor: threat(), activeGmId: "gm1" }), { allowed: true, mode: "local", resolver: "gm1" });
	assert.deepEqual(executionAuthority({ user: gm2, actor: threat(), activeGmId: "gm1" }), { allowed: true, mode: "delegate", resolver: "gm1" });
	assert.equal(mayResolveRequest({ user: gm, activeGmId: "gm1" }), true);
	assert.equal(mayResolveRequest({ user: gm2, activeGmId: "gm1" }), false);
	assert.equal(mayResolveRequest({ user: player, activeGmId: "gm1" }), false);
});

test("permissão ausente: sem Mestre ativo, sem usuário ou sem ator", () => {
	assert.equal(executionAuthority({ user: gm, actor: threat(), activeGmId: null }).reason, "no-active-gm");
	assert.equal(executionAuthority({ user: null, actor: threat(), activeGmId: "gm1" }).reason, "missing-context");
	assert.equal(executionAuthority({ user: gm, actor: null, activeGmId: "gm1" }).reason, "missing-context");
	assert.equal(mayApplyPanel(gm), true);
	assert.equal(mayApplyPanel(player), false);
	assert.equal(mayApplyPanel(null), false);
});

test("níveis de visibilidade: Mestre vê tudo, dono vê o seu, público só o público", () => {
	const v = (isGM, ownsTarget) => ({ isGM, ownsTarget });
	assert.deepEqual(["gm", "owner", "public"].map((l) => canSee(l, v(true, false))), [true, true, true]);
	assert.deepEqual(["gm", "owner", "public"].map((l) => canSee(l, v(false, true))), [false, true, true]);
	assert.deepEqual(["gm", "owner", "public"].map((l) => canSee(l, v(false, false))), [false, false, true]);
	assert.deepEqual(visibilityOf({}), { dc: "gm", defense: "gm", result: "public" });
	assert.deepEqual(visibilityOf({ visibility: { dc: "owner", result: "gm" } }), { dc: "owner", defense: "gm", result: "gm" });
});

test("modo de rolagem: vale o mais restritivo entre a habilidade e a mesa", () => {
	assert.equal(resolveRollMode({ result: "public", tableMode: "publicroll" }), "publicroll");
	assert.equal(resolveRollMode({ result: "public", tableMode: "gmroll" }), "gmroll");
	assert.equal(resolveRollMode({ result: "public", tableMode: "blindroll" }), "blindroll");
	assert.equal(resolveRollMode({ result: "gm", tableMode: "publicroll" }), "gmroll");
	assert.equal(resolveRollMode({ result: "owner", tableMode: "publicroll" }), "gmroll");
	assert.equal(resolveRollMode({ result: "gm", tableMode: "selfroll" }), "selfroll");
});

test("destinatários: Mestres sempre; dono só em 'owner'; público = lista vazia", () => {
	const users = [gm, gm2, player, other];
	assert.deepEqual(recipients({ level: "gm", targetActor: agent(["p1"]), users }), ["gm1", "gm2"]);
	assert.deepEqual(recipients({ level: "owner", targetActor: agent(["p1"]), users }), ["gm1", "gm2", "p1"]);
	assert.deepEqual(recipients({ level: "public", targetActor: agent(["p1"]), users }), []);
	assert.deepEqual(recipients({ level: "owner", targetActor: threat(), users }), ["gm1", "gm2"]);
});

test("flags e payload públicos não carregam segredos; detecção e remoção", () => {
	const panel = { rows: [{ save: { dc: 18, attempts: [{ total: 9 }] }, changes: [{ finalDamage: 4, original: 4 }] }] };
	const secrets = findSecrets(panel);
	for (const k of ["rows[0].save", "rows[0].save.dc", "rows[0].save.attempts", "rows[0].changes[0].finalDamage", "rows[0].changes[0].original"]) assert.ok(secrets.includes(k), k);
	assert.deepEqual(findSecrets(stripSecrets(panel)), []);
	assert.deepEqual(findSecrets({ itemName: "X", conditions: ["Surdo"] }), []);
	assert.equal(htmlLeaks("<p>Agente sofreu dano por Mal Sintonizado.</p>"), false);
	assert.equal(htmlLeaks("<p>Reflexos contra DT 18</p>"), true);
	assert.equal(htmlLeaks("Defesa 25"), true);
});

test("nota pública do painel não vaza; nota do dono mostra só a mudança na própria ficha", () => {
	const snap = { type: "agent", system: { PV: { value: 10, max: 10 }, resistances: {} } };
	const change = previewChange({ entry: { kind: "damage", formula: "4", type: "energia", resource: "pv", roll: "once" }, rolled: 4, snapshot: snap });
	const row = markApplied(beginApply(createRow({ targetId: "a", name: "Agente A", save: { passed: false, dc: 18 }, changes: [change], effects: [{ applies: true, condition: { label: "Surdo" } }] })), { records: [auditRecord({ source: "H", targetId: "a", targetName: "A", change: { ...change, after: 6 } })], effectIds: [] });
	const pub = publicLine(row, "Mal Sintonizado");
	assert.equal(htmlLeaks(pub), false);
	assert.doesNotMatch(pub, /\d/);
	const note = ownerNote({ itemName: "Mal Sintonizado", row });
	assert.equal(note, "Mal Sintonizado: PV: 10 → 6; Surdo.");
	assert.equal(htmlLeaks(note), false);
	assert.equal(ownerNote({ itemName: "X", row, level: "gm" }), null);
	assert.equal(ownerNote({ itemName: "X", row: createRow({ targetId: "z", name: "Z" }) }), null);
	assert.deepEqual(findSecrets(createPanel({ executionId: "e", itemName: "X", sourceActorId: "s", sourceName: "S", rows: [] })), []);
});

test("armazenamento privado do painel: grava, lê cópia, apaga, poda e tolera armazenamento ruim", async () => {
	const { PanelStore } = await import("../../module/helpers/threat-ability-panel-store.mjs");
	const mem = new Map();
	const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
	let t = 1000;
	const store = new PanelStore(storage, { worldId: "w", userId: "gm1", now: () => t });
	const panel = { rows: [{ save: { dc: 18 } }] };
	assert.equal(store.set("p1", panel), true);
	const read = store.get("p1");
	assert.deepEqual(read, panel);
	read.rows[0].save.dc = 99; // cópia: não altera o guardado
	assert.equal(store.get("p1").rows[0].save.dc, 18);
	assert.deepEqual(store.ids(), ["p1"]);
	// chave separada por mundo e usuário (outro Mestre/mundo não enxerga)
	assert.equal(new PanelStore(storage, { worldId: "w", userId: "gm2" }).get("p1"), null);
	assert.equal(new PanelStore(storage, { worldId: "w2", userId: "gm1" }).get("p1"), null);
	// poda de painéis com mais de 30 dias
	t += 1000 * 60 * 60 * 24 * 31;
	store.set("novo", { rows: [] });
	assert.equal(store.prune(), 1);
	assert.deepEqual(store.ids(), ["novo"]);
	assert.equal(store.delete("novo"), true);
	assert.equal(store.delete("novo"), false);
	// JSON corrompido e escrita que falha não quebram
	mem.set(store.key, "{não é json");
	assert.equal(store.get("x"), null);
	const broken = new PanelStore({ getItem: () => null, setItem: () => { throw new Error("cota"); }, removeItem() {} }, { worldId: "w", userId: "u" });
	assert.equal(broken.set("a", {}), false);
});
