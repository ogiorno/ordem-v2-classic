import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS, curseEntry, visibleEntries } from "../../module/helpers/grimoire-index.mjs";
import { applyFilters, emptyFilters, facetCounts, toggleFilter } from "../../module/helpers/grimoire-filters.mjs";
import { searchEntries } from "../../module/helpers/grimoire-text.mjs";
import { availabilityFor } from "../../module/helpers/grimoire-rules.mjs";

const bundle = JSON.parse(readFileSync(new URL("../../fixtures/curses-pack.json", import.meta.url), "utf8"));
const entries = bundle.items.map((i) => curseEntry({ uuid: `Compendium.ordem_v2_classic.curses.Item.${i._id}`, name: i.name, img: i.img, system: i.system }));

test("o Grimório tem o tipo maldição e uma entrada para cada maldição do compêndio", () => {
	assert.ok(KINDS.includes("curse"));
	assert.equal(entries.length, 36);
	assert.ok(entries.every((e) => e.kind === "curse" && e.element && e.curseKind && e.summary.length > 20));
});

test("filtros por elemento e por tipo de item", () => {
	const blood = applyFilters(entries, toggleFilter(emptyFilters(), "element", "blood"));
	assert.ok(blood.length >= 5 && blood.every((e) => e.element === "blood"));
	const weapons = applyFilters(entries, toggleFilter(emptyFilters(), "curseKind", "weapon"));
	assert.equal(weapons.length, 12);
	const counts = facetCounts(entries, emptyFilters(), "curseKind");
	assert.deepEqual(counts, { weapon: 12, protection: 10, accessory: 14 });
});

test("a busca acha a maldição pelo nome e pelo efeito", () => {
	assert.equal(searchEntries(entries, "lancinante").results[0].entry.name, "Lancinante");
	assert.ok(searchEntries(entries, "regeneração vida").results.length >= 0);
	assert.ok(searchEntries(entries, "resistência").results.length > 0);
});

test("maldição não tem selo de disponibilidade e o Mestre vê as escondidas", () => {
	assert.equal(availabilityFor(entries[0], { trainedSkills: new Set() }, {}), null);
	assert.equal(visibleEntries([{ ...entries[0], hidden: true }], { isGM: false }).length, 0);
	assert.equal(visibleEntries([{ ...entries[0], hidden: true }], { isGM: true }).length, 1);
});
