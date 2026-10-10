// Playwright (run-code): combate com armas sob condições, modificações e poderes de classe, pela interface.
//   playwright-cli -s=ar run-code --filename=scripts/ui-armas.js      (entrar como Mestre antes)
// Cria e apaga só "[AR] ...". Resultado em window.__arUi.
async (page) => {
	const out = [];
	const add = (id, caso, ok, detalhe) => { out.push({ id, caso, ok: !!ok, detalhe }); console.log(`${ok ? "OK  " : "FALHA"} ${id} ${caso} ${ok ? "" : detalhe ?? ""}`); };
	const sleep = (ms) => page.waitForTimeout(ms);
	const ev = (fn, arg) => page.evaluate(fn, arg);
	// O módulo dev-reload dá F5 no navegador a cada arquivo salvo (por qualquer sessão): isso derruba o teste no meio.
	// Bloqueia o canal de reload desta página; a primeira vez recarrega uma vez para soltar a conexão já aberta.
	await page.route("http://127.0.0.1:35729/**", (route) => route.abort());
	if (!(await page.evaluate(() => window.__noDevReload))) {
		await page.reload();
		await page.waitForFunction(() => globalThis.game?.ready, null, { timeout: 90000 });
		await page.waitForTimeout(3000);
		await page.evaluate(() => { window.__noDevReload = true; });
	}
	// A tela de subida de nível (level-up-screen.mjs) abre sozinha quando o teste muda o nível dos agentes de teste
	// e cobre a ficha; fecha qualquer uma que aparecer.
	await page.evaluate(() => {
		if (window.__luObserver) return;
		const kill = () => { for (const el of document.querySelectorAll(".op-levelup-overlay")) { try { game.system.levelUp?.close?.(); } catch { /* sem tela aberta */ } el.remove(); } };
		window.__luObserver = new MutationObserver(kill);
		window.__luObserver.observe(document.body, { childList: true, subtree: true });
		kill();
	});
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
	const newMsgs = () => ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id) && m.author?.id === game.user.id).map((m) => ({ id: m.id, rolls: (m.rolls ?? []).map((r) => r.formula), flag: m.getFlag("ordem_v2_classic", "attackOptions") ?? null, text: m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500) })));
	const mark = () => ev(() => { window.__arFx.known = game.messages.contents.map((m) => m.id); });
	const closeAll = async () => { for (let i = 0; i < 12 && (await dialog.count()); i++) { await page.keyboard.press("Escape"); await sleep(350); } await ev(() => document.querySelectorAll(".application[id^=dialog]").forEach((d) => d.querySelector("[data-action=close]")?.click())); };
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
		const chips = await ev(() => [...document.querySelectorAll(".op-attack-dialog .op-ad-applied-row")].map((c) => c.innerText));
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
		const chips2 = await ev(() => [...document.querySelectorAll(".op-attack-dialog .op-ad-applied-row")].map((c) => c.innerText));
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
		await sleep(800);
		const labels = await ev(() => [...document.querySelectorAll(".op-attack-dialog .op-ad-name strong, .op-attack-dialog .op-ad-applied-row strong")].map((e) => e.innerText.trim()));
		const should = ["Ataque Especial", "Golpe Demolidor", "Combate Defensivo"]; // valem para qualquer arma
		const shouldNot = ["Golpe Pesado", "Tiro Certeiro", "Técnica Letal"]; // corpo a corpo / arma de disparo: não valem para a pistola
		const powMissing = should.filter((n) => !labels.some((l) => l === n));
		const extra = shouldNot.filter((n) => labels.some((l) => l === n || l.endsWith(n)));
		const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
		add("AR-17", "Poderes que valem para a Pistola aparecem na tela pelo nome, uma vez só, e os de outras armas não", powMissing.length === 0 && extra.length === 0 && dup.length === 0, `faltam: ${powMissing.join(", ")}; sobraram: ${extra.join(", ")}; repetidos: ${dup.join(", ")}`);
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

		// ---------- D. A arma na tela: empunhadura, modos, atributo, alcance, bloqueios e poderes integrados
		await ev(async ([id]) => {
			const a = game.actors.get(id);
			for (const it of a.items.filter((i) => i.type === "armament")) await it.delete();
			const created = await a.createEmbeddedDocuments("Item", [await window.__arFp("armaments", "Faca"), await window.__arFp("armaments", "Katana"), await window.__arFp("armaments", "Fuzil de Assalto"), await window.__arFp("armaments", "Pistola"), await window.__arFp("armaments", "Machete")]);
			window.__arW = Object.fromEntries(created.map((i) => [i.name, i.id]));
			await a.update({ "system.skills.aim.value": 100, "system.skills.fighting.value": 100, "system.skills.fighting.degree.label": "veteran", "system.attributes.str.value": 1, "system.attributes.dex.value": 4, "system.PE.value": 60, "system.PD.value": 60 });
			// cena própria só com o agente e um alvo; o Mestre volta para a cena de antes no fim
			window.__arPrev = canvas.scene?.id;
			const scene = await Scene.create({ name: "[AR] cena de armas", width: 2400, height: 1200, padding: 0, grid: { size: 100, distance: 1.5, units: "m" }, tokenVision: false });
			await scene.view();
			for (let i = 0; i < 60 && canvas.scene?.id !== scene.id; i++) await new Promise((r) => setTimeout(r, 250));
			const threat = await Actor.create({ name: "[AR] alvo", type: "threat" });
			const tok = (await a.getTokenDocument({ x: 100, y: 300 })).toObject();
			tok.actorLink = true;
			const tt = (await threat.getTokenDocument({ x: 200, y: 300 })).toObject();
			tt.actorLink = true;
			const [me, foe] = await scene.createEmbeddedDocuments("Token", [tok, tt]);
			await new Promise((r) => setTimeout(r, 800));
			const byName = (n) => scene.tokens.find((t) => t.name === n)?.id;
			window.__arScene = { id: scene.id, me: byName("[AR] atirador"), foe: byName("[AR] alvo") }; // a ordem devolvida pela criação não é garantida
		}, [fx.id]);
		const W = await ev(() => window.__arW);
		const moveFoe = (squares) => ev(async (n) => {
			const want = 100 + n * 100;
			for (let i = 0; i < 60 && canvas.scene?.id !== window.__arScene.id; i++) await new Promise((r) => setTimeout(r, 150));
			await game.scenes.get(window.__arScene.id).updateEmbeddedDocuments("Token", [{ _id: window.__arScene.foe, x: want, y: 300 }], { animate: false });
			for (let i = 0; i < 40 && canvas.scene.tokens.get(window.__arScene.foe).x !== want; i++) await new Promise((r) => setTimeout(r, 150));
			await new Promise((r) => setTimeout(r, 400));
			canvas.tokens.get(window.__arScene.me).control({ releaseOthers: true });
			game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false }));
			canvas.tokens.get(window.__arScene.foe).setTarget(true, { releaseOthers: false, groupSelection: false });
		}, squares);
		const readDialog = () => ev(() => { const all = document.querySelectorAll(".op-attack-dialog"); const d = all[all.length - 1]; return d ? { text: d.innerText.replace(/\s+/g, " "), attackDisabled: d.querySelector("button[data-action=attack]")?.disabled, range: d.querySelector("[data-range-note]")?.innerText ?? "", attrs: [...(d.querySelectorAll("select[name=weaponAttr] option") ?? [])].map((o) => o.innerText), modes: [...d.querySelectorAll("input[name=weaponMode]")].map((i) => i.value), grips: [...d.querySelectorAll("select[name=weaponGrip] option")].map((o) => o.value) } : null; });
		const openFor = async (wid, opts) => { await closeAll(); await openSheet(); await press(wid, opts); await dialog.waitFor({ timeout: 6000 }).catch(() => {}); await sleep(300); };
		const rollsSince = async () => (await newMsgs()).flatMap((m) => m.rolls);

		// Faca (ágil, arremessável): escolhe Agilidade ou Força
		await moveFoe(1);
		await openFor(W["Faca"]);
		let d = await readDialog();
		add("AR-20", "Arma ágil (Faca) oferece Força ou Agilidade e vem com a melhor (Agilidade 4)", !!d && d.attrs.length === 2 && /Agilidade/.test(d.attrs[1] ?? "") , JSON.stringify(d?.attrs));
		add("AR-21", "Faca oferece o modo Arremessar (arma de arremesso)", !!d && d.modes.includes("throw"), JSON.stringify(d?.modes));
		await mark();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		let rolls = await rollsSince();
		const kf = d20(rolls.find((x) => /d20/.test(x)));
		add("AR-22", "Faca ataca com Agilidade (4d20) mesmo com Força 1", kf && kf.n === 4, rolls.join(" | "));
		// Faca com Força forçada
		await openFor(W["Faca"]);
		await dialog.locator("select[name=weaponAttr]").selectOption("str");
		await mark();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		rolls = await rollsSince();
		const kf2 = d20(rolls.find((x) => /d20/.test(x)));
		add("AR-23", "Escolher Força na tela ataca com Força (1d20)", kf2 && kf2.n === 1, rolls.join(" | "));

		// Katana: empunhadura adaptável
		await openFor(W["Katana"]);
		d = await readDialog();
		add("AR-24", "Katana mostra a empunhadura adaptável (duas mãos ou uma)", !!d && d.grips.join() === "twoHands,oneHand", JSON.stringify(d?.grips));
		await mark();
		await dialog.locator("select[name=weaponGrip]").selectOption("oneHand");
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		const katanaMsg = (await newMsgs()).find((m) => m.flag);
		add("AR-25", "A empunhadura escolhida fica registrada no cartão do ataque", !!katanaMsg && /uma mão/.test(JSON.stringify(katanaMsg.flag)), JSON.stringify(katanaMsg?.flag?.lines));

		// Fuzil: rajada
		await moveFoe(3);
		await openFor(W["Fuzil de Assalto"]);
		d = await readDialog();
		add("AR-26", "Fuzil (automática) oferece Rajada e Coronhada", !!d && d.modes.includes("burst") && d.modes.includes("blow"), JSON.stringify(d?.modes));
		await mark();
		await dialog.locator("input[name=weaponMode][value=burst]").check();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		rolls = await rollsSince();
		const kb = d20(rolls.find((x) => /d20/.test(x)));
		add("AR-27", "Rajada: ataque perde 1 d20 (Agilidade 4 → 3d20)", kb && kb.n === 3, rolls.join(" | "));
		await ev(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
		await sleep(700);
		const burstCard = await ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
		let burstDmg = "";
		const bb = page.locator(`#chat .message[data-message-id="${burstCard}"] button[data-action="damage"]`);
		if (burstCard && await bb.count() && !(await bb.first().isDisabled())) {
			const n = await ev(() => game.messages.size);
			await bb.first().evaluate((el) => el.click());
			await sleep(3000);
			burstDmg = await ev((n0) => game.messages.contents.slice(n0).map((m) => (m.rolls ?? []).map((x) => x.formula).join(" ")).filter(Boolean).join(" | "), n);
		}
		add("AR-28", "Rajada: dano do Fuzil (2d10) ganha 1 dado (3d10; 9d10 se deu crítico x3)", /^(3|9)d10/.test(burstDmg), burstDmg || "(botão de dano desabilitado: errou)");

		// Pistola: coronhada
		await openFor(W["Pistola"]);
		await mark();
		await dialog.locator("input[name=weaponMode][value=blow]").check();
		await sleep(300);
		d = await readDialog();
		add("AR-29", "Coronhada com a Pistola: alvo a 3 quadrados bloqueia o ataque (corpo a corpo)", !!d && d.attackDisabled === true && /adjacente/i.test(d.range), JSON.stringify({ disabled: d?.attackDisabled, range: d?.range }));
		await closeAll();
		await moveFoe(1);
		await openFor(W["Pistola"]);
		await mark();
		await dialog.locator("input[name=weaponMode][value=blow]").check();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		const blowCard = await ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
		let blowDmg = "";
		const bl = page.locator(`#chat .message[data-message-id="${blowCard}"] button[data-action="damage"]`);
		if (blowCard && await bl.count() && !(await bl.first().isDisabled())) {
			const n = await ev(() => game.messages.size);
			await bl.first().evaluate((el) => el.click());
			await sleep(3000);
			blowDmg = await ev((n0) => game.messages.contents.slice(n0).map((m) => (m.rolls ?? []).map((x) => x.formula).join(" ")).filter(Boolean).join(" | "), n);
		}
		add("AR-30", "Coronhada com a Pistola causa 1d4 (2d4 se crítico) mais Força, não o dano da arma de fogo", /^(1|2)d4/.test(blowDmg) && !/d12/.test(blowDmg), blowDmg || "(botão de dano desabilitado: errou)");

		// Alcance
		await moveFoe(7);
		await openFor(W["Pistola"]);
		d = await readDialog();
		add("AR-31", "Pistola (curto = 6 quadrados) com alvo a 7: aviso de −1d20 e ataque liberado", !!d && /−1d20|além do alcance/.test(d.range) && d.attackDisabled === false, JSON.stringify({ r: d?.range, dis: d?.attackDisabled }));
		await mark();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		rolls = await rollsSince();
		const kr = d20(rolls.find((x) => /d20/.test(x)));
		add("AR-32", "Fora do alcance: ataque perde 1 d20 (4 → 3d20)", kr && kr.n === 3, rolls.join(" | "));
		await moveFoe(13);
		await openFor(W["Pistola"]);
		d = await readDialog();
		add("AR-33", "Além do dobro do alcance (13 quadrados): botão Atacar desabilitado", !!d && d.attackDisabled === true, JSON.stringify({ r: d?.range, dis: d?.attackDisabled, dbg: await ev(() => ({ scene: canvas.scene?.name, scId: window.__arScene?.id, same: canvas.scene?.id === window.__arScene?.id, foeDoc: canvas.scene.tokens.get(window.__arScene.foe)?.x, meDoc: canvas.scene.tokens.get(window.__arScene.me)?.x, toks: canvas.scene.tokens.map((t) => t.name + "@" + t.x), targets: [...game.user.targets].map((t) => t.name + "@" + t.document.x), ctrl: canvas.tokens.controlled.map((t) => t.name) })) }));
		await closeAll();
		await moveFoe(3);
		await openFor(W["Machete"]);
		d = await readDialog();
		add("AR-34", "Machete (corpo a corpo) com alvo a 3 quadrados: bloqueado", !!d && d.attackDisabled === true, JSON.stringify({ r: d?.range, dis: d?.attackDisabled }));
		await closeAll();
		// Shift+clique também respeita a distância: nada rola
		await mark();
		await press(W["Machete"], { modifiers: ["Shift"] });
		await sleep(2500);
		add("AR-35", "Shift+clique em corpo a corpo fora do alcance avisa e não rola nem posta cartão", (await newMsgs()).length === 0, JSON.stringify((await newMsgs()).map((m) => [m.rolls, m.text.slice(0, 60)])) + " avisos: " + JSON.stringify(await ev(() => window.__arNotes ?? [])));

		// Atordoado
		await moveFoe(1);
		await addCond({ key: "stun" });
		await sleep(500);
		await mark();
		await press(W["Machete"], { modifiers: ["Shift"] });
		await sleep(2500);
		add("AR-36", "Atordoado: Shift+clique não ataca (sem rolagem nem cartão)", (await newMsgs()).length === 0, JSON.stringify((await newMsgs()).map((m) => m.text.slice(0, 60))));
		await openFor(W["Machete"]);
		d = await readDialog();
		add("AR-37", "Atordoado: a tela de ataque abre com o motivo e o botão Atacar desabilitado", !!d && d.attackDisabled === true && /Atordoado/i.test(d.range), JSON.stringify({ r: d?.range, dis: d?.attackDisabled }));
		await closeAll();
		await clearConds();

		// Poderes integrados: aparecem na ficha (selo) e na tela, só nas armas certas
		await ev(async ([id]) => {
			const a = game.actors.get(id);
			const fp = window.__arFp;
			for (const [pack, name] of [["fighterPowers", "Golpe Pesado"], ["fighterPowers", "Tiro Certeiro"], ["fighterPowers", "Combate Defensivo"], ["fighterPowers", "Golpe Demolidor"]]) if (!a.items.some((i) => i.name === name)) await a.createEmbeddedDocuments("Item", [await fp(pack, name)]);
			const tl = a.items.find((i) => /Técnica Letal/.test(i.name)) ?? (await a.createEmbeddedDocuments("Item", [await fp("pathFighter", "NEX 10% - Técnica Letal")]))[0];
		}, [fx.id]);
		await sleep(1500);
		const sheetBadges = await ev(([id]) => { const a = game.actors.get(id); a.sheet.render(true); return a.items.filter((i) => i.type === "ability" && i.effects.some((e) => e.getFlag("ordem_v2_classic", "onUse")?.enabled)).map((i) => i.name); }, [fx.id]);
		add("AR-38", "Ao adicionar Golpe Pesado, Tiro Certeiro, Combate Defensivo, Golpe Demolidor e Técnica Letal, cada um ganha a opção de ataque sozinho", ["Golpe Pesado", "Tiro Certeiro", "Combate Defensivo", "Golpe Demolidor"].every((n) => sheetBadges.some((b) => b === n)) && sheetBadges.some((b) => /Técnica Letal/.test(b)), JSON.stringify(sheetBadges));
		await sleep(1500);
		const badgeCount = await ev(() => document.querySelectorAll("[id^=OrdemActorSheet] .op-attack-badge").length);
		add("AR-39", "A ficha marca com um selo os poderes que aparecem na tela de ataque", badgeCount >= 5, `selos: ${badgeCount}`);
		await openFor(W["Machete"]);
		d = await readDialog();
		add("AR-40", "Machete: Golpe Pesado e Técnica Letal aplicados; Tiro Certeiro não", !!d && /Golpe Pesado/.test(d.text) && /Técnica Letal|Tecnica Letal/i.test(d.text) && !/Tiro Certeiro/.test(d.text), d?.text?.slice(0, 400));
		await closeAll();
		const cfgMachete = await ev(async ([id, wid]) => { const m = await import("/systems/ordem_v2_classic/module/helpers/attack-options.mjs"); const c = m.defaultSelection(game.actors.get(id).items.get(wid)); return { dice: c.damageDice, crit: c.critMargin, flat: c.damageFlat }; }, [fx.id, W["Machete"]]);
		add("AR-41", "Machete: +1 dado de dano (Golpe Pesado) e +2 na margem de ameaça (Técnica Letal)", cfgMachete.dice === 1 && cfgMachete.crit === 2, JSON.stringify(cfgMachete));
		const cfgGun = await ev(async ([id, wid]) => { const m = await import("/systems/ordem_v2_classic/module/helpers/attack-options.mjs"); const c = m.defaultSelection(game.actors.get(id).items.get(wid)); return { dice: c.damageDice, crit: c.critMargin }; }, [fx.id, W["Pistola"]]);
		add("AR-42", "Pistola: nenhum dos poderes de corpo a corpo vale", cfgGun.dice === 0 && cfgGun.crit === 0, JSON.stringify(cfgGun));
		// Combate Defensivo é escolha e tira 1 d20
		await openFor(W["Machete"]);
		const defensive = dialog.locator("label.op-ad-row", { hasText: "Combate Defensivo" }).locator("input[type=checkbox]");
		const hasDef = await defensive.count();
		if (hasDef) await defensive.check();
		await mark();
		await dialog.locator("button[data-action=attack]").click();
		await sleep(3000);
		rolls = await rollsSince();
		const kd = d20(rolls.find((x) => /d20/.test(x)));
		add("AR-43", "Combate Defensivo marcado: ataque com arma ágil perde 1 d20 (Machete, Força 1: 2d20 pior)", hasDef === 1 && kd && ((kd.n === 2 && kd.mode === "kl") || kd.n === 0), `${rolls.join(" | ")} (opção na tela: ${hasDef})`);
		// Crítico com margem maior: verifica a conta direto
		const crit = await ev(async ([id, wid]) => { const it = game.actors.get(id).items.get(wid); const base = it.isCritical({ crtalFormula: "20", roll: { result: "19" } }, {}); const wide = it.isCritical({ crtalFormula: "20", roll: { result: "19" } }, { marginBonus: 2 }); return { base: base.isCritical, wide: wide.isCritical }; }, [fx.id, W["Machete"]]);
		add("AR-44", "Margem de ameaça +2: um 19 vira crítico", crit.base === false && crit.wide === true, JSON.stringify(crit));
		// ---------- E. Regras próprias de cada arma (empunhadura, Motosserra, Metralhadora, Espingarda, Fuzil de Precisão)
		await ev(async ([id]) => {
			const a = game.actors.get(id);
			for (const it of a.items.filter((i) => i.type === "armament")) await it.delete();
			const names = ["Bastão", "Espada", "Katana", "Motoserra", "Metralhadora", "Espingarda", "Fuzil de Precisão"];
			const created = await a.createEmbeddedDocuments("Item", await Promise.all(names.map((n) => window.__arFp("armaments", n))));
			window.__arW2 = Object.fromEntries(created.map((i) => [i.name, i.id]));
			await a.update({ "system.skills.fighting.degree.label": "trained", "system.skills.aim.degree.label": "veteran", "system.attributes.str.value": 3, "system.attributes.dex.value": 4, "system.PE.value": 60, "system.PD.value": 60 });
		}, [fx.id]);
		const W2 = await ev(() => window.__arW2);
		const setActor = (data) => ev(([id, dd]) => game.actors.get(id).update(dd), [fx.id, data]);
		await ev(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
		await moveFoe(1); // as quatro primeiras armas são corpo a corpo
		const ruleText = () => ev(() => [...document.querySelectorAll(".op-attack-dialog [data-rules] .op-ad-applied-row")].map((r) => r.innerText).join(" | "));
		const choiceVisible = (name) => ev((n) => { const el = document.querySelector(`.op-attack-dialog input[name=${n}]`); return !!el && !el.closest("[data-rule-choice]").hidden; }, name);
		const flagOf = async () => (await newMsgs()).find((m) => m.flag)?.flag ?? null;
		const attackNow = async () => { await mark(); await dialog.locator("button[data-action=attack]").click(); await sleep(3000); };
		const dmgOf = async () => {
			const card = await ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id) && m.content.includes('data-action="damage"')).at(-1)?.id ?? null);
			const b = page.locator(`#chat .message[data-message-id="${card}"] button[data-action="damage"]`);
			if (!card || !(await b.count()) || (await b.first().isDisabled())) return "";
			const n = await ev(() => game.messages.size);
			await b.first().evaluate((el) => el.click());
			await sleep(3000);
			return ev((n0) => game.messages.contents.slice(n0).map((m) => (m.rolls ?? []).map((x) => x.formula).join(" ")).filter(Boolean).join(" | "), n);
		};

		// Bastão: 1d6 com uma mão, 1d8 com duas
		await openFor(W2["Bastão"]);
		d = await readDialog();
		let note = await ruleText();
		add("AR-45", "Bastão mostra a empunhadura e, com uma mão, dano 1d6", !!d && d.grips.join() === "twoHands,oneHand" && /Uma mão: dano 1d6/.test(note), `${JSON.stringify(d?.grips)} ${note}`);
		await dialog.locator("select[name=weaponGrip]").selectOption("twoHands");
		await sleep(300);
		note = await ruleText();
		await attackNow();
		let dmgE = await dmgOf();
		let fl = await flagOf();
		add("AR-46", "Bastão com duas mãos: a tela mostra dano 1d8, o cartão registra e o dano rolado é d8", /Duas mãos: dano 1d8/.test(note) && /duas mãos: dano 1d8/.test(JSON.stringify(fl?.lines)) && /^\d+d8/.test(dmgE), `${note} | ${JSON.stringify(fl?.lines)} | ${dmgE}`);
		// Espada: 1d8 com uma mão, 1d10 com duas
		await openFor(W2["Espada"]);
		note = await ruleText();
		const sword1 = /Uma mão: dano 1d8/.test(note);
		await dialog.locator("select[name=weaponGrip]").selectOption("twoHands");
		await sleep(300);
		note = await ruleText();
		await attackNow();
		dmgE = await dmgOf();
		add("AR-47", "Espada: uma mão 1d8; duas mãos 1d10 na tela e no dano rolado", sword1 && /Duas mãos: dano 1d10/.test(note) && /^\d+d10/.test(dmgE), `${sword1} ${note} | ${dmgE}`);

		// Katana: a uma mão só para veterano em Luta (grau 10)
		await openFor(W2["Katana"]);
		let kat = await ev(() => { const o = [...document.querySelectorAll(".op-attack-dialog select[name=weaponGrip] option")].find((x) => x.value === "oneHand"); return { disabled: o?.disabled, label: o?.innerText }; });
		note = await ruleText();
		add("AR-48", "Katana com Luta treinada (grau 5): uma mão bloqueada, com o motivo na tela", kat.disabled === true && /veterano em Luta/i.test(kat.label + note), `${JSON.stringify(kat)} ${note}`);
		await closeAll();
		await setActor({ "system.skills.fighting.degree.label": "veteran" });
		await openFor(W2["Katana"]);
		kat = await ev(() => { const o = [...document.querySelectorAll(".op-attack-dialog select[name=weaponGrip] option")].find((x) => x.value === "oneHand"); return { disabled: o?.disabled }; });
		await dialog.locator("select[name=weaponGrip]").selectOption("oneHand");
		await sleep(300);
		note = await ruleText();
		await attackNow();
		dmgE = await dmgOf();
		fl = await flagOf();
		add("AR-49", "Katana com Luta veterana (grau 10): uma mão liberada; o cartão registra e o dano continua d10", kat.disabled === false && /Veterano em Luta: pode empunhar/.test(note) && /uma mão/.test(JSON.stringify(fl?.lines)) && /^\d+d10/.test(dmgE), `${JSON.stringify(kat)} ${note} | ${JSON.stringify(fl?.lines)} | ${dmgE}`);
		await setActor({ "system.skills.fighting.degree.label": "trained" });

		// Motosserra: −1d20 e dado extra a cada 6
		await openFor(W2["Motoserra"]);
		note = await ruleText();
		await attackNow();
		rolls = await rollsSince();
		const km = d20(rolls.find((x) => /d20/.test(x)));
		dmgE = await dmgOf();
		fl = await flagOf();
		add("AR-50", "Motosserra: nota na tela; ataque perde 1 d20 (Força 3 → 2d20); dano explode no 6 (d6x); cartão registra", /−1d20/.test(note) && /6 num dado de dano/.test(note) && km && km.n === 2 && /^\d+d6x/.test(dmgE) && /Motosserra/.test(JSON.stringify(fl?.lines)), `${note} | ${rolls.join(" | ")} | ${dmgE} | ${JSON.stringify(fl?.lines)}`);

		await moveFoe(3);
		// Metralhadora: −5 sem Força 4 nem tripé
		await openFor(W2["Metralhadora"]);
		const hasTripod = await choiceVisible("ruleTripod");
		note = await ruleText();
		await attackNow();
		rolls = await rollsSince();
		fl = await flagOf();
		add("AR-51", "Metralhadora com Força 3 e sem tripé: pergunta do tripé, −5 na tela e na fórmula do ataque", hasTripod && /−5 no ataque/.test(note) && /-\s*5\b/.test(rolls.find((x) => /d20/.test(x)) ?? "") && /−5/.test(JSON.stringify(fl?.lines)), `${hasTripod} ${note} | ${rolls.join(" | ")} | ${JSON.stringify(fl?.lines)}`);
		await openFor(W2["Metralhadora"]);
		await dialog.locator("input[name=ruleTripod]").check();
		await sleep(300);
		note = await ruleText();
		await attackNow();
		rolls = await rollsSince();
		add("AR-52", "Metralhadora apoiada no tripé: sem penalidade (fórmula sem −5)", /sem penalidade/.test(note) && !/-\s*5\b/.test(rolls.find((x) => /d20/.test(x)) ?? ""), `${note} | ${rolls.join(" | ")}`);
		await closeAll();
		await setActor({ "system.attributes.str.value": 4 });
		await openFor(W2["Metralhadora"]);
		const hasTripod4 = await choiceVisible("ruleTripod");
		note = await ruleText();
		add("AR-53", "Metralhadora com Força 4: sem pergunta do tripé e sem penalidade", !hasTripod4 && /Força 4/.test(note), `${hasTripod4} ${note}`);
		await closeAll();
		await setActor({ "system.attributes.str.value": 3 });

		// Espingarda: metade do dano em alcance médio ou maior
		await openFor(W2["Espingarda"]);
		note = await ruleText();
		await attackNow();
		dmgE = await dmgOf();
		add("AR-54", "Espingarda com alvo a 3 quadrados (curto): dano inteiro", /dano inteiro/.test(note) && dmgE !== "" && !/floor/.test(dmgE), `${note} | ${dmgE}`);
		await moveFoe(8);
		await openFor(W2["Espingarda"]);
		note = await ruleText();
		await attackNow();
		dmgE = await dmgOf();
		fl = await flagOf();
		add("AR-55", "Espingarda com alvo a 8 quadrados (12 m): metade do dano na tela, no cartão e na fórmula", /metade do dano\./.test(note) && /metade do dano/.test(JSON.stringify(fl?.lines)) && /floor/.test(dmgE), `${note} | ${JSON.stringify(fl?.lines)} | ${dmgE}`);
		await ev(() => game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false })));
		await openFor(W2["Espingarda"]);
		const hasFar = await choiceVisible("ruleFar");
		await dialog.locator("input[name=ruleFar]").check();
		await sleep(300);
		note = await ruleText();
		add("AR-56", "Espingarda sem alvo marcado: a tela pergunta o alcance e, marcado, mostra metade do dano", hasFar && /Alvo em alcance médio ou maior: metade do dano/.test(note), `${hasFar} ${note}`);
		await closeAll();

		// Fuzil de Precisão: +5 na margem de ameaça para veterano em Pontaria que mira
		await moveFoe(3);
		await openFor(W2["Fuzil de Precisão"]);
		const hasAim = await choiceVisible("ruleAim");
		await dialog.locator("input[name=ruleAim]").check();
		await sleep(300);
		note = await ruleText();
		await attackNow();
		fl = await flagOf();
		add("AR-57", "Fuzil de Precisão, veterano em Pontaria mirando: +5 na margem na tela e no cartão (critMargin 5)", hasAim && /\+5 na margem/.test(note) && fl?.critMargin === 5 && /\+5 na margem de ameaça/.test(JSON.stringify(fl?.lines)), `${hasAim} ${note} | ${JSON.stringify(fl)}`);
		await closeAll();
		await setActor({ "system.skills.aim.degree.label": "trained" });
		await openFor(W2["Fuzil de Precisão"]);
		const hasAim5 = await choiceVisible("ruleAim");
		note = await ruleText();
		add("AR-58", "Fuzil de Precisão sem ser veterano em Pontaria: não oferece mirar e explica a regra", !hasAim5 && /ainda não é veterano/.test(note), `${hasAim5} ${note}`);
		await closeAll();

		// ---------- F. Corrente, recarga, Cajado, Bazuca, Lança-chamas e Em Chamas (docs/spec-armas-area-recarga.md)
		await ev(async ([id]) => {
			const a = game.actors.get(id);
			for (const it of a.items.filter((i) => i.type === "armament")) await it.delete();
			const names = ["Corrente", "Besta", "Cajado", "Bazuca", "Lança-chamas"];
			const created = await a.createEmbeddedDocuments("Item", await Promise.all(names.map((n) => window.__arFp("armaments", n))));
			window.__arW3 = Object.fromEntries(created.map((i) => [i.name, i.id]));
			await a.update({ "system.attributes.str.value": 3, "system.attributes.dex.value": 4, "system.PE.value": 60, "system.PD.value": 60 });
		}, [fx.id]);
		const W3 = await ev(() => window.__arW3);
		await ev(async () => { const keep = canvas.scene.tokens.get(window.__arScene.foe)?.actorId; for (const a of game.actors.filter((x) => x.name === "[AR] alvo" && x.id !== keep)) await a.delete(); });
		const clearReload = (wid) => ev(([id, w]) => game.actors.get(id).items.get(w).unsetFlag("ordem_v2_classic", "reload"), [fx.id, wid]);
		const spawn = (name, x, y, def = 0) => ev(async ([n, px, py, df]) => {
			const sc = game.scenes.get(window.__arScene.id);
			const t = await Actor.create({ name: n, type: "threat", system: { attributes: { hp: { value: 100, max: 100 } }, defense: { value: df } } });
			const td = (await t.getTokenDocument({ x: px * 100, y: py * 100 })).toObject();
			td.actorLink = true;
			await sc.createEmbeddedDocuments("Token", [td]);
			await new Promise((r) => setTimeout(r, 300));
			return t.id;
		}, [name, x, y, def]);
		const hpOfName = (n) => ev((nm) => game.actors.getName(nm)?.system.attributes.hp.value, n);
		const resetHp = () => ev(async () => { for (const a of game.actors.filter((x) => x.name.startsWith("[AR] ") && x.type === "threat")) await a.update({ "system.attributes.hp.value": 100 }); });
		const reportOf = () => ev(() => game.messages.contents.filter((m) => !window.__arFx.known.includes(m.id) && m.content.includes("weapon-area-report")).map((m) => m.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).join(" || "));
		const burning = (n) => ev((nm) => game.actors.getName(nm).effects.filter((e) => e.getFlag("ordem_v2_classic", "condition")?.id === "burning").length, n);

		// Corrente: +2 para desarmar e derrubar
		await moveFoe(1);
		await openFor(W3["Corrente"]);
		const hasManeuver = await choiceVisible("ruleManeuver");
		await dialog.locator("input[name=ruleManeuver]").check();
		await sleep(300);
		note = await ruleText();
		await attackNow();
		rolls = await rollsSince();
		fl = await flagOf();
		add("AR-59", "Corrente: caixa 'desarmar ou derrubar' dá +2 no ataque (fórmula e cartão)", hasManeuver && /\+2/.test(note) && /\+ 2\b/.test(rolls.find((x) => /d20/.test(x)) ?? "") && /Corrente: \+2/.test(JSON.stringify(fl?.lines)), `${hasManeuver} ${note} | ${rolls.join(" | ")} | ${JSON.stringify(fl?.lines)}`);
		await openFor(W3["Corrente"]);
		await mark();
		await attackNow();
		rolls = await rollsSince();
		add("AR-60", "Corrente sem marcar a caixa: sem o +2", !/\+ 2\b/.test(rolls.find((x) => /d20/.test(x)) ?? ""), rolls.join(" | "));

		// Cajado: linha informativa
		await openFor(W3["Cajado"]);
		note = await ruleText();
		add("AR-61", "Cajado mostra que conta como arma de uma mão e leve para Combater com Duas Armas", /Combater com Duas Armas/.test(note), note);
		await closeAll();

		// Besta: recarga a cada disparo
		await moveFoe(3);
		await clearReload(W3["Besta"]);
		await openFor(W3["Besta"]);
		let pendingFirst = await choiceVisible("ruleReload");
		d = await readDialog();
		const firstEnabled = d?.attackDisabled === false;
		await attackNow();
		await openFor(W3["Besta"]);
		const pendingSecond = await choiceVisible("ruleReload");
		d = await readDialog();
		const blockedText = await ev(() => document.querySelector(".op-attack-dialog [data-range-note]")?.innerText ?? "");
		const blockedSecond = d?.attackDisabled === true;
		await dialog.locator("input[name=ruleReload]").check();
		await sleep(300);
		d = await readDialog();
		const freed = d?.attackDisabled === false;
		await attackNow();
		const flagAfter = await ev(([id, w]) => game.actors.get(id).items.get(w).getFlag("ordem_v2_classic", "reload"), [fx.id, W3["Besta"]]);
		add("AR-62", "Besta: 1º disparo livre; 2º exige 'Recarreguei' (Atacar bloqueado com o motivo); marcado, libera e a recarga volta a ficar pendente", !pendingFirst && firstEnabled && pendingSecond && blockedSecond && /Recarregue/.test(blockedText) && freed && flagAfter?.pending === true, JSON.stringify({ pendingFirst, firstEnabled, pendingSecond, blockedSecond, blockedText, freed, flagAfter }));
		// Shift+clique também respeita a recarga
		await mark();
		await press(W3["Besta"], { modifiers: ["Shift"] });
		await sleep(1500);
		const shiftMsgs = await newMsgs();
		add("AR-63", "Shift+clique na Besta com recarga pendente não ataca", shiftMsgs.every((m) => !m.rolls.some((f) => /d20/.test(f))), JSON.stringify(shiftMsgs.map((m) => m.rolls)));

		// Em Chamas: ficha de condição e dano no início do turno (função do motor chamada direto)
		const tick = await ev(async () => {
			const eng = await import("/systems/ordem_v2_classic/module/macros/ritual-area-engine.mjs");
			const victim = game.actors.getName("[AR] alvo");
			await eng.applyCondition(victim, { key: "burning", label: "Em Chamas" }, {});
			const had = victim.effects.filter((e) => e.getFlag("ordem_v2_classic", "condition")?.id === "burning").length;
			const before = victim.system.attributes.hp.value;
			await eng.processConditionsAtTurnStart({ actor: victim, id: "x" }, { round: 1, combatant: { id: "y" }, nextTurn: async () => {} });
			const after = victim.system.attributes.hp.value;
			return { had, loss: before - after };
		});
		add("AR-64", "Em Chamas: aplicada pelo motor e, no início do turno, tira 1d6 de PV", tick.had === 1 && tick.loss >= 1 && tick.loss <= 6, JSON.stringify(tick));
		await ev(async () => { const v = game.actors.getName("[AR] alvo"); await v.deleteEmbeddedDocuments("ActiveEffect", v.effects.map((e) => e.id)); await v.update({ "system.attributes.hp.value": 100 }); });

		// Bazuca: explosão em raio de 3 m (2 quadrados) em volta do alvo atingido
		await moveFoe(5); // alvo em (6,3); quem atira em (1,3)
		await spawn("[AR] dentro1", 7, 3);
		await spawn("[AR] dentro2", 6, 5);
		await spawn("[AR] fora1", 8, 4);
		await spawn("[AR] fora2", 3, 3);
		await resetHp();
		await clearReload(W3["Bazuca"]);
		await openFor(W3["Bazuca"]);
		const bzModes = (await readDialog())?.modes ?? [];
		await attackNow();
		const bzDmg = await dmgOf();
		await sleep(2500);
		const rep = await reportOf();
		const hpIn1 = await hpOfName("[AR] dentro1"), hpIn2 = await hpOfName("[AR] dentro2"), hpOut1 = await hpOfName("[AR] fora1"), hpOut2 = await hpOfName("[AR] fora2");
		add("AR-65", "Bazuca: oferece o modo 'disparar num ponto'; a explosão atinge só quem está a até 2 quadrados do alvo, com Reflexos (DT 10 + Agi)", bzModes.includes("point") && /dentro1/.test(rep) && /dentro2/.test(rep) && !/fora1/.test(rep) && !/fora2/.test(rep) && /DT 14/.test(rep) && hpIn1 < 100 && hpIn2 < 100 && hpOut1 === 100 && hpOut2 === 100, JSON.stringify({ bzModes, rep: rep.slice(0, 500), hpIn1, hpIn2, hpOut1, hpOut2, bzDmg }));
		// clicar de novo no dano do mesmo cartão não repete a explosão
		const hpBefore2 = await hpOfName("[AR] dentro1");
		await dmgOf();
		await sleep(1500);
		add("AR-66", "Bazuca: clicar de novo no dano do mesmo ataque não repete a explosão", (await hpOfName("[AR] dentro1")) === hpBefore2, `${hpBefore2} -> ${await hpOfName("[AR] dentro1")}`);

		// Bazuca: recarga pendente e modo ponto (sem ataque, não erra, atinge todo mundo no raio, inclusive o do ponto)
		await resetHp();
		await openFor(W3["Bazuca"]);
		d = await readDialog();
		const bzBlocked = d?.attackDisabled === true;
		await dialog.locator("input[name=ruleReload]").check();
		await dialog.locator("input[name=weaponMode][value=point]").check();
		await sleep(300);
		d = await readDialog();
		await mark();
		await dialog.locator("button[data-action=attack]").click();
		let repPoint = "";
		for (let i = 0; i < 12 && !repPoint; i++) { await sleep(1000); repPoint = await reportOf(); }
		const ptMsgs = await newMsgs();
		const noAttackCard = ptMsgs.every((m) => !m.flag);
		add("AR-67", "Bazuca no ponto: recarga pendente bloqueava; sem teste de ataque; o alvo do ponto e quem está no raio fazem Reflexos", bzBlocked && d?.attackDisabled === false && noAttackCard && /\[AR\] alvo/.test(repPoint) && /dentro1/.test(repPoint) && /dentro2/.test(repPoint) && !/fora1/.test(repPoint), JSON.stringify({ bzBlocked, enabled: d?.attackDisabled, noAttackCard, rep: repPoint.slice(0, 400), msgs: ptMsgs.map((m) => m.rolls), notes: await ev(() => [...document.querySelectorAll("#notifications li, .notification")].map((n) => n.innerText)), dlg: await ev(() => document.querySelectorAll(".op-attack-dialog").length) }));

		// Lança-chamas: uma linha de 1 quadrado até 6 quadrados, um ataque contra cada Defesa, Em Chamas
		await ev(async () => { for (const a of game.actors.filter((x) => /^\[AR\] (dentro|fora)/.test(x.name))) { const tk = canvas.scene.tokens.filter((t) => t.actorId === a.id).map((t) => t.id); if (tk.length) await canvas.scene.deleteEmbeddedDocuments("Token", tk); await a.delete(); } });
		await moveFoe(3); // alvo em (4,3)
		await spawn("[AR] linha1", 2, 3); // na linha, antes do alvo
		await spawn("[AR] linha2", 6, 3); // na linha, depois do alvo
		await spawn("[AR] blindado", 5, 3, 999); // na linha, Defesa alta demais
		await spawn("[AR] longe", 8, 3); // além do alcance curto
		await spawn("[AR] lado", 3, 4); // fora da linha (1 quadrado ao lado)
		await resetHp();
		await openFor(W3["Lança-chamas"]);
		await attackNow();
		await dmgOf();
		await sleep(3000);
		const repFlame = await reportOf();
		add("AR-68", "Lança-chamas: atinge quem está na linha e tem Defesa baixa; Defesa alta não é atingida; fora da linha/alcance não aparece",
			/linha1/.test(repFlame) && /linha2/.test(repFlame) && /blindado.*não foi atingido/.test(repFlame) && !/longe/.test(repFlame) && !/lado/.test(repFlame) && (await hpOfName("[AR] linha1")) < 100 && (await hpOfName("[AR] blindado")) === 100 && (await hpOfName("[AR] longe")) === 100 && (await hpOfName("[AR] lado")) === 100,
			JSON.stringify({ rep: repFlame.slice(0, 600), l1: await hpOfName("[AR] linha1"), bl: await hpOfName("[AR] blindado") }));
		add("AR-69", "Lança-chamas: os atingidos ficam Em Chamas (o blindado, o de fora e o do lado não)",
			(await burning("[AR] linha1")) === 1 && (await burning("[AR] linha2")) === 1 && (await burning("[AR] alvo")) === 1 && (await burning("[AR] blindado")) === 0 && (await burning("[AR] lado")) === 0,
			JSON.stringify({ l1: await burning("[AR] linha1"), l2: await burning("[AR] linha2"), alvo: await burning("[AR] alvo"), bl: await burning("[AR] blindado"), alvos: await ev(() => game.actors.filter((x) => x.name === "[AR] alvo").map((x) => [x.id, x.effects.map((e) => e.name)])) }));
		await openFor(W3["Lança-chamas"]);
		await attackNow();
		await dmgOf();
		await sleep(3000);
		add("AR-70", "Lança-chamas de novo no mesmo ser: Em Chamas não duplica", (await burning("[AR] linha1")) === 1, String(await burning("[AR] linha1")));
		await closeAll();

		await ev(async () => { const prev = window.__arPrev; if (prev) await game.scenes.get(prev)?.view(); await game.scenes.get(window.__arScene.id)?.delete(); });
	} catch (e) {
		add("ERRO", "Exceção no teste", false, String(e).slice(0, 400));
	} finally {
		await closeAll();
		await ev(async () => {
			for (const a of game.actors.filter((x) => x.name.startsWith("[AR]"))) await a.delete();
			for (const sc of game.scenes.filter((x) => x.name.startsWith("[AR]"))) { if (canvas.scene?.id === sc.id && window.__arPrev) await game.scenes.get(window.__arPrev)?.view(); await sc.delete(); }
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
