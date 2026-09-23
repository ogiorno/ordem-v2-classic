// Compila e renderiza os templates da ficha de ameaça com o Handlebars do Foundry e dados de exemplo.
// Pega erro de sintaxe/partial/helper sem precisar abrir o Foundry. Uso: npm run render-check
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const install = "C:\\Users\\Geh\\VTT\\Foundry Virtual Tabletop\\resources\\app";
const require = createRequire(path.join(install, "package.json"));
const Handlebars = require("handlebars");
const sys = path.resolve("systems/ordem_v2_classic");
const read = (rel) => readFileSync(path.join(sys, rel), "utf8");

const hb = Handlebars.create();
hb.registerHelper("localize", (k) => `«${k}»`);
hb.registerHelper("numberFormat", (n, o) => (o?.hash?.sign && n > 0 ? `+${n}` : `${n}`));
hb.registerHelper("selectOptions", (choices, o) => {
	const sel = [].concat(o.hash.selected ?? []);
	return new hb.SafeString(Object.keys(choices ?? {}).map((k) => `<option value="${k}"${sel.includes(k) ? " selected" : ""}>${k}</option>`).join(""));
});
hb.registerHelper("eq", (a, b) => a === b);

const prefix = "systems/ordem_v2_classic/templates/threat/parts/";
for (const f of ["threat-test-chip", "threat-item-row"]) hb.registerPartial(`${prefix}${f}.hbs`, read(`templates/threat/parts/${f}.hbs`));

const test = (key, label, testLabel) => ({ key, label, testLabel, formula: "", degreeLabel: "untrained", override: 10, derived: 10 });
const item = (o) => ({ _id: "i1", name: "Pancada", rowKind: "attack", rowMeta: "Corpo a corpo x2", testLabel: "3O+10", damageLabel: "2d6+6 Impacto", editAction: "editThreatAttack", dieTooltip: "Rolar ataque", ...o });
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
	defenseTests: [test("resilience", "Fortitude", "3O+10"), test("reflexes", "Reflexos", "O"), test("will", "Vontade", "O")],
	senseTraits: [{ key: "blindsight", label: "Percepção às cegas" }],
	rdTags: [{ text: "RD Impacto 5", title: "impactDamage" }],
	vulnerableTags: ["Morte"],
	immuneTags: [],
	healingText: "",
	attrRows: [{ key: "dex", abbr: "AGI", label: "Agilidade", value: 1 }, { key: "str", abbr: "FOR", label: "Força", value: 3 }],
	hasSkills: true,
	skillRows: [{ name: "Crime", testLabel: "2O+5", index: 0, action: "rollThreatExtra", isExtra: true }],
	passives: [item({ name: "Origem", rowKind: "ability", testLabel: "", damageLabel: "", rowMeta: "", editAction: "viewDoc" })],
	actionGroups: [
		{ key: "default", label: "Padrão", items: [item({})] },
		{ key: "reaction", label: "Reação", items: [item({ name: "Agarrão", rowKind: "ability", damageLabel: "", editAction: "viewDoc" })] },
	],
};

const html = hb.compile(read("templates/threat/actor-threat-sheet.hbs"))(ctx, { data: { root: ctx } });
const count = (re) => (html.match(re) ?? []).length;

assert.ok(html.includes("3O+10"), "Fortitude 3O+10");
assert.ok(html.includes("9m | 6"), "deslocamento");
assert.ok(html.includes("Aberração de carne"), "nome");
assert.equal(count(/data-action="onRoll"/g), 3, "um dado por item (passiva + 2 ações)");
assert.ok(html.includes('data-action="onRollMentalDamage"'), "dado da presença perturbadora");
assert.equal(count(/sb-type sb-type-/g), 2, "dois grupos de ação");
assert.ok(html.includes('data-action="rollThreatTest" data-key="resilience"'), "teste clicável");
assert.ok(html.includes('data-action="rollThreatExtra"'), "perícia extra clicável");
assert.ok(html.includes('data-action="toggleEdit"'), "botão de edição");
assert.ok(!html.includes("sb-editing"), "começa fora do modo de edição");

const noCreature = hb.compile(read("templates/threat/actor-threat-sheet.hbs"))({ ...ctx, isCreature: false }, { data: { root: ctx } });
assert.ok(!noCreature.includes("sb-presence"), "sem presença perturbadora para não-criatura");

const noSkills = hb.compile(read("templates/threat/actor-threat-sheet.hbs"))({ ...ctx, hasSkills: false, skillRows: [] }, { data: { root: ctx } });
assert.ok(!noSkills.includes("rollThreatExtra"), "bloco de perícias some quando vazio");

const notes = hb.compile(read("templates/threat/parts/threat-enigmas.hbs"))({ ...ctx, enrichedFearRiddle: "<p>enigma</p>", enrichedDescription: "<p>desc</p>" });
assert.ok(notes.includes("enigma") && notes.includes("desc"), "enigma e descrição");
const notesPerson = hb.compile(read("templates/threat/parts/threat-enigmas.hbs"))({ ...ctx, isCreature: false, enrichedDescription: "<p>desc</p>" });
assert.ok(!notesPerson.includes("system.details.fearRiddle"), "sem enigma para não-criatura");

console.log(`render-check ok (${html.length} bytes de HTML)`);
