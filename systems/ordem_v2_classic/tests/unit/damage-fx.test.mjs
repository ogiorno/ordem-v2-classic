// Rodar: npm test. Regras da animação de dano nas criaturas (docs/spec-animacao-dano-criaturas.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	ELEMENTS, TIERS, PROFILES, TIER_SPECS, BLOCK_PROFILE, MAX_FLASHES_PER_SECOND, MAX_RECOIL_CELLS, MAX_SIMULTANEOUS,
	resolveElement, damageTier, shouldPlay, pickMotion, budget, rankFullEffects, staggerDelay, visibleBadges, recoilVector, buildReaction,
} from "../../module/helpers/damage-fx-rules.mjs";

describe("DF-02 elemento primário", () => {
	it("usa elements.main", () => assert.equal(resolveElement({ main: "blood", others: "death" }), "blood"));
	it("aceita o nome em português", () => assert.equal(resolveElement({ main: "Conhecimento" }), "knowledge"));
	it("vazio cai no primeiro reconhecido de others", () => assert.equal(resolveElement({ main: "", others: "xyz, Medo, morte" }), "fear"));
	it("desconhecido ou ausente vira neutral", () => {
		assert.equal(resolveElement({ main: "", others: "" }), "neutral");
		assert.equal(resolveElement({ main: "fogo" }), "neutral");
		assert.equal(resolveElement(undefined), "neutral");
	});
});

describe("DF-03/DF-04 faixas", () => {
	it("cortes de 10/25/50% do PV máximo", () => {
		assert.equal(damageTier({ lost: 9, max: 100 }), "leve");
		assert.equal(damageTier({ lost: 10, max: 100 }), "media");
		assert.equal(damageTier({ lost: 24, max: 100 }), "media");
		assert.equal(damageTier({ lost: 25, max: 100 }), "pesada");
		assert.equal(damageTier({ lost: 49, max: 100 }), "pesada");
		assert.equal(damageTier({ lost: 50, max: 100 }), "critica");
	});
	it("PV máximo 0 não quebra", () => {
		assert.equal(damageTier({ lost: 0, max: 0 }), "leve");
		assert.equal(damageTier({ lost: 5, max: 0 }), "critica");
	});
	it("vulnerabilidade e crítico sobem uma faixa cada, com teto em crítica", () => {
		assert.equal(damageTier({ lost: 5, max: 100, vulnerable: true }), "media");
		assert.equal(damageTier({ lost: 5, max: 100, crit: true }), "media");
		assert.equal(damageTier({ lost: 5, max: 100, vulnerable: true, crit: true }), "pesada");
		assert.equal(damageTier({ lost: 40, max: 100, vulnerable: true, crit: true }), "critica");
	});
});

describe("DF-01 quando tocar", () => {
	it("só em queda de PV ou bloqueio avisado", () => {
		assert.equal(shouldPlay({ before: 10, after: 7 }), true);
		assert.equal(shouldPlay({ before: 10, after: 10 }), false);
		assert.equal(shouldPlay({ before: 10, after: 15 }), false);
		assert.equal(shouldPlay({ before: 10, after: 10, blocked: true }), true);
		assert.equal(shouldPlay({}), false);
	});
});

describe("DF-05 bloqueio", () => {
	it("finalDamage 0 vira bloqueio mesmo sem mudar o PV", () => {
		const r = buildReaction({ element: "blood", before: 20, after: 20, max: 20, finalDamage: 0, blocked: 5 });
		assert.equal(r.kind, "block");
		assert.equal(r.shake, 0);
		assert.equal(r.tier, null);
		assert.equal(r.ring, "prateado");
	});
});

describe("DF-06/DF-07 Machucado e morte", () => {
	it("cruzar a metade marca crossedHurt; já machucado não repete", () => {
		assert.equal(buildReaction({ element: "blood", before: 12, after: 9, max: 20 }).crossedHurt, true);
		assert.equal(buildReaction({ element: "blood", before: 9, after: 6, max: 20 }).crossedHurt, false);
		assert.equal(buildReaction({ element: "blood", before: 15, after: 12, max: 20 }).crossedHurt, false);
	});
	it("0 PV marca kill e não crossedHurt", () => {
		const r = buildReaction({ element: "death", before: 5, after: 0, max: 20 });
		assert.equal(r.kill, true);
		assert.equal(r.crossedHurt, false);
		assert.ok(r.durationMs > TIER_SPECS.critica.ms);
	});
	it("golpe grande: tirou metade ou mais do PV que restava", () => {
		assert.equal(buildReaction({ element: "blood", before: 100, after: 40, max: 300 }).bigHit, true);
		assert.equal(buildReaction({ element: "blood", before: 100, after: 60, max: 300 }).bigHit, false);
	});
});

describe("DF-08/DF-09 perfis", () => {
	it("cada elemento tem movimento, cor e efeito próprios", () => {
		const keys = [...ELEMENTS, "neutral"];
		for (const field of ["motion", "color"]) {
			assert.equal(new Set(keys.map((k) => PROFILES[k][field])).size, keys.length, field);
		}
		const impacts = ELEMENTS.map((k) => PROFILES[k].impact.join("|"));
		assert.equal(new Set(impacts).size, ELEMENTS.length);
	});
	it("o tipo de dano só dá a cor da faísca; o perfil continua o do elemento", () => {
		const r = buildReaction({ element: "fear", before: 20, after: 15, max: 20, damageType: "fireDamage" });
		assert.equal(r.profile, PROFILES.fear);
		assert.equal(r.sparkColor, "#ff7a2e");
		assert.equal(buildReaction({ element: "fear", before: 20, after: 15, max: 20 }).sparkColor, null);
	});
	it("elemento desconhecido usa o perfil neutro", () => assert.equal(buildReaction({ element: "xyz", before: 5, after: 3, max: 10 }).profile, PROFILES.neutral));
});

