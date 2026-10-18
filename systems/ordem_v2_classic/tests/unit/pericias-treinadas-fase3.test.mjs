// Rodar: npm test. Perícias treinadas, fase 3: Foco em Perícia, Eclético/Engenhosidade, Treinamento Especial, grimório e pacote.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	CONVERSION_FREE, TRAINING_GRANTS, eclecticOptions, focusDice, grantFor, makeEntry, planDegreeChange, resolveTraining,
} from "../../module/helpers/skill-training-rules.mjs";
import { budgetCard, degreeChip, powerReading, skillReading } from "../../module/helpers/grimoire-training.mjs";
import { SKILL_KEYS } from "../../module/helpers/passive-effects-rules.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const E = (skill, kind = "train", source = "manual", extra = {}) => makeEntry({ skill, kind, source, ...extra });

describe("Foco em Perícia: +1 dado no teste da perícia escolhida", () => {
	const foco = (skill) => ({ name: "Foco em Perícia", focusSkill: skill });
	it("uma cópia dá +1 dado só na perícia escolhida", () => {
		assert.equal(focusDice([foco("stealth")], "stealth"), 1);
		assert.equal(focusDice([foco("stealth")], "crime"), 0);
	});
	it("cópias para perícias diferentes não se somam; duas na mesma somariam (a escolha não deixa repetir)", () => {
		assert.equal(focusDice([foco("stealth"), foco("crime")], "crime"), 1);
		assert.equal(focusDice([foco("stealth"), foco("stealth")], "stealth"), 2);
	});
	it("Luta e Pontaria nunca recebem o dado", () => {
		assert.equal(focusDice([foco("fighting"), foco("aim")], "fighting"), 0);
		assert.equal(focusDice([foco("aim")], "aim"), 0);
	});
	it("só conta o poder Foco em Perícia, sem escolha não conta", () => {
		assert.equal(focusDice([{ name: "Perito", focusSkill: "stealth" }], "stealth"), 0);
		assert.equal(focusDice([{ name: "Foco em Perícia" }], "stealth"), 0);
		assert.equal(focusDice([], "stealth"), 0);
		assert.equal(focusDice([foco("stealth")], undefined), 0);
	});
	it("a escolha segue travada: a perícia com Foco não vira destreinada", () => {
		const entries = [E("stealth", "train", "class"), E("stealth", "hold", "power", { label: "Foco em Perícia", locked: true })];
		const plan = planDegreeChange({ entries, skill: "stealth", newLabel: "untrained", level: 1 });
		assert.equal(plan.ok, false);
		assert.match(plan.message, /Foco em Perícia/);
	});
});

describe("Eclético e Engenhosidade (um teste, sem mudar a ficha)", () => {
	const op = (o) => eclecticOptions({ classKey: "especialista", ...o });
	it("só o Especialista tem Eclético", () => {
		for (const classKey of ["combatente", "ocultista", "sobrevivente", null]) assert.deepEqual(eclecticOptions({ classKey, level: 20, degreeIndex: 0 }), []);
	});
	it("destreinada: treinado por 2 PE, +5", () => {
		const [o] = op({ level: 1, degreeIndex: 0 });
		assert.deepEqual([o.degree, o.pe, o.bonus], ["trained", 2, 5]);
	});
	it("NEX 40% (nível 8): Engenhosidade oferece veterano por 4 PE, +10 sobre quem é destreinado", () => {
		const list = op({ level: 8, degreeIndex: 0 });
		assert.deepEqual(list.map((o) => [o.degree, o.pe, o.bonus]), [["trained", 2, 5], ["veteran", 4, 10]]);
		assert.deepEqual(op({ level: 7, degreeIndex: 0 }).map((o) => o.degree), ["trained"]);
	});
	it("NEX 75% (nível 15): expert por 6 PE, +15", () => {
		const list = op({ level: 15, degreeIndex: 0 });
		assert.deepEqual(list.map((o) => o.degree), ["trained", "veteran", "expert"]);
		assert.equal(list.at(-1).pe, 6);
		assert.equal(list.at(-1).bonus, 15);
		assert.deepEqual(op({ level: 14, degreeIndex: 0 }).map((o) => o.degree), ["trained", "veteran"]);
	});
	it("só oferece grau acima do atual e o bônus é a diferença", () => {
		assert.deepEqual(op({ level: 20, degreeIndex: 1 }).map((o) => [o.degree, o.bonus]), [["veteran", 5], ["expert", 10]]);
		assert.deepEqual(op({ level: 20, degreeIndex: 2 }).map((o) => [o.degree, o.bonus]), [["expert", 5]]);
		assert.deepEqual(op({ level: 20, degreeIndex: 3 }), []);
	});
	it("não mexe no livro-caixa: nenhuma entrada nasce do Eclético", () => {
		const entries = [E("stealth")];
		eclecticOptions({ classKey: "especialista", level: 8, degreeIndex: 0 });
		assert.equal(entries.length, 1);
		assert.equal(resolveTraining({ entries }).degrees.crime ?? 0, 0);
	});
});

