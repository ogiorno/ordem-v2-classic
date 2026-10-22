// Sangrando acumulado e modal "Rolar Vigor" com dois navegadores: o Mestre (Mapa Maker) monta a arena e avança os turnos;
// um jogador de teste (criado e apagado aqui) é dono do agente e clica no modal com o mouse. Relatório em work/sangrando-modal.json.
//   node scripts/sangrando-modal.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";

const root = execSync("npm root -g").toString().trim();
const require = createRequire(root + "/@playwright/cli/package.json");
const { chromium } = require("playwright");

const URL = "http://localhost:30000";
const GM = "Mapa Maker";
const PLAYER = "ZZ Jogador Sangrando";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { inicio: new Date().toISOString(), checagens: [], notas: [] };
const check = (id, caso, ok, detalhe) => { report.checagens.push({ id, caso, ok: !!ok, detalhe: detalhe ?? "" }); console.log(`${ok ? "OK   " : "FALHA"} ${id} ${caso}${ok ? "" : " :: " + detalhe}`); };
fs.mkdirSync("work", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
const pages = {};

async function login(label) {
	console.log(`login ${label}…`);
	const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(`${URL}/join`);
	await page.waitForSelector("select[name=userId]", { timeout: 60000 });
	await page.selectOption("select[name=userId]", { label });
	await page.click("button[name=join]");
	await page.waitForFunction(() => window.game?.ready, null, { timeout: 120000 });
	await sleep(2500);
	pages[label] = page;
	return page;
}

const cleanup = async () => {
	try {
		const gm = pages[GM];
		if (gm) {
			await gm.evaluate(async (playerName) => {
				try { await window.__sg?.arena?.close(); } catch { /* ignora */ }
				for (const s of game.scenes.filter((x) => x.name.startsWith("ZZ"))) await s.delete().catch(() => {});
				for (const a of game.actors.filter((x) => x.name.startsWith("ZZ"))) await a.delete().catch(() => {});
				for (const c of game.combats.filter((x) => !x.scene)) await c.delete().catch(() => {});
				await game.users.getName(playerName)?.delete().catch(() => {});
			}, PLAYER);
		}
	} catch (e) { report.notas.push("limpeza: " + e); }
	report.fim = new Date().toISOString();
	fs.writeFileSync("work/sangrando-modal.json", JSON.stringify(report, null, 1));
	// fechar o navegador pode travar depois de apagar o usuário: com prazo, e o processo sai de qualquer jeito
	const limit = (promise) => Promise.race([promise.catch(() => {}), sleep(8000)]);
	for (const p of Object.values(pages)) await limit(p.context().close());
	await limit(browser.close());
};

try {
	// o jogador precisa existir antes do login dele
	const gm = await login(GM);
	await gm.evaluate(async (name) => {
		await game.users.getName(name)?.delete().catch(() => {});
		await User.create({ name, role: CONST.USER_ROLES.PLAYER });
	}, PLAYER);
	const pl = await login(PLAYER);

	// arena com um agente do jogador e uma ameaça; combate com o agente primeiro
	const setup = await gm.evaluate(async (name) => {
		const A = await import("/systems/ordem-v2-classic/module/macros/ritual-live-arena.mjs");
		const arena = await A.openArena({ agents: ["Agente NEX 50 — Ocultista"] });
		const user = game.users.getName(name);
		const ag = arena.agents[0];
		await ag.actor.update({ ownership: { default: 0, [user.id]: 3 } });
		const threat = await arena.mkThreat("ZZ alvo", 2200, 900);
		const combat = await Combat.create({ scene: arena.scene.id, active: true });
		await combat.createEmbeddedDocuments("Combatant", [
			{ tokenId: ag.doc.id, sceneId: arena.scene.id, actorId: ag.actor.id, initiative: 20 },
			{ tokenId: threat.document.id, sceneId: arena.scene.id, actorId: threat.actor.id, initiative: 10 },
		]);
		await combat.startCombat();
		window.__sg = { arena, combat, actorId: ag.actor.id };
		return { actorId: ag.actor.id, pv: ag.actor.system.PV.value };
	}, PLAYER);
	await sleep(1500);

	const hp = () => gm.evaluate(() => game.actors.get(window.__sg.actorId).system.PV.value);
	const bleedFx = () => gm.evaluate(async () => {
		const { activeConditions } = await import("/systems/ordem-v2-classic/module/helpers/conditions.mjs");
		return activeConditions(game.actors.get(window.__sg.actorId), "bleeding").map((e) => e.getFlag("ordem-v2-classic", "condition").stacks ?? 1);
	});
	const openCards = () => gm.evaluate(() => game.messages.filter((m) => { const f = m.getFlag("ordem-v2-classic", "bleedPending"); return f && f.actorId === window.__sg.actorId && !f.resolved; }).length);
	const setVigor = (value) => gm.evaluate(async (v) => { await game.actors.get(window.__sg.actorId).update({ "system.skills.resilience.value": v }); }, value);
	const apply = (times) => gm.evaluate(async (n) => {
		const E = await import("/systems/ordem-v2-classic/module/macros/ritual-area-engine.mjs");
		const actor = game.actors.get(window.__sg.actorId);
		for (let i = 0; i < n; i++) await E.applyCondition(actor, { key: "bleeding" }, {});
	}, times);
	// avança até o turno do agente (turno do agente → ameaça → agente na rodada seguinte)
	const toAgentTurn = async () => {
		await gm.evaluate(async () => { for (let i = 0; i < 2; i++) { await window.__sg.combat.nextTurn(); await new Promise((r) => setTimeout(r, 1500)); } });
		await sleep(2500);
	};
	const modal = (page) => page.locator(".op-bleed-dialog");

	// SM-01 duas aplicações = um efeito ×2
	await apply(2);
	const fx = await bleedFx();
	check("SM-01", "Sangrando duas vezes = um efeito com 2 acúmulos", fx.length === 1 && fx[0] === 2, JSON.stringify(fx));

	// SM-02 o jogador recebe o modal com ×2 e 2d6; o Mestre não
	await setVigor(-100);
	await toAgentTurn();
	const shown = await modal(pl).count();
	const text = shown ? await modal(pl).innerText() : "";
	check("SM-02", "Jogador dono vê o modal com ×2 e 2d6", shown === 1 && /×2/.test(text) && /2d6/.test(text), text.replace(/\s+/g, " "));
	check("SM-03", "Mestre não recebe o modal", (await modal(gm).count()) === 0);
	check("SM-04", "Um cartão aberto no chat", (await openCards()) === 1, String(await openCards()));

	// SM-05 clique duplo: só um teste e uma perda de PV (2d6)
	const pvBefore = await hp();
	const button = modal(pl).getByRole("button", { name: "Rolar Vigor" });
	await Promise.all([button.click().catch(() => {}), button.click({ timeout: 800 }).catch(() => {})]);
	await sleep(4000);
	const pvAfter = await hp();
	const lost = pvBefore - pvAfter;
	check("SM-05", "Falhou em Vigor: perdeu entre 2 e 12 PV, uma vez só", lost >= 2 && lost <= 12, `PV ${pvBefore} → ${pvAfter}`);
	check("SM-06", "Modal fecha e o cartão resolve", (await modal(pl).count()) === 0 && (await openCards()) === 0);
	const fx2 = await bleedFx();
	check("SM-07", "Continua sangrando ×2 depois da falha", fx2.length === 1 && fx2[0] === 2, JSON.stringify(fx2));

	// SM-08 terceira aplicação sobe para ×3 e o modal mostra 3d6
	await apply(1);
	await toAgentTurn();
	const text3 = (await modal(pl).count()) ? await modal(pl).innerText() : "";
	check("SM-08", "Terceiro acúmulo: modal mostra ×3 e 3d6", /×3/.test(text3) && /3d6/.test(text3), text3.replace(/\s+/g, " "));
	await modal(pl).getByRole("button", { name: "Rolar Vigor" }).click().catch(() => {});
	await sleep(4000);

	// SM-09 passou em Vigor: estanca tudo e não perde PV
	await setVigor(100);
	await toAgentTurn();
	const pvB = await hp();
	check("SM-09a", "Modal abre no turno seguinte", (await modal(pl).count()) === 1);
	await modal(pl).getByRole("button", { name: "Rolar Vigor" }).click().catch(() => {});
	await sleep(4000);
	const fx3 = await bleedFx();
	check("SM-09", "Passou em Vigor: estanca todos os acúmulos sem perder PV", fx3.length === 0 && (await hp()) === pvB, `efeitos ${JSON.stringify(fx3)}; PV ${pvB} → ${await hp()}`);
	check("SM-10", "Modal fechado e nenhum cartão aberto", (await modal(pl).count()) === 0 && (await openCards()) === 0);
} catch (error) {
	check("ERRO", "o teste quebrou", false, error.stack?.split("\n").slice(0, 3).join(" "));
} finally {
	await cleanup();
}
const failed = report.checagens.filter((c) => !c.ok).length;
console.log(`\n${report.checagens.length - failed}/${report.checagens.length} ok`);
process.exit(failed ? 1 : 0);
