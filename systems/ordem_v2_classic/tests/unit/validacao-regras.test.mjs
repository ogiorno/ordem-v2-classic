// Rodar: npm test. Valida o que foi implementado (efeitos de poderes passivos e perícias treinadas) contra o texto do livro em regras/,
// e não contra as expectativas escritas junto com o código.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PASSIVE_RULES, SKILL_KEYS, SKILL_NAMES, passiveKey, passiveRuleFor } from "../../module/helpers/passive-effects-rules.mjs";
import {
	CLASS_TRAINING, ORIGIN_TRAINING, eclecticOptions, originPlan, resolveTraining, trainingKey,
} from "../../module/helpers/skill-training-rules.mjs";
import { calculatePerRound, calculateSpaces, splitEffortBonuses } from "../../module/helpers/actor-calculations.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BOOK = path.join(ROOT, "../../regras");
// O texto dos livros (regras/) fica fora do git; sem ele (CI, clone novo) esta validação não tem contra o que conferir.
if (!fs.existsSync(BOOK)) {
	console.log("validacao-regras: pasta regras/ ausente, validação contra o livro ignorada");
	process.exit(0);
}
const book = (...p) => fs.readFileSync(path.join(BOOK, ...p), "utf8");
const MARKS = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", cedil: "̧", uml: "̈" };
const strip = (t) => String(t ?? "")
	.replace(/<[^>]+>/g, " ")
	.replace(/&([a-zA-Z])(acute|grave|circ|tilde|cedil|uml);/g, (_m, base, mark) => (base + MARKS[mark]).normalize("NFC"))
	.replace(/&ndash;/g, "–").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, " ")
	.replace(/\s+/g, " ");

const walk = (dir, out = []) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith(".json")) out.push(p);
	}
	return out;
};
const powers = walk(path.join(ROOT, "packs/_source")).filter((f) => !f.includes("threatAbilities")).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).filter((d) => d.type === "ability");

/** Texto do poder: o do compêndio, ou, onde ele só aponta para o livro (poderes paranormais), o do próprio livro em regras/. */
const paranormalBook = fs.readdirSync(path.join(BOOK, "06-o-outro-lado")).filter((f) => /^08[2-5]\d-/.test(f));
const textOf = (key) => {
	const own = powers.filter((p) => passiveKey(p.name) === key && p.system.activation === "passive").map((p) => strip(p.system.description)).join(" ");
	if (!/não é coberto pela licença/i.test(own)) return own;
	const file = paranormalBook.find((f) => passiveKey(f.replace(/^\d+-/, "").replace(/\.md$/, "")) === key);
	return file ? strip(book("06-o-outro-lado", file)) : own;
};
const keyOfSkillName = new Map(Object.entries(SKILL_NAMES).map(([k, v]) => [trainingKey(v), k]));
/** "Ciências e Investigação" → { skills: ["sciences","investigation"], professions: 0 }. */
function parseSkills(text) {
	const parts = text.split(/ e (?![^(]*\))/).map((s) => s.trim());
	const skills = [];
	let professions = 0;
	let free = 0;
	for (const part of parts) {
		if (/^profiss/i.test(part)) professions++;
		else if (/mais uma|escolha/i.test(part)) free++;
		else {
			const k = keyOfSkillName.get(trainingKey(part));
			assert.ok(k, `perícia desconhecida no livro: "${part}"`);
			skills.push(k);
		}
	}
	return { skills, professions, free };
}

/** Origens dos Arquivos Secretos: não estão na Tabela 1.1; o texto fica em regras/rascunhos/arquivos-secretos/origens. */
const ARQUIVOS_SECRETOS = ["cientista ex panacea", "cobaia sobrevivente", "seguranca ex panacea", "cacador de recompensas", "influencer paranormal", "ufologo", "funcionario de beira de estrada", "transtornado arrependido", "ferido por ritual", "exorcizado", "sensitivo rebelde"];

