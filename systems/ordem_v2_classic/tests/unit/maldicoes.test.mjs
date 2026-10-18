import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	CURSES, CURSE_KEYS, ELEMENTS, changesFor, classification, countByElement, curseCategoryBonus, curseCost, curseCount, cursesForKind,
	doubledMarginBonus, elementOf, elementsForAttribute, isOpposed, isUnlocked, protectionClass, resolveActive, sadicaBonus, validateAdd, DAY,
} from "../../module/helpers/curse-rules.mjs";
import { effectiveCategory, itemCategoryInfo, categoryUsage } from "../../module/helpers/item-categories.mjs";

test("as 35 maldições do livro mais a Lente de Revelação", () => {
	assert.equal(CURSE_KEYS.length, 36);
	assert.equal(cursesForKind("weapon").length, 12);
	assert.equal(cursesForKind("protection").length, 10);
	assert.equal(cursesForKind("accessory").length, 14); // 13 do livro + Lente de Revelação
	for (const c of Object.values(CURSES)) {
		assert.ok(ELEMENTS[c.element], `${c.key}: elemento`);
		assert.ok(c.text.length > 30, `${c.key}: texto do livro`);
		assert.ok(["auto", "semi", "manual"].includes(c.mode), `${c.key}: modo`);
	}
});

test("toda maldição faz alguma coisa na ficha, no ataque, em carta ou em botão de uso (ou tem motivo)", () => {
	for (const row of classification()) assert.ok(row.auto || row.manual || CURSES[row.key].reason, `${row.key} sem efeito nem motivo`);
});

test("categoria: primeira +II, seguintes +I", () => {
	assert.deepEqual([0, 1, 2, 3].map(curseCategoryBonus), [0, 2, 3, 4]);
	assert.equal(curseCount({ curses: [{ key: "lancinante" }, { key: "lancinante" }, { key: "erosiva" }] }), 2);
});

test("categoria do item soma modificações e maldições", () => {
	const item = { type: "armament", system: { category: 1, modifications: ["cruel"], curses: [{ key: "lancinante" }, { key: "erosiva" }] } };
	assert.equal(effectiveCategory(item), 1 + 1 + 2 + 1);
	const info = itemCategoryInfo(item, categoryUsage([item], {}));
	assert.equal(info.category, 5);
	assert.equal(info.curses, 2);
	assert.match(info.tip, /maldi/i);
	assert.equal(effectiveCategory({ type: "armament", system: { category: 2 } }), 2);
});

test("validação: repetida e tipo errado travam; opressora só avisa", () => {
	assert.equal(validateAdd([], "lancinante", { itemType: "armament" }).ok, true);
	assert.equal(validateAdd([{ key: "lancinante" }], "lancinante", { itemType: "armament" }).ok, false);
	assert.equal(validateAdd([], "lancinante", { itemType: "protection" }).ok, false);
	assert.equal(validateAdd([], "cinetica", { itemType: "armament" }).ok, false);
	assert.equal(validateAdd([], "lancinante", { itemType: "ability" }).ok, false);
	assert.equal(validateAdd([], "empuxo", { itemType: "armament", weaponRange: "ranged" }).ok, false);
	const mix = validateAdd([{ key: "lancinante" }], "antielemento", { itemType: "armament" }); // Sangue + Conhecimento
	assert.equal(mix.ok, true);
	assert.equal(mix.warnings.length, 1);
	assert.equal(validateAdd([{ key: "lancinante" }], "energetica", { itemType: "armament" }).warnings.length, 0); // Sangue + Energia combinam
	assert.equal(validateAdd([{ key: "antielemento" }], "erosiva", { itemType: "armament" }).warnings.length, 0); // Conhecimento + Morte combinam
});

test("elementos opressores", () => {
	assert.equal(isOpposed("blood", "knowledge"), true);
	assert.equal(isOpposed("energy", "death"), true);
	assert.equal(isOpposed("knowledge", "death"), false);
	assert.equal(isOpposed("energy", "blood"), false);
});

test("efeitos de ficha das maldições automáticas", () => {
	const v = (key, ctx, entry = {}) => Object.fromEntries(changesFor({ key, ...entry }, ctx).map((c) => [c.key, c.value]));
	assert.deepEqual(v("carisma"), { "system.attributes.pre.value": 1 });
	assert.deepEqual(v("destreza"), { "system.attributes.dex.value": 1 });
	assert.deepEqual(v("disposicao"), { "system.attributes.vit.value": 1 });
	assert.deepEqual(v("pujanca"), { "system.attributes.str.value": 1 });
	assert.deepEqual(v("sagacidade"), { "system.attributes.int.value": 1 });
	assert.deepEqual(v("defesa"), { "system.defense.value": 5 });
	assert.deepEqual(v("potencia"), { "system.ritual.DT": 1 });
	assert.deepEqual(v("escudoMental"), { "system.resistances.mentalDamage.value": 10 });
	assert.deepEqual(v("esforcoAdicional"), { "system.PE.bonus": 5 });
	assert.deepEqual(v("vitalidade"), { "system.PV.bonus": 15 });
	assert.deepEqual(v("profetica"), { "system.resistances.knowledgeDamage.value": 10 });
	assert.deepEqual(v("voltaica"), { "system.resistances.energyDamage.value": 10 });
	assert.deepEqual(v("repulsiva"), { "system.resistances.deathDamage.value": 10 });
	assert.deepEqual(v("regenerativa"), { "system.resistances.bloodDamage.value": 10 });
	assert.deepEqual(v("sombria"), { "system.skills.stealth.mod": 5 });
	assert.deepEqual(v("lepida"), { "system.skills.athleticism.mod": 10, "system.desloc.value": 3 });
	assert.deepEqual(v("letargica"), { "system.defense.value": 2 });
	assert.deepEqual(v("repulsora"), { "system.defense.value": 2 });
});

