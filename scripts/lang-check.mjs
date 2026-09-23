// Confere se as chaves de tradução usadas pela ficha de ameaça existem em pt-BR e en.
// Uso: npm run lang-check
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const sys = "systems/ordem_v2_classic/";
const files = [
	"templates/threat/actor-threat-sheet.hbs",
	"templates/threat/parts/threat-test-chip.hbs",
	"templates/threat/parts/threat-item-row.hbs",
	"templates/threat/parts/threat-enigmas.hbs",
	"module/sheets/threat-sheet.mjs",
	"module/documents/actor.mjs",
	"module/hooks.mjs",
];

const flat = (obj, prefix = "", out = new Set()) => {
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object") flat(v, key, out);
		else out.add(key);
	}
	return out;
};

const keys = new Set();
for (const f of files) {
	const src = readFileSync(sys + f, "utf8");
	// actor.mjs e hooks.mjs são do sistema inteiro: só conferimos as chaves da ficha (op.threat.*)
	const onlyThreat = f === "module/documents/actor.mjs" || f === "module/hooks.mjs";
	const add = (k) => (!onlyThreat || k.startsWith("op.threat.")) && keys.add(k);
	for (const m of src.matchAll(/localize\s+["'](op\.[\w.]+)["']/g)) add(m[1]);
	for (const m of src.matchAll(/(?:localize|format|L)\(\s*["'](op\.[\w.]+)["']/g)) add(m[1]);
}
// chaves montadas dinamicamente
for (const k of ["default", "movement", "complete", "free", "reaction", "passive"]) keys.add(`op.threat.group.${k}`);
for (const k of ["smell", "blindsight", "lowLightVision", "darkvision"]) keys.add(`op.traits.${k}`);
for (const k of ["melee", "ranged"]) keys.add(`op.rangeType.${k}`);
for (const k of ["short", "medium", "long", "extreme"]) keys.add(`op.rangeCategory.${k}`);

let missing = 0;
for (const lang of ["pt-BR", "en"]) {
	const have = flat(JSON.parse(readFileSync(`${sys}lang/${lang}.json`, "utf8")));
	for (const k of [...keys].sort()) {
		if (!have.has(k)) {
			console.log(`FALTA em ${lang}: ${k}`);
			missing++;
		}
	}
}
assert.equal(missing, 0, `${missing} chave(s) de tradução faltando`);
console.log(`lang-check ok (${keys.size} chaves em pt-BR e en)`);
