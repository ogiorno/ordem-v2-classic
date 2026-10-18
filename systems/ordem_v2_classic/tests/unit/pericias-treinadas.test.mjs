// Rodar: npm test. Perícias treinadas: orçamento, graus e travas (docs/arquivo/spec-pericias-treinadas.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	CLASS_TRAINING, ORIGIN_TRAINING, TRAINING_GRANTS, buildLedger, classPicks, degreeIndex, gradeBudgetPerEvent, grantFor,
	lockedBy, lockedMinIndex, makeEntry, maxDegreeIndex, originPlan, planDegreeChange, raisableSkills, resolveTraining, trainedSkills,
	trainingClassKey, trainingKey, untrainedSkills,
} from "../../module/helpers/skill-training-rules.mjs";
import { SKILL_KEYS, SKILL_NAMES, passiveKey } from "../../module/helpers/passive-effects-rules.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (dir, out = []) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith(".json")) out.push(p);
	}
	return out;
};
const docs = (sub) => walk(path.join(ROOT, "packs/_source", sub)).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).filter((d) => d.name && d.type);

const E = (skill, kind = "train", source = "manual", extra = {}) => makeEntry({ skill, kind, source, ...extra });
const R = (entries, o = {}) => resolveTraining({ entries, ...o });

describe("graus (R1, R4)", () => {
	it("grau = +5 por degrau, na ordem destreinada, treinada, veterana, expert", () => {
		assert.deepEqual(["untrained", "trained", "veteran", "expert"].map(degreeIndex), [0, 1, 2, 3]);
		assert.equal(degreeIndex("master"), 3);
		assert.equal(degreeIndex(undefined), 0);
	});
	it("Veterano só no NEX 35% (nível 7) e Expert no NEX 70% (nível 14)", () => {
		assert.deepEqual([1, 6, 7, 13, 14, 20].map(maxDegreeIndex), [1, 1, 2, 2, 3, 3]);
	});
});

describe("orçamento por classe (F2, F3, R5, R10)", () => {
	const orcamento = (classKey, int, level = 1, entries = [], hasOrigin = true) => R(entries, { classKey, int, level, hasOrigin }).budget;
	for (const [classe, base, esperado] of [["combatente", 2, 3], ["especialista", 0, 7], ["ocultista", 2, 5], ["sobrevivente", 0, 1]]) {
		it(`${classe}, Int 0: origem 2 + ${base} fixas + livres`, () => {
			assert.equal(orcamento(classe, 0).train.allowed, 2 + base + (esperado - base));
		});
	}
	it("as três classes × Intelecto 0/1/3/5", () => {
		for (const [classe, total] of [["combatente", 3], ["especialista", 7], ["ocultista", 5]]) {
			for (const int of [0, 1, 3, 5]) assert.equal(orcamento(classe, int).train.allowed, 2 + total + int, `${classe} Int ${int}`);
		}
	});
	it("Sobrevivente: 1 + Int, sem fixas", () => {
		for (const int of [0, 1, 2, 5]) assert.equal(orcamento("sobrevivente", int).train.allowed, 2 + 1 + int);
	});
	it("sem origem a origem não conta; sem classe só a origem", () => {
		assert.equal(R([], { hasOrigin: false }).budget.train.allowed, 0);
		assert.equal(R([], { hasOrigin: true }).budget.train.allowed, 2);
	});
	it("aumentar o Intelecto libera vaga na hora (R5)", () => {
		assert.equal(orcamento("combatente", 2).train.allowed - orcamento("combatente", 1).train.allowed, 1);
	});
	it("ajuste manual do Mestre soma", () => {
		assert.equal(R([], { classKey: "especialista", int: 1, hasOrigin: true, adjust: { train: 2, raise: 1 } }).budget.train.allowed, 2 + 7 + 1 + 2);
		assert.equal(R([], { classKey: "especialista", int: 1, level: 7, hasOrigin: true, adjust: { raise: 1 } }).budget.raise.allowed, 5 + 1 + 1);
	});
	it("o nome da classe vira a chave", () => {
		assert.equal(trainingClassKey("Combatente"), "combatente");
		assert.equal(trainingClassKey("Sobrevivente"), "sobrevivente");
		assert.equal(trainingClassKey("Mago"), null);
	});
});

