// Rodar: npm test. Confere a tela de recompensa de nível contra as tabelas 1.3–1.5 do Livro de Regras.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { featuresBetween, isLevelUp, isPossessedPath, levelFeatures, possessionGain, possessionPointsAt, visibleGains, costUnit, resourceGains, shouldShowLevelUp } from "../../module/helpers/level-up-rules.mjs";

const ids = (cls, level) => levelFeatures(cls, level).map((f) => f.id);

describe("recompensas por nível", () => {
	it("trilha chega nos níveis 2, 8, 13 e 20 para todas as classes", () => {
		for (const cls of ["Combatente", "Especialista", "Ocultista"]) {
			for (const lvl of [2, 8, 13, 20]) assert.ok(ids(cls, lvl).includes("pathAbility"), `${cls} ${lvl}`);
			assert.ok(!ids(cls, 3).includes("pathAbility"));
		}
	});
	it("aumento de atributo em NEX 20/50/80/95 (níveis 4, 10, 16, 19)", () => {
		for (const lvl of [4, 10, 16, 19]) assert.ok(ids("Combatente", lvl).includes("attributeIncrease"));
		assert.ok(!ids("Combatente", 5).includes("attributeIncrease"));
	});
	it("grau de treinamento em 7 e 14; versatilidade em 10", () => {
		assert.ok(ids("Ocultista", 7).includes("trainingDegree") && ids("Ocultista", 14).includes("trainingDegree"));
		assert.ok(ids("Especialista", 10).includes("versatility"));
	});
	it("poder de classe em 3, 6, 9, 12, 15 e 18 com o nome da classe certa", () => {
		for (const lvl of [3, 6, 9, 12, 15, 18]) {
			assert.ok(ids("Combatente", lvl).includes("combatentePower"));
			assert.ok(ids("Especialista", lvl).includes("especialistaPower"));
			assert.ok(ids("Ocultista", lvl).includes("ocultistaPower"));
		}
	});
	it("combatente: ataque especial escala +5/+10/+15/+20 com 2–5 PE", () => {
		const get = (lvl) => levelFeatures("Combatente", lvl).find((f) => f.id === "specialAttack")?.params;
		assert.deepEqual(get(1), { pe: 2, bonus: 5 });
		assert.deepEqual(get(5), { pe: 3, bonus: 10 });
		assert.deepEqual(get(11), { pe: 4, bonus: 15 });
		assert.deepEqual(get(17), { pe: 5, bonus: 20 });
		assert.equal(get(2), undefined);
	});
	it("especialista: perito escala; engenhosidade em 8 (veterano) e 15 (expert, junto do poder)", () => {
		const dice = [1, 5, 11, 17].map((l) => levelFeatures("Especialista", l).find((f) => f.id === "expert").params.die);
		assert.deepEqual(dice, ["1d6", "1d8", "1d10", "1d12"]);
		assert.equal(levelFeatures("Especialista", 8).find((f) => f.id === "ingenuity").params.degree, "veterano");
		assert.deepEqual(ids("Especialista", 15).sort(), ["especialistaPower", "ingenuity"]);
	});
	it("ocultista: círculos de ritual em 1, 5, 11 e 17", () => {
		const circles = [1, 5, 11, 17].map((l) => levelFeatures("Ocultista", l).find((f) => f.id === "chosenByOtherSide").params.circle);
		assert.deepEqual(circles, [1, 2, 3, 4]);
	});
	it("classe fora do livro (Sobrevivente) não recebe benefícios de classe", () => {
		assert.deepEqual(levelFeatures("Sobrevivente", 4), []);
	});
	it("nome da classe ignora caixa", () => {
		assert.ok(ids("COMBATENTE", 4).includes("attributeIncrease"));
	});
	it("featuresBetween soma vários níveis e ignora o nível de partida", () => {
		assert.deepEqual(featuresBetween("Combatente", 1, 4).map((x) => x.level), [2, 3, 4]);
		assert.deepEqual(featuresBetween("Combatente", 4, 4), []);
		assert.deepEqual(featuresBetween("Combatente", 5, 4), []);
	});
	it("escolhas pendentes são marcadas", () => {
		assert.equal(levelFeatures("Combatente", 4).find((f) => f.id === "attributeIncrease").choice, true);
		assert.ok(!levelFeatures("Combatente", 2).find((f) => f.id === "pathAbility").choice);
	});
});

