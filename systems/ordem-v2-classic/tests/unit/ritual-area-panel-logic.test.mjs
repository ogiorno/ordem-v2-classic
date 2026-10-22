import assert from "node:assert/strict";
import test from "node:test";
import {
	ROW_STATE, appliedLine, applyAllPlan, canApplyRow, createRow, editPart, markApplied, markIgnored, markRestored, markUndone,
	partDamage, pendingCount, publicSummary, resistMode, rowEdited, rowStateLabel, rowTotal, restorePart,
} from "../../module/macros/ritual-area-panel-logic.mjs";

const row = (overrides = {}) => createRow({
	tokenId: "t1", sceneId: "s1", name: "Zumbi", parts: [{ type: "deathDamage", full: 21, amount: 21 }], ...overrides,
});

test("FC-U7: dano por resistência — metade arredonda para baixo, anula e total", () => {
	assert.equal(partDamage(21, { success: "half" }, true), 10);
	assert.equal(partDamage(21, { success: "half" }, false), 21);
	assert.equal(partDamage(21, { success: "none" }, true), 0);
	assert.equal(partDamage(21, { success: "negates" }, true), 0);
	assert.equal(partDamage(21, { success: "full" }, true), 21, "full: a resistência não reduz o dano");
	assert.equal(partDamage(21, null, null), 21, "sem teste de resistência o dano é total");
	assert.equal(partDamage(21, { success: "negates" }, false, true), 21);
	assert.equal(partDamage(21, { success: "negates" }, true, true), 0, "damageOnFailOnly: quem passa não sofre");
	assert.equal(partDamage(-4, null, null), 0);
	assert.equal(partDamage("x", null, null), 0);
});

test("FC-U7: modo da resistência para o texto do painel", () => {
	assert.equal(resistMode({ success: "half" }, true), "metade");
	assert.equal(resistMode({ success: "half" }, false), "total");
	assert.equal(resistMode({ success: "negates" }, true), "anulado");
	assert.equal(resistMode(null, null), "total");
	assert.equal(resistMode({ success: "full" }, true), "total");
});

test("FC-U7: a linha nasce pendente; aliado nasce desabilitado", () => {
	assert.equal(row().state, ROW_STATE.PENDING);
	assert.equal(canApplyRow(row()), true);
	const ally = row({ disabledReason: "Aliado: não afetado pela regra" });
	assert.equal(ally.state, ROW_STATE.DISABLED);
	assert.equal(canApplyRow(ally), false);
	assert.equal(rowStateLabel(ally), "Desabilitado");
	assert.equal(rowStateLabel(row()), "Pendente");
});

test("FC-U7: total da linha soma as partes (Presença do Medo tem mental + medo)", () => {
	const both = row({ parts: [{ type: "mentalDamage", full: 20, amount: 10 }, { type: "fearDamage", full: 22, amount: 11 }] });
	assert.equal(rowTotal(both), 21);
	assert.equal(rowTotal(row({ parts: [] })), 0);
});

test("FC-U7: editar e restaurar o dano; valor ruim vira 0; só linha pendente edita", () => {
	const edited = editPart(row(), 0, 5);
	assert.equal(rowTotal(edited), 5);
	assert.equal(rowEdited(edited), true);
	assert.equal(edited.parts[0].original, 21, "o valor original fica guardado");
	assert.equal(rowTotal(editPart(row(), 0, -3)), 0);
	assert.equal(rowTotal(editPart(row(), 0, "abc")), 0);
	assert.equal(rowTotal(editPart(row(), 0, 7.9)), 7);
	assert.equal(rowEdited(restorePart(edited, 0)), false);
	assert.equal(rowTotal(restorePart(edited, 0)), 21);
	assert.equal(editPart(row(), 3, 9).parts.length, 1, "parte inexistente não muda nada");
	const applied = markApplied(row(), { dealt: 21 });
	assert.equal(rowTotal(editPart(applied, 0, 1)), 21, "linha aplicada não edita");
	assert.equal(rowTotal(editPart(markIgnored(row()), 0, 1)), 21, "linha ignorada não edita");
});