describe("DF-12 e DF-14 movimento", () => {
	it("reduzir movimento ou sem orçamento vira só flash", () => {
		assert.equal(pickMotion({ reducedMotion: true }), "flat");
		assert.equal(pickMotion({ budgetLeft: 0 }), "flat");
		assert.equal(pickMotion({}), "full");
		assert.equal(buildReaction({ element: "blood", before: 20, after: 10, max: 20, reducedMotion: true }).motion, "flat");
	});
});

describe("DF-17 orçamento e escalonamento", () => {
	it("no máximo 6 simultâneas", () => {
		assert.equal(budget(0), MAX_SIMULTANEOUS);
		assert.equal(budget(4), 2);
		assert.equal(budget(9), 0);
	});
	it("só os 3 de maior dano ganham o efeito completo", () => {
		const set = rankFullEffects([5, 30, 10, 30, 1, 22]);
		assert.deepEqual([...set].sort(), [1, 3, 5]);
	});
	it("início escalonado em ~80 ms", () => {
		assert.equal(staggerDelay(0), 0);
		assert.equal(staggerDelay(3), 240);
	});
});

describe("DF-20 selos visíveis", () => {
	it("vulnerabilidade só para o Mestre; bloqueio e RD para todos", () => {
		assert.deepEqual(visibleBadges({ isGM: false, multiplier: 2 }), []);
		assert.deepEqual(visibleBadges({ isGM: true, multiplier: 2 }), ["vulnerable"]);
		assert.deepEqual(visibleBadges({ isGM: false, multiplier: 2, revealVulnerability: true }), ["vulnerable"]);
		assert.deepEqual(visibleBadges({ finalDamage: 0, blocked: 4 }), ["block"]);
		assert.deepEqual(visibleBadges({ finalDamage: 3, blocked: 4 }), ["resist"]);
	});
});

describe("DF-21 recuo direcional", () => {
	const tokenPos = { x: 500, y: 500 };
	it("vai para longe de quem atacou", () => {
		const v = recoilVector({ attackerPos: { x: 300, y: 500 }, tokenPos, tier: "pesada", gridSize: 100 });
		assert.ok(v.x > 0);
		assert.equal(Math.round(v.y), 0);
	});
	it("sem atacante usa o centro da área; sem nenhum, não recua", () => {
		const radial = recoilVector({ areaCenter: { x: 500, y: 700 }, tokenPos, tier: "critica", gridSize: 100 });
		assert.ok(radial.y < 0);
		assert.deepEqual(recoilVector({ tokenPos, tier: "critica" }), { x: 0, y: 0 });
	});
	it("nunca passa de 0,25 casa, nem em intensidade dramática", () => {
		const v = recoilVector({ attackerPos: { x: 0, y: 0 }, tokenPos: { x: 300, y: 400 }, tier: "critica", gridSize: 200, move: 5 });
		assert.ok(Math.hypot(v.x, v.y) <= MAX_RECOIL_CELLS * 200 + 1e-9);
	});
	it("faixas leve e média não recuam, só vibram", () => {
		assert.deepEqual(recoilVector({ attackerPos: { x: 0, y: 0 }, tokenPos, tier: "media" }), { x: 0, y: 0 });
	});
	it("mesma posição não gera NaN", () => assert.deepEqual(recoilVector({ attackerPos: tokenPos, tokenPos, tier: "critica" }), { x: 0, y: 0 }));
});

describe("DF-22 segurança contra flashes", () => {
	it("nenhum perfil passa de 3 clarões por segundo", () => {
		for (const profile of [...Object.values(PROFILES), BLOCK_PROFILE]) assert.ok(profile.flashHz <= MAX_FLASHES_PER_SECOND, profile.label);
	});
	it("o brilho de Energia não é branco puro", () => assert.notEqual(PROFILES.energy.color.toLowerCase(), "#ffffff"));
});

describe("DF-24 durações", () => {
	it("leve ≤ 500, média ≤ 700, pesada ≤ 900; só crítica passa de 1 s", () => {
		assert.ok(TIER_SPECS.leve.ms <= 500);
		assert.ok(TIER_SPECS.media.ms <= 700);
		assert.ok(TIER_SPECS.pesada.ms <= 900);
		assert.ok(TIER_SPECS.critica.ms > 1000);
		assert.deepEqual(Object.keys(TIER_SPECS), [...TIERS]);
	});
	it("intensidade sutil encurta e dramática alonga", () => {
		const base = { element: "blood", before: 20, after: 18, max: 20 };
		assert.ok(buildReaction({ ...base, intensity: "sutil" }).durationMs < buildReaction({ ...base }).durationMs);
		assert.ok(buildReaction({ ...base, intensity: "dramatica" }).durationMs > buildReaction({ ...base }).durationMs);
	});
});
