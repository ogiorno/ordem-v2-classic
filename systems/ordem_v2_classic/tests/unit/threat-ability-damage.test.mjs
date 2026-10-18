import { test } from "node:test";
import assert from "node:assert/strict";
import { assignRolls, auditRecord, blockReason, previewChange, resolveDamageType, resourcePath, supportsResource } from "../../module/helpers/threat-ability-damage.mjs";
import { validateExecution } from "../../module/helpers/threat-ability-execution.mjs";

const agent = (over = {}) => ({ type: "agent", system: { PV: { value: 20, max: 30 }, SAN: { value: 15, max: 20 }, PE: { value: 5, max: 8 }, resistances: {}, ...over } });
const threat = (over = {}) => ({ type: "threat", system: { attributes: { hp: { value: 50, max: 70 } }, resistances: {}, genericRd: null, ...over } });
const dmg = (over = {}) => ({ kind: "damage", formula: "2d8+2", type: "energia", resource: "pv", roll: "once", ...over });

test("tipos em português e inglês resolvem para a chave do sistema; desconhecido bloqueia", () => {
	assert.equal(resolveDamageType("Energia"), "energyDamage");
	assert.equal(resolveDamageType("perfuração"), "piercingDamage");
	assert.equal(resolveDamageType("mental"), "mentalDamage");
	assert.equal(resolveDamageType("bloodDamage"), "bloodDamage");
	assert.equal(resolveDamageType("xyz"), null);
	assert.equal(blockReason(dmg({ type: "" })), "missing-type");
	assert.equal(blockReason(dmg({ type: "xyz" })), "unknown-type");
	assert.equal(blockReason(dmg({ formula: "" })), "missing-formula");
	assert.equal(blockReason(dmg({ resource: "mana" })), "unsupported-resource");
	assert.equal(blockReason(dmg()), null);
	assert.equal(blockReason({ kind: "heal", formula: "1d6", resource: "pv" }), null); // cura não exige tipo
});

test("o validador de execução recusa tipo desconhecido, mas aceita cura sem tipo", () => {
	const base = { mode: "active", automation: "automatic" };
	const bad = validateExecution({ ...base, damage: [dmg({ type: "xyz" })] }, { activation: "standard" });
	assert.ok(bad.errors.some((e) => e.path === "damage[0].type" && e.code === "unknown-type"));
	assert.equal(bad.effective, "manual");
	const heal = validateExecution({ ...base, damage: [{ kind: "heal", formula: "1d6", type: "", resource: "pv", roll: "once" }] }, { activation: "standard" });
	assert.deepEqual(heal.errors, []);
});

test("PV de agente: dano integral, valor anterior e final auditáveis", () => {
	const c = previewChange({ entry: dmg(), rolled: 12, snapshot: agent() });
	assert.deepEqual([c.supported, c.before, c.after, c.finalDamage, c.type], [true, 20, 8, 12, "energyDamage"]);
	assert.equal(c.path, "system.PV");
});

test("PV de ameaça usa attributes.hp e não passa de zero", () => {
	const c = previewChange({ entry: dmg(), rolled: 80, snapshot: threat() });
	assert.deepEqual([c.path, c.before, c.after], ["system.attributes.hp", 50, 0]);
});

test("SAN nunca vira PV: dano mental em SAN só mexe na SAN; ameaça sem SAN não suporta", () => {
	const entry = dmg({ type: "mental", resource: "san", formula: "2d6" });
	const a = previewChange({ entry, rolled: 7, snapshot: agent() });
	assert.deepEqual([a.supported, a.path, a.before, a.after], [true, "system.SAN", 15, 8]);
	const t = previewChange({ entry, rolled: 7, snapshot: threat() });
	assert.deepEqual([t.supported, t.reason], [false, "resource-unsupported-by-target"]);
	assert.equal(t.after, undefined);
	assert.equal(supportsResource("threat", "san"), false);
	assert.equal(resourcePath("agent", "san"), "system.SAN");
});

test("PE e recurso inexistente na ficha", () => {
	const pe = previewChange({ entry: dmg({ type: "mental", resource: "pe" }), rolled: 3, snapshot: agent() });
	assert.deepEqual([pe.path, pe.after], ["system.PE", 2]);
	const missing = previewChange({ entry: dmg({ resource: "san" }), rolled: 3, snapshot: { type: "agent", system: { resistances: {} } } });
	assert.deepEqual([missing.supported, missing.reason], [false, "resource-missing"]);
});

