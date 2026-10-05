import { PackSource } from "./lib.mjs";
const [packName, filter] = process.argv.slice(2);
const src = new PackSource(packName);
const re = new RegExp(filter, "i");
for (const d of src.items) {
	if (!re.test(d.file)) continue;
	const s = d.json.system;
	console.log(d.json.name, "|", JSON.stringify({ cat: s.category, w: s.weight, crit: s.critical, range: s.range, penalty: s.penalty, cond: s.conditions, types: s.types, atk: s.formulas?.attack, dmg: s.formulas?.damage, ammo: s.ammunition, ext: s.formulas?.extraFormula }));
}