describe("Grau de Treinamento (G1, G2, D3, D5)", () => {
	const aumentos = (classe, int, level) => R([], { classKey: classe, int, level, hasOrigin: true }).budget.raise.allowed;
	it("NEX 35%: Combatente 2+Int, Especialista 5+Int, Ocultista 3+Int", () => {
		assert.equal(aumentos("combatente", 1, 7), 3);
		assert.equal(aumentos("especialista", 3, 7), 8);
		assert.equal(aumentos("ocultista", 2, 7), 5);
	});
	it("de novo no NEX 70%: o saldo dobra", () => {
		assert.equal(aumentos("combatente", 1, 14), 6);
		assert.equal(aumentos("especialista", 3, 14), 16);
		assert.equal(aumentos("ocultista", 2, 20), 10);
	});
	it("antes do NEX 35% não há aumento; Sobrevivente nunca tem", () => {
		assert.equal(aumentos("combatente", 5, 6), 0);
		assert.equal(aumentos("sobrevivente", 5, 20), 0);
	});
	it("Int +1 depois do NEX 35% libera +1 saldo (D3)", () => {
		assert.equal(aumentos("combatente", 2, 7) - aumentos("combatente", 1, 7), 1);
	});
	it("o saldo do evento sai da classe + Int", () => {
		assert.equal(gradeBudgetPerEvent("especialista", 3), 8);
		assert.equal(gradeBudgetPerEvent("sobrevivente", 3), 0);
	});
	it("só sobe quem já é treinada e o nível permite; uma vez por evento (R4)", () => {
		const entries = [E("stealth"), E("crime"), E("will", "train"), E("will", "raise")];
		assert.deepEqual(raisableSkills(entries, 7, { picked: ["crime"] }), ["stealth"]);
		assert.deepEqual(raisableSkills(entries, 14).sort(), ["crime", "stealth", "will"].sort());
		assert.deepEqual(raisableSkills(entries, 6), []);
	});
	it("aumento sem perícia treinada não faz nada", () => {
		const r = R([E("acrobatics", "raise")]);
		assert.equal(r.degrees.acrobatics ?? 0, 0);
	});
});

describe("livro-caixa e graus derivados", () => {
	it("treinar → treinada; subir → veterana → expert; no máximo expert", () => {
		const r = R([E("stealth"), E("stealth", "raise"), E("stealth", "raise"), E("stealth", "raise")]);
		assert.equal(r.degrees.stealth, 3);
	});
	it("pontos: cada degrau acima de destreinada é 1 ponto (R1)", () => {
		const r = R([E("stealth"), E("stealth", "raise"), E("crime"), E("crime", "raise"), E("crime", "raise")], { level: 14, classKey: "combatente", int: 1, hasOrigin: true });
		assert.equal(r.budget.train.used, 2);
		assert.equal(r.budget.raise.used, 3);
		assert.equal(r.budget.points.used, 5);
	});
	it("concessões de habilidade não gastam vaga (R6, D7)", () => {
		const r = R([E("acrobatics", "grant", "power", { label: "Acrobático", locked: true })], { classKey: "combatente", int: 1, hasOrigin: true });
		assert.equal(r.degrees.acrobatics, 1);
		assert.equal(r.budget.train.used, 0);
		assert.equal(r.budget.grants.length, 1);
	});
	it("Esperto e Treinamento em Perícia consomem a vaga que eles mesmos criam (saldo zero)", () => {
		const base = R([], { classKey: "sobrevivente", int: 1, hasOrigin: true }).budget.train.allowed;
		const r = R([E("tactics", "train", "stage", { label: "Esperto", locked: true })], { classKey: "sobrevivente", int: 1, hasOrigin: true });
		assert.equal(r.budget.train.allowed, base + 1);
		assert.equal(r.budget.train.used, 1);
		const t = R([E("crime", "train", "trainingPower"), E("will", "train", "trainingPower")], { classKey: "especialista", int: 0, hasOrigin: false });
		assert.equal(t.budget.train.allowed, 7 + 2);
	});
	it("acima do limite fica marcado, sem apagar nada (R5 com Int caindo)", () => {
		const entries = Array.from({ length: 6 }, (_, i) => E(SKILL_KEYS[i]));
		const r = R(entries, { classKey: "ocultista", int: 0, hasOrigin: false });
		assert.equal(r.budget.over, true);
		assert.equal(r.degrees[SKILL_KEYS[0]], 1);
	});
	it("entrada sem perícia é escolha pendente e não conta como usada", () => {
		const r = R([E(null, "train", "origin")], { hasOrigin: true });
		assert.equal(r.budget.pending.length, 1);
		assert.equal(r.budget.train.used, 0);
	});
});

