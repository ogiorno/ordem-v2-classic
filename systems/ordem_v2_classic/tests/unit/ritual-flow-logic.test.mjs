import assert from "node:assert/strict";
import test from "node:test";
import { PROFILE } from "../../module/macros/ritual-profiles.mjs";
import {
	BUTTON_STATE, canEndRitual, canSwapTarget, cardTone, castButtonState, defaultTarget, needsSpendConfirm, needsTarget, summaryLine,
} from "../../module/macros/ritual-flow-logic.mjs";

test("FC-U4: alvo padrão do buff — sem token marcado vale o conjurador (e destaca que é padrão)", () => {
	const none = defaultTarget({ profile: PROFILE.ALLY, markedIds: [] });
	assert.deepEqual(none, { mode: "self", ids: [], byDefault: true });
	const marked = defaultTarget({ profile: PROFILE.ALLY, markedIds: ["a", "b"] });
	assert.equal(marked.mode, "marked");
	assert.equal(marked.byDefault, false);
	assert.deepEqual(marked.ids, ["a", "b"]);
});

test("FC-U4: alvo padrão do buff respeita a quantidade máxima do ritual", () => {
	assert.deepEqual(defaultTarget({ profile: PROFILE.ALLY, markedIds: ["a", "b", "c"], maxTargets: 1 }).ids, ["a"]);
	assert.equal(defaultTarget({ profile: PROFILE.ALLY, markedIds: ["a", "b", "c"], maxTargets: 5 }).ids.length, 3);
});

test("FC-U4: alvo hostil não tem padrão; área e pessoal têm modo próprio", () => {
	assert.deepEqual(defaultTarget({ profile: PROFILE.HOSTILE, markedIds: [] }), { mode: "none", ids: [], byDefault: false });
	assert.deepEqual(defaultTarget({ profile: PROFILE.HOSTILE, markedIds: ["z"] }).ids, ["z"]);
	assert.equal(defaultTarget({ profile: PROFILE.AREA }).mode, "area");
	assert.equal(defaultTarget({ profile: PROFILE.PERSONAL, markedIds: ["z"] }).mode, "self");
	assert.deepEqual(defaultTarget({ profile: PROFILE.PERSONAL, markedIds: ["z"] }).ids, [], "pessoal ignora token marcado");
	assert.equal(defaultTarget({ profile: PROFILE.MANUAL, markedIds: [] }).mode, "none");
});

test("FC-U4: só o perfil hostil exige escolher alvo antes de conjurar", () => {
	assert.equal(needsTarget(PROFILE.HOSTILE, { mode: "none", ids: [] }), true);
	assert.equal(needsTarget(PROFILE.HOSTILE, { mode: "marked", ids: ["z"] }), false);
	assert.equal(needsTarget(PROFILE.ALLY, { mode: "self", ids: [] }), false);
	assert.equal(needsTarget(PROFILE.MANUAL, { mode: "none", ids: [] }), false);
});

const ready = { profile: PROFILE.ALLY, cost: 1, pd: 3, target: { mode: "self", ids: [] } };

test("FC-U5: botão pronto mostra o custo final", () => {
	const state = castButtonState(ready);
	assert.equal(state.state, BUTTON_STATE.READY);
	assert.equal(state.enabled, true);
	assert.equal(state.label, "Conjurar (1 PD)");
});

test("FC-U5: PD insuficiente diz quantos faltam; custo exatamente igual ao saldo conjura", () => {
	const short = castButtonState({ ...ready, cost: 6, pd: 3 });
	assert.equal(short.state, BUTTON_STATE.NO_PD);
	assert.equal(short.label, "PD insuficiente (faltam 3)");
	assert.equal(short.enabled, false);
	assert.equal(castButtonState({ ...ready, cost: 3, pd: 3 }).enabled, true);
	assert.equal(castButtonState({ ...ready, cost: 1, pd: 0 }).label, "PD insuficiente (faltam 1)");
});

test("FC-U5: Silenciado bloqueia antes de qualquer outro motivo", () => {
	const state = castButtonState({ ...ready, silenced: true, cost: 10, pd: 0 });
	assert.equal(state.state, BUTTON_STATE.SILENCED);
	assert.equal(state.label, "Silenciado não pode conjurar");
});

