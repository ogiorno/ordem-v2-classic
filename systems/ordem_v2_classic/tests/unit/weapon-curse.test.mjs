import test from "node:test";
import assert from "node:assert/strict";
import {
	curseDamageFormula,
	curseEffectData,
	curseLink,
	curseMatchesWeapon,
	curseOf,
	curseSpec,
	cursesForWeapon,
	cursesReplacedBy,
	hasWeaknessResist,
	isWeaponCurseRitual,
	vulnerabilityNote,
	weaknessResistEffectData,
} from "../../module/helpers/weapon-curse.mjs";
import { resolveDamage } from "../../module/helpers/threat-calc.mjs";

const fx = (data, extra = {}) => ({ disabled: false, ...data, ...extra });
const curseFx = (element, form, link, extra) => fx(curseEffectData({ element, form, link }), extra);

test("AA-01: reconhece o ritual pelo nome em todas as versões de elemento", () => {
	assert.equal(isWeaponCurseRitual({ type: "ritual", name: "Amaldiçoar Arma" }), true);
	assert.equal(isWeaponCurseRitual({ type: "ritual", name: "Amaldiçoar Arma - Sangue" }), true);
	assert.equal(isWeaponCurseRitual({ type: "ritual", name: "Amaldiçoar Tecnologia" }), false);
	assert.equal(isWeaponCurseRitual({ type: "armament", name: "Amaldiçoar Arma" }), false);
});

test("AA-03: dados por forma e tipo de dano por elemento", () => {
	assert.deepEqual(["basic", "student", "true"].map((f) => curseSpec("blood", f).formula), ["1d6", "2d6", "4d6"]);
	assert.equal(curseSpec("blood", "basic").damageType, "bloodDamage");
	assert.equal(curseSpec("death", "basic").damageType, "deathDamage");
	assert.equal(curseSpec("energy", "basic").damageType, "energyDamage");
	assert.equal(curseSpec("knowledge", "basic").damageType, "knowledgeDamage");
	assert.equal(curseSpec("fear", "basic"), null);
	assert.equal(curseSpec("blood", "mestre"), null);
});

test("AA-02: o efeito guarda elemento, forma, ligação e aparece com nome legível", () => {
	const data = curseEffectData({ element: "blood", form: "student", link: curseLink("weapon", "w1", "Faca"), casterName: "Ana", sceneId: "s1" });
	assert.equal(data.name, "Arma Amaldiçoada (Sangue · Discente)");
	const curse = data.flags.ordem_v2_classic.weaponCurse;
	assert.deepEqual([curse.element, curse.form, curse.formula, curse.damageType, curse.scope, curse.weaponId, curse.sceneId], ["blood", "student", "2d6", "bloodDamage", "weapon", "w1", "s1"]);
	assert.equal(curseEffectData({ element: "fear", form: "basic", link: curseLink("any") }), null);
	assert.equal(curseEffectData({ element: "blood", form: "basic", link: null }), null);
	assert.equal(curseLink("weapon"), null);
});

test("AA-03/AA-11: a maldição só vale para a arma ligada", () => {
	const melee = { id: "w1", ranged: false };
	const other = { id: "w2", ranged: false };
	const gun = { id: "g1", ranged: true };
	const onWeapon = curseOf(curseFx("blood", "basic", curseLink("weapon", "w1", "Faca")));
	const onAmmo = curseOf(curseFx("blood", "basic", curseLink("ammo")));
	const onAny = curseOf(curseFx("blood", "basic", curseLink("any")));
	assert.deepEqual([melee, other, gun].map((w) => curseMatchesWeapon(onWeapon, w)), [true, false, false]);
	assert.deepEqual([melee, other, gun].map((w) => curseMatchesWeapon(onAmmo, w)), [false, false, true]);
	assert.deepEqual([melee, other, gun].map((w) => curseMatchesWeapon(onAny, w)), [true, true, true]);
});

