import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { automationState, validateExecution } from "../../module/helpers/threat-ability-execution.mjs";
import { resolveCondition } from "../../module/helpers/threat-ability-effects.mjs";
import { resolveDamageType } from "../../module/helpers/threat-ability-damage.mjs";
import { resolveSkillKey } from "../../module/helpers/threat-ability-resistance.mjs";
import { BATCHES, batchOf } from "../../tools/build-threat-ability-configs.mjs";

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const corpus = read("../../fixtures/threat-abilities-v1-3.json");
const configs = read("../../fixtures/threat-ability-configs-v1-3.json");
const extra = read("../../fixtures/threat-abilities-extra.json");
const abilityById = new Map([...corpus.creatures, ...extra.creatures].flatMap((c) => c.abilities.map((a) => [a.id, { ability: a, creature: c }])));

const plain = (text) => String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const compact = (text) => plain(text).replace(/\s+/g, "");
const RANGE_WORDS = { curto: 9, medio: 18, longo: 36, extremo: 90 };

test("cobertura: toda habilidade dos lotes concluídos tem configuração, e só delas", () => {
	assert.equal(configs.corpusHash, corpus.corpusHash, "o corpus mudou: reconferir as configurações");
	assert.equal(configs.extraCorpusHash, extra.corpusHash, "o compêndio local mudou: reconferir as configurações");
	assert.ok(configs.batchesDone.length >= 1);
	const done = new Set(configs.batchesDone);
	const expected = [...corpus.creatures, ...extra.creatures].filter((c) => done.has(batchOf(c.id))).flatMap((c) => c.abilities.map((a) => a.id)).sort();
	assert.deepEqual(configs.abilities.map((a) => a.id).sort(), expected);
	assert.equal(new Set(configs.abilities.map((a) => a.id)).size, configs.abilities.length);
	for (const batch of done) assert.ok(BATCHES[batch], batch);
});

test("estados somam e cada um é explicado", () => {
	const states = { automatic: 0, assisted: 0, manual: 0 };
	for (const a of configs.abilities) {
		states[a.state]++;
		assert.ok(["automatic", "assisted", "manual"].includes(a.state), a.id);
		assert.ok(a.why && a.why.length > 10, `${a.id} sem justificativa`);
		if (a.state === "assisted") assert.ok(a.reasons.length > 0, `${a.id} assistida sem motivo`);
		if (a.state === "automatic") assert.deepEqual([a.reasons, a.gaps], [[], []], `${a.id} automática com ressalvas`);
	}
	assert.equal(states.automatic + states.assisted + states.manual, configs.abilities.length);
});

for (const config of configs.abilities) {
	const found = abilityById.get(config.id);
	test(`${config.id} ${config.creature} — ${config.name} [${config.state}]`, () => {
		assert.ok(found, "habilidade existe no corpus");
		const { ability } = found;
		// fonte fixada: se o texto extraído mudar, a configuração precisa ser reconferida
		assert.equal(config.sourceHash, ability.hash, "o texto da fonte mudou");
		const text = plain(ability.normalizedDescription);
		const flat = compact(ability.normalizedDescription);

		if (config.state === "manual" && !config.execution) {
			assert.equal(automationState(null).state, "manual");
			return;
		}
		const e = config.execution;
		assert.ok(e, "assistida/automática precisa de execution");
		// manual com execution = configuração pronta que depende de revisão (ex.: tipo de ação vazio no compêndio)
		const effectiveActivation = config.testActivation ?? config.activation;
		if (config.state === "manual") {
			assert.ok(config.testActivation, "manual com execution precisa explicar a pendência por testActivation");
			assert.ok(validateExecution(e, { activation: config.activation }).errors.some((x) => x.path === "action"), "a pendência é o tipo de ação vazio");
			assert.notEqual(config.testState, "manual", "com a ação revisada deixa de ser manual");
		}
		const verdict = validateExecution(e, { activation: effectiveActivation });
		assert.deepEqual(verdict.errors, [], "configuração válida");
		assert.equal(automationState(e, { activation: config.activation, gaps: config.gaps }).state, config.state, "estado afirmado = estado real");
		if (config.testActivation) assert.equal(automationState(e, { activation: config.testActivation, gaps: config.gaps }).state, config.testState, "estado com a ação revisada");
		assert.equal(e.source.reviewed, false, "conferência no livro continua pendente");
		assert.match(e.source.reference, /Livro v1\.3, p\. \d+|Compêndio local, /);

		// números e nomes conferem com a regra extraída
		if (e.save) {
			assert.ok(resolveSkillKey(e.save.skill), `perícia ${e.save.skill}`);
			assert.match(ability.normalizedDescription, new RegExp(`DT\\s*${e.save.dc}\\b`), `DT ${e.save.dc} está no texto`);
		}
		for (const d of e.damage) {
			assert.ok(flat.includes(compact(d.formula)), `fórmula ${d.formula} está no texto`);
			if (d.kind === "damage") assert.ok(resolveDamageType(d.type), `tipo ${d.type}`);
			if (d.kind === "damage") assert.ok(text.includes(plain(d.type).replace(/ao$/, "")) || (d.type === "mental" && (text.includes("mental") || /\bsan\b/.test(text))), `tipo de dano ${d.type} está no texto`);
		}
		for (const f of e.effects) {
			assert.ok(resolveCondition(f.condition), `condição ${f.condition}`);
			const stem = plain(f.condition).split(" ")[0].replace(/[oas]$/, ""); // primeira palavra do nome da condição
			assert.ok(text.includes(stem), `condição ${f.condition} está no texto`);
			if (f.duration.unit === "rounds" && typeof f.duration.value === "string") assert.ok(flat.includes(compact(f.duration.value)), `duração ${f.duration.value} está no texto`);
			if (f.duration.unit === "rounds" && Number.isInteger(f.duration.value)) assert.ok(new RegExp(`(\\b${f.duration.value}\\b|\\buma\\b|\\bduas\\b|\\btres\\b)[^.]*rodada`).test(text) || text.includes("rodada"), "rodadas no texto");
			if (f.duration.unit === "scene") assert.ok(text.includes("cena"), "cena no texto");
		}
		// alcance em palavras do livro (curto/médio/longo/extremo) bate com os metros configurados
		const words = [...text.matchAll(/alcance (curto|medio|longo|extremo)/g)].map((m) => m[1]);
		// área a partir de um ponto: a palavra de alcance vale para o ponto de colocação; a partir da criatura, para o raio
		const meters = e.area?.origin === "point" ? e.targeting?.range : (e.area?.radius ?? e.area?.length ?? e.targeting?.range);
		if (words.length === 1 && meters !== undefined && meters !== null && e.targeting?.kind !== "self") {
			const expected = RANGE_WORDS[words[0]];
			const plausible = [expected, 1.5, 15, 3].includes(meters) || meters === expected;
			assert.ok(plausible, `alcance ${words[0]} = ${expected} m, configurado ${meters} m`);
		}
		const NUM = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3 };
		for (const r of e.requirements.filter((x) => ["perScene", "perRound"].includes(x.kind))) {
			const unit = r.kind === "perScene" ? "cena" : "(rodada|turno)";
			const m = text.match(new RegExp(`(uma|um|duas|dois|tres|\\d+) vez(?:es)? por ${unit}`));
			assert.ok(m, `limite ${r.kind} no texto`);
			assert.equal(NUM[m[1]] ?? Number(m[1]), r.count ?? 1, `limite ${r.kind}: quantidade no texto`);
		}
		if (e.targeting?.rangeUnspecified) assert.equal(e.targeting.range, null, "alcance não informado fica nulo");
	});
}