describe("origem entra antes da classe (R3) e Bianca (R9)", () => {
	it("Lutador e Combatente: Luta vem da origem, o grupo Luta/Pontaria vira escolha livre", () => {
		const picks = classPicks("combatente", ["fighting", "reflexes"]);
		assert.deepEqual(picks.groups, []);
		assert.equal(picks.extraFree, 2);
	});
	it("Militar e Combatente: Pontaria da origem atende o grupo; Fortitude/Reflexos segue", () => {
		const picks = classPicks("combatente", ["aim", "tactics"]);
		assert.deepEqual(picks.groups, [["resilience", "reflexes"]]);
		assert.equal(picks.extraFree, 1);
	});
	it("Policial e Combatente: Pontaria atende; sem Fortitude/Reflexos na origem fica o grupo", () => {
		assert.deepEqual(classPicks("combatente", ["perception", "aim"]).groups, [["resilience", "reflexes"]]);
	});
	it("Combatente sem sobreposição: os dois grupos", () => {
		const picks = classPicks("combatente", ["sciences", "investigation"]);
		assert.equal(picks.groups.length, 2);
		assert.equal(picks.extraFree, 0);
	});
	it("Cultista Arrependido e Ocultista: Ocultismo da origem, resta Vontade; Religioso cobre Vontade", () => {
		assert.deepEqual(classPicks("ocultista", ["occultism", "religion"]).named, ["will"]);
		assert.deepEqual(classPicks("ocultista", ["religion", "will"]).named, ["occultism"]);
		assert.equal(classPicks("ocultista", ["occultism", "will"]).extraFree, 2);
	});
	it("Especialista não tem fixas", () => {
		assert.deepEqual(classPicks("especialista", ["crime"]), { groups: [], named: [], extraFree: 0 });
	});
	it("a perícia já treinada não aparece como opção livre (o exemplo errado da Bianca, p. 22)", () => {
		const entries = [E("perception", "train", "origin", { locked: true }), E("sciences", "train", "origin", { locked: true })];
		assert.ok(!untrainedSkills(entries).includes("perception"));
		assert.ok(untrainedSkills(entries).includes("crime"));
		assert.equal(untrainedSkills(entries).length, SKILL_KEYS.length - 2);
	});
	it("a origem vem antes na prioridade, qualquer que seja a ordem das entradas", () => {
		const r = R([E("acrobatics", "grant", "power", { label: "Acrobático", locked: true }), E("acrobatics", "train", "origin", { label: "Atleta", locked: true })]);
		assert.equal(r.skills.acrobatics.plus.length, 1, "o poder vira +2 porque a origem já treinou");
		assert.equal(r.degrees.acrobatics, 1);
	});
});

