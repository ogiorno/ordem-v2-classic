// Rodar: npm test. Chips da busca (GR-62): só elemento exato e "1º–4º círculo" viram chip; ✕ devolve a palavra como texto.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractQueryChips, mergeChipFilters } from "../../module/helpers/grimoire-chips.mjs";
import { emptyFilters } from "../../module/helpers/grimoire-filters.mjs";

describe("chips da busca", () => {
	it("nome exato de elemento vira chip e sai do texto", () => {
		const r = extractQueryChips("Sangue dano");
		assert.deepEqual(r.chips.map((c) => [c.key, c.value, c.label]), [["element", "blood", "Sangue"]]);
		assert.equal(r.text, "dano");
	});
	it("aceita sem acento e sem maiúscula", () => {
		assert.equal(extractQueryChips("CONHECIMENTO").chips[0].value, "knowledge");
	});
	it("\"2º círculo\" e variações viram chip de círculo", () => {
		for (const q of ["2º círculo", "2o circulo", "2 circulo"]) {
			const r = extractQueryChips(q);
			assert.deepEqual(r.chips.map((c) => [c.key, c.value, c.label]), [["circle", 2, "2º círculo"]], q);
			assert.equal(r.text, "");
		}
	});
	it("não vira chip: círculo fora de 1–4, número solto, palavra que só contém o nome, nome parcial", () => {
		for (const q of ["5º círculo", "2", "círculo", "sangrando", "sangu", "mortes", "5 circulo"]) assert.deepEqual(extractQueryChips(q).chips, [], q);
	});
	it("elemento e círculo juntos, e o texto restante preserva a ordem", () => {
		const r = extractQueryChips("morte 3º círculo explosão área");
		assert.deepEqual(r.chips.map((c) => c.id), ["morte", "3 circulo"]);
		assert.equal(r.text, "explosao area");
	});
	it("desfazer (✕) devolve a palavra como texto e ela não vira chip de novo", () => {
		const r = extractQueryChips("medo", new Set(["medo"]));
		assert.deepEqual(r.chips, []);
		assert.equal(r.text, "medo");
		assert.equal(extractQueryChips("1º círculo", new Set(["1 circulo"])).text, "1 circulo");
	});
	it("palavra ambígua (\"medo\") mostra chip; desfeito, vale como texto", () => {
		assert.equal(extractQueryChips("medo").chips.length, 1);
	});
	it("mesmo elemento digitado duas vezes gera um chip só", () => {
		assert.equal(extractQueryChips("sangue sangue").chips.length, 1);
	});
	it("junta os chips aos filtros sem mexer nos originais nem repetir valor", () => {
		const base = { ...emptyFilters(), element: ["death"], circle: [2] };
		const merged = mergeChipFilters(base, extractQueryChips("sangue 2º círculo").chips);
		assert.deepEqual(merged.element, ["death", "blood"]);
		assert.deepEqual(merged.circle, [2]);
		assert.deepEqual(base.element, ["death"]);
	});
});
