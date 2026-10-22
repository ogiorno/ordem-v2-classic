// Playwright (run-code): todas as armas do compêndio, uma por uma, com agentes de vários NEX e ficha completa.
//   playwright-cli -s=ta run-code --filename=scripts/ui-todas-armas.js      (entrar como Mestre antes)
// Camada A (código): cada arma x cada agente x cada modo -> fórmula do ataque e do dano conferidas contra os dados.
// Camada B (interface): cada arma pela tela de ataque da ficha, com cliques; modos especiais incluídos.
// Cria e apaga só "[TA] ...". Resultado: window.__taUi = { checks, resumo }.
async (page) => {
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
	const out = { checks: [], porArma: {} };
	const add = (id, ok, detalhe) => { out.checks.push({ id, ok: !!ok, detalhe: ok ? undefined : detalhe }); if (!ok) console.log(`FALHA ${id} ${String(detalhe).slice(0, 220)}`); };
	const dialog = page.locator(".op-attack-dialog");
	const sheetSel = "[id^=OrdemActorSheet]";

	// os cartões de rolagem flutuantes cobrem a ficha: o teste não precisa deles
	await ev(() => { if (!document.getElementById("ta-no-popups")) { const st = document.createElement("style"); st.id = "ta-no-popups"; st.textContent = "#chat-notifications{pointer-events:none !important}"; document.head.append(st); } });
	// ---------- fixture: 6 agentes completos
	const fx = await ev(async () => {
		const SYS = "ordem-v2-classic";
		const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
		const fp = async (p, n) => { const pack = game.packs.get(`${SYS}.${p}`); const e = (await pack.getIndex()).find((x) => norm(x.name) === norm(n)); const d = (await pack.getDocument(e._id)).toObject(); delete d._id; return d; };
		for (const a of game.actors.filter((x) => x.name.startsWith("[TA]"))) await a.delete();
		const builds = [
			{ nex: 5, nivel: 1, cls: "Combatente", at: { str: 3, dex: 2, vit: 3, int: 1, pre: 1 }, grau: 5, pe: 3, pv: 20 },
			{ nex: 25, nivel: 5, cls: "Especialista", at: { str: 1, dex: 3, vit: 2, int: 3, pre: 2 }, grau: 5, pe: 15, pv: 28 },
			{ nex: 50, nivel: 10, cls: "Ocultista", at: { str: 2, dex: 2, vit: 2, int: 2, pre: 4 }, grau: 10, pe: 40, pv: 40 },
			{ nex: 75, nivel: 15, cls: "Combatente", at: { str: 4, dex: 3, vit: 4, int: 1, pre: 1 }, grau: 10, pe: 60, pv: 95 },
			{ nex: 99, nivel: 20, cls: "Combatente", at: { str: 5, dex: 4, vit: 5, int: 1, pre: 1 }, grau: 15, pe: 80, pv: 140 },
			{ nex: 99, nivel: 20, cls: "Especialista", at: { str: 0, dex: 5, vit: 3, int: 4, pre: 2 }, grau: 15, pe: 90, pv: 100 },
		];
		const pack = game.packs.get(`${SYS}.armaments`);
		const index = await pack.getIndex();
		const weaponsData = [];
		for (const e of index) { const d = (await pack.getDocument(e._id)).toObject(); delete d._id; if (d.system?.formulas) weaponsData.push(d); }
		const skillKeys = ["fighting", "aim", "reflexes", "fortitude", "perception", "initiative", "will", "tactics", "athletics", "acrobatics"];
		const created = [];
		for (const b of builds) {
			const a = await Actor.create({ name: `[TA] NEX ${b.nex} ${b.cls}${b.nivel === 20 && b.at.str === 0 ? " (AGI 5)" : ""}`, type: "agent", system: { nivel: { value: b.nivel }, attributes: Object.fromEntries(Object.entries(b.at).map(([k, v]) => [k, { value: v }])) } });
			const upd = { "system.PE.max": b.pe, "system.PE.value": b.pe, "system.PD.max": b.pe, "system.PD.value": b.pe, "system.attributes.hp.max": b.pv, "system.attributes.hp.value": b.pv };
			for (const k of skillKeys) if (a.system.skills[k]) upd[`system.skills.${k}.degree.label`] = ({ 5: "trained", 10: "veteran", 15: "expert" })[b.grau] ?? "untrained"; // o grau é calculado a partir do nome do treino
			await a.update(upd);
			await a.createEmbeddedDocuments("Item", [await fp("classes", b.cls)]);
			const items = await a.createEmbeddedDocuments("Item", weaponsData);
			created.push({ id: a.id, name: a.name, nex: b.nex, nivel: b.nivel, grau: b.grau, at: b.at, res: a.usingWithoutSanityRule ? "PD" : "PE", weapons: items.map((i) => ({ id: i.id, name: i.name })) });
		}
		window.__taFx = { known: game.messages.contents.map((m) => m.id) };
		return { agents: created, total: weaponsData.length, pdAtivo: game.actors.get(created[0].id).usingWithoutSanityRule };
	});
	out.preparo = { agentes: fx.agents.map((a) => `${a.name} (nível ${a.nivel})`), armas: fx.total };
	add("TA-00", fx.agents.length === 6 && fx.total >= 40, `agentes ${fx.agents.length}, armas ${fx.total}`);

	// ---------- camada A: todas as armas x todos os agentes x todos os modos, pelo código
	const A = await ev(async (agentsIn) => {
		const m = await import("/systems/ordem-v2-classic/module/helpers/attack-options.mjs");
		const results = [];
		const msgsOf = (before) => game.messages.contents.filter((x) => !before.has(x.id));
		for (const ag of agentsIn) {
			const actor = game.actors.get(ag.id);
			for (const w of ag.weapons) {
				const item = actor.items.get(w.id);
				const s = item.system;
				const melee = s.types?.rangeType?.name === "melee", ranged = s.types?.rangeType?.name === "ranged";
				const modes = ["normal"];
				if (s.conditions?.automatic && ranged) modes.push("burst");
				if (s.conditions?.throwable || (melee && !s.conditions?.improvised)) modes.push("throw");
				if (s.conditions?.pistolBlow && ranged) modes.push("blow");
				for (const mode of modes) {
					const row = { agent: ag.name, weapon: w.name, mode, errors: [] };
					try {
						const options = m.collectOptions(item);
						const cfg = m.buildConfig(item, options, { weapon: { mode } });
						const A = actor.system.attributes;
						const atkSpec = s.formulas.attack;
						let attr = atkSpec.attr, skill = atkSpec.skill;
						if (mode === "throw") { attr = "dex"; skill = "aim"; }
						if (mode === "blow") { attr = "str"; skill = "fighting"; }
						if (mode === "normal" && s.conditions?.agile && melee) attr = (A.dex.value > A.str.value) ? "dex" : "str";
						const penalty = (mode === "burst" ? -1 : 0) + (mode === "throw" && !s.conditions?.throwable ? -1 : 0) + (mode === "normal" && /motoserra/i.test(w.name) ? -1 : 0); // Motosserra: −1d20 em todo ataque
						const dice = A[attr].value + penalty;
						const wantN = dice < 1 ? 2 : dice, wantMode = dice < 1 ? "kl" : "kh";
						const before = new Set(game.messages.contents.map((x) => x.id));
						const atk = await item.rollAttack({ attackOptions: cfg });
						const fa = msgsOf(before).flatMap((x) => (x.rolls ?? []).map((r) => r.formula)).find((f) => /d20/.test(f)) ?? "";
						const g = /^(\d+)d20(k[hl])/.exec(fa);
						row.ataque = fa;
						if (!g || Number(g[1]) !== wantN || g[2] !== wantMode) row.errors.push(`ataque ${fa} (esperado ${wantN}d20${wantMode} com ${attr})`);
						const grau = actor.system.skills[skill].degree.value;
						if (grau && !new RegExp(`\\+ ${grau}(\\b|$)`).test(fa)) row.errors.push(`falta o treino +${grau} em ${fa}`);
						if (!atk) row.errors.push("rollAttack não devolveu resultado");
						// dano
						const before2 = new Set(game.messages.contents.map((x) => x.id));
						await item.rollDamage({ attackOptions: cfg, critical: false, lastId: true, hitResult: null });
						const fd = msgsOf(before2).flatMap((x) => (x.rolls ?? []).map((r) => r.formula)).join(" | ");
						row.dano = fd;
						const baseFormula = mode === "blow" ? (s.types?.gripType === "twoHands" ? "1d6" : "1d4") : s.formulas.damage.formula;
						const [bc, bf] = baseFormula.split("d");
						const wantCount = Number(bc) + (mode === "burst" ? 1 : 0);
						const dm = /^(\d+)d(\d+)/.exec(fd);
						if (!dm || Number(dm[1]) !== wantCount || dm[2] !== bf) row.errors.push(`dano ${fd} (esperado ${wantCount}d${bf})`);
						const dAttr = mode === "throw" ? "str" : mode === "blow" ? "str" : s.formulas.damage.attr;
						if (dAttr) { const v = A[dAttr]?.value ?? 0; if (v && !new RegExp(`\\+ ${v}(\\b|$)`).test(fd)) row.errors.push(`dano sem +${v} de ${dAttr}: ${fd}`); }
					} catch (e) { row.errors.push("exceção: " + String(e).slice(0, 160)); }
					results.push(row);
				}
			}
		}
		// apaga os cartões desta camada
		const ids = game.messages.contents.filter((x) => !window.__taFx.known.includes(x.id)).map((x) => x.id);
		for (let i = 0; i < ids.length; i += 100) await ChatMessage.deleteDocuments(ids.slice(i, i + 100));
		return results;
	}, fx.agents.map((a) => ({ id: a.id, name: a.name, weapons: a.weapons })));
	const bad = A.filter((r) => r.errors.length);
	out.camadaA = { combinacoes: A.length, falhas: bad.length };
	add("TA-A", bad.length === 0, `${bad.length} de ${A.length} combinações com erro: ` + bad.slice(0, 8).map((r) => `${r.agent} / ${r.weapon} / ${r.mode}: ${r.errors.join("; ")}`).join(" || "));
	out.falhasA = bad.slice(0, 40);
	console.log(`Camada A: ${A.length - bad.length}/${A.length}`);

	// ---------- camada B: cada arma pela interface (tela de ataque da ficha)
	const closeAll = async () => { for (let i = 0; i < 10 && (await dialog.count()); i++) { await page.keyboard.press("Escape"); await sleep(250); } await ev(() => document.querySelectorAll(".application[id^=dialog]").forEach((d) => d.querySelector("[data-action=close]")?.click())); };
	const d20 = (f) => { const m = /^(\d+)d20(k[hl])?/.exec(f ?? ""); return m ? { n: Number(m[1]), mode: m[2] ?? "" } : null; };
	const only = await ev(() => window.__taOnly ?? null);
	const names = fx.agents[0].weapons.map((w) => w.name).filter((n) => !only || only.includes(n));
	const open = new Set();
	for (const [i, wname] of names.entries()) {
		const ag = fx.agents[i % fx.agents.length];
		const wid = ag.weapons.find((w) => w.name === wname).id;
		const info = await ev(([aid, id]) => { const it = game.actors.get(aid).items.get(id); const s = it.system; return { agile: !!s.conditions?.agile, auto: !!s.conditions?.automatic, thr: !!s.conditions?.throwable, blow: !!s.conditions?.pistolBlow, imp: !!s.conditions?.improvised, melee: s.types?.rangeType?.name === "melee", ranged: s.types?.rangeType?.name === "ranged", range: s.range, crit: s.critical, formula: s.formulas.damage.formula, attr: s.formulas.attack.attr, dattr: s.formulas.damage.attr, grip: s.types?.gripType }; }, [ag.id, wid]);
		const modes = ["normal"];
		if (info.auto && info.ranged) modes.push("burst");
		if (info.thr || (info.melee && !info.imp)) modes.push("throw");
		if (info.blow && info.ranged) modes.push("blow");
		const rec = (out.porArma[wname] = { agente: ag.name, modos: modes, ok: true, erros: [] });
		try {
			for (const mode of modes) {
				await closeAll();
				await ev(async () => { for (const x of game.actors.filter((y) => y.name.startsWith("[TA]"))) await x.sheet.close(); });
				await sleep(200);
				await ev((id) => game.actors.get(id).sheet.render(true), ag.id);
				await sleep(900);
				await closeAll();
				await ev(() => document.querySelector("[id^=OrdemActorSheet] [data-action=tab][data-tab=inventory]")?.click());
				await sleep(250);
				const btn = page.locator(`${sheetSel} .item[data-item-id="${wid}"] .attack-btn`).first();
				if (!(await btn.count())) throw new Error("botão Atacar não existe na ficha");
				await ev(() => { window.__taFx.known = game.messages.contents.map((m) => m.id); });
				await btn.evaluate((el) => el.scrollIntoView({ block: "center" }));
				await sleep(150);
				await btn.click({ timeout: 8000 });
				await dialog.waitFor({ timeout: 6000 }).catch(() => {});
				if (!(await dialog.count())) throw new Error("a tela de ataque não abriu");
				const d = await ev(() => { const el = document.querySelector(".op-attack-dialog"); return { text: el.innerText.replace(/\s+/g, " "), modes: [...el.querySelectorAll("input[name=weaponMode]")].map((i) => i.value), attr: !!el.querySelector("select[name=weaponAttr]"), grip: !!el.querySelector("select[name=weaponGrip]"), disabled: el.querySelector("button[data-action=attack]")?.disabled }; });
				if (mode === "normal") {
					// a Bazuca ainda oferece "disparar num ponto" (testado em ui-armas.js, AR-65 a AR-67): aparece na lista, sem ataque aqui
					const shown = [...modes];
					if (wname === "Bazuca") shown.splice(shown.includes("blow") ? shown.indexOf("blow") : shown.length, 0, "point");
					const wantModes = shown.length > 1 ? shown : [];
					if (d.modes.join() !== wantModes.join()) rec.erros.push(`modos na tela [${d.modes}] esperado [${wantModes}]`);
					if (d.attr !== (info.agile && info.melee)) rec.erros.push(`escolha de atributo ${d.attr} esperado ${info.agile && info.melee}`);
					if (info.range && !d.text.includes(`Alcance ${info.range}`)) rec.erros.push("alcance não aparece");
					if (info.crit && !d.text.includes(`Crítico ${info.crit}`)) rec.erros.push("crítico não aparece");
					if (d.disabled) rec.erros.push("botão Atacar desabilitado sem motivo");
				} else {
					await dialog.locator(`input[name=weaponMode][value=${mode}]`).check();
					await sleep(200);
				}
				await dialog.locator("button[data-action=attack]").click();
				await sleep(2600);
				// só as mensagens deste agente e deste usuário: o mundo é compartilhado e outras sessões rolam dados ao mesmo tempo
				const res = await ev((agentId) => { const msgs = game.messages.contents.filter((m) => !window.__taFx.known.includes(m.id) && m.speaker?.actor === agentId && m.author?.id === game.user.id); return { who: msgs.map((m) => `${m.author?.name}/${m.speaker?.alias ?? ""}/${(m.rolls ?? []).map((r) => r.formula).join(",")}/${m.content.includes('data-action="damage"') ? "cartão" : ""}`), f: msgs.flatMap((m) => (m.rolls ?? []).map((r) => r.formula)), card: msgs.find((m) => m.content.includes('data-action="damage"'))?.id ?? null }; }, ag.id);
				const f = res.f.find((x) => /d20/.test(x));
				const a = ag.at;
				let attr = info.attr, pen = 0;
				if (mode === "throw") { attr = "dex"; pen = info.thr ? 0 : -1; }
				if (mode === "blow") attr = "str";
				if (mode === "burst") pen = -1;
				if (mode === "normal" && /motoserra/i.test(wname)) pen = -1; // Motosserra: −1d20 em todo ataque
				if (mode === "normal" && info.agile && info.melee) attr = a.dex > a.str ? "dex" : "str";
				const dice = a[attr] + pen;
				const k = d20(f);
				if (!k || k.n !== (dice < 1 ? 2 : dice) || k.mode !== (dice < 1 ? "kl" : "kh")) rec.erros.push(`${mode}: ataque ${f} (esperado ${dice < 1 ? 2 : dice}d20${dice < 1 ? "kl" : "kh"}) msgs=${JSON.stringify(res.who)} agente=${ag.name}`);
				if (!res.card) { rec.erros.push(`${mode}: sem cartão da arma`); continue; }
				await ev(() => { try { ui.sidebar.changeTab("chat", "primary"); } catch { document.querySelector("[data-tab=chat]")?.click(); } });
				await sleep(350);
				const n0 = await ev(() => game.messages.size);
				const btnState = await ev((id) => { const b = document.querySelector(`#chat .message[data-message-id="${id}"] button[data-action="damage"]`); return b ? `disabled=${b.disabled}` : "botão ausente"; }, res.card);
				await ev((id) => document.querySelector(`#chat .message[data-message-id="${id}"] button[data-action="damage"]`)?.click(), res.card);
				await sleep(2200);
				const dmg = await ev(([n, agentId]) => game.messages.contents.slice(n).filter((m) => m.speaker?.actor === agentId && m.author?.id === game.user.id).flatMap((m) => (m.rolls ?? []).map((r) => r.formula)).join(" | "), [n0, ag.id]);
				const base = mode === "blow" ? (info.grip === "twoHands" ? "1d6" : "1d4") : info.formula;
				const [bc, bf] = base.split("d");
				const want = Number(bc) + (mode === "burst" ? 1 : 0);
				const dm = /^(\d+)d(\d+)/.exec(dmg);
				const mult = dm ? Number(dm[1]) / want : 0;
				if (!dm || dm[2] !== bf || !Number.isInteger(mult) || mult < 1) rec.erros.push(`${mode}: dano ${dmg} (esperado ${want}d${bf}, ou múltiplo se crítico) botão ${btnState} ataque=${f}`);
			}
		} catch (e) { rec.erros.push(String(e).replace(/[[0-9;]*m/g, "").slice(0, 900)); }
		rec.ok = rec.erros.length === 0;
		add(`TB-${wname}`, rec.ok, rec.erros.join("; "));
		await ev((o) => { window.__taUi = o; }, out);
	}
	await closeAll();

	// ---------- limpeza
	await ev(async () => {
		for (const a of game.actors.filter((x) => x.name.startsWith("[TA]"))) await a.delete();
		const ids = game.messages.contents.filter((x) => !window.__taFx.known.includes(x.id) && /\[TA\]/.test(x.speaker?.alias ?? "")).map((x) => x.id);
		if (ids.length) await ChatMessage.deleteDocuments(ids);
	});
	const nB = Object.keys(out.porArma).length;
	const okB = Object.values(out.porArma).filter((r) => r.ok).length;
	out.resumo = { camadaA: out.camadaA, camadaB: { armas: nB, ok: okB }, checks: `${out.checks.filter((c) => c.ok).length}/${out.checks.length}` };
	await ev((o) => { window.__taUi = o; }, out);
	console.log(JSON.stringify(out.resumo));
	return out.resumo;
}
