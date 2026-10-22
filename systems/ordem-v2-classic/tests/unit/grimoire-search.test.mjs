// Rodar: npm test. Busca do Grimório (GR-14, GR-63): normalização, "E" entre palavras, nome pesa mais que texto,
// tolerância a erro de digitação e "Você quis dizer". Spec 5.4 e 5.5.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { didYouMean, editDistance, matchWord, MATCH, normalizeText, phoneticKey, searchEntries, searchFields, sharedStem, toleranceFor, tokenize } from "../../module/helpers/grimoire-text.mjs";

const mk = (name, text = "", extra = {}) => ({ uuid: `u.${name}`, name, ...searchFields(name, text), ...extra });
const NOMES = ["Paradoxo", "Cicatrização", "Teletransporte", "Esfolar", "Hemofagia", "Armadura de Sangue", "Vínculo de Sangue", "Conhecimento Aplicado", "Luz", "Eco Espiral", "Abalado", "Atordoado", "Sangrando", "Medo Tangível", "Presença do Medo", "Decadência", "Controle Mental", "Invólucro de Carne"];
const ENTRADAS = NOMES.map((n) => mk(n, `texto de ${n} com dano de Morte e teste de Vontade`));
const nomes = (res) => res.results.map((r) => r.entry.name);

describe("normalização", () => {
	it("tira acento, maiúscula e pontuação", () => {
		assert.equal(normalizeText("Cicatrização"), "cicatrizacao");
		assert.equal(normalizeText("  Âncora-Temporal!  "), "ancora temporal");
		assert.deepEqual(tokenize("Vínculo de Sangue"), ["vinculo", "de", "sangue"]);
		assert.equal(normalizeText(null), "");
	});
});

describe("busca exata", () => {
	it("sem acento e sem maiúscula acha o nome", () => {
		assert.deepEqual(nomes(searchEntries(ENTRADAS, "cicatrizacao")), ["Cicatrização"]);
		assert.deepEqual(nomes(searchEntries(ENTRADAS, "PARADOXO")), ["Paradoxo"]);
	});
	it("prefixo e trecho do nome", () => {
		assert.ok(nomes(searchEntries(ENTRADAS, "cicat")).includes("Cicatrização"));
		assert.ok(nomes(searchEntries(ENTRADAS, "transporte")).includes("Teletransporte"));
	});
	it("cada palavra precisa casar (E) e a ordem não importa", () => {
		assert.deepEqual(nomes(searchEntries(ENTRADAS, "sangue vinculo")), ["Vínculo de Sangue"]);
		assert.deepEqual(nomes(searchEntries(ENTRADAS, "sangue armadura")), ["Armadura de Sangue"]);
		assert.deepEqual(nomes(searchEntries(ENTRADAS, "sangue paradoxo")), []);
	});
	it("o nome vem antes do texto da descrição", () => {
		const ent = [mk("Zeta", "fala de sangue e de outras coisas"), mk("Sangue Frio", "texto qualquer")];
		assert.deepEqual(nomes(searchEntries(ent, "sangue")), ["Sangue Frio", "Zeta"]);
	});
	it("o texto da descrição casa por trecho exato", () => {
		const ent = [mk("Eco", "causa dano de Conhecimento no alvo")];
		assert.equal(searchEntries(ent, "conhecimento").results.length, 1);
	});
	it("busca vazia devolve tudo, sem aproximação", () => {
		const r = searchEntries(ENTRADAS, "   ");
		assert.equal(r.results.length, ENTRADAS.length);
		assert.equal(r.approximate, false);
	});
});

describe("distância de edição", () => {
	it("inserir, apagar, trocar e inverter letras vizinhas valem 1", () => {
		assert.equal(editDistance("sangue", "sangu"), 1);
		assert.equal(editDistance("sangue", "sagnue"), 1);
		assert.equal(editDistance("abalado", "abalodo"), 1);
		assert.equal(editDistance("paradoxo", "paradocso"), 2);
		assert.equal(editDistance("luz", "lua"), 1);
	});
	it("para ao passar do limite", () => {
		assert.equal(editDistance("abcdefgh", "zzzzzzzz", 2), 3);
	});
	it("tolerância pelo tamanho da palavra", () => {
		assert.deepEqual([1, 3, 4, 7, 8, 12].map(toleranceFor), [0, 0, 1, 1, 2, 2]);
	});
	it("radical comum", () => {
		assert.equal(sharedStem("cicatrizar", "cicatrizacao"), true);
		assert.equal(sharedStem("teletransportar", "teletransporte"), true);
		assert.equal(sharedStem("sangue", "sangrando"), false); // só 4 letras iguais
	});
});

