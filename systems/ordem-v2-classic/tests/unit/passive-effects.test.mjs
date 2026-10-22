// Rodar: npm test. Poderes passivos que dão o bônus só de entrarem na ficha (module/helpers/passive-effects-rules.mjs).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	ATTACK_ELSEWHERE, ATTACK_POWERS, MANAGED_FLAG, MANUAL_PASSIVES, MANUAL_REASONS, PACK_EFFECTS, PASSIVE_RULES, SKILL_KEYS,
	SKILL_NAMES, changeData, passiveEffectData, passiveKey, passiveRuleFor, trainingMap, validChoice,
} from "../../module/helpers/passive-effects-rules.mjs";
import { POWER_EFFECTS, powerEffectFor } from "../../module/helpers/attack-power-effects.mjs";
import { resolveDamage } from "../../module/helpers/threat-calc.mjs";
import { TRAINING_GRANTS } from "../../module/helpers/skill-training-rules.mjs";

const SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../packs/_source");

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(p, out);
		else if (entry.name.endsWith(".json")) out.push(p);
	}
	return out;
}

/** Todos os poderes passivos dos agentes (as habilidades de ameaça têm outro fluxo). */
const passives = walk(SOURCE)
	.filter((file) => !file.includes("threatAbilities"))
	.map((file) => ({ file, doc: JSON.parse(fs.readFileSync(file, "utf8")) }))
	.filter(({ doc }) => doc.type === "ability" && doc.system?.activation === "passive");

