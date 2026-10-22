// Rodar: npm test  (node --test). Sem Foundry: só lógica pura de module/helpers/threat-calc.mjs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	SIZE_INFO,
	sizeInfo,
	formatTest,
	testFormula,
	bruisedThreshold,
	isBruised,
	squaresFromMeters,
	movementLabel,
	resolveDamage,
	fastHealingAmount,
	groupPresenceFormula,
	presenceTargetResult,
	summarizeResistances,
	fixLegacySkillAttrs,
	formatTestHtml,
	totalBonus,
	signed,
	SKILL_DEFAULT_ATTR,
} from "../../module/helpers/threat-calc.mjs";

describe("formatTest (notação xO+y do livro)", () => {
	it("reproduz os exemplos do livro", () => {
		assert.equal(formatTest(3, 10), "3O+10"); // Fortitude da aberração de carne
		assert.equal(formatTest(1, 0), "O"); // Reflexos/Vontade
		assert.equal(formatTest(1, 5), "O+5"); // Percepção
		assert.equal(formatTest(2, 15), "2O+15");
		assert.equal(formatTest(4, 20), "4O+20"); // socão do enpap-X
	});
	it("trata dados < 1 como 1 e bônus negativo", () => {
		assert.equal(formatTest(0, 5), "O+5");
		assert.equal(formatTest(2, -3), "2O-3");
	});
	it("aceita lixo sem quebrar", () => {
		assert.equal(formatTest(undefined, undefined), "O");
		assert.equal(formatTest("3", "10"), "3O+10");
		assert.equal(formatTest(NaN, NaN), "O");
	});
});

describe("testFormula (fórmula Foundry)", () => {
	it("usa o maior resultado e soma o bônus", () => {
		assert.equal(testFormula(3, 10), "3d20kh + 10");
		assert.equal(testFormula(1, 0), "1d20kh");
		assert.equal(testFormula(2, -2), "2d20kh - 2");
	});
	it("atributo 0 rola 2d20 e fica com o pior (regra do sistema)", () => {
		assert.equal(testFormula(0, 5), "2d20kl + 5");
	});
});

describe("PV machucado", () => {
	it("é metade dos PV, arredondada para baixo", () => {
		assert.equal(bruisedThreshold(70), 35);
		assert.equal(bruisedThreshold(25), 12);
		assert.equal(bruisedThreshold(8), 4);
		assert.equal(bruisedThreshold(0), 0);
		assert.equal(bruisedThreshold(-4), 0);
	});
	it("isBruised só vale com PV > 0 e <= metade", () => {
		assert.equal(isBruised(36, 70), false);
		assert.equal(isBruised(35, 70), true);
		assert.equal(isBruised(1, 70), true);
		assert.equal(isBruised(0, 70), false);
	});
});

describe("deslocamento", () => {
	it("converte metros em quadrados de 1,5m", () => {
		assert.equal(squaresFromMeters(9), 6);
		assert.equal(squaresFromMeters(12), 8);
		assert.equal(squaresFromMeters(0), 0);
		assert.equal(squaresFromMeters(-3), 0);
		assert.equal(squaresFromMeters("abc"), 0);
	});
	it("monta o rótulo do livro", () => {
		assert.equal(movementLabel(9), "9m | 6");
		assert.equal(movementLabel(12), "12m | 8");
		assert.equal(movementLabel(4.5), "4.5m | 3");
	});
});

describe("tamanho (Tabela 7.1)", () => {
	it("tem as seis categorias com os valores do livro", () => {
		assert.deepEqual(Object.keys(SIZE_INFO), ["tiny", "small", "medium", "large", "huge", "colossal"]);
		assert.deepEqual(sizeInfo("tiny"), { stealth: 5, maneuvers: -5, space: 1.5 });
		assert.deepEqual(sizeInfo("small"), { stealth: 2, maneuvers: -2, space: 1.5 });
		assert.deepEqual(sizeInfo("large"), { stealth: -2, maneuvers: 2, space: 3 });
		assert.deepEqual(sizeInfo("huge"), { stealth: -5, maneuvers: 5, space: 4.5 });
		assert.deepEqual(sizeInfo("colossal"), { stealth: -10, maneuvers: 10, space: 9 });
	});
	it("desconhecido ou vazio vira médio", () => {
		assert.deepEqual(sizeInfo(""), SIZE_INFO.medium);
		assert.deepEqual(sizeInfo(undefined), SIZE_INFO.medium);
		assert.deepEqual(sizeInfo("gigante"), SIZE_INFO.medium);
	});
});