describe("tolerância a erro de digitação (GR-63)", () => {
	const achou = (q, nome) => assert.ok(nomes(searchEntries(ENTRADAS, q)).includes(nome), `"${q}" deveria achar ${nome}`);
	it("acha o que o jogador quis digitar", () => {
		achou("paradocso", "Paradoxo");
		achou("sagnue", "Armadura de Sangue");
		achou("abalodo", "Abalado");
		achou("conhecimeto", "Conhecimento Aplicado");
		achou("cicatrizar", "Cicatrização");
		achou("hemofajia", "Hemofagia");
		achou("cicatrizassao", "Cicatrização");
		achou("teletranspote", "Teletransporte");
		achou("esfollar", "Esfolar");
		achou("atordodo", "Atordoado");
	});
	it("o aproximado vem marcado e só quando há poucos exatos", () => {
		const r = searchEntries(ENTRADAS, "paradxoo");
		assert.equal(r.approximate, true);
		assert.equal(r.onlyApproximate, true);
		assert.equal(r.results[0].entry.name, "Paradoxo");
		assert.equal(r.results[0].approx, true);
	});
	it("aproximado nunca passa na frente de exato", () => {
		const ent = [mk("Sangrenta"), mk("Sangue Frio"), mk("Sagnue Falso")];
		const r = searchEntries(ent, "sangue", { minExact: 5 });
		const i = r.results.findIndex((x) => x.entry.name === "Sangue Frio");
		const j = r.results.findIndex((x) => x.entry.name === "Sagnue Falso");
		assert.ok(i >= 0 && (j < 0 || i < j));
	});
	it("com 5 ou mais exatos não entra aproximado", () => {
		const ent = ["Medo A", "Medo B", "Medo C", "Medo D", "Medo E", "Modo Falso"].map((n) => mk(n));
		const r = searchEntries(ent, "medo");
		assert.equal(r.approximate, false);
		assert.ok(!nomes(r).includes("Modo Falso"));
	});
	it("falsos positivos: palavras curtas só exatas, números sem tolerância", () => {
		const ent = [mk("Luz"), mk("Lua"), mk("Medo"), mk("Modo")];
		assert.deepEqual(nomes(searchEntries(ent, "luz")), ["Luz"]);
		assert.deepEqual(nomes(searchEntries(ent, "lux")), []);
		assert.ok(!nomes(searchEntries([mk("Nível 3"), mk("Nível 4")], "nivel 5")).length);
	});
	it("o texto da descrição não é aproximado", () => {
		const ent = [mk("Eco", "causa dano de conhecimento no alvo")];
		assert.equal(searchEntries(ent, "conhecimeto").results.length, 0);
	});
	it("várias palavras: cada uma pode ser tolerante", () => {
		const r = searchEntries(ENTRADAS, "vinculo sagnue");
		assert.deepEqual(nomes(r), ["Vínculo de Sangue"]);
	});
	it("\"Você quis dizer\" devolve até 3 nomes quando nada casa", () => {
		const r = searchEntries(ENTRADAS, "paradxxo");
		assert.ok(r.suggestions.length <= 3);
		assert.equal(didYouMean(ENTRADAS, "paradxxo")[0].name, "Paradoxo");
		assert.deepEqual(didYouMean(ENTRADAS, "zz"), []);
	});
	it("não mexe nos exatos: 'morte' continua achando só o que tem morte", () => {
		const ent = [mk("Morte Súbita"), mk("Morto Vivo"), mk("Marte")];
		assert.deepEqual(nomes(searchEntries(ent, "morte", { minExact: 1 })), ["Morte Súbita"]);
	});
	it("busca correta em 600 entradas", () => {
		const grande = Array.from({ length: 600 }, (_, i) => mk(`Ritual de Teste Numero ${i} Qualquer`, "texto longo ".repeat(40)));
		assert.deepEqual(nomes(searchEntries(grande, "numero 599")), ["Ritual de Teste Numero 599 Qualquer"]);
	});
});

describe("matchWord", () => {
	it("camadas", () => {
		assert.equal(matchWord("paradoxo", "paradoxo"), MATCH.EXACT);
		assert.equal(matchWord("para", "paradoxo"), MATCH.PREFIX);
		assert.equal(matchWord("dox", "paradoxo"), MATCH.CONTAINS);
		assert.equal(matchWord("sagnue", "sangue", { fuzzy: false }), null);
		assert.equal(matchWord("sagnue", "sangue", { fuzzy: true }), MATCH.EDIT1);
		assert.equal(matchWord("kasa", "casa", { fuzzy: true }), MATCH.PHONETIC);
	});
	it("chave fonética usada na camada 4", () => {
		assert.equal(phoneticKey("kasa"), phoneticKey("casa"));
	});
});
