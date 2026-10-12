// Todos os testes ao vivo dos rituais de área e de combate, de uma vez.
//   const t = await import("/systems/ordem_v2_classic/module/macros/ritual-live-specs.mjs");
//   await t.runAllRitualSpecs();                 // tudo (cerca de 12 minutos)
//   await t.runAllRitualSpecs({ only: ["CD"] }); // só um grupo: AR (área), CD (condições), TG (alvos/área), BT (batalha), AA (Amaldiçoar Arma), AC (Amaldiçoar Arma em combate)
// Cada grupo cria a própria cena temporária com cópias dos agentes e apaga tudo no fim; as cenas e fichas do mundo não são tocadas.

import { runAreaRitualTests } from "./ritual-area-live-test.mjs";
import { runBattleTests } from "./ritual-battle-live-test.mjs";
import { runWeaponCurseTests } from "./weapon-curse-live-test.mjs";
import { runWeaponCurseCombatTests } from "./weapon-curse-combat-live-test.mjs";

const GROUP_TIMEOUT_MS = 20 * 60 * 1000;

/** Estado da página no momento de um travamento: janelas abertas, mira de área, cena e combate. */
function pageState() {
	const canvasEl = canvas.app?.canvas ?? canvas.app?.view;
	return {
		janelas: [...foundry.applications.instances.values()].filter((app) => app.state === foundry.applications.api.ApplicationV2.RENDER_STATES.RENDERED).map((app) => String(app.title ?? app.id)).slice(0, 8),
		miraDeArea: canvasEl?.dataset?.placingArea ?? null,
		previas: canvas.templates?.preview?.children?.length ?? 0,
		cena: canvas.scene?.name ?? null,
		combates: game.combats?.size ?? 0,
		avisos: document.querySelectorAll("#notifications .notification").length,
	};
}

export async function runAllRitualSpecs({ only = null, timeoutMs = GROUP_TIMEOUT_MS } = {}) {
	const groups = only ? [].concat(only) : ["AR", "CD", "TG", "BT", "AA", "AC"];
	// diagnóstico de instabilidade: a página recarregou no meio (o timeOrigin muda) e houve erros de JavaScript?
	const origin = performance.timeOrigin;
	const jsErrors = [];
	const onError = (event) => jsErrors.push(String(event.message ?? event.reason ?? "erro").slice(0, 160));
	window.addEventListener("error", onError);
	window.addEventListener("unhandledrejection", onError);
	const results = [];
	try {
		for (const group of groups) {
			const run = group === "AR" ? runAreaRitualTests() : group === "AA" ? runWeaponCurseTests() : group === "AC" ? runWeaponCurseCombatTests().then((r) => r.results) : runBattleTests({ only: group });
			// um grupo travado vira diagnóstico em vez de minutos de silêncio: devolve o estado da página e interrompe a regressão
			const part = await Promise.race([run, new Promise((resolve) => setTimeout(() => resolve("timeout"), timeoutMs))]);
			if (part === "timeout") {
				results.push({ id: `${group}-TRAVADO`, caso: `o grupo ${group} não terminou em ${Math.round(timeoutMs / 1000)} s`, ok: false, detalhe: JSON.stringify(pageState()) });
				break;
			}
			results.push(...part);
		}
	} finally {
		window.removeEventListener("error", onError);
		window.removeEventListener("unhandledrejection", onError);
	}
	const failed = results.filter((entry) => !entry.ok);
	const reloaded = performance.timeOrigin !== origin;
	const summary = { total: results.length, passou: results.length - failed.length, falhou: failed.length, falhas: failed.map((entry) => `${entry.id} ${entry.caso}: ${String(entry.detalhe).slice(0, 300)}`), diagnostico: { paginaRecarregada: reloaded, errosJs: jsErrors.length, primeirosErros: jsErrors.slice(0, 3) } };
	console.log(`Specs de rituais: ${summary.passou}/${summary.total} passaram`, summary.falhas, summary.diagnostico);
	return { ...summary, results };
}
