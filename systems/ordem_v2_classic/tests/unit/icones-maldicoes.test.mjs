import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CURSE_KEYS } from "../../module/helpers/curse-rules.mjs";

const root = new URL("../../", import.meta.url);
const icons = JSON.parse(readFileSync(new URL("fixtures/curse-icons.json", root), "utf8"));

test("toda maldição tem ícone registrado e o arquivo existe", () => {
	for (const key of CURSE_KEYS) {
		assert.ok(icons[key], `${key} sem entrada em curse-icons.json`);
		assert.ok(existsSync(new URL(icons[key].replace("systems/ordem_v2_classic/", ""), root)), `${key}: arquivo ausente`);
	}
});

test("nenhum ícone registrado sobra sem maldição", () => {
	for (const key of Object.keys(icons)) assert.ok(CURSE_KEYS.includes(key), `${key} não é maldição`);
});

test("o pacote gerado usa os ícones das maldições", () => {
	const bundle = JSON.parse(readFileSync(new URL("fixtures/curses-pack.json", root), "utf8"));
	for (const item of bundle.items) assert.equal(item.img, icons[item.system.curseKey], item.name);
});
