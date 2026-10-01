// Todos os testes ao vivo dos rituais de área e de combate, de uma vez.
//   const t = await import("/systems/ordem_v2_classic/module/macros/ritual-live-specs.mjs");
//   await t.runAllRitualSpecs();                 // tudo (cerca de 12 minutos)
//   await t.runAllRitualSpecs({ only: ["CD"] }); // só um grupo: AR (área), CD (condições), TG (alvos/área), BT (batalha)
// Cada grupo cria a própria cena temporária com cópias dos agentes e apaga tudo no fim; as cenas e fichas do mundo não são tocadas.

import { runAreaRitualTests } from "./ritual-area-live-test.mjs";
import { runBattleTests } from "./ritual-battle-live-test.mjs";

export async function runAllRitualSpecs({ only = null } = {}) {
	const groups = only ? [].concat(only) : ["AR", "CD", "TG", "BT"];
	const results = [];
	for (const group of groups) {
		const part = group === "AR" ? await runAreaRitualTests() : await runBattleTests({ only: group });
		results.push(...part);
	}
	const failed = results.filter((entry) => !entry.ok);
	const summary = { total: results.length, passou: results.length - failed.length, falhou: failed.length, falhas: failed.map((entry) => `${entry.id} ${entry.caso}: ${String(entry.detalhe).slice(0, 300)}`) };
	console.log(`Specs de rituais: ${summary.passou}/${summary.total} passaram`, summary.falhas);
	return { ...summary, results };
}
