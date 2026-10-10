// Combate real com vários clientes: 4 jogadores (QA1..QA4), 1 mestre de teste (QA GM) e o Gamemaster montando a arena.
// Os jogadores atacam pela tela de ataque nas próprias fichas; o mestre de teste avança os turnos pelo carrossel e ataca
// com as ameaças. Mede iniciativa, condições, distância e animações. Relatório em work/combate-multi.json.
//   node scripts/combate-multi.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";

const root = execSync("npm root -g").toString().trim();
const require = createRequire(root + "/@playwright/cli/package.json");
const { chromium } = require("playwright");

const URL = "http://localhost:30000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { inicio: new Date().toISOString(), checagens: [], turnos: [], notas: [] };
const check = (id, caso, ok, detalhe) => { report.checagens.push({ id, caso, ok: !!ok, detalhe: detalhe ?? "" }); console.log(`${ok ? "OK   " : "FALHA"} ${id} ${caso}${ok ? "" : " :: " + detalhe}`); };
const save = () => fs.writeFileSync("work/combate-multi.json", JSON.stringify(report, null, 1));
fs.mkdirSync("work", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
const pages = {};

async function login(label) {
	const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
	const page = await ctx.newPage();
	await page.goto(`${URL}/join`);
	await page.waitForSelector("select[name=userId]", { timeout: 60000 });
	await page.selectOption("select[name=userId]", { label });
	await page.click("button[name=join]");
	await page.waitForFunction(() => window.game?.ready && canvas?.ready, null, { timeout: 120000 });
	await page.addStyleTag({ content: "#chat-notifications{pointer-events:none !important}" }).catch(() => {});
	pages[label] = page;
	return page;
}

let previousActive = null;
const cleanup = async () => {
	try {
		const gm = pages["Gamemaster"];
		if (gm) {
			await gm.evaluate(async (prev) => {
				try { await window.__rt?.close(); } catch { /* ignora */ }
				for (const s of game.scenes.filter((x) => x.name.startsWith("ZZ"))) await s.delete().catch(() => {});
				for (const a of game.actors.filter((x) => x.name.startsWith("ZZ"))) await a.delete().catch(() => {});
				if (prev) await game.scenes.get(prev)?.activate();
			}, previousActive);
		}
	} catch (e) { report.notas.push("limpeza: " + e); }
	for (const p of Object.values(pages)) await p.context().close().catch(() => {});
	await browser.close().catch(() => {});
	report.fim = new Date().toISOString();
	save();
};

try {
	const gm = await login("Gamemaster");
	previousActive = await gm.evaluate(() => game.scenes.active?.id ?? null);
	report.cenaAnterior = previousActive;

	// ---------- arena: agentes armados com poderes, ameaças, jogadores donos
	const base = "/systems/ordem_v2_classic/module/macros/";
	await gm.evaluate(async (base) => {
		window.__rt = await import(base + "ritual-ui-live-test.mjs");
		await window.__rt.open();
	}, base);
	const setup = await gm.evaluate(async () => {
		const SYS = "ordem_v2_classic";
		const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
		const fp = async (p, n) => { const pack = game.packs.get(`${SYS}.${p}`); const e = (await pack.getIndex()).find((x) => norm(x.name) === norm(n)); const d = (await pack.getDocument(e._id)).toObject(); delete d._id; return d; };
		const scene = canvas.scene;
		// combate novo, sem iniciativa: cada um rola a sua
		for (const c of game.combats.filter((x) => x.scene?.id === scene.id)) await c.delete();
		const agents = canvas.tokens.placeables.filter((t) => t.actor?.type === "agent");
		const threats = canvas.tokens.placeables.filter((t) => t.name.startsWith("ZZ ameaça"));
		const players = ["QA1", "QA2", "QA3", "QA4"].map((n) => game.users.getName(n));
		const weapons = ["Revólver", "Machete", "Fuzil de Assalto", "Revólver", "Machete"];
		const rows = [];
		for (const [i, t] of agents.entries()) {
			const a = t.actor;
			for (const it of a.items.filter((x) => x.type === "armament")) await it.delete();
			await a.createEmbeddedDocuments("Item", [await fp("armaments", weapons[i])]);
			const gun = a.items.find((x) => x.type === "armament");
			for (const [p, n] of [["fighterPowers", "Ataque Especial"], ["originPowers", "Para Bellum"], ["originPowers", "Mão Pesada"]]) if (!a.items.some((x) => x.name === n)) await a.createEmbeddedDocuments("Item", [await fp(p, n)]);
			const sk = gun.system.formulas?.attack?.skill;
			await a.update({ ...(sk ? { [`system.skills.${sk}.value`]: 100 } : {}), "system.PE.max": 60, "system.PE.value": 60, "system.PD.max": 60, "system.PD.value": 60 });
			const owner = players[i] ?? null;
			if (owner) await a.update({ ownership: { default: 0, [owner.id]: 3 } });
			rows.push({ actorId: a.id, tokenId: t.id, name: a.name, weapon: gun.name, weaponId: gun.id, user: owner?.name ?? null, res: a.usingWithoutSanityRule ? "PD" : "PE" });
		}
		for (const t of threats) await t.actor.update({ "system.attributes.hp.value": 5000, "system.attributes.hp.max": 5000 });
		const combat = await Combat.create({ scene: scene.id, active: true });
		await combat.createEmbeddedDocuments("Combatant", [...agents, ...threats].map((t) => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actor.id })));
		await scene.activate();
		return { scene: scene.name, sceneId: scene.id, combatId: combat.id, rows, threats: threats.map((t) => ({ tokenId: t.id, actorId: t.actor.id, name: t.name })) };
	});
	report.preparo = { cena: setup.scene, jogadores: setup.rows.map((r) => `${r.user ?? "mestre"}: ${r.weapon}`) };
	check("MC-01", "Arena montada com 5 agentes (4 de jogadores), 6 ameaças e combate sem iniciativa", setup.rows.length === 5 && setup.threats.length === 6, JSON.stringify(report.preparo));

	// ---------- logins dos outros clientes
	const qagm = await login("QA GM");
	for (const n of ["QA1", "QA2", "QA3", "QA4"]) await login(n);
	for (const n of ["QA1", "QA2", "QA3", "QA4", "QA GM"]) {
		await pages[n].waitForFunction((name) => canvas.scene?.name === name, setup.scene, { timeout: 60000 }).catch(() => {});
	}
	const onScene = await Promise.all(["QA1", "QA2", "QA3", "QA4", "QA GM"].map(async (n) => [n, await pages[n].evaluate(() => canvas.scene?.name)]));
	check("MC-02", "Todos os clientes (4 jogadores e o mestre de teste) entraram na cena da arena", onScene.every(([, s]) => s === setup.scene), JSON.stringify(onScene));
	const roles = await Promise.all(Object.entries(pages).map(async ([n, p]) => [n, await p.evaluate(() => `${game.user.isGM ? "GM" : "jogador"}`)]));
	report.clientes = roles;

	// ---------- espiões: animações (Sequencer) e avisos na tela
	for (const [n, p] of Object.entries(pages)) {
		await p.evaluate(() => {
			window.__spy = { seq: 0, notes: [] };
			if (window.Sequence?.prototype?.play && !window.__spyWrapped) {
				const orig = Sequence.prototype.play;
				Sequence.prototype.play = function (...a) { window.__spy.seq++; return orig.apply(this, a); };
				window.__spyWrapped = true;
			}
			for (const level of ["info", "warn", "error"]) {
				const o = ui.notifications[level].bind(ui.notifications);
				ui.notifications[level] = (m, ...r) => { window.__spy.notes.push(`${level}: ${m}`); return o(m, ...r); };
			}
		});
	}

	// ---------- iniciativa: cada jogador rola a sua pela própria sessão; o mestre de teste rola as ameaças
	const combatants = await qagm.evaluate(([cid]) => game.combats.get(cid).combatants.map((c) => ({ id: c.id, actorId: c.actorId, name: c.name, isNPC: c.isNPC })), [setup.combatId]);
	for (const row of setup.rows) {
		if (!row.user) continue;
		const cb = combatants.find((c) => c.actorId === row.actorId);
		await pages[row.user].evaluate(async ([cid, id]) => { await game.combats.get(cid).rollInitiative([id]); }, [setup.combatId, cb.id]);
	}
	await qagm.evaluate(async ([cid, ids]) => { await game.combats.get(cid).rollInitiative(ids); }, [setup.combatId, combatants.filter((c) => !setup.rows.some((r) => r.user && r.actorId === c.actorId)).map((c) => c.id)]);
	await sleep(800);
	const order = await qagm.evaluate(([cid]) => { const c = game.combats.get(cid); return c.turns.map((t) => ({ name: t.name, ini: t.initiative })); }, [setup.combatId]);
	report.ordemIniciativa = order;
	const sorted = order.every((t, i) => i === 0 || (order[i - 1].ini ?? -1) >= (t.ini ?? -1));
	check("MC-03", "Todos têm iniciativa rolada e o monitor ordena do maior para o menor", order.every((t) => t.ini !== null) && sorted, JSON.stringify(order.map((t) => `${t.name}:${t.ini}`)));
	await gm.evaluate(async ([cid]) => { await game.combats.get(cid).startCombat(); }, [setup.combatId]);
	await sleep(1500);
	const started = await qagm.evaluate(([cid]) => { const c = game.combats.get(cid); return { round: c.round, turn: c.combatant?.name }; }, [setup.combatId]);
	check("MC-04", "Combate iniciou na rodada 1 com o primeiro da ordem", started.round === 1 && started.turn === order[0].name, JSON.stringify(started));

	// ---------- laço de combate: 2 rodadas completas
	const ROUNDS = 2;
	const total = 11 * ROUNDS;
	const dialogSel = ".op-attack-dialog";
	const sheetSel = "[id^=OrdemActorSheet]";
	const stats = { telas: 0, custosOk: 0, anim: 0, avisos: [] };

	for (let i = 0; i < total; i++) {
		const cur = await qagm.evaluate(([cid]) => {
			const c = game.combats.get(cid); const cb = c.combatant;
			return { round: c.round, name: cb.name, actorId: cb.actorId, tokenId: cb.tokenId, type: cb.actor.type };
		}, [setup.combatId]);
		const entry = { n: i + 1, ...cur };
		const row = setup.rows.find((r) => r.actorId === cur.actorId);
		const who = row?.user ? pages[row.user] : qagm;
		entry.cliente = row?.user ?? "QA GM";

		// alvo: a ameaça viva mais próxima, marcado no cliente de quem ataca
		const tgt = await who.evaluate(([tokenId, ctype]) => {
			const me = canvas.tokens.get(tokenId);
			const pool = ctype === "agent" ? canvas.tokens.placeables.filter((t) => t.name.startsWith("ZZ ameaça") && (t.actor?.system?.attributes?.hp?.value ?? 1) > 0) : canvas.tokens.placeables.filter((t) => t.actor?.type === "agent");
			const sortedT = pool.sort((a, b) => Math.hypot(a.center.x - me.center.x, a.center.y - me.center.y) - Math.hypot(b.center.x - me.center.x, b.center.y - me.center.y));
			const th = sortedT[0];
			game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false }));
			th.setTarget(true, { releaseOthers: false, groupSelection: false });
			const cells = canvas.grid.measurePath ? canvas.grid.measurePath([me.center, th.center]).distance : canvas.grid.measureDistance(me.center, th.center);
			return { id: th.id, name: th.name, hp0: th.actor?.system?.attributes?.hp?.value ?? null, dist: Math.round(cells * 10) / 10, targets: game.user.targets.size };
		}, [cur.tokenId, cur.type]);
		entry.alvo = `${tgt.name} a ${tgt.dist} m`;
		if (cur.type === "agent") {
			const reach = await who.evaluate(async ([aid, wid, tid]) => {
				const m = await import("/systems/ordem_v2_classic/module/helpers/attack-options.mjs");
				const item = game.actors.get(aid).items.get(wid);
				const before = m.attackBlockReason(item);
				const melee = item.system.types?.rangeType?.name === "melee";
				return { melee, before, name: item.name };
			}, [cur.actorId, row.weaponId, tgt.id]);
			entry.antesDeAproximar = reach.before;
			if (reach.melee) {
				if (tgt.dist > 2.3) check(`MC-12-${entry.n}`, `${row.user ?? "mestre"} (${row.weapon}), rodada ${cur.round}: corpo a corpo a ${tgt.dist} m é barrado antes de se aproximar`, !!reach.before, "ataque liberado de longe");
				else entry.jaAdjacente = true;
				await who.evaluate(async ([tokenId, tid]) => {
					const me = canvas.tokens.get(tokenId), th = canvas.tokens.get(tid);
					await me.document.update({ x: th.document.x - canvas.grid.size, y: th.document.y }, { animate: false });
					for (let i = 0; i < 20 && Math.abs(me.document.x - (th.document.x - canvas.grid.size)) > 1; i++) await new Promise((r) => setTimeout(r, 250));
					await new Promise((r) => setTimeout(r, 400));
					game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false }));
					th.setTarget(true, { releaseOthers: false, groupSelection: false });
				}, [cur.tokenId, tgt.id]);
				entry.aproximou = true;
			}
			const after = await who.evaluate(async ([aid, wid]) => (await import("/systems/ordem_v2_classic/module/helpers/attack-options.mjs")).attackBlockReason(game.actors.get(aid).items.get(wid)), [cur.actorId, row.weaponId]);
			if (after) check(`MC-12B-${entry.n}`, `${row.user} (${row.weapon}): ataque liberado depois de se posicionar`, false, after);
		}

		await who.evaluate(() => { window.__spy.notes.length = 0; window.__spy.seq0 = window.__spy.seq; window.__known = new Set(game.messages.contents.map((m) => m.id)); });
		const mode = cur.round === 1 ? "tela" : "shift";

		if (cur.type === "agent") {
			// condição no meio do combate: Agarrado no jogador 1 na rodada 2
			if (cur.round === 2 && row.user === "QA1") await gm.evaluate(async ([aid]) => {
				const eng = await import("/systems/ordem_v2_classic/module/macros/ritual-area-engine.mjs");
				await eng.applyCondition(game.actors.get(aid), { key: "restrain" }, { itemId: "combate-multi" });
			}, [cur.actorId]);
			await who.evaluate((id) => game.actors.get(id).sheet.render(true), cur.actorId);
			await sleep(1500);
			await who.evaluate(() => document.querySelectorAll(".application[id^=dialog]").forEach((d) => d.querySelector("[data-action=close]")?.click()));
			await who.locator(`${sheetSel} [data-action=tab][data-tab=inventory]`).first().click().catch(() => {});
			await sleep(400);
			const btn = who.locator(`${sheetSel} .item[data-item-id="${row.weaponId}"] .attack-btn`).first();
			const pe0 = await who.evaluate(([id, r]) => game.actors.get(id).system[r].value, [row.actorId, row.res]);
			const dlg = who.locator(dialogSel);
			if (mode === "shift") {
				await btn.click({ modifiers: ["Shift"] });
				await sleep(3200);
			} else {
				await btn.click();
				await dlg.waitFor({ timeout: 8000 }).catch(() => {});
				entry.tela = (await dlg.count()) > 0;
				if (entry.tela) {
					stats.telas++;
					entry.painel = await who.evaluate(() => { const d = document.querySelector(".op-attack-dialog"); return { aplicados: [...d.querySelectorAll(".op-ad-chip")].map((c) => c.innerText), condicoes: d.querySelector("[data-condition-block]")?.hidden === false ? d.querySelector("[data-condition-block]").innerText : "" }; });
					if (row.user === "QA2" || row.user === "QA3") {
						entry.dialogoTexto = (await who.evaluate(() => document.querySelector(".op-attack-dialog")?.innerText.replace(/\s+/g, " ").slice(0, 500))) + " | poderes: " + (await who.evaluate((id) => game.actors.get(id).items.filter((i) => i.type === "ability").map((i) => i.name + ":" + i.effects.size).join(","), cur.actorId));
						report.turnos.push(entry); save(); report.turnos.pop();
						if (!(await dlg.locator("input[name^='pool.']").count())) { check("MC-12A", "Ataque Especial aparece como opção na tela do jogador " + row.user, false, entry.dialogoTexto); entry.escolha = null; } else {
						await dlg.locator("input[name^='pool.'][name$='.attack']").fill("1");
						await dlg.locator("input[name^='pool.'][name$='.damage']").fill("1");
						entry.escolha = "Ataque Especial 1+1";
					}
					}
					await dlg.locator("button[data-action=attack]").click();
					await sleep(3200);
				}
			}
			const pe1 = await who.evaluate(([id, r]) => game.actors.get(id).system[r].value, [row.actorId, row.res]);
			entry.custo = pe0 - pe1;
			const want = entry.escolha ? (/NEX 05/.test(cur.name) ? 2 : 3) : 0;
			if (entry.custo === want) stats.custosOk++;
			else check(`MC-C-${entry.n}`, `${row.user} (${row.weapon}) rodada ${cur.round}: custo esperado ${want} PE`, false, `pagou ${entry.custo}`);
			// rolagem de ataque e cartão
			const info = await who.evaluate(() => {
				const msgs = game.messages.contents.filter((m) => !window.__known.has(m.id));
				return { formulas: msgs.flatMap((m) => (m.rolls ?? []).map((r) => r.formula)), flags: msgs.map((m) => m.getFlag("ordem_v2_classic", "attackOptions")?.conditions?.length ?? 0), hit: msgs.map((m) => m.getFlag("ordem_v2_classic", "hitResult")?.hit).filter((v) => v !== undefined), seq: window.__spy.seq - window.__spy.seq0, notes: [...window.__spy.notes] };
			});
			entry.ataque = info.formulas.find((f) => /d20/.test(f));
			entry.acertou = info.hit;
			entry.animacoes = info.seq;
			if (info.seq > 0) stats.anim++;
			entry.avisos = info.notes;
			entry.condicaoNoCartao = info.flags.some((n) => n > 0);
			entry.condicaoNaTela = !!entry.painel?.condicoes;
			if (cur.round === 2 && row.user === "QA1") {
				const m = /^(\d+)d20/.exec(entry.ataque ?? "");
				const attr = await who.evaluate(([id, wid]) => { const it = game.actors.get(id).items.get(wid); return game.actors.get(id).system.attributes[it.system.formulas.attack.attr].value; }, [row.actorId, row.weaponId]);
				check("MC-10", "Jogador 1 Agarrado (rodada 2): ataque perde 1 d20", m && Number(m[1]) === attr - 1, `${entry.ataque} (atributo ${attr})`);
				await gm.evaluate(async ([aid]) => { const a = game.actors.get(aid); await a.deleteEmbeddedDocuments("ActiveEffect", a.effects.filter((e) => e.getFlag("ordem_v2_classic", "condition")).map((e) => e.id)); }, [cur.actorId]);
			}
			// dano pelo cartão (se acertou)
			await who.evaluate(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
			await sleep(700);
			const cardId = await who.evaluate(() => game.messages.contents.filter((m) => !window.__known.has(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
			if (cardId) {
				const dmgBtn = who.locator(`#chat .message[data-message-id="${cardId}"] button[data-action="damage"]`).first();
				if ((await dmgBtn.count()) && !(await dmgBtn.isDisabled())) {
					await dmgBtn.evaluate((el) => el.click());
					await sleep(2800);
					entry.dano = await who.evaluate(() => game.messages.contents.filter((m) => !window.__known.has(m.id)).flatMap((m) => (m.rolls ?? []).map((r) => r.formula)).filter((f) => !/d20/.test(f)).join(" | "));
				}
			}
			await who.evaluate((id) => game.actors.get(id).sheet.close(), cur.actorId);
		} else {
			// ameaça: ataca pelo botão da ficha, no cliente do mestre de teste
			await qagm.evaluate((id) => game.actors.get(id).sheet.render(true), cur.actorId);
			await sleep(1500);
			const tb = qagm.locator(`[id^=OrdemThreatSheet] [data-action=rollThreatItem]`).first();
			if (await tb.count()) {
				await tb.click().catch(() => {});
				await sleep(2800);
				entry.tela = (await qagm.locator(dialogSel).count()) > 0;
				entry.animacoes = await qagm.evaluate(() => window.__spy.seq - window.__spy.seq0);
				entry.avisos = await qagm.evaluate(() => [...window.__spy.notes]);
				entry.ataque = await qagm.evaluate(() => game.messages.contents.filter((m) => !window.__known.has(m.id)).flatMap((m) => (m.rolls ?? []).map((r) => r.formula)).join(" | "));
			}
			await qagm.evaluate((id) => game.actors.get(id).sheet.close(), cur.actorId);
		}
		report.turnos.push(entry);
		save();
		const turnKey = () => qagm.evaluate(([cid]) => { const c = game.combats.get(cid); return `${c.round}:${c.turn}`; }, [setup.combatId]);
		const before = await turnKey();
		for (let tries = 0; tries < 4; tries++) {
			await qagm.locator("button.crlngn-advance-turn").first().click({ timeout: 8000 }).catch(() => {});
			for (let w = 0; w < 12 && (await turnKey()) === before; w++) await sleep(500);
			if ((await turnKey()) !== before) break;
			entry.tentativasAvanco = tries + 1;
		}
		if ((await turnKey()) === before) entry.semBotao = true;
		await sleep(1200);
	}

	// ---------- resultados agregados
	const ag = report.turnos.filter((t) => t.type === "agent");
	check("MC-05", `Todos os ${ag.length} turnos de agente (4 jogadores + 1 do mestre) atacaram com arma`, ag.every((t) => t.ataque), "");
	const r1 = ag.filter((t) => t.round === 1 && t.cliente !== "QA GM");
	check("MC-06", "Rodada 1: a tela de ataque abriu para todos os jogadores", r1.every((t) => t.tela), JSON.stringify(r1.map((t) => [t.cliente, t.tela])));
	check("MC-07", "Custos de PE cobrados batem com as escolhas", ag.filter((t) => t.custo !== undefined && t.cliente !== "QA GM").every((t) => (t.escolha ? t.custo >= 2 : t.custo === 0)), JSON.stringify(ag.map((t) => [t.cliente, t.custo])));
	check("MC-08", "Ordem dos turnos seguiu a iniciativa nas duas rodadas", (() => { const names = report.turnos.map((t) => t.name); return order.every((o, k) => names[k] === o.name && names[k + 11] === o.name); })(), JSON.stringify(report.turnos.slice(0, 11).map((t) => t.name)));
	const sem = report.turnos.filter((t) => t.semBotao).length;
	check("MC-09", "O carrossel de combate avançou todos os turnos", sem === 0, `sem botão em ${sem} turnos`);
	check("MC-11", "Ameaças atacaram pela ficha sem abrir a tela de ataque", report.turnos.filter((t) => t.type === "threat").every((t) => t.tela === false || t.tela === undefined), "");
	// animações de ataque (Sequencer): um efeito por ataque de agente
	const atacantes = ag.filter((t) => t.ataque);
	check("MC-13", "Animação de ataque disparou em todos os ataques de agente com alvo marcado", atacantes.length > 0 && atacantes.every((t) => t.animacoes > 0), JSON.stringify(atacantes.map((t) => [t.cliente, t.animacoes])));
	report.distancia = ag.map((t) => ({ quem: t.cliente, arma: setup.rows.find((r) => r.actorId === t.actorId)?.weapon, alvo: t.alvo, aviso: t.antesDeAproximar }));
	report.stats = stats;
} catch (e) {
	report.erro = String(e?.stack ?? e);
	console.error(report.erro);
} finally {
	await cleanup();
	const ok = report.checagens.filter((c) => c.ok).length;
	console.log(`\n${ok}/${report.checagens.length} verificações certas`);
}
