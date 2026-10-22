// Compila e renderiza os templates da ficha de ameaça com o Handlebars do Foundry e dados de exemplo.
// Pega erro de sintaxe/partial/helper sem precisar abrir o Foundry. Uso: npm run render-check
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { buildEditorViewModel } from "../systems/ordem-v2-classic/module/helpers/threat-ability-editor.mjs";
import { buildPanelView } from "../systems/ordem-v2-classic/module/helpers/threat-ability-panel-view.mjs";
import { createRow, beginApply, markApplied, editChange } from "../systems/ordem-v2-classic/module/helpers/threat-ability-panel.mjs";
import { previewChange } from "../systems/ordem-v2-classic/module/helpers/threat-ability-damage.mjs";
import { paranormalItemView } from "../systems/ordem-v2-classic/module/helpers/paranormal-items.mjs";
import { formatTestHtml } from "../systems/ordem-v2-classic/module/helpers/threat-calc.mjs";

// "3O+10" → 3 d20 + 10, com o ícone de d20 no lugar do "O" (igual ao que a ficha mostra)
const html20 = (label) => {
	const m = label.match(/^(\d*)O([+-]\d+)?$/);
	return formatTestHtml(m[1] ? Number(m[1]) : 1, m[2] ? Number(m[2]) : 0);
};

// Usa o Handlebars do Foundry instalado (FOUNDRY_APP) quando existe; sem ele (CI, clone novo) usa o do projeto (devDependency).
const install = process.env.FOUNDRY_APP ?? "C:\\Users\\Geh\\VTT\\Foundry Virtual Tabletop\\resources\\app";
const require = createRequire(existsSync(path.join(install, "package.json")) ? path.join(install, "package.json") : import.meta.url);
const Handlebars = require("handlebars");
const sys = path.resolve("systems/ordem-v2-classic");
const read = (rel) => readFileSync(path.join(sys, rel), "utf8");

const hb = Handlebars.create();
hb.registerHelper("localize", (k) => `«${k}»`);
hb.registerHelper("numberFormat", (n, o) => (o?.hash?.sign && n > 0 ? `+${n}` : `${n}`));
hb.registerHelper("selectOptions", (choices, o) => {
	const sel = [].concat(o.hash.selected ?? []);
	return new hb.SafeString(Object.keys(choices ?? {}).map((k) => `<option value="${k}"${sel.includes(k) ? " selected" : ""}>${k}</option>`).join(""));
});
hb.registerHelper("eq", (a, b) => a === b);

const prefix = "systems/ordem-v2-classic/templates/threat/parts/";
// registra todos os parciais da pasta: um parcial novo na ficha não pode derrubar a verificação
for (const file of readdirSync(path.join(sys, "templates/threat/parts")).filter((f) => f.endsWith(".hbs"))) hb.registerPartial(`${prefix}${file}`, read(`templates/threat/parts/${file}`));

const test = (key, label, testLabel, buff = 0) => ({ key, label, testLabel, testHtml: html20(testLabel), formula: "", tooltip: "tip", degreeLabel: "untrained", override: 10, derived: 10, buff, hasBuff: buff !== 0, buffText: buff > 0 ? `+${buff}` : `${buff}`, buffClass: buff < 0 ? "neg" : "pos" });
const item = (o) => ({ _id: "i1", name: "Pancada", rowKind: "attack", rowMeta: "Corpo a corpo x2", testLabel: "3O+10", testHtml: html20("3O+10"), damageLabel: "2d6+6 Impacto", editAction: "editThreatAttack", dieTooltip: "Rolar ataque", ...o });
const ctx = {
	actor: { type: "threat", name: "Aberração de carne", img: "icons/svg/mystery-man.svg", uuid: "Actor.x" },
	editable: true,
	editMode: false,
	elementLabel: "Sangue",
	typeLabel: "Criatura",
	sizeLabel: "Grande",
	isCreature: true,
	threatTypes: { creature: "c" },
	elements: { blood: "b" },
	threatSizes: { large: "l" },
	damageTypes: { deathDamage: "d" },
	optionDegreeThreat: { untrained: "u", trained: "t" },
	attributeChoices: { dex: "AGI" },
	system: {
		elements: { main: "blood" },
		details: { creatureType: "creature" },
		size: "large",
		sizeData: { stealth: -2, maneuvers: 2, space: 3 },
		attributes: { vd: { value: 40 }, hp: { value: 70, max: 70, bruised: 35, isBruised: false }, movement: { walk: 9, label: "9m | 6" } },
		disturbingPresence: { dt: 15, mentalDamage: "3d6", immuneNex: 30 },
		defense: { value: 19 },
		genericRd: { value: 0, except: [] },
		fastHealing: { value: 0, except: [] },
		extraSkills: [{ name: "Crime", attr: "dex", diceOverride: null, bonus: 5 }],
	},
	senseTests: [test("perception", "Percepção", "O+5"), test("initiative", "Iniciativa", "O")],
	defenseTests: [test("resilience", "Fortitude", "3O+15", 5), test("reflexes", "Reflexos", "O"), test("will", "Vontade", "O")],
	senseTraits: [{ key: "blindsight", label: "Percepção às cegas" }],
	rdTags: [{ text: "RD Impacto 5", title: "impactDamage" }],
	vulnerableTags: ["Morte"],
	immuneTags: [],
	healingText: "",
	attrRows: [{ key: "dex", abbr: "AGI", label: "Agilidade", value: 1 }, { key: "str", abbr: "FOR", label: "Força", value: 3 }],
	hasSkills: true,
	skillPicker: [{ key: "athleticism", label: "Atletismo" }, { key: "crime", label: "Crime" }],
	skillRows: [{ name: "Crime", testLabel: "2O+5", testHtml: html20("2O+5"), tooltip: "tip", hasBuff: true, buffText: "+3", buffClass: "pos", attr: "dex", diceOverride: null, bonus: 2, buff: 3, isCustom: true, skillKey: "", rawName: "Crime", index: 0, action: "rollThreatExtra", isExtra: true }],
	passives: [item({ name: "Origem", rowKind: "ability", testLabel: "", damageLabel: "", rowMeta: "", editAction: "viewDoc" })],
	actionGroups: [
		{ key: "default", label: "Padrão", items: [item({})] },
		{ key: "reaction", label: "Reação", items: [item({ name: "Agarrão", rowKind: "ability", damageLabel: "", editAction: "viewDoc" })] },
	],
};

