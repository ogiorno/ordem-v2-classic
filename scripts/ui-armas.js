// Playwright (run-code): combate com armas sob condições, modificações e poderes de classe, pela interface.
//   playwright-cli -s=ar run-code --filename=scripts/ui-armas.js      (entrar como Mestre antes)
// Cria e apaga só "[AR] ...". Resultado em window.__arUi.
async (page) => {
	const out = [];
	const add = (id, caso, ok, detalhe) => { out.push({ id, caso, ok: !!ok, detalhe }); console.log(`${ok ? "OK  " : "FALHA"} ${id} ${caso} ${ok ? "" : detalhe ?? ""}`); };
	const sleep = (ms) => page.waitForTimeout(ms);
	const ev = (fn, arg) => page.evaluate(fn, arg);
	const dialog = page.locator(".op-attack-dialog");
	const sheetSel = "[id^=OrdemActorSheet]";

	const fx = await ev(async () => {
		const SYS = "ordem_v2_classic";
		const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
		const fp = async (p, n) => { const pack = game.packs.get(`${SYS}.${p}`); const e = (await pack.getIndex()).find((x) => norm(x.name) === norm(n)); const d = (await pack.getDocument(e._id)).toObject(); delete d._id; return d; };
		window.__arFp = fp;
		for (const a of game.actors.filter((x) => x.name.startsWith("[AR]"))) await a.delete();
		for (const m of game.messages.filter((x) => x.content?.includes("[AR]"))) await m.delete();
		const a = await Actor.create({ name: "[AR] atirador", type: "agent", system: { nivel: { value: 12 }, attributes: { dex: { value: 3 }, str: { value: 2 }, vit: { value: 2 }, pre: { value: 3 }, int: { value: 2 } } } });
		await a.createEmbeddedDocuments("Item", [await fp("armaments", "Pistola Pesada"), await fp("armaments", "Faca")]);
		const gun = a.items.find((i) => i.name === "Pistola Pesada"), knife = a.items.find((i) => i.name === "Faca");
		await a.update({ "system.PD.max": 60, "system.PD.value": 60, "system.PE.max": 60, "system.PE.value": 60 });
		window.__arFx = { id: a.id, gun: gun.id, knife: knife.id, known: game.messages.contents.map((m) => m.id) };
		const at = gun.system.formulas.attack;
		return { id: a.id, gun: gun.id, knife: knife.id, attr: a.system.attributes[at.attr].value, attrKey: at.attr, skill: at.skill, name: gun.name };
	});
	const actorOf = () => `game.actors.get("${fx.id}")`;
	const clearConds = () => ev(async (id) => { const a = game.actors.get(id); const ids = a.effects.filter((e) => e.getFlag("ordem_v2_classic", "condition")).map((e) => e.id); if (ids.length) await a.deleteEmbeddedDocuments("ActiveEffect", ids); }, fx.id);
	const addCond = (cid) => ev(async ([id, c]) => {
		const eng = await import("/systems/ordem_v2_classic/module/macros/ritual-area-engine.mjs");
		await eng.applyCondition(game.actors.get(id), c, { itemId: "armas" });
	}, [fx.id, cid]);
	const newMsgs = () => ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id)).map((m) => ({ id: m.id, rolls: (m.rolls ?? []).map((r) => r.formula), flag: m.getFlag("ordem_v2_classic", "attackOptions") ?? null, text: m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500) })));
	const mark = () => ev(() => { window.__arFx.known = game.messages.contents.map((m) => m.id); });
	const closeAll = async () => { if (await dialog.count()) { await page.keyboard.press("Escape"); await sleep(300); } await ev(() => document.querySelectorAll(".application[id^=dialog]").forEach((d) => d.querySelector("[data-action=close]")?.click())); };
	const openSheet = async () => {
		await ev((id) => game.actors.get(id).sheet.render(true), fx.id);
		await sleep(1200);
		await closeAll();
		await page.locator(`${sheetSel} [data-action=tab][data-tab=inventory]`).first().click().catch(() => {});
		await sleep(400);
	};
	const press = async (itemId, opts) => { if (!(await btn(itemId).count())) await openSheet(); await btn(itemId).click(opts); };
	const btn = (itemId) => page.locator(`${sheetSel} .item[data-item-id="${itemId}"] .attack-btn`).first();
	const d20 = (f) => { const m = /^(\d+)d20(k[hl])?/.exec(f ?? ""); return m ? { n: Number(m[1]), mode: m[2] ?? "" } : null; };
	// Shift+clique: ataca direto (as condições valem do mesmo jeito)
	const attackDirect = async (itemId) => { await mark(); await press(itemId, { modifiers: ["Shift"] }); await sleep(3000); return newMsgs(); };
	const rollFormula = (msgs) => msgs.flatMap((m) => m.rolls).find((f) => /d20/.test(f));

	try {
		await openSheet();
		// ---------- A. Condições x ataque com arma
		await clearConds();
		let r = await attackDirect(fx.gun);
		let f = d20(rollFormula(r));
		add("AR-01", `Sem condição: ataque rola ${fx.attr}d20 (atributo ${fx.attrKey})`, f && f.n === fx.attr && f.mode === "kh", rollFormula(r));

		await addCond({ key: "restrain" });
		await sleep(500);
		r = await attackDirect(fx.gun);
		f = d20(rollFormula(r));
		add("AR-02", "Agarrado: o ataque perde 1 d20", f && f.n === fx.attr - 1 && f.mode === "kh", rollFormula(r));
		const withCond = r.find((m) => m.flag?.conditions?.length);
		add("AR-03", "Cartão do ataque registra a condição aplicada (flag attackOptions.conditions)", !!withCond, JSON.stringify(r.map((m) => m.flag)));

		// tela de ataque mostra a condição
		await press(fx.gun);
		await dialog.waitFor({ timeout: 6000 }).catch(() => {});
		const panel = await ev(() => { const d = document.querySelector(".op-attack-dialog"); const b = d?.querySelector("[data-condition-block]"); return d ? { open: true, visible: !!b && !b.hidden, text: b?.innerText ?? "", remove: !!d.querySelector("[data-action=remove-condition]") } : { open: false }; });
		add("AR-04", "Tela de ataque abre e mostra o bloco de condições com o Agarrado", panel.open && panel.visible && /Agarrado/i.test(panel.text), JSON.stringify(panel));
		if (panel.remove) {
			await dialog.locator("[data-action=remove-condition]").first().click();
			await sleep(800);
			const gone = await ev((id) => game.actors.get(id).effects.filter((e) => e.getFlag("ordem_v2_classic", "condition")).length, fx.id);
			const hidden = await ev(() => document.querySelector(".op-attack-dialog [data-condition-block]")?.hidden);
			add("AR-05", "Botão de remover condição na tela tira o efeito e esconde o bloco", gone === 0 && hidden === true, `efeitos=${gone} oculto=${hidden}`);
		} else add("AR-05", "Botão de remover condição na tela", false, "botão não existe nesta tela (template antigo em memória? reinicie o servidor)");
		await closeAll();
		await sleep(400);

		// atributo 1 + condição: 0 dados → 2d20 pior
		await clearConds();
		await ev(([id, key]) => game.actors.get(id).update({ [`system.attributes.${key}.value`]: 1 }), [fx.id, fx.attrKey]);
		await addCond({ key: "restrain" });
		await sleep(500);
		r = await attackDirect(fx.gun);
		f = d20(rollFormula(r));
		add("AR-06", "Atributo 1 + Agarrado (0 dados): rola 2d20 e fica com o pior", f && f.n === 2 && f.mode === "kl", rollFormula(r));
		await clearConds();
		await ev(([id, key, v]) => game.actors.get(id).update({ [`system.attributes.${key}.value`]: v }), [fx.id, fx.attrKey, fx.attr]);

		// Atordoado: sem ações
		await addCond({ key: "stun" });
		await sleep(500);
		r = await attackDirect(fx.gun);
		const stunnedAttack = r.some((m) => m.rolls.some((x) => /d20/.test(x)));
		add("AR-07", "Atordoado (sem ações): o ataque é impedido", !stunnedAttack, stunnedAttack ? "o ataque rolou normalmente: a condição não bloqueia o ataque com arma" : "");
		await clearConds();

		// Vulnerável no alvo: Defesa -2 vale no confronto
		const def = await ev(async ([id]) => {
			const scene = canvas.scene;
			const threat = await Actor.create({ name: "[AR] alvo", type: "threat" });
			const [td] = await scene.createEmbeddedDocuments("Token", [{ name: "[AR] alvo", actorId: threat.id, x: 300, y: 300, actorLink: true }]);
			await new Promise((r) => setTimeout(r, 600));
			const tok = canvas.tokens.get(td.id);
			const base = threat.system.defense.value;
			const eng = await import("/systems/ordem_v2_classic/module/macros/ritual-area-engine.mjs");
			await eng.applyCondition(threat, { label: "Vulnerável" }, { itemId: "armas" });
			window.__arFx.target = td.id;
			return { base, vuln: threat.system.defense.value, token: td.id };
		}, [fx.id]);
		add("AR-08", "Alvo Vulnerável: Defesa cai 2 na ficha", def.vuln === def.base - 2, JSON.stringify(def));
		await ev((tid) => { game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false })); canvas.tokens.get(tid).setTarget(true, { releaseOthers: false, groupSelection: false }); }, def.token);
		r = await attackDirect(fx.gun);
		const hitDef = await ev(([id, gun, tid]) => game.actors.get(id).items.get(gun)._compareWithDefense(canvas.tokens.get(tid).actor, 10, null)?.targetDefense, [fx.id, fx.gun, def.token]);
		const linked = await ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id)).some((m) => m.getFlag("ordem_v2_classic", "hitResult")?.actorUuid?.includes("Actor.")));
		add("AR-09", "O ataque contra o Vulnerável confronta com a Defesa reduzida e guarda o alvo no cartão", hitDef === def.vuln && linked, `defesa usada ${hitDef}, esperada ${def.vuln}; alvo no cartão: ${linked}`);

		// ---------- B. Modificações da arma
		await ev(([id, gun]) => game.actors.get(id).items.get(gun).update({ "system.formulas.attack.bonus": "3" }), [fx.id, fx.gun]);
		r = await attackDirect(fx.gun);
		add("AR-10", "Bônus de ataque da arma (+3) entra na rolagem", /\+ 3/.test(rollFormula(r) ?? ""), rollFormula(r));
		await ev(([id, gun]) => game.actors.get(id).items.get(gun).update({ "system.formulas.attack.bonus": "" }), [fx.id, fx.gun]);

		// modificação como efeito "ao usar" na própria arma (ex.: mira laser +2 no ataque e +1 no dano)
		await ev(async ([id, gun]) => {
			const item = game.actors.get(id).items.get(gun);
			await item.createEmbeddedDocuments("ActiveEffect", [{ name: "[AR] Mira laser", disabled: false, flags: { ordem_v2_classic: { onUse: { enabled: true, applies: "ranged", auto: true, attackBonus: 2, damageBonus: "1" } } } }]);
		}, [fx.id, fx.gun]);
		await sleep(400);
		await mark();
		await press(fx.gun);
		await dialog.waitFor({ timeout: 6000 }).catch(() => {});
		const chips = await ev(() => [...document.querySelectorAll(".op-attack-dialog .op-ad-chip")].map((c) => c.innerText));
		add("AR-11", "Modificação 'Mira laser' na arma aparece em 'Já aplicados' na tela", chips.some((c) => /Mira laser/i.test(c)), JSON.stringify(chips));
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3200);
		r = await newMsgs();
		add("AR-12", "A modificação entra na rolagem de ataque (+2)", /\+ 2\b/.test(rollFormula(r) ?? ""), rollFormula(r));
		await ev(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
		await sleep(900);
		const cardId = await ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
		const dmgBtn = page.locator(`#chat .message[data-message-id="${cardId}"] button[data-action="damage"]`);
		let dmg = "";
		if (cardId && await dmgBtn.count() && !(await dmgBtn.first().isDisabled())) {
			const n = await ev(() => game.messages.size);
			await dmgBtn.first().click();
			await sleep(3000);
			dmg = await ev((n0) => game.messages.contents.slice(n0).map((m) => (m.rolls ?? []).map((x) => x.formula).join(" ")).filter(Boolean).join(" | "), n);
		}
		add("AR-13", "A modificação entra no dano (+1 da Mira laser)", /\+ 1\b/.test(dmg), `dano: ${dmg || "(botão de dano desabilitado: ataque errou)"}`);

		// efeito de ficha no perícia do ataque aparece em "Já aplicados"
		await ev(([id, skill]) => game.actors.get(id).createEmbeddedDocuments("ActiveEffect", [{ name: "[AR] Treino extra", changes: [{ key: `system.skills.${skill}.mod`, mode: 2, value: "4" }] }]), [fx.id, fx.skill]);
		await sleep(400);
		await press(fx.gun);
		await dialog.waitFor({ timeout: 6000 }).catch(() => {});
		const chips2 = await ev(() => [...document.querySelectorAll(".op-attack-dialog .op-ad-chip")].map((c) => c.innerText));
		add("AR-14", "Efeito de ficha na perícia do ataque (+4) aparece em 'Já aplicados'", chips2.some((c) => /Treino extra/i.test(c)), JSON.stringify(chips2));
		await closeAll();

		// ---------- C. Poderes de classe
		const cls = await ev(async ([id]) => {
			const a = game.actors.get(id);
			const [klass] = await a.createEmbeddedDocuments("Item", [await window.__arFp("classes", "Combatente")]);
			const pack = game.packs.get("ordem_v2_classic.fighterPowers");
			const index = await pack.getIndex();
			const docs = [];
			for (const e of index) { const d = (await pack.getDocument(e._id)).toObject(); delete d._id; docs.push(d); }
			const created = await a.createEmbeddedDocuments("Item", docs);
			return { klass: klass.id, powers: created.map((i) => ({ id: i.id, name: i.name, effects: i.effects.size, onUse: i.effects.filter((e) => e.getFlag("ordem_v2_classic", "onUse")?.enabled).map((e) => e.name) })) };
		}, [fx.id]);
		await ev((id) => game.actors.get(id).sheet.render(true), fx.id);
		await sleep(1800);
		const seen = await ev(([ids, klass]) => {
			const root = document.querySelector("[id^=OrdemActorSheet]");
			const has = (id) => !!root.querySelector(`[data-item-id="${id}"]`);
			return { classe: has(klass), poderes: ids.map((p) => [p.name, has(p.id)]) };
		}, [cls.powers.map((p) => ({ id: p.id, name: p.name })), cls.klass]);
		add("AR-15", "Classe Combatente adicionada aparece na ficha", seen.classe);
		const missing = seen.poderes.filter(([, ok]) => !ok).map(([n]) => n);
		add("AR-16", `Poderes de combatente adicionados (${cls.powers.length}) aparecem todos na ficha`, missing.length === 0, `faltam: ${missing.join(", ")}`);

		// quais poderes viram opção na tela de ataque
		await openSheet();
		await press(fx.gun);
		await dialog.waitFor({ timeout: 6000 }).catch(() => {});
		const screen = await ev(() => { const d = document.querySelector(".op-attack-dialog"); return d ? { text: d.innerText.replace(/\s+/g, " ") } : null; });
		const expected = cls.powers.filter((p) => p.onUse.length).map((p) => p.name);
		const notShown = expected.filter((n) => !new RegExp(n.split(" ")[0], "i").test(screen?.text ?? ""));
		add("AR-17", `Poderes com opção "ao usar" (${expected.join(", ") || "nenhum"}) aparecem na tela de ataque`, !!screen && notShown.length === 0, `não apareceram: ${notShown.join(", ")}`);
		await closeAll();

		// remover o poder tira a opção
		const atk = cls.powers.find((p) => p.name === "Ataque Especial");
		if (atk) {
			await ev(([id, pid]) => game.actors.get(id).items.get(pid).delete(), [fx.id, atk.id]);
			await sleep(600);
			await openSheet();
			await press(fx.gun);
			await dialog.waitFor({ timeout: 6000 }).catch(() => {});
			const t2 = await ev(() => document.querySelector(".op-attack-dialog")?.innerText ?? "");
			const sheetStill = await ev(([pid]) => !!document.querySelector(`[id^=OrdemActorSheet] [data-item-id="${pid}"]`), [atk.id]);
			add("AR-18", "Remover o Ataque Especial tira o poder da ficha e a opção da tela", !/Ataque Especial/i.test(t2) && !sheetStill, `na tela: ${/Ataque Especial/i.test(t2)}; na ficha: ${sheetStill}`);
			await closeAll();
		}
	} catch (e) {
		add("ERRO", "Exceção no teste", false, String(e).slice(0, 400));
	} finally {
		await closeAll();
		await ev(async () => {
			for (const a of game.actors.filter((x) => x.name.startsWith("[AR]"))) await a.delete();
			const toks = canvas.scene.tokens.filter((t) => t.name.startsWith("[AR]")).map((t) => t.id);
			if (toks.length) await canvas.scene.deleteEmbeddedDocuments("Token", toks);
			const ids = game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id)).map((m) => m.id);
			if (ids.length) await ChatMessage.deleteDocuments(ids);
		}).catch(() => {});
		await ev((r) => { window.__arUi = r; }, out);
	}
	const ok = out.filter((x) => x.ok).length;
	console.log(`${ok}/${out.length}`);
	return { ok, total: out.length, falhas: out.filter((x) => !x.ok) };
}