describe("origens (F1) e o compêndio", () => {
	const origens = docs("origins").filter((d) => d.type === "origin");
	it("toda origem do compêndio está na tabela de perícias", () => {
		assert.ok(origens.length >= 50, `só ${origens.length} origens`);
		for (const o of origens) {
			const key = trainingKey(o.name);
			assert.ok(ORIGIN_TRAINING[key], `${o.name} não está na tabela de perícias`);
		}
	});
	it("a tabela não tem origem que o compêndio não tenha", () => {
		const keys = new Set(origens.map((o) => trainingKey(o.name)));
		for (const k of Object.keys(ORIGIN_TRAINING)) assert.ok(keys.has(k), k);
	});
	it("cada origem aplica exatamente duas perícias (fixas + Profissões + escolhas)", () => {
		for (const [k, rule] of Object.entries(ORIGIN_TRAINING)) {
			const plan = originPlan(k);
			assert.equal(plan.fixed.length + plan.professions.length + plan.choose + plan.gm, 2, k);
			for (const s of plan.fixed) assert.ok(SKILL_KEYS.includes(s), `${k}: ${s}`);
			assert.ok(rule);
		}
	});
	it("quando o texto do compêndio nomeia as perícias, bate com a tabela", () => {
		const sem = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
		const txt = (h) => sem(String(h).replace(/<[^>]+>/g, " ").replace(/&ecirc;/g, "ê").replace(/&iacute;/g, "í").replace(/&ccedil;/g, "ç").replace(/&atilde;/g, "ã").replace(/&aacute;/g, "á").replace(/\s+/g, " "));
		let conferidas = 0;
		for (const o of origens) {
			const plan = originPlan(o.name);
			if (!plan || plan.pending || plan.fixed.length !== 2) continue;
			const texto = txt(o.system.description);
			// o compêndio escreve "<Perícia> e <Perícia>. <Nome do poder>." logo no início do poder; só confere quando as duas perícias aparecem juntas assim
			const nomes = plan.fixed.map((k) => sem(SKILL_NAMES[k]));
			const junto = nomes.some((a) => nomes.some((b) => a !== b && texto.includes(`${a} e ${b}.`)));
			if (!junto) continue;
			conferidas++;
		}
		assert.ok(conferidas >= 8, `só ${conferidas} origens conferidas com o texto`);
	});
	it("Amnésico é duas escolhas do jogador; Profetizado é Vontade + 1 livre; Chef fixa Profissão (cozinheiro)", () => {
		assert.equal(originPlan("Amnésico").choose, 2);
		assert.equal(originPlan("Amnésico").gm, 0);
		assert.deepEqual([originPlan("Profetizado").fixed, originPlan("Profetizado").choose], [["will"], 1]);
		assert.deepEqual(originPlan("Chef").professions, ["cozinheiro"]);
		assert.deepEqual(originPlan("Engenheiro").professions, [null]);
		assert.deepEqual(originPlan("Inventor Paranormal").professions, ["engenheiro"]);
		assert.deepEqual(originPlan("Ufólogo").fixed, ["sciences", "occultism"]);
		assert.equal(originPlan("Ufólogo").pending, false);
		assert.equal(originPlan("Origem Inventada"), null);
	});
});

