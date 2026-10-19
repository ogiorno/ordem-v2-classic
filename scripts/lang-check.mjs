// Confere se as chaves de tradução usadas pela ficha de ameaça existem em pt-BR e en.
// Uso: npm run lang-check
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { OPTION_MAPS } from "../systems/ordem_v2_classic/module/helpers/threat-ability-editor.mjs";

const sys = "systems/ordem_v2_classic/";
const files = [
	"templates/threat/actor-threat-sheet.hbs",
	"templates/threat/parts/threat-test-chip.hbs",
	"templates/threat/parts/threat-item-row.hbs",
	"templates/threat/parts/threat-enigmas.hbs",
	"templates/item/parts/item-ability-execution.hbs",
	"module/sheets/threat-sheet.mjs",
	"module/documents/actor.mjs",
	"module/hooks.mjs",
	"module/macros/threat-ability-effects-runner.mjs",
	"module/macros/threat-ability-triggers-runner.mjs",
	"module/macros/threat-ability-panel-runner.mjs",
	"module/macros/threat-ability-use.mjs",
	"module/macros/threat-ability-config-apply.mjs",
	"module/helpers/threat-ability-panel-view.mjs",
	"templates/apps/threat-ability-panel.hbs",
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
// chaves do editor de execução montadas por mapas e códigos de erro
for (const map of Object.values(OPTION_MAPS)) for (const k of Object.values(map)) keys.add(k);
for (const ev of ["turnStart", "turnEnd", "manual", "reaction", "enter", "leave"]) keys.add(`op.threatExec.triggerEvent.${ev}`);
for (const o of ["self", "target", "any"]) keys.add(`op.threatExec.triggerOwner.${o}`);
for (const k of ["not-authorized", "no-active-gm", "not-a-threat", "missing-context"]) keys.add(`op.threatUse.denied.${k}`);
for (const k of ["action", "cost", "target", "range", "area", "save", "damage", "heal", "effect"]) keys.add(`op.threatUse.line.${k}`);
for (const k of ["passive", "free", "movement", "default", "complete", "reaction"]) keys.add(`op.executionChoices.${k}`);
for (const k of ["scene-limit", "round-limit", "not-linked", "needs-combat", "duplicate", "ended", "wrong-event", "wrong-owner", "no-trigger", "needs-gm-confirmation", "not-active-gm", "no-execution", "empty", "unknown"]) keys.add(`op.threatUse.gate.${k}`);
for (const k of ["full", "half", "negate"]) keys.add(`op.threatPanel.mode.${k}`);
for (const k of ["pending", "applying", "applied", "ignored", "disabled"]) keys.add(`op.threatPanel.state.${k}`);
for (const k of ["missing", "corrupt", "newer-version"]) keys.add(`op.threatPanel.issue.${k}`);
for (const c of ["enum", "version", "missing-action", "required", "invalid-cost", "conflict", "missing-dc", "invalid-formula", "invalid-duration", "unknown-skill", "unknown-type", "invalid-count"]) keys.add(`op.threatExec.error.${c}`);

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
