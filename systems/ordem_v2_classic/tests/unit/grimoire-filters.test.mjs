// Rodar: npm test. Filtros do Grimório (GR-15/16/17/55): E entre filtros, OU dentro do filtro, contagem por chip, "sem função".
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyFilters, costBucket, countActiveFilters, emptyFilters, facetCounts, sortEntries, toggleFilter } from "../../module/helpers/grimoire-filters.mjs";

const R = (name, element, circle, functions = ["Dano"], extra = {}) => ({ kind: "ritual", name, nameNorm: name.toLowerCase(), element, circle, functions, skillResis: "", studentForm: false, trueForm: false, targetKind: "creature", cost: circle, ...extra });
const P = (name, abilityType, className, cost = 0, extra = {}) => ({ kind: "power", name, nameNorm: name.toLowerCase(), abilityType, className, cost, activation: "passive", ...extra });
const C = (name, category) => ({ kind: "condition", name, nameNorm: name.toLowerCase(), category });

const E = [
	R("A", "blood", 1, ["Dano"]),
	R("B", "blood", 2, ["Proteção"], { skillResis: "will", studentForm: true }),
	R("C", "death", 2, ["Dano", "Controle"], { trueForm: true, targetKind: "area" }),
	R("D", "knowledge", 3, []),
	P("Golpe", "class", "Combatente", 0),
	P("Truque", "path", "Ocultista", 2, { pathName: "Flagelador" }),
	P("Mestre", "general", null, 3),
	C("Abalado", "mental"),
	C("Cego", "perception"),
];
const nomes = (l) => l.map((e) => e.name);

describe("filtros", () => {
	it("sem filtro devolve tudo", () => assert.equal(applyFilters(E, emptyFilters()).length, E.length));
	it("OU dentro do mesmo filtro", () => {
		assert.deepEqual(nomes(applyFilters(E, { element: ["blood", "death"] })), ["A", "B", "C"]);
		assert.deepEqual(nomes(applyFilters(E, { circle: [1, 3] })), ["A", "D"]);
	});
	it("E entre filtros diferentes", () => {
		assert.deepEqual(nomes(applyFilters(E, { element: ["blood", "death"], circle: [2] })), ["B", "C"]);
		assert.deepEqual(nomes(applyFilters(E, { element: ["blood"], functions: ["Proteção"] })), ["B"]);
	});
	it("função: casa qualquer das funções do ritual e aceita 'sem função'", () => {
		assert.deepEqual(nomes(applyFilters(E, { functions: ["Controle"] })), ["C"]);
		assert.deepEqual(nomes(applyFilters(E, { functions: ["Dano"] })), ["A", "C"]);
		assert.deepEqual(nomes(applyFilters(E, { functions: ["none"] })), ["D"]);
	});
	it("forma, alvo e resistência", () => {
		assert.deepEqual(nomes(applyFilters(E, { form: ["student"] })), ["B"]);
		assert.deepEqual(nomes(applyFilters(E, { form: ["student", "true"] })), ["B", "C"]);
		assert.deepEqual(nomes(applyFilters(E, { target: ["area"] })), ["C"]);
		assert.deepEqual(nomes(applyFilters(E, { resistance: ["will"] })), ["B"]);
	});
	it("poderes: tipo, classe, trilha e custo (0, 1, 2, 3+)", () => {
		assert.deepEqual(nomes(applyFilters(E, { abilityType: ["class", "path"] })), ["Golpe", "Truque"]);
		assert.deepEqual(nomes(applyFilters(E, { className: ["Ocultista"] })), ["Truque"]);
		assert.deepEqual(nomes(applyFilters(E, { pathName: ["Flagelador"] })), ["Truque"]);
		assert.deepEqual(nomes(applyFilters(E, { cost: ["0"] })), ["Golpe"]);
		assert.deepEqual(nomes(applyFilters(E, { cost: ["3+"] })), ["Mestre"]);
		assert.equal(costBucket(7), "3+");
		assert.equal(costBucket(undefined), "0");
	});
	it("filtro de um tipo exclui os outros tipos (círculo não casa poder nem condição)", () => {
		assert.deepEqual(nomes(applyFilters(E, { circle: [2] })), ["B", "C"]);
		assert.deepEqual(nomes(applyFilters(E, { category: ["mental"] })), ["Abalado"]);
	});
	it("não altera a lista original", () => {
		const copia = E.slice();
		applyFilters(E, { element: ["blood"] });
		assert.deepEqual(E, copia);
	});
});

describe("contagem por chip e filtros ativos", () => {
	it("conta cada elemento considerando os outros filtros (sem contar o próprio)", () => {
		const f = { circle: [2] };
		assert.deepEqual(facetCounts(E, f, "element"), { blood: 1, death: 1 });
		const g = { element: ["blood"] };
		assert.deepEqual(facetCounts(E, g, "element"), { blood: 2, death: 1, knowledge: 1 }); // o próprio filtro é ignorado
	});
	it("conta funções, incluindo 'none'", () => {
		assert.deepEqual(facetCounts(E, {}, "functions"), { Dano: 2, Proteção: 1, Controle: 1, none: 1 });
	});
	it("conta filtros ligados e liga/desliga valores", () => {
		let f = emptyFilters();
		assert.equal(countActiveFilters(f), 0);
		f = toggleFilter(f, "element", "blood");
		f = toggleFilter(f, "circle", 2);
		assert.equal(countActiveFilters(f), 2);
		assert.equal(countActiveFilters(f, ["circle"]), 1);
		f = toggleFilter(f, "element", "blood");
		assert.deepEqual(f.element, []);
	});
});

describe("ordenação", () => {
	it("por nome, círculo, custo e função", () => {
		const r = E.filter((e) => e.kind === "ritual");
		assert.deepEqual(nomes(sortEntries(r, "name")), ["A", "B", "C", "D"]);
		assert.deepEqual(nomes(sortEntries(r, "circle")), ["A", "B", "C", "D"]);
		assert.deepEqual(nomes(sortEntries(r, "cost")), ["A", "B", "C", "D"]);
		assert.deepEqual(nomes(sortEntries(r, "function")), ["A", "C", "B", "D"]); // Dano, Dano, Proteção, sem função
		assert.deepEqual(nomes(sortEntries([E[2], E[0]], "relevance")), ["C", "A"]);
	});
});
