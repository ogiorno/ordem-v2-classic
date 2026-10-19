// Gera a fonte do pacote `rituals` do sistema (packs/_source/rituals/**) a partir de:
//   - origem-compendio-mundo.json: os 98 rituais do compêndio `world.biblioteca-de-rituais`, como estavam em 20/10/2026;
//   - correcoes-sistema.json: o `system` já corrigido dos 41 rituais com erro de extração do PDF
//     (revisão: docs/correcoes-rituais-compendio.md; auditoria: docs/auditoria-rituais-vs-livro.md).
// Uso (a partir de foundry-dev): node tools/rituais/gerar-fonte-rituais.mjs
// Idempotente: apaga e recria packs/_source/rituals. Não toca no mundo, no compêndio de origem nem no system.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(root, "systems/ordem_v2_classic/packs/_source/rituals");
const origem = JSON.parse(fs.readFileSync(path.join(here, "origem-compendio-mundo.json"), "utf8"));
const correcoes = JSON.parse(fs.readFileSync(path.join(here, "correcoes-sistema.json"), "utf8"));

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const NOW = 1792207618168; // data fixa: a fonte gerada não muda a cada execução

// Pasta por círculo (ids fixos de 16 caracteres, para o pacote compilado manter os mesmos ids a cada geração).
const FOLDER_IDS = { 1: "RituaisCirculo01", 2: "RituaisCirculo02", 3: "RituaisCirculo03", 4: "RituaisCirculo04" };
const stats = (id) => ({
	coreVersion: "14.369",
	systemId: "ordem_v2_classic",
	systemVersion: "8.0.2",
	createdTime: NOW,
	modifiedTime: NOW,
	lastModifiedBy: null,
	compendiumSource: null,
	duplicateSource: null,
	exportSource: null,
});

fs.rmSync(out, { recursive: true, force: true });
for (const circle of [1, 2, 3, 4]) {
	const dir = path.join(out, `${circle}o-circulo`);
	fs.mkdirSync(dir, { recursive: true });
	const folder = {
		type: "Item",
		folder: null,
		name: `${circle}º Círculo`,
		color: null,
		sorting: "a",
		_id: FOLDER_IDS[circle],
		description: "",
		sort: circle * 100000,
		flags: {},
		_stats: stats(),
		_key: `!folders!${FOLDER_IDS[circle]}`,
	};
	fs.writeFileSync(path.join(dir, "_folder.json"), JSON.stringify(folder, null, 2) + "\n");
}

let count = 0;
const used = new Set();
for (const item of origem) {
	const circle = item.system.circle;
	const system = correcoes[item.name] ?? item.system;
	let file = slug(item.name);
	if (used.has(file)) file += `-${slug(item.system.element)}`;
	used.add(file);
	const doc = {
		name: item.name,
		type: "ritual",
		img: item.img,
		system,
		effects: item.effects ?? [],
		flags: {},
		_stats: stats(),
		ownership: { default: 0 },
		folder: FOLDER_IDS[circle],
		sort: (count + 1) * 1000,
		_id: item._id,
		_key: `!items!${item._id}`,
	};
	fs.writeFileSync(path.join(out, `${circle}o-circulo`, `${file}.json`), JSON.stringify(doc, null, 2) + "\n");
	count++;
}
console.log(`rituals: ${count} rituais em ${path.relative(root, out)} (${Object.keys(correcoes).length} com correção)`);
