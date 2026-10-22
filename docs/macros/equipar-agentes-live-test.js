// Equipa uma CÓPIA de cada agente do mundo com cada poder passivo (e cada concessão de treinamento), uma por vez,
// e confere se o buff saiu certo: o que devia mudar mudou na quantidade certa, nada mais mudou e, ao apagar o poder, tudo voltou.
// Rodar com Mestre logado: playwright-cli -s=<nome> eval "window.__eq = { from: 0, to: 3 }" e depois --raw eval "$(cat docs/macros/equipar-agentes-live-test.js)"
// As fichas reais não são tocadas: tudo acontece em cópias "ZZ eq …", apagadas no fim (e as macros que elas criarem).
(async () => {
	const SYS = "ordem-v2-classic";
	const range = window.__eq ?? { from: 0, to: 99 };
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(80); } return null; };
	const P = await import(`/systems/${SYS}/module/helpers/passive-effects-rules.mjs`);
	const S = await import(`/systems/${SYS}/module/helpers/skill-training-rules.mjs`);
	const T = await import(`/systems/${SYS}/module/helpers/skill-training.mjs`);
	const out = { falhas: [], total: 0, agentes: {}, avisos: [] };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	const drain = async (quietMax = 6) => { let quiet = 0; while (quiet < quietMax) { const d = document.querySelector(".op-skill-choice"); const q = document.querySelector(".op-passive-choice"); if (d) { d.querySelector("button[data-action=later]")?.click(); quiet = 0; await sleep(600); } else if (q) { q.querySelector("button[data-action=cancel],button.header-control")?.click(); quiet = 0; await sleep(600); } else { quiet++; await sleep(200); } } };
	const noOverlay = () => document.querySelectorAll(".op-levelup-overlay").forEach((e) => e.remove());
	const lookup = (data, dotted) => dotted.split(".").reduce((o, k) => o?.[k], data);
	const evaluate = (value, data) => (typeof value === "number" ? value : Function(`"use strict"; return (${String(value).replace(/@([\w.]+)/g, (_m, p) => String(lookup(data, p) ?? 0)).replace(/\bfloor\(/g, "Math.floor(")});`)());

	const macrosBefore = new Set(game.macros.map((m) => m.id));
	const clones = [];

	/** Tudo o que a ficha mostra e que um poder pode mexer. */
	const snap = (a) => {
		const s = a.system;
		const pd = a.usingWithoutSanityRule;
		const res = pd ? s.PD : s.PE;
		const skills = Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, (v.degree?.value ?? 0) + (v.value ?? 0) + (v.mod ?? 0)]));
		return {
			PV: s.PV.max, res: res.max, per: res.perRound, def: s.defense.value, dodge: s.defense.dodge, desloc: s.desloc.value, spaces: s.spaces.max,
			rd: s.genericRd?.value ?? 0, ...Object.fromEntries(["str", "dex", "vit", "int", "pre"].map((k) => [`attr_${k}`, s.attributes[k].value])),
			...Object.fromEntries(Object.entries(skills).map(([k, v]) => [`sk_${k}`, v])),
		};
	};
	const diff = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, b[k] - a[k]]).filter(([, v]) => v !== 0));
	const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());

	/** O que as mudanças do poder devem somar em cada indicador, calculado com a ficha ANTES do poder. */
	const expectedFor = (rule, a, base) => {
		const data = { ...a.system, treino: P.trainingMap(a.system.skills) };
		const exp = {};
		const add = (k, v) => { exp[k] = (exp[k] ?? 0) + v; };
		for (const c of rule.changes) {
			const v = evaluate(c.value, data);
			if (c.key === "system.PV.bonus") add("PV", v);
			else if (c.key === "system.PE.bonus") add("res", v);
			else if (c.key === "system.PE.perRoundBonus") add("per", v);
			else if (c.key === "system.defense.value") { add("def", v); add("dodge", v); }
			else if (c.key === "system.desloc.value") add("desloc", v);
			else if (c.key === "system.spaces.bonus.max") add("spaces", v);
			else if (c.key === "system.genericRd.value") add("rd", v);
			else if (c.key.startsWith("system.attributes.")) add(`attr_${c.key.split(".")[2]}`, v);
			else if (c.key.startsWith("system.skills.")) { const k = c.key.split(".")[2]; add(`sk_${k}`, v); if (k === "reflexes") add("dodge", v); }
			else out.avisos.push(`chave sem indicador: ${c.key}`);
		}
		return Object.fromEntries(Object.entries(exp).filter(([, v]) => v !== 0));
	};

	try {
		const docs = {};
		for (const pack of game.packs.filter((p) => p.metadata.packageName === SYS && p.documentName === "Item")) for (const d of await pack.getDocuments()) if (d.type === "ability") (docs[P.passiveKey(d.name)] ??= []).push(d);
		const agents = game.actors.filter((a) => a.type === "agent" && a.itemTypes.class.length && !/^Biblioteca/.test(a.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(range.from, range.to);
		out.agentes.lista = agents.map((a) => a.name);

		for (const real of agents) {
			const data = real.toObject();
			delete data._id;
			data.name = `ZZ eq ${real.name}`;
			data.flags = {};
			data.items = data.items.map((i) => { const c = foundry.utils.deepClone(i); delete c._id; c.flags = {}; return c; });
			const a = await Actor.create(data);
			clones.push(a);
			await sleep(1200); await drain(); noOverlay();
			const nivel = a.system.nivel.value;
			const resume = { nivel, classe: a.itemTypes.class[0]?.name, poderes: 0, grants: 0, pulados: [] };
			const own = new Set(a.items.map((i) => P.passiveKey(i.name)));

			// ---- habilidades que a ficha já tinha: o efeito do sistema está lá e ligado? ----
			for (const item of a.itemTypes.ability) {
				const rule = P.passiveRuleFor(item.name);
				if (rule && item.system.activation === "passive") {
					const ok = item.effects.some((e) => e.system.changes.some((c) => rule.changes.some((r) => r.key === c.key)) && !e.disabled && e.transfer);
					check(`${a.name}: poder que já tinha (${item.name}) está com o efeito ligado`, ok, item.effects.map((e) => e.name));
				}
			}
			const baseAll = snap(a);

			// ---- cada poder com efeito de ficha ----
			for (const [key, rule] of Object.entries(P.PASSIVE_RULES)) {
				if (range.only && !range.only.includes(key)) continue;
				if (own.has(key)) { resume.pulados.push(key); continue; }
				const doc = (docs[key] ?? []).find((d) => d.system.activation === "passive") ?? docs[key]?.[0];
				if (!doc) { check(`${key}: existe no compêndio`, false); continue; }
				const before = snap(a);
				const expected = expectedFor(rule, a, before);
				if (rule.choice) {
					// Aumento de Atributo: escolhe Intelecto no diálogo
					const [item] = await a.createEmbeddedDocuments("Item", [doc.toObject()]);
					const dlg = await until(() => document.querySelector(".op-passive-choice select[name=choice]"), 5000);
					if (dlg) { dlg.value = "int"; document.querySelector(".op-passive-choice button[data-action=ok]").click(); }
					await sleep(1200);
					const intNow = before.attr_int;
					const want = intNow >= 3 ? 0 : 1;
					const d = diff(before, snap(a));
					check(`${a.name} + ${doc.name}: Intelecto ${intNow} → ${intNow + want}`, (d.attr_int ?? 0) === want && Object.keys(d).every((k) => k === "attr_int"), d);
					await a.deleteEmbeddedDocuments("Item", [item.id]);
					await sleep(500);
					check(`${a.name} − ${doc.name}: tudo volta`, same(before, snap(a)));
					resume.poderes++;
					continue;
				}
				const [item] = await a.createEmbeddedDocuments("Item", [doc.toObject()]);
				await until(() => { const it = a.items.get(item.id); return it && (it.effects.size > 0 || !rule.changes.length); });
				await sleep(350); await drain(2); noOverlay();
				// poderes com concessão de treinamento: o treino não faz parte desta conta (testado abaixo)
				const after = snap(a);
				const d = diff(before, after);
				const trainTouched = Object.keys(d).filter((k) => k.startsWith("sk_") && !(k in expected));
				for (const k of trainTouched) delete d[k];
				const fx = a.items.get(item.id)?.effects.map((e) => `${e.name}:${e.disabled ? "off" : "on"}`);
				check(`${a.name} (NEX ${nivel * 5}) + ${doc.name}: o buff é exatamente o esperado`, same(d, expected), { esperado: expected, obtido: d, efeitos: fx, itens: a.items.filter((i) => i.name === doc.name).length });
				await a.deleteEmbeddedDocuments("Item", [item.id]);
				await sleep(450); await drain(2); noOverlay();
				const back = snap(a);
				check(`${a.name} − ${doc.name}: tudo volta ao que era`, same(Object.fromEntries(Object.entries(before).filter(([k]) => !k.startsWith("sk_") || k in expected)), Object.fromEntries(Object.entries(back).filter(([k]) => !k.startsWith("sk_") || k in expected))), diff(before, back));
				resume.poderes++;
			}

			// ---- cada concessão de treinamento com perícia fixa ----
			for (const [key, g] of Object.entries(S.TRAINING_GRANTS)) {
				if (range.only) continue;
				if (g.mode !== "grantOrPlus" || !g.skill || own.has(key)) continue;
				const doc = (docs[key] ?? [])[0];
				if (!doc) { check(`${key}: existe no compêndio`, false); continue; }
				const before = snap(a);
				const idx = S.degreeIndex(a.system.skills[g.skill].degree.label);
				const [item] = await a.createEmbeddedDocuments("Item", [doc.toObject()]);
				await sleep(1600); await drain(2); noOverlay();
				const d = diff(before, snap(a));
				// destreinada: treinamento (+5); já treinada (ou mais): +2 do poder. Nada mais pode mudar (fora o que o próprio poder já dá em ficha)
				const rule = P.passiveRuleFor(doc.name);
				const own2 = rule ? expectedFor(rule, a, before) : {};
				const want = { ...own2 };
				want[`sk_${g.skill}`] = (want[`sk_${g.skill}`] ?? 0) + (idx === 0 ? 5 : g.bonus ?? 2);
				// a Esquiva soma o teste de Reflexos
				if (g.skill === "reflexes") want.dodge = (want.dodge ?? 0) + (idx === 0 ? 5 : g.bonus ?? 2);
				const keysWanted = Object.fromEntries(Object.entries(want).filter(([, v]) => v !== 0));
				check(`${a.name} + ${doc.name} (${P.SKILL_NAMES[g.skill]} ${["destreinada", "treinada", "veterana", "expert"][idx]}): ${idx === 0 ? "treina (+5)" : `+${g.bonus ?? 2}`}`, same(d, keysWanted), { esperado: keysWanted, obtido: d });
				check(`${a.name} + ${doc.name}: grau da ficha ${idx === 0 ? "vira treinada" : "não muda"}`, S.degreeIndex(a.system.skills[g.skill].degree.label) === (idx === 0 ? 1 : idx));
				await a.deleteEmbeddedDocuments("Item", [item.id]);
				await sleep(700); await drain(2); noOverlay();
				const back = snap(a);
				check(`${a.name} − ${doc.name}: tudo volta (grau e total)`, same(before, back) && S.degreeIndex(a.system.skills[g.skill].degree.label) === idx, diff(before, back));
				resume.grants++;
			}
			check(`${a.name}: ao fim a ficha está igual ao começo`, same(baseAll, snap(a)), diff(baseAll, snap(a)));
			out.agentes[real.name] = resume;
		}
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		await drain(3);
		noOverlay();
		for (const a of clones) await a.delete().catch(() => {});
		await sleep(600);
		for (const m of game.macros.filter((m) => !macrosBefore.has(m.id))) await m.delete().catch(() => {});
		out.macrosDepois = game.macros.size;
		out.macrosAntes = macrosBefore.size;
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