describe("Treinamento Especial: o Sobrevivente que vira outra classe", () => {
	const budget = (classKey, int, converted, level = 1) => resolveTraining({ entries: [], int, level, classKey, hasOrigin: true, converted }).budget;
	it("Sobrevivente com Int 2: 1 + Int = 3 perícias (mais 2 da origem)", () => {
		assert.equal(budget("sobrevivente", 2, false).train.allowed, 2 + 3);
	});
	it("vira Especialista: soma 6, sem a base 7 nem Int de novo", () => {
		assert.equal(budget("especialista", 2, true).train.allowed, 2 + 3 + 6);
		assert.equal(budget("especialista", 2, false).train.allowed, 2 + 7 + 2);
		assert.equal(CONVERSION_FREE.especialista, 6);
	});
	it("vira Combatente: as 2 fixas (grupos) somam às do Sobrevivente", () => {
		assert.equal(budget("combatente", 2, true).train.allowed, 2 + 2 + 3);
	});
	it("vira Ocultista: Ocultismo e Vontade somam", () => {
		assert.equal(budget("ocultista", 2, true).train.allowed, 2 + 2 + 3);
	});
	it("a partir da conversão há Grau de Treinamento da classe nova com a base dela + Int", () => {
		assert.equal(budget("especialista", 2, true, 7).raise.allowed, 5 + 2);
		assert.equal(budget("combatente", 1, true, 14).raise.allowed, 2 * (2 + 1));
		assert.equal(budget("sobrevivente", 3, false, 20).raise.allowed, 0);
	});
	it("voltar a ser Sobrevivente com a marca de conversão não muda a conta", () => {
		assert.equal(budget("sobrevivente", 2, true).train.allowed, budget("sobrevivente", 2, false).train.allowed);
	});
	it("o seletor do jogador respeita o orçamento da conversão", () => {
		const entries = [E("crime", "train", "class", { locked: true })];
		const plan = planDegreeChange({ entries, skill: "arts", newLabel: "trained", level: 1, int: 0, classKey: "especialista", hasOrigin: false, converted: true });
		assert.ok(plan.ok);
	});
});

describe("grimório: o que o personagem tem", () => {
	it("chip do grau com os pontos", () => {
		assert.deepEqual(degreeChip(0), { label: "Destreinada", tone: "none" });
		assert.deepEqual(degreeChip(1), { label: "Treinada +5", tone: "trained" });
		assert.deepEqual(degreeChip(2), { label: "Veterana +10", tone: "veteran" });
		assert.deepEqual(degreeChip(3), { label: "Expert +15", tone: "expert" });
		assert.equal(degreeChip(9).tone, "expert");
	});
	it("perícia treinada pela origem mostra de onde veio e a trava", () => {
		const r = skillReading({ name: "Ciências", degree: 1, sources: ["Acadêmico"], locked: ["Acadêmico"] });
		assert.equal(r.chip.label, "Treinada +5");
		assert.deepEqual(r.lines, ["Veio de: Acadêmico.", "Travada por: Acadêmico 🔒."]);
	});
	it("perícia com +2 de poder mostra o bônus; destreinada diz que não é treinado", () => {
		assert.ok(skillReading({ name: "Furtividade", degree: 1, sources: ["Classe"], plus: [{ value: 2, label: "Sorrateiro" }] }).lines.includes("+2 de Sorrateiro (já era treinado)."));
		assert.match(skillReading({ name: "Artes", degree: 0 }).lines[0], /não é treinado/);
		assert.equal(skillReading({ name: "Artes", degree: 1, manual: true }).lines[0], "Veio de: escolha na ficha.");
	});
	it("poder: treinada pelo poder, +2 aplicado, escolhida (Perito) e pendente", () => {
		assert.match(powerReading({ mode: "grant", skill: "Acrobacia" }).lines[0], /Acrobacia 🔒 · treinada por este poder/);
		assert.match(powerReading({ mode: "plus", skill: "Acrobacia", bonus: 2 }).lines[0], /\+2 aplicado em Acrobacia/);
		assert.match(powerReading({ mode: "plus", skill: "Profissão (engenheiro)", bonus: 5 }).lines[0], /\+5 aplicado/);
		assert.match(powerReading({ mode: "hold", skill: "Crime e Furtividade" }).lines[0], /não pode ser destreinada/);
		assert.match(powerReading({ pending: true }).lines[0], /Escolha pendente/);
	});
	it("cartão: números da ficha e as regras R3, R4 e R5 em três linhas", () => {
		const card = budgetCard({ train: { used: 7, allowed: 9 }, raise: { used: 0, allowed: 0 }, points: { used: 7, allowed: 9 } });
		assert.deepEqual(card.numbers, ["Perícias treinadas: 7 / 9", "Pontos: 7 / 9"]);
		assert.equal(card.rules.length, 3);
		assert.match(card.rules[0], /origem entra primeiro/);
		const raise = budgetCard({ train: { used: 1, allowed: 1 }, raise: { used: 2, allowed: 5 }, points: { used: 3, allowed: 6 }, showRaise: true, over: true });
		assert.ok(raise.numbers.includes("Aumentos de grau: 2 / 5"));
		assert.equal(raise.over, true);
	});
});

