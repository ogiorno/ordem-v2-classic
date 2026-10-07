// Playwright (run-code): tela de ataque pela interface de verdade (docs/spec-tela-de-ataque.md).
//   playwright-cli -s=ao run-code --filename=scripts/ui-ataque.js
// A página precisa estar no jogo como Mestre. Cria e apaga só atores/mensagens "[AO] ui ...". Resultado: window.__aoUi.
async (page) => {
	const out = [];
	const add = (id, caso, ok, detalhe) => { out.push({ id, caso, ok: !!ok, detalhe }); console.log(`${ok ? "OK  " : "FALHA"} ${id} ${caso} ${ok ? "" : detalhe ?? ""}`); };
	const sleep = (ms) => page.waitForTimeout(ms);
	const ev = (fn, arg) => page.evaluate(fn, arg);
	const dialog = page.locator(".op-attack-dialog");
	const sheetSel = "[id^=OrdemActorSheet]";

	// ---- fixture: agente combatente com pistola, Ataque Especial, Para Bellum e Mão Pesada
	const fx = await ev(async () => {
		const SYS = "ordem_v2_classic";
		const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
		const fp = async (p, n) => { const pack = game.packs.get(`${SYS}.${p}`); const e = (await pack.getIndex()).find((x) => norm(x.name) === norm(n)); const d = (await pack.getDocument(e._id)).toObject(); delete d._id; return d; };
		for (const a of game.actors.filter((x) => x.name.startsWith("[AO] ui"))) await a.delete();
		const a = await Actor.create({ name: "[AO] ui atirador", type: "agent", system: { nivel: { value: 12 }, attributes: { dex: { value: 3 }, str: { value: 2 }, vit: { value: 2 }, pre: { value: 3 }, int: { value: 2 } } } });
		await a.createEmbeddedDocuments("Item", [await fp("classes", "Combatente")]);
		const [gun] = await a.createEmbeddedDocuments("Item", [await fp("armaments", "Pistola Pesada")]);
		await a.createEmbeddedDocuments("Item", [await fp("fighterPowers", "Ataque Especial"), await fp("originPowers", "Para Bellum"), await fp("originPowers", "Mão Pesada")]);
		await a.update({ "system.PD.max": 40, "system.PD.value": 40, "system.PE.max": 40, "system.PE.value": 40 });
		window.__aoFx = { id: a.id, gun: gun.id, known: game.messages.contents.map((m) => m.id) };
		return { id: a.id, gun: gun.id, res: a.usingWithoutSanityRule ? "PD" : "PE" };
	});
	const bal = () => ev(([id, res]) => game.actors.get(id).system[res].value, [fx.id, fx.res]);
	const msgs = () => ev(() => game.messages.contents.filter((m) => !window.__aoFx.known.includes(m.id)).length);
	const lastMsg = () => ev(() => { const m = game.messages.contents.filter((x) => !window.__aoFx.known.includes(x.id)).at(-1); return m ? { id: m.id, text: m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600), flag: m.getFlag("ordem_v2_classic", "attackOptions") ?? null } : null; });
	const closeAnyDialog = async () => { if (await dialog.count()) { await page.keyboard.press("Escape"); await sleep(400); } };

	try {
		await ev((id) => { game.actors.get(id).sheet.render(true); }, fx.id);
		await sleep(1500);
		await ev(() => document.querySelectorAll(".application[id^=dialog]").forEach((d) => d.querySelector("[data-action=close]")?.click()));
		await page.locator(`${sheetSel} [data-action=tab][data-tab=inventory]`).click();
		await sleep(500);
		const attackBtn = page.locator(`${sheetSel} .attack-btn`).first();
		add("UI-01", "A ficha tem o botão Atacar na arma", await attackBtn.count() === 1);

		// UI-02 abre sempre, com os blocos da spec
		await attackBtn.click();
		await dialog.waitFor({ timeout: 5000 }).catch(() => {});
		const open = await dialog.count();
		const info = open ? await ev(() => {
			const d = document.querySelector(".op-attack-dialog");
			return {
				aplicados: [...d.querySelectorAll(".op-ad-chip")].map((c) => c.innerText),
				pool: d.querySelectorAll("input[name^='pool.']").length,
				livres: [!!d.querySelector("input[name=freeAttack]"), !!d.querySelector("input[name=freeDamage]")],
				total: d.querySelector("[data-total]")?.innerText, saldo: d.querySelector("[data-left]")?.innerText,
				botoes: [...d.querySelectorAll("button")].map((b) => b.innerText.trim()),
			};
		}) : null;
		add("UI-02", "Clique em Atacar abre a tela (aplicados, Ataque Especial com 2 contadores, bônus livres, total e saldo)", open && info.pool === 2 && info.livres.every(Boolean) && info.aplicados.length > 0 && /Atacar/.test(info.botoes.join()), JSON.stringify(info));
		add("UI-03", "Aplicados mostram o Para Bellum (arma de fogo) e não a Mão Pesada (corpo a corpo)", open && info.aplicados.some((c) => /Para Bellum/i.test(c)) && !info.aplicados.some((c) => /M.o Pesada/i.test(c)), JSON.stringify(info?.aplicados));
		add("UI-04", "Rodapé: custo 0 e saldo igual ao que o agente tem", open && /^0/.test(info.total) && String(info.saldo).trim() === String(await bal()), JSON.stringify(info));

		// UI-05 total ao vivo
		await dialog.locator("input[name^='pool.'][name$='.attack']").fill("1");
		await dialog.locator("input[name^='pool.'][name$='.damage']").fill("1");
		await sleep(200);
		const live = await dialog.locator("[data-total]").innerText();
		const liveLeft = await dialog.locator("[data-left]").innerText();
		add("UI-05", "Total ao vivo: 1 acúmulo no ataque + 1 no dano = 3 PE (2 + 1); saldo cai", /^3/.test(live) && liveLeft.trim() === String((await bal()) - 3), `${live} / ${liveLeft}`);

		// UI-06 cancelar não rola nem gasta
		const before = { pe: await bal(), m: await msgs() };
		await page.keyboard.press("Escape");
		await sleep(1200);
		add("UI-06", "Fechar a tela não rola, não gasta e não deixa cartão", !(await dialog.count()) && await bal() === before.pe && await msgs() === before.m, `pe ${before.pe}→${await bal()}; msgs ${before.m}→${await msgs()}`);

		// UI-07 confirmar com Ataque Especial + bônus livre
		await attackBtn.click();
		await dialog.waitFor({ timeout: 5000 });
		await dialog.locator("input[name^='pool.'][name$='.attack']").fill("1");
		await dialog.locator("input[name^='pool.'][name$='.damage']").fill("1");
		await dialog.locator("input[name=freeDamage]").fill("+1d6");
		await sleep(200);
		const peBefore = await bal();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3500);
		const peAfter = await bal();
		const card = await lastMsg();
		add("UI-07", "Atacar: paga 3 PE ao confirmar", peBefore - peAfter === 3, `${peBefore}→${peAfter}`);
		await ev(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
		await sleep(1200);
		const weaponId = await ev(() => game.messages.contents.filter((m) => !window.__aoFx.known.includes(m.id) && m.getFlag("ordem_v2_classic", "attackOptions")).at(-1)?.id ?? null);
		const allText = weaponId ? await page.locator(`#chat .message[data-message-id="${weaponId}"]`).first().innerText().catch(() => "") : "";
		add("UI-08", "Cartão do ataque mostra o que foi usado e o custo", /Ataque Especial/i.test(allText) && /3\s*(PE|PD)/i.test(allText), allText.slice(0, 500));
		// o cartão da arma é a mensagem com o botão de dano (a rolagem do ataque é outra mensagem)
		const weaponCardId = await ev(() => game.messages.contents.filter((m) => !window.__aoFx.known.includes(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
		const cardHasFlag = await ev((id) => !!game.messages.get(id)?.getFlag("ordem_v2_classic", "attackOptions"), weaponCardId);
		add("UI-09", "As opções ficam guardadas no cartão da arma (flag attackOptions)", !!weaponCardId && cardHasFlag);

		// UI-10 dano do cartão aplica as mesmas opções
		const dmgBtn = page.locator(`#chat .message[data-message-id="${weaponCardId}"] button[data-action="damage"]`);
		const hasDmg = await dmgBtn.count();
		let dmgText = "";
		if (hasDmg) {
			const n0 = await msgs();
			await dmgBtn.first().click();
			await sleep(3500);
			dmgText = await ev((n) => game.messages.contents.filter((m) => !window.__aoFx.known.includes(m.id)).slice(n).map((m) => `${m.flavor ?? ""} ${(m.rolls ?? []).map((r) => r.formula).join(" ")} ${m.content.replace(/<[^>]+>/g, " ")}`).join(" || ").replace(/\s+/g, " "), n0);
		}
		add("UI-10", "Botão de dano do cartão aplica +5 (Ataque Especial), +1d6 livre e +2 (Para Bellum)", hasDmg && /2d8 \+ 7 \+ 1d6/.test(dmgText), `botao=${hasDmg}; esperado "2d8 + 7 + 1d6" (7 = 5 do Ataque Especial + 2 do Para Bellum); veio: ${dmgText.slice(0, 300)}`);

		// UI-11 Shift+clique ataca direto
		const pe2 = await bal(), m2 = await msgs();
		await attackBtn.click({ modifiers: ["Shift"] });
		await sleep(3500);
		add("UI-11", "Shift+clique ataca direto: sem tela, sem custo, cartão novo", !(await dialog.count()) && await bal() === pe2 && await msgs() > m2, `tela=${await dialog.count()} pe ${pe2}→${await bal()} msgs ${m2}→${await msgs()}`);
		await closeAnyDialog();

		// UI-12 PE insuficiente avisa e não rola
		await ev((id) => game.actors.get(id).update({ "system.PE.value": 1, "system.PD.value": 1 }), fx.id);
		await sleep(400);
		await attackBtn.click();
		await dialog.waitFor({ timeout: 5000 });
		await dialog.locator("input[name^='pool.'][name$='.attack']").fill("1");
		await sleep(200);
		const short = await dialog.locator("[data-total]").evaluate((e) => e.classList.contains("is-short"));
		const m3 = await msgs();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(1500);
		add("UI-12", "PE insuficiente: total marcado em vermelho e o ataque não rola", short && await msgs() === m3 && await bal() === 1, `short=${short} msgs ${m3}→${await msgs()} pe=${await bal()}`);
		await closeAnyDialog();

		// UI-13 ameaça ataca direto, sem tela
		const thr = await ev(async () => {
			const base = game.actors.getName("Aberração de Carne") ?? game.actors.find((a) => a.type === "threat");
			const d = base.toObject(); delete d._id; d.name = "[AO] ui ameaca";
			const t = await Actor.create(d);
			const item = t.items.find((i) => i.system?.formulas?.attack) ?? t.items.contents[0];
			window.__aoFx.threat = t.id;
			return { id: t.id, item: item?.id, nome: item?.name };
		});
		if (thr.item) {
			const m4 = await msgs();
			await ev(async ([a, i]) => { await game.actors.get(a).items.get(i).rollAttack({ event: { shiftKey: false, type: "click" } }); }, [thr.id, thr.item]);
			await sleep(2500);
			add("UI-13", "Ameaça atacando com clique: sem tela de ataque, rola direto", !(await dialog.count()) && await msgs() > m4, `${thr.nome}; tela=${await dialog.count()}`);
		} else add("UI-13", "Ameaça atacando direto", false, "ameaça sem item de ataque");
	} catch (error) {
		add("ERRO", "exceção no teste", false, String(error).slice(0, 400));
	} finally {
		await closeAnyDialog().catch(() => {});
		await ev(async () => {
			const ids = [window.__aoFx?.id, window.__aoFx?.threat].filter(Boolean);
			const msg = game.messages.contents.filter((m) => !window.__aoFx.known.includes(m.id) && ids.includes(m.speaker?.actor)).map((m) => m.id);
			for (let i = 0; i < msg.length; i += 100) await ChatMessage.deleteDocuments(msg.slice(i, i + 100)).catch(() => {});
			for (const a of game.actors.filter((x) => x.name.startsWith("[AO] ui"))) await a.delete().catch(() => {});
		}).catch(() => {});
		await ev((o) => { window.__aoUi = o; }, out);
	}
	return { total: out.length, passou: out.filter((r) => r.ok).length, falhou: out.filter((r) => !r.ok).map((r) => `${r.id} ${r.caso}: ${r.detalhe ?? ""}`) };
}