// --- avaliação das fórmulas como a ficha faz (Roll.replaceFormulaData + safeEval) ---
const lookup = (data, dotted) => dotted.split(".").reduce((o, k) => o?.[k], data);
function evaluate(value, data) {
	if (typeof value === "number") return value;
	const replaced = String(value).replace(/@([\w.]+)/g, (_m, p) => String(lookup(data, p) ?? 0)).replace(/\bfloor\(/g, "Math.floor(");
	assert.match(replaced, /^[\d\s+\-*/().<>=?:]*(Math\.floor\([\d\s+\-*/().]*\)[\d\s+\-*/().<>=?:]*)*$/, `fórmula insegura: ${replaced}`);
	return Function(`"use strict"; return (${replaced});`)();
}

/** Ator de teste: nível (5% de NEX por nível), estágio, atributos e perícias treinadas. */
function agente({ nivel = 1, stage = 1, int = 1, str = 1, trained = [] } = {}) {
	const skills = Object.fromEntries(SKILL_KEYS.map((k) => [k, { degree: { label: trained.includes(k) ? "trained" : "untrained" } }]));
	return { nivel: { value: nivel }, stage: { value: stage }, attributes: { int: { value: int }, str: { value: str } }, treino: trainingMap(skills) };
}

/** Soma o que os poderes da ficha dão em cada chave (como o efeito `add` faz). */
function totais(items, actor) {
	const totals = {};
	for (const name of items) {
		const rule = passiveRuleFor(name);
		for (const change of rule?.changes ?? []) totals[change.key] = (totals[change.key] ?? 0) + evaluate(change.value, actor);
	}
	return totals;
}

const SK = (k) => `system.skills.${k}.mod`;
const saves = (n) => ({ [SK("resilience")]: n, [SK("reflexes")]: n, [SK("will")]: n });

describe("todo poder passivo do compêndio está classificado, uma vez só", () => {
	const groups = {
		regra: Object.keys(PASSIVE_RULES),
		compendio: [...PACK_EFFECTS],
		ataque: [...ATTACK_POWERS],
		manual: Object.keys(MANUAL_PASSIVES),
		treinamento: Object.keys(TRAINING_GRANTS),
	};
	it("cada nome de poder passivo cai em exatamente uma classificação", () => {
		const names = new Set(passives.map(({ doc }) => passiveKey(doc.name)));
		for (const name of names) {
			// um poder pode ter regra de ficha e concessão de treinamento ao mesmo tempo (Atlético: deslocamento e Atletismo)
			const hits = Object.entries(groups).filter(([, list]) => list.includes(name)).map(([g]) => g);
			const unicos = hits.filter((g) => !(g === "treinamento" && hits.length === 2 && hits.includes("regra")));
			assert.equal(unicos.length, 1, `${name}: ${hits.length ? hits.join(" e ") : "não classificado"}`);
		}
		assert.ok(names.size >= 140, `só ${names.size} nomes de poderes passivos`);
	});
	it("nenhuma classificação aponta para poder que não existe como passivo", () => {
		const names = new Set(passives.map(({ doc }) => passiveKey(doc.name)));
		// as concessões de treinamento também cobrem poderes que não são passivos (Ás do Volante, Perito…)
		for (const [group, list] of Object.entries(groups)) if (group !== "treinamento") for (const name of list) assert.ok(names.has(name), `${group}: ${name} não é um poder passivo do compêndio`);
	});
	it("todo motivo manual existe e explica o porquê", () => {
		for (const [name, reason] of Object.entries(MANUAL_PASSIVES)) assert.ok(MANUAL_REASONS[reason]?.length > 20, `${name}: motivo "${reason}" sem texto`);
	});
});

describe("o que cada poder dá na ficha (poder a poder)", () => {
	// [nome, ficha de teste, bônus esperado por chave, escrito à mão a partir do texto do livro]
	const CASOS = [
		// o treinamento ("ou +2") deles agora é grau real, tratado em pericias-treinadas.test.mjs; aqui ficam só os outros bônus
		["Atlético", {}, { "system.desloc.value": 3 }],
		["Observador", { int: 3 }, { [SK("intuition")]: 3 }],
		["Personalidade Esotérica", {}, { "system.PE.bonus": 3 }],
		["Reflexos Defensivos", {}, { "system.defense.value": 2, ...saves(2) }],
		["Correria Desesperada", {}, { "system.desloc.value": 3 }],
		["Mochileiro", {}, { "system.spaces.bonus.max": 5 }],
		["Inventário Organizado", { int: 3 }, { "system.spaces.bonus.max": 3 }],
		// +1 PV a cada 5% de NEX (nível 1 = 5%); +1 PE a cada 10% (a cada 2 níveis)
		["Vitalidade Reforçada", { nivel: 1 }, { "system.PV.bonus": 1, [SK("resilience")]: 2 }],
		["Vitalidade Reforçada", { nivel: 10 }, { "system.PV.bonus": 10, [SK("resilience")]: 2 }],
		["Vontade Inabalável", { nivel: 1 }, { "system.PE.bonus": 0, [SK("will")]: 2 }],
		["Vontade Inabalável", { nivel: 2 }, { "system.PE.bonus": 1, [SK("will")]: 2 }],
		["Vontade Inabalável", { nivel: 7 }, { "system.PE.bonus": 3, [SK("will")]: 2 }],
		["Vontade Inabalável", { nivel: 20 }, { "system.PE.bonus": 10, [SK("will")]: 2 }],
		["Calejado", { nivel: 1 }, { "system.PV.bonus": 1 }],
		["Calejado", { nivel: 14 }, { "system.PV.bonus": 14 }],
		["Cicatrizes Psicológicas", { nivel: 1 }, { "system.SAN.bonus": 1 }],
		["Cicatrizes Psicológicas", { nivel: 8 }, { "system.SAN.bonus": 8 }],
		// +1 PE e +1 PE a cada NEX ímpar (15%, 25%…): 5% e 10% dão 1; 15% dá 2; 25% dá 3; 95% dá 10
		["Dedicação", { nivel: 1 }, { "system.PE.bonus": 1, "system.PE.perRoundBonus": 1 }],
		["Dedicação", { nivel: 2 }, { "system.PE.bonus": 1, "system.PE.perRoundBonus": 1 }],
		["Dedicação", { nivel: 3 }, { "system.PE.bonus": 2, "system.PE.perRoundBonus": 1 }],
		["Dedicação", { nivel: 5 }, { "system.PE.bonus": 3, "system.PE.perRoundBonus": 1 }],
		["Dedicação", { nivel: 19 }, { "system.PE.bonus": 10, "system.PE.perRoundBonus": 1 }],
		["Fôlego de Nadador", {}, { "system.PV.bonus": 5 }],
		["Mutação", {}, { "system.genericRd.value": 2 }],
		["Luta ou Fuga", {}, { [SK("will")]: 2 }],
		["Patrulha", {}, { "system.defense.value": 2 }],
		["Espreitar da Besta", {}, { [SK("stealth")]: 5 }],
		["Potencial Aprimorado", { nivel: 6 }, { "system.PE.bonus": 6 }],
		["Precognição", {}, { "system.defense.value": 2, ...saves(2) }],
		// +2 PV por NEX: em NEX 50% (nível 10) são 20 PV, em 55% são 22
		["Sangue de Ferro", { nivel: 10 }, { "system.PV.bonus": 20 }],
		["Sangue de Ferro", { nivel: 11 }, { "system.PV.bonus": 22 }],
		["Sensitivo", {}, { [SK("diplomacy")]: 5, [SK("intimidation")]: 5, [SK("intuition")]: 5 }],
		["Visão do Oculto", {}, { [SK("perception")]: 5 }],
		["NEX 10% - Casca Grossa", { nivel: 4 }, { "system.PV.bonus": 4 }],
		["Estágio 2 - Durão", { stage: 2 }, { "system.PV.bonus": 4 }],
		["Estágio 2 - Durão", { stage: 3 }, { "system.PV.bonus": 6 }],
		["NEX 40% - Gatuno", {}, { [SK("athleticism")]: 5, [SK("crime")]: 5 }],
		["NEX 10% - Iniciativa Aprimorada", {}, { [SK("initiative")]: 5 }],
		// Força 1 + Intelecto 3 = 20 espaços (5 por ponto): +15 sobre os 5 da Força 1
		["NEX 10% - Inventário Otimizado", { int: 3 }, { "system.spaces.bonus.max": 15 }],
		// Força 0 tem 2 espaços de base: com Intelecto 3 a capacidade total é 15 (5 × 3), logo +13
		["NEX 10% - Inventário Otimizado", { int: 3, str: 0 }, { "system.spaces.bonus.max": 13 }],
		["NEX 10% - Inventário Otimizado", { int: 0, str: 0 }, { "system.spaces.bonus.max": 0 }],
		["NEX 10% - Mascate", {}, { "system.spaces.bonus.max": 5 }],
		["NEX 99% - A Força do Saber", { int: 3 }, { "system.attributes.int.value": 1, "system.PE.bonus": 4 }],
	];

	for (const [nome, ficha, esperado] of CASOS) {
		it(`${nome} ${JSON.stringify(ficha)}`, () => {
			assert.deepEqual(totais([nome], agente(ficha)), esperado);
		});
	}

	it("cada poder com regra aparece na tabela acima pelo menos uma vez", () => {
		const cobertos = new Set(CASOS.map(([nome]) => passiveKey(nome)));
		const escolhas = new Set(Object.entries(PASSIVE_RULES).filter(([, r]) => r.choice).map(([k]) => k));
		for (const name of Object.keys(PASSIVE_RULES)) assert.ok(cobertos.has(name) || escolhas.has(name), `${name} sem caso de teste`);
	});
});

describe("poderes de escolha de atributo (Aumento de Atributo)", () => {
	const comEscolha = (nome, escolha, ficha = {}) => {
		const data = passiveEffectData(nome, { existing: [], choice: escolha });
		const totals = {};
		for (const c of data?.system.changes ?? []) totals[c.key] = (totals[c.key] ?? 0) + evaluate(c.value, agente(ficha));
		return totals;
	};
	it("é o único poder de escolha que sobra aqui (as perícias vão pelo livro-caixa de treinamento)", () => {
		const found = Object.entries(PASSIVE_RULES).filter(([, r]) => r.choice).map(([k]) => k);
		assert.deepEqual(found, ["aumento de atributo"]);
		const { prompt, options, build } = PASSIVE_RULES["aumento de atributo"].choice;
		assert.ok(prompt.length > 10 && options.length === 5 && typeof build === "function");
	});
	it("+1 no atributo escolhido, nunca além de 3", () => {
		assert.deepEqual(comEscolha("Aumento de Atributo", "int", { int: 1 }), { "system.attributes.int.value": 1 });
		assert.deepEqual(comEscolha("Aumento de Atributo", "int", { int: 2 }), { "system.attributes.int.value": 1 });
		assert.deepEqual(comEscolha("Aumento de Atributo", "int", { int: 3 }), { "system.attributes.int.value": 0 });
	});
	it("escolha inválida, vazia ou de outro poder é ignorada", () => {
		assert.equal(validChoice("Aumento de Atributo", "int"), true);
		for (const ruim of [null, "", "tactics", "__proto__", 5]) assert.equal(validChoice("Aumento de Atributo", ruim), false, String(ruim));
		assert.equal(passiveEffectData("Aumento de Atributo", { choice: "tactics" }), null);
		assert.equal(validChoice("Calejado", "int"), false);
	});
	it("trocar a escolha troca o atributo do efeito, atualizado no lugar", () => {
		const a = passiveEffectData("Aumento de Atributo", { existing: [], choice: "int" });
		const b = passiveEffectData("Aumento de Atributo", { existing: [{ flags: a.flags, system: a.system }], choice: "pre" });
		assert.deepEqual(b.system.changes.map((c) => c.key), ["system.attributes.pre.value"]);
	});
	it("os nomes das perícias têm texto em português", () => {
		for (const k of SKILL_KEYS) assert.ok(SKILL_NAMES[k]?.length > 2, k);
	});
});

describe("tirar o poder da ficha tira o bônus", () => {
	it("o bônus é a soma dos poderes presentes: sem o poder, volta ao que era", () => {
		const ficha = agente({ nivel: 8, int: 3 });
		const todos = ["Calejado", "Patrulha", "Observador", "Dedicação", "Reflexos Defensivos"];
		const com = totais(todos, ficha);
		for (const sem of todos) {
			const restante = totais(todos.filter((n) => n !== sem), ficha);
			const dado = totais([sem], ficha);
			for (const key of new Set([...Object.keys(com), ...Object.keys(dado)])) {
				assert.equal((restante[key] ?? 0) + (dado[key] ?? 0), com[key] ?? 0, `${sem} / ${key}`);
			}
		}
		assert.deepEqual(totais([], ficha), {});
	});
	it("o efeito é transfer e fica no próprio poder: apagar o poder apaga o efeito (nada fica na ficha)", () => {
		for (const name of Object.keys(PASSIVE_RULES)) {
			const data = passiveEffectData(name, { existing: [], choice: PASSIVE_RULES[name].choice?.options[0].value });
			assert.ok(data, name);
			assert.equal(data.transfer, true, name);
			assert.equal(data.disabled, false, name);
			assert.equal(data.flags["ordem-v2-classic"][MANAGED_FLAG], true, name);
			assert.ok(data.system.changes.length > 0, name);
		}
	});
});

describe("regras gerais do efeito criado", () => {
	it("só usa chaves que a ficha de agente tem", () => {
		const permitidas = [/^system\.(PV|PE|SAN|PD)\.bonus$/, /^system\.PE\.perRoundBonus$/, /^system\.genericRd\.value$/, /^system\.defense\.value$/, /^system\.desloc\.value$/,
			/^system\.spaces\.bonus\.max$/, /^system\.attributes\.(dex|int|vit|pre|str)\.value$/, new RegExp(`^system\\.skills\\.(${SKILL_KEYS.join("|")})\\.mod$`)];
		for (const [name, rule] of Object.entries(PASSIVE_RULES)) {
			for (const { key } of rule.changes) assert.ok(permitidas.some((re) => re.test(key)), `${name}: ${key}`);
		}
	});
	it("toda mudança tem texto curto para a lista de efeitos", () => {
		for (const [name, rule] of Object.entries(PASSIVE_RULES)) for (const c of rule.changes) assert.ok(c.label?.length > 3, `${name}: ${c.key}`);
	});
	it("o formato da mudança é o do Foundry 14 (type add, phase initial)", () => {
		assert.deepEqual(changeData({ key: "system.PV.bonus", value: "@nivel.value" }), { key: "system.PV.bonus", type: "add", value: "@nivel.value", phase: "initial", priority: null });
		assert.deepEqual(changeData({ key: "system.PV.bonus", value: 5 }).value, 5);
	});
	it("o mapa `treino` do ator marca as perícias treinadas", () => {
		assert.equal(trainingMap({ stealth: { degree: { label: "veteran" } } }).stealth, 1);
		assert.equal(trainingMap({ stealth: { degree: { label: "untrained" } } }).stealth, 0);
		assert.equal(trainingMap({}).stealth, 0);
	});
	it("não duplica o que o compêndio já traz no poder", () => {
		const pack = [{ system: { changes: [{ key: "system.PV.bonus", value: "@nivel.value" }] } }];
		assert.equal(passiveEffectData("Calejado", { existing: pack }), null);
		const parcial = passiveEffectData("Vitalidade Reforçada", { existing: pack });
		assert.deepEqual(parcial.system.changes.map((c) => c.key), [SK("resilience")]);
	});
	it("o efeito do sistema é atualizado no lugar, sem contar a si mesmo como já coberto", () => {
		const own = { flags: { "ordem-v2-classic": { [MANAGED_FLAG]: true } }, system: { changes: [{ key: "system.PV.bonus", value: 1 }] } };
		const data = passiveEffectData("Calejado", { existing: [own] });
		assert.deepEqual(data.system.changes.map((c) => c.key), ["system.PV.bonus"]);
		assert.equal(data.system.changes[0].value, "@nivel.value");
	});
	it("poder sem regra não gera efeito", () => {
		assert.equal(passiveEffectData("Armamento Pesado"), null);
		assert.equal(passiveRuleFor("Poder que não existe"), null);
	});
	it("o prefixo de trilha e de estágio é ignorado no nome", () => {
		assert.equal(passiveKey("NEX 65% - Ser Assustador (Morte)"), "ser assustador morte");
		assert.equal(passiveKey("Estágio 2 - Durão"), "durao");
		assert.equal(passiveKey("Resistir a <Elemento>"), "resistir a elemento");
	});
});

describe("o que já vem pronto no compêndio continua certo", () => {
	const doPack = (name) => passives.filter(({ doc }) => passiveKey(doc.name) === name);
	const changesOf = (doc) => (doc.effects ?? []).filter((e) => !e.disabled).flatMap((e) => e.system?.changes ?? []);

	it("os efeitos que o compêndio já traz batem com a regra do sistema (mesma chave, mesmo valor)", () => {
		let conferidos = 0;
		for (const [name, rule] of Object.entries(PASSIVE_RULES)) {
			for (const { doc } of doPack(name)) {
				for (const change of changesOf(doc)) {
					const mine = rule.changes.find((c) => c.key === change.key);
					if (!mine) continue;
					assert.equal(String(mine.value), String(change.value), `${doc.name}: ${change.key}`);
					conferidos++;
				}
			}
		}
		assert.ok(conferidos >= 10, `só ${conferidos} efeitos conferidos`);
	});
	it("poderes de PACK_EFFECTS têm o efeito ligado e transferido no compêndio", () => {
		for (const name of PACK_EFFECTS) {
			const found = doPack(name);
			assert.ok(found.length, name);
			for (const { doc } of found) {
				const ativos = (doc.effects ?? []).filter((e) => !e.disabled && e.transfer && (e.system?.changes ?? []).length);
				assert.ok(ativos.length, `${doc.name} sem efeito ligado`);
			}
		}
	});
	it("poderes de ritual diário (Ser Macabro) seguem desligados de propósito", () => {
		for (const name of ["ser macabro conhecimento", "ser macabro morte"]) assert.equal(MANUAL_PASSIVES[name], "permanente");
		for (const { doc } of doPack("ser macabro conhecimento")) assert.ok((doc.effects ?? []).every((e) => e.disabled));
	});
});

describe("resistência a dano do agente (Mutação)", () => {
	it("RD 2 geral tira 2 de qualquer tipo de dano e nunca deixa o dano negativo", () => {
		for (const tipo of ["cuttingDamage", "ballisticDamage", "fireDamage", undefined]) {
			assert.equal(resolveDamage(10, tipo, { genericRd: { value: 2 } }).finalDamage, 8, String(tipo));
		}
		assert.equal(resolveDamage(1, "cuttingDamage", { genericRd: { value: 2 } }).finalDamage, 0);
		assert.equal(resolveDamage(10, "cuttingDamage", { genericRd: { value: 0 } }).finalDamage, 10);
	});
	it("soma com o bloqueio (RD extra), como a RD da ameaça", () => {
		assert.equal(resolveDamage(10, "cuttingDamage", { genericRd: { value: 2 }, extraRd: 3 }).finalDamage, 5);
	});
	it("a ficha de agente tem o campo e o dano aplicado o lê", () => {
		const base = path.join(SOURCE, "../../module");
		assert.match(fs.readFileSync(path.join(base, "data/actors/agent-data.mjs"), "utf8"), /genericRd: new fields\.SchemaField/);
		assert.match(fs.readFileSync(path.join(base, "documents/actor.mjs"), "utf8"), /genericRd: this\.system\.genericRd,/);
	});
});

describe("poderes que valem no ataque", () => {
	const doPack = (name) => passives.filter(({ doc }) => passiveKey(doc.name) === name);
	it("cada um tem o bônus registrado na tela de ataque, no compêndio ou no código", () => {
		for (const name of ATTACK_POWERS) {
			if (ATTACK_ELSEWHERE.includes(name)) continue;
			assert.ok(powerEffectFor(name), `${name} não está em POWER_EFFECTS`);
		}
	});
	it("Mão Pesada e Para Bellum trazem o efeito de dano no compêndio", () => {
		for (const [name, bonus] of [["mao pesada", 2], ["para bellum", 2]]) {
			const efeitos = doPack(name).flatMap(({ doc }) => doc.effects ?? []);
			const onUse = efeitos.map((e) => e.flags?.["ordem-v2-classic"]?.onUse).find(Boolean);
			assert.equal(onUse?.damageBonus, bonus, name);
			assert.equal(onUse?.auto, true, name);
		}
	});
	it("Golpe de Sorte: +1 na margem de ameaça, sempre, com qualquer arma", () => {
		const entry = POWER_EFFECTS["golpe de sorte"].onUse;
		assert.equal(entry.critMargin, 1);
		assert.equal(entry.auto, true);
		assert.equal(entry.applies, "all");
		assert.ok(powerEffectFor("Golpe de Sorte"));
	});
	it("Potência Máxima (Guerreiro) é tratada pelo nome na tela de ataque", () => {
		const code = fs.readFileSync(path.join(SOURCE, "../../module/helpers/attack-options.mjs"), "utf8");
		assert.match(code, /potenciamaxima/);
	});
});
