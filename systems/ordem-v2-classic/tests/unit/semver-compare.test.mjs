import { test } from "node:test";
import assert from "node:assert/strict";
import semverComp from "../../utils/semver-compare.mjs";

const quieto = (fn) => {
	const log = console.log;
	console.log = () => {};
	try {
		return fn();
	} finally {
		console.log = log;
	}
};
const cmp = (...args) => quieto(() => semverComp(...args));

test("a versão atual precisa estar estritamente entre mínimo e máximo", () => {
	assert.equal(cmp("1.0.0", "1.5.0", "2.0.0"), true);
	assert.equal(cmp("1.0.0", "1.0.0", "2.0.0"), false);
	assert.equal(cmp("1.0.0", "2.0.0", "2.0.0"), false);
	assert.equal(cmp("1.0.0", "0.9.9", "2.0.0"), false);
	assert.equal(cmp("1.0.0", "2.0.1", "2.0.0"), false);
});

test("gEqMin e lEqMax incluem as pontas", () => {
	assert.equal(cmp("1.0.0", "1.0.0", "2.0.0", { gEqMin: true }), true);
	assert.equal(cmp("1.0.0", "2.0.0", "2.0.0", { lEqMax: true }), true);
	assert.equal(cmp("1.0.0", "2.0.0", "2.0.0", { gEqMin: true }), false);
});

test("sem mínimo ou sem máximo, o lado ausente sempre vale", () => {
	assert.equal(cmp("1.0.0", "3.0.0", null), true);
	assert.equal(cmp(null, "0.1.0", "1.0.0"), true);
	assert.equal(cmp("", "5.0.0", "1.0.0"), false);
});

test("comparação numérica de verdade: 1.10.0 é maior que 1.9.0", () => {
	assert.equal(cmp("1.9.0", "1.10.0", "2.0.0"), true);
	assert.equal(cmp("1.2.3", "1.2.10", "1.3.0"), true);
	assert.equal(cmp("1.10.0", "1.9.0", "2.0.0"), false);
});

test("eqMin e eqMax exigem versão igual", () => {
	assert.equal(cmp("1.2.3", "1.2.3", null, { eqMin: true }), true);
	assert.equal(cmp("1.2.3", "1.2.4", null, { eqMin: true }), false);
	assert.equal(cmp(null, "2.0.0", "2.0.0", { eqMax: true }), true);
	assert.equal(cmp("1.0.0", "1.0.0", "1.0.0", { eqMin: true, eqMax: true }), true);
	assert.equal(cmp("1.0.0", "1.0.0", "1.0.1", { eqMin: true, eqMax: true }), false);
});

test("entrada inválida lança erro", () => {
	assert.throws(() => cmp(null, "1.0.0", null), /Missing Comparators/);
	assert.throws(() => cmp("1.0.0", null, "2.0.0"), /Missing Comparators/);
	assert.throws(() => cmp("1.0", "1.0.0", "2.0.0"), /Invalid SemVer/);
	assert.throws(() => cmp("1.0.x", "1.0.0", "2.0.0"), /Invalid SemVer/);
	assert.throws(() => cmp(1, "1.0.0", "2.0.0"), /Wrong term/);
});
