// Gera fixtures/threat-ability-configs-v1-3.json a partir dos lotes escritos à mão em tools/threat-ability-config-data/.
// Uso: node tools/build-threat-ability-configs.mjs [--check]
// Falha se o estado afirmado de uma habilidade não bater com automationState() ou se a configuração for inválida.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { automationState, normalizeExecution, validateExecution } from "../module/helpers/threat-ability-execution.mjs";
import { activationKey } from "../module/helpers/threat-ability-flow.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = resolve(here, "../fixtures/threat-ability-configs-v1-3.json");
const CORPUS_PATH = resolve(here, "../fixtures/threat-abilities-v1-3.json");
const EXTRA_PATH = resolve(here, "../fixtures/threat-abilities-extra.json");

/** Faixas de ficha de cada lote de conteúdo (README das tarefas). */
export const BATCHES = Object.freeze({
	C01: [1295, 1358], C02: [1363, 1413], C03: [1418, 1466], C04: [1479, 1522],
	C05: [1526, 1575], C06: [1581, 1608], C07: [1609, 1619], C08: [1620, 1622],
	X01: ["X-desalento", "X-desalento"] // Desalento (compêndio local), caso adicional da spec
});

export const batchOf = (creatureId) => (String(creatureId).startsWith("X-")
	? Object.entries(BATCHES).find(([, [from]]) => from === creatureId)?.[0] ?? null
	: Object.entries(BATCHES).find(([, [from, to]]) => typeof from === "number" && Number(creatureId) >= from && Number(creatureId) <= to)?.[0] ?? null);

export async function buildConfigs() {
	const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
	const extra = JSON.parse(readFileSync(EXTRA_PATH, "utf8"));
	const byId = new Map([...corpus.creatures, ...extra.creatures].flatMap((c) => c.abilities.map((a) => [a.id, { ability: a, creature: c }])));
	const abilities = [];
	const done = [];
	for (const batch of Object.keys(BATCHES)) {
		const file = resolve(here, `threat-ability-config-data/${batch.toLowerCase()}.mjs`);
		if (!existsSync(file)) continue;
		const entries = (await import(pathToFileURL(file).href)).default;
		done.push(batch);
		for (const entry of entries) {
			const found = byId.get(entry.id);
			if (!found) throw new Error(`${batch}: id inexistente no corpus: ${entry.id}`);
			if (batchOf(found.creature.id) !== batch) throw new Error(`${entry.id} não pertence ao lote ${batch}`);
			const activation = activationKey(found.ability.activation);
			let execution = null;
			if (entry.execution) {
				execution = normalizeExecution({
					...entry.execution,
					version: 1,
					source: { reference: found.creature.bookPage ? `Livro v1.3, p. ${found.creature.bookPage}, ${found.creature.name}` : `Compêndio local, ${found.creature.name}`, reviewed: false }
				});
			}
			const computed = automationState(execution, { activation, gaps: entry.gaps });
			// ativação de teste: a revisão do tipo de ação pendente no compêndio é simulada só nos testes, nunca gravada na ficha
			const testActivation = entry.testActivation ?? null;
			const testState = testActivation ? automationState(execution, { activation: testActivation, gaps: entry.gaps }).state : null;
			if (computed.state !== entry.state) throw new Error(`${entry.id} ${found.ability.name}: afirma ${entry.state}, mas o estado real é ${computed.state} (${computed.reasons.join("; ")})`);
			if (execution) {
				const finalState = testState ?? computed.state;
				execution.automation = finalState === "automatic" ? "automatic" : "assisted";
				const verdict = validateExecution(execution, { activation: testActivation ?? activation });
				if (!verdict.valid) throw new Error(`${entry.id}: configuração inválida: ${verdict.errors.map((e) => e.path).join(", ")}`);
			}
			abilities.push({
				id: entry.id, creatureId: found.creature.id, creature: found.creature.name, name: found.ability.name,
				activation, testActivation, testState, sourceHash: found.ability.hash, batch, state: entry.state, reasons: computed.reasons,
				gaps: entry.gaps, notes: entry.notes, why: entry.why, execution
			});
		}
	}
	const seen = new Set();
	for (const a of abilities) { if (seen.has(a.id)) throw new Error(`configuração repetida: ${a.id}`); seen.add(a.id); }
	abilities.sort((a, b) => a.id.localeCompare(b.id));
	return { corpusHash: corpus.corpusHash, extraCorpusHash: extra.corpusHash, batchesDone: done, abilities };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const data = await buildConfigs();
	const text = `${JSON.stringify(data, null, 2)}\n`;
	if (process.argv.includes("--check")) {
		if (readFileSync(CONFIG_PATH, "utf8") !== text) { console.error("Configurações desatualizadas: rode sem --check."); process.exit(1); }
		console.log("Configurações em dia.");
	} else {
		writeFileSync(CONFIG_PATH, text);
		const by = (s) => data.abilities.filter((a) => a.state === s).length;
		console.log(`Gravado: ${data.abilities.length} habilidades (${by("automatic")} automáticas, ${by("assisted")} assistidas, ${by("manual")} manuais) nos lotes ${data.batchesDone.join(", ")}.`);
	}
}
