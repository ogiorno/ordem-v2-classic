import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	CATALYSTS, addOneDie, catalystCheck, catalystEffect, catalystLabel, catalystOf, empowerDamageParts, isParanormalItem, itemUseDt, nextRange,
	paranormalItemInfo, usableCatalysts, useBalanceAfter, useCostPd,
} from "../../module/helpers/paranormal-item-rules.mjs";

const SOURCE = new URL("../../packs/_source/general/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function itemsIn(dir) {
	const found = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) found.push(...itemsIn(path));
		else if (name.endsWith(".json") && name !== "_folder.json") {
			const doc = JSON.parse(readFileSync(path, "utf8"));
			if (doc.type === "generalEquipment") found.push(doc);
		}
	}
	return found;
}

test("todo item paranormal do livro e todo catalisador do SAH estão classificados", () => {
	const livro = itemsIn(join(SOURCE, "livro-de-regras", "itens-paranormais"));
	const catalisadores = itemsIn(join(SOURCE, "sobrevivendo-ao-horror", "itens-paranormais")).filter((i) => /^(Ampliador|Perturbador|Potencializador|Prolongador) de /.test(i.name));
	assert.equal(livro.length, 13);
	assert.equal(catalisadores.length, 16);
	for (const item of [...livro, ...catalisadores]) {
		const info = paranormalItemInfo(item.name);
		assert.ok(info, `${item.name}: sem classificação`);
		assert.ok(["auto", "semi", "manual"].includes(info.automation), `${item.name}: modo`);
		if (info.automation !== "auto") assert.ok(info.reason.length > 10, `${item.name}: sem motivo`);
	}
});

test("nome do catalisador: Perturbador (e a grafia antiga) e cada elemento", () => {
	assert.equal(paranormalItemInfo("Perturbador de Sangue").catalyst, "disturber");
	assert.equal(paranormalItemInfo("Pertubador de Morte").catalyst, "disturber");
	assert.equal(paranormalItemInfo("Potencializador de Conhecimento").element, "knowledge");
	assert.equal(paranormalItemInfo("Prolongador de Energia").consumable, true);
	assert.equal(paranormalItemInfo("Faca comum"), null);
	assert.equal(isParanormalItem({ type: "armament", name: "Amarras de Sangue" }), false);
});

test("Amarras têm duas formas de uso, com custo, teste e condição do livro", () => {
	const info = paranormalItemInfo("Amarras de Sangue");
	const [trap, lasso] = info.uses;
	assert.equal(trap.action, "complete");
	assert.equal(useCostPd(trap), 2);
	assert.deepEqual(trap.save, { skill: "reflexes", dtAttribute: "INT" });
	assert.equal(trap.condition, "immobile");
	assert.equal(trap.consumesItem, true);
	assert.equal(lasso.action, "standard");
	assert.equal(useCostPd(lasso), 1);
	assert.deepEqual(lasso.save, { skill: "will", dtAttribute: "AGI" });
	assert.equal(lasso.condition, "paralyzed");
	assert.deepEqual(lasso.upkeep, { type: "PE", value: 1, per: "round" });
});

test("custo PE→PD e DT 10 + atributo", () => {
	const [trap] = paranormalItemInfo("Amarras de Morte").uses;
	assert.equal(useBalanceAfter(trap, 5), 3);
	assert.equal(useBalanceAfter(trap, 1), null);
	assert.equal(itemUseDt(trap, { INT: 3, AGI: 1 }), 13);
	assert.equal(itemUseDt({ save: null }, { INT: 3 }), null);
	assert.equal(useCostPd(paranormalItemInfo("Medidor de Estabilidade da Membrana").uses[0]), 0);
});

test("ferramentas: Câmera, Emissor, Escuta (+5 Ocultismo) e Scanner (por rodada, descrição de modelo)", () => {
	assert.equal(paranormalItemInfo("Câmera de Aura Paranormal").uses[0].cost.value, 1);
	const emissor = paranormalItemInfo("Emissor de Pulsos Paranormais").uses[0];
	assert.equal(emissor.action, "complete");
	assert.deepEqual(emissor.save, { skill: "will", dtAttribute: "PRE" });
	const escuta = paranormalItemInfo("Escuta de Ruídos Paranormais").uses[0];
	assert.equal(useCostPd(escuta), 2);
	assert.deepEqual(escuta.bonus, { skill: "occultism", value: 5, label: "Escuta de Ruídos Paranormais" });
	const scanner = paranormalItemInfo("Scanner de Manifestação Paranormal de (elemento)").uses[0];
	assert.equal(scanner.perRound, true);
	assert.equal(scanner.range, "long");
	assert.equal(scanner.chooseElement, true);
	assert.equal(paranormalItemInfo("Scanner de Manifestação Paranormal de Sangue").uses[0].chooseElement, false);
});

