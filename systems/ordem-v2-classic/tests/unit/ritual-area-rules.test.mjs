import assert from "node:assert/strict";
import test from "node:test";
import { AREA_RULES, areaRuleFor, areaChoicesFor } from "../../module/macros/ritual-area-rules.mjs";
import { CONDITIONS, conditionIdFor } from "../../module/helpers/conditions.mjs";

const DAMAGE_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];
const SKILLS = ["resilience", "reflexes", "will"];
const SHAPES = ["circle", "cone", "rect", "ray"];
const FORMS = ["basic", "student", "true"];
const DICE = /^(\(?\d+d\d+\)?(?:[+-]\d+)?|\(\d+d\d+\)\*\d+)$/;

function* effects(rule) {
	for (const key of ["onCast", "tick", "exit"]) if (rule[key]) yield [key, rule[key]];
}

function* allForms() {
	for (const [name, entry] of Object.entries(AREA_RULES)) {
		for (const form of FORMS) {
			if (!entry[form]) continue;
			const bodies = entry[form].byChoice ? Object.entries(entry[form].byChoice).map(([choice, body]) => [choice, { ...entry[form], ...body }]) : [[null, entry[form]]];
			for (const [choice, body] of bodies) yield { name, form, choice, body };
		}
	}
}

test("registro: todo ritual tem forma, área e efeitos válidos", () => {
	let count = 0;
	for (const { name, form, choice, body } of allForms()) {
		count++;
		const id = `${name} [${form}${choice ? `/${choice}` : ""}]`;
		if (body.area) {
			assert.ok(SHAPES.includes(body.area.shape), `${id}: forma inválida`);
			assert.ok(body.area.distance > 0, `${id}: tamanho da área precisa ser positivo`);
			if (body.area.shape === "ray") assert.ok(body.area.width > 0, `${id}: linha precisa de largura`);
		}
		assert.ok(body.onCast || body.tick || body.exit || body.narrative, `${id}: sem efeito nem texto de aviso`);
		for (const [where, spec] of effects(body)) {
			for (const part of spec.damage ?? []) {
				assert.ok(DAMAGE_TYPES.includes(part.type), `${id} ${where}: tipo de dano "${part.type}" inexistente`);
				assert.match(part.formula, DICE, `${id} ${where}: fórmula "${part.formula}" inválida`);
			}
			if (spec.save) {
				assert.ok(SKILLS.includes(spec.save.skill), `${id} ${where}: perícia de resistência inválida`);
				assert.ok(["half", "none", "negates", "full"].includes(spec.save.success), `${id} ${where}: resultado do sucesso inválido`);
			}
			for (const cond of [...(spec.onFail ?? []), ...(spec.onSuccess ?? [])]) {
				assert.ok(cond.key || cond.label, `${id} ${where}: condição sem nome`);
			}
			if (spec.special) assert.ok(["killAtZero", "grapple", "tempPvFromDamage", "vulnerabilities", "blockExit"].includes(spec.special), `${id}: special desconhecido`);
		}
		if (body.tick) assert.ok(["casterTurn", "targetTurn"].includes(body.tick.when), `${id}: tick sem quando`);
		if (body.exit) assert.ok(body.exit.special === "blockExit", `${id}: saída precisa de blockExit`);
	}
	assert.ok(count >= 40, `esperava mapear pelo menos 40 formas, achei ${count}`);
});

test("registro: condições dos rituais têm efeito mecânico ou são só informativas", () => {
	const known = new Set(Object.keys(CONDITIONS));
	for (const { name, form, body } of allForms()) {
		for (const [, spec] of effects(body)) {
			for (const cond of [...(spec.onFail ?? []), ...(spec.onSuccess ?? [])]) {
				const id = conditionIdFor(cond);
				if (id) assert.ok(known.has(id), `${name}: condição ${id} fora do catálogo`);
			}
		}
	}
	// as condições do livro usadas pelos rituais
	for (const [input, expected] of [[{ key: "stun" }, "stun"], [{ key: "bleeding" }, "bleeding"], [{ key: "deaf" }, "deaf"], [{ key: "silence" }, "silence"], [{ key: "restrain" }, "grabbed"], [{ label: "Vulnerável" }, "vulnerable"], [{ label: "Enjoado" }, "nauseated"], [{ label: "Sem recuperar PV (1 rodada)" }, "noHealing"]]) {
		assert.equal(conditionIdFor(input), expected);
	}
});

