// Rodar: npm test. Costura do Grimório (Fase 3): links @Condicao/@Ritual (GR-44), cartão da condição (GR-43), "Veja também" (GR-41).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { conditionNoticeContent, conditionRuleLine, findByName, grimoireLinkHtml, noticeConditionNames, parseEnricher, seeAlso, splitConditionMentions } from "../../module/helpers/grimoire-links.mjs";
import { searchFields } from "../../module/helpers/grimoire-text.mjs";

const entry = (kind, name, text = "") => ({ kind, uuid: `u.${kind}.${name}`, name, ...searchFields(name, text) });
const index = [
	entry("condition", "Abalado", "O personagem sofre -1d20 em testes. Se ficar abalado de novo, fica Apavorado."),
	entry("condition", "Apavorado", "Fugir. Veja Abalado."),
	entry("condition", "Cego", "Não enxerga."),
	entry("power", "Presença Aterradora", "Inimigos que falharem ficam Abalado por uma cena."),
	entry("ritual", "Paradoxo", "Dano de Morte."),
];

describe("link do Grimório", () => {
	it("abre na aba certa e escapa o nome", () => {
		const html = grimoireLinkHtml({ kind: "ritual", name: 'A"<b>' });
		assert.match(html, /data-grimoire-tab="ritual"/);
		assert.ok(!html.includes("<b>"));
		assert.match(html, /class="op-gr-link"/);
	});
	it("usa o texto próprio quando há, senão o nome", () => {
		assert.match(grimoireLinkHtml({ kind: "condition", name: "Abalado", label: "assustado" }), /assustado<\/a>/);
		assert.match(grimoireLinkHtml({ kind: "condition", name: "Abalado" }), /Abalado<\/a>/);
	});
	it("tipo desconhecido cai em condição", () => {
		assert.match(grimoireLinkHtml({ kind: "xyz", name: "A" }), /data-grimoire-tab="condition"/);
	});
});

describe("enricher @Condicao / @Ritual", () => {
	it("lê nome e texto opcional; vazio não vira link", () => {
		assert.deepEqual(parseEnricher("condition", " Abalado ", null), { kind: "condition", name: "Abalado", label: null });
		assert.deepEqual(parseEnricher("ritual", "Paradoxo", " o ritual "), { kind: "ritual", name: "Paradoxo", label: "o ritual" });
		assert.equal(parseEnricher("ritual", "   "), null);
	});
	it("acha a entrada sem acento nem maiúscula", () => {
		assert.equal(findByName(index, "ritual", "PARADOXO").name, "Paradoxo");
		assert.equal(findByName(index, "condition", "abalado").name, "Abalado");
		assert.equal(findByName(index, "power", "abalado"), null);
	});
});

describe("cartão da condição (GR-43)", () => {
	it("traz o nome do agente, o link e a regra de uma linha quando o sistema tem", () => {
		const html = conditionNoticeContent("Caio", "Atordoado");
		assert.match(html, /Caio<\/strong> recebe a condição/);
		assert.match(html, /data-grimoire-name="Atordoado"/);
		assert.match(html, /−5 na Defesa/);
	});
	it("sem regra do sistema, sem linha de regra", () => {
		assert.equal(conditionRuleLine("Abalado"), "");
		assert.ok(!conditionNoticeContent("Caio", "Abalado").includes("op-gr-notice-rule"));
	});
	it("escapa o nome do agente", () => {
		assert.ok(!conditionNoticeContent("<img>", "Abalado").includes("<img>"));
	});
	it("reconhece a condição pelo status oficial ou pelo nome do efeito", () => {
		assert.deepEqual(noticeConditionNames({ name: "Efeito qualquer", statuses: ["bleeding"] }), ["Sangrando"]);
		assert.deepEqual(noticeConditionNames({ name: "Enjoado (rodada 2)", statuses: [] }), ["Enjoado"]);
		assert.deepEqual(noticeConditionNames({ name: "Bênção", statuses: [] }), []);
		assert.deepEqual(noticeConditionNames({ name: "Abalado", statuses: [], disabled: true }), []);
	});
});

describe("Veja também (GR-41)", () => {
	it("poder cita condições pelo nome inteiro", () => {
		assert.deepEqual(seeAlso(index[3], index).map((e) => e.name), ["Abalado"]);
	});
	it("condição lista as que cita e, depois, quem a cita", () => {
		assert.deepEqual(seeAlso(index[0], index).map((e) => e.name), ["Apavorado", "Presença Aterradora"]);
	});
	it("não lista o próprio item nem repete", () => {
		assert.ok(!seeAlso(index[1], index).some((e) => e.name === "Apavorado"));
	});
	it("não casa pedaço de palavra e respeita o limite", () => {
		const longo = entry("power", "X", "Fica cegonha e abaladoiro.");
		assert.deepEqual(seeAlso(longo, index), []);
		assert.equal(seeAlso(index[0], index, { limit: 1 }).length, 1);
	});
	it("entrada vazia devolve lista vazia", () => {
		assert.deepEqual(seeAlso(null, index), []);
	});
});

describe("aba Perícias (GR-42)", async () => {
	const { readFileSync } = await import("node:fs");
	const { NON_SKILL_PAGES, skillEntry } = await import("../../module/helpers/grimoire-index.mjs");
	const journal = JSON.parse(readFileSync(new URL("../../packs/_source/bookrules/per-cias.json", import.meta.url), "utf8"));
	const skills = journal.pages.filter((p) => !NON_SKILL_PAGES.includes(p.name) && p.text?.content).map((p) => skillEntry({ uuid: `x.${p.name}`, name: p.name, text: p.text }));
	it("todas as perícias do livro entram, sem as páginas de introdução e a tabela", () => {
		const names = skills.map((s) => s.name);
		for (const n of ["Acrobacia", "Ocultismo", "Vontade", "Tecnologia"]) assert.ok(names.includes(n), n);
		for (const n of NON_SKILL_PAGES) assert.ok(!names.includes(n), n);
		assert.equal(skills.length, 28);
	});
	it("cada perícia tem tipo, resumo e texto para a busca", () => {
		for (const s of skills) {
			assert.equal(s.kind, "skill");
			assert.ok(s.summary.length > 20 && s.textNorm.length > 20, s.name);
		}
	});
});

describe("menções a condições no texto (cartões do chat)", () => {
	const conds = (t) => splitConditionMentions(t).filter((p) => p.condition).map((p) => p.condition);
	it("acha a condição solta, sem diferenciar maiúscula", () => {
		assert.deepEqual(conds("Vulnerável"), ["Vulnerável"]);
		assert.deepEqual(conds("ficou cego e Em Chamas"), ["Cego", "Em Chamas"]);
	});
	it("mantém a grafia original e o texto ao redor", () => {
		const parts = splitConditionMentions("fica abalado agora");
		assert.deepEqual(parts, [{ text: "fica " }, { text: "abalado", condition: "Abalado" }, { text: " agora" }]);
	});
	it("não pega pedaço de palavra", () => {
		assert.deepEqual(conds("Cegonha, desabalado, vulnerabilidade"), []);
	});
	it("vulnerabilidade a dano não é a condição", () => {
		assert.deepEqual(conds("Vulnerável a sangue"), []);
		assert.deepEqual(conds("Vulnerável · Cego"), ["Vulnerável", "Cego"]);
	});
	it("sem menção devolve o texto inteiro", () => {
		assert.deepEqual(splitConditionMentions("só texto"), [{ text: "só texto" }]);
	});
});
