// Teste ao vivo das perícias treinadas, fase 3: Foco em Perícia, Eclético, Treinamento Especial, onboarding e grimório.
// Rodar com Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/pericias-treinadas-fase3-live-test.js)"
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };
	const T = await import(`/systems/${SYS}/module/helpers/skill-training.mjs`);
	const R = await import(`/systems/${SYS}/module/helpers/skill-training-rules.mjs`);
	const Ec = await import(`/systems/${SYS}/module/helpers/eclectic.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const deg = (a, k) => a.system.skills[k].degree.label;
	const view = (a) => T.resolveActor(a);
	const dialog = async (values, { later = false, peek } = {}) => {
		const dlg = await until(() => document.querySelector(".op-skill-choice"));
		if (!dlg) return null;
		if (peek) peek(dlg);
		if (later) dlg.querySelector("button[data-action=later]").click();
		else { (values ?? []).forEach((v, i) => { const s = dlg.querySelector(`select[name=slot${i}]`); if (s) s.value = v; }); dlg.querySelector("button[data-action=ok]").click(); }
		await until(() => !document.querySelector(".op-skill-choice"), 4000);
		await sleep(900);
		return dlg;
	};
	/** Fecha, adiando, todos os diálogos que aparecerem até a tela ficar quieta. */
	const drain = async () => { let quiet = 0; while (quiet < 6) { const d = document.querySelector(".op-skill-choice"); if (d) { d.querySelector("button[data-action=later]").click(); quiet = 0; await sleep(700); } else { quiet++; await sleep(250); } } };
	const closeAll = () => document.querySelectorAll(".op-skill-choice").forEach((el) => el.querySelector("button[data-action=later]")?.click());

	try {
		const docs = {};
		for (const pack of game.packs.filter((p) => p.metadata.packageName === SYS && p.documentName === "Item")) for (const d of await pack.getDocuments()) (docs[R.trainingKey(d.name)] ??= []).push(d);
		const get = (name) => (docs[R.trainingKey(name)] ?? [])[0];
		const byRx = (rx) => Object.values(docs).flat().find((d) => rx.test(d.name));
		const mk = async (name, attrs = {}) => { const a = await Actor.create({ name: `ZZ treino3 ${name}`, type: "agent", system: { attributes: { str: { value: 2 }, dex: { value: 2 }, vit: { value: 2 }, int: { value: 1 }, pre: { value: 2 }, ...attrs } } }); actors.push(a); return a; };
		const give = async (a, ...items) => await a.createEmbeddedDocuments("Item", items.map((i) => i.toObject()));
		const cfg = (a, skill, form = {}) => { const config = {}; a._buildSkillToolConfig("skill", { skill }, config, { get: (k) => form[k] ?? null }, 0); return config; };

		// ---------- Foco em Perícia: +1 dado ----------
		const f = await mk("Foco");
		await give(f, get("Combatente") ?? byRx(/^Combatente$/));
		await dialog(["fighting", "reflexes"]);
		await dialog(["crime", "stealth"]);
		const foco = (await give(f, get("Foco em Perícia")))[0];
		await dialog(["stealth"]);
		check("Foco: escolha guardada", f.items.get(foco.id).getFlag(SYS, "focusSkill") === "stealth");
		check("Foco: +1 dado (penalidade -1) no teste da perícia escolhida", cfg(f, "stealth").options?.dicePenalty === -1, cfg(f, "stealth").options);
		check("Foco: sem dado extra nas outras perícias", !cfg(f, "crime").options?.dicePenalty, cfg(f, "crime").options);
		const roll = await f.rollSkill({ skill: "stealth" }, { configure: false }, { create: false }).catch((e) => ({ erro: String(e) }));
		const r0 = Array.isArray(roll) ? roll[0] : null;
		check("Foco: a rolagem de verdade sai com um dado a mais (d20 = atributo + 1)", r0 && r0.formula.match(/^(\d+)d20/)?.[1] === String(f.system.attributes.dex.value + 1), r0?.formula ?? roll);
		const semFoco = await f.rollSkill({ skill: "crime" }, { configure: false }, { create: false }).catch(() => null);
		check("Foco: outra perícia sem dado extra", semFoco?.[0]?.formula.match(/^(\d+)d20/)?.[1] === String(f.system.attributes.dex.value), semFoco?.[0]?.formula);
		await f.deleteEmbeddedDocuments("Item", [foco.id]);
		await sleep(500);
		check("Foco apagado: o dado extra some", !cfg(f, "stealth").options?.dicePenalty);

		// ---------- Eclético / Engenhosidade ----------
		const e = await mk("Especialista");
		await give(e, get("Especialista") ?? byRx(/^Especialista$/));
		await drain();
		await e.update({ "system.PE.value": 20, "system.PD.value": 20, "system.nivel.value": 8 });
		await sleep(600);
		closeAll();
		const opts = Ec.eclecticFor(e, "arts");
		check("Eclético: destreinada oferece treinado (2) e, no NEX 40%, veterano (4)", opts.map((o) => `${o.degree}:${o.pe}`).join() === "trained:2,veteran:4", opts);
		const c1 = cfg(e, "arts", { eclectic: "trained" });
		check("Eclético: soma +5 no teste e guarda o custo, sem mudar a ficha", c1.parts.includes("5") && c1.options.eclectic.pe === 2 && deg(e, "arts") === "untrained", { parts: c1.parts, o: c1.options });
		const c2 = cfg(e, "arts", { eclectic: "veteran" });
		check("Engenhosidade: veterano soma +10 por 4 PE", c2.parts.includes("10") && c2.options.eclectic.pe === 4);
		check("Eclético: sem marcar não muda nada", !cfg(e, "arts").options?.eclectic);
		const res = e.usingWithoutSanityRule ? "PD" : "PE";
		const before = e.system[res].value;
		await Ec.payEclectic(e, { eclecticUsed: c1.options.eclectic });
		check("Eclético: o custo é cobrado depois do teste", e.system[res].value === before - 2, [before, e.system[res].value]);
		check("Eclético: a ficha continua destreinada e sem entrada no livro-caixa", deg(e, "arts") === "untrained" && !T.ledgerOf(e).entries.some((x) => x.skill === "arts"));
		await e.update({ "system.skills.arts.degree.label": "trained" }); // Mestre treina
		await sleep(400);
		check("Eclético: treinada só oferece veterano", Ec.eclecticFor(e, "arts").map((o) => o.degree).join() === "veteran");
		await e.update({ "system.nivel.value": 1 });
		const comb = await mk("SemEclético");
		await give(comb, get("Combatente") ?? byRx(/^Combatente$/));
		await drain();
		check("Eclético: só o Especialista tem", Ec.eclecticFor(comb, "arts").length === 0);

		// ---------- Treinamento Especial ----------
		await drain();
		const s = await mk("Sobrevivente", { int: { value: 2 } });
		const surv = (await give(s, get("Sobrevivente") ?? byRx(/^Sobrevivente$/)))[0];
		await dialog(["crime", "stealth", "arts"], { peek: (d) => check("Sobrevivente: 1 + Int = 3 vagas", Boolean(d.querySelector("select[name=slot2]")) && !d.querySelector("select[name=slot3]")) });
		check("Sobrevivente: 3 perícias", view(s).budget.train.used === 3 && view(s).budget.train.allowed === 3, view(s).budget.train);
		await s.deleteEmbeddedDocuments("Item", [surv.id]);
		await sleep(900);
		check("Sobrevivente larga a classe: as 3 perícias ficam e a conversão é registrada", deg(s, "crime") === "trained" && T.ledgerOf(s).converted === true);
		await give(s, get("Especialista") ?? byRx(/^Especialista$/));
		await dialog(null, { later: true, peek: (d) => check("Treinamento Especial (Especialista): 6 vagas novas", Boolean(d.querySelector("select[name=slot5]")) && !d.querySelector("select[name=slot6]")) });
		const sv = view(s);
		check("Treinamento Especial: orçamento = 3 do Sobrevivente + 6 (sem a base 7)", sv.budget.train.allowed === 9, sv.budget.train);
		check("Treinamento Especial: perícias antigas continuam travadas pelo que são", deg(s, "arts") === "trained");

		// ---------- onboarding: origem + classe juntas, em sequência ----------
		const o = await mk("Onboarding");
		await give(o, get("Combatente") ?? byRx(/^Combatente$/), get("Lutador") ?? byRx(/^Lutador$/));
		let seen = 0;
		await dialog(["resilience"], { peek: () => { seen++; } });
		// origem Lutador (Luta e Reflexos) vem primeiro: o grupo Luta/Pontaria e parte do Fortitude/Reflexos viram vagas livres
		check("onboarding: a origem entrou antes da classe (Luta e Reflexos treinadas pela origem)", R.lockedBy(T.ledgerOf(o).entries, "fighting").includes("Lutador"), R.lockedBy(T.ledgerOf(o).entries, "fighting"));
		await dialog(null, { later: true, peek: (d) => check("onboarding: sobra um seletor de vaga livre (grupos atendidos pela origem)", Boolean(d.querySelector("select[name=slot0]"))) });
		closeAll();
		const orr = view(o);
		check("onboarding: sem perícia repetida (Luta só vem da origem)", T.ledgerOf(o).entries.filter((x) => x.skill === "fighting").length === 1, T.ledgerOf(o).entries.filter((x) => x.skill === "fighting").map((x) => x.source));
		check("onboarding: um diálogo de cada vez", seen === 1);

		// R3 ao contrário: a classe chega primeiro e a origem depois repete a perícia
		const rr = await mk("Ordem");
		await give(rr, get("Combatente") ?? byRx(/^Combatente$/));
		await dialog(["fighting", "resilience"]);
		await drain();
		await give(rr, get("Lutador") ?? byRx(/^Lutador$/));
		await sleep(1800);
		const entries = T.ledgerOf(rr).entries;
		check("R3: a perícia que a classe repetiu da origem volta a pendente", entries.some((x) => x.source === "class" && !x.skill) && R.lockedBy(entries, "fighting").includes("Lutador"), entries.map((x) => [x.skill, x.source]));
		check("R3: a origem fica com Luta (uma entrada só)", entries.filter((x) => x.skill === "fighting").length === 1);
		closeAll();

		// ---------- grimório ----------
		const gm = await mk("Grimorio");
		await give(gm, get("Acadêmico") ?? byRx(/^Acad/));
		await sleep(1200);
		const acro = (await give(gm, get("Acrobático")))[0];
		await sleep(1500);
		const sk = T.trainingReadingForSkill(gm, "sciences");
		check("grimório (perícia): chip Treinada +5, de onde veio e a trava", sk.chip.label === "Treinada +5" && sk.lines.some((l) => /Acadêmico/.test(l)) && sk.lines.some((l) => /Travada/.test(l)), sk);
		check("grimório (perícia): cartão com números e as três regras", sk.card.rules.length === 3 && sk.card.numbers[0].startsWith("Perícias treinadas"), sk.card);
		check("grimório (perícia destreinada)", T.trainingReadingForSkill(gm, "arts").chip.tone === "none");
		const pw = T.trainingReadingForItem(gm, gm.items.get(acro.id));
		check("grimório (poder): treinada pelo poder", /Acrobacia 🔒 · treinada por este poder/.test(pw.lines[0]), pw);
		const sorr = (await give(gm, get("Atlético")))[0];
		await sleep(1500);
		await gm.update({ "system.skills.athleticism.degree.label": "untrained" });
		const gr = game.ordemparanormal?.grimoire;
		check("grimório: está disponível", Boolean(gr));
		if (gr) {
			await gr.open({ actor: gm, tab: "skill", name: "Ciências", kind: "skill" });
			await sleep(1800);
			const el = document.querySelector(".op-gr-training");
			check("grimório (tela): bloco 'Seu treinamento' na leitura da perícia", Boolean(el) && /Treinada \+5/.test(el.textContent) && /Quantas perícias posso ter/.test(el.textContent), el?.textContent?.slice(0, 120));
			await gr.open({ actor: gm, tab: "power", name: "Acrobático", kind: "power" });
			await sleep(1800);
			const el2 = document.querySelector(".op-gr-training");
			check("grimório (tela): leitura do poder mostra a perícia", Boolean(el2) && /Acrobacia/.test(el2.textContent), el2?.textContent?.slice(0, 120));
			document.querySelectorAll(".op-grimoire, [id^=op-grimoire], .grimoire").forEach((w) => w.querySelector("[data-action=close]")?.click());
			game.ordemparanormal.grimoire.close?.();
		}
		check("sorrateiro/atlético sem erro", Boolean(sorr));
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		closeAll();
		for (const a of actors) await a.delete().catch(() => {});
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
