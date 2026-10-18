import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { descriptionKey, nameKey, planConfigApplication, summarizePlan } from "../../module/helpers/threat-ability-config-match.mjs";

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const configs = read("../../fixtures/threat-ability-configs-v1-3.json").abilities;
const corpus = read("../../fixtures/threat-abilities-v1-3.json");
const extra = read("../../fixtures/threat-abilities-extra.json");
const corpusById = new Map([...corpus.creatures, ...extra.creatures].flatMap((c) => c.abilities.map((a) => [a.id, a])));
const item = (id, name, description, system = {}) => ({ id, type: "ability", name, system: { description: `<p>${description}</p>`, activation: "standard", ...system } });

test("chave de nome: acento, caixa, marcadores e VD não atrapalham", () => {
	assert.equal(nameKey("•  Afogar Em Sangue"), "afogar em sangue");
	assert.equal(nameKey("Policial de Elite VD 60"), "policial de elite");
	assert.equal(nameKey("Mal Sintonizado"), nameKey("MAL SINTONIZADO"));
	assert.equal(nameKey("Arremessar (Flor Rosa)"), "arremessar flor rosa");
	assert.equal(descriptionKey("<p>Olá&nbsp; <b>mundo</b></p>"), "ola mundo");
});

test("só aplica o que tem configuração, com a descrição igual à da fonte", () => {
	const src = corpusById.get("1318-H02");
	const plan = planConfigApplication({
		actorName: "Dama de Sangue",
		items: [item("a", "Chuva De Ácido (Flor Vermelha)", src.normalizedDescription), item("b", "Arremessar (Flor Rosa)", "texto alterado pelo usuário"), item("c", "Habilidade Inventada", "x")],
		configs, corpusById
	});
	assert.equal(plan.matched, true);
	const by = Object.fromEntries(plan.rows.map((r) => [r.itemId, r]));
	assert.deepEqual([by.a.action, by.a.configId, by.a.state], ["apply", "1318-H02", "automatic"]);
	assert.deepEqual([by.b.action, by.b.reason], ["skip", "description-changed"]);
	assert.deepEqual([by.c.action, by.c.reason], ["skip", "no-config"]);
	assert.deepEqual(summarizePlan(plan), { apply: 1, skipped: 2, reviewActivation: 0 });
});

test("execution existente não é sobrescrita, a menos que se peça; manual não aplica", () => {
	const src = corpusById.get("1318-H02");
	const items = [item("a", "Chuva De Ácido (Flor Vermelha)", src.normalizedDescription, { execution: { mode: "active" } }), item("m", "Agarrão", corpusById.get("1295-H01").normalizedDescription)];
	const keep = planConfigApplication({ actorName: "Dama de Sangue", items, configs, corpusById });
	assert.equal(keep.rows[0].reason, "has-execution");
	assert.equal(planConfigApplication({ actorName: "Dama de Sangue", items, configs, corpusById, overwrite: true }).rows[0].action, "apply");
	const manual = planConfigApplication({ actorName: "Aberração de Carne", items: [items[1]], configs, corpusById });
	assert.deepEqual([manual.rows[0].action, manual.rows[0].reason], ["skip", "manual"]);
});

test("ficha desconhecida não recebe nada; ação vazia pede revisão (Desalento)", () => {
	const unknown = planConfigApplication({ actorName: "Monstro Caseiro", items: [item("a", "Qualquer", "x")], configs, corpusById });
	assert.equal(unknown.matched, false);
	assert.equal(unknown.rows[0].reason, "unknown-creature");
	const mal = corpusById.get("X-desalento-H04");
	const plan = planConfigApplication({ actorName: "Desalento", items: [item("m", "MAL SINTONIZADO", mal.normalizedDescription, { activation: "" })], configs, corpusById });
	assert.deepEqual([plan.rows[0].action, plan.rows[0].reviewActivation], ["apply", true]);
	assert.equal(summarizePlan(plan).reviewActivation, 1);
});

test("cada configuração com execution do fixture casa com o nome da própria criatura e habilidade", () => {
	for (const c of configs.filter((x) => x.execution)) {
		const src = corpusById.get(c.id);
		const plan = planConfigApplication({ actorName: c.creature, items: [item("i", c.name, src.normalizedDescription, { activation: c.activation })], configs, corpusById });
		assert.equal(plan.rows[0].configId, c.id, `${c.id} não casou`);
		assert.equal(plan.rows[0].action, "apply", `${c.id}: ${plan.rows[0].reason}`);
	}
});