test("RD tipada, RD genérica com exceção, imunidade e vulnerabilidade valem", () => {
	const rd = previewChange({ entry: dmg(), rolled: 12, snapshot: threat({ resistances: { energyDamage: { value: 5 } } }) });
	assert.deepEqual([rd.finalDamage, rd.blockedByDefense, rd.after], [7, 5, 43]);
	const generic = previewChange({ entry: dmg(), rolled: 12, snapshot: threat({ genericRd: { value: 10, except: ["deathDamage"] } }) });
	assert.equal(generic.finalDamage, 2);
	const exceptDeath = previewChange({ entry: dmg({ type: "morte" }), rolled: 12, snapshot: threat({ genericRd: { value: 10, except: ["deathDamage"] } }) });
	assert.equal(exceptDeath.finalDamage, 12);
	const immune = previewChange({ entry: dmg(), rolled: 12, snapshot: threat({ resistances: { energyDamage: { immune: true } } }) });
	assert.deepEqual([immune.finalDamage, immune.after, immune.immune], [0, 50, true]);
	const vuln = previewChange({ entry: dmg(), rolled: 6, snapshot: threat({ resistances: { energyDamage: { vulnerable: true } } }) });
	assert.deepEqual([vuln.finalDamage, vuln.multiplier], [12, 2]);
	const ignore = previewChange({ entry: dmg({ ignoreRd: true }), rolled: 12, snapshot: threat({ resistances: { energyDamage: { value: 5 } } }) });
	assert.equal(ignore.finalDamage, 12);
});

test("metade arredonda para baixo antes das defesas; anula zera; sem redução mantém", () => {
	assert.equal(previewChange({ entry: dmg(), rolled: 15, mode: "half", snapshot: agent() }).finalDamage, 7);
	assert.equal(previewChange({ entry: dmg(), rolled: 15, mode: "negate", snapshot: agent() }).finalDamage, 0);
	assert.equal(previewChange({ entry: dmg(), rolled: 15, mode: "full", snapshot: agent() }).finalDamage, 15);
	const halfThenRd = previewChange({ entry: dmg(), rolled: 15, mode: "half", snapshot: threat({ resistances: { energyDamage: { value: 5 } } }) });
	assert.equal(halfThenRd.finalDamage, 2);
});

test("múltiplos tipos: cada entrada gera sua própria mudança", () => {
	const entries = [dmg({ formula: "2d6", type: "corte" }), dmg({ formula: "1d6", type: "mental", resource: "san" })];
	const snap = agent({ resistances: { cuttingDamage: { value: 2 } } });
	const [a, b] = entries.map((e, i) => previewChange({ entry: e, rolled: [9, 4][i], snapshot: snap }));
	assert.deepEqual([a.path, a.finalDamage, a.after], ["system.PV", 7, 13]);
	assert.deepEqual([b.path, b.finalDamage, b.after], ["system.SAN", 4, 11]);
});

test("cura respeita o máximo e informa o que foi limitado", () => {
	const heal = { kind: "heal", formula: "10", resource: "pv", roll: "once" };
	const c = previewChange({ entry: heal, rolled: 15, snapshot: agent() });
	assert.deepEqual([c.healed, c.after, c.capped, c.finalDamage], [10, 30, true, 0]);
	const small = previewChange({ entry: heal, rolled: 4, snapshot: agent() });
	assert.deepEqual([small.healed, small.after, small.capped], [4, 24, false]);
	const half = previewChange({ entry: heal, rolled: 15, mode: "half", snapshot: agent() });
	assert.equal(half.healed, 7);
	assert.equal(previewChange({ entry: heal, rolled: 4, snapshot: threat() }).path, "system.attributes.hp");
});

test("política de rolagem: uma vez para todos ou por alvo", () => {
	let n = 0;
	const roll = () => ++n;
	const once = assignRolls([{ roll: "once" }], ["a", "b"], roll);
	assert.deepEqual(once[0], { a: 1, b: 1 });
	n = 10;
	const per = assignRolls([{ roll: "perTarget" }], ["a", "b"], (e, id) => roll(e, id));
	assert.deepEqual(per[0], { a: 11, b: 12 });
});

test("registro auditável guarda fonte, alvo, valores e motivo de bloqueio", () => {
	const change = previewChange({ entry: dmg(), rolled: 12, snapshot: agent() });
	const rec = auditRecord({ source: "Mal Sintonizado", targetId: "t1", targetName: "Agente", change, userId: "u1", at: 123 });
	assert.deepEqual([rec.source, rec.targetId, rec.before, rec.after, rec.finalDamage, rec.userId, rec.reason], ["Mal Sintonizado", "t1", 20, 8, 12, "u1", null]);
	const blocked = auditRecord({ source: "x", targetId: "t", targetName: "T", change: previewChange({ entry: dmg({ type: "" }), rolled: 1, snapshot: agent() }) });
	assert.deepEqual([blocked.supported, blocked.reason], [false, "missing-type"]);
});
