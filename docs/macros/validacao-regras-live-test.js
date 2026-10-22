// Valida ao vivo, com números do livro, o que os efeitos fazem na ficha e na rolagem (não só que existem).
// Rodar com Mestre logado: playwright-cli -s=<nome> --raw eval "$(cat docs/macros/validacao-regras-live-test.js)"
// Usa agentes temporários "ZZ valida ..." e apaga tudo no fim. As regras vêm de regras/ (ver tests/unit/validacao-regras.test.mjs).
(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } return null; };
	const T = await import(`/systems/${SYS}/module/helpers/skill-training.mjs`);
	const R = await import(`/systems/${SYS}/module/helpers/skill-training-rules.mjs`);
	const out = { falhas: [], total: 0 };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const actors = [];
	const drain = async () => { let quiet = 0; while (quiet < 5) { const d = document.querySelector(".op-skill-choice"); if (d) { d.querySelector("button[data-action=later]").click(); quiet = 0; await sleep(700); } else { quiet++; await sleep(250); } } };
	const cfg = (a, skill) => { const c = {}; a._buildSkillToolConfig("skill", { skill }, c, { get: () => null }, 0); return c; };
	/** O que a rolagem leva: `prof` (grau) e `mod` (bônus) vão como @prof e @mod, com o valor em `data`. */
	const rollOf = (a, skill) => { const c = cfg(a, skill); return { parts: c.parts.map(String), prof: c.data?.prof ?? 0, mod: c.data?.mod ?? 0 }; };
	const total = (a, k) => { const s = a.system.skills[k]; return s.degree.value + (s.value ?? 0) + (s.mod ?? 0); };

	try {
		const docs = {};
		for (const pack of game.packs.filter((p) => p.metadata.packageName === SYS && p.documentName === "Item")) for (const d of await pack.getDocuments()) (docs[R.trainingKey(d.name)] ??= []).push(d);
		const get = (name) => (docs[R.trainingKey(name)] ?? [])[0];
		const mk = async (name, attrs = {}) => { const a = await Actor.create({ name: `ZZ valida ${name}`, type: "agent", system: { attributes: { str: { value: 1 }, dex: { value: 2 }, vit: { value: 2 }, int: { value: 1 }, pre: { value: 2 }, ...attrs } } }); actors.push(a); return a; };
		const cls = async (a, name) => { await a.createEmbeddedDocuments("Item", [get(name).toObject()]); await drain(); await sleep(500); };
		const withPower = async (a, name, fn) => {
			const [item] = await a.createEmbeddedDocuments("Item", [get(name).toObject()]);
			await sleep(1500); await drain();
			const r = await fn(item);
			await a.deleteEmbeddedDocuments("Item", [item.id]);
			await sleep(700);
			return r;
		};
		const nivel = async (a, n) => { await a.update({ "system.nivel.value": n }); await sleep(450); document.querySelectorAll(".op-levelup-overlay").forEach((e) => e.remove()); };

		// ---- Reflexos Defensivos: +2 em Defesa e nos três testes de resistência (Fortitude, Reflexos, Vontade) ----
		const a = await mk("Combatente");
		await cls(a, "Combatente");
		const base = { def: a.system.defense.value, dodge: a.system.defense.dodge, res: total(a, "resilience"), ref: total(a, "reflexes"), will: total(a, "will"), fight: total(a, "fighting") };
		await withPower(a, "Reflexos Defensivos", () => {
			check("Reflexos Defensivos: Defesa +2", a.system.defense.value === base.def + 2, [base.def, a.system.defense.value]);
			check("Reflexos Defensivos: Fortitude, Reflexos e Vontade +2 no total da ficha", total(a, "resilience") === base.res + 2 && total(a, "reflexes") === base.ref + 2 && total(a, "will") === base.will + 2);
			check("Reflexos Defensivos: o +2 entra na rolagem de cada resistência", ["resilience", "reflexes", "will"].every((k) => rollOf(a, k).mod === 2 && rollOf(a, k).parts.includes("@mod")), ["resilience", "reflexes", "will"].map((k) => rollOf(a, k)));
			check("Reflexos Defensivos: outras perícias não mudam (Luta)", total(a, "fighting") === base.fight);
			check("Reflexos Defensivos: a Esquiva sobe junto (Defesa +2 e Reflexos +2)", a.system.defense.dodge === base.dodge + 4, [base.dodge, a.system.defense.dodge]);
		});
		check("Reflexos Defensivos apagado: Defesa e testes voltam", a.system.defense.value === base.def && total(a, "reflexes") === base.ref && a.system.defense.dodge === base.dodge);
		await withPower(a, "Patrulha", () => check("Patrulha: Defesa +2 (e Esquiva +2)", a.system.defense.value === base.def + 2 && a.system.defense.dodge === base.dodge + 2));

		// ---- Treinamento ou +2 na rolagem: destreinada → +5 do grau; já treinada → +5 do grau e +2 do poder ----
		const t = await mk("Treino");
		await cls(t, "Combatente");
		await withPower(t, "Sorrateiro", () => {
			check("Sorrateiro (destreinada): vira treinada, rolagem leva só o +5 do grau", t.system.skills.stealth.degree.label === "trained" && rollOf(t, "stealth").prof === 5 && !rollOf(t, "stealth").mod, rollOf(t, "stealth"));
			check("Sorrateiro (destreinada): total da perícia +5", total(t, "stealth") === 5, total(t, "stealth"));
		});
		await t.update({ "system.skills.stealth.degree.label": "trained" });
		await sleep(400);
		await withPower(t, "Sorrateiro", () => {
			check("Sorrateiro (já treinada): rolagem leva o +5 do grau e o +2 do poder", rollOf(t, "stealth").prof === 5 && rollOf(t, "stealth").mod === 2, rollOf(t, "stealth"));
			check("Sorrateiro (já treinada): total +7", total(t, "stealth") === 7, total(t, "stealth"));
		});
		check("Sorrateiro apagado (perícia treinada à mão): fica +5", total(t, "stealth") === 5);

		// ---- Inventário Otimizado: Força 1 + Intelecto 3 = 20 espaços (exemplo do livro) ----
		const i = await mk("Inventario", { str: { value: 1 }, int: { value: 3 } });
		const spaces0 = i.system.spaces.max;
		await withPower(i, "NEX 10% - Inventário Otimizado", () => check("Inventário Otimizado: Força 1 e Intelecto 3 → 20 espaços", i.system.spaces.max === 20, [spaces0, i.system.spaces.max]));
		check("Inventário Otimizado apagado: volta aos 5 da Força 1", i.system.spaces.max === spaces0 && spaces0 === 5, i.system.spaces.max);
		await i.update({ "system.attributes.str.value": 0 });
		await sleep(300);
		await withPower(i, "NEX 10% - Inventário Otimizado", () => check("Inventário Otimizado: Força 0 e Intelecto 3 → 15 espaços (5 × 3)", i.system.spaces.max === 15, i.system.spaces.max));
		await withPower(i, "Inventário Organizado", () => check("Inventário Organizado: soma o Intelecto (3) ao limite", i.system.spaces.max === 2 + 3, i.system.spaces.max));

		// ---- níveis: Sangue de Ferro, Potencial Aprimorado, Dedicação (exemplos do livro) ----
		const n = await mk("Nivel");
		await cls(n, "Ocultista");
		const pd = n.usingWithoutSanityRule; // com "Jogando sem Sanidade" o PD substitui o PE
		const res = pd ? "PD" : "PE";
		out.modo = pd ? "sem Sanidade (PD)" : "com Sanidade (PE)";
		const pvMax = () => n.system.PV.max, effMax = () => n.system[res].max, perRound = () => n.system[res].perRound;
		await nivel(n, 10);
		const pv10 = pvMax();
		await withPower(n, "Sangue de Ferro", async () => {
			check("Sangue de Ferro: NEX 50% dá +20 PV", pvMax() - pv10 === 20, pvMax() - pv10);
			await nivel(n, 11);
			check("Sangue de Ferro: em NEX 55% o bônus é de 22 PV (+2 por NEX)", n.system.PV.bonus === 22, n.system.PV.bonus);
			await nivel(n, 10);
		});
		await nivel(n, 6);
		const eff6 = effMax();
		await withPower(n, "Potencial Aprimorado", async () => {
			check(`Potencial Aprimorado: NEX 30% dá +6 no ${res} máximo (exemplo do livro)`, effMax() - eff6 === 6, [res, eff6, effMax()]);
			await nivel(n, 8);
			const semPoder8 = effMax() - n.system.PE.bonus - (n.system.PD.bonus ?? 0) * 0;
			check("Potencial Aprimorado: NEX 40% dá 8 (+1 por NEX)", n.system.PE.bonus === 8, n.system.PE.bonus);
			await nivel(n, 6);
		});
		const lim = [];
		for (const nv of [1, 2, 3, 5]) {
			await nivel(n, nv);
			const semMax = effMax(), semPer = perRound();
			await withPower(n, "Dedicação", () => lim.push({ nv, dMax: effMax() - semMax, dPer: perRound() - semPer, per: perRound() }));
		}
		check(`Dedicação: limite de ${res} por turno +1 (NEX 5% = 2, NEX 10% = 3)`, lim[0].per === 2 && lim[1].per === 3 && lim.every((x) => x.dPer === 1), lim);
		check(`Dedicação: +1 ${res} em NEX 5% e 10%, +2 em 15%, +3 em 25%`, lim[0].dMax === 1 && lim[1].dMax === 1 && lim[2].dMax === 2 && lim[3].dMax === 3, lim);
		await nivel(n, 6);
		await withPower(n, "Vontade Inabalável", () => {
			check(`Vontade Inabalável: NEX 30% dá +3 ${res} (1 a cada 10%) e +2 em Vontade`, n.system.PE.bonus === 3 && total(n, "will") - n.system.skills.will.degree.value === 2, [n.system.PE.bonus, n.system.skills.will.mod]);
		});
		await withPower(n, "Personalidade Esotérica", () => check(`Personalidade Esotérica: +3 ${res}`, n.system.PE.bonus === 3));
		check("sem poder nenhum o bônus de PE volta a zero", (n.system.PE.bonus ?? 0) === 0 && (n.system.PD.bonus ?? 0) === 0);

		// ---- Mutação e Foco em Perícia na rolagem ----
		const m = await mk("Mutacao");
		await cls(m, "Combatente");
		const [mu] = await m.createEmbeddedDocuments("Item", [get("Mutação").toObject()]);
		const dlg = await until(() => document.querySelector(".op-skill-choice"));
		if (dlg) { dlg.querySelector("select[name=slot0]").value = "athleticism"; dlg.querySelector("button[data-action=ok]").click(); }
		await sleep(1500);
		await drain();
		check("Mutação: +2 na perícia escolhida entra na rolagem", rollOf(m, "athleticism").mod === 2, rollOf(m, "athleticism"));
		check("Mutação: RD 2 reduz 2 de qualquer dano (dano 5 → 3)", (await (async () => { await m.update({ "system.PV.value": 30 }); return (await m.applyDamage(5, { damageType: "ballisticDamage" })).finalDamage; })()) === 3);
		await m.deleteEmbeddedDocuments("Item", [mu.id]);
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		await drain();
		document.querySelectorAll(".op-levelup-overlay").forEach((e) => e.remove());
		for (const a of actors) await a.delete().catch(() => {});
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
