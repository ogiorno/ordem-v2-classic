import { test } from "node:test";
import assert from "node:assert/strict";
import { ROW_STATE, abortApply, applyAllPlan, beginApply, canApply, createPanel, createRow, editChange, effectiveAmount, markApplied, markIgnored, markRestored, markUndone, panelIssue, pendingCount, publicLine, restoreChange, rowEdited, undoCheck } from "../../module/helpers/threat-ability-panel.mjs";
import { previewChange, auditRecord } from "../../module/helpers/threat-ability-damage.mjs";

const agent = (pv = 20) => ({ type: "agent", system: { PV: { value: pv, max: 30 }, resistances: {} } });
const dmg = { kind: "damage", formula: "2d8", type: "energia", resource: "pv", roll: "once" };
const row = (name = "Agente A", over = {}) => createRow({
	targetId: name, name, save: { passed: false, mode: "full" },
	changes: [previewChange({ entry: dmg, rolled: 12, snapshot: agent() })],
	effects: [{ index: 0, applies: true, condition: { label: "Surdo" } }], ...over
});
const applied = (r, after = 8) => markApplied(beginApply(r), { records: [auditRecord({ source: "x", targetId: r.targetId, targetName: r.name, change: { ...r.changes[0], after } })], effectIds: ["fx1"], at: 1, userId: "u" });

test("linha nasce pendente com o valor original calculado; desabilitada não aplica", () => {
	const r = row();
	assert.deepEqual([r.state, canApply(r), r.changes[0].original, r.changes[0].edited], ["pending", true, 12, null]);
	const d = createRow({ targetId: "x", name: "X", disabledReason: "aliado" });
	assert.deepEqual([d.state, canApply(d)], ["disabled", false]);
});

test("editar mantém o original visível; igual ao original limpa; negativo vira 0; só pendente edita", () => {
	let r = editChange(row(), 0, 5);
	assert.deepEqual([r.changes[0].edited, r.changes[0].original, effectiveAmount(r.changes[0]), rowEdited(r)], [5, 12, 5, true]);
	assert.equal(editChange(r, 0, 12).changes[0].edited, null);
	assert.equal(editChange(r, 0, -4).changes[0].edited, 0);
	assert.equal(editChange(r, 0, "abc").changes[0].edited, 0);
	assert.equal(restoreChange(r, 0).changes[0].edited, null);
	const locked = beginApply(r);
	assert.equal(editChange(locked, 0, 1), locked);
	const unsupported = createRow({ targetId: "t", name: "T", changes: [previewChange({ entry: { ...dmg, resource: "san" }, rolled: 4, snapshot: { type: "threat", system: { attributes: { hp: { value: 5, max: 5 } } } } })] });
	assert.equal(editChange(unsupported, 0, 3), unsupported);
});

test("duplo clique: aplicar uma vez só (pendente → aplicando → aplicado)", () => {
	const r = row();
	const first = beginApply(r);
	assert.equal(first.state, ROW_STATE.APPLYING);
	assert.equal(beginApply(first), first); // segundo clique não faz nada
	assert.equal(canApply(first), false);
	const done = markApplied(first, { records: [], effectIds: [] });
	assert.equal(done.state, ROW_STATE.APPLIED);
	assert.equal(markApplied(done, { records: [] }), done);
	assert.equal(markApplied(r, { records: [] }), r); // sem begin não marca
});

test("falha ao aplicar volta a pendente sem registro", () => {
	const back = abortApply(beginApply(row()));
	assert.deepEqual([back.state, back.applied], ["pending", null]);
	assert.equal(abortApply(row()).state, "pending");
});

test("ignorar não aplica nem altera valores; reativar volta a pendente", () => {
	const r = markIgnored(row());
	assert.deepEqual([r.state, canApply(r), r.applied], ["ignored", false, null]);
	assert.equal(markIgnored(applied(row())).state, "applied"); // aplicada não pode ser ignorada
	assert.equal(markRestored(r).state, "pending");
	assert.equal(markRestored(createRow({ targetId: "x", name: "X", disabledReason: "aliado" })).state, "pending");
});

test("aplicar todos: só pendentes; confirmação se houver edição", () => {
	const rows = [row("A"), markIgnored(row("B")), editChange(row("C"), 0, 3), applied(row("D"))];
	const plan = applyAllPlan(rows);
	assert.deepEqual([plan.count, plan.indexes, plan.needsConfirm], [2, [0, 2], true]);
	assert.equal(pendingCount(rows), 2);
	assert.equal(applyAllPlan([row("A")]).needsConfirm, false);
	assert.equal(applyAllPlan([]).count, 0);
});