test("FC-U7: transições Pendente → Aplicado → Pendente (desfazer)", () => {
	const applied = markApplied(row(), { dealt: 21, hpBefore: 40, effectIds: ["e1"] });
	assert.equal(applied.state, ROW_STATE.APPLIED);
	assert.deepEqual(applied.applied, { dealt: 21, hpBefore: 40, effectIds: ["e1"], lines: [] });
	assert.equal(canApplyRow(applied), false);
	assert.equal(markApplied(applied, { dealt: 99 }).applied.dealt, 21, "aplicar duas vezes não sobrescreve");
	const undone = markUndone(applied);
	assert.equal(undone.state, ROW_STATE.PENDING);
	assert.equal(undone.applied, null);
	assert.equal(markUndone(row()).state, ROW_STATE.PENDING, "desfazer o que não foi aplicado não muda");
});

test("FC-U7: ignorar e reativar; aliado desabilitado pode ser habilitado pelo Mestre", () => {
	const ignored = markIgnored(row());
	assert.equal(ignored.state, ROW_STATE.IGNORED);
	assert.equal(markRestored(ignored).state, ROW_STATE.PENDING);
	assert.equal(markIgnored(markApplied(row(), {})).state, ROW_STATE.APPLIED, "linha aplicada não é ignorada");
	assert.equal(markRestored(row({ disabledReason: "Aliado" })).state, ROW_STATE.PENDING);
	assert.equal(markRestored(row()).state, ROW_STATE.PENDING);
});

test("FC-U7: Aplicar em todos age só nas pendentes", () => {
	const rows = [row({ tokenId: "a" }), markApplied(row({ tokenId: "b" }), { dealt: 1 }), markIgnored(row({ tokenId: "c" })), row({ tokenId: "d", disabledReason: "Aliado" }), row({ tokenId: "e" })];
	assert.equal(pendingCount(rows), 2);
	const plan = applyAllPlan(rows);
	assert.equal(plan.count, 2);
	assert.deepEqual(plan.indexes, [0, 4]);
	assert.equal(plan.needsConfirm, false);
	assert.equal(applyAllPlan([]).count, 0);
});

test("FC-U7: Aplicar em todos pede confirmação quando há dano editado", () => {
	const rows = [editPart(row(), 0, 3), row()];
	assert.equal(applyAllPlan(rows).needsConfirm, true);
	assert.equal(applyAllPlan([editPart(markApplied(row(), {}), 0, 3)]).needsConfirm, false, "editado mas já aplicado não conta");
});

test("FC-49b: resumo público não revela dano nem resistência", () => {
	const rows = [row(), row({ tokenId: "t2" }), row({ tokenId: "t3", disabledReason: "Aliado" })];
	const text = publicSummary({ ritualName: "Paradoxo", rows });
	assert.equal(text, "Paradoxo na área: 2 afetados.");
	assert.doesNotMatch(text, /\d{2}/);
	assert.equal(publicSummary({ ritualName: "Paradoxo", rows: [row()] }), "Paradoxo na área: 1 afetado.");
	assert.equal(publicSummary({ ritualName: "Paradoxo", rows: [] }), "Paradoxo: nenhuma ameaça na área.");
});

test("UI-26: linha pública depois de aplicar", () => {
	const applied = markApplied(row(), { dealt: 21 });
	assert.equal(appliedLine(applied), "Zumbi sofreu 21 de dano (deathDamage).");
	const none = markApplied(row({ parts: [{ type: "deathDamage", full: 21, amount: 0 }] }), { dealt: 0 });
	assert.equal(appliedLine(none), "Zumbi não sofreu dano.");
	const withCondition = markApplied(row({ conditions: [{ label: "Enjoado", rounds: 1 }] }), { dealt: 4 });
	assert.match(appliedLine(withCondition), /Enjoado/);
});
