// Teste ao vivo das perícias treinadas (docs/arquivo/spec-pericias-treinadas.md).
// Rodar com Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/pericias-treinadas-live-test.js)"
// Usa agentes temporários "ZZ treino ..." e os diálogos de verdade; apaga tudo no fim.
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };
	const T = await import(`/systems/${SYS}/module/helpers/skill-training.mjs`);
	const R = await import(`/systems/${SYS}/module/helpers/skill-training-rules.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const deg = (a, k) => a.system.skills[k].degree.label;
	const mod = (a, k) => a.system.skills[k].mod ?? 0;
	const view = (a) => T.resolveActor(a);

	/** Espera o diálogo, preenche os seletores (valores por posição) e confirma ou adia. */
	const dialog = async (values, { later = false, check: peek } = {}) => {
		const dlg = await until(() => document.querySelector(".op-skill-choice"));
		if (!dlg) return null;
		if (peek) peek(dlg);
		if (later) dlg.querySelector("button[data-action=later]").click();
		else {
			(values ?? []).forEach((v, i) => { const s = dlg.querySelector(`select[name=slot${i}]`); if (s) s.value = v; });
			dlg.querySelector("button[data-action=ok]").click();
		}
		await until(() => !document.querySelector(".op-skill-choice"), 4000);
		await sleep(900);
		return dlg;
	};
	const closeAll = () => document.querySelectorAll(".op-skill-choice").forEach((el) => el.querySelector("button[data-action=later],button[data-action=ok]")?.click());
	const asPlayer = async (fn) => {
		Object.defineProperty(game.user, "isGM", { get: () => false, configurable: true });
		try { return await fn(); } finally { delete game.user.isGM; }
	};

	try {
		const docs = {};
		for (const pack of game.packs.filter((p) => p.metadata.packageName === SYS && p.documentName === "Item")) for (const d of await pack.getDocuments()) (docs[R.trainingKey(d.name)] ??= []).push(d);
		const get = (name) => (docs[R.trainingKey(name)] ?? docs[R.trainingKey(name).replace(/^(nex \d+|estagio \d+) /, "")] ?? [])[0];
		const byPrefix = (rx) => Object.values(docs).flat().find((d) => rx.test(d.name));
		const mk = async (name, sys = {}) => { const a = await Actor.create({ name: `ZZ treino ${name}`, type: "agent", system: { attributes: { str: { value: 2 }, dex: { value: 2 }, vit: { value: 2 }, int: { value: 1 }, pre: { value: 2 }, ...sys } } }); actors.push(a); return a; };
		const give = async (a, item) => (await a.createEmbeddedDocuments("Item", [item.toObject()]))[0];

		// ---------- 1) origem + classe ----------
		const a = await mk("Combatente");
		const origem = await give(a, get("Acadêmico") ?? byPrefix(/^Acad/));
		await sleep(1200);
		check("origem: Ciências e Investigação treinadas", deg(a, "sciences") === "trained" && deg(a, "investigation") === "trained", [deg(a, "sciences"), deg(a, "investigation")]);
		check("origem: as duas ficam travadas pela origem", R.lockedBy(T.ledgerOf(a).entries, "sciences").length === 1);
		check("origem: 2/2 vagas", view(a).budget.train.used === 2);
		const classe = await give(a, get("Combatente") ?? byPrefix(/^Combatente$/));
		const d1 = await dialog(["fighting", "reflexes"], { check: (dlg) => {
			const opts = [...dlg.querySelectorAll("select[name=slot0] option")].map((o) => o.value).filter(Boolean);
			check("classe: grupo 1 oferece só Luta e Pontaria", opts.sort().join() === "aim,fighting", opts);
		} });
		check("classe: diálogo de grupos abriu", Boolean(d1));
		// vagas livres: 1 + Int(1) = 2, perícias já treinadas ficam desabilitadas
		const d2 = await dialog(["crime", "stealth"], { check: (dlg) => {
			const dis = [...dlg.querySelectorAll("select[name=slot0] option[disabled]")].map((o) => o.value);
			check("classe: perícias da origem e do grupo desabilitadas nas livres", ["sciences", "investigation", "fighting", "reflexes"].every((k) => dis.includes(k)), dis);
			check("classe: duas vagas livres (1 + Int)", Boolean(dlg.querySelector("select[name=slot1]")) && !dlg.querySelector("select[name=slot2]"));
		} });
		check("classe: diálogo das livres abriu", Boolean(d2));
		let r = view(a);
		check("classe: 6 treinadas (2 origem + 2 grupos + 2 livres)", ["sciences", "investigation", "fighting", "reflexes", "crime", "stealth"].every((k) => deg(a, k) === "trained"), SKILLS_TRAINED(a));
		check("contador: 6 / 6, sem pendência, nada acima do limite", r.budget.train.used === 6 && r.budget.train.allowed === 6 && !r.budget.over && R && T.openTrainSlots(a) === 0, r.budget.train);
		check("ficha: o contador aparece na aba Perícias", Boolean(T.trainingView(a)) && T.trainingView(a).train.allowed === 6);

		// ---------- 2) seletor de grau: travas e vagas (como jogador) ----------
		await asPlayer(async () => {
			await a.update({ "system.skills.arts.degree.label": "trained" });
			await sleep(300);
			check("jogador: sem vaga, não treina mais uma perícia", deg(a, "arts") === "untrained", deg(a, "arts"));
			await a.update({ "system.skills.sciences.degree.label": "untrained" });
			await sleep(300);
			check("jogador: perícia da origem não desce (travada)", deg(a, "sciences") === "trained", deg(a, "sciences"));
			await a.update({ "system.skills.crime.degree.label": "veteran" });
			await sleep(300);
			check("jogador: Veterano antes do NEX 35% é recusado", deg(a, "crime") === "trained", deg(a, "crime"));
		});
		await a.update({ "system.skills.arts.degree.label": "trained" });
		await sleep(400);
		r = view(a);
		check("Mestre passa do limite e a ficha marca acima do limite", deg(a, "arts") === "trained" && r.budget.over === true && T.trainingView(a).over === true, r.budget.train);
		await a.update({ "system.skills.arts.degree.label": "untrained" });
		await sleep(400);
		check("Mestre baixa a manual e o contador volta", deg(a, "arts") === "untrained" && !view(a).budget.over);

		// ---------- 3) treinamento ou +2 ----------
		const acro = await give(a, get("Acrobático"));
		await sleep(1500);
		check("Acrobático (destreinada): vira Treinada, sem +2, sem vaga", deg(a, "acrobatics") === "trained" && mod(a, "acrobatics") === 0 && view(a).budget.train.used === 6, [deg(a, "acrobatics"), mod(a, "acrobatics")]);
		check("Acrobático: perícia travada no poder", R.lockedBy(T.ledgerOf(a).entries, "acrobatics").includes("Acrobático"));
		check("Acrobático: nenhum efeito somando em dobro", !(a.items.get(acro.id).effects.some((e) => !e.disabled && e.system.changes.some((c) => c.key.includes("acrobatics"))) ));
		const sorr = await give(a, get("Sorrateiro"));
		await sleep(1500);
		check("Sorrateiro (já treinada pela classe): grau fica, +2 ligado", deg(a, "stealth") === "trained" && mod(a, "stealth") === 2, [deg(a, "stealth"), mod(a, "stealth")]);
		check("Sorrateiro: efeito gerenciado ligado", a.items.get(sorr.id).effects.some((e) => e.getFlag(SYS, "managedBy") === "training" && !e.disabled));
		await a.deleteEmbeddedDocuments("Item", [sorr.id]);
		await sleep(900);
		check("Sorrateiro apagado: +2 some e a perícia continua (da classe)", mod(a, "stealth") === 0 && deg(a, "stealth") === "trained");
		await a.deleteEmbeddedDocuments("Item", [acro.id]);
		await sleep(900);
		check("Acrobático apagado: volta a destreinada", deg(a, "acrobatics") === "untrained" && mod(a, "acrobatics") === 0, deg(a, "acrobatics"));
		// o poder que não era passivo
		const volante = await give(a, byPrefix(/^[ÁA]s do Volante$/));
		await sleep(1500);
		check("Ás do Volante (não é passivo): Pilotagem treinada", deg(a, "driving") === "trained", deg(a, "driving"));
		await a.deleteEmbeddedDocuments("Item", [volante.id]);
		await sleep(700);
		check("Ás do Volante apagado: volta a destreinada", deg(a, "driving") === "untrained");

		// ---------- 4) escolhas ----------
		const e = await mk("Sobrevivente");
		await give(e, get("Sobrevivente") ?? byPrefix(/^Sobrevivente$/));
		await dialog(null, { later: true });
		await sleep(500);
		const esperto = await give(e, get("Estágio 2 - Esperto") ?? byPrefix(/Esperto$/));
		await dialog(["tactics"], { check: (dlg) => check("Esperto: oferece as perícias (27)", dlg.querySelectorAll("select[name=slot0] option:not([value=''])").length === 27) });
		check("Esperto: Tática treinada e travada", deg(e, "tactics") === "trained" && R.lockedBy(T.ledgerOf(e).entries, "tactics").some((l) => /Esperto/.test(l)));
		await e.update({ "system.skills.tactics.degree.label": "untrained" }); // Mestre destrava
		await sleep(400);
		check("Esperto: o Mestre pode destravar", deg(e, "tactics") === "untrained");
		await e.deleteEmbeddedDocuments("Item", [esperto.id]);
		await sleep(700);

		const m = await mk("Mutacao");
		await give(m, get("Mutação") ?? byPrefix(/^Muta/));
		await dialog(["athleticism"], { check: (dlg) => {
			const opts = [...dlg.querySelectorAll("select[name=slot0] option")].map((o) => o.value).filter(Boolean);
			check("Mutação: só perícias de Força, Agilidade ou Vigor", !opts.includes("diplomacy") && !opts.includes("occultism") && opts.includes("athleticism"), opts);
		} });
		check("Mutação: +2 em Atletismo, sem treinar, sem vaga", mod(m, "athleticism") === 2 && deg(m, "athleticism") === "untrained", [mod(m, "athleticism"), deg(m, "athleticism")]);
		check("Mutação: RD 2 continua", m.system.genericRd.value === 2);

		const c = await mk("Carteirada");
		await give(c, byPrefix(/Carteirada$/));
		await dialog(["deception"]);
		check("Carteirada: Enganação treinada (grau real)", deg(c, "deception") === "trained" && mod(c, "deception") === 0, [deg(c, "deception"), mod(c, "deception")]);

		const lab = await mk("Laboratorio", {});
		const labItem = await give(lab, byPrefix(/Laborat.rio de Campo$/));
		await dialog(["profession:engenheiro"]);
		check("Laboratório de Campo: Profissão (engenheiro) treinada e nomeada", deg(lab, "freeSkill") === "trained" && /engenheiro/i.test(lab.system.skills.freeSkill.name), [deg(lab, "freeSkill"), lab.system.skills.freeSkill.name]);

		// Perito / Foco: só perícias treinadas, sem Luta e Pontaria
		const perito = await give(a, byPrefix(/^Perito$/));
		await dialog(["crime", "stealth"], { check: (dlg) => {
			const opts = [...dlg.querySelectorAll("select[name=slot0] option")].map((o) => o.value).filter(Boolean);
			check("Perito: Luta e Pontaria fora; só as treinadas", !opts.includes("fighting") && !opts.includes("aim") && opts.includes("crime") && !opts.includes("diplomacy"), opts);
		} });
		check("Perito: perícias gravadas no poder (peritoSkills)", JSON.stringify(a.items.get(perito.id).getFlag(SYS, "peritoSkills")) === JSON.stringify(["crime", "stealth"]));
		await asPlayer(async () => {
			await a.update({ "system.skills.crime.degree.label": "untrained" });
			await sleep(300);
			check("Perito: a perícia escolhida não pode ser destreinada", deg(a, "crime") === "trained");
		});
		const foco = await give(a, get("Foco em Perícia"));
		await dialog(["stealth"], { check: (dlg) => {
			const opts = [...dlg.querySelectorAll("select[name=slot0] option")].map((o) => o.value).filter(Boolean);
			check("Foco em Perícia: sem Luta/Pontaria", !opts.includes("fighting") && !opts.includes("aim"), opts);
		} });
		check("Foco em Perícia: escolha gravada (focusSkill)", a.items.get(foco.id).getFlag(SYS, "focusSkill") === "stealth");
		await a.deleteEmbeddedDocuments("Item", [perito.id, foco.id]);
		await sleep(600);

		// ---------- 5) Treinamento em Perícia e Grau de Treinamento ----------
		const g = await mk("Especialista", {});
		await give(g, get("Especialista") ?? byPrefix(/^Especialista$/));
		await dialog(null, { later: true });
		await sleep(400);
		const tp = await give(g, docs[R.trainingKey("Treinamento em Perícia")].find((d) => /specialist/i.test(d.pack ?? "")) ?? docs[R.trainingKey("Treinamento em Perícia")][0]);
		await dialog(["train:crime"]);
		await dialog(["train:tactics"]);
		check("Treinamento em Perícia: duas treinadas", deg(g, "crime") === "trained" && deg(g, "tactics") === "trained");
		check("Treinamento em Perícia: travadas no item", R.lockedBy(T.ledgerOf(g).entries, "crime").length === 1);
		await g.update({ "system.nivel.value": 7 });
		await sleep(500);
		await asPlayer(async () => {
			await g.update({ "system.skills.tactics.degree.label": "expert" });
			await sleep(300);
			check("Expert antes do NEX 70% é recusado", deg(g, "tactics") === "trained");
		});
		const gb = view(g).budget;
		check("Grau de Treinamento NEX 35% (Especialista): 5 + Int aumentos", gb.raise.allowed === 5 + 1, gb.raise);
		const raises = T.chooseGradeRaises(g);
		await dialog(["crime", "tactics", "", "", "", ""].slice(0, 6));
		await raises;
		await sleep(600);
		check("Grau de Treinamento: as duas sobem para Veterana", deg(g, "crime") === "veteran" && deg(g, "tactics") === "veteran", [deg(g, "crime"), deg(g, "tactics")]);
		check("Grau de Treinamento: saldo restante no contador", view(g).budget.raise.used === 2 && view(g).budget.raise.allowed - view(g).budget.raise.used === 4);
		await g.deleteEmbeddedDocuments("Item", [tp.id]);
		await sleep(900);
		check("Apagar o Treinamento em Perícia: quem já subiu de grau continua treinada (o Mestre decide)", deg(g, "crime") === "veteran" && deg(g, "tactics") === "veteran", [deg(g, "crime"), deg(g, "tactics")]);

		// ---------- 6) migração de ficha antiga ----------
		const old = await mk("Antiga");
		await old.update({ "system.skills.stealth.degree.label": "trained", "system.skills.crime.degree.label": "veteran", "system.nivel.value": 7 }, { opSkillTraining: true });
		await give(old, get("Sorrateiro"));
		await sleep(1500);
		await old.unsetFlag(SYS, "skillTraining");
		await sleep(300);
		check("ficha antiga: sem livro-caixa", !T.ledgerOf(old).migrated);
		await T.ensureLedger(old);
		await sleep(900);
		const mr = view(old);
		check("migração: graus preservados", deg(old, "stealth") === "trained" && deg(old, "crime") === "veteran", [deg(old, "stealth"), deg(old, "crime")]);
		check("migração: Sorrateiro virou +2 (já era treinada) e o total não mudou", mod(old, "stealth") === 2, mod(old, "stealth"));
		check("migração: livro-caixa criado", T.ledgerOf(old).migrated && mr.degrees.stealth === 1);
		await T.ensureLedger(old);
		check("migração roda uma vez só", (await T.ensureLedger(old)) === false);

		// ---------- 7) o Intelecto permanente libera vaga; o temporário não ----------
		const i = await mk("Intelecto");
		await give(i, get("Combatente") ?? byPrefix(/^Combatente$/));
		await dialog(null, { later: true });
		await sleep(500);
		const base = view(i).budget.train.allowed;
		await i.update({ "system.attributes.int.value": 2 });
		await sleep(400);
		check("Intelecto +1 libera +1 vaga", view(i).budget.train.allowed === base + 1, [base, view(i).budget.train.allowed]);
		const tmp = await i.createEmbeddedDocuments("ActiveEffect", [{ name: "Int temporário", changes: [{ key: "system.attributes.int.value", type: "add", value: 2, phase: "initial" }], duration: { rounds: 3 } }]);
		await sleep(300);
		check("efeito temporário de Int não conta (R7)", T.permanentInt(i) === 2, T.permanentInt(i));
		await i.deleteEmbeddedDocuments("ActiveEffect", tmp.map((x) => x.id));
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		closeAll();
		for (const a of actors) await a.delete().catch(() => {});
	}
	function SKILLS_TRAINED(a) { return Object.entries(a.system.skills).filter(([, s]) => s.degree.label !== "untrained").map(([k]) => k); }
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