const html = hb.compile(read("templates/threat/actor-threat-sheet.hbs"))(ctx, { data: { root: ctx } });
const count = (re) => (html.match(re) ?? []).length;

assert.ok(html.includes(formatTestHtml(3, 15)), "Fortitude 3O+15 com ícone de d20");
assert.ok(!html.includes("3O+15"), "o texto 'O' não aparece mais (parece zero)");
assert.ok(html.includes('class="sb-buff pos"'), "buff de +5 aparece ao lado do teste");
assert.ok(html.includes("data-skill-picker") && html.includes('value="athleticism"'), "seletor de perícias com Atletismo");
assert.ok(html.includes('name="system.skills.resilience.value"'), "campo de buff da Fortitude");
assert.ok(html.includes('name="system.extraSkills.0.buff"'), "campo de buff da perícia extra");
assert.ok(html.includes("9m | 6"), "deslocamento");
assert.ok(html.includes("Aberração de carne"), "nome");
assert.equal(count(/data-action="rollThreatItem"/g), 3, "um dado por item (passiva + 2 ações)");
assert.ok(html.includes('data-action="onRollMentalDamage"'), "dado da presença perturbadora");
assert.equal(count(/sb-type sb-type-/g), 2, "dois grupos de ação");
assert.ok(html.includes('data-action="rollThreatTest" data-key="resilience"'), "teste clicável");
assert.ok(html.includes('data-action="rollThreatExtra"'), "perícia extra clicável");
assert.ok(html.includes('data-action="toggleEdit"'), "botão de edição");
assert.ok(!html.includes("sb-editing"), "começa fora do modo de edição");

const noCreature = hb.compile(read("templates/threat/actor-threat-sheet.hbs"))({ ...ctx, isCreature: false }, { data: { root: ctx } });
assert.ok(!noCreature.includes("sb-presence"), "sem presença perturbadora para não-criatura");

const noSkills = hb.compile(read("templates/threat/actor-threat-sheet.hbs"))({ ...ctx, skillRows: [] }, { data: { root: ctx } });
assert.ok(!noSkills.includes("rollThreatExtra"), "sem perícias extras não há botão de rolagem");
assert.ok(noSkills.includes("data-skill-picker"), "mas o seletor para adicionar continua lá");
assert.ok(noSkills.includes("op.threat.noSkills"), "mensagem de lista vazia");

const notes = hb.compile(read("templates/threat/parts/threat-enigmas.hbs"))({ ...ctx, enrichedFearRiddle: "<p>enigma</p>", enrichedDescription: "<p>desc</p>" });
assert.ok(notes.includes("enigma") && notes.includes("desc"), "enigma e descrição");
const notesPerson = hb.compile(read("templates/threat/parts/threat-enigmas.hbs"))({ ...ctx, isCreature: false, enrichedDescription: "<p>desc</p>" });
assert.ok(!notesPerson.includes("system.details.fearRiddle"), "sem enigma para não-criatura");

