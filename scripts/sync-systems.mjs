// Espelha systems/<id> do workspace para Data/systems/<id> do Foundry (sem packs compilados).
// Uso: `npm run sync` (uma vez) ou importado por dev.mjs (a cada mudança).
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "systems");
const dataRoot = path.join(process.env.LOCALAPPDATA ?? "", "FoundryVTT", "Data", "systems");

/** Caminhos (relativos ao sistema) que nunca vão para o Data: packs compilados e testes unitários de Node. */
const SKIP = [/^packs[\\/](?!_source)/, /^packs[\\/]_source/, /^tests[\\/]unit([\\/]|$)/, /(^|[\\/])node_modules([\\/]|$)/];
const skip = (rel) => SKIP.some((re) => re.test(rel));

/** Copia um arquivo se for novo/diferente. @returns {boolean} true se copiou */
export function syncFile(systemId, rel) {
	if (skip(rel)) return false;
	const from = path.join(srcRoot, systemId, rel);
	const to = path.join(dataRoot, systemId, rel);
	if (!existsSync(from) || !statSync(from).isFile()) return false;
	if (existsSync(to)) {
		const a = statSync(from);
		const b = statSync(to);
		if (a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 1) return false;
	}
	mkdirSync(path.dirname(to), { recursive: true });
	copyFileSync(from, to);
	return true;
}

/** Sincroniza todos os sistemas. @returns {string[]} arquivos copiados (relativos) */
export function syncAll() {
	const copied = [];
	if (!existsSync(srcRoot)) return copied;
	for (const sys of readdirSync(srcRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
		const walk = (dir) => {
			for (const entry of readdirSync(path.join(srcRoot, sys.name, dir), { withFileTypes: true })) {
				const rel = path.join(dir, entry.name);
				if (skip(rel)) continue;
				if (entry.isDirectory()) walk(rel);
				else if (syncFile(sys.name, rel)) copied.push(`${sys.name}/${rel}`);
			}
		};
		walk("");
	}
	return copied;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const copied = syncAll();
	console.log(copied.length ? copied.map((f) => `sync: ${f}`).join("\n") : "sync: nada a copiar");
}