describe("resolveDamage", () => {
	const aberracao = {
		resistances: {
			ballisticDamage: { value: 5 },
			impactDamage: { value: 5 },
			piercingDamage: { value: 5 },
			bloodDamage: { value: 10 },
			deathDamage: { vulnerable: true },
		},
	};
	it("aplica RD por tipo", () => {
		assert.equal(resolveDamage(8, "impactDamage", aberracao).finalDamage, 3);
		assert.equal(resolveDamage(8, "bloodDamage", aberracao).finalDamage, 0);
		assert.equal(resolveDamage(8, "cuttingDamage", aberracao).finalDamage, 8);
	});
	it("RD nunca deixa o dano negativo", () => {
		const r = resolveDamage(3, "impactDamage", aberracao);
		assert.equal(r.finalDamage, 0);
		assert.equal(r.blocked, 3);
	});
	it("vulnerabilidade dobra o dano do tipo", () => {
		const r = resolveDamage(15, "deathDamage", aberracao);
		assert.equal(r.finalDamage, 30);
		assert.equal(r.multiplier, 2);
	});
	it("imunidade zera o dano", () => {
		const r = resolveDamage(40, "fireDamage", { resistances: { fireDamage: { immune: true } } });
		assert.equal(r.finalDamage, 0);
		assert.equal(r.immune, true);
	});
	it("RD geral com exceção: 'RD 10/Morte' ignora 10 de tudo, menos Morte", () => {
		const defs = { genericRd: { value: 10, except: ["deathDamage"] } };
		assert.equal(resolveDamage(25, "impactDamage", defs).finalDamage, 15);
		assert.equal(resolveDamage(25, "bloodDamage", defs).finalDamage, 15);
		assert.equal(resolveDamage(25, "deathDamage", defs).finalDamage, 25);
	});
	it("RD geral vale para dano sem tipo, e a maior entre tipada e geral prevalece", () => {
		const defs = { genericRd: { value: 4, except: [] }, resistances: { impactDamage: { value: 7 } } };
		assert.equal(resolveDamage(10, undefined, defs).finalDamage, 6);
		assert.equal(resolveDamage(10, "impactDamage", defs).finalDamage, 3); // 7 > 4, não soma
		assert.equal(resolveDamage(10, "cuttingDamage", defs).finalDamage, 6);
	});
	it("ignoreRd e extraRd", () => {
		assert.equal(resolveDamage(10, "impactDamage", { ...aberracao, ignoreRd: true }).finalDamage, 10);
		assert.equal(resolveDamage(10, "cuttingDamage", { extraRd: 3 }).finalDamage, 7);
		assert.equal(resolveDamage(10, "impactDamage", { ...aberracao, extraRd: 2 }).finalDamage, 3);
	});
	it("imunidade ganha da vulnerabilidade e dano inválido vira 0", () => {
		assert.equal(resolveDamage(10, "x", { resistances: { x: { immune: true, vulnerable: true } } }).finalDamage, 0);
		assert.equal(resolveDamage(NaN, "impactDamage", aberracao).finalDamage, 0);
		assert.equal(resolveDamage(-5, "impactDamage", aberracao).finalDamage, 0);
	});
});

describe("fastHealingAmount (Cura Acelerada)", () => {
	it("cura o valor, limitado ao que falta", () => {
		assert.equal(fastHealingAmount({ value: 5 }, null, 10, 70), 5);
		assert.equal(fastHealingAmount({ value: 5 }, null, 68, 70), 2);
		assert.equal(fastHealingAmount({ value: 5 }, null, 70, 70), 0);
	});
	it("não cura se o último dano foi de tipo em exceção", () => {
		const fh = { value: 10, except: ["chemicalDamage"] };
		assert.equal(fastHealingAmount(fh, "chemicalDamage", 10, 70), 0);
		assert.equal(fastHealingAmount(fh, "impactDamage", 10, 70), 10);
		assert.equal(fastHealingAmount(fh, null, 10, 70), 10);
	});
	it("sem valor não cura", () => {
		assert.equal(fastHealingAmount({}, null, 1, 70), 0);
		assert.equal(fastHealingAmount(undefined, null, 1, 70), 0);
	});
});

describe("groupPresenceFormula", () => {
	it("soma +1d6 por criatura adicional", () => {
		assert.equal(groupPresenceFormula("3d6", 0), "3d6");
		assert.equal(groupPresenceFormula("3d6", 2), "3d6 + 2d6");
		assert.equal(groupPresenceFormula("", 0), "");
		assert.equal(groupPresenceFormula("", 3), "3d6");
		assert.equal(groupPresenceFormula("4d6", -1), "4d6");
	});
});

describe("presenceTargetResult", () => {
	it("NEX no limite ou acima é imune", () => {
		assert.deepEqual(presenceTargetResult({ nex: 50, immuneNex: 50, total: 1, dt: 20, damage: 10 }), { mode: "immune", amount: 0 });
		assert.deepEqual(presenceTargetResult({ nex: 99, immuneNex: 50, damage: 10 }), { mode: "immune", amount: 0 });
	});
	it("sem limite de NEX ninguém é imune", () => {
		assert.equal(presenceTargetResult({ nex: 99, immuneNex: 0, damage: 10 }).mode, "full");
	});
	it("passar na Vontade (total ≥ DT) reduz à metade, arredondando para baixo", () => {
		assert.deepEqual(presenceTargetResult({ nex: 5, immuneNex: 50, total: 20, dt: 20, damage: 11 }), { mode: "half", amount: 5 });
	});
	it("falhar ou não rolar leva o dano inteiro", () => {
		assert.deepEqual(presenceTargetResult({ nex: 5, immuneNex: 50, total: 19, dt: 20, damage: 11 }), { mode: "full", amount: 11 });
		assert.deepEqual(presenceTargetResult({ nex: 5, immuneNex: 50, total: null, dt: 20, damage: 11 }), { mode: "full", amount: 11 });
	});
});

