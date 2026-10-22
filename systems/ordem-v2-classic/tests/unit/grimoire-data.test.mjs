// Rodar: npm test. O índice do Grimório montado com os dados REAIS dos compêndios (packs/_source): rituais, poderes e condições.
// Pega dado quebrado numa atualização do livro (GR-11, GR-12, GR-13, GR-23, GR-24, GR-25, GR-27).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ELEMENTS, conditionEntry, powerEntry, ritualEntry, visibleEntries } from "../../module/helpers/grimoire-index.mjs";
import { searchEntries } from "../../module/helpers/grimoire-text.mjs";
import { ritualFactCells } from "../../module/helpers/grimoire-reading.mjs";
import { KNOWN_CONDITIONS } from "../../module/helpers/grimoire-conditions.mjs";

const SRC = path.resolve(import.meta.dirname, "../../packs/_source");
const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? walk(full) : full.endsWith(".json") ? [full] : [];
	});
const load = (pack) => walk(path.join(SRC, pack)).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));

const rituals = load("rituals").filter((d) => d._key?.startsWith("!items!")).map((d) => ritualEntry({ uuid: `Compendium.ordem-v2-classic.rituals.Item.${d._id}`, name: d.name, img: d.img, system: d.system }));

const POWER_PACKS = ["fighterPowers", "specialistPowers", "occultistPowers", "survivalPowers", "originPowers", "generalPowers", "paranormalPowers", "pathFighter", "pathSpecialist", "pathOccultist"];
const powers = POWER_PACKS.flatMap((pack) => {
	const docs = load(pack);
	const folders = Object.fromEntries(docs.filter((d) => d._key?.startsWith("!folders!")).map((f) => [f._id, f.name]));
	return docs.filter((d) => d._key?.startsWith("!items!")).map((d) => powerEntry({ uuid: `Compendium.ordem-v2-classic.${pack}.Item.${d._id}`, name: d.name, img: d.img, system: d.system, flags: d.flags }, { pack, folderName: folders[d.folder] ?? null }));
});

const journal = load("bookrules").find((d) => d.name === "Condições");
const conditions = (journal?.pages ?? []).map((p) => conditionEntry({ uuid: `JournalEntry.${journal._id}.JournalEntryPage.${p._id}`, name: p.name, text: p.text }));
const todos = [...rituals, ...powers, ...conditions];

describe("rituais (98)", () => {
	it("todos entram no índice com elemento, círculo, custo e funções", () => {
		assert.equal(rituals.length, 98);
		for (const r of rituals) {
			assert.ok(ELEMENTS.includes(r.element), `${r.name}: elemento`);
			assert.ok([1, 2, 3, 4].includes(r.circle), `${r.name}: círculo`);
			assert.ok(r.cost > 0, `${r.name}: custo`);
			assert.ok(r.functions.length > 0, `${r.name}: sem função`);
			assert.ok(r.nameTokens.length > 0 && r.textNorm.length > 40, `${r.name}: busca`);
		}
	});
	it("só os cinco elementos e os quatro círculos reais (nada de Carne nem 5º círculo)", () => {
		assert.deepEqual([...new Set(rituals.map((r) => r.element))].sort(), [...ELEMENTS].sort());
		assert.deepEqual([...new Set(rituals.map((r) => r.circle))].sort(), [1, 2, 3, 4]);
	});
	it("a faixa de dados nunca tem célula vazia e sempre tem Execução, Alcance, Duração e Custo", () => {
		for (const r of rituals) {
			const cells = ritualFactCells(r);
			assert.ok(cells.every((c) => c.value && c.value !== "—"), `${r.name}: célula vazia`);
			const keys = cells.map((c) => c.key);
			for (const k of ["execution", "range", "duration", "cost"]) assert.ok(keys.includes(k), `${r.name}: falta ${k}`);
		}
	});
	it("o Alvo/Área nunca mostra \"Veja texto\": os rituais de Efeito mostram o valor do livro e os demais escondem a célula", () => {
		for (const r of rituals) {
			const alvo = ritualFactCells(r).find((c) => c.key === "target")?.value ?? "";
			assert.ok(!/^veja/i.test(alvo), `${r.name}: Alvo/Área "${alvo}"`);
		}
	});
	it("Paradoxo é Morte, 2º círculo, médio, Fortitude reduz à metade (como no livro)", () => {
		const p = rituals.find((r) => r.name === "Paradoxo");
		assert.equal(p.element, "death");
		assert.equal(p.circle, 2);
		const cells = Object.fromEntries(ritualFactCells(p).map((c) => [c.key, c.value]));
		assert.equal(cells.range, "Médio");
		assert.equal(cells.resistance, "Fortitude reduz à metade");
		assert.equal(cells.cost, "3 PE");
		assert.match(cells.target, /esfera com 6m de raio/i);
	});
});

