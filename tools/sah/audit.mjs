// Auditoria offline do conteúdo dos compêndios: origem → poder concedido, trilha → habilidades por nível.
//   node tools/sah/audit.mjs            → lista pendências
//   node tools/sah/audit.mjs --origens  → mostra também o poder de cada origem
import { PackSource } from "./lib.mjs";
import { abilityUnlockLevel, findOriginPower, folderMatchesPath } from "../../systems/ordem_v2_classic/module/helpers/level-progression-rules.mjs";

const showOrigins = process.argv.includes("--origens");
const issues = [];

const powers = new PackSource("originPowers").items.map((d) => d.json.name);
for (const d of new PackSource("origins").items.filter((x) => x.json.type === "origin")) {
	const p = findOriginPower(d.json.name, d.json.system.description, powers);
	if (showOrigins) console.log(d.json.name.padEnd(30), "→", p ?? "—");
	if (!p) issues.push(`origem sem poder concedido: ${d.json.name}`);
}

const abilities = [];
for (const pack of ["pathFighter", "pathSpecialist", "pathOccultist", "survivalPowers"]) {
	const src = new PackSource(pack);
	const byId = new Map(src.folders.map((f) => [f.json._id, f.json]));
	const chain = (id) => {
		const names = [];
		for (let f = byId.get(id); f; f = byId.get(f.folder)) names.unshift(f.name);
		return names;
	};
	for (const d of src.items.filter((x) => x.json.type === "ability")) abilities.push({ pack, name: d.json.name, chain: d.json.folder ? chain(d.json.folder) : [] });
}
for (const d of new PackSource("paths").items.filter((x) => x.json.type === "path")) {
	const found = abilities.filter((a) => folderMatchesPath(a.chain, d.json.name));
	const levels = [...new Set(found.map((a) => abilityUnlockLevel(a.name)).filter((l) => l !== null))].sort((a, b) => a - b);
	if (!found.length) issues.push(`trilha sem habilidades cadastradas: ${d.json.name}`);
	else {
		const need = found.some((a) => a.pack === "survivalPowers") ? [2, 4] : [2, 8, 13, 20];
		const miss = need.filter((l) => !levels.includes(l));
		if (miss.length) issues.push(`trilha ${d.json.name}: faltam níveis ${miss.join(",")} (tem ${levels.join(",")})`);
	}
}
console.log(issues.length ? issues.join("\n") : "sem pendências");
console.log(`${issues.length} pendências`);