test("desfazer limpo restaura o valor anterior e lista os efeitos a remover", () => {
	const r = applied(row());
	assert.equal(r.applied.records[0].before, 20);
	const check = undoCheck(r, { "system.PV": 8 });
	assert.equal(check.ok, true);
	assert.deepEqual(check.restore, [{ path: "system.PV", value: 20, after: 8, resource: "pv" }]);
	assert.deepEqual(check.effectIds, ["fx1"]);
	const back = markUndone(r);
	assert.deepEqual([back.state, back.applied], ["pending", null]);
});

test("desfazer com valor alterado depois é conflito: não reverte e instrui ajuste manual", () => {
	const r = applied(row());
	const check = undoCheck(r, { "system.PV": 3 });
	assert.deepEqual([check.ok, check.reason], [false, "conflict"]);
	assert.deepEqual(check.conflicts[0], { path: "system.PV", expected: 8, now: 3, before: 20, resource: "pv" });
	assert.match(check.instruction, /Ajuste manualmente/);
	assert.match(check.instruction, /Agente A/);
	assert.equal(undoCheck(row(), {}).reason, "not-applied");
	assert.equal(markUndone(row()).state, "pending");
});

test("desfazer ignora registros sem mudança real (dano zero) e não suportados", () => {
	const none = createRow({ targetId: "n", name: "N", changes: [previewChange({ entry: dmg, rolled: 0, snapshot: agent() })] });
	const r = markApplied(beginApply(none), { records: [auditRecord({ source: "x", targetId: "n", targetName: "N", change: none.changes[0] })], effectIds: [] });
	assert.deepEqual(undoCheck(r, {}).restore, []);
});

test("resumo público não revela números nem DT", () => {
	const line = publicLine(row(), "Mal Sintonizado");
	assert.equal(line, "Agente A sofreu dano e ficou Surdo por Mal Sintonizado.");
	assert.doesNotMatch(line, /\d/);
	assert.equal(publicLine(markIgnored(row()), "X"), null);
	assert.match(publicLine(createRow({ targetId: "r", name: "R", save: { passed: true } }), "X"), /resistiu/);
	const heal = createRow({ targetId: "h", name: "H", changes: [previewChange({ entry: { kind: "heal", formula: "5", resource: "pv", roll: "once" }, rolled: 5, snapshot: agent() })] });
	assert.match(publicLine(heal, "X"), /foi curado/);
});

test("painel antigo ou corrompido é detectado sem quebrar", () => {
	assert.equal(panelIssue(null), "missing");
	assert.equal(panelIssue({ rows: "x" }), "corrupt");
	assert.equal(panelIssue({ version: 99, rows: [] }), "newer-version");
	assert.equal(panelIssue(createPanel({ executionId: "e", itemName: "I", sourceActorId: "a", sourceName: "S", rows: [] })), null);
	assert.equal(panelIssue({ rows: [] }), null); // versão ausente (mensagem antiga) abre normalmente
});

test("modelo de exibição: estados, botões, valor editado e duração", async () => {
	const { buildPanelView } = await import("../../module/helpers/threat-ability-panel-view.mjs");
	const t = (k) => k;
	const edited = editChange(row("A"), 0, 5);
	const view = buildPanelView({ itemName: "Hab", sourceName: "Fonte", rows: [edited, applied(row("B")), markIgnored(row("C"))] }, t);
	const [a, b, c] = view.rows;
	assert.deepEqual([a.canApply, a.canIgnore, a.canUndo, a.changes[0].amount, a.changes[0].original, a.changes[0].edited, a.changes[0].editable], [true, true, false, 5, 12, true, true]);
	assert.deepEqual([b.canApply, b.canUndo, b.changes[0].editable, b.applied.records[0].after], [false, true, false, 8]);
	assert.deepEqual([c.canRestore, c.canApply], [true, false]);
	assert.deepEqual([view.pending, view.applyAllDisabled, view.empty], [1, false, false]);
	assert.equal(buildPanelView({ itemName: "x", sourceName: "y", rows: [] }, t).applyAllDisabled, true);
	const manual = createRow({ targetId: "m", name: "M", effects: [{ index: 0, applies: true, condition: { label: "Frustrado" }, manual: true, durationRounds: 2 }, { index: 1, applies: false }] });
	const mv = buildPanelView({ itemName: "x", sourceName: "y", rows: [manual] }, (k, d) => (d ? `${k}:${d.n ?? ""}` : k)).rows[0];
	assert.deepEqual(mv.effects, [{ label: "Frustrado", duration: "op.threatPanel.rounds:2", manual: true, manualText: "op.threatPanel.manualEffect" }]);
});