describe("poderes", () => {
	it("330 poderes: 98 de classe, 110 de trilha, 36 gerais, 57 de origem e 29 paranormais", () => {
		assert.equal(powers.length, 330);
		const by = (t) => powers.filter((p) => p.abilityType === t).length;
		assert.deepEqual([by("class"), by("path"), by("general"), by("origin"), by("paranormal"), by("other")], [98, 110, 36, 57, 29, 0]);
	});
	it("poder de trilha tem trilha e classe; paranormal tem elemento", () => {
		for (const p of powers.filter((x) => x.abilityType === "path")) {
			assert.ok(p.pathName, `${p.name}: sem trilha`);
			assert.ok(p.className, `${p.name}: sem classe`);
		}
		for (const p of powers.filter((x) => x.abilityType === "paranormal" && x.element)) assert.ok(ELEMENTS.includes(p.element));
		assert.ok(powers.filter((x) => x.abilityType === "paranormal" && x.element).length >= 28);
	});
	it("a fonte é Livro de Regras ou Sobrevivendo ao Horror", () => {
		assert.ok(powers.every((p) => ["livro", "sah"].includes(p.source)));
		assert.ok(powers.some((p) => p.source === "sah"));
	});
});

describe("condições (37)", () => {
	it("as 37 condições do livro entram, com texto e categoria", () => {
		assert.equal(conditions.length, 37);
		for (const c of conditions) {
			assert.ok(c.textNorm.length > 20, `${c.name}: sem texto`);
			assert.ok(c.category, `${c.name}: sem categoria (acrescente na tabela de grimoire-conditions.mjs)`);
		}
		assert.deepEqual(conditions.map((c) => c.name).sort(), [...KNOWN_CONDITIONS].sort());
	});
});

describe("busca no índice completo", () => {
	it("todo nome é achado pela busca exata, e por uma troca de letras no meio", () => {
		for (const e of todos) {
			const exato = searchEntries(todos, e.name).results.some((r) => r.entry.uuid === e.uuid);
			assert.ok(exato, `não achou "${e.name}"`);
		}
		let falhas = [];
		for (const e of todos) {
			const palavra = e.nameTokens.find((t) => t.length >= 8);
			if (!palavra) continue;
			const i = Math.floor(palavra.length / 2);
			const erro = palavra.slice(0, i) + palavra[i + 1] + palavra[i] + palavra.slice(i + 2);
			if (erro === palavra) continue;
			// o erro ainda casa o radical de 5 ou mais nomes ("ritualsitica" ~ ritual…): a busca já mostra só os exatos, sem aproximar
			if (searchEntries(todos, erro, { fuzzy: false }).results.length >= 5) continue;
			if (!searchEntries(todos, erro).results.some((r) => r.entry.uuid === e.uuid)) falhas.push(`${e.name} ← ${erro}`);
		}
		assert.deepEqual(falhas, []);
	});
	it("busca por elemento/palavra do texto e por tolerância no índice real", () => {
		assert.ok(searchEntries(todos, "paradocso").results.some((r) => r.entry.name === "Paradoxo"));
		assert.ok(searchEntries(todos, "abalodo").results.some((r) => r.entry.name === "Abalado"));
		assert.ok(searchEntries(todos, "cicatrizar").results.some((r) => r.entry.name === "Cicatrização"));
	});
	it("o Mestre vê tudo e o jogador não vê o que está oculto", () => {
		const oculto = { ...rituals[0], hidden: true };
		assert.equal(visibleEntries([oculto, rituals[1]], { isGM: false }).length, 1);
		assert.equal(visibleEntries([oculto, rituals[1]], { isGM: true }).length, 2);
	});
});
