import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { validateExecution } from "../../module/helpers/threat-ability-execution.mjs";

const root = new URL("../../", import.meta.url);
const dir = new URL("packs/_source/threatAbilities/", root);
const items = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".json") && !f.endsWith("_folder.json")).map((f) => JSON.parse(fs.readFileSync(new URL(f.replaceAll("\\", "/"), dir), "utf8")));

test("pacote threatAbilities está em dia com os fixtures", () => {
	const r = spawnSync(process.execPath, [new URL("tools/build-threat-ability-pack.mjs", root).pathname.replace(/^\/(\w:)/, "$1"), "--check"], { encoding: "utf8" });
	assert.equal(r.status, 0, r.stderr);
});

test("pacote tem as 170 habilidades, ids únicos e pastas existentes", () => {
	assert.equal(items.length, 170);
	assert.equal(new Set(items.map((i) => i._id)).size, 170);
	const folders = new Set(fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith("_folder.json")).map((f) => JSON.parse(fs.readFileSync(new URL(f.replaceAll("\\", "/"), dir), "utf8"))._id));
	for (const i of items) { assert.equal(i.type, "ability"); assert.ok(folders.has(i.folder), i.name); assert.equal(i._key, `!items!${i._id}`); }
});

test("execution do pacote é válida e igual à configuração revisada; manuais ficam null", () => {
	const configs = new Map(JSON.parse(fs.readFileSync(new URL("fixtures/threat-ability-configs-v1-3.json", root), "utf8")).abilities.map((c) => [c.id, c]));
	for (const i of items) {
		const c = configs.get(i.flags.ordem_v2_classic.threatAbilityId);
		assert.ok(c, i.name);
		assert.deepEqual(i.system.execution, c.execution ?? null, i.name);
		if (i.system.execution) assert.ok(validateExecution(i.system.execution, { activation: c.testActivation ?? c.activation }).valid, i.name);
	}
	assert.equal(items.filter((i) => i.system.execution).length, 75);
});

test("ícones do pacote existem em disco", () => {
	for (const i of items) if (i.img.includes("ability-icons")) assert.ok(fs.existsSync(new URL(i.img.replace("systems/ordem_v2_classic/", ""), root)), i.img);
});
