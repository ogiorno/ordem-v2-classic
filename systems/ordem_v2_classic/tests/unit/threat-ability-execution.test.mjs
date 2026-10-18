import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeExecution, validateExecution, isValidFormula, missingFields, EXECUTION_VERSION } from "../../module/helpers/threat-ability-execution.mjs";

const malSintonizado = () => ({
	version: 1, mode: "active", automation: "automatic",
	targeting: { kind: "area", relation: "any" },
	area: { shape: "line", length: 9, width: 3, origin: "caster" },
	save: { skill: "reflexes", dc: 18, onSuccess: "half" },
	damage: [{ formula: "2d8+2", type: "energia", resource: "pv", roll: "once", fraction: 0.5 }],
	effects: [{ condition: "surdo", duration: { value: "1d4", unit: "rounds" }, onSave: "fail", support: "mechanical" }],
	visibility: { dc: "gm", defense: "gm", result: "public" }
});

test("ausência de execution mantém a habilidade manual", () => {
	for (const v of [undefined, null, {}]) {
		assert.equal(normalizeExecution(v), null);
		const r = validateExecution(v);
		assert.deepEqual([r.valid, r.effective, r.automatic], [true, "manual", false]);
	}
});

test("defaults: bloco mínimo ganha valores seguros e continua manual", () => {
	const e = normalizeExecution({ mode: "active" });
	assert.equal(e.version, EXECUTION_VERSION);
	assert.equal(e.automation, "manual");
	assert.deepEqual(e.damage, []);
	assert.equal(e.visibility.dc, "gm");
	assert.equal(e.cost, null);
	assert.equal(validateExecution({ mode: "active" }, { activation: "standard" }).effective, "manual");
});

test("round-trip sem perda e idempotente, preservando campos desconhecidos", () => {
	const raw = { ...malSintonizado(), futuro: { x: 1 }, area: { ...malSintonizado().area, extra: "ok" } };
	const once = normalizeExecution(raw);
	assert.deepEqual(normalizeExecution(JSON.parse(JSON.stringify(once))), once);
	assert.deepEqual(once.futuro, { x: 1 });
	assert.equal(once.area.extra, "ok");
	assert.equal(once.save.dc, 18);
	assert.equal(once.effects[0].duration.value, "1d4");
	assert.deepEqual(raw.damage[0].fraction, 0.5);
});

test("Mal Sintonizado válido com tipo de ação fica automático", () => {
	const r = validateExecution(malSintonizado(), { activation: "standard" });
	assert.deepEqual(r.errors, []);
	assert.equal(r.effective, "automatic");
});

test("activation vazio impede automação de habilidade ativa", () => {
	const r = validateExecution(malSintonizado(), { activation: "" });
	assert.equal(r.valid, false);
	assert.equal(r.effective, "manual");
	assert.ok(missingFields(malSintonizado()).includes("action"));
});

test("enums inválidos viram erro e rebaixam para manual", () => {
	for (const [path, mutate] of [
		["mode", (e) => (e.mode = "x")],
		["targeting.kind", (e) => (e.targeting.kind = "cone")],
		["area.shape", (e) => (e.area.shape = "estrela")],
		["save.onSuccess", (e) => (e.save.onSuccess = "dobro")],
		["damage[0].resource", (e) => (e.damage[0].resource = "hp")],
		["effects[0].duration.unit", (e) => (e.effects[0].duration.unit = "dias")],
		["visibility.dc", (e) => (e.visibility.dc = "todos")]
	]) {
		const e = malSintonizado();
		mutate(e);
		const r = validateExecution(e, { activation: "standard" });
		assert.ok(r.errors.some((x) => x.path === path), path);
		assert.equal(r.effective, "manual", path);
	}
});

test("campos condicionais: área, alvo, dano, efeito e resistência", () => {
	const act = { activation: "standard" };
	let e = malSintonizado(); delete e.area;
	assert.ok(validateExecution(e, act).errors.some((x) => x.path === "area"));
	e = malSintonizado(); e.area.width = null;
	assert.ok(validateExecution(e, act).errors.some((x) => x.path === "area.width"));
	e = malSintonizado(); e.area = { shape: "sphere", persistence: "instant", triggers: ["turn"] };
	const codes = validateExecution(e, act).errors.map((x) => x.path);
	assert.ok(codes.includes("area.radius") && codes.includes("area.triggers"));
	e = { mode: "active", automation: "assisted", targeting: { kind: "tokens", range: 9 } };
	assert.ok(validateExecution(e, act).errors.some((x) => x.path === "targeting.count"));
	e = malSintonizado(); delete e.save;
	const noSave = validateExecution(e, act).errors.map((x) => x.path);
	assert.ok(noSave.includes("damage[0].fraction") && noSave.includes("effects[0].onSave"));
});

test("fórmula, DT e custo inválidos", () => {
	const act = { activation: "standard" };
	for (const f of ["", "abc", "2d", "2d8+", "d", "2d8 + x"]) assert.equal(isValidFormula(f), false, f);
	for (const f of ["2d8+2", "1d4", "10", "4d6 + 2d4 - 1", "3d6*2"]) assert.equal(isValidFormula(f), true, f);
	let e = malSintonizado(); e.damage[0].formula = "2d8+";
	assert.ok(validateExecution(e, act).errors.some((x) => x.code === "invalid-formula"));
	e = malSintonizado(); e.save.dc = null;
	assert.ok(validateExecution(e, act).errors.some((x) => x.code === "missing-dc"));
	e = malSintonizado(); e.save.dc = 0;
	assert.ok(validateExecution(e, act).errors.some((x) => x.code === "missing-dc"));
	e = malSintonizado(); e.cost = { type: "PE", amount: -2 };
	assert.ok(validateExecution(e, act).errors.some((x) => x.code === "invalid-cost"));
	e = malSintonizado(); e.cost = { type: "", amount: 2 };
	assert.ok(validateExecution(e, act).errors.some((x) => x.path === "cost.type"));
	e = malSintonizado(); e.effects[0].duration = { unit: "rounds", value: null };
	assert.ok(validateExecution(e, act).errors.some((x) => x.code === "invalid-duration"));
});

