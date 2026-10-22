// Teste ao vivo da afinidade na conjuração de rituais (docs/spec-afinidade.md, Fase 2).
// Rodar com o Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/afinidade-ritual-live-test.js)"
// Usa agentes temporários "ZZ afinritual ..."; apaga tudo no fim. Não conjura de verdade (só o caminho recusado).
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const C = await import(`/systems/${SYS}/module/macros/ritual-caster.mjs`);
	const A = await import(`/systems/${SYS}/module/helpers/affinity.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const asPlayer = async (fn) => {
		Object.defineProperty(game.user, "isGM", { get: () => false, configurable: true });
		try { return await fn(); } finally { delete game.user.isGM; }
	};
	const mk = async (name, paranormal = {}) => {
		const a = await Actor.create({ name: `ZZ afinritual ${name}`, type: "agent", system: { nivel: { value: 12 }, paranormal } });
		actors.push(a);
		return a;
	};
	const give = async (a, data) => (await a.createEmbeddedDocuments("Item", [data]))[0];
	const warns = [];
	const realWarn = ui.notifications.warn;

	try {
		const pack = game.packs.get(`${SYS}.rituals`);
		const docs = await pack.getDocuments();
		const find = (rx) => docs.find((d) => rx.test(d.name));
		// Verdadeiro exige afinidade (genérica) em Aprimorar Físico (Sangue) e afinidade com Morte em Cicatrização
		const fisico = find(/^Aprimorar F/);
		const cicatriz = find(/^Cicatriza/);
		check("rituais de teste existem no compêndio", Boolean(fisico && cicatriz), [fisico?.name, cicatriz?.name]);

		// ---------- 1) forma Verdadeira sem e com afinidade ----------
		const a = await mk("Sem afinidade");
		const rit = await give(a, fisico.toObject());
		const el = rit.system.element;
		check("o ritual é de um elemento conhecido", ["blood", "death", "knowledge", "energy"].includes(el), el);
		const forms = C.getRitualForms(rit);
		check("a forma Verdadeira pede afinidade", Boolean(forms.true?.requiredAffinity), forms.true);
		const basic = await asPlayer(() => C.buildRitualSelection(rit, "basic", a));
		check("forma básica não exige afinidade", basic.ok === true, basic);
		const noAff = await asPlayer(() => C.buildRitualSelection(rit, "true", a));
		check("jogador sem afinidade não pode a Verdadeira", noAff.ok === false && /Exige afinidade/.test(noAff.reason), noAff);
		const gm = C.buildRitualSelection(rit, "true", a);
		check("o Mestre passa por cima da exigência", gm.ok === true, gm);

		await a.update({ "system.paranormal": { connection: el, affinity: "" } }, { opParanormal: true });
		const onlyConn = await asPlayer(() => C.buildRitualSelection(rit, "true", a));
		check("só conexão (sem afinidade) ainda não basta", onlyConn.ok === false, onlyConn);

		await a.update({ "system.paranormal": { connection: el, affinity: el } }, { opParanormal: true });
		const withAff = await asPlayer(() => C.buildRitualSelection(rit, "true", a));
		check("afinidade com o elemento libera a Verdadeira", withAff.ok === true, withAff);

		const other = el === "death" ? "blood" : "death";
		const b = await mk("Outro elemento", { connection: other, affinity: other });
		const rit2 = await give(b, fisico.toObject());
		const wrong = await asPlayer(() => C.buildRitualSelection(rit2, "true", b));
		check("afinidade com outro elemento não libera", wrong.ok === false && /Exige afinidade/.test(wrong.reason), wrong);

		// ---------- 2) afinidade com X explícito ----------
		const c = await mk("Morte", { connection: "death", affinity: "death" });
		const rit3 = await give(c, cicatriz.toObject());
		check("Cicatrização é de Morte", rit3.system.element === "death", rit3.system.element);
		const cic = await asPlayer(() => C.buildRitualSelection(rit3, "true", c));
		check("'afinidade com Morte' atendida por afinidade com Morte", cic.ok === true, cic);
		const d = await mk("Sangue", { connection: "blood", affinity: "blood" });
		const rit4 = await give(d, cicatriz.toObject());
		const cic2 = await asPlayer(() => C.buildRitualSelection(rit4, "true", d));
		check("'afinidade com Morte' não é atendida por Sangue", cic2.ok === false && /Morte/.test(cic2.reason), cic2);

		// ---------- 3) componentes ----------
		const e = await mk("Componentes");
		const rit5 = await give(e, fisico.toObject());
		const elLabel = { blood: "Sangue", death: "Morte", knowledge: "Conhecimento", energy: "Energia" }[rit5.system.element];
		const miss = A.castRequirements(e, rit5.system.element).components;
		check("sem afinidade e sem componente: avisa", miss.state === "missing" && miss.note.includes(elLabel), miss);
		await give(e, { name: `Componente de ${elLabel}`, type: "generalEquipment", system: {} });
		check("com o componente do elemento: ok", A.castRequirements(e, rit5.system.element).components.state === "ok");
		const e2 = await mk("Componente errado");
		await give(e2, { name: `Componente de ${rit5.system.element === "death" ? "Sangue" : "Morte"}`, type: "generalEquipment", system: {} });
		check("componente de outro elemento não vale", A.castRequirements(e2, rit5.system.element).components.state === "missing");
		const e3 = await mk("Improvisa");
		await give(e3, { name: "Improvisar Componentes", type: "ability", system: { abilityType: "occultist" } });
		check("Improvisar Componentes evita o aviso", A.castRequirements(e3, rit5.system.element).components.state === "improvised");
		const e4 = await mk("Afinidade dispensa", { connection: rit5.system.element, affinity: rit5.system.element });
		check("afinidade dispensa o componente", A.castRequirements(e4, rit5.system.element).components.state === "dispensed");
		const e5 = await mk("Afinidade outro", { connection: other, affinity: other });
		check("afinidade com outro elemento não dispensa", A.castRequirements(e5, rit5.system.element).components.state === "missing");

		// ---------- 4) conjurar a Verdadeira sem afinidade é recusado e não gasta PD ----------
		ui.notifications.warn = (msg, ...rest) => { warns.push(String(msg)); return realWarn.call(ui.notifications, msg, ...rest); };
		const f = await mk("Recusa");
		const rit6 = await give(f, fisico.toObject());
		const before = f.system.PD.value;
		const selection = { itemId: rit6.id, formId: "true", circle: 4, cost: 5, effect: null, preparationConfirmed: true, markedConfirmed: true, targetIds: [], concentration: "none", damageDt: null, targetChosen: true, cancelIfNoArea: true };
		await asPlayer(() => C.resolveCast(f, selection));
		await sleep(400);
		check("resolveCast recusa a forma sem afinidade", warns.some((w) => /afinidade/i.test(w)), warns);
		check("nenhum PD foi gasto", f.system.PD.value === before, [before, f.system.PD.value]);
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		ui.notifications.warn = realWarn;
		for (const a of actors) await a.delete().catch(() => {});
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