describe("ganhos de recurso e quem vê a tela", () => {
	it("mostra só o que subiu", () => {
		const g = resourceGains({ PV: 20, PE: 4, PD: 0, SAN: 12 }, { PV: 24, PE: 8, PD: 0, SAN: 15 });
		assert.deepEqual(g.map((x) => [x.key, x.gain]), [["PV", 4], ["PE", 4], ["SAN", 3]]);
		assert.deepEqual(resourceGains({ PV: 20 }, { PV: 20 }), []);
	});
	it("PD aparece quando o jogo é sem Sanidade", () => {
		assert.deepEqual(resourceGains({ PD: 6 }, { PD: 9 }).map((x) => x.key), ["PD"]);
	});
	it("só subir de nível dispara", () => {
		assert.equal(isLevelUp(1, 2), true);
		assert.equal(isLevelUp(2, 2), false);
		assert.equal(isLevelUp(3, 2), false);
		assert.equal(isLevelUp(undefined, 2), false);
	});
	it("jogador dono vê; não dono não; Mestre só se subiu sozinho", () => {
		assert.equal(shouldShowLevelUp({ isGM: false, isOwner: true, isUpdater: false, activePlayerOwners: 1 }), true);
		assert.equal(shouldShowLevelUp({ isGM: false, isOwner: false, isUpdater: false, activePlayerOwners: 1 }), false);
		assert.equal(shouldShowLevelUp({ isGM: true, isOwner: true, isUpdater: true, activePlayerOwners: 1 }), false);
		assert.equal(shouldShowLevelUp({ isGM: true, isOwner: true, isUpdater: true, activePlayerOwners: 0 }), true);
		assert.equal(shouldShowLevelUp({ isGM: true, isOwner: true, isUpdater: false, activePlayerOwners: 0 }), false);
	});
});

describe("pontos de possessão (trilha Possuído)", () => {
	it("reconhece a trilha pelo nome", () => {
		assert.equal(isPossessedPath("Possuído"), true);
		assert.equal(isPossessedPath("Conduíte"), false);
	});
	it("PP: 0 antes do NEX 10%, 3 no nível 2, +2 a cada poder Transcender", () => {
		assert.equal(possessionPointsAt(1), 0);
		assert.equal(possessionPointsAt(2), 3);
		assert.equal(possessionPointsAt(3), 5);
		assert.equal(possessionPointsAt(5), 5);
		assert.equal(possessionPointsAt(6), 7);
		assert.equal(possessionPointsAt(20), 15);
	});
	it("ganho de PP só quando sobe", () => {
		assert.deepEqual(possessionGain(1, 2), { key: "PP", before: 0, after: 3, gain: 3 });
		assert.deepEqual(possessionGain(2, 3), { key: "PP", before: 3, after: 5, gain: 2 });
		assert.equal(possessionGain(3, 5), null);
	});
	it("o poder de ocultista vira Transcender no Possuído, e só nele", () => {
		assert.deepEqual(levelFeatures("Ocultista", 3, { possessed: true }).map((f) => f.id), ["transcender"]);
		assert.deepEqual(levelFeatures("Ocultista", 3).map((f) => f.id), ["ocultistaPower"]);
		assert.deepEqual(levelFeatures("Combatente", 3, { possessed: true }).map((f) => f.id), ["combatentePower"]);
	});
});

describe("jogando sem Sanidade", () => {
	const gains = [{ key: "PV" }, { key: "PE" }, { key: "PD" }, { key: "SAN" }, { key: "PP" }];
	it("sem Sanidade some SAN (e PE); com Sanidade some PD", () => {
		assert.deepEqual(visibleGains(gains, true).map((g) => g.key), ["PV", "PD", "PP"]);
		assert.deepEqual(visibleGains(gains, false).map((g) => g.key), ["PV", "PE", "SAN", "PP"]);
	});
	it("custo das habilidades em PD sem Sanidade", () => {
		assert.equal(costUnit(true), "PD");
		assert.equal(costUnit(false), "PE");
	});
});
