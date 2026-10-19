import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Copia os ícones gerados (status "generated") para assets/ability-icons e grava fixtures/threat-ability-icons.json
// (id da habilidade → caminho). Pendentes ficam de fora. Uso: node tools/build-threat-ability-icons.mjs [--check] [pasta-origem]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const srcDir = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "D:/[codex]/2026-10-20/c-users-geh-vtt-gera-um/outputs/tarefas-habilidades-ameacas/assets/ability-icons";
const destDir = path.join(root, "assets", "ability-icons");
const outFile = path.join(root, "fixtures", "threat-ability-icons.json");
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

const map = readJson(path.join(srcDir, "icon-map.json"));
const corpus = readJson(path.join(root, "fixtures", "threat-abilities-v1-3.json"));
const extra = readJson(path.join(root, "fixtures", "threat-abilities-extra.json"));
const creatures = [...corpus.creatures, ...extra.creatures];

const icons = {};
const used = new Set();
for (const entry of map.items) {
	if (entry.status !== "generated") continue;
	const creature = creatures.find((c) => String(c.id) === String(entry.creatureId));
	const ability = creature?.abilities.find((a) => a.name === entry.ability && !used.has(a.id));
	if (!ability) throw new Error(`sem habilidade no corpus para ${entry.creatureId} ${entry.ability}`);
	used.add(ability.id);
	if (!fs.existsSync(path.join(srcDir, entry.icon))) throw new Error(`arquivo ausente: ${entry.icon}`);
	icons[ability.id] = `systems/ordem_v2_classic/assets/ability-icons/${entry.icon}`;
}

const ordered = Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b)));
const json = `${JSON.stringify({ count: Object.keys(ordered).length, icons: ordered }, null, "\t")}\n`;
if (check) {
	if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== json) { console.error("threat-ability-icons.json desatualizado"); process.exit(1); }
	for (const p of Object.values(ordered)) if (!fs.existsSync(path.join(root, p.replace("systems/ordem_v2_classic/", "")))) { console.error(`ausente: ${p}`); process.exit(1); }
	console.log("ok");
} else {
	fs.mkdirSync(destDir, { recursive: true });
	for (const entry of map.items) if (entry.status === "generated") fs.copyFileSync(path.join(srcDir, entry.icon), path.join(destDir, entry.icon));
	fs.writeFileSync(outFile, json);
	console.log(`${Object.keys(ordered).length} ícones ligados`);
}
