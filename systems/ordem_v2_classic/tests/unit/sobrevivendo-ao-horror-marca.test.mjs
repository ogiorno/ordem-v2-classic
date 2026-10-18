// Rodar: npm test. Marca discreta de origem (flags.ordem_v2_classic.source = "sah") nos itens do suplemento
// Sobrevivendo ao Horror, gravada em packs/_source por tools/sah/build.mjs e lida pelo Grimório.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { powerEntry } from "../../module/helpers/grimoire-index.mjs";

const SRC = path.resolve(import.meta.dirname, "../../packs/_source");

const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? walk(full) : full.endsWith(".json") ? [full] : [];
	});

/** Todos os itens (não pastas) de todos os compêndios, com o pacote e as pastas do caminho. */
const items = fs.readdirSync(SRC).flatMap((pack) =>
	walk(path.join(SRC, pack))
		.map((file) => ({ pack, segments: path.relative(path.join(SRC, pack), file).split(path.sep), json: JSON.parse(fs.readFileSync(file, "utf8")) }))
		.filter((d) => d.json._key?.startsWith("!items!"))
);

const marked = (d) => d.json.flags?.ordem_v2_classic?.source === "sah";
const inSahFolder = (d) => d.segments.includes("sobrevivendo-ao-horror");
// Itens do suplemento que não ficam numa pasta "sobrevivendo-ao-horror".
const PARANORMAL = ["Absorver Conhecimento", "Apatia Herege", "Conexão Empática", "Valer-se do Caos", "Antecipar Vitalidade", "Aura de Pavor", "Espreitar da Besta", "Instintos Sanguinários"];
const OUTSIDE = { classes: ["Sobrevivente"], protections: ["Proteção Pesada"], paranormalPowers: PARANORMAL };
const isSah = (d) => inSahFolder(d) || d.pack === "survivalPowers" || (OUTSIDE[d.pack] ?? []).includes(d.json.name);

describe("marca de origem do suplemento nos compêndios", () => {
	it("todo item do suplemento tem a marca", () => {
		const sem = items.filter((d) => isSah(d) && !marked(d)).map((d) => `${d.pack}: ${d.json.name}`);
		assert.deepEqual(sem, [], "rode node tools/sah/build.mjs para gravar a marca");
	});
	it("nenhum item de outra fonte leva a marca", () => {
		const demais = items.filter((d) => marked(d) && !isSah(d)).map((d) => `${d.pack}: ${d.json.name}`);
		assert.deepEqual(demais, []);
	});
	it("o que é do Livro de Regras e o build mexe não é marcado", () => {
		for (const [pack, name] of [["originPowers", "Calejado"], ["pathFighter", "NEX 10% - Casca Grossa"], ["general", "Medidor de Estabilidade da Membrana"]]) {
			const d = items.find((x) => x.pack === pack && x.json.name === name);
			assert.ok(d, `${name} sumiu do compêndio`);
			assert.ok(!marked(d), `${name} é do Livro de Regras`);
		}
	});
	it("origens e trilhas de outros livros (Arquivos Secretos) não são marcadas", () => {
		const as = items.filter((d) => d.segments.includes("arquivos-secretos"));
		assert.ok(as.length >= 13);
		assert.ok(as.every((d) => !marked(d)));
	});
	it("a marca cobre cada tipo de conteúdo do suplemento", () => {
		const tipos = (pack) => items.filter((d) => d.pack === pack && marked(d)).length;
		assert.equal(tipos("origins"), 20);
		assert.equal(tipos("originPowers"), 20);
		assert.equal(tipos("paths"), 15);
		assert.equal(tipos("classes"), 1);
		assert.equal(tipos("paranormalPowers"), 8);
		assert.equal(tipos("generalPowers"), 34);
		assert.equal(tipos("armaments"), 12);
		assert.equal(tipos("protections"), 1);
		assert.ok(tipos("survivalPowers") >= 9);
		assert.ok(tipos("general") >= 70);
		assert.ok(items.filter(marked).length >= 277);
	});
	it("o valor da marca é sempre a string sah", () => {
		for (const d of items.filter((x) => x.json.flags?.ordem_v2_classic && "source" in x.json.flags.ordem_v2_classic)) assert.equal(d.json.flags.ordem_v2_classic.source, "sah", d.json.name);
	});
	it("a marca não vira ritual: os rituais da Biblioteca ficam sem ela", () => {
		assert.ok(items.filter((d) => d.pack === "rituals").every((d) => !marked(d)));
	});
});

describe("Grimório lê a marca", () => {
	const doc = (flags) => ({ uuid: "Compendium.x.Item.1", name: "Poder", img: "", system: { abilityType: "paranormal", description: "" }, flags });
	it("a marca vale mais que a pasta", () => {
		assert.equal(powerEntry(doc({ ordem_v2_classic: { source: "sah" } }), { pack: "paranormalPowers", folderName: "Poderes de Sangue" }).source, "sah");
	});
	it("sem marca e fora da pasta do suplemento, a fonte é o Livro", () => {
		assert.equal(powerEntry(doc({}), { pack: "paranormalPowers", folderName: "Poderes de Sangue" }).source, "livro");
		assert.equal(powerEntry({ ...doc(undefined) }, { pack: "paranormalPowers", folderName: "Poderes de Sangue" }).source, "livro");
	});
	it("sem marca, a pasta e o pacote do suplemento continuam valendo", () => {
		assert.equal(powerEntry(doc({}), { pack: "originPowers", folderName: "Sobrevivendo ao Horror" }).source, "sah");
		assert.equal(powerEntry(doc({}), { pack: "survivalPowers", folderName: null }).source, "sah");
	});
	it("os 8 poderes paranormais do suplemento aparecem com a fonte do suplemento", () => {
		const entries = items
			.filter((d) => d.pack === "paranormalPowers")
			.map((d) => powerEntry({ uuid: `x.${d.json._id}`, name: d.json.name, img: d.json.img, system: d.json.system, flags: d.json.flags }, { pack: "paranormalPowers", folderName: null }));
		assert.deepEqual(entries.filter((e) => e.source === "sah").map((e) => e.name).sort(), [...PARANORMAL].sort());
	});
});
