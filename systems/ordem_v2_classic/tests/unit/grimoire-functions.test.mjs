import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FUNCTION_LABELS, RITUAL_FUNCTIONS, filterRitualsByFunction, ritualFunctions } from "../../module/helpers/grimoire-functions.mjs";

test("os 98 rituais conhecidos têm etiquetas válidas", () => {
	const names = JSON.parse(readFileSync(new URL("../../module/macros/ritual-animation-map.json", import.meta.url))).map((entry) => entry.name);
	assert.equal(Object.keys(RITUAL_FUNCTIONS).length, 98);
	assert.ok(names.every((name) => ritualFunctions(name).length > 0));
	for (const functions of Object.values(RITUAL_FUNCTIONS)) {
		assert.ok(functions.length > 0);
		assert.ok(functions.every((value) => FUNCTION_LABELS.includes(value)));
	}
});

test("filtra dano e mantém rituais novos como sem função", () => {
	const rituals = [{ name: "Paradoxo" }, { name: "Apagar as Luzes" }, { name: "Ritual novo" }];
	assert.deepEqual(ritualFunctions("eletrocussao"), ["Dano", "Controle"]);
	assert.deepEqual(ritualFunctions("Amaldiçoar Arma - Morte"), ["Dano"]);
	assert.deepEqual(filterRitualsByFunction(rituals, "Dano"), [rituals[0]]);
	assert.deepEqual(filterRitualsByFunction(rituals, "sem-funcao"), [rituals[2]]);
	assert.deepEqual(filterRitualsByFunction(rituals, ""), rituals);
});
