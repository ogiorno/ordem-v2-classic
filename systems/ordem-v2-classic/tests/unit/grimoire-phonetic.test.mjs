// Rodar: npm test. Chave fonética do português (GR-63): pares que devem e que NÃO devem ter a mesma chave.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { phoneticKey } from "../../module/helpers/grimoire-text.mjs";

const IGUAIS = [
	["cicatrização", "cicatrizassão"],
	["cicatrização", "sicatrizasao"],
	["hemofagia", "emofajia"],
	["hemofagia", "hemofajia"],
	["casa", "kasa"],
	["casa", "caza"],
	["chave", "xave"],
	["sangue", "sangui"],
	["paradoxo", "paradoxu"],
	["carro", "caro"], // letras dobradas viram uma
	["passo", "paso"],
	["quente", "kente"],
	["gente", "jente"],
	["hora", "ora"],
	["sensível", "cencivel"],
	["exceção", "esseção"],
	["alma", "alma"],
	["nação", "nassam"],
	["yoga", "ioga"],
];

const DIFERENTES = [
	["luz", "lua"],
	["morte", "morto"],
	["medo", "modo"],
	["sangue", "sangre"],
	["vinculo", "vinculo2"],
	["cena", "cana"],
	["pele", "pelo"],
	["alvo", "alvo2"],
	["ritual", "ritmo"],
	["fogo", "foco"],
];

describe("chave fonética", () => {
	for (const [a, b] of IGUAIS) {
		it(`${a} e ${b} soam iguais`, () => assert.equal(phoneticKey(a), phoneticKey(b)));
	}
	for (const [a, b] of DIFERENTES) {
		it(`${a} e ${b} NÃO soam iguais`, () => assert.notEqual(phoneticKey(a), phoneticKey(b)));
	}
	it("trata vazio e símbolo", () => {
		assert.equal(phoneticKey(""), "");
		assert.equal(phoneticKey(null), "");
		assert.equal(phoneticKey("!!"), "");
	});
	it("é estável (mesma entrada, mesma chave)", () => {
		assert.equal(phoneticKey("Conhecimento"), phoneticKey("conhecimento"));
	});
});
