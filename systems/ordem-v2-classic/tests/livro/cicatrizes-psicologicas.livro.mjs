// Rodar: npm run test:livro (precisa da pasta regras/ com o texto dos livros, que fica fora do git).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Cicatrizes Psicológicas no livro", () => {
	it("Jogando sem Sanidade: Cicatrizes Psicológicas dá um dado adicional em Vontade contra efeitos de medo", () => {
		const ficha = fs.readFileSync(path.join(ROOT, "../../regras/02-criacao-de-personagem/FICHA-DE-AGENTE-ATUALIZADA.md"), "utf8").replace(/\s+/g, " ");
		assert.match(ficha, /Cicatrizes Psicológicas\*\* também muda: concede um dado adicional em Vontade contra efeitos de medo, incluindo Presença Perturbadora e dano mental de criaturas de Medo/);
		assert.match(ficha, /PD substitui PE e Sanidade/);
		assert.match(ficha, /Os demais efeitos ligados a PE passam a valer para PD/);
	});
});