describe("pacote: compêndios e arquivos do sistema", () => {
	const walk = (dir, out = []) => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			if (e.isDirectory()) walk(p, out);
			else if (e.name.endsWith(".json")) out.push(p);
		}
		return out;
	};
	const item = (pack, name) => walk(path.join(ROOT, "packs/_source", pack)).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).find((d) => d.name === name);
	it("os três compêndios de poderes de classe têm Treinamento em Perícia, com o texto do livro", () => {
		for (const pack of ["fighterPowers", "specialistPowers", "occultistPowers"]) {
			const d = item(pack, "Treinamento em Perícia");
			assert.ok(d, pack);
			assert.match(d.system.description, /Escolha duas perícias/);
			assert.match(d.system.description, /NEX 35%/);
			assert.match(d.system.description, /NEX 70%/);
			assert.match(d.system.description, /várias vezes/);
			assert.equal(d.system.abilityType, "class");
		}
	});
	it("ids estáveis (o upsert do Mestre não duplica) e Treinamento em Perícia tem concessão", () => {
		const ids = ["fighterPowers", "specialistPowers", "occultistPowers"].map((p) => item(p, "Treinamento em Perícia")._id);
		assert.equal(new Set(ids).size, 3);
		assert.equal(grantFor("Treinamento em Perícia").count, 2);
	});
	it("nenhum item do compêndio guarda efeito de treinamento antigo (a ficha cria o efeito gerenciado)", () => {
		for (const d of walk(path.join(ROOT, "packs/_source")).map((f) => JSON.parse(fs.readFileSync(f, "utf8")))) {
			for (const e of d.effects ?? []) assert.ok(!/treino/.test(JSON.stringify(e.system?.changes ?? [])), `${d.name} tem efeito @treino`);
		}
	});
	it("o código não usa mais o efeito antigo trainOrBonus", () => {
		for (const f of ["module/helpers/passive-effects-rules.mjs", "module/helpers/passive-effects.mjs", "module/helpers/skill-training.mjs"]) {
			assert.ok(!/trainOrBonus/.test(fs.readFileSync(path.join(ROOT, f), "utf8")), f);
		}
	});
	it("toda concessão de treinamento fixa aponta para perícia do modelo", () => {
		for (const [name, g] of Object.entries(TRAINING_GRANTS)) if (g.skill) assert.ok(SKILL_KEYS.includes(g.skill), name);
	});
	it("a janela de teste e a ficha usam Foco e Eclético", () => {
		const actor = fs.readFileSync(path.join(ROOT, "module/documents/actor.mjs"), "utf8");
		assert.match(actor, /focusDice\(/);
		assert.match(actor, /eclecticFor\(this, process\.skill\)/);
		assert.match(actor, /payEclectic\(this, rollConfig\)/);
		assert.match(fs.readFileSync(path.join(ROOT, "module/applications/skill-tool-configuration-dialog.mjs"), "utf8"), /name: "eclectic"/);
	});
	it("o grimório lê o treinamento (perícia e poder) e o modelo mostra", () => {
		assert.match(fs.readFileSync(path.join(ROOT, "module/applications/grimoire-app.mjs"), "utf8"), /trainingReadingForSkill/);
		assert.match(fs.readFileSync(path.join(ROOT, "templates/apps/grimoire-reading.hbs"), "utf8"), /reading\.training/);
	});
});
