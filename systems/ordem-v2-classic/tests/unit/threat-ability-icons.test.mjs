import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { planIconApplication } from "../../module/helpers/threat-ability-config-match.mjs";

const root = new URL("../../", import.meta.url);
const icons = JSON.parse(fs.readFileSync(new URL("fixtures/threat-ability-icons.json", root), "utf8"));
const configs = JSON.parse(fs.readFileSync(new URL("fixtures/threat-ability-configs-v1-3.json", root), "utf8")).abilities;

test("ícones: 158 ligados, arquivos existem e ids existem nas configurações", () => {
	assert.equal(icons.count, 158);
	const ids = new Set(configs.map((c) => c.id));
	for (const [id, p] of Object.entries(icons.icons)) {
		assert.ok(ids.has(id), id);
		assert.ok(fs.existsSync(new URL(p.replace("systems/ordem-v2-classic/", ""), root)), p);
	}
});

test("planIconApplication só troca imagem padrão do Foundry", () => {
	const id = Object.keys(icons.icons)[0];
	const rows = [{ itemId: "a", configId: id }, { itemId: "b", configId: id }, { itemId: "c", configId: "sem-icone" }];
	const items = [{ id: "a", img: "icons/svg/item-bag.svg" }, { id: "b", img: "meu/custom.png" }, { id: "c", img: "icons/svg/item-bag.svg" }];
	assert.deepEqual(planIconApplication(rows, items, icons.icons), [{ _id: "a", img: icons.icons[id] }]);
});