test("componente de elemento é reconhecido", () => {
	assert.equal(paranormalItemInfo("Componente de Energia").kind, "component");
	assert.equal(paranormalItemInfo("Componentes Ritualísticos de Morte").element, "death");
});

/* ---- catalisadores ---- */

const item = (name, extra = {}) => ({ id: name, name, type: "generalEquipment", system: { quantity: 1, using: { state: true }, ...extra } });

test("só entram catalisadores do elemento do ritual, empunhados e com unidade", () => {
	const items = [
		item("Potencializador de Sangue"), item("Ampliador de Morte"), item("Perturbador de Sangue", { quantity: 0 }),
		item("Prolongador de Sangue", { using: { state: false } }), item("Amarras de Sangue"),
	];
	assert.deepEqual(usableCatalysts(items, "blood").map((c) => c.name), ["Potencializador de Sangue"]);
	assert.deepEqual(usableCatalysts(items, "death").map((c) => c.name), ["Ampliador de Morte"]);
	assert.deepEqual(usableCatalysts(items, "fear"), []);
});

test("regras do catalisador: um por ritual, não improvisa, elemento, empunhado", () => {
	const c = catalystOf(item("Potencializador de Sangue"));
	assert.equal(catalystCheck({ catalyst: c, ritualElement: "blood" }).ok, true);
	assert.equal(catalystCheck({ catalyst: c, ritualElement: "blood", picked: 2 }).ok, false);
	assert.equal(catalystCheck({ catalyst: c, ritualElement: "blood", improvised: true }).ok, false);
	assert.equal(catalystCheck({ catalyst: c, ritualElement: "death" }).ok, false);
	assert.equal(catalystCheck({ catalyst: c, ritualElement: "blood", equipped: false }).ok, false);
	assert.equal(catalystCheck({ catalyst: c, ritualElement: "blood", quantity: 0 }).ok, false);
	assert.equal(catalystCheck({ catalyst: null, ritualElement: "blood" }).ok, false);
	assert.equal(catalystLabel(c), "Potencializador de Sangue");
	assert.equal(Object.keys(CATALYSTS).length, 4);
});

test("Perturbador soma 2 na DT", () => {
	assert.equal(catalystEffect("disturber").dtBonus, 2);
});

test("Potencializador soma um dado do mesmo tipo, só em dano", () => {
	assert.equal(addOneDie("2d6+3"), "3d6+3");
	assert.equal(addOneDie("d8"), "2d8");
	assert.equal(addOneDie("5"), "5");
	assert.deepEqual(empowerDamageParts([{ formula: "3d6", type: "blood" }, { formula: "1d4" }]), [{ formula: "4d6", type: "blood" }, { formula: "1d4" }]);
	assert.equal(catalystEffect("empowerer", { hasDamage: true }).extraDie, true);
	assert.equal(catalystEffect("empowerer", { hasDamage: false }).applies, false);
});

test("Ampliador sobe o alcance um passo ou dobra a área", () => {
	assert.equal(nextRange("personal"), "short");
	assert.equal(nextRange("touch"), "short");
	assert.equal(nextRange("short"), "medium");
	assert.equal(nextRange("medium"), "long");
	assert.equal(nextRange("long"), "extreme");
	assert.equal(nextRange("extreme"), "extreme");
	assert.equal(catalystEffect("amplifier", { range: "short" }).rangeKey, "medium");
	assert.equal(catalystEffect("amplifier", { range: "extreme" }).applies, false);
	assert.equal(catalystEffect("amplifier", { range: "unlimited" }).applies, false);
	assert.equal(catalystEffect("amplifier", { ampliador: "area", hasArea: true }).areaFactor, 2);
	assert.equal(catalystEffect("amplifier", { ampliador: "area", hasArea: false }).applies, false);
});

test("Prolongador dobra a duração, menos instantânea e sustentada", () => {
	assert.equal(catalystEffect("prolonger", { duration: "scene" }).durationFactor, 2);
	assert.equal(catalystEffect("prolonger", { duration: "setDuration" }).applies, true);
	assert.equal(catalystEffect("prolonger", { duration: "instantaneous" }).applies, false);
	assert.equal(catalystEffect("prolonger", { duration: "sustained" }).applies, false);
});