describe("origens: a tabela do livro é a tabela do código", () => {
	const rows = [];
	for (const line of book("02-criacao-de-personagem", "0130-tabela-1-1-origens.md").split("\n")) {
		const cols = line.trim().split(/\s{2,}/);
		if (cols.length === 4 && /^[\d-]+$/.test(cols[0])) rows.push({ name: cols[1], text: cols[2], source: "livro" });
	}
	const sah = book("11-sobrevivendo-ao-horror", "01-origens-e-opcoes-de-trilha.md");
	for (const line of sah.slice(sah.indexOf("TABELA1.1: NOVAS ORIGENS")).split("\n").slice(1, 60)) {
		const cols = line.trim().split(/\s{2,}/);
		if (cols.length === 3 && !/^Origem$/.test(cols[0]) && cols[0].length < 40 && cols[2].length < 40 && /^[A-ZÀ-Ú][^.]* e [A-ZÀ-Úa-zà-ú]/.test(cols[1]) && cols[1].length < 60) rows.push({ name: cols[0], text: cols[1], source: "sah" });
	}
	it("lê as 26 origens do Livro de Regras e as do Sobrevivendo ao Horror", () => {
		assert.equal(rows.filter((r) => r.source === "livro").length, 26);
		assert.ok(rows.filter((r) => r.source === "sah").length >= 14, `só ${rows.filter((r) => r.source === "sah").length} do SaH`);
	});
	it("cada origem do livro aplica exatamente as perícias da tabela", () => {
		for (const row of rows) {
			const plan = originPlan(row.name.replace(/^T\.I\.$/, "T.I."));
			assert.ok(plan, `${row.name} não está no código`);
			if (/mestre/i.test(row.text)) { assert.deepEqual([plan.choose, plan.gm], [2, 0], row.name); continue; }
			if (/mais uma/i.test(row.text)) { assert.deepEqual([originPlan(row.name).fixed, originPlan(row.name).choose], [["will"], 1]); continue; }
			const expected = parseSkills(row.text);
			assert.deepEqual([...plan.fixed].sort(), [...expected.skills].sort(), `${row.name}: perícias`);
			assert.equal(plan.professions.length, expected.professions, `${row.name}: Profissões`);
		}
	});
	it("Profissão com nome no livro (cozinheiro, engenheiro, psicólogo) vem fixa; sem nome o jogador escreve", () => {
		for (const row of rows) {
			const m = row.text.match(/Profissão \(([^)]+)\)/i);
			const plan = originPlan(row.name);
			if (m) assert.deepEqual(plan.professions, [m[1]], row.name);
			else if (/Profissão/i.test(row.text)) assert.deepEqual(plan.professions, [null], row.name);
		}
	});
	it("Profetizado: Vontade e mais uma à escolha", () => {
		const plan = originPlan("Profetizado");
		assert.deepEqual([plan.fixed, plan.choose], [["will"], 1]);
		assert.match(sah.replace(/\s+/g, " "), /Vontade e mais uma/);
	});
	it("nenhuma origem de código sobra sem estar no livro (fora Arquivos Secretos)", () => {
		const names = new Set(rows.map((r) => trainingKey(r.name)));
		for (const k of Object.keys(ORIGIN_TRAINING)) assert.ok(names.has(k) || k === "profetizado" || ARQUIVOS_SECRETOS.includes(k), `${k} não está nas tabelas do livro`);
	});
});

describe("classes: quantidades do livro", () => {
	const texts = { combatente: book("02-criacao-de-personagem", "0185-12.md"), especialista: book("02-criacao-de-personagem", "0225-16.md"), ocultista: book("02-criacao-de-personagem", "0265-20.md") };
	for (const [key, n] of [["combatente", 1], ["especialista", 7], ["ocultista", 3]]) {
		it(`${key}: "${n} + Intelecto" perícias à escolha`, () => {
			assert.match(texts[key].replace(/\s+/g, " "), new RegExp(`igual a ${n} \\+ Intelecto`));
			assert.equal(CLASS_TRAINING[key].free, n);
		});
	}
	it("Combatente: Luta ou Pontaria e Fortitude ou Reflexos; Ocultista: Ocultismo e Vontade; Especialista: nenhuma fixa", () => {
		// o texto do livro está em colunas entrelaçadas: confere cada metade da frase em separado
		const c = texts.combatente.replace(/\s+/g, " ");
		assert.match(c, /Luta ou Pontaria \(uma das duas\)/);
		assert.match(c, /Fortitude ou/);
		assert.match(c, /Reflexos \(uma das duas\)/);
		assert.deepEqual(CLASS_TRAINING.combatente.groups, [["fighting", "aim"], ["resilience", "reflexes"]]);
		assert.match(texts.ocultista.replace(/\s+/g, " "), /Ocultismo e\s+Vontade|Ocultismo e Vontade/);
		assert.deepEqual(CLASS_TRAINING.ocultista.fixed, ["occultism", "will"]);
		assert.deepEqual([CLASS_TRAINING.especialista.groups, CLASS_TRAINING.especialista.fixed], [[], []]);
	});
	it("Grau de Treinamento: 2 + Int, 5 + Int e 3 + Int, em NEX 35% e de novo em 70%", () => {
		for (const [key, file, n] of [["combatente", "0188-grau-de-treinamento.md", 2], ["especialista", "0228-grau-de-treinamento.md", 5], ["ocultista", "0268-grau-de-treinamento.md", 3]]) {
			const text = book("02-criacao-de-personagem", file);
			assert.match(text, new RegExp(`igual a ${n} \\+ Int`), key);
			assert.match(text, /NEX 35%, e novamente em NEX 70%/);
			assert.equal(CLASS_TRAINING[key].grade, n);
			// 35% = nível 7 e 70% = nível 14: o saldo dobra no segundo evento
			assert.equal(resolveTraining({ classKey: key, int: 2, level: 7 }).budget.raise.allowed, n + 2);
			assert.equal(resolveTraining({ classKey: key, int: 2, level: 14 }).budget.raise.allowed, 2 * (n + 2));
		}
	});
	it("Intelecto: uma perícia adicional por ponto e aumento de grau de uma perícia adicional nos NEX 35% e 70%", () => {
		assert.match(book("02-criacao-de-personagem", "0103-atributos.md").replace(/\s+/g, " "), /uma perícia adicional para cada ponto \(e também aumenta o grau de treinamento de uma perícia adicional nos NEX 35% e 70%\)/);
		const a = resolveTraining({ classKey: "especialista", int: 3, level: 14, hasOrigin: true }).budget;
		const b = resolveTraining({ classKey: "especialista", int: 4, level: 14, hasOrigin: true }).budget;
		assert.equal(b.train.allowed - a.train.allowed, 1);
		assert.equal(b.raise.allowed - a.raise.allowed, 2, "+1 aumento em cada um dos dois eventos");
	});
});

