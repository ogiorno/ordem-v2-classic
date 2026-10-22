// Rodar: npm test. Cicatrizes Psicológicas nos dois modos: +1 SAN por 5% de NEX (regras básicas) e +1 dado em Vontade contra medo (sem Sanidade).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fearDieAvailable, fearDieBonus, hasScars } from "../../module/helpers/scars.mjs";
import { passiveRuleFor } from "../../module/helpers/passive-effects-rules.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const names = ["Cicatrizes Psicológicas", "Patrulha"];

describe("o livro", () => {
	const FICHA = path.join(ROOT, "../../regras/02-criacao-de-personagem/FICHA-DE-AGENTE-ATUALIZADA.md");
	// regras/ (texto dos livros) fica fora do git: sem ela o teste é ignorado.
	it("Jogando sem Sanidade: Cicatrizes Psicológicas dá um dado adicional em Vontade contra efeitos de medo", { skip: !fs.existsSync(FICHA) && "pasta regras/ ausente" }, () => {
		const ficha = fs.readFileSync(path.join(ROOT, "../../regras/02-criacao-de-personagem/FICHA-DE-AGENTE-ATUALIZADA.md"), "utf8").replace(/\s+/g, " ");
		assert.match(ficha, /Cicatrizes Psicológicas\*\* também muda: concede um dado adicional em Vontade contra efeitos de medo, incluindo Presença Perturbadora e dano mental de criaturas de Medo/);
		assert.match(ficha, /PD substitui PE e Sanidade/);
		assert.match(ficha, /Os demais efeitos ligados a PE passam a valer para PD/);
	});
	it("regras básicas: +1 de Sanidade para cada 5% de NEX (o efeito de ficha continua)", () => {
		assert.equal(passiveRuleFor("Cicatrizes Psicológicas").changes[0].key, "system.SAN.bonus");
		assert.equal(passiveRuleFor("Cicatrizes Psicológicas").changes[0].value, "@nivel.value");
	});
});

describe("o dado extra contra medo", () => {
	it("só em Vontade, só sem Sanidade e só com o poder", () => {
		assert.equal(fearDieAvailable({ withoutSanity: true, names, skill: "will" }), true);
		assert.equal(fearDieAvailable({ withoutSanity: false, names, skill: "will" }), false, "com Sanidade vale o +SAN");
		assert.equal(fearDieAvailable({ withoutSanity: true, names, skill: "resilience" }), false);
		assert.equal(fearDieAvailable({ withoutSanity: true, names, skill: "reflexes" }), false);
		assert.equal(fearDieAvailable({ withoutSanity: true, names: ["Patrulha"], skill: "will" }), false);
		assert.equal(fearDieAvailable({}), false);
	});
	it("o dado só entra quando o jogador marca que o efeito é de medo", () => {
		assert.equal(fearDieBonus({ marked: true, withoutSanity: true, names, skill: "will" }), 1);
		assert.equal(fearDieBonus({ marked: false, withoutSanity: true, names, skill: "will" }), 0);
		assert.equal(fearDieBonus({ marked: true, withoutSanity: false, names, skill: "will" }), 0);
		assert.equal(fearDieBonus({ marked: true, withoutSanity: true, names, skill: "crime" }), 0);
	});
	it("reconhece o poder com ou sem acento e prefixo", () => {
		assert.equal(hasScars(["Cicatrizes Psicologicas"]), true);
		assert.equal(hasScars(["cicatrizes psicológicas"]), true);
		assert.equal(hasScars(["Calejado"]), false);
		assert.equal(hasScars([]), false);
	});
	it("a rolagem e a janela de teste usam a opção", () => {
		assert.match(read("module/documents/actor.mjs"), /fearDieBonus\(\{ marked: Boolean\(formData\?\.get\("fear"\)\)/);
		assert.match(read("module/documents/actor.mjs"), /conditionDicePenalty\(this, process\.skill\) - focus - fear/);
		assert.match(read("module/applications/skill-tool-configuration-dialog.mjs"), /name: "fear"/);
	});
});