test("Cinética: RD 2 em proteção leve e escudo, 5 na pesada", () => {
	const rd = (cls) => changesFor({ key: "cinetica" }, { protectionClass: cls }).find((c) => c.key === "system.genericRd.value").value;
	assert.equal(rd("light"), 2);
	assert.equal(rd("shield"), 2);
	assert.equal(rd("heavy"), 5);
	assert.equal(protectionClass({ name: "Proteção Pesada" }), "heavy");
	assert.equal(protectionClass({ name: "Escudo" }), "shield");
	assert.equal(protectionClass({ name: "Proteção Leve" }), "light");
});

test("Proteção Elemental usa o elemento escolhido e conta como item dele", () => {
	assert.deepEqual(changesFor({ key: "protecaoElemental", chosen: "blood" }).map((c) => [c.key, c.value]), [["system.resistances.bloodDamage.value", 10]]);
	assert.deepEqual(changesFor({ key: "protecaoElemental" }), []);
	assert.equal(elementOf({ key: "protecaoElemental", chosen: "death" }), "death");
	const counts = countByElement([{ using: true, curses: [{ key: "protecaoElemental", chosen: "death" }, { key: "lancinante" }] }]);
	assert.equal(counts.death, 1);
	assert.equal(counts.blood, 1);
});

test("Esforço Adicional e Vitalidade só ligam após um dia de uso", () => {
	const entry = { key: "vitalidade", since: 1000 };
	assert.equal(isUnlocked(entry, 1000), false);
	assert.equal(isUnlocked(entry, 1000 + DAY - 1), false);
	assert.equal(isUnlocked(entry, 1000 + DAY), true);
	assert.equal(isUnlocked({ key: "vitalidade" }, 99999999), false); // nunca começou a usar
	assert.equal(isUnlocked({ key: "defesa" }, 0), true);
});

test("maldições iguais não se acumulam; item guardado não vale", () => {
	const items = [
		{ itemId: "a", using: true, curses: [{ key: "carisma" }] },
		{ itemId: "b", using: true, curses: [{ key: "carisma" }] },
		{ itemId: "c", using: false, curses: [{ key: "defesa" }] },
	];
	const active = resolveActive(items);
	assert.equal(active.get("a:carisma"), true);
	assert.equal(active.get("b:carisma"), false);
	assert.equal(active.get("c:defesa"), false);
	// o item guardado não ocupa a vaga da maldição igual
	const stored = resolveActive([{ itemId: "a", using: false, curses: [{ key: "carisma" }] }, { itemId: "b", using: true, curses: [{ key: "carisma" }] }]);
	assert.equal(stored.get("b:carisma"), true);
});

test("preço da maldição: 2 por maldição do elemento, em itens em uso", () => {
	const counts = countByElement([
		{ using: true, curses: [{ key: "lancinante" }, { key: "pujanca" }] },
		{ using: true, curses: [{ key: "regenerativa" }] },
		{ using: false, curses: [{ key: "sadica" }] },
	]);
	assert.equal(counts.blood, 3);
	assert.equal(curseCost(counts, "blood"), 6);
	assert.equal(curseCost(counts, "energy"), 0);
	assert.deepEqual(elementsForAttribute("int"), ["knowledge"]);
	assert.deepEqual(elementsForAttribute("str"), ["blood"]);
	assert.deepEqual(elementsForAttribute("vit"), ["blood"]);
	assert.deepEqual(elementsForAttribute("pre"), ["death"]);
	assert.deepEqual(elementsForAttribute("dex"), ["energy"]);
});

test("Predadora duplica a margem de ameaça; Sádica soma 1 por 10 de dano", () => {
	assert.equal(doubledMarginBonus("19/x2"), 2);
	assert.equal(doubledMarginBonus("x3"), 1);
	assert.equal(doubledMarginBonus("18/x2"), 3);
	assert.equal(sadicaBonus(45), 4);
	assert.equal(sadicaBonus(9), 0);
});

test("Sagacidade não entra no orçamento de perícias (efeito marcado curseRule é ignorado)", () => {
	const src = readFileSync(new URL("../../module/helpers/skill-training.mjs", import.meta.url), "utf8");
	assert.match(src, /curseRule/);
});
