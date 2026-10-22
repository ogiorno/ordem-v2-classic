// Rodar: npm test. Equipamentos, armas e itens amaldiçoados do suplemento Sobrevivendo ao Horror v1.3
// (Tabelas 1.4, 1.5 e 1.6 do livro) conferidos contra os compêndios (_source).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeName } from "../../module/helpers/level-progression-rules.mjs";

const SRC = path.resolve(import.meta.dirname, "../../packs/_source");
const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? walk(full) : full.endsWith(".json") ? [full] : [];
	});
const load = (pack) => walk(path.join(SRC, pack)).map((file) => ({ file, json: JSON.parse(fs.readFileSync(file, "utf8")) }));
const itemsOf = (pack) => load(pack).filter((d) => d.json._key?.startsWith("!items!"));
const foldersOf = (pack) => load(pack).filter((d) => d.json._key?.startsWith("!folders!"));
const findItem = (pack, name) => itemsOf(pack).find((d) => normalizeName(d.json.name) === normalizeName(name))?.json;
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const STUB = /Você pode encontrar esse conteúdo/;

// Tabela 1.4 (p. 38): categoria, dano, crítico, alcance, tipo, espaços
const DTYPE = { P: "piercingDamage", C: "cuttingDamage", I: "impactDamage", B: "ballisticDamage" };
const TABLE_1_4 = {
	"Pregador Pneumático": [0, "1d4", "x4", "Curto", "P", 1],
	"Estilingue": [0, "1d4", "x2", "Curto", "I", 1],
	"Revólver Compacto": [1, "2d4", "19/x3", "Curto", "P", 1],
	"Baioneta": [0, "1d4", "19", "", "P", 1],
	"Faca Tática": [1, "1d6", "19", "Curto", "C", 1],
	"Gancho de Carne": [0, "1d4", "x4", "", "P", 1],
	"Bastão Policial": [1, "1d6", "x2", "Curto", "I", 1],
	"Picareta": [0, "1d6", "x4", "", "P", 1],
	"Shuriken": [1, "1d4", "x2", "Curto", "P", 0.5],
	"Pistola Pesada": [1, "2d8", "18", "Curto", "B", 1],
	"Espingarda de Cano Duplo": [2, "4d6", "x3", "Curto", "B", 2],
};

// Tabela 1.5 (p. 40): categoria, espaços
const TABLE_1_5 = {
	"Amuleto Sagrado": [0, 1], "Celular": [0, 1], "Chave de Fenda Universal": [0, 1], "Chaves": [0, 1], "Documentos Falsos": [1, 1], "Manual Operacional": [1, 1], "Notebook": [0, 2],
	"Dinamite": [1, 1], "Explosivo Plástico": [1, 1], "Galão Vermelho": [0, 2], "Granada de Gás Sonífero": [1, 1], "Granada de PEM": [1, 1],
	"Alarme de Movimento": [0, 1], "Alimento Energético": [2, 1], "Aplicador de Medicamentos": [1, 1], "Braçadeira Reforçada": [1, 1], "Cão Adestrado": [1, 0],
	"Coldre Saque Rápido": [1, 1], "Equipamento de Escuta": [1, 1], "Estrepes (saco)": [0, 1], "Faixa de Pregos": [1, 2], "Isqueiro": [0, 0.5],
	"Antibiótico": [1, 0.5], "Antídoto": [1, 0.5], "Antiemético": [1, 0.5], "Antihistamínico": [1, 0.5], "Anti-inflamatório": [1, 0.5], "Antitérmico": [1, 0.5], "Broncodilatador": [1, 0.5], "Coagulante": [1, 0.5],
	"Óculos de Visão Noturna": [1, 1], "Óculos Escuros": [0, 1], "Pá": [0, 2], "Paraquedas": [1, 2], "Traje de Mergulho": [1, 2], "Traje Espacial": [2, 5],
	"Ligação Direta Infernal": [2, 1], "Medidor de Condição Vertebral": [2, 1], "Pé de Morto": [2, 1], "Pen Drive Selado": [2, 0.5], "Valete da Salvação": [1, 0.5],
};

// Tabela 1.6 (p. 58): categoria, espaços
const TABLE_1_6 = {
	"Ampulheta do Tempo Sofrido": [2, 1], "Arreio Neural": [2, 1], "Câmera Obscura": [3, 1], "Centrifugador Existencial": [3, 1], "Conector de Membros": [3, 1],
	"Dose d’A Praga": [3, 1], "Enxame Fantasmagórico": [3, 1], "Espelho Refletor": [2, 1], "Fuzil Alheio": [4, 2], "Injeção de Lodo": [2, 0.5],
	"Instantâneo Mortal": [2, 0.5], "Mandíbula Agonizante": [2, 1], "A Primeira Adaga": [3, 1], "Projétil de Lodo, curto": [1, 1], "Projétil de Lodo, longo": [2, 1],
	"Rádio Chiador": [2, 1], "Repositório do Fracasso": [2, 1], "Retalho Tenebroso": [2, 1], "Tábula do Saber Custoso": [2, 1],
};

