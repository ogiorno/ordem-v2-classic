// Migra um mundo do Foundry do id antigo do sistema (ordem_v2_classic) para o novo (ordem-v2-classic).
// Troca o id dentro de todos os bancos do mundo (data/*) e dos compêndios do mundo (packs/*), em world.json e nos .json soltos.
// O id vale como escopo das flags, prefixo das configurações, caminho de imagens e link de compêndio, então a troca é textual.
//
// Uso:   node scripts/migrar-mundo-id.mjs "<pasta do mundo>"            (simulação: só conta, não grava)
//        node scripts/migrar-mundo-id.mjs "<pasta do mundo>" --gravar   (grava; exige o servidor SEM este mundo ativo)
// Faça uma cópia da pasta do mundo antes. O script não apaga nada: reescreve os valores no lugar.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const OLD = "ordem_v2_classic";
const NEW = "ordem-v2-classic";
const args = process.argv.slice(2);
const WRITE = args.includes("--gravar");
const worldDir = args.find((a) => !a.startsWith("--"));
if (!worldDir) {
	console.error('uso: node scripts/migrar-mundo-id.mjs "<pasta do mundo>" [--gravar]');
	process.exit(1);
}
const world = path.resolve(worldDir);
const worldJsonPath = path.join(world, "world.json");
if (!fs.existsSync(worldJsonPath)) {
	console.error(`world.json não encontrado em ${world}`);
	process.exit(1);
}

const require = createRequire(import.meta.url);
const { ClassicLevel } = require("classic-level");

const worldJson = JSON.parse(fs.readFileSync(worldJsonPath, "utf8"));
if (worldJson.system !== OLD && worldJson.system !== NEW) {
	console.error(`Este mundo usa o sistema "${worldJson.system}", não ${OLD}. Nada a fazer.`);
	process.exit(1);
}

// Recusa gravar com o mundo ativo no servidor (o banco estaria aberto e a gravação seria perdida ou corromperia).
if (WRITE) {
	try {
		const res = await fetch("http://localhost:30000/api/status", { signal: AbortSignal.timeout(2000) });
		const status = await res.json();
		if (status.active && status.world === worldJson.id) {
			console.error(`O mundo "${status.world}" está ativo no servidor. Volte à tela de configuração (ou pare o servidor) e rode de novo.`);
			process.exit(2);
		}
	} catch { /* servidor desligado: tudo certo */ }
}

const count = (text) => text.split(OLD).length - 1;
const dbDirs = [];
for (const group of ["data", "packs"]) {
	const base = path.join(world, group);
	if (!fs.existsSync(base)) continue;
	for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
		const dir = path.join(base, entry.name);
		if (entry.isDirectory() && fs.existsSync(path.join(dir, "CURRENT"))) dbDirs.push(dir);
	}
}

let totalChanged = 0;
let totalOcc = 0;
const summary = [];
for (const dir of dbDirs) {
	const db = new ClassicLevel(dir, { keyEncoding: "utf8", valueEncoding: "utf8" });
	await db.open();
	let entries = 0;
	let changed = 0;
	let occ = 0;
	const batch = [];
	for await (const [key, value] of db.iterator()) {
		entries++;
		if (key.includes(OLD)) throw new Error(`chave com o id antigo em ${dir}: ${key}`);
		const n = count(value);
		if (!n) continue;
		changed++;
		occ += n;
		const next = value.replaceAll(OLD, NEW);
		JSON.parse(next); // continua sendo JSON válido
		if (WRITE) batch.push({ type: "put", key, value: next });
	}
	if (WRITE && batch.length) await db.batch(batch);
	// conferência: depois de gravar, nada do id antigo e a mesma quantidade de entradas
	let after = null;
	if (WRITE) {
		let leftover = 0;
		let entriesAfter = 0;
		for await (const [, value] of db.iterator()) { entriesAfter++; leftover += count(value); }
		if (leftover || entriesAfter !== entries) throw new Error(`conferência falhou em ${dir}: sobraram ${leftover}, entradas ${entries} -> ${entriesAfter}`);
		after = { leftover, entriesAfter };
	}
	await db.close();
	totalChanged += changed;
	totalOcc += occ;
	summary.push(`${path.relative(world, dir).padEnd(34)} ${String(entries).padStart(6)} entradas  ${String(changed).padStart(6)} alteradas  ${String(occ).padStart(6)} ocorrências${after ? "  (conferido)" : ""}`);
}

// world.json e .json soltos (fora dos bancos)
const looseJson = [];
const walk = (dir) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) { if (!dbDirs.includes(p)) walk(p); }
		else if (e.name.endsWith(".json")) looseJson.push(p);
	}
};
walk(world);
let looseFiles = 0;
let looseOcc = 0;
for (const file of looseJson) {
	const text = fs.readFileSync(file, "utf8");
	const n = count(text);
	if (!n) continue;
	looseFiles++;
	looseOcc += n;
	if (WRITE) {
		const next = text.replaceAll(OLD, NEW);
		JSON.parse(next);
		fs.writeFileSync(file, next);
	}
}

console.log(`Mundo: ${worldJson.title} (${worldJson.id}), sistema atual no world.json: ${worldJson.system}`);
console.log(summary.join("\n"));
console.log(`\nBancos: ${totalChanged} entradas com o id antigo, ${totalOcc} ocorrências.`);
console.log(`Arquivos .json soltos (incl. world.json): ${looseFiles} arquivos, ${looseOcc} ocorrências.`);
console.log(WRITE ? "\nGRAVADO. Inicie o mundo pelo Foundry com o sistema novo instalado (ordem-v2-classic)." : "\nSIMULAÇÃO: nada foi gravado. Rode com --gravar para aplicar.");