describe("summarizeResistances", () => {
	it("extrai RD, vulnerabilidades e imunidades", () => {
		const s = summarizeResistances({
			impactDamage: { value: 5, vulnerable: false, immune: false },
			deathDamage: { value: 0, vulnerable: true },
			fireDamage: { value: 0, immune: true },
			coldDamage: { value: 0 },
		});
		assert.deepEqual(s.rd, [{ type: "impactDamage", value: 5 }]);
		assert.deepEqual(s.vulnerable, ["deathDamage"]);
		assert.deepEqual(s.immune, ["fireDamage"]);
	});
	it("aguenta entrada vazia", () => {
		assert.deepEqual(summarizeResistances(undefined), { rd: [], vulnerable: [], immune: [] });
	});
});

describe("fixLegacySkillAttrs (ameaças antigas com attr ['dex'] em tudo)", () => {
	const defaults = { fighting: "str", aim: "dex", resilience: "vit", reflexes: "dex", will: "pre", initiative: "dex", perception: "pre" };
	it("restaura o atributo do livro onde o padrão errado ['dex'] ficou", () => {
		const skills = { resilience: { attr: ["dex"] }, will: { attr: ["dex"] }, perception: { attr: ["dex"] }, reflexes: { attr: ["dex"] } };
		const fixed = fixLegacySkillAttrs(skills, defaults);
		assert.deepEqual(fixed.sort(), ["perception", "resilience", "will"]);
		assert.deepEqual(skills.resilience.attr, ["vit"]);
		assert.deepEqual(skills.will.attr, ["pre"]);
		assert.deepEqual(skills.perception.attr, ["pre"]);
		assert.deepEqual(skills.reflexes.attr, ["dex"]); // padrão do livro já é dex
	});
	it("não toca em escolhas explícitas nem em dados estranhos", () => {
		const skills = { resilience: { attr: ["str"] }, will: { attr: ["pre", 1] }, perception: {}, fighting: { attr: [] }, x: { attr: ["dex"] } };
		assert.deepEqual(fixLegacySkillAttrs(skills, defaults), []);
		assert.deepEqual(skills.resilience.attr, ["str"]);
		assert.deepEqual(skills.will.attr, ["pre", 1]);
	});
	it("aguenta entrada vazia", () => {
		assert.deepEqual(fixLegacySkillAttrs(undefined, defaults), []);
		assert.deepEqual(fixLegacySkillAttrs({}, undefined), []);
	});
});

describe("formatTestHtml (ícone de d20 no lugar do O)", () => {
	const icon = '<i class="fa-solid fa-dice-d20 sb-d20" aria-label="d20"></i>';
	it("espelha formatTest trocando o O pelo ícone", () => {
		assert.equal(formatTestHtml(3, 10), `3${icon}+10`);
		assert.equal(formatTestHtml(1, 0), icon);
		assert.equal(formatTestHtml(1, 5), `${icon}+5`);
		assert.equal(formatTestHtml(2, -3), `2${icon}-3`);
	});
	it("nunca deixa HTML do usuário passar (só números)", () => {
		assert.equal(formatTestHtml("<script>", "<b>"), icon);
	});
});

describe("buff e perícias adicionáveis", () => {
	it("totalBonus soma base e buff (aceita negativos e lixo)", () => {
		assert.equal(totalBonus(10, 5), 15);
		assert.equal(totalBonus(10, -3), 7);
		assert.equal(totalBonus(undefined, "4"), 4);
		assert.equal(totalBonus(NaN, NaN), 0);
	});
	it("signed mostra o sinal", () => {
		assert.equal(signed(5), "+5");
		assert.equal(signed(-2), "-2");
		assert.equal(signed(0), "0");
		assert.equal(signed("x"), "0");
	});
	it("SKILL_DEFAULT_ATTR: Atletismo usa FOR; atributos válidos; congelado", () => {
		assert.equal(SKILL_DEFAULT_ATTR.athleticism, "str");
		assert.equal(SKILL_DEFAULT_ATTR.crime, "dex");
		assert.equal(SKILL_DEFAULT_ATTR.occultism, "int");
		assert.equal(SKILL_DEFAULT_ATTR.diplomacy, "pre");
		for (const attr of Object.values(SKILL_DEFAULT_ATTR)) assert.ok(["dex", "str", "int", "pre", "vit"].includes(attr), attr);
		assert.ok(Object.isFrozen(SKILL_DEFAULT_ATTR));
	});
	it("buff vira o bônus final do teste: 3 dados, base 10, buff +5 → 3O+15", () => {
		assert.equal(formatTest(3, totalBonus(10, 5)), "3O+15");
		assert.equal(testFormula(3, totalBonus(10, -4)), "3d20kh + 6");
	});
});