describe("Eclético e Engenhosidade: custos do livro", () => {
	it("Eclético: 2 PE para os benefícios de treinado", () => {
		assert.match(book("02-criacao-de-personagem", "0218-ecletico.md"), /gastar 2 PE para receber os benefícios de ser treinado/);
		assert.equal(eclecticOptions({ classKey: "especialista", level: 1, degreeIndex: 0 })[0].pe, 2);
	});
	it("Engenhosidade: NEX 40% +2 PE para veterano (total 4) e NEX 75% +4 PE para expert (total 6)", () => {
		assert.match(book("02-criacao-de-personagem", "0229-engenhosidade.md"), /Em NEX 40%.*2 PE adicionais.*veterano.*Em NEX 75%.*4 PE adicionais.*expert/s);
		const list = eclecticOptions({ classKey: "especialista", level: 15, degreeIndex: 0 });
		assert.deepEqual(list.map((o) => o.pe), [2, 2 + 2, 2 + 4]);
		// NEX 40% = nível 8 e NEX 75% = nível 15
		assert.deepEqual(eclecticOptions({ classKey: "especialista", level: 7, degreeIndex: 0 }).map((o) => o.degree), ["trained"]);
		assert.deepEqual(eclecticOptions({ classKey: "especialista", level: 8, degreeIndex: 0 }).map((o) => o.degree), ["trained", "veteran"]);
		assert.deepEqual(eclecticOptions({ classKey: "especialista", level: 14, degreeIndex: 0 }).map((o) => o.degree), ["trained", "veteran"]);
	});
});

