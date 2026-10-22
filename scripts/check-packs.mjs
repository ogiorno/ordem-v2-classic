// Confere se cada compêndio compilado (packs/<nome>) tem todos os documentos das fontes (packs/_source/<nome>).
// Pega o erro de compilar sem ler subpastas, que deixa compêndios quase vazios. Uso: npm run packs:check (depois de npm run packs:pack)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ClassicLevel } = require("classic-level");

/** Lê recursivamente os .json da fonte e devolve o conjunto de chaves (`_key`) dos documentos de nível superior. */
const sourceKeys = (dir, keys = new Set()) => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) sourceKeys(full, keys);
		else if (entry.name.endsWith(".json")) {
			const key = JSON.parse(fs.readFileSync(full, "utf8"))._key;
			if (key) keys.add(key);
		}
	}
	return keys;
};

let problems = 0;
let checked = 0;
for (const kind of ["modules", "systems"]) {
	if (!fs.existsSync(kind)) continue;
	for (const pkg of fs.readdirSync(kind, { withFileTypes: true }).filter((d) => d.isDirectory())) {
		const base = path.join(kind, pkg.name, "packs");
		const srcRoot = path.join(base, "_source");
		if (!fs.existsSync(srcRoot)) continue;
		for (const pack of fs.readdirSync(srcRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
			const expected = sourceKeys(path.join(srcRoot, pack.name));
			const dest = path.join(base, pack.name);
			if (!fs.existsSync(dest)) { console.log(`FALTA  ${dest}: compêndio não compilado`); problems++; continue; }
			const db = new ClassicLevel(dest, { keyEncoding: "utf8", valueEncoding: "utf8" });
			await db.open();
			const found = new Set();
			// só documentos de nível superior (`!items!id`); os embutidos (`!actors.items!...`) têm ponto no nome da coleção
			for await (const key of db.keys()) if (/^![a-z]+!/.test(key)) found.add(key);
			await db.close();
			const missing = [...expected].filter((k) => !found.has(k));
			const extra = [...found].filter((k) => !expected.has(k));
			checked++;
			const status = missing.length || extra.length ? "ERRO  " : "ok    ";
			if (missing.length || extra.length) problems++;
			console.log(`${status} ${pkg.name}/${pack.name}: fonte ${expected.size}, compilado ${found.size}${missing.length ? `, faltam ${missing.length}` : ""}${extra.length ? `, sobram ${extra.length}` : ""}`);
		}
	}
}
console.log(problems ? `\n${problems} compêndio(s) com problema.` : `\nTodos os ${checked} compêndios conferem com as fontes.`);
process.exit(problems ? 1 : 0);
