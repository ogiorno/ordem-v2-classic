// Rodar: npm test. Toda chave de tradução op.grimoire.* usada no código e nos templates do Grimório existe em pt-BR e em en.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SYSTEM = path.resolve(import.meta.dirname, "../..");
const read = (rel) => fs.readFileSync(path.join(SYSTEM, rel), "utf8");
const pt = JSON.parse(read("lang/pt-BR.json"));
const en = JSON.parse(read("lang/en.json"));
const fontes = ["module/applications/grimoire-app.mjs", "module/helpers/grimoire.mjs", ...fs.readdirSync(path.join(SYSTEM, "templates/apps")).filter((f) => f.startsWith("grimoire-")).map((f) => `templates/apps/${f}`)];
const usadas = new Set(fontes.flatMap((f) => [...read(f).matchAll(/op\.grimoire\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g)].map((m) => m[0])));
// chaves montadas em tempo de execução (op.grimoire.sort.${id}, op.grimoire.tab.*)
for (const id of ["relevance", "name", "circle", "cost", "function"]) usadas.add(`op.grimoire.sort.${id}`);
for (const id of ["ritual", "power", "condition"]) usadas.add(`op.grimoire.tab.${id}`);
usadas.delete("op.grimoire.sort");
usadas.delete("op.grimoire.tab");

describe("tradução do Grimório", () => {
	it("usa chaves e todas existem em pt-BR e en", () => {
		assert.ok(usadas.size > 40, `só ${usadas.size} chaves encontradas`);
		for (const k of usadas) {
			assert.ok(k in pt, `falta em pt-BR: ${k}`);
			assert.ok(k in en, `falta em en: ${k}`);
		}
	});
	it("não há chave op.grimoire.* sobrando em uma língua e faltando na outra", () => {
		const a = Object.keys(pt).filter((k) => k.startsWith("op.grimoire.")).sort();
		const b = Object.keys(en).filter((k) => k.startsWith("op.grimoire.")).sort();
		assert.deepEqual(a, b);
	});
	it("os textos com {n}, {total} e {name} têm os mesmos marcadores nas duas línguas", () => {
		for (const k of Object.keys(pt).filter((x) => x.startsWith("op.grimoire."))) {
			const marks = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
			assert.equal(marks(pt[k]), marks(en[k]), k);
		}
	});
});
