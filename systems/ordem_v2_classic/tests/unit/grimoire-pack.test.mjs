// Rodar: npm test. Pacote `rituals` (packs/_source/rituals): os 98 rituais da Biblioteca com as correções de extração do PDF.
// Spec: docs/arquivo/spec-grimorio-do-jogador.md (4.8). Auditoria: docs/auditoria-rituais-vs-livro.md. Correções: docs/correcoes-rituais-compendio.md.
// Ainda NÃO confere o registro em system.json (o pacote só entra no manifesto no passo seguinte, com reinício do servidor).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RITUAL_FUNCTIONS } from "../../module/helpers/grimoire-functions.mjs";
import { ritualTargets } from "../../module/macros/ritual-targeting.mjs";

const SYSTEM_DIR = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(SYSTEM_DIR, "packs/_source/rituals");
const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? walk(full) : full.endsWith(".json") ? [full] : [];
	});
const docs = walk(SRC).map((file) => ({ file, json: JSON.parse(fs.readFileSync(file, "utf8")) }));
const rituals = docs.filter((d) => d.json._key?.startsWith("!items!")).map((d) => d.json);
const folders = docs.filter((d) => d.json._key?.startsWith("!folders!")).map((d) => d.json);
const byName = Object.fromEntries(rituals.map((r) => [r.name, r]));
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const chatField = (chat, label) => new RegExp(`<strong>${label}:</strong>\\s*(.*?)\\s*(?:·|</p>)`).exec(chat)?.[1]?.trim() ?? null;

describe("pacote rituals: estrutura", () => {
	it("tem os 98 rituais, ids e nomes únicos", () => {
		assert.equal(rituals.length, 98);
		assert.equal(new Set(rituals.map((r) => r._id)).size, 98);
		assert.equal(new Set(rituals.map((r) => r.name)).size, 98);
		assert.ok(rituals.every((r) => r.type === "ritual" && /^[A-Za-z0-9]{16}$/.test(r._id)));
	});

	it("elemento entre os 5 reais, círculo de 1 a 4 e na pasta do próprio círculo", () => {
		const elementos = new Set(["blood", "death", "knowledge", "energy", "fear"]);
		const pastas = Object.fromEntries(folders.map((f) => [f._id, f.name]));
		assert.equal(folders.length, 4);
		for (const r of rituals) {
			assert.ok(elementos.has(r.system.element), `${r.name}: elemento ${r.system.element}`);
			assert.ok([1, 2, 3, 4].includes(r.system.circle), `${r.name}: círculo ${r.system.circle}`);
			assert.equal(pastas[r.folder], `${r.system.circle}º Círculo`, `${r.name}: pasta`);
		}
	});

	it("todo ritual tem imagem que existe no repositório do sistema", () => {
		for (const r of rituals) {
			const m = /^systems\/ordem_v2_classic\/(assets\/rituais\/[^/]+\.png)$/.exec(r.img);
			assert.ok(m, `${r.name}: img fora de assets/rituais (${r.img})`);
			assert.ok(fs.existsSync(path.join(SYSTEM_DIR, m[1])), `${r.name}: arquivo ausente ${m[1]}`);
		}
	});

	it("os nomes batem com a tabela de funções (sem sobra nem falta)", () => {
		assert.deepEqual(rituals.map((r) => r.name).sort(), Object.keys(RITUAL_FUNCTIONS).sort());
	});

	it("permissão neutra (sem dono de outro mundo) e sem id de usuário na fonte", () => {
		for (const r of rituals) {
			assert.deepEqual(r.ownership, { default: 0 }, r.name);
			assert.equal(r._stats.systemId, "ordem_v2_classic");
		}
	});
});

