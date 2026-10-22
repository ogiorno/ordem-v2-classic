// Teste ao vivo da confirmação de troca de origem (docs/spec-origens-ui.md, OR-4): arrastar outra origem para a ficha abre a
// confirmação com o que se perde e o que se ganha; "Não" não muda nada; "Sim" tira o poder e as perícias da antiga.
// Rodar com Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/origens-troca-live-test.js)"
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const deg = (a, k) => a.system.skills[k]?.degree?.label ?? "untrained";
	const origins = await game.packs.get(`${SYS}.origins`).getDocuments();
	const get = (n) => origins.find((o) => o.name === n);
	const drain = async (ms = 1500) => {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			const dlg = document.querySelector(".op-skill-choice");
			if (!dlg) { await sleep(150); continue; }
			dlg.querySelectorAll("select").forEach((s, i) => { const o = [...s.options].map((x) => x.value).filter(Boolean); if (!s.value && o.length) s.value = o[Math.min(i, o.length - 1)]; });
			(dlg.querySelector("button[data-action=ok]") ?? dlg.querySelector("button[data-action=later]"))?.click();
			await sleep(400);
		}
	};
	/** Arrasta a origem para a ficha e responde a confirmação ("yes" | "no"); devolve o texto mostrado. */
	const drop = async (actor, origin, answer) => {
		actor.sheet.render({ force: true });
		await sleep(800);
		const pending = actor.sheet._onDropItem({}, { type: "Item", uuid: origin.uuid });
		const dlg = await until(() => [...document.querySelectorAll(".dialog, .application")].find((e) => /Substituir/i.test(e.textContent) && e.querySelector("button")));
		const text = dlg?.textContent.replace(/\s+/g, " ") ?? null;
		const btn = dlg && [...dlg.querySelectorAll("button")].find((b) => (answer === "yes" ? /sim|yes/i : /n[aã]o|no|cancel/i).test(b.textContent) || b.dataset.button === answer);
		btn?.click();
		await pending.catch(() => null);
		await drain(1800);
		return text;
	};
	const actor = await Actor.create({ name: "ZZ origens troca", type: "agent", system: { nivel: { value: 1 } } });
	try {
		await actor.createEmbeddedDocuments("Item", [get("Militar").toObject()]);
		await drain();
		await sleep(500);
		check("Militar: Pontaria treinada", deg(actor, "aim") !== "untrained");
		check("Militar: Para Bellum na ficha", actor.items.some((i) => i.name === "Para Bellum"));

		const text = await drop(actor, get("Atleta"), "no");
		check("confirmação abriu", !!text, text);
		check("confirmação lista o que perde", /Você perde/.test(text ?? "") && /Pontaria/.test(text ?? "") && /Tática/.test(text ?? "") && /Para Bellum/.test(text ?? ""), text);
		check("confirmação lista o que ganha", /Você ganha/.test(text ?? "") && /Acrobacia/.test(text ?? "") && /Atletismo/.test(text ?? ""), text);
		check("'Não': Militar continua", actor.itemTypes.origin[0]?.name === "Militar" && deg(actor, "aim") !== "untrained" && actor.items.some((i) => i.name === "Para Bellum"), actor.items.map((i) => i.name));

		await drop(actor, get("Atleta"), "yes");
		await sleep(800);
		check("'Sim': a origem agora é Atleta", actor.itemTypes.origin.map((o) => o.name).join() === "Atleta", actor.itemTypes.origin.map((o) => o.name));
		check("'Sim': Para Bellum saiu", !actor.items.some((i) => i.name === "Para Bellum"), actor.items.map((i) => i.name));
		check("'Sim': Pontaria e Tática destreinadas", deg(actor, "aim") === "untrained" && deg(actor, "tactics") === "untrained", [deg(actor, "aim"), deg(actor, "tactics")]);
		check("'Sim': Acrobacia e Atletismo treinadas", deg(actor, "acrobatics") !== "untrained" && deg(actor, "athleticism") !== "untrained");
	} finally {
		document.querySelectorAll(".dialog button, .op-skill-choice button").forEach((b) => b.click());
		await actor.delete();
	}
	return JSON.stringify({ ...out, ok: out.falhas.length === 0 });
})()
