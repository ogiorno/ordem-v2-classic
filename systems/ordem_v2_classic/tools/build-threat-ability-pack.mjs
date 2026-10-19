import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Gera a fonte do pacote de Item `threatAbilities` (packs/_source/threatAbilities): uma pasta por criatura, uma habilidade por arquivo,
// com descrição do livro, tipo de ação, ícone e o bloco `execution` revisado (null quando a habilidade é manual).
// Determinístico: ids derivados do id da habilidade. Uso: node tools/build-threat-ability-pack.mjs [--check]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), "utf8"));
const outDir = path.join(root, "packs", "_source", "threatAbilities");

const corpus = readJson("fixtures", "threat-abilities-v1-3.json");
const extra = readJson("fixtures", "threat-abilities-extra.json");
const configs = new Map(readJson("fixtures", "threat-ability-configs-v1-3.json").abilities.map((c) => [c.id, c]));
const icons = readJson("fixtures", "threat-ability-icons.json").icons;

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const makeId = (seed) => { const h = crypto.createHash("sha256").update(seed).digest(); return Array.from({ length: 16 }, (_, i) => ALPHABET[h[i] % ALPHABET.length]).join(""); };
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const stats = { coreVersion: "14.369", systemId: "ordem_v2_classic", systemVersion: "8.0.2", createdTime: 1792207618168, modifiedTime: 1792207618168, lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null };
const DEFAULT_IMG = "icons/svg/item-bag.svg";

const files = new Map();
let sortFolder = 100000;
for (const creature of [...corpus.creatures, ...extra.creatures]) {
	if (!creature.abilities.length) continue;
	const dir = `${slug(creature.name)}-${creature.id}`.replace(/^x-/, "");
	const folderId = makeId(`folder:${creature.id}`);
	files.set(`${dir}/_folder.json`, {
		type: "Item", folder: null, name: creature.name.replace(/\s+VD\s*\d+$/i, ""), color: null, sorting: "a", _id: folderId, description: "", sort: sortFolder, flags: {},
		_stats: stats, _key: `!folders!${folderId}`
	});
	sortFolder += 100000;
	let sort = 1000;
	for (const ability of creature.abilities) {
		const config = configs.get(ability.id);
		const id = makeId(`ability:${ability.id}`);
		const execution = config?.execution ? JSON.parse(JSON.stringify(config.execution)) : null;
		files.set(`${dir}/${slug(ability.name)}-${ability.id.toLowerCase()}.json`, {
			name: ability.name,
			type: "ability",
			img: icons[ability.id] ?? DEFAULT_IMG,
			system: {
				id: 0, abilityType: "ability", preRequisite: "", description: `<p>${esc(ability.normalizedDescription ?? ability.description)}</p>`, chatDescription: "",
				activation: config?.activation ?? ability.activation ?? "", cost: 0, costType: "PE", execution
			},
			effects: [], flags: { ordem_v2_classic: { threatAbilityId: ability.id } }, _stats: stats, ownership: { default: 0 }, folder: folderId, sort, _id: id, _key: `!items!${id}`
		});
		sort += 1000;
	}
}

const render = (obj) => `${JSON.stringify(obj, null, "\t")}\n`;
if (check) {
	const expected = new Set([...files.keys()]);
	const present = fs.existsSync(outDir) ? fs.readdirSync(outDir, { recursive: true }).filter((f) => f.endsWith(".json")).map((f) => f.replaceAll("\\", "/")) : [];
	const bad = [...expected].filter((f) => !present.includes(f) || fs.readFileSync(path.join(outDir, f), "utf8") !== render(files.get(f))).concat(present.filter((f) => !expected.has(f)));
	if (bad.length) { console.error(`pacote threatAbilities desatualizado: ${bad.slice(0, 5).join(", ")}`); process.exit(1); }
	console.log("ok");
} else {
	fs.rmSync(outDir, { recursive: true, force: true });
	for (const [rel, obj] of files) { const p = path.join(outDir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, render(obj)); }
	console.log(`${[...files.keys()].filter((f) => !f.endsWith("_folder.json")).length} habilidades em ${[...files.keys()].filter((f) => f.endsWith("_folder.json")).length} pastas`);
}
