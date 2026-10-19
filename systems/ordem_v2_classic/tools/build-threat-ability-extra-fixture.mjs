// Gera fixtures/threat-abilities-extra.json: habilidades de ameaças do compêndio local fora das 66 fichas do Livro v1.3
// (hoje: Desalento, o primeiro caso integrado da spec). Fonte: packs/_source/threats/desalento.json.
// Uso: node tools/build-threat-ability-extra-fixture.mjs [--check]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const EXTRA_PATH = resolve(here, "../fixtures/threat-abilities-extra.json");
const PACKS = [{ id: "X-desalento", slug: "desalento", file: resolve(here, "../packs/_source/threats/desalento.json") }];

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const plainText = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function buildExtraFixture() {
	const creatures = PACKS.map((pack) => {
		const raw = readFileSync(pack.file, "utf8");
		const actor = JSON.parse(raw);
		const abilities = actor.items.filter((i) => i.type === "ability").map((item, index) => {
			const description = plainText(item.system?.description);
			return {
				id: `${pack.id}-H${String(index + 1).padStart(2, "0")}`,
				name: item.name,
				activation: item.system?.activation ?? "",
				description,
				normalizedDescription: description,
				source: `${pack.slug}.json#${item._id}`,
				hash: sha256(`${item.name}\n${item.system?.activation ?? ""}\n${description}`)
			};
		});
		return {
			id: pack.id, slug: pack.slug, name: actor.name, bookPage: null,
			sourceFile: `packs/_source/threats/${pack.slug}.json`, sourceHash: sha256(raw), warnings: ["conteúdo do compêndio local, não do Livro v1.3"],
			attacks: actor.items.filter((i) => i.type === "armament").map((i, n) => ({ id: `${pack.id}-A${String(n + 1).padStart(2, "0")}`, name: i.name, sourceLine: "" })),
			abilities
		};
	});
	return { book: "Compêndio local (fora do Livro v1.3)", creatures, corpusHash: sha256(JSON.stringify(creatures)) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const text = `${JSON.stringify(buildExtraFixture(), null, 2)}\n`;
	if (process.argv.includes("--check")) {
		if (readFileSync(EXTRA_PATH, "utf8") !== text) { console.error("Compêndio mudou em relação à fixture extra: rode sem --check."); process.exit(1); }
		console.log("Fixture extra em dia.");
	} else {
		writeFileSync(EXTRA_PATH, text);
		console.log("Fixture extra gravada.");
	}
}
