// Teste ao vivo da afinidade nos testes de resistência (docs/spec-afinidade.md, Fase 3): +1d20 / -1d20 contra o elemento do efeito.
// Rodar com o Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/afinidade-teste-live-test.js)"
// Usa agentes temporários "ZZ afintest ..." e apaga as mensagens de chat que cria.
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };
	const Area = await import(`/systems/${SYS}/module/macros/ritual-area-engine.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const seen = new Set(game.messages.map((m) => m.id));
	const mk = async (name, paranormal = {}, type = "agent") => {
		const system = type === "agent" ? { nivel: { value: 12 }, attributes: { pre: { value: 3 } }, paranormal } : {};
		const a = await Actor.create({ name: `ZZ afintest ${name}`, type, system });
		actors.push(a);
		return a;
	};
	const dice = async (a, element, skill = "will") => {
		const rolls = await a.rollSkill({ skill, effectElement: element }, { configure: false }, { create: false });
		const roll = Array.isArray(rolls) ? rolls[0] : rolls;
		return roll?.d20?.number ?? roll?.terms?.[0]?.number ?? null;
	};

	try {
		const sangue = await mk("Sangue", { connection: "blood", affinity: "blood" });
		const sem = await mk("Sem afinidade");
		const conectado = await mk("Conectado", { connection: "blood", affinity: "" });

		// ---------- 1) dados do teste ----------
		const base = await dice(sangue, "");
		check("teste sem elemento: 3d20 (Presença 3)", base === 3, base);
		check("contra o próprio elemento: +1d20", (await dice(sangue, "blood")) === base + 1, await dice(sangue, "blood"));
		check("contra o elemento opressor (Morte): -1d20", (await dice(sangue, "death")) === base - 1, await dice(sangue, "death"));
		check("contra outro elemento: sem mudança", (await dice(sangue, "energy")) === base && (await dice(sangue, "knowledge")) === base);
		check("contra Medo: sem mudança", (await dice(sangue, "fear")) === base);
		check("perícia de Fortitude também recebe o dado", (await dice(sangue, "blood", "resilience")) === (await dice(sangue, "", "resilience")) + 1);
		check("sem afinidade: nada muda", (await dice(sem, "blood")) === (await dice(sem, "")), [await dice(sem, "blood"), await dice(sem, "")]);
		check("só conexão: nada muda", (await dice(conectado, "blood")) === (await dice(conectado, "")));

		// ---------- 2) o teste do alvo de um ritual de área (autoRoll da engine) ----------
		const lastRollDice = () => game.messages.contents.filter((m) => !seen.has(m.id) && m.rolls?.length).pop()?.rolls?.[0]?.d20?.number ?? null;
		await Area.autoRoll(sangue, "will", 10, { effectElement: "blood" });
		check("autoRoll da área com elemento do ritual: +1d20", lastRollDice() === base + 1, lastRollDice());
		await Area.autoRoll(sangue, "will", 10, { effectElement: "death" });
		check("autoRoll da área contra Morte: -1d20", lastRollDice() === base - 1, lastRollDice());
		await Area.autoRoll(sangue, "will", 10);
		check("autoRoll sem elemento: sem mudança", lastRollDice() === base, lastRollDice());

		// ---------- 3) ameaças não têm afinidade ----------
		const amea = await mk("Ameaça", {}, "threat");
		const rolls = await amea.rollSkill({ skill: "will", effectElement: "blood" }, { configure: false }, { create: false }).catch((err) => ({ err }));
		check("ameaça rola normalmente com elemento", !rolls?.err, rolls?.err?.message);

		// ---------- 4) janela de rolagem ----------
		const open = (a, element) => { const p = a.rollSkill({ skill: "will", effectElement: element }, {}, { create: false }); return p; };
		const p1 = open(sangue, "death");
		const select = await until(() => document.querySelector(".application select[name=effectElement]"));
		check("janela: agente com afinidade vê o seletor de elemento do efeito", Boolean(select));
		check("janela: vem preenchido com o elemento do ritual", select?.value === "death", select?.value);
		const opts = [...(select?.options ?? [])].map((o) => o.value).sort().join();
		check("janela: quatro elementos e vazio", opts === ",blood,death,energy,knowledge", opts);
		// muda para o próprio elemento e confere que a rolagem usa o valor da janela
		if (select) { select.value = "blood"; select.dispatchEvent(new Event("change", { bubbles: true })); }
		const rollBtn = document.querySelector(".application button[data-action=normal]");
		check("janela: botão de rolar existe", Boolean(rollBtn));
		rollBtn?.click();
		const rolled = await Promise.race([p1, sleep(6000).then(() => "timeout")]);
		const r1 = Array.isArray(rolled) ? rolled[0] : rolled;
		check("janela: elemento escolhido na janela vale na rolagem (+1d20)", r1?.d20?.number === base + 1, r1?.d20?.number ?? rolled);
		document.querySelectorAll(".application button[data-action=close]").forEach((b) => b.click());
		await sleep(400);

		const p2 = open(sem, "death");
		await sleep(1500);
		check("janela: agente sem afinidade não vê o seletor", !document.querySelector(".application select[name=effectElement]"));
		document.querySelectorAll(".application button[data-action=close]").forEach((b) => b.click());
		await Promise.race([p2, sleep(3000)]);
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		document.querySelectorAll(".application button[data-action=close]").forEach((b) => b.click());
		const ids = game.messages.contents.filter((m) => !seen.has(m.id)).map((m) => m.id);
		if (ids.length) await ChatMessage.deleteDocuments(ids).catch(() => {});
		for (const a of actors) await a.delete().catch(() => {});
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
