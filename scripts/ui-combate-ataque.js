// Playwright (run-code): combate de agentes contra ameaças conduzido pelo carrossel de combate (Carolingian UI),
// com a tela de ataque (docs/spec-tela-de-ataque.md) usada pela interface em cada turno de agente.
//   playwright-cli -s=cb run-code --filename=scripts/ui-combate-ataque.js
// Antes: entrar como Mestre e rodar na página: window.__rt = await import(".../ritual-ui-live-test.mjs"); await __rt.open().
// Rodada 1: abre a tela e confirma sem escolher; rodada 2: Ataque Especial (1 ataque + 1 dano) + dano livre; rodada 3: Shift+clique.
// Resultado em window.__caResult.
async (page) => {
	const sleep = (ms) => page.waitForTimeout(ms);
	const ev = (fn, arg) => page.evaluate(fn, arg);
	const out = { turnos: [], checagens: [] };
	const check = (id, caso, ok, detalhe) => { out.checagens.push({ id, caso, ok: !!ok, detalhe }); console.log(`${ok ? "OK  " : "FALHA"} ${id} ${caso} ${ok ? "" : detalhe ?? ""}`); };
	const dialog = page.locator(".op-attack-dialog");
	const sheetSel = "[id^=OrdemActorSheet]";

	// ---- preparação: armas e poderes nos agentes, PE cheio, ameaças duráveis
	const arenaCheck = await ev(() => ({
		name: canvas.scene?.name,
		agents: canvas.tokens.placeables.filter((t) => t.actor?.getFlag("ordem_v2_classic", "liveTestCopy") && t.actor.type === "agent").length,
		threats: canvas.tokens.placeables.filter((t) => t.name.startsWith("ZZ ameaça") && t.actor?.type === "threat").length,
	}));
	if (arenaCheck.name !== "ZZ arena (teste automático)" || arenaCheck.agents !== 5 || arenaCheck.threats !== 6) {
		throw new Error(`Teste cancelado sem alterar fichas: arena temporária esperada; encontrada ${JSON.stringify(arenaCheck)}`);
	}
	await ev(() => window.__rt.cleanup());
	const prep = await ev(async () => {
		const SYS = "ordem_v2_classic";
		const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
		const fp = async (p, n) => { const pack = game.packs.get(`${SYS}.${p}`); const e = (await pack.getIndex()).find((x) => norm(x.name) === norm(n)); const d = (await pack.getDocument(e._id)).toObject(); delete d._id; return d; };
		const { conditionEffectData } = await import(`/systems/${SYS}/module/helpers/conditions.mjs`);
		const tokens = canvas.tokens.placeables;
		const agents = tokens.filter((t) => t.actor?.getFlag(SYS, "liveTestCopy") && t.actor.type === "agent");
		const threats = tokens.filter((t) => t.name.startsWith("ZZ ameaça") && t.actor?.type === "threat");
		if (agents.length !== 5 || threats.length !== 6) throw new Error("A arena mudou durante a preparação; nenhuma ficha fora dela foi tocada.");
		const weapons = ["Machete", "Machete", "Fuzil de Assalto", "Revólver", "Machete"];
		const rows = [];
		for (const [i, t] of agents.entries()) {
			const a = t.actor;
			for (const it of a.items.filter((x) => x.type === "armament")) await it.delete();
			const [gun] = await a.createEmbeddedDocuments("Item", [await fp("armaments", weapons[i % 5])]);
			if (!a.items.some((x) => x.name === "Ataque Especial")) await a.createEmbeddedDocuments("Item", [await fp("fighterPowers", "Ataque Especial")]);
			if (!a.items.some((x) => x.name === "Para Bellum")) await a.createEmbeddedDocuments("Item", [await fp("originPowers", "Para Bellum")]);
			if (!a.items.some((x) => x.name === "Mão Pesada")) await a.createEmbeddedDocuments("Item", [await fp("originPowers", "Mão Pesada")]);
			if (i === 0) {
				const [trailPower] = await a.createEmbeddedDocuments("Item", [await fp("pathSpecialist", "NEX 10% - Ataque Furtivo")]);
				await trailPower.createEmbeddedDocuments("ActiveEffect", [{
					name: "Ataque Furtivo",
					changes: [],
					disabled: false,
					flags: { [SYS]: { onUse: { enabled: true, applies: "melee", cost: 1, damageBonus: "1d6" } } },
				}]);
				await gun.createEmbeddedDocuments("ActiveEffect", [{
					name: "Modificação Certeira",
					changes: [],
					disabled: false,
					flags: { [SYS]: { onUse: { enabled: true, applies: "melee", auto: true, attackBonus: 2 } } },
				}]);
				await a.createEmbeddedDocuments("ActiveEffect", [conditionEffectData("grabbed"), conditionEffectData("vulnerable")]);
			}
			const sk = gun.system.formulas?.attack?.skill;
			await a.update({ ...(sk ? { [`system.skills.${sk}.value`]: 100 } : {}), "system.PE.max": 60, "system.PE.value": 60, "system.PD.max": 60, "system.PD.value": 60 });
			rows.push({ id: a.id, name: a.name, weapon: gun.name, weaponId: gun.id, res: a.usingWithoutSanityRule ? "PD" : "PE", conditionQa: i === 0, sneak: i === 0, weaponMod: i === 0 });
		}
		for (const t of threats) await t.actor.update({ "system.attributes.hp.value": 5000, "system.attributes.hp.max": 5000 });
		window.__ca = { rows, known: game.messages.contents.map((m) => m.id) };
		return { rows, threats: threats.length };
	});
	out.preparo = prep;
	// o carrossel e a ficha precisam do mapa/janelas livres
	await ev(() => { if (!document.getElementById("rt-no-popups")) { const s = document.createElement("style"); s.id = "rt-no-popups"; s.textContent = "#chat-notifications{pointer-events:none !important}"; document.head.append(s); } });
	check("CB-01", "Arena montada: 5 agentes armados e 6 ameaças", prep.rows.length === 5 && prep.threats === 6, JSON.stringify(prep.threats));
	const start = await ev(() => window.__rt.combatState());
	check("CB-02", "Combate aberto na rodada 1", start.round === 1, JSON.stringify(start));

	const closeDialogs = async () => {
		if (await dialog.count()) { await page.keyboard.press("Escape"); await sleep(300); }
		await ev(() => document.querySelectorAll(".application[id^=dialog]").forEach((d) => d.querySelector("[data-action=close]")?.click()));
	};
	const total = 11 * 3;
	let screens = 0, paid = 0, damagesChecked = 0;
	for (let i = 0; i < total; i++) {
		const cur = await ev(() => {
			const combat = game.combats.find((c) => c.scene?.id === canvas.scene.id);
			const c = combat.combatant;
			const t = canvas.tokens.get(c.tokenId);
			return { round: combat.round, name: c.name, actorId: t.actor.id, type: t.actor.type, hp: t.actor.system.attributes?.hp?.value ?? null, efeitos: t.actor.effects.map((e) => e.name) };
		});
		const entry = { n: i + 1, ...cur };
		if (cur.type === "agent") {
			const row = prep.rows.find((r) => r.id === cur.actorId);
			const mode = cur.round === 1 ? "simples" : cur.round === 2 ? "especial" : "shift";
			entry.modo = mode;
			// alvo: a ameaça viva mais próxima
			await ev(([aid]) => {
				const me = canvas.tokens.placeables.find((t) => t.actor?.id === aid);
				const th = canvas.tokens.placeables.filter((t) => t.name.startsWith("ZZ ameaça") && t.actor.system.attributes.hp.value > 0)
					.sort((a, b) => Math.hypot(a.center.x - me.center.x, a.center.y - me.center.y) - Math.hypot(b.center.x - me.center.x, b.center.y - me.center.y))[0];
				game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false }));
				th.setTarget(true, { releaseOthers: false, groupSelection: false });
				window.__ca.target = th.id;
				window.__ca.hp0 = th.actor.system.attributes.hp.value;
				window.__ca.seen = game.messages.contents.map((m) => m.id);
			}, [cur.actorId]);
			await closeDialogs();
			await ev((id) => game.actors.get(id).sheet.render(true), cur.actorId);
			await sleep(1300);
			await closeDialogs();
			await page.locator(`${sheetSel} [data-action=tab][data-tab=inventory]`).first().click().catch(() => {});
			await sleep(400);
			const btn = page.locator(`${sheetSel} .attack-btn`).first();
			const pe0 = await ev(([id, r]) => game.actors.get(id).system[r].value, [row.id, row.res]);
			if (mode === "shift") {
				await btn.click({ modifiers: ["Shift"] });
				await sleep(3200);
				entry.tela = !!(await dialog.count());
				check(`CB-R3-${cur.name}`, `Rodada 3, ${cur.name}: Shift+clique ataca sem tela e sem custo`, !entry.tela && (await ev(([id, r]) => game.actors.get(id).system[r].value, [row.id, row.res])) === pe0);
			} else {
				await btn.click();
				await dialog.waitFor({ timeout: 6000 }).catch(() => {});
				entry.tela = !!(await dialog.count());
				if (entry.tela) {
					screens++;
					entry.aplicados = await ev(() => [...document.querySelectorAll(".op-attack-dialog .op-ad-chip")].map((c) => c.innerText));
					const melee = /Machete/.test(row.weapon);
					const hasMao = entry.aplicados.some((c) => /M.o Pesada/i.test(c));
					const hasPara = entry.aplicados.some((c) => /Para Bellum/i.test(c));
					check(`CB-A-${cur.round}-${cur.name}`, `Rodada ${cur.round}, ${cur.name} (${row.weapon}): aplicados corretos para a arma`, melee ? (hasMao && !hasPara) : (hasPara && !hasMao), JSON.stringify(entry.aplicados));
					if (row.weaponMod) {
						check(`CB-MOD-${cur.round}`, "Modificação ligada à arma aparece entre os bônus aplicados", entry.aplicados.some((c) => /Modifica..o Certeira/.test(c)), JSON.stringify(entry.aplicados));
					}
					if (row.conditionQa) {
						const conditionText = await dialog.locator("[data-condition-list]").innerText();
						check(`CB-COND-SHOW-${cur.round}`, "Condições e seus efeitos aparecem na tela", /Agarrado/.test(conditionText) && /Vulner.vel/.test(conditionText) && /dado no ataque/.test(conditionText) && /Defesa/.test(conditionText), conditionText);
						if (cur.round === 1) {
							await dialog.locator(".op-ad-condition").filter({ hasText: "Vulnerável" }).locator('[data-action="remove-condition"]').click();
							await sleep(250);
							const state = await ev((id) => game.actors.get(id).effects.map((e) => e.getFlag("ordem_v2_classic", "condition")?.id).filter(Boolean), row.id);
							check("CB-COND-REMOVE-1", "Remover uma condição da tela remove o efeito real da ficha", !state.includes("vulnerable") && state.includes("grabbed"), JSON.stringify(state));
							entry.conditionsLeft = state;
						} else if (cur.round === 2) {
							await dialog.locator(".op-ad-condition").filter({ hasText: "Agarrado" }).locator('[data-action="remove-condition"]').click();
							await sleep(250);
							const state = await ev((id) => game.actors.get(id).effects.map((e) => e.getFlag("ordem_v2_classic", "condition")?.id).filter(Boolean), row.id);
							check("CB-COND-REMOVE-2", "Remover a penalidade de ataque também limpa Agarrado do agente", !state.includes("grabbed"), JSON.stringify(state));
							entry.conditionsLeft = state;
						}
					}
					if (row.sneak && mode === "especial") {
						const sneak = dialog.locator(".op-ad-row").filter({ hasText: "Ataque Furtivo" }).locator('input[type="checkbox"]');
						await sneak.check();
						check("CB-TRILHA", "Habilidade de trilha fica ativável na tela de ataque", await sneak.isChecked());
					}
					if (mode === "especial") {
						await dialog.locator("input[name^='pool.'][name$='.attack']").fill("1");
						await dialog.locator("input[name^='pool.'][name$='.damage']").fill("1");
						await dialog.locator("input[name=freeDamage]").fill("+1d6");
						await sleep(200);
						entry.totalTela = await dialog.locator("[data-total]").innerText();
					}
					await dialog.locator("button[data-action=attack]").click();
					await sleep(3200);
				}
			entry.rolagem = await ev((id) => {
				const message = [...game.messages].reverse().find((m) => m.speaker?.actor === id && m.getFlag("ordem_v2_classic", "messageRoll")?.type === "attack");
				return message ? { flavor: message.flavor, formula: message.rolls?.[0]?.formula ?? null, options: message.getFlag("ordem_v2_classic", "attackOptions") ?? null } : null;
			}, cur.actorId);
			if (row.conditionQa && cur.round === 1) {
				const names = entry.rolagem?.options?.conditions?.map((condition) => condition.name) ?? [];
				check("CB-COND-CARD", "Cartão da rolagem mostra a condição que permaneceu no agente", names.includes("Agarrado") && !names.includes("Vulnerável") && /1d20kh/.test(entry.rolagem?.formula ?? "") && /Agarrado/.test(entry.rolagem?.flavor ?? ""), JSON.stringify(entry.rolagem));
			}
			if (row.weaponMod && cur.round === 1) {
				check("CB-MOD-ROLL", "Bônus da modificação da arma chega ao cartão e à fórmula do ataque", entry.rolagem?.options?.used?.some((used) => used.label === "Modificação Certeira") && /\+ 2\b/.test(entry.rolagem?.formula ?? ""), JSON.stringify(entry.rolagem));
			}
				const pe1 = await ev(([id, r]) => game.actors.get(id).system[r].value, [row.id, row.res]);
				entry.custo = pe0 - pe1;
				const want = mode === "especial" ? (/NEX 05/.test(row.name) ? 2 : 3) + (row.sneak ? 1 : 0) : 0; // NEX 5: 1 acúmulo; Ataque Furtivo custa +1 PE
				if (entry.custo === want) paid++;
				check(`CB-C-${cur.round}-${cur.name}`, `Rodada ${cur.round}, ${cur.name}: custo cobrado = ${want} ${row.res}`, entry.custo === want, `pagou ${entry.custo}`);
			}
			// cartão da arma: botão de dano do chat
			await ev(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
			await sleep(700);
			const cardId = await ev(() => game.messages.contents.filter((m) => !window.__ca.seen.includes(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
			entry.cartao = !!cardId;
			if (cardId) {
				const n0 = await ev(() => game.messages.size);
				const dmgBtn = page.locator(`#chat .message[data-message-id="${cardId}"] button[data-action="damage"]`);
				if (await dmgBtn.count() && !(await dmgBtn.first().isDisabled())) {
					await dmgBtn.first().click();
					await sleep(3000);
					entry.dano = await ev((n) => game.messages.contents.slice(n).map((m) => (m.rolls ?? []).map((r) => r.formula).join(" ") ).filter(Boolean).join(" | "), n0);
					entry.hpAlvo = await ev(() => { const t = canvas.tokens.get(window.__ca.target); return `${window.__ca.hp0} → ${t.actor.system.attributes.hp.value}`; });
					if (mode === "especial") {
						damagesChecked++;
						const melee = /Machete/.test(row.weapon);
						const diceCount = (entry.dano.match(/1d6/g) ?? []).length;
						const ok = diceCount >= (row.sneak ? 2 : 1) && /\+ (10|7|2|5)\b/.test(entry.dano.replace(/\s+/g, " "));
						check(`CB-D-${cur.round}-${cur.name}`, `Rodada ${cur.round}, ${cur.name}: dano do cartão inclui +1d6 e o bônus do Ataque Especial`, ok, entry.dano);
					}
				}
			}
			await closeDialogs();
			await ev((id) => game.actors.get(id).sheet.close(), cur.actorId);
		} else {
			// ameaça: ataca pelo botão da própria ficha, sem tela de ataque
			await ev(() => { window.__ca.seen = game.messages.contents.map((m) => m.id); });
			await ev((id) => game.actors.get(id).sheet.render(true), cur.actorId);
			await sleep(1200);
			await closeDialogs();
			const tbtn = page.locator(`[id^=OrdemThreatSheet] [data-action=rollThreatItem]`).first();
			if (await tbtn.count()) {
				await tbtn.click().catch(() => {});
				await sleep(2500);
				entry.tela = !!(await dialog.count());
				entry.ataqueAmeaca = true;
				check(`CB-T-${cur.round}-${cur.name}`, `Rodada ${cur.round}, ameaça ${cur.name}: ataca sem abrir a tela de ataque`, !entry.tela);
			} else entry.ataqueAmeaca = false;
			await closeDialogs();
			await ev((id) => game.actors.get(id).sheet.close(), cur.actorId);
		}
		out.turnos.push(entry);
		await ev((r) => { window.__caResult = r; }, out);
		// avança o turno pelo carrossel de combate
		const adv = page.locator("button.crlngn-advance-turn").first();
		const clicked = await adv.click({ timeout: 6000 }).then(() => true).catch(() => false);
		if (!clicked) entry.semBotao = true;
		await sleep(2400);
	}

	const fim = await ev(() => ({ combate: window.__rt.combatState(), ameacas: window.__rt.threatState(), pe: window.__ca.rows.map((r) => `${r.name}: ${game.actors.get(r.id).system[r.res].value}`), erros: window.__rt.info().errors }));
	out.fim = fim;
	check("CB-90", "Carrossel avançou 3 rodadas completas (rodada 4 em curso)", fim.combate.round === 4, JSON.stringify(fim.combate));
	check("CB-91", "Todos os turnos de agente abriram o cartão da arma", out.turnos.filter((t) => t.type === "agent").every((t) => t.cartao), "");
	check("CB-92", "Nenhum erro de script durante o combate", fim.erros === 0, `erros=${fim.erros}`);
	check("CB-93", `Tela de ataque abriu nas rodadas 1 e 2 (10 turnos): ${screens}`, screens === 10, String(screens));
	out.resumo = { telas: screens, custosCorretos: paid, danosEspeciais: damagesChecked, turnosSemBotao: out.turnos.filter((t) => t.semBotao).length };
	await ev((r) => { window.__caResult = r; }, out);
	await ev(() => window.__rt.close());
	out.limpezaArena = "arena temporária, fichas e mensagens de teste removidas";
	await ev((r) => { window.__caResult = r; }, out);
	return out;
}
