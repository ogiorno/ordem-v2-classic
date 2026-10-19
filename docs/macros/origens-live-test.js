// Teste ao vivo das origens (docs/spec-origens-ui.md): cada origem concede perícias e poder; trocar a origem tira tudo o que ela deu.
// Rodar com Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/origens-live-test.js)"
// Usa um agente temporário "ZZ origens" (apagado no fim) e responde os diálogos de verdade. Não toca nas fichas reais.
(async () => {
	const SYS = "ordem_v2_classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const R = await import(`/systems/${SYS}/module/helpers/skill-training-rules.mjs`);
	const L = await import(`/systems/${SYS}/module/helpers/level-progression-rules.mjs`);
	const out = { falhas: [], total: 0, origens: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const deg = (a, k) => a.system.skills[k]?.degree?.label ?? "untrained";

	/** Responde todo diálogo de escolha até a fila esvaziar (primeira opção válida; texto "teste" para Profissão). */
	let dialogs = [];
	const drain = async (ms = 2500) => {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			const dlg = document.querySelector(".op-skill-choice");
			if (!dlg) { await sleep(150); continue; }
			dialogs.push(dlg.textContent.replace(/\s+/g, " "));
			const input = dlg.querySelector("input[name=name]");
			if (input) input.value = "teste";
			dlg.querySelectorAll("select").forEach((s, i) => {
				const opts = [...s.options].map((o) => o.value).filter(Boolean);
				if (!s.value && opts.length) s.value = opts[Math.min(i, opts.length - 1)];
			});
			(dlg.querySelector("button[data-action=ok]") ?? dlg.querySelector("button[data-action=later]"))?.click();
			await sleep(500);
			end2 = Date.now() + ms;
		}
	};
	let end2 = 0;

	const originPack = game.packs.filter((p) => p.metadata.packageName === SYS && p.metadata.name === "origins")[0];
	const powerPack = game.packs.get(`${SYS}.originPowers`);
	const origins = (await originPack.getDocuments()).filter((d) => d.type === "origin" && R.originPlan(d.name));
	const powerNames = (await powerPack.getIndex()).map((e) => e.name);
	const actor = await Actor.create({ name: "ZZ origens", type: "agent", system: { nivel: { value: 1 } } });
	try {
		let previous = null;
		for (const origin of origins) {
			out.origens++;
			const plan = R.originPlan(origin.name);
			const expectPower = L.findOriginPower(origin.name, origin.system.description, powerNames);
			const fixed = plan.fixed;

			// troca: a origem antiga sai e tudo o que ela deu vai junto
			if (previous) {
				const oldId = previous.id;
				await actor.deleteEmbeddedDocuments("Item", [previous.id]);
				await drain(1200);
				check(`${origin.name} antes: poder da origem antiga saiu`, !actor.items.some((i) => i.getFlag(SYS, "granted")?.source === oldId), actor.items.map((i) => i.name));
			}
			dialogs = [];
			const [created] = await actor.createEmbeddedDocuments("Item", [origin.toObject()]);
			await drain();
			// diálogos da própria origem (poderes como a Mutação abrem o deles, que não conta aqui)
			const own = dialogs.filter((d) => /Origem .* você treina|Qual é a sua Profissão/.test(d));
			const asks = plan.choose + plan.professions.filter((x) => !x).length;
			check(`${origin.name}: só pergunta o que a regra pede`, asks ? own.length > 0 : own.length === 0, dialogs);
			if (plan.choose && plan.fixed.length) check(`${origin.name}: mostra as perícias já treinadas`, own.some((d) => d.includes("Já treinadas pela origem")), own);
			check(`${origin.name}: nenhum diálogo fala em Mestre`, !dialogs.some((d) => /mestre/i.test(d)), dialogs);
			await sleep(400);
			previous = created;

			check(`${origin.name}: perícias fixas treinadas`, fixed.every((k) => deg(actor, k) !== "untrained"), fixed.map((k) => [k, deg(actor, k)]));
			if (expectPower) {
				const power = actor.items.find((i) => i.type === "ability" && L.normalizeName(i.name) === L.normalizeName(expectPower));
				check(`${origin.name}: recebeu o poder ${expectPower}`, !!power, actor.items.map((i) => i.name));
				check(`${origin.name}: poder marcado como vindo da origem`, power?.getFlag(SYS, "granted")?.source === created.id, power?.flags);
			}
			// nada de outra origem sobrou: perícias treinadas só as desta origem (a ficha não tem classe)
			const trained = Object.keys(actor.system.skills).filter((k) => deg(actor, k) !== "untrained" && !k.startsWith("freeSkill"));
			const allowed = new Set([...fixed, "freeSkill"]);
			const stray = trained.filter((k) => !allowed.has(k) && !plan.choose && !plan.gm);
			check(`${origin.name}: sem perícias de origem anterior`, stray.length === 0, stray);
			const powers = actor.items.filter((i) => i.getFlag(SYS, "granted")?.kind === "origin");
			check(`${origin.name}: só um poder de origem na ficha`, powers.length <= 1, powers.map((p) => p.name));
		}
		// por fim: apagar a origem zera tudo
		await actor.deleteEmbeddedDocuments("Item", [previous.id]);
		await drain(1500);
		check("sem origem: nenhum poder concedido", !actor.items.some((i) => i.getFlag(SYS, "granted")), actor.items.map((i) => i.name));
		const left = Object.keys(actor.system.skills).filter((k) => !k.startsWith("freeSkill") && deg(actor, k) !== "untrained");
		check("sem origem: nenhuma perícia treinada", left.length === 0, left);
	} finally {
		document.querySelectorAll(".op-skill-choice button").forEach((b) => b.click());
		await actor.delete();
	}
	return JSON.stringify({ ...out, ok: out.falhas.length === 0 });
})()