test("marcador informativo ou requisito narrativo rebaixa automática para assistida", () => {
	const act = { activation: "standard" };
	let e = malSintonizado(); e.effects[0].support = "marker";
	assert.equal(validateExecution(e, act).effective, "assisted");
	e = malSintonizado(); e.requirements = [{ kind: "narrative", text: "se o alvo estiver à vista" }];
	assert.equal(validateExecution(e, act).effective, "assisted");
});

test("migração aditiva: ability antigo e schema com execution anulável", () => {
	const src = readFileSync(new URL("../../module/data/items/ability-data.mjs", import.meta.url), "utf8");
	assert.match(src, /execution: new fields\.ObjectField\(\{ required: false, nullable: true, initial: null \}\)/);
	for (const campo of ["description", "activation", "cost:", "costType", "preRequisite"]) assert.ok(src.includes(campo), campo);
	const legado = { description: "x", activation: "standard", cost: 0 };
	assert.equal(normalizeExecution(legado.execution), null);
	assert.deepEqual(legado, { description: "x", activation: "standard", cost: 0 });
});

test("vínculos (grants): referência obrigatória e condicionado ao teste exige save", () => {
	const act = { activation: "default" };
	const base = { mode: "active", automation: "assisted", save: { skill: "vontade", dc: 20, onSuccess: "half" } };
	assert.deepEqual(validateExecution({ ...base, grants: [{ ref: "falsa-nostalgia", onSave: "fail" }] }, act).errors, []);
	assert.ok(validateExecution({ ...base, grants: [{ ref: "" }] }, act).errors.some((e) => e.path === "grants[0].ref"));
	assert.ok(validateExecution({ ...base, grants: [{ ref: "x", onSave: "quando" }] }, act).errors.some((e) => e.path === "grants[0].onSave"));
	assert.ok(validateExecution({ mode: "active", grants: [{ ref: "x", onSave: "fail" }] }, act).errors.some((e) => e.code === "conflict"));
	assert.deepEqual(normalizeExecution({ mode: "active" }).grants, []);
});

test("estado real de automação: automática, assistida (motivos) e manual", async () => {
	const { automationState } = await import("../../module/helpers/threat-ability-execution.mjs");
	const full = { mode: "active", automation: "automatic", targeting: { kind: "area", relation: "any" }, area: { shape: "sphere", radius: 9, origin: "caster" }, save: { skill: "fortitude", dc: 15, onSuccess: "half" }, damage: [{ formula: "4d4", type: "químico", resource: "pv", roll: "once" }] };
	assert.deepEqual(automationState(full, { activation: "movement" }), { state: "automatic", reasons: [] });
	assert.equal(automationState(null).state, "manual");
	assert.equal(automationState({ mode: "manual" }).state, "manual");
	assert.equal(automationState({ ...full, save: { skill: "fortitude" } }, { activation: "movement" }).state, "manual");
	const assisted = (over, gaps = []) => automationState({ ...full, ...over }, { activation: "movement", gaps });
	assert.ok(assisted({ automation: "assisted" }).reasons[0].includes("automação pedida"));
	assert.ok(assisted({ requirements: [{ kind: "narrative", text: "x" }] }).reasons.includes("pré-requisito narrativo"));
	assert.ok(assisted({ effects: [{ condition: "confuso", duration: { unit: "rounds", value: 1 }, support: "marker" }] }).reasons.includes("condição como marcador manual"));
	assert.ok(assisted({ effects: [{ condition: "surdo", duration: { unit: "scene" }, support: "mechanical" }] }).reasons.includes("duração sem expiração automática"));
	assert.ok(assisted({ effects: [{ condition: "surdo", duration: { unit: "unspecified" }, support: "mechanical" }] }).reasons.includes("duração sem expiração automática"));
	assert.equal(assisted({}, ["empurrar 6 m"]).state, "assisted");
	assert.ok(assisted({ mode: "triggered", trigger: { event: "manual" } }).reasons.includes("disparo acionado pelo Mestre"));
});

test("alcance não informado: aceito só quando marcado; explica o estado assistido", async () => {
	const { automationState } = await import("../../module/helpers/threat-ability-execution.mjs");
	const base = { mode: "active", automation: "automatic", damage: [{ formula: "10d6", type: "mental", resource: "san", roll: "once" }] };
	const sem = { ...base, targeting: { kind: "token", count: 1, relation: "any" } };
	assert.ok(validateExecution(sem, { activation: "default" }).errors.some((e) => e.path === "targeting.range"));
	const com = { ...base, targeting: { kind: "token", count: 1, relation: "any", rangeUnspecified: true } };
	assert.deepEqual(validateExecution(com, { activation: "default" }).errors, []);
	assert.ok(automationState(com, { activation: "default" }).reasons.includes("alcance não informado no texto"));
	assert.equal(normalizeExecution(sem).targeting.rangeUnspecified, false);
});