describe("poderes \"treinamento ou +2\" (F6, F7, 3.5)", () => {
	const grants = Object.entries(TRAINING_GRANTS).filter(([, g]) => g.mode === "grantOrPlus" && g.skill);
	it("25 poderes gerais + 2 de trilha + 4 Ser Amaldiçoado concedem uma perícia fixa", () => {
		assert.equal(grants.length, 20 + 5 + 2 + 4);
	});
	it("destreinada: o poder treina (+5 pelo grau), sem vaga e sem bônus", () => {
		for (const [name, g] of grants) {
			const r = R([E(g.skill, "grant", "power", { label: name, bonus: g.bonus, locked: true })]);
			assert.equal(r.degrees[g.skill], 1, name);
			assert.equal(r.skills[g.skill].plus.length, 0, name);
			assert.equal(r.budget.train.used, 0, name);
		}
	});
	it("já treinada por outra fonte: o grau fica e liga o +2", () => {
		for (const [name, g] of grants) {
			for (const fonte of ["origin", "class", "manual", "trainingPower"]) {
				const r = R([E(g.skill, "train", fonte), E(g.skill, "grant", "power", { label: name, bonus: g.bonus, locked: true })]);
				assert.equal(r.degrees[g.skill], 1, `${name} / ${fonte}`);
				assert.deepEqual(r.skills[g.skill].plus.map((p) => p.value), [2], `${name} / ${fonte}`);
			}
		}
	});
	it("tirar a outra fonte com o poder presente: o poder passa a treinar (e o +2 desliga); recolocar: volta ao +2", () => {
		const grant = E("stealth", "grant", "power", { label: "Sorrateiro", bonus: 2, locked: true });
		const origem = E("stealth", "train", "origin");
		assert.equal(R([origem, grant]).skills.stealth.plus.length, 1);
		const sem = R([grant]);
		assert.equal(sem.skills.stealth.plus.length, 0);
		assert.equal(sem.degrees.stealth, 1);
		assert.equal(R([grant, origem]).skills.stealth.plus.length, 1);
	});
	it("dois poderes na mesma perícia: o mais antigo treina, o seguinte vira +2", () => {
		const a = E("occultism", "grant", "power", { label: "Personalidade Esotérica", bonus: 2, locked: true });
		const b = E("occultism", "grant", "path", { label: "Ser Amaldiçoado", bonus: 2, locked: true });
		const r = R([a, b]);
		assert.equal(r.skills.occultism.grantedBy.length, 1);
		assert.equal(r.skills.occultism.plus.length, 1);
	});
	it("Laboratório de Campo: Profissão treinada ou +5", () => {
		const g = grantFor("NEX 65% - Laboratório de Campo");
		assert.equal(g.bonus, 5);
		assert.deepEqual(g.options, ["profession:armeiro", "profession:engenheiro", "profession:quimico"]);
		const treinada = R([E("profession:engenheiro", "train", "origin"), E("profession:engenheiro", "grant", "path", { label: "Laboratório de Campo", bonus: 5, locked: true })]);
		assert.deepEqual(treinada.skills.freeSkill.plus.map((p) => p.value), [5]);
		assert.equal(R([E("profession:armeiro", "grant", "path", { label: "Laboratório de Campo", bonus: 5 })]).degrees.freeSkill, 1);
	});
	it("a perícia concedida fica travada na habilidade (R8) e o Grau de Treinamento depois não desfaz a trava", () => {
		const entries = [E("driving", "grant", "power", { label: "Ás do Volante", locked: true }), E("driving", "raise", "classGrade")];
		const r = R(entries, { level: 7 });
		assert.equal(r.degrees.driving, 2);
		assert.equal(lockedMinIndex(entries, "driving"), 1);
		assert.deepEqual(lockedBy(entries, "driving"), ["Ás do Volante"]);
	});
	it("os cinco poderes que não eram passivos agora têm concessão", () => {
		for (const nome of ["Ás do Volante", "Palavras de Devoção", "Resposta Rápida", "Teimosia Obstinada", "Tenacidade"]) assert.ok(grantFor(nome), nome);
	});
	it("o compêndio: todo poder com texto 'treinamento … ou, se já for treinado' tem concessão", () => {
		const itens = docs("generalPowers").concat(docs("pathSpecialist"), docs("pathOccultist"), docs("pathFighter"));
		let achados = 0;
		for (const d of itens) {
			if (d.type !== "ability") continue;
			const texto = String(d.system?.description ?? "").replace(/<[^>]+>/g, " ");
			if (/treinamento (em|na)[^.]{0,60}ou,? se j[áa] (for|é|e) treinad/i.test(texto) || /recebe treinamento em [^.]{0,40} ou, se j/i.test(texto)) {
				achados++;
				assert.ok(grantFor(d.name), `${d.name} sem concessão de treinamento`);
			}
		}
		assert.ok(achados >= 25, `só ${achados} poderes com o texto`);
	});
});