describe("poderes passivos: o número do efeito aparece no texto do poder", () => {
	it("todo valor fixo de ficha está escrito no poder (+N)", () => {
		let conferidos = 0;
		for (const [key, rule] of Object.entries(PASSIVE_RULES)) {
			const text = textOf(key);
			assert.ok(text, `${key}: sem texto no compêndio`);
			for (const change of rule.changes) {
				if (typeof change.value !== "number") continue;
				const n = Math.abs(change.value);
				// "–1" (Ser Aterrorizante) e "+3m" contam
				assert.match(text, new RegExp(`[+–-]\\s?${n}(?![\\d])|\\b${n}\\b`), `${key}: ${change.key} = ${change.value} não está no texto`);
				conferidos++;
			}
		}
		assert.ok(conferidos >= 25, `só ${conferidos} valores conferidos`);
	});
	// o texto de Sangue de Ferro está cortado na extração ("+2 pon-"); o PDF (p. 116) diz "+2 pontos de vida por NEX ... NEX 50%, recebe 20 PV. NEX 55%, +2 PV"
	const CORTADO = ["sangue de ferro"];
	it("todo efeito por nível cita NEX ou nível no texto do poder", () => {
		for (const [key, rule] of Object.entries(PASSIVE_RULES)) {
			if (!rule.changes.some((c) => String(c.value).includes("@nivel")) || CORTADO.includes(key)) continue;
			assert.match(textOf(key), /5% de NEX|10% de NEX|NEX|nível/i, key);
		}
	});
	it("o valor de cada perícia/atributo do efeito é o que o texto nomeia", () => {
		const sk = (k) => SKILL_NAMES[k].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
		const plain = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
		for (const [key, rule] of Object.entries(PASSIVE_RULES)) {
			for (const c of rule.changes) {
				const m = c.key.match(/^system\.skills\.([a-zA-Z]+)\.mod$/);
				if (!m) continue;
				const text = plain(textOf(key));
				// "testes de resistência" = Fortitude, Reflexos e Vontade
				const ok = text.includes(sk(m[1])) || (["resilience", "reflexes", "will"].includes(m[1]) && /testes de resistencia/.test(text));
				assert.ok(ok, `${key}: o texto não cita ${SKILL_NAMES[m[1]]}`);
			}
		}
	});
	it("Dedicação: o limite de PE por turno do livro é o nível + 1 (NEX 5% = 2, NEX 10% = 3)", () => {
		assert.match(book("02-criacao-de-personagem", "0158-dedicacao.md"), /em NEX 5% seu limite é 2, em NEX 10% é 3/);
		const base = (nivel) => calculatePerRound(false, nivel, false).PE_perRound;
		assert.equal(base(1) + 1, 2);
		assert.equal(base(2) + 1, 3);
		assert.deepEqual(passiveRuleFor("Dedicação").changes.find((c) => c.key === "system.PE.perRoundBonus").value, 1);
	});
	it("Inventário Otimizado: Força 1 + Intelecto 3 = 20 espaços (exemplo do livro), e Força 0 também vale 5 × Int", () => {
		assert.match(textOf("inventario otimizado"), /Força 1 e Intelecto 3, seu invent.rio tem 20 espa.os/);
		const formula = passiveRuleFor("NEX 10% - Inventário Otimizado").changes[0].value;
		const bonus = (str, int) => Function(`"use strict"; return (${formula.replace(/@attributes\.int\.value/g, int).replace(/@attributes\.str\.value/g, str)});`)();
		assert.equal(calculateSpaces(0, 1, { max: bonus(1, 3) }).max, 20);
		assert.equal(calculateSpaces(0, 0, { max: bonus(0, 3) }).max, 15);
		assert.equal(calculateSpaces(0, 0, { max: bonus(0, 0) }).max, 2);
		assert.equal(calculateSpaces(0, 4, { max: bonus(4, 0) }).max, 20);
	});
	it("exemplos numéricos do livro: Sangue de Ferro (NEX 50% = 20 PV, 55% = +2) e Potencial Aprimorado (NEX 30% = 6 PE, 35% = +1)", () => {
		// nível = NEX / 5
		const valor = (name, nivel) => Function(`"use strict"; return (${String(passiveRuleFor(name).changes[0].value).replace(/@nivel\.value/g, nivel)});`)();
		assert.equal(valor("Sangue de Ferro", 10), 20);
		assert.equal(valor("Sangue de Ferro", 11) - valor("Sangue de Ferro", 10), 2);
		assert.equal(valor("Potencial Aprimorado", 6), 6);
		assert.equal(valor("Potencial Aprimorado", 7) - valor("Potencial Aprimorado", 6), 1);
		assert.match(textOf("potencial aprimorado"), /30%.*6 PE/);
	});
	it("\"Jogando sem Sanidade\": o PD substitui o PE, então o bônus de PE e o limite por turno dos poderes vão para o PD", () => {
		assert.deepEqual(splitEffortBonuses({ withoutSanity: true, peBonus: 3, perRoundBonus: 1 }), { PE: 0, PD: 3, perRoundPE: 0, perRoundPD: 1 });
		assert.deepEqual(splitEffortBonuses({ withoutSanity: false, peBonus: 3, perRoundBonus: 1 }), { PE: 3, PD: 0, perRoundPE: 1, perRoundPD: 0 });
		assert.deepEqual(splitEffortBonuses({ withoutSanity: true, peBonus: 2, pdBonus: 4 }).PD, 6, "soma com o bônus manual de PD");
		assert.deepEqual(splitEffortBonuses({}), { PE: 0, PD: 0, perRoundPE: 0, perRoundPD: 0 });
		const code = fs.readFileSync(path.join(ROOT, "module/documents/actor.mjs"), "utf8");
		assert.match(code, /splitEffortBonuses\(\{ withoutSanity, peBonus, pdBonus \}\)/);
		assert.match(code, /this\.system\.PD\.perRound \+= perRound\.perRoundPD/);
	});
});