test("FC-U5: sem alvo (hostil), sem variante, fora de alcance, sem arma e sem confirmar Medo", () => {
	const hostile = { profile: PROFILE.HOSTILE, cost: 1, pd: 5, target: { mode: "none", ids: [] } };
	assert.equal(castButtonState(hostile).label, "Escolha o alvo");
	assert.equal(castButtonState({ ...hostile, target: { mode: "marked", ids: ["z"] } }).enabled, true);
	assert.equal(castButtonState({ ...ready, variantRequired: true, variantChosen: false }).state, BUTTON_STATE.NEED_VARIANT);
	assert.equal(castButtonState({ ...ready, variantRequired: true, variantChosen: true }).enabled, true);
	const far = castButtonState({ ...hostile, target: { mode: "marked", ids: ["z"] }, targetProblems: ["Zumbi está fora do alcance (curto (9 m))."] });
	assert.equal(far.state, BUTTON_STATE.OUT_OF_RANGE);
	assert.match(far.reason, /Zumbi/);
	assert.equal(castButtonState({ ...ready, weaponRequired: true, weaponChosen: false }).state, BUTTON_STATE.NEED_WEAPON);
	assert.equal(castButtonState({ ...ready, fearRequired: true, fearConfirmed: false }).state, BUTTON_STATE.NEED_FEAR);
	assert.equal(castButtonState({ ...ready, fearRequired: true, fearConfirmed: true }).enabled, true);
});

test("FC-U5: custo inválido (círculo sem custo) bloqueia", () => {
	assert.equal(castButtonState({ ...ready, cost: null, validCost: false }).state, BUTTON_STATE.INVALID);
});

test("FC-U5: falta de PD vem antes de faltar alvo (o motivo mais barato de resolver aparece por último)", () => {
	const state = castButtonState({ profile: PROFILE.HOSTILE, cost: 6, pd: 1, target: { mode: "none", ids: [] } });
	assert.equal(state.state, BUTTON_STATE.NO_PD);
});

test("FC-11: a confirmação de gasto vale para pessoal e rápido de custo ≥ 1", () => {
	assert.equal(needsSpendConfirm({ profile: PROFILE.PERSONAL, cost: 1 }), true);
	assert.equal(needsSpendConfirm({ profile: PROFILE.ALLY, modifiers: ["RAP"], cost: 3 }), true);
	assert.equal(needsSpendConfirm({ profile: PROFILE.ALLY, cost: 1 }), false, "buff passa pelo cartão, que já mostra o custo");
	assert.equal(needsSpendConfirm({ profile: PROFILE.PERSONAL, cost: 0 }), false);
	assert.equal(needsSpendConfirm({ profile: PROFILE.PERSONAL, cost: 1, enabled: false }), false);
});

test("FC-U6: Trocar alvo — só buff, só com efeito ativo; jogador antes do uso, Mestre sempre", () => {
	const base = { profile: PROFILE.ALLY, effectActive: true, used: false, isGM: false, isCaster: true };
	assert.equal(canSwapTarget(base), true);
	assert.equal(canSwapTarget({ ...base, used: true }), false, "depois do uso relevante o jogador perde o botão");
	assert.equal(canSwapTarget({ ...base, used: true, isGM: true, isCaster: false }), true, "o Mestre sempre pode");
	assert.equal(canSwapTarget({ ...base, effectActive: false }), false, "efeito acabou");
	assert.equal(canSwapTarget({ ...base, effectActive: false, isGM: true }), false, "nem o Mestre troca efeito inexistente");
	assert.equal(canSwapTarget({ ...base, isCaster: false }), false, "outro jogador não troca");
	for (const profile of [PROFILE.HOSTILE, PROFILE.AREA, PROFILE.PERSONAL, PROFILE.MANUAL]) {
		assert.equal(canSwapTarget({ ...base, profile }), false, `${profile} não troca alvo`);
		assert.equal(canSwapTarget({ ...base, profile, isGM: true }), false);
	}
});

test("FC-U6: Encerrar — conjurador e Mestre, só com efeito ativo", () => {
	assert.equal(canEndRitual({ isCaster: true }), true);
	assert.equal(canEndRitual({ isGM: true }), true);
	assert.equal(canEndRitual({}), false);
	assert.equal(canEndRitual({ isGM: true, effectActive: false }), false);
});

test("FC-81: linha de resumo da carta", () => {
	assert.equal(
		summaryLine({ casterName: "Ana", ritualName: "Amaldiçoar Arma", targetNames: ["Maria"], cost: 1, occultism: { total: 17, dt: 21, success: false } }),
		"Ana conjurou Amaldiçoar Arma em Maria · 1 PD · Ocultismo 17 vs DT 21 — falha",
	);
	assert.equal(summaryLine({ casterName: "Ana", ritualName: "Terceiro Olho", cost: 1 }), "Ana conjurou Terceiro Olho · 1 PD");
	assert.match(summaryLine({ casterName: "Ana", ritualName: "X", cost: 3, interrupted: true }), /perdeu a concentração/);
});

test("FC-80: tom da carta", () => {
	assert.equal(cardTone({ pending: true }), "pending");
	assert.equal(cardTone({ interrupted: true }), "failure");
	assert.equal(cardTone({ occultismFailed: true }), "failure");
	assert.equal(cardTone({}), "success");
});
