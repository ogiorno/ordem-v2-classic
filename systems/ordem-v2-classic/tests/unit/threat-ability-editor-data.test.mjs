import { test } from "node:test";
import assert from "node:assert/strict";
import { addEntry, buildEditorViewModel, createExecution, previewLines, removeEntry, setBlock, setField } from "../../module/helpers/threat-ability-editor.mjs";
import { normalizeExecution, validateExecution } from "../../module/helpers/threat-ability-execution.mjs";

test("legado: sem execution o view model é manual e nada é criado sozinho", () => {
	const vm = buildEditorViewModel({ activation: "standard", description: "x" });
	assert.equal(vm.hasExecution, false);
	assert.equal(vm.state, "manual");
	assert.deepEqual(vm.errorList, []);
});

test("ativar é deliberado e começa manual, sem campos mecânicos", () => {
	const e = createExecution();
	assert.equal(e.automation, "manual");
	assert.equal(e.targeting, null);
	assert.equal(e.save, null);
	assert.deepEqual(e.damage, []);
	assert.equal(buildEditorViewModel({ execution: e, activation: "standard" }).state, "manual");
});

test("montar Mal Sintonizado pelo editor e reabrir com todos os campos", () => {
	let e = createExecution();
	e = setBlock(e, "targeting", true);
	e = setField(e, "targeting.kind", "area");
	e = setBlock(e, "area", true);
	e = setField(e, "area.shape", "line");
	e = setField(e, "area.length", "9");
	e = setField(e, "area.width", "3");
	e = setBlock(e, "save", true);
	e = setField(e, "save.skill", "reflexes");
	e = setField(e, "save.dc", "18");
	e = setField(e, "save.onSuccess", "half");
	e = addEntry(e, "damage");
	e = setField(e, "damage.0.formula", "2d8+2");
	e = setField(e, "damage.0.type", "energia");
	e = addEntry(e, "effects");
	e = setField(e, "effects.0.condition", "surdo");
	e = setField(e, "effects.0.duration.value", "1d4");
	e = setField(e, "effects.0.duration.unit", "rounds");
	e = setField(e, "effects.0.onSave", "fail");
	e = setField(e, "effects.0.support", "mechanical");
	e = setField(e, "automation", "automatic");
	const reopened = JSON.parse(JSON.stringify(e));
	const vm = buildEditorViewModel({ execution: reopened, activation: "standard" });
	assert.deepEqual(vm.errorList, []);
	assert.equal(vm.state, "automatic");
	assert.equal(vm.execution.area.length, 9);
	assert.equal(vm.execution.save.dc, 18);
	assert.equal(vm.execution.effects[0].duration.value, "1d4");
	assert.equal(setField(e, "effects.0.duration.value", "2").effects[0].duration.value, 2);
	assert.deepEqual(normalizeExecution(reopened), e);
});

test("erro aponta o campo e mapeia para chave de mensagem", () => {
	let e = setBlock(createExecution(), "save", true);
	e = setField(e, "save.skill", "reflexes");
	const vm = buildEditorViewModel({ execution: { ...e, automation: "automatic" }, activation: "" });
	assert.equal(vm.errors["save.dc"], "op.threatExec.error.missing-dc");
	assert.equal(vm.errors.action, "op.threatExec.error.missing-action");
	assert.equal(vm.state, "manual");
	assert.equal(vm.downgraded, true);
});

test("vazios viram null e não zero; prévia mostra Definir manualmente", () => {
	let e = setBlock(createExecution(), "targeting", true);
	e = setField(e, "targeting.range", "");
	assert.equal(e.targeting.range, null);
	e = setBlock(e, "area", true);
	const lines = previewLines(e);
	assert.ok(lines.filter((l) => l.missing).length >= 2);
	for (const l of lines.filter((x) => x.missing)) assert.equal(l.text, "op.threatExec.defineManually");
	assert.equal(setField(e, "targeting.range", "abc").targeting.range, null);
});

test("remover bloco e entradas; caminho inexistente falha de forma clara", () => {
	let e = addEntry(addEntry(createExecution(), "damage"), "damage");
	e = removeEntry(e, "damage", 0);
	assert.equal(e.damage.length, 1);
	e = setBlock(setBlock(e, "cost", true), "cost", false);
	assert.equal(e.cost, null);
	assert.throws(() => setField(createExecution(), "save.dc", "10"), /caminho inexistente/);
	assert.throws(() => setBlock(createExecution(), "xyz", true), /bloco desconhecido/);
	assert.throws(() => addEntry(createExecution(), "xyz"), /lista desconhecida/);
});

test("edição preserva campos desconhecidos e não toca no original", () => {
	const original = normalizeExecution({ mode: "active", futuro: { a: 1 } });
	const snapshot = JSON.stringify(original);
	const next = setField(original, "mode", "passive");
	assert.equal(JSON.stringify(original), snapshot);
	assert.deepEqual(next.futuro, { a: 1 });
	assert.equal(validateExecution(next, { activation: "" }).effective, "manual");
});

test("gatilhos de área aceitam lista separada por vírgula", () => {
	let e = setField(setBlock(createExecution(), "area", true), "area.triggers", "enter, turn");
	assert.deepEqual(e.area.triggers, ["enter", "turn"]);
	assert.equal(buildEditorViewModel({ execution: e }).areaTriggersText, "enter, turn");
});

test("gatilho e limite: bloco de gatilho do editor valida evento e contagem", async () => {
	let e = setBlock(createExecution(), "trigger", true);
	e = setField(e, "mode", "triggered");
	const vm = buildEditorViewModel({ execution: e, activation: "free" });
	assert.equal(vm.errors["trigger.event"], "op.threatExec.error.enum");
	e = setField(e, "trigger.event", "turnStart");
	assert.deepEqual(buildEditorViewModel({ execution: e, activation: "free" }).errorList, []);
	e = addEntry(e, "requirements");
	e = setField(e, "requirements.0.kind", "perScene");
	e = setField(e, "requirements.0.count", "0");
	assert.equal(buildEditorViewModel({ execution: e, activation: "free" }).errors["requirements[0].count"], "op.threatExec.error.invalid-count");
	e = setField(e, "requirements.0.count", "2");
	assert.deepEqual(buildEditorViewModel({ execution: e, activation: "free" }).errorList, []);
	assert.equal(setBlock(e, "trigger", false).trigger, null);
});