describe("escolhas (Esperto, Mutação, Perito, Foco)", () => {
	it("Esperto: perícia destreinada, vaga extra, trava na habilidade", () => {
		assert.equal(grantFor("Estágio 2 - Esperto").mode, "chooseFree");
		const r = R([E("tactics", "train", "stage", { label: "Esperto", locked: true })], { classKey: "sobrevivente", hasOrigin: true });
		assert.deepEqual(lockedBy([E("tactics", "train", "stage", { label: "Esperto", locked: true })], "tactics"), ["Esperto"]);
		assert.equal(r.budget.train.used, 1);
	});
	it("Mutação: só perícias de Força, Agilidade ou Vigor; +2 sem treinar", () => {
		const g = grantFor("Mutação");
		assert.equal(g.mode, "chooseBonus");
		for (const k of g.options) assert.ok(SKILL_KEYS.includes(k));
		for (const proibida of ["diplomacy", "occultism", "will", "intuition", "tactics", "medicine"]) assert.ok(!g.options.includes(proibida));
		const r = R([E("athleticism", "plus", "power", { label: "Mutação", bonus: 2, locked: true })]);
		assert.equal(r.degrees.athleticism ?? 0, 0);
		assert.deepEqual(r.skills.athleticism.plus.map((p) => p.value), [2]);
		assert.equal(r.budget.train.used, 0);
	});
	it("Perito, Entendido e Foco: só perícias já treinadas, sem Luta e Pontaria", () => {
		const entries = [E("stealth"), E("fighting"), E("aim"), E("crime")];
		assert.deepEqual(trainedSkills(entries, { exclude: ["fighting", "aim"] }).sort(), ["crime", "stealth"]);
		assert.equal(grantFor("Perito").count, 2);
		assert.equal(grantFor("Entendido").flag, "peritoSkills");
		assert.equal(grantFor("Foco em Perícia").count, 1);
	});
	it("Treinamento em Perícia: 2 escolhas por cópia; três cópias acumulam 6", () => {
		assert.equal(grantFor("Treinamento em Perícia").count, 2);
		const copias = Array.from({ length: 6 }, (_, i) => E(SKILL_KEYS[i], "train", "trainingPower"));
		assert.equal(R(copias, { classKey: "especialista", hasOrigin: false }).budget.train.allowed, 7 + 6);
	});
	it("Treinamento em Perícia: treinar + subir de grau (NEX 35) e subir em sequência até expert (NEX 70)", () => {
		const entries = [E("stealth", "train", "trainingPower"), E("crime", "train", "trainingPower"), E("crime", "raise", "trainingPower")];
		const r = R(entries, { level: 7, classKey: "especialista" });
		assert.equal(r.degrees.crime, 2);
		assert.equal(r.budget.raise.allowed, 6);
		const exp = R([...entries, E("crime", "raise", "trainingPower")], { level: 14 });
		assert.equal(exp.degrees.crime, 3);
	});
});

