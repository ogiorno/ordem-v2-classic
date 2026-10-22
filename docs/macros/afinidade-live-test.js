// Teste ao vivo da conexão e afinidade (docs/spec-afinidade.md, Fase 1).
// Rodar com o Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/afinidade-live-test.js)"
// Usa agentes temporários "ZZ afinidade ..." e os diálogos de verdade; apaga tudo no fim.
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };
	const A = await import(`/systems/${SYS}/module/helpers/affinity.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const mk = async (name, nivel) => { const a = await Actor.create({ name: `ZZ afinidade ${name}`, type: "agent", system: { nivel: { value: nivel } } }); actors.push(a); return a; };
	const power = (name, pre = "Sangue 1") => ({ name: `ZZ ${name}`, type: "ability", system: { abilityType: "paranormal", preRequisite: pre } });
	const dialog = () => until(() => document.querySelector(".op-affinity-choice"));
	const pick = async (key) => {
		const dlg = await dialog();
		if (!dlg) return null;
		dlg.querySelector(`button[data-action=${key}]`).click();
		await until(() => !document.querySelector(".op-affinity-choice"), 4000);
		await sleep(700);
		return dlg;
	};
	const closeAll = () => document.querySelectorAll(".op-affinity-choice,.dialog").forEach((el) => el.querySelector("button[data-action=later],button[data-action=no]")?.click());
	const asPlayer = async (fn) => {
		Object.defineProperty(game.user, "isGM", { get: () => false, configurable: true });
		try { return await fn(); } finally { delete game.user.isGM; }
	};
	const par = (a) => a.system.paranormal;

	try {
		// ---------- 1) subir para NEX 50% abre a escolha ----------
		const a = await mk("Subida", 9);
		check("nível 9: sem conexão e bloqueado", affinityState(a) === "locked", affinityState(a));
		check("nível 9: nenhum diálogo", !document.querySelector(".op-affinity-choice"));
		await a.update({ "system.nivel.value": 10 });
		const dlg = await dialog();
		check("nível 10: diálogo de conexão abriu", Boolean(dlg));
		const buttons = [...(dlg?.querySelectorAll(".form-footer button[data-action]") ?? [])].map((b) => b.dataset.action).sort();
		check("diálogo oferece os quatro elementos e 'decidir depois'", buttons.join() === "blood,death,energy,knowledge,later", buttons);
		await pick("blood");
		check("escolha grava a conexão", par(a).connection === "blood", par(a));
		check("conexão nasceu da subida: graça no nível 10", par(a).graceLevel === 10, par(a));
		check("ainda sem afinidade", par(a).affinity === "", par(a));
		check("estado: conectado", affinityState(a) === "connected", affinityState(a));

		// ---------- 2) a conexão não muda ----------
		await asPlayer(() => a.update({ "system.paranormal.connection": "death" }));
		check("jogador não troca a conexão", par(a).connection === "blood", par(a));
		await asPlayer(() => a.update({ "system.paranormal.affinity": "death" }));
		check("jogador não escreve a afinidade", par(a).affinity === "", par(a));
		const again = await A.promptConnection(a);
		check("não abre de novo depois de conectar", again === null && !document.querySelector(".op-affinity-choice"));

		// ---------- 3) poder paranormal vira afinidade (B1) ----------
		await a.createEmbeddedDocuments("Item", [power("Poder A")]);
		await sleep(1200);
		check("poder do mesmo nível da conexão não conta", par(a).affinity === "", par(a));
		await a.update({ "system.nivel.value": 11 });
		await sleep(600);
		closeAll();
		await a.createEmbeddedDocuments("Item", [power("Poder B", "Sangue 2")]);
		await sleep(1200);
		check("poder do nível seguinte vira afinidade", par(a).affinity === "blood", par(a));
		check("graça zerada", par(a).graceLevel === 0, par(a));
		const view = A.affinityView(a);
		check("vista: afinidade com Sangue", view.state === "affinity" && view.elementLabel === "Sangue", view);
		check("vista: opressor é Morte", view.oppressor === "death" && view.oppressorLabel === "Morte", view.oppressor);
		check("vista: conta os poderes de Sangue", view.counts.find((c) => c.key === "blood")?.count === 2, view.counts);

		// ---------- 4) o cartão aparece na ficha ----------
		await a.sheet.render(true);
		const card = await until(() => a.sheet.element?.querySelector(".op-affinity-card"));
		check("ficha: cartão de afinidade aparece", Boolean(card));
		check("ficha: título com o elemento", /Afinidade com Sangue/.test(card?.textContent ?? ""), card?.textContent?.slice(0, 80));
		check("ficha: Mestre vê o botão de apagar", Boolean(card?.querySelector("[data-action=clearConnection]")));
		check("ficha: sem botão de escolher (já conectado)", !card?.querySelector("[data-action=chooseConnection]"));
		await a.sheet.close();

		// ---------- 5) só o Mestre apaga ----------
		const kept = await asPlayer(() => A.clearConnection(a));
		check("jogador não apaga a conexão", kept === false && par(a).connection === "blood", par(a));
		const clearing = A.clearConnection(a);
		const confirm = await until(() => [...document.querySelectorAll(".dialog button[data-action=yes]")].pop());
		confirm?.click();
		check("Mestre apaga a conexão", (await clearing) === true && par(a).connection === "" && par(a).affinity === "", par(a));

		// ---------- 6) ficha antiga (já passou do NEX 50%) ----------
		const b = await mk("Antiga", 12);
		await sleep(900);
		check("ficha acima de NEX 50%: nenhum diálogo sozinho", !document.querySelector(".op-affinity-choice"));
		check("ficha antiga: conexão pendente", affinityState(b) === "pending" && A.affinityView(b).canChoose, affinityState(b));
		await b.sheet.render(true);
		const card2 = await until(() => b.sheet.element?.querySelector(".op-affinity-card"));
		check("ficha antiga: botão 'Escolher elemento'", Boolean(card2?.querySelector("[data-action=chooseConnection]")));
		await b.sheet.close();
		const asking = A.promptConnection(b);
		await pick("death");
		check("botão da ficha grava a conexão", (await asking) === "death" && par(b).connection === "death", par(b));
		check("pelo botão não há período de graça", par(b).graceLevel === 0, par(b));
		await b.createEmbeddedDocuments("Item", [power("Poder C", "Morte 1")]);
		await sleep(1200);
		check("poder seguinte vira afinidade já no mesmo nível", par(b).affinity === "death", par(b));
		check("opressor de Morte é Energia", A.affinityView(b).oppressorLabel === "Energia", A.affinityView(b).oppressorLabel);

		// ---------- 7) decidir depois ----------
		const c = await mk("Depois", 9);
		await c.update({ "system.nivel.value": 10 });
		await pick("later");
		check("'decidir depois' não grava nada", par(c).connection === "", par(c));
		check("'decidir depois': continua pendente", A.affinityView(c).canChoose);

		// ---------- 8) fichas que não são de agente ----------
		const t = await Actor.create({ name: "ZZ afinidade Ameaça", type: "threat" }); actors.push(t);
		check("ameaça não tem vista de afinidade", A.affinityView(t) === null);
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		closeAll();
		for (const a of actors) await a.delete().catch(() => {});
	}
	function affinityState(a) { return A.affinityView(a).state; }
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