// editor de execução (T03): legado, bloco completo e bloco inválido
hb.registerHelper("concat", (...a) => a.slice(0, -1).join(""));
hb.registerHelper("checked", (v) => (v ? "checked" : ""));
const execTpl = hb.compile(read("templates/item/parts/item-ability-execution.hbs"));
const execLegacy = execTpl({ exec: buildEditorViewModel({ activation: "standard" }) });
assert.ok(execLegacy.includes("execEnable") && !execLegacy.includes("data-exec="), "legado só oferece ativar");
const execFull = execTpl({ exec: buildEditorViewModel({ activation: "standard", execution: { mode: "active", automation: "automatic", targeting: { kind: "area" }, area: { shape: "line", length: 9, width: 3 }, save: { skill: "reflexes", dc: 18 }, damage: [{ formula: "2d8+2", type: "energia" }], effects: [{ condition: "surdo", duration: { value: "1d4", unit: "rounds" }, onSave: "fail", support: "mechanical" }] } }) });
for (const campo of ["area.length", "save.dc", "damage.0.formula", "effects.0.duration.value", "execRemoveEntry", "op.threatExec.preview.area"]) assert.ok(execFull.includes(campo), `editor sem ${campo}`);
const execBad = execTpl({ exec: buildEditorViewModel({ activation: "", execution: { mode: "active", automation: "automatic", save: { skill: "reflexes" } } }) });
assert.ok(execBad.includes("data-error-path=\"save.dc\"") && execBad.includes("op.threatExec.defineManually"), "erro aponta o campo");

// painel de resolução (T09): pendente editado, aplicado, ignorado e vazio
const panelTpl = hb.compile(read("templates/apps/threat-ability-panel.hbs"));
const snap = { type: "agent", system: { PV: { value: 20, max: 30 }, resistances: {} } };
const chg = () => previewChange({ entry: { kind: "damage", formula: "2d8", type: "energia", resource: "pv", roll: "once" }, rolled: 12, snapshot: snap });
const rowA = editChange(createRow({ targetId: "a", name: "Agente A", save: { passed: false, mode: "full", skill: "reflexes", dc: 18, attempts: [{ total: 9 }] }, changes: [chg()], effects: [{ index: 0, applies: true, condition: { label: "Surdo" }, manual: true, durationRounds: 2 }] }), 0, 5);
const rowB = markApplied(beginApply(createRow({ targetId: "b", name: "Agente B", changes: [chg()] })), { records: [{ supported: true, resource: "pv", before: 20, after: 8 }], effectIds: [] });
const panelHtml = panelTpl({ view: buildPanelView({ itemName: "Mal Sintonizado", sourceName: "Desalento", rows: [rowA, rowB] }, (k) => k) });
for (const campo of ["data-tap-edit", "value=\"5\"", "<s title", "data-action=\"apply\"", "data-action=\"ignore\"", "data-action=\"undo\"", "data-action=\"applyAll\"", "op.threatPanel.manualEffect", "pv 20"]) { if (campo !== "pv 20") assert.ok(panelHtml.includes(campo), `painel sem ${campo}`); }
assert.ok(panelHtml.includes("PV 20 → 8"), "registro antes/depois do aplicado");
const panelEmpty = panelTpl({ view: buildPanelView({ itemName: "X", sourceName: "Y", rows: [] }, (k) => k) });
assert.ok(panelEmpty.includes("op.threatPanel.noTargets") && panelEmpty.includes("disabled"), "painel vazio");

// linha de habilidade: com execution aparece Usar; sem, só o dado (T11)
const rowTpl = hb.compile(read("templates/threat/parts/threat-item-row.hbs"));
const rowCtx = { editable: true };
const withUse = rowTpl({ item: { _id: "i1", rowKind: "ability", name: "Mal Sintonizado", canUse: true, useLabel: "Usar", dieTooltip: "Mostrar no chat", editAction: "viewDoc" } }, { data: { root: rowCtx } });
assert.ok(withUse.includes('data-action="useThreatAbility"') && withUse.includes('data-action="rollThreatItem"'), "habilidade configurada: Usar e Mostrar no chat");
const withoutUse = rowTpl({ item: { _id: "i2", rowKind: "ability", name: "Passiva", dieTooltip: "Rolar", editAction: "viewDoc" } }, { data: { root: rowCtx } });
assert.ok(!withoutUse.includes("useThreatAbility") && withoutUse.includes("rollThreatItem"), "habilidade manual: só o dado");
const incomplete = rowTpl({ item: { _id: "i3", rowKind: "ability", name: "X", canUse: true, useIncomplete: true, useLabel: "Usar", dieTooltip: "t", editAction: "viewDoc" } }, { data: { root: rowCtx } });
assert.ok(incomplete.includes("is-incomplete"), "configuração incompleta marcada");

// item paranormal: a aba "Uso" lista as formas de uso com o botão Usar (spec-itens-paranormais, Fase 1)
const paranormalTpl = hb.compile(read("templates/item/parts/item-paranormal.hbs"));
const paranormal = paranormalItemView({ type: "generalEquipment", name: "Amarras de Sangue" });
const paranormalHtml = paranormalTpl({ paranormal, owner: true, tab: { cssClass: "active" } });
assert.ok(paranormalHtml.includes('data-use="trap"') && paranormalHtml.includes('data-use="lasso"'), "Amarras: Armadilha e Laçar");
assert.ok(paranormalHtml.includes('data-action="useParanormalItem"') && paranormalHtml.includes("2 PE"), "botão Usar com o custo");
assert.ok(!paranormalTpl({ paranormal, owner: false, tab: {} }).includes("useParanormalItem"), "sem dono não há botão Usar");

console.log(`render-check ok (${html.length} bytes de HTML)`);