describe("pacote rituals: qualidade dos textos (erros de extração do PDF não voltam)", () => {
	it("a descrição não está vazia nem começa com sobra de cabeçalho ou fragmento", () => {
		for (const r of rituals) {
			const d = plain(r.system.description);
			assert.ok(d.length > 80, `${r.name}: descrição curta (${d.length})`);
			assert.ok(!/^[a-zà-ú(“"]/.test(d), `${r.name}: começa com fragmento "${d.slice(0, 30)}"`);
			assert.ok(!/^(Efeito|Área|Alvos?|Execução|Alcance|Duração|Resistência)\s*:/.test(d), `${r.name}: começa com campo de cabeçalho`);
		}
	});

	it("sem HTML escapado, sem caractere de substituição e sem aspas fechando solta", () => {
		for (const r of rituals) {
			for (const [campo, valor] of [["descrição", r.system.description], ["chat", r.system.chatDescription], ["alvo", r.system.target], ["área", r.system.area.name]]) {
				assert.ok(!/&lt;|&gt;|&amp;/.test(valor), `${r.name}: ${campo} com HTML escapado`);
				assert.ok(!valor.includes("�"), `${r.name}: ${campo} com caractere inválido`);
			}
			assert.ok(!/[”"]/.test(r.system.target.replace(/“[^”]*”/g, "")), `${r.name}: alvo com aspas soltas (${r.system.target})`);
			assert.ok(!/[”"]/.test(r.system.area.name.replace(/“[^”]*”/g, "")), `${r.name}: área com aspas soltas (${r.system.area.name})`);
			assert.ok(!/ e (o dano|a resistência) para /.test(r.system.area.name), `${r.name}: área com texto de outra forma`);
		}
	});

	it("o campo target e o Alvo do cabeçalho do chat dizem o mesmo", () => {
		for (const r of rituals) {
			const chat = chatField(r.system.chatDescription, "Alvo");
			if (!chat || !r.system.target) continue;
			assert.equal(norm(chat), norm(r.system.target), `${r.name}: chat "${chat}" x target "${r.system.target}"`);
		}
	});

	it("o chat não carrega pedaço da descrição na resistência", () => {
		for (const r of rituals) {
			const res = chatField(r.system.chatDescription, "Resistência") ?? "";
			assert.ok(res.length <= 60, `${r.name}: resistência longa demais no chat (${res.slice(0, 40)}…)`);
		}
	});
});

describe("pacote rituals: os três casos que motivaram a auditoria (livro p. 128 e p. 143)", () => {
	it("Controle Mental: tem o parágrafo básico antes de Discente e Verdadeiro", () => {
		const d = plain(byName["Controle Mental"].system.description);
		assert.ok(d.startsWith("Você domina a mente do alvo"));
		assert.ok(d.includes("exceto ordens suicidas") && d.includes("apenas uma vez por cena"));
		assert.ok(d.indexOf("Discente") > d.indexOf("suicidas"));
		assert.ok(!chatField(byName["Controle Mental"].system.chatDescription, "Resistência").includes("Você domina"));
	});

	it("Vidência: sem o texto do Vínculo de Sangue e com o quadro de bônus e penalidades", () => {
		const r = byName["Vidência"].system;
		const d = plain(r.description);
		assert.ok(d.includes("TV desligada") && d.includes("em seu teste de resistência."));
		assert.ok(!d.includes("símbolo de Sangue") && !d.includes("Fortitude"));
		for (const linha of ["mínimo sobre o alvo: +10", "já o viu pessoalmente: +5", "conhece bem o alvo: –0", "roupa do alvo: –5", "cabelos…): –10"]) assert.ok(d.includes(linha), linha);
		assert.equal(r.skillResis, "will");
		assert.equal(r.resistance, "nullifies");
	});

	it("Vínculo de Sangue: 1 ser, Fortitude anula e a descrição completa", () => {
		const r = byName["Vínculo de Sangue"].system;
		assert.equal(r.element, "blood");
		assert.equal(r.circle, 4);
		assert.equal(r.target, "1 ser");
		assert.equal(r.skillResis, "resilience");
		assert.equal(r.resistance, "nullifies");
		const d = plain(r.description);
		assert.ok(d.includes("símbolo de Sangue") && d.includes("metade restante") && d.includes("efeito inverso") && d.includes("Alvos voluntários"));
		assert.equal(chatField(r.chatDescription, "Resistência"), "Fortitude anula");
	});

	it("Zerar Entropia: 1 pessoa, Vontade parcial (os campos que o Vínculo tinha por engano)", () => {
		const r = byName["Zerar Entropia"].system;
		assert.equal(r.target, "1 pessoa");
		assert.equal(r.skillResis, "will");
		assert.equal(r.resistance, "partial");
	});
});

// O campo `target` é lido por ritualTargets (ritual-targeting.mjs) para decidir tipo e quantidade de alvos.
// Esta tabela é o efeito, já calculado, de cada correção de `target` (docs/correcoes-rituais-compendio.md).
describe("pacote rituals: efeito das correções de target no fluxo de conjuração", () => {
	const ESPERADO = {
		"Alterar Destino": ["self", 0],
		"Forma Monstruosa": ["self", 0],
		"Overclock": ["self", 0],
		"Terceiro Olho": ["self", 0],
		"Âncora Temporal": ["creature", 1],
		"Lâmina do Medo": ["creature", 1],
		"Coincidência Forçada": ["creature", 1],
		"Descarnar": ["creature", 1],
		"Desacelerar Impacto": ["creature", 1],
		"Vínculo de Sangue": ["creature", 1],
		"Zerar Entropia": ["creature", 1],
		"Invadir Mente": ["creature", 2],
		"Amaldiçoar Arma": ["object", 1],
		"Amaldiçoar Tecnologia": ["object", 1],
		"Dissonância Acústica": ["area", null],
	};
	for (const [nome, [kind, max]] of Object.entries(ESPERADO)) {
		it(`${nome}: ${kind}${max === null ? " (sem limite)" : ` / ${max}`}`, () => {
			const t = ritualTargets({ system: byName[nome].system });
			assert.equal(t.kind, kind);
			assert.equal(t.max, max);
		});
	}

	it("os rituais de \"Efeito\" do livro mantêm target \"Veja texto\" (fluxo inalterado) e mostram o valor na área", () => {
		const efeitos = { "Fim Inevitável": "buraco negro com 1,5m de diâmetro", "Invólucro de Carne": "1 clone seu", "Nuvem de Cinzas": "nuvem com 6m de raio e 6m de altura", "Tecer Ilusão": "ilusão que se estende a até 4 cubos de 1,5m", "Vomitar Pestes": "1 enxame Grande (quadrado de 3m)" };
		for (const [nome, valor] of Object.entries(efeitos)) {
			assert.equal(norm(byName[nome].system.target), "veja texto", nome);
			assert.equal(byName[nome].system.area.name, valor, nome);
			assert.equal(ritualTargets({ system: byName[nome].system }).kind, "unknown", nome);
		}
	});
});

describe("registro do pacote rituals em system.json (4.8)", async () => {
	const { readFileSync } = await import("node:fs");
	const manifest = JSON.parse(readFileSync(new URL("../../system.json", import.meta.url), "utf8"));
	it("está registrado como Item, com jogadores como Observador", () => {
		const pack = manifest.packs.find((p) => p.name === "rituals");
		assert.ok(pack);
		assert.equal(pack.type, "Item");
		assert.equal(pack.path, "packs/rituals");
		assert.equal(pack.ownership?.PLAYER, "OBSERVER");
	});
	it("aparece numa pasta de pacotes", () => {
		const inFolder = (folder) => folder.packs?.includes("rituals") || (folder.folders ?? []).some(inFolder);
		assert.ok(manifest.packFolders.some(inFolder));
	});
});
