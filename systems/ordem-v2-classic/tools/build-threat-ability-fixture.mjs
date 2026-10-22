// Gera fixtures/threat-abilities-v1-3.json a partir da extração local do Livro v1.3.
// Uso: node tools/build-threat-ability-fixture.mjs [pasta-da-extracao] [--check]
// --check não grava: sai com código 1 se a fonte mudou em relação à fixture.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = resolve(here, "../fixtures/threat-abilities-v1-3.json");
export const DEFAULT_SOURCE = join(
  process.env.LOCALAPPDATA ?? "", "FoundryVTT", "Data", "worlds", "nova-ordem", "ameacas-v1-3"
);

export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const pad = (n) => String(n).padStart(2, "0");

/** Normaliza espaços sem mudar o conteúdo; o texto bruto fica preservado em `description`. */
const normalize = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

export function buildFixture(sourceDir) {
  const manifestRaw = readFileSync(join(sourceDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  const creatures = manifest.threats.map((entry) => {
    const raw = readFileSync(join(sourceDir, entry.json), "utf8");
    const data = JSON.parse(raw);
    const warnings = [...(data.needsReview ?? [])];
    const abilities = (data.abilities ?? []).map((ability, index) => ({
      id: `${data.id}-H${pad(index + 1)}`,
      name: ability.name,
      activation: ability.activation ?? "",
      description: ability.description ?? "",
      normalizedDescription: normalize(ability.description),
      source: ability.source ?? "",
      hash: sha256(`${ability.name}\n${ability.activation ?? ""}\n${ability.description ?? ""}`)
    }));
    const attacks = (data.attacks ?? []).map((attack, index) => ({
      id: `${data.id}-A${pad(index + 1)}`,
      name: attack.name,
      sourceLine: attack.sourceLine ?? ""
    }));
    if (!abilities.length) warnings.push("sem-ability-separada: conferir passivas na ficha original");
    return {
      id: String(data.id),
      slug: data.slug,
      name: data.name,
      bookPage: data.bookPage ?? entry.bookPage ?? null,
      sourceFile: entry.json,
      sourceHash: sha256(raw),
      warnings,
      attacks,
      abilities
    };
  });
  const body = {
    book: manifest.book,
    totals: {
      creatures: creatures.length,
      abilities: creatures.reduce((n, c) => n + c.abilities.length, 0),
      attacks: creatures.reduce((n, c) => n + c.attacks.length, 0)
    },
    manifestHash: sha256(manifestRaw),
    creatures
  };
  return { ...body, corpusHash: sha256(JSON.stringify(creatures)) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const sourceDir = args.find((a) => !a.startsWith("--")) ?? DEFAULT_SOURCE;
  const fixture = buildFixture(sourceDir);
  const text = `${JSON.stringify(fixture, null, 2)}\n`;
  if (check) {
    const current = readFileSync(FIXTURE_PATH, "utf8");
    if (current !== text) {
      console.error("Fonte mudou em relação à fixture. Rode sem --check e revise o diff.");
      process.exit(1);
    }
    console.log("Fixture em dia com a fonte.");
  } else {
    writeFileSync(FIXTURE_PATH, text);
    console.log(`Fixture gravada: ${fixture.totals.creatures} criaturas, ${fixture.totals.abilities} habilidades, ${fixture.totals.attacks} ataques.`);
  }
}
