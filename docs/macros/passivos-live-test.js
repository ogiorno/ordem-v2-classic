// Teste ao vivo dos poderes passivos que dão o bônus só de entrarem na ficha.
// Rodar com Mestre logado: playwright-cli -s=<nome> eval "$(cat docs/macros/passivos-live-test.js)"
// Cria o agente "ZZ passivos (teste)", entrega cada poder, confere o bônus e apaga o poder (o bônus tem de sair). Apaga o agente no fim.
(async () => {
	const SYS = "ordem_v2_classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; };
	const rules = await import(`/systems/${SYS}/module/helpers/passive-effects-rules.mjs`);
	const { PASSIVE_RULES, MANAGED_FLAG, passiveKey } = rules;
	const out = { falhas: [], total: 0, itens: {} };
	const check = (id, ok, info) => { out.total++; if (!ok) out.falhas.push(`${id} ${JSON.stringify(info ?? "")}`); };
	// campos como PV.bonus só passam a existir quando um efeito os cria: sem efeito valem 0
	const get = (a, key) => foundry.utils.getProperty(a, key) ?? 0;
	const lookup = (data, dotted) => dotted.split(".").reduce((o, k) => o?.[k], data);
	const evaluate = (value, data) => (typeof value === "number" ? value : Function(`"use strict"; return (${String(value).replace(/@([\w.]+)/g, (_m, p) => String(lookup(data, p) ?? 0)).replace(/\bfloor\(/g, "Math.floor(")});`)());
	// ficha pronta para ser lida como a regra lê: nivel, stage, atributos e o mapa de perícias treinadas
	const ctx = (a) => ({ ...a.system, treino: rules.trainingMap(a.system.skills) });
	let actor = null;
	try {
		// poderes passivos do compêndio, por nome comparável
		const docs = [];
		for (const pack of game.packs.filter((p) => p.metadata.packageName === SYS && p.documentName === "Item")) {
			for (const d of await pack.getDocuments()) if (d.type === "ability" && d.system.activation === "passive") docs.push(d);
		}
		const byKey = new Map();
		for (const d of docs) { const k = passiveKey(d.name); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(d); }
		const classes = await game.packs.get(`${SYS}.classes`).getDocuments();
		const combatente = classes.find((c) => /combatente/i.test(c.name)) ?? classes[0];

		actor = await Actor.create({
			name: "ZZ passivos (teste)", type: "agent",
			system: { class: "fighter", attributes: { str: { value: 2 }, dex: { value: 2 }, vit: { value: 2 }, int: { value: 3 }, pre: { value: 2 } } },
		});
		await actor.createEmbeddedDocuments("Item", [combatente.toObject()]);
		await actor.update({ "system.nivel.value": 6, "system.stage.value": 3 });
		await sleep(600);
		check("base-nivel", actor.system.nivel.value === 6, actor.system.nivel.value);

		// 1) cada poder com regra: bônus aparece ao entrar na ficha, some ao sair
		for (const [key, rule] of Object.entries(PASSIVE_RULES)) {
			const copias = byKey.get(key) ?? [];
			check(`${key}: existe no compêndio`, copias.length > 0);
			for (const doc of copias) {
				const antes = Object.fromEntries(rule.changes.map((c) => [c.key, get(actor, c.key)]));
				const esperado = Object.fromEntries(rule.changes.map((c) => [c.key, 0]));
				for (const c of rule.changes) esperado[c.key] += evaluate(c.value, ctx(actor)); // @valores antes do bônus, como a ficha lê
				// o que o compêndio já traz no poder soma junto se for de outra regra (não deve acontecer: mesma chave não repete)
				const [item] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
				// o efeito pode vir do compêndio (já pronto) ou ser criado pelo sistema logo depois
				await until(async () => {
					const fx = actor.items.get(item.id)?.effects;
					const wanted = rule.changes.every((c) => (fx ?? []).some((e) => e.system.changes.some((ch) => ch.key === c.key)));
					return wanted;
				});
				await sleep(250);
				// poderes de escolha abrem o diálogo: aqui só importa o bônus fixo, então cancela (a escolha tem teste próprio)
				document.querySelectorAll(".op-passive-choice,.op-skill-choice").forEach((el) => el.querySelector("[data-action=cancel],[data-action=close],[data-action=later]")?.click());
				const live = actor.items.get(item.id);
				const efeitos = live.effects.filter((e) => e.transfer && !e.disabled);
				// poder só de escolha não tem efeito até alguém escolher (teste próprio em passivos-escolha-live-test.js)
				check(`${doc.name}: tem efeito transferido e ligado`, efeitos.length > 0 || rule.changes.length === 0, live.effects.map((e) => e.name));
				const managed = live.effects.filter((e) => e.getFlag(SYS, MANAGED_FLAG));
				check(`${doc.name}: no máximo um efeito do sistema`, managed.length <= 1, managed.length);
				for (const c of rule.changes) {
					const depois = get(actor, c.key);
					check(`${doc.name}: ${c.key}`, depois - antes[c.key] === esperado[c.key], { antes: antes[c.key], depois, esperado: esperado[c.key] });
				}
				await actor.deleteEmbeddedDocuments("Item", [item.id]);
				await sleep(250);
				for (const c of rule.changes) check(`${doc.name}: ${c.key} volta ao normal ao apagar`, get(actor, c.key) === antes[c.key], { antes: antes[c.key], agora: get(actor, c.key) });
				check(`${doc.name}: nenhum efeito sobra na ficha`, actor.effects.size === 0 && actor.appliedEffects.length === 0, actor.appliedEffects.map((e) => e.name));
				out.itens[doc.name] = "ok";
			}
		}

		// 2) a fórmula acompanha o nível (o valor não pode ficar preso ao nível de quando o poder entrou)
		const calejado = byKey.get("calejado")[0];
		const [cal] = await actor.createEmbeddedDocuments("Item", [calejado.toObject()]);
		await until(() => actor.items.get(cal.id)?.effects.size > 0);
		await sleep(300);
		const pvMax6 = actor.system.PV.max, bonus6 = actor.system.PV.bonus;
		await actor.update({ "system.nivel.value": 12 });
		await sleep(400);
		check("nivel: PV.bonus acompanha o nível", actor.system.PV.bonus === 12 && bonus6 === 6, { bonus6, agora: actor.system.PV.bonus });
		const pvMax12 = actor.system.PV.max;
		check("nivel: PV.max cresce com o nível", pvMax12 > pvMax6, { pvMax6, pvMax12 });
		check("nivel: o bônus não foi gravado na ficha", actor._source.system.PV.bonus === 0 || actor._source.system.PV.bonus === undefined, actor._source.system.PV.bonus);
		await actor.deleteEmbeddedDocuments("Item", [cal.id]);
		await sleep(300);
		check("nivel: tirar o Calejado tira os 12 PV do máximo", pvMax12 - actor.system.PV.max === 12, { com: pvMax12, sem: actor.system.PV.max });
		await actor.update({ "system.nivel.value": 6 });
		await sleep(300);

		// 3) "treinamento ou +2" agora é grau real: testado em pericias-treinadas-live-test.js

		// 4) o sistema completa a ficha que já tinha o poder (cópia antiga sem o efeito) ao sincronizar
		const antigo = byKey.get("patrulha")[0].toObject();
		antigo.effects = [];
		const [old] = await actor.createEmbeddedDocuments("Item", [antigo]);
		await until(() => actor.items.get(old.id)?.effects.size > 0);
		await sleep(300);
		check("poder sem efeito ganha o efeito ao entrar na ficha", actor.items.get(old.id).effects.some((e) => e.getFlag(SYS, MANAGED_FLAG)));
		const defBase = actor.system.defense.value;
		const sync = await import(`/systems/${SYS}/module/helpers/passive-effects.mjs`);
		const feito = await sync.syncPassiveEffects(actor);
		check("sincronizar de novo não duplica nem muda", feito.length === 0 && actor.items.get(old.id).effects.size === 1 && actor.system.defense.value === defBase, { feito, n: actor.items.get(old.id).effects.size });
		// remove à mão o efeito do sistema: a sincronização devolve
		await actor.items.get(old.id).deleteEmbeddedDocuments("ActiveEffect", actor.items.get(old.id).effects.map((e) => e.id));
		await sleep(200);
		const refeito = await sync.syncPassiveEffects(actor);
		check("sincronizar recria o efeito que faltava", refeito.length === 1 && actor.items.get(old.id).effects.size === 1, refeito);
		await actor.deleteEmbeddedDocuments("Item", [old.id]);

		// 5) poder que não é passivo não ganha efeito do sistema
		const ativo = (await game.packs.get(`${SYS}.fighterPowers`).getDocuments()).find((d) => d.type === "ability" && d.system.activation !== "passive" && !d.effects.size);
		if (ativo) {
			const [ac] = await actor.createEmbeddedDocuments("Item", [ativo.toObject()]);
			await sleep(900);
			check("poder ativo não ganha efeito de passivo", !actor.items.get(ac.id).effects.some((e) => e.getFlag(SYS, MANAGED_FLAG)));
			await actor.deleteEmbeddedDocuments("Item", [ac.id]);
		}

		// 5b) Mutação: a RD 2 reduz o dano de verdade ao aplicar dano na ficha
		await actor.update({ "system.PV.value": 30 });
		const sem = await actor.applyDamage(4, { damageType: "cuttingDamage" });
		const [mu] = await actor.createEmbeddedDocuments("Item", [byKey.get("mutacao")[0].toObject()]);
		await until(() => actor.items.get(mu.id)?.effects.size > 0);
		await sleep(300);
		const com = await actor.applyDamage(4, { damageType: "cuttingDamage" });
		check("Mutação: sem o poder o dano passa inteiro", sem.finalDamage === 4, sem);
		check("Mutação: com o poder, RD 2 (dano 4 vira 2)", com.finalDamage === 2 && com.blocked === 2, com);
		await actor.deleteEmbeddedDocuments("Item", [mu.id]);
		await sleep(300);
		const depois = await actor.applyDamage(4, { damageType: "cuttingDamage" });
		check("Mutação: apagado o poder, a RD some", depois.finalDamage === 4, depois);
		await actor.update({ "system.PV.value": 30 });

		// 6) vários poderes juntos somam e cada saída tira só o seu
		const defSemNada = actor.system.defense.value;
		const nomes = ["calejado", "patrulha", "reflexos defensivos", "dedicacao"];
		const ids = [];
		for (const n of nomes) ids.push((await actor.createEmbeddedDocuments("Item", [byKey.get(n)[0].toObject()]))[0].id);
		await until(() => ids.every((id) => actor.items.get(id)?.effects.size > 0));
		await sleep(400);
		const juntos = { pv: get(actor, "system.PV.bonus"), def: actor.system.defense.value, pe: actor.system.PE.bonus, rd: actor.system.PE.perRound };
		check("vários: PV +6 (Calejado)", juntos.pv === 6, juntos);
		check("vários: PE +3 (Dedicação, NEX 30%)", juntos.pe === 3, juntos);
		await actor.deleteEmbeddedDocuments("Item", [ids[1]]);
		await sleep(300);
		check("vários: sair o Patrulha tira só +2 de Defesa", actor.system.defense.value === juntos.def - 2 && actor.system.PV.bonus === 6, { def: actor.system.defense.value });
		await actor.deleteEmbeddedDocuments("Item", ids.filter((_, i) => i !== 1));
		await sleep(300);
		check("vários: tudo apagado, sem bônus", get(actor, "system.PV.bonus") === 0 && get(actor, "system.PE.bonus") === 0 && actor.system.defense.value === defSemNada && actor.appliedEffects.length === 0, { pv: actor.system.PV.bonus, def: actor.system.defense.value, defSemNada });
	} catch (err) {
		out.falhas.push(`ERRO ${err?.stack ?? err}`);
	} finally {
		if (actor) await actor.delete();
	}
	out.resumo = `${out.total - out.falhas.length}/${out.total} verificações OK`;
	return out;
})()