describe("armas do suplemento (Tabela 1.4)", () => {
	for (const [name, [cat, dmg, crit, range, type, space]] of Object.entries(TABLE_1_4)) {
		it(`${name}: categoria, dano, crítico, alcance, tipo e espaços`, () => {
			const doc = findItem("armaments", name);
			assert.ok(doc, "arma ausente");
			assert.doesNotMatch(doc.system.description, STUB);
			assert.equal(doc.system.category, cat, "categoria");
			assert.equal(doc.system.formulas.damage.formula, dmg, "dano");
			assert.equal(doc.system.critical, crit, "crítico");
			assert.equal(doc.system.range, range, "alcance");
			assert.equal(doc.system.formulas.damage.type, DTYPE[type], "tipo de dano");
			assert.equal(doc.system.weight, space, "espaços");
		});
	}
	it("armas ágeis e de arremesso conforme o texto", () => {
		assert.equal(findItem("armaments", "Faca Tática").system.conditions.agile, true);
		assert.equal(findItem("armaments", "Faca Tática").system.conditions.throwable, true);
		assert.equal(findItem("armaments", "Bastão Policial").system.conditions.agile, true);
		assert.equal(findItem("armaments", "Shuriken").system.conditions.throwable, true);
		assert.equal(findItem("armaments", "Estilingue").system.formulas.damage.attr, "str", "estilingue soma Força no dano");
	});
});

describe("equipamentos gerais (Tabela 1.5) e itens paranormais", () => {
	for (const [name, [cat, space]] of Object.entries(TABLE_1_5)) {
		it(`${name}: categoria ${cat}, ${space} espaço(s), texto do livro`, () => {
			const doc = findItem("general", name);
			assert.ok(doc, "item ausente");
			assert.doesNotMatch(doc.system.description, STUB);
			assert.equal(doc.system.category, cat, "categoria");
			assert.equal(doc.system.weight, space, "espaços");
			assert.ok(plain(doc.system.description).length > 40);
		});
	}
	it("catalisadores ritualísticos: 4 tipos × 4 elementos, categoria I e 0,5 espaço", () => {
		for (const elem of ["Sangue", "Morte", "Conhecimento", "Energia"]) {
			for (const kind of ["Ampliador", "Perturbador", "Potencializador", "Prolongador"]) {
				const doc = findItem("general", `${kind} de ${elem}`);
				assert.ok(doc, `${kind} de ${elem} ausente`);
				assert.equal(doc.system.category, 1);
				assert.equal(doc.system.weight, 0.5);
				assert.doesNotMatch(doc.system.description, STUB);
			}
		}
		assert.equal(findItem("general", "Pertubador de Sangue"), undefined, "nome com erro de digitação não deve existir");
	});
	it("efeitos passivos dos itens", () => {
		const fx = (name) => (findItem("general", name)?.effects ?? []).flatMap((e) => e.system.changes.map((c) => [c.key, c.value]));
		assert.deepEqual(fx("Amuleto Sagrado"), [["system.skills.religion.mod", 2], ["system.skills.will.mod", 2]]);
		assert.deepEqual(fx("Pé de Morto"), [["system.skills.stealth.mod", 5]]);
		assert.deepEqual(fx("Medidor de Condição Vertebral"), [["system.skills.resilience.mod", 2]]);
		assert.deepEqual(fx("Cão Adestrado"), [["system.skills.investigation.mod", 2], ["system.skills.perception.mod", 2]]);
	});
	it("Medidor de Estabilidade da Membrana é do Livro de Regras; o Medidor de Condição Vertebral é do suplemento", () => {
		const where = (name) => itemsOf("general").find((d) => d.json.name === name).file.replace(/\\/g, "/");
		assert.match(where("Medidor de Estabilidade da Membrana"), /livro-de-regras\/itens-paranormais\//);
		assert.match(where("Medidor de Condição Vertebral"), /sobrevivendo-ao-horror\/itens-paranormais\//);
		assert.doesNotMatch(findItem("general", "Medidor de Estabilidade da Membrana").system.description, STUB);
	});
});

describe("itens amaldiçoados e modificações", () => {
	for (const [name, [cat, space]] of Object.entries(TABLE_1_6)) {
		it(`${name}: categoria ${cat}, ${space} espaço(s)`, () => {
			const doc = findItem("general", name) ?? findItem("armaments", name);
			assert.ok(doc, "item ausente");
			assert.equal(doc.system.category, cat);
			assert.equal(doc.system.weight, space);
			assert.ok(plain(doc.system.description).length > 100);
			assert.doesNotMatch(doc.system.description, STUB);
		});
	}
	it("Fuzil Alheio é uma arma de Energia que não usa munição", () => {
		const fuzil = findItem("armaments", "Fuzil Alheio");
		assert.equal(fuzil.type, "armament");
		assert.equal(fuzil.system.formulas.damage.type, "energyDamage");
		assert.equal(fuzil.system.types.ammunitionType, "");
		assert.equal(fuzil.system.category, 4);
	});
	it("modificações do suplemento existem", () => {
		for (const name of ["Bateria Potente", "Carregador Rápido", "Lente de Revelação"]) assert.ok(findItem("general", name), name);
	});
	it("os cinco elementos têm pasta de itens amaldiçoados", () => {
		const folders = foldersOf("general").map((d) => d.json.name);
		for (const name of ["Itens Amaldiçoados", "Sangue", "Morte", "Conhecimento", "Energia", "Medo", "Modificações"]) assert.ok(folders.includes(name), name);
	});
});
