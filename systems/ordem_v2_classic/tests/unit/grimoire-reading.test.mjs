// Rodar: npm test. Leitura do Grimório: faixa de dados do ritual (GR-64), formas Básico/Discente/Verdadeiro (GR-18),
// regra curta e blocos da condição (GR-27, GR-67).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { conditionBlocks, ritualFactCells, ritualForms, shortConditionRule } from "../../module/helpers/grimoire-reading.mjs";

const base = { cost: 3, circle: 2, facts: {}, execution: "default", range: "medium", duration: "instantaneous", skillResis: "resilience", resistance: "reducesByHalf", target: "Veja descrição da área", areaName: "esfera com 6m de raio" };
const chave = (cells) => Object.fromEntries(cells.map((c) => [c.key, c.value]));

describe("faixa de dados do ritual", () => {
	it("usa os campos do item quando não há cabeçalho, com rótulos em português", () => {
		assert.deepEqual(chave(ritualFactCells(base)), { execution: "Padrão", range: "Médio", target: "Esfera com 6m de raio", duration: "Instantânea", resistance: "Fortitude reduz à metade", cost: "3 PE" });
	});
	it("prefere o cabeçalho do livro", () => {
		const e = { ...base, facts: { execution: "padrão", range: "curto", target: "1 ser", duration: "5 rodadas", resistance: "Vontade anula" }, target: "1 ser", areaName: "" };
		assert.deepEqual(chave(ritualFactCells(e)), { execution: "Padrão", range: "Curto", target: "1 ser", duration: "5 rodadas", resistance: "Vontade anula", cost: "3 PE" });
	});
	it("célula sem dado some (sem traço) e \"Veja texto\" sem área some", () => {
		const e = { ...base, skillResis: "", resistance: "", facts: { resistance: "—", target: "Veja texto" }, target: "Veja texto", areaName: "" };
		const k = ritualFactCells(e).map((c) => c.key);
		assert.ok(!k.includes("resistance") && !k.includes("target"));
		assert.ok(ritualFactCells(e).every((c) => c.value && c.value !== "—"));
	});
	it("o custo usa PD quando a mesa joga sem Sanidade", () => {
		assert.equal(chave(ritualFactCells(base, { resource: "PD" })).cost, "3 PD");
	});
});

describe("formas do ritual", () => {
	const html = "<p>O ritual cria uma implosão de 6d6 de dano. Discente (+3 PE): muda a área para uma esfera de 1,5 m. Requer 3º círculo. Verdadeiro (+7 PE): muda o dano para 13d6. Requer afinidade com Morte.</p>";
	it("separa o básico do Discente e do Verdadeiro, com o custo total", () => {
		const f = ritualForms(html, 2);
		assert.equal(f.basic.text, "O ritual cria uma implosão de 6d6 de dano.");
		assert.equal(f.basic.cost, 3);
		assert.equal(f.student.cost, 6);
		assert.equal(f.student.requiredCircle, 3);
		assert.match(f.student.text, /esfera de 1,5 m/);
		assert.equal(f.true.cost, 10);
		assert.equal(f.true.requiredAffinity, "Morte");
	});
	it("tira o marcador de lista que sobra no fim do trecho (descrições vindas de uma lista)", () => {
		const f = ritualForms("<p>Texto do básico. - Discente (+2 PE): alcance longo. - Verdadeiro (+5 PE): como o Discente. -</p>", 1);
		assert.equal(f.basic.text, "Texto do básico.");
		assert.equal(f.student.text, "alcance longo.");
		assert.equal(f.true.text, "como o Discente.");
	});
	it("ritual sem formas devolve só o básico", () => {
		const f = ritualForms("<p>Só o texto básico.</p>", 1, { studentForm: false, trueForm: false });
		assert.equal(f.basic.text, "Só o texto básico.");
		assert.equal(f.student, null);
		assert.equal(f.true, null);
	});
	it("respeita studentForm/trueForm desligados mesmo com o texto presente", () => {
		const f = ritualForms(html, 2, { studentForm: false, trueForm: true });
		assert.equal(f.student, null);
		assert.ok(f.true);
	});
});

describe("condição", () => {
	it("regra curta: a do sistema, ou a primeira frase do livro", () => {
		assert.equal(shortConditionRule("<p>Texto longo. Outra frase.</p>", "−2 na Defesa."), "−2 na Defesa.");
		assert.equal(shortConditionRule("<p>Você fica sem ar. Perde 1d6 por turno.</p>"), "Você fica sem ar.");
		assert.ok(shortConditionRule(`<p>${"a".repeat(300)}</p>`, null, { max: 60 }).length <= 60);
	});
	it("tira o nome que abre o texto do livro e converte os dados (@DisplayDice) e links (@UUID)", () => {
		const html = '<p><span style="color:red">Abalado.</span> O personagem sofre @DisplayDice[qtd:1|sign:minus|dc:d20] em testes. Se ficar abalado novamente, fica @UUID[.abc]{Apavorado}.</p><blockquote><p>Apavorado. Outro texto.</p></blockquote>';
		assert.equal(shortConditionRule(html, null, { name: "Abalado" }), "O personagem sofre −1d20 em testes.");
		assert.equal(shortConditionRule(html, null), "Abalado.");
	});
	it("só vira bloco o que o texto tem, sem inventar subtítulos", () => {
		const b = conditionBlocks("<p>A criatura está assustada e perde o foco.</p><p>Penalidade em testes.</p>");
		assert.equal(b.length, 1);
		assert.equal(b[0].title, null);
		assert.match(b[0].text, /Penalidade em testes/);
	});
	it("reconhece blocos que o livro de fato traz", () => {
		const b = conditionBlocks("<p>Descrição: criatura abalada.</p><p>Efeitos: −1 em testes.</p><p>Como remover: descansar.</p>");
		assert.deepEqual(b.map((x) => x.title), ["Descrição", "Efeitos", "Como remover"]);
		assert.equal(b[1].text, "−1 em testes.");
	});
});
