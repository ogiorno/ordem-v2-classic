import test from "node:test";
import assert from "node:assert/strict";
import {
	inspectRitualResource,
	ritualBaseCost,
	ritualEffectFromText,
	ritualFinalCost,
	ritualFormDetails,
	ritualFormOptions,
	ritualResistanceTarget,
	validateRitualCast,
} from "../../module/macros/ritual-caster-logic.mjs";

const description = `
  <p>Discente (+ 2 PE): muda o efeito. Requer 2º círculo.</p>
  <p>Verdadeiro (+5 PE): muda o alvo. Requer 3º círculo e afinidade com Morte.</p>
`;

test("identifica fórmulas explícitas de cura e dano sem interpretar texto narrativo", () => {
	assert.deepEqual(ritualEffectFromText("O alvo recupera 3d8+3 PV."), { kind: "healing", formula: "3d8+3" });
	assert.deepEqual(ritualEffectFromText("Aumenta a cura para 7d8+7 PV."), { kind: "healing", formula: "7d8+7" });
	assert.deepEqual(ritualEffectFromText("O alvo sofre 2d6+4 de dano."), { kind: "damage", formula: "2d6+4" });
	assert.deepEqual(
		ritualEffectFromText("MORTE 1 Execução: padrão. O alvo recupera 3d8+3 PV, mas envelhece 1 ano."),
		{ kind: "healing", formula: "3d8+3" },
	);
	assert.equal(ritualEffectFromText("As feridas cicatrizam instantaneamente."), null);
});

test("custos básicos de ritual", () => {
	assert.deepEqual([1, 2, 3, 4].map(ritualBaseCost), [1, 3, 6, 10]);
	assert.equal(ritualBaseCost(5), null);
	assert.equal(ritualBaseCost("inválido"), null);
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

test("validação do círculo exige saldo suficiente em PD, sem limite estimado por turno", () => {
	assert.deepEqual(validateRitualCast({ cost: 1, balance: 1 }), { ok: true, errors: [] });
	assert.deepEqual(validateRitualCast({ cost: 3, balance: 3 }), { ok: true, errors: [] });
	assert.deepEqual(validateRitualCast({ cost: 6, balance: 3 }).errors, ["pd-insuficiente"]);
	assert.deepEqual(validateRitualCast({ cost: 10, balance: 10 }), { ok: true, errors: [] });
	assert.deepEqual(validateRitualCast({ cost: 0, balance: 10 }).errors, ["custo-invalido"]);
	assert.deepEqual(validateRitualCast({ cost: 1, balance: 10, preparationConfirmed: false }).errors, ["preparacao-nao-confirmada"]);
	assert.deepEqual(validateRitualCast({ cost: 1, balance: 10, specialRequirementConfirmed: false }).errors, ["requisito-especial-nao-confirmado"]);
});

test("resistência só aceita as chaves de perícia suportadas", () => {
	assert.equal(ritualResistanceTarget({ system: { skillResis: "will" } }), "will");
	assert.equal(ritualResistanceTarget({ system: { skillResis: "unknown" } }), null);
});
