import test from "node:test";
import assert from "node:assert/strict";
import {
	inspectRitualResource,
	ritualBaseCost,
	ritualFinalCost,
	ritualFormDetails,
	ritualFormOptions,
	ritualLimitFromNex,
	ritualResistanceTarget,
	validateRitualCast,
} from "../../module/macros/ritual-caster-logic.mjs";

const description = `
  <p>Discente (+ 2 PE): muda o efeito. Requer 2º círculo.</p>
  <p>Verdadeiro (+5 PE): muda o alvo. Requer 3º círculo e afinidade com Morte.</p>
`;

test("custos básicos de ritual", () => {
	assert.deepEqual([1, 2, 3, 4].map(ritualBaseCost), [1, 3, 6, 10]);
	assert.equal(ritualBaseCost(5), null);
	assert.equal(ritualBaseCost("inválido"), null);
});

test("limite de PE por turno deriva de NEX, sem reutilizar PD.perRound", () => {
	assert.deepEqual([5, 10, 15, 30, 99].map(ritualLimitFromNex), [1, 2, 3, 6, 20]);
	assert.equal(ritualLimitFromNex(-1), null);
});

test("extrai custo e pré-requisitos das formas avançadas do HTML", () => {
	const student = ritualFormDetails(description, "student");
	assert.equal(student.additionalCost, 2);
	assert.equal(student.requiredCircle, 2);
	assert.equal(student.requiredAffinity, null);

	const trueForm = ritualFormDetails(description, "true");
	assert.equal(trueForm.additionalCost, 5);
	assert.equal(trueForm.requiredCircle, 3);
	assert.equal(trueForm.requiredAffinity, "Morte");
});

test("formas só aparecem quando marcadas no item", () => {
	const options = ritualFormOptions({
		system: { description, studentForm: true, trueForm: false },
	});
	assert.equal(options.basic.additionalCost, 0);
	assert.equal(options.student.additionalCost, 2);
	assert.equal(options.true, null);
});

test("forma avançada com descrição não legível continua disponível, mas exige custo e confirmação manuais", () => {
	const options = ritualFormOptions({ system: { description: "Aprimoramento especial", studentForm: true } });
	assert.equal(options.student.needsManualConfirmation, true);
	assert.equal(options.student.additionalCost, undefined);
	assert.equal(ritualFinalCost(1, "student", options.student), null);
	assert.equal(ritualFinalCost(1, "student", options.student, "3"), 4);
});

test("custo de forma avançada exige custo conhecido ou informado", () => {
	assert.equal(ritualFinalCost(1, "basic"), 1);
	assert.equal(ritualFinalCost(2, "student", { additionalCost: 2 }), 5);
	assert.equal(ritualFinalCost(2, "true", null, "5"), 8);
	assert.equal(ritualFinalCost(2, "true", null, null), null);
	assert.equal(ritualFinalCost(5, "basic"), null);
});

test("política exige PD e o modo sem Sanidade", () => {
	const actor = { system: { PD: { value: 10, max: 20, perRound: 5 }, PE: { value: 2 } } };
	assert.equal(inspectRitualResource(actor, true).key, "PD");
	assert.equal(inspectRitualResource(actor, true).ok, true);
	assert.equal(inspectRitualResource(actor, false).reason, "mode-required");
	assert.equal(inspectRitualResource({ system: {} }, true).reason, "pd-missing");
});

test("validacao bloqueia falta de PD, limite e pré-requisito sem confirmação", () => {
	assert.deepEqual(validateRitualCast({ cost: 4, balance: 4, perRoundLimit: 5 }), { ok: true, errors: [] });
	assert.deepEqual(validateRitualCast({ cost: 4, balance: 3, perRoundLimit: 5 }).errors, ["pd-insuficiente"]);
	assert.deepEqual(validateRitualCast({ cost: 6, balance: 10, perRoundLimit: 5 }).errors, ["acima-do-limite-por-uso"]);
	assert.deepEqual(validateRitualCast({ cost: 6, minimumCost: 6, balance: 10, perRoundLimit: 3 }).errors, ["acima-do-limite-por-uso"]);
	assert.deepEqual(validateRitualCast({ cost: 6, minimumCost: 6, minimumCostExceptionConfirmed: true, balance: 10, perRoundLimit: 3 }).errors, []);
	assert.deepEqual(validateRitualCast({ cost: 6, balance: 10, perRoundLimit: 0 }).errors, ["limite-invalido"]);
	assert.deepEqual(
		validateRitualCast({ cost: 4, balance: 10, perRoundLimit: 5, advanced: true, requirementsConfirmed: false }).errors,
		["pre-requisitos-nao-confirmados"],
	);
	assert.deepEqual(validateRitualCast({ cost: 1, balance: 10, perRoundLimit: 5, preparationConfirmed: false }).errors, ["preparacao-nao-confirmada"]);
	assert.deepEqual(validateRitualCast({ cost: 1, balance: 10, perRoundLimit: 5, specialRequirementConfirmed: false }).errors, ["requisito-especial-nao-confirmado"]);
});

test("resistência só aceita as chaves de perícia suportadas", () => {
	assert.equal(ritualResistanceTarget({ system: { skillResis: "will" } }), "will");
	assert.equal(ritualResistanceTarget({ system: { skillResis: "unknown" } }), null);
});
