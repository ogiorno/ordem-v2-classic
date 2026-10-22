import { test } from "node:test";
import assert from "node:assert/strict";
import { FLOW, ROUTE, checkCost, delegateRequest, hasSideEffects, reduce, routeUse, summaryLines } from "../../module/helpers/threat-ability-flow.mjs";

const item = (execution, extra = {}) => ({ type: "ability", system: { activation: "standard", execution, ...extra } });
const good = { mode: "active", automation: "automatic", targeting: { kind: "tokens", range: 9, count: 2, relation: "agent" }, save: { skill: "reflexes", dc: 15, onSuccess: "half" }, damage: [{ formula: "2d8", type: "energia", resource: "pv", roll: "once" }] };

test("rota por tipo: ataque, manual, passiva, incompleta, assistida e automática", () => {
	assert.equal(routeUse({ type: "armament", system: {} }).route, ROUTE.ATTACK);
	assert.deepEqual(routeUse(item(undefined)), { route: ROUTE.MANUAL, usable: false, missing: [] });
	assert.equal(routeUse(item(null)).route, ROUTE.MANUAL);
	assert.equal(routeUse(item({ mode: "manual" })).route, ROUTE.MANUAL);
	assert.equal(routeUse(item({ mode: "passive" })).usable, false);
	const incomplete = routeUse(item({ ...good, save: { skill: "reflexes" } }));
	assert.deepEqual([incomplete.route, incomplete.usable, incomplete.missing], [ROUTE.INCOMPLETE, true, ["save.dc"]]);
	assert.equal(routeUse(item(good)).route, ROUTE.AUTOMATIC);
	assert.equal(routeUse(item({ ...good, automation: "assisted" })).route, ROUTE.ASSISTED);
	assert.equal(routeUse(item(good, { activation: "" })).route, ROUTE.INCOMPLETE); // ação vazia pede revisão
	assert.equal(routeUse(null).usable, false);
	assert.equal(routeUse(item({ mode: "triggered", automation: "assisted", trigger: { event: "manual" } })).triggered, true);
});

test("custo: só quando declarado; recurso insuficiente bloqueia ou avisa; recurso ausente não é inventado", () => {
	const agent = { type: "agent", system: { PE: { value: 3 }, PV: { value: 10 } } };
	assert.deepEqual(checkCost({ execution: {}, actor: agent }), { declared: false, ok: true, charge: null });
	assert.equal(checkCost({ execution: { cost: { type: "PE", amount: 0 } }, actor: agent }).declared, false);
	const ok = checkCost({ execution: { cost: { type: "PE", amount: 2 } }, actor: agent });
	assert.deepEqual([ok.ok, ok.charge.from, ok.charge.to, ok.charge.path], [true, 3, 1, "system.PE.value"]);
	const block = checkCost({ execution: { cost: { type: "PE", amount: 5, insufficient: "block" } }, actor: agent });
	assert.deepEqual([block.ok, block.reason, block.shortfall, block.charge], [false, "insufficient", 2, null]);
	const warn = checkCost({ execution: { cost: { type: "PE", amount: 5, insufficient: "warn" } }, actor: agent });
	assert.deepEqual([warn.ok, warn.charge.to], [true, 0]);
	const threat = { type: "threat", system: { attributes: { hp: { value: 50 } } } };
	const unsupported = checkCost({ execution: { cost: { type: "PE", amount: 1, insufficient: "block" } }, actor: threat });
	assert.deepEqual([unsupported.ok, unsupported.unsupported, unsupported.reason], [false, true, "resource-missing"]);
	assert.equal(checkCost({ execution: { cost: { type: "PV", amount: 4 } }, actor: threat }).charge.path, "system.attributes.hp.value");
	assert.equal(checkCost({ execution: { cost: { type: "mana", amount: 1 } }, actor: agent }).unsupported, true);
});