describe("o seletor de grau da ficha (travas, D2)", () => {
	const ctx = { level: 1, int: 1, classKey: "combatente", hasOrigin: true };
	const cheio = () => [E("sciences", "train", "origin", { locked: true, label: "Acadêmico" }), E("investigation", "train", "origin", { locked: true, label: "Acadêmico" }), E("fighting", "train", "class", { locked: true }), E("resilience", "train", "class", { locked: true }), E("crime", "train", "class", { locked: true }), E("stealth", "train", "class", { locked: true })];
	it("treinar uma perícia com vaga sobrando cria entrada manual", () => {
		const entries = cheio().slice(0, 5);
		const plan = planDegreeChange({ ...ctx, entries, skill: "arts", newLabel: "trained" });
		assert.ok(plan.ok);
		assert.equal(plan.entries.at(-1).source, "manual");
	});
	it("com as vagas cheias o jogador é bloqueado e o Mestre passa com aviso (D2)", () => {
		const plan = planDegreeChange({ ...ctx, entries: cheio(), skill: "arts", newLabel: "trained" });
		assert.equal(plan.ok, false);
		assert.equal(plan.reason, "budget");
		const gm = planDegreeChange({ ...ctx, entries: cheio(), skill: "arts", newLabel: "trained", isGM: true });
		assert.ok(gm.ok);
		assert.equal(R(gm.entries, ctx).budget.over, true);
	});
	it("Veterano antes do NEX 35% e Expert antes do NEX 70% são bloqueados para o jogador (R4)", () => {
		const entries = [E("crime")];
		assert.equal(planDegreeChange({ ...ctx, entries, skill: "crime", newLabel: "veteran" }).reason, "nex");
		assert.equal(planDegreeChange({ ...ctx, level: 7, entries, skill: "crime", newLabel: "expert" }).reason, "nex");
		assert.ok(planDegreeChange({ ...ctx, level: 7, entries, skill: "crime", newLabel: "veteran", classKey: "especialista" }).ok);
	});
	it("saltar de destreinada para veterana cria duas entradas (treino e aumento)", () => {
		const plan = planDegreeChange({ ...ctx, level: 7, classKey: "especialista", entries: [], skill: "crime", newLabel: "veteran" });
		assert.deepEqual(plan.entries.map((e) => e.kind), ["train", "raise"]);
	});
	it("perícia travada pela habilidade não desce para o jogador; o Mestre destrava", () => {
		const entries = [E("acrobatics", "grant", "power", { label: "Acrobático", locked: true })];
		const jogador = planDegreeChange({ ...ctx, entries, skill: "acrobatics", newLabel: "untrained" });
		assert.equal(jogador.ok, false);
		assert.match(jogador.message, /Acrobático/);
		const mestre = planDegreeChange({ ...ctx, entries, skill: "acrobatics", newLabel: "untrained", isGM: true });
		assert.ok(mestre.ok);
		assert.equal(mestre.entries.length, 0);
	});
	it("baixar o aumento devolve o saldo, sem tirar o treino travado", () => {
		const entries = [E("crime", "train", "class", { locked: true }), E("crime", "raise", "manual")];
		const plan = planDegreeChange({ ...ctx, level: 7, entries, skill: "crime", newLabel: "trained" });
		assert.ok(plan.ok);
		assert.deepEqual(plan.entries.map((e) => e.kind), ["train"]);
	});
	it("baixar uma perícia manual até destreinada apaga a entrada (a vaga volta)", () => {
		const entries = [E("arts", "train", "manual")];
		const plan = planDegreeChange({ ...ctx, entries, skill: "arts", newLabel: "untrained" });
		assert.equal(plan.entries.length, 0);
		assert.equal(R(plan.entries, ctx).budget.train.used, 0);
	});
	it("mesmo grau não muda nada", () => {
		const entries = [E("arts")];
		assert.equal(planDegreeChange({ ...ctx, entries, skill: "arts", newLabel: "trained" }).entries, entries);
	});
});

describe("migração de ficha existente", () => {
	it("cada perícia treinada vira uma entrada; veterano/expert viram aumentos; o total não muda", () => {
		const degrees = { stealth: "trained", crime: "veteran", will: "expert", arts: "untrained" };
		const entries = buildLedger({ degrees });
		const r = R(entries);
		assert.deepEqual([r.degrees.stealth, r.degrees.crime, r.degrees.will, r.degrees.arts ?? 0], [1, 2, 3, 0]);
		assert.equal(entries.filter((e) => e.kind === "train").length, 3);
		assert.equal(entries.filter((e) => e.kind === "raise").length, 3);
	});
	it("as perícias que casam com a origem viram da origem e ficam travadas", () => {
		const entries = buildLedger({ degrees: { sciences: "trained", investigation: "trained", crime: "trained" }, originSkills: ["sciences", "investigation"], originLabel: "Acadêmico" });
		const r = R(entries, { hasOrigin: true });
		assert.deepEqual(r.skills.sciences.lockedBy, ["Acadêmico"]);
		assert.equal(r.skills.crime.lockedBy.length, 0);
		assert.equal(entries.filter((e) => e.source === "origin").length, 2);
	});
	it("nunca baixa grau e fichas sem treino geram livro-caixa vazio", () => {
		assert.deepEqual(buildLedger({ degrees: {} }), []);
		assert.deepEqual(buildLedger({ degrees: { crime: "master" } }).map((e) => e.kind), ["train", "raise", "raise"]);
	});
	it("chaves de perícia e de classe são todas conhecidas", () => {
		for (const cls of Object.values(CLASS_TRAINING)) for (const k of [...cls.groups.flat(), ...cls.fixed]) assert.ok(SKILL_KEYS.includes(k), k);
		for (const g of Object.values(TRAINING_GRANTS)) if (g.skill) assert.ok(SKILL_KEYS.includes(g.skill), g.skill);
		assert.equal(passiveKey("Estágio 2 - Esperto"), "esperto");
	});
});
