// Cicatrizes Psicológicas ao vivo (Jogando sem Sanidade): +1 dado em Vontade contra efeito de medo.
// Rodar com Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/cicatrizes-live-test.js)"
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const cfg = (a, skill, form = {}) => { const c = {}; a._buildSkillToolConfig("skill", { skill }, c, { get: (k) => form[k] ?? null }, 0); return c; };
	let actor = null;
	try {
		const pack = game.packs.get(`${SYS}.originPowers`);
		const doc = (await pack.getDocuments()).find((d) => /Cicatrizes Psicol/.test(d.name));
		actor = await Actor.create({ name: "ZZ valida Cicatrizes", type: "agent", system: { attributes: { pre: { value: 2 }, dex: { value: 2 } } } });
		out.modo = actor.usingWithoutSanityRule ? "sem Sanidade (PD)" : "com Sanidade";
		check("o mundo está no modo sem Sanidade (PD)", actor.usingWithoutSanityRule === true);
		check("sem o poder: nenhum dado extra, mesmo marcando medo", !cfg(actor, "will", { fear: true }).options?.dicePenalty);
		const [item] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
		await sleep(1500);
		check("com o poder, sem marcar medo: sem dado extra", !cfg(actor, "will").options?.dicePenalty);
		check("com o poder e medo marcado: +1 dado em Vontade (penalidade -1)", cfg(actor, "will", { fear: true }).options?.dicePenalty === -1, cfg(actor, "will", { fear: true }).options);
		check("medo marcado em outra perícia não dá dado (Fortitude)", !cfg(actor, "resilience", { fear: true }).options?.dicePenalty);
		const rolls = await actor.rollSkill({ skill: "will" }, { configure: false }, { create: false });
		check("rolagem normal de Vontade segue com os dados da Presença", rolls?.[0]?.formula.startsWith(String(actor.system.attributes.pre.value) + "d20"), rolls?.[0]?.formula);
		check("o +SAN das regras básicas não vira PD nem PV no modo sem Sanidade", (actor.system.PD.bonus ?? 0) === 0 && (actor.system.PV.bonus ?? 0) === 0);
		// o diálogo de verdade oferece a caixa só neste caso
		const abrir = async (skill) => {
			const p = actor.rollSkill({ skill }).catch(() => null);
			await sleep(1800);
			const caixa = document.querySelector("[name=fear]");
			foundry.applications.instances.forEach((app) => { if (/Roll|Skill/i.test(app.constructor.name)) app.close(); });
			await Promise.race([p, sleep(1500)]);
			return Boolean(caixa);
		};
		check("o diálogo de Vontade traz a caixa 'contra efeito de medo'", await abrir("will") === true);
		check("o diálogo de outra perícia não traz a caixa", await abrir("crime") === false);
		await actor.deleteEmbeddedDocuments("Item", [item.id]);
		await sleep(500);
		check("poder apagado: o dado extra some", !cfg(actor, "will", { fear: true }).options?.dicePenalty);
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		if (actor) await actor.delete().catch(() => {});
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