test("cartão: campos ausentes viram Definir manualmente, nunca zero", () => {
	const lines = summaryLines({ execution: { targeting: { kind: "tokens", range: null }, area: { shape: "" }, save: { skill: "reflexes", dc: null }, damage: [{ formula: "", type: "x" }], effects: [{ condition: "", duration: {} }] }, activation: "" });
	const by = (k) => lines.filter((l) => l.key === k);
	assert.equal(by("action")[0].missing, true);
	assert.equal(by("range")[0].missing, true);
	assert.equal(by("area")[0].missing, true);
	assert.equal(by("save")[0].missing, true);
	assert.equal(by("damage")[0].missing, true);
	assert.equal(by("effect")[0].missing, true);
	assert.ok(lines.every((l) => l.missing || !/^0/.test(l.text)));
	const full = summaryLines({ execution: good, activation: "standard" });
	assert.equal(full.find((l) => l.key === "save").text, "reflexes DT 15");
	assert.equal(full.find((l) => l.key === "range").text, "9 m");
	assert.equal(full.find((l) => l.key === "damage").text, "2d8 energia");
});

test("transições: caminho feliz até DONE", () => {
	let s = FLOW.IDLE;
	for (const [event, expected] of [["use", FLOW.VALIDATING], ["valid", FLOW.SUMMARY], ["proceed", FLOW.SELECTING], ["selected", FLOW.CONFIRMING], ["confirm", FLOW.EXECUTING], ["done", FLOW.DONE]]) {
		const r = reduce(s, event);
		assert.equal(r.state, expected, event);
		s = r.state;
	}
});

test("cancelar em qualquer ponto antes de confirmar não gera efeito", () => {
	for (const path of [["use", "valid", "cancel"], ["use", "valid", "proceed", "cancel"], ["use", "valid", "proceed", "selected", "cancel"], ["use", "invalid", "cancel"]]) {
		let s = FLOW.IDLE, any = false;
		for (const ev of path) { const r = reduce(s, ev); s = r.state; any ||= r.sideEffects; }
		assert.deepEqual([s, any], [FLOW.CANCELLED, false], path.join(">"));
	}
	assert.equal(hasSideEffects(FLOW.CONFIRMING), false);
	assert.equal(hasSideEffects(FLOW.EXECUTING), true);
});

test("erro de validação cai em refused e oferece o fallback manual", () => {
	let r = reduce(reduce(FLOW.IDLE, "use").state, "invalid");
	assert.equal(r.state, FLOW.REFUSED);
	assert.equal(reduce(r.state, "fallback").state, FLOW.MANUAL);
	assert.equal(reduce(FLOW.VALIDATING, "manual").state, FLOW.MANUAL);
	assert.equal(reduce(FLOW.SELECTING, "noScene").state, FLOW.MANUAL); // sem cena/token: manual com aviso
	assert.equal(reduce(FLOW.SELECTING, "invalid").state, FLOW.SELECTING); // alvo inválido: continua escolhendo
});

test("confirmação dupla executa uma vez: o segundo confirm é ignorado", () => {
	const first = reduce(FLOW.CONFIRMING, "confirm");
	assert.deepEqual([first.state, first.firstExecution], [FLOW.EXECUTING, true]);
	const second = reduce(first.state, "confirm");
	assert.deepEqual([second.state, second.ignored, second.firstExecution], [FLOW.EXECUTING, true, undefined]);
	assert.equal(reduce(FLOW.DONE, "confirm").ignored, true);
	assert.equal(reduce(FLOW.CANCELLED, "confirm").ignored, true);
	assert.equal(reduce(FLOW.IDLE, "confirm").ignored, true); // não confirma sem passar pelo fluxo
	assert.equal(reduce(FLOW.CONFIRMING, "back").state, FLOW.SELECTING);
	assert.equal(reduce(FLOW.EXECUTING, "error").state, FLOW.CANCELLED);
});

test("pedido delegado leva só ids", () => {
	assert.deepEqual(delegateRequest({ actorUuid: "Actor.a", itemUuid: "Actor.a.Item.i", userId: "u" }), { type: "threatAbilityUse", actorUuid: "Actor.a", itemUuid: "Actor.a.Item.i", userId: "u" });
});