test("condições: números do Livro v1.3", () => {
	assert.equal(CONDITIONS.vulnerable.condition.defense, -2);
	assert.equal(CONDITIONS.stun.condition.defense, -5);
	assert.equal(CONDITIONS.stun.condition.dice.reflexes, 1);
	assert.equal(CONDITIONS.stun.condition.noActions, true);
	assert.equal(CONDITIONS.grabbed.condition.dice.attack, 1);
	assert.equal(CONDITIONS.deaf.condition.dice.initiative, 2);
	assert.equal(CONDITIONS.bleeding.condition.bleed, true);
	assert.equal(CONDITIONS.silence.condition.noRituals, true);
});

test("registro: áreas conhecidas do livro", () => {
	const item = (name) => ({ name });
	assert.equal(areaRuleFor(item("Paradoxo"), "basic").area.distance, 6);
	assert.equal(areaRuleFor(item("Presença do Medo"), "basic").area.distance, 9);
	assert.equal(areaRuleFor(item("Presença do Medo"), "basic").area.center, "caster");
	assert.equal(areaRuleFor(item("Deflagração de Energia"), "basic").area.distance, 15);
	assert.equal(areaRuleFor(item("Tentáculos de Lodo"), "true").area.distance, 9);
	assert.equal(areaRuleFor(item("Eletrocussão"), "student").area.shape, "ray");
	assert.equal(areaRuleFor(item("Eletrocussão"), "basic").area, undefined, "a forma básica age no alvo marcado");
	assert.equal(areaRuleFor(item("Ritual que não existe"), "basic"), null);
	assert.equal(areaRuleFor(item("Paradoxo"), "student").area.distance, 0.75);
	assert.ok(areaChoicesFor(item("Transfigurar Terra")).amolecer);
	assert.equal(areaRuleFor(item("Transfigurar Terra"), "basic", "amolecer").onCast.damage[0].formula, "10d6");
	assert.equal(areaRuleFor(item("Transfigurar Terra"), "basic", "modelar").narrative.includes("Terra"), true);
});

test("registro: dano e resistência dos rituais de dano em área", () => {
	const item = (name) => ({ name });
	const expectations = [
		["Paradoxo", "basic", "6d6", "deathDamage", "resilience"], ["Paradoxo", "true", "13d6", "deathDamage", "resilience"],
		["Miasma Entrópico", "basic", "4d8", "chemicalDamage", "resilience"], ["Miasma Entrópico", "student", "6d8", "deathDamage", "resilience"],
		["Deflagração de Energia", "basic", "(3d10)*10", "energyDamage", "resilience"],
		["Esfolar", "basic", "3d4+3", "cuttingDamage", "reflexes"], ["Esfolar", "student", "5d4+5", "cuttingDamage", "reflexes"], ["Esfolar", "true", "10d4+10", "cuttingDamage", "reflexes"],
		["Eletrocussão", "student", "6d6", "energyDamage", "resilience"], ["Eletrocussão", "true", "8d6", "energyDamage", "resilience"],
		["Decadência", "true", "8d8+8", "deathDamage", "resilience"], ["Consumir Manancial", "true", "3d6", "deathDamage", "resilience"],
		["Poeira da Podridão", "basic", "4d8", "deathDamage", "resilience"], ["Poeira da Podridão", "true", "4d8+16", "deathDamage", "resilience"],
	];
	for (const [name, form, formula, type, skill] of expectations) {
		const spec = areaRuleFor(item(name), form).onCast;
		assert.equal(spec.damage[0].formula, formula, `${name} ${form}`);
		assert.equal(spec.damage[0].type, type, `${name} ${form}`);
		assert.equal(spec.save.skill, skill, `${name} ${form}`);
		assert.equal(spec.save.success, "half", `${name} ${form}: sucesso reduz à metade`);
	}
	// Presença do Medo: duas partes, Vontade reduz as duas
	const fear = areaRuleFor(item("Presença do Medo"), "basic").onCast;
	assert.deepEqual(fear.damage.map((part) => part.type), ["mentalDamage", "fearDamage"]);
	assert.equal(fear.save.skill, "will");
	// Purgatório: o dano de saída é sempre inteiro, a resistência só decide se sai
	assert.equal(areaRuleFor(item("Purgatório"), "basic").exit.save.success, "full");
});
