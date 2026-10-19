// Teste ao vivo da linha "Afinidade" dos poderes paranormais (docs/spec-afinidade.md, Fase 4).
// Rodar com o Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/afinidade-poderes-live-test.js)"
// Usa agentes temporários "ZZ afinpoder ..." e apaga tudo no fim.
(async () => {
	const SYS = "ordem_v2_classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const A = await import(`/systems/${SYS}/module/helpers/affinity.mjs`);
	const P = await import(`/systems/${SYS}/module/helpers/affinity-powers.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const notes = [];
	const realWarn = ui.notifications.warn;
	const realInfo = ui.notifications.info;
	ui.notifications.warn = (m, ...r) => { notes.push(["warn", String(m)]); return realWarn.call(ui.notifications, m, ...r); };
	ui.notifications.info = (m, ...r) => { notes.push(["info", String(m)]); return realInfo.call(ui.notifications, m, ...r); };
	const mk = async (name) => { const a = await Actor.create({ name: `ZZ afinpoder ${name}`, type: "agent", system: { nivel: { value: 12 } } }); actors.push(a); return a; };
	const par = (a) => a.system.paranormal;
	const setPar = (a, data) => a.update({ "system.paranormal": data }, { opParanormal: true });
	const settle = () => sleep(1300);

	try {
		const pack = game.packs.get(`${SYS}.paranormalPowers`);
		const docs = await pack.getDocuments();
		const pw = (rx) => docs.find((d) => rx.test(d.name));
		const espreitar = pw(/^Espreitar/);
		const vivo = pw(/^Sangue Vivo/);
		const ferro = pw(/^Sangue de Ferro/);
		const potencial = pw(/^Potencial Aprimorado/);
		const resistir = pw(/^Resistir a/);
		check("poderes de teste existem no compêndio", [espreitar, vivo, ferro, potencial, resistir].every(Boolean));
		const give = async (a, d) => (await a.createEmbeddedDocuments("Item", [d.toObject()]))[0];
		const ruleFx = (item, flag) => item.effects.filter((e) => e.getFlag(SYS, flag));
		const stealth = (a) => a.system.skills.stealth.mod ?? 0;

		// ---------- 1) cópia com afinidade: +5 além do bônus normal (total +10) ----------
		const a = await mk("Com afinidade");
		const base0 = stealth(a);
		const first = await give(a, espreitar);
		await settle();
		check("1ª cópia não é marcada", !first.getFlag(SYS, P.AFFINITY_COPY_FLAG));
		check("1ª cópia dá o bônus normal (+5 Furtividade)", stealth(a) === base0 + 5, [base0, stealth(a)]);
		await setPar(a, { connection: "blood", affinity: "blood" });
		notes.length = 0;
		const copy = await give(a, espreitar);
		await settle();
		check("2ª cópia é marcada como cópia de afinidade", copy.getFlag(SYS, P.AFFINITY_COPY_FLAG) === true);
		check("2ª cópia tem o efeito de afinidade", ruleFx(copy, P.AFFINITY_RULE_FLAG).length === 1, copy.effects.map((e) => e.name));
		check("2ª cópia não repete o bônus normal", ruleFx(copy, "passiveRule").length === 0, copy.effects.map((e) => e.flags));
		check("Furtividade total +10 (linha 'aumenta para +10')", stealth(a) === base0 + 10, [base0, stealth(a)]);
		check("sem aviso de afinidade ausente", !notes.some(([k, m]) => k === "warn" && /segunda vez/.test(m)), notes);
		check("a cópia não conta como poder novo (afinidade segue igual)", par(a).affinity === "blood" && par(a).connection === "blood");

		// ---------- 2) cópia sem afinidade: marcada, sem efeito, com aviso ----------
		const b = await mk("Sem afinidade");
		const base1 = stealth(b);
		await give(b, espreitar);
		await settle();
		notes.length = 0;
		const copyB = await give(b, espreitar);
		await settle();
		check("cópia sem afinidade é marcada", copyB.getFlag(SYS, P.AFFINITY_COPY_FLAG) === true);
		check("cópia sem afinidade avisa", notes.some(([k, m]) => k === "warn" && /afinidade com Sangue/.test(m)), notes);
		check("cópia sem afinidade não dá efeito nenhum", copyB.effects.size === 0, copyB.effects.map((e) => e.name));
		check("Furtividade fica só com o bônus normal", stealth(b) === base1 + 5, [base1, stealth(b)]);

		// ---------- 3) ganhar a afinidade depois liga a cópia; apagar desliga ----------
		await setPar(b, { connection: "blood", affinity: "blood" });
		await settle();
		check("afinidade ganha depois liga o efeito da cópia", ruleFx(copyB, P.AFFINITY_RULE_FLAG).length === 1 && stealth(b) === base1 + 10, [ruleFx(copyB, P.AFFINITY_RULE_FLAG).length, stealth(b)]);
		await setPar(b, { connection: "", affinity: "" });
		await settle();
		check("apagar a afinidade desliga o efeito", ruleFx(copyB, P.AFFINITY_RULE_FLAG).length === 0 && stealth(b) === base1 + 5, [ruleFx(copyB, P.AFFINITY_RULE_FLAG).length, stealth(b)]);

		// ---------- 4) elemento errado não liga ----------
		const c = await mk("Elemento errado");
		await give(c, potencial);
		await setPar(c, { connection: "blood", affinity: "blood" });
		const copyC = await give(c, potencial);
		await settle();
		check("afinidade com Sangue não liga a cópia de poder de Morte", ruleFx(copyC, P.AFFINITY_RULE_FLAG).length === 0);
		await setPar(c, { connection: "death", affinity: "death" });
		await settle();
		const fx = ruleFx(copyC, P.AFFINITY_RULE_FLAG)[0];
		check("com afinidade com Morte liga: +1 PE por 5% de NEX", Boolean(fx) && fx.system.changes[0].key === "system.PE.bonus", fx?.system?.changes);

		// ---------- 5) poder de linha manual: marca e avisa, sem efeito ----------
		const d = await mk("Manual");
		await give(d, vivo);
		await setPar(d, { connection: "blood", affinity: "blood" });
		notes.length = 0;
		const copyD = await give(d, vivo);
		await settle();
		check("linha manual: cópia marcada, sem efeito", copyD.getFlag(SYS, P.AFFINITY_COPY_FLAG) === true && copyD.effects.size === 0);
		check("linha manual: avisa para aplicar pelo texto", notes.some(([k, m]) => k === "info" && /cura acelerada aumenta para 5/.test(m)), notes);

		// ---------- 6) Sangue de Ferro (+5 Fortitude) ----------
		const e = await mk("Ferro");
		const fort0 = e.system.skills.resilience.mod ?? 0;
		await give(e, ferro);
		await setPar(e, { connection: "blood", affinity: "blood" });
		await give(e, ferro);
		await settle();
		check("Sangue de Ferro: cópia soma +5 em Fortitude", (e.system.skills.resilience.mod ?? 0) === fort0 + 5, [fort0, e.system.skills.resilience.mod]);

		// ---------- 7) Resistir a Elemento repete sem virar cópia ----------
		const f = await mk("Resistir");
		const r1 = await give(f, resistir);
		const r2 = await give(f, resistir);
		await settle();
		check("Resistir a Elemento não vira cópia de afinidade", !r1.getFlag(SYS, P.AFFINITY_COPY_FLAG) && !r2.getFlag(SYS, P.AFFINITY_COPY_FLAG));

		// ---------- 8) contagem por elemento usa a tabela (pré-requisito vazio) ----------
		const view = A.affinityView(c);
		check("vista: Potencial Aprimorado conta como poder de Morte", view.counts.find((x) => x.key === "death")?.count === 2, view.counts);

		// ---------- 9) apagar a cópia tira o efeito ----------
		const ids = copy.effects.map((x) => x.id);
		await copy.delete();
		await settle();
		check("apagar a cópia tira o bônus (Furtividade volta a +5)", stealth(a) === base0 + 5 && ids.length === 1, [stealth(a), ids.length]);
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		ui.notifications.warn = realWarn;
		ui.notifications.info = realInfo;
		for (const a of actors) await a.delete().catch(() => {});
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