test("AA-11: efeito desligado não causa dano extra", () => {
	const on = curseFx("death", "basic", curseLink("weapon", "w1", "Faca"));
	const off = curseFx("death", "basic", curseLink("weapon", "w1", "Faca"), { disabled: true });
	assert.equal(cursesForWeapon([on], { id: "w1", ranged: false }).length, 1);
	assert.equal(cursesForWeapon([off], { id: "w1", ranged: false }).length, 0);
	assert.equal(cursesForWeapon([fx({ flags: {} })], { id: "w1", ranged: false }).length, 0);
});

test("AA-05: nova maldição na mesma ligação substitui a anterior; ligação diferente convive", () => {
	const a = curseFx("blood", "basic", curseLink("weapon", "w1", "Faca"));
	const b = curseFx("death", "basic", curseLink("weapon", "w2", "Taco"));
	const c = curseFx("energy", "basic", curseLink("ammo"));
	assert.deepEqual(cursesReplacedBy([a, b, c], curseLink("weapon", "w1", "Faca")), [a]);
	assert.deepEqual(cursesReplacedBy([a, b, c], curseLink("ammo")), [c]);
	assert.deepEqual(cursesReplacedBy([a, b, c], curseLink("weapon", "w3", "Machado")), []);
});

test("AA-08: o crítico não altera a fórmula do dado do elemento", () => {
	assert.equal(curseDamageFormula(curseOf(curseFx("blood", "true", curseLink("any")))), "4d6");
});

test("AA-09: vulnerabilidade ao elemento dobra só o dano do elemento", () => {
	const resistances = { bloodDamage: { vulnerable: true }, cuttingDamage: {} };
	assert.equal(resolveDamage(10, "bloodDamage", { resistances }).finalDamage, 20);
	assert.equal(resolveDamage(10, "bloodDamage", { resistances }).multiplier, 2);
	assert.equal(resolveDamage(10, "cuttingDamage", { resistances }).finalDamage, 10);
	assert.equal(resolveDamage(10, "bloodDamage", { resistances: { bloodDamage: { vulnerable: true, immune: true } } }).finalDamage, 0);
	assert.equal(resolveDamage(10, "bloodDamage", { resistances: { bloodDamage: { vulnerable: true, value: 5 } } }).finalDamage, 15);
});

test("AA-10: resistência à fraqueza impede o dobro, e só do elemento certo", () => {
	const resistances = { bloodDamage: { vulnerable: true }, deathDamage: { vulnerable: true } };
	const resist = fx(weaknessResistEffectData("bloodDamage"));
	assert.equal(hasWeaknessResist([resist], "bloodDamage"), true);
	assert.equal(hasWeaknessResist([resist], "deathDamage"), false);
	assert.equal(hasWeaknessResist([fx(weaknessResistEffectData("bloodDamage"), { disabled: true })], "bloodDamage"), false);
	const blood = resolveDamage(10, "bloodDamage", { resistances, ignoreVulnerable: hasWeaknessResist([resist], "bloodDamage") });
	assert.deepEqual([blood.finalDamage, blood.multiplier, blood.vulnerabilityIgnored], [10, 1, true]);
	const death = resolveDamage(10, "deathDamage", { resistances, ignoreVulnerable: hasWeaknessResist([resist], "deathDamage") });
	assert.deepEqual([death.finalDamage, death.multiplier, death.vulnerabilityIgnored], [20, 2, false]);
	// sem vulnerabilidade a resistência não muda nada
	assert.equal(resolveDamage(10, "bloodDamage", { resistances: {}, ignoreVulnerable: true }).vulnerabilityIgnored, false);
	assert.equal(weaknessResistEffectData("cuttingDamage"), null);
	assert.equal(weaknessResistEffectData("bloodDamage").name, "Resistência à Fraqueza (Sangue)");
});

test("avisos de vulnerabilidade na carta de dano", () => {
	assert.equal(vulnerabilityNote({ multiplier: 2, vulnerabilityIgnored: false }), "vulnerável: dobrou");
	assert.equal(vulnerabilityNote({ multiplier: 1, vulnerabilityIgnored: true }), "resistência à fraqueza: não dobrou");
	assert.equal(vulnerabilityNote({ multiplier: 1, vulnerabilityIgnored: false }), "");
});
