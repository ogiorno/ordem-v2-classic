// Mostra os itens de um compêndio (_source) em uma linha cada: node tools/sah/dump.mjs <pack> [filtro-regex] [--stub]
import { PackSource } from "./lib.mjs";

const [packName, filter, flag] = process.argv.slice(2);
const src = new PackSource(packName);
const re = filter && filter !== "-" ? new RegExp(filter, "i") : null;
for (const d of src.items) {
	const j = d.json;
	const stub = /Você pode encontrar esse conteúdo|OGL/.test(j.system?.description ?? "");
	if (flag === "--stub" && !stub) continue;
	if (re && !re.test(j.name) && !re.test(d.file)) continue;
	const rel = d.file.split(/[\\/]packs[\\/]_source[\\/]/)[1];
	const sys = { ...j.system };
	delete sys.description;
	delete sys.chatDescription;
	console.log(`${rel} | ${j.name} | stub=${stub} | ${JSON.stringify(sys)}`);
}
