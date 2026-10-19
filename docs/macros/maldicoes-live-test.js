// Teste ao vivo das maldições (docs/spec-modificacoes-paranormais.md). Rodar no console do navegador como Mestre.
// Cria o agente "ZZ Maldições (teste)" com uma arma, uma proteção e dois acessórios, confere cada regra e apaga tudo no fim.
// Não mexe em nenhuma outra ficha nem cena. Resultado: array de { ok, nome, detalhe }.
async () => {
	const C = await import("/systems/ordem_v2_classic/module/helpers/curses.mjs");
	const R = await import("/systems/ordem_v2_classic/module/helpers/curse-rules.mjs");
	const AO = await import("/systems/ordem_v2_classic/module/helpers/attack-options.mjs");
	const out = [];
	const check = (nome, ok, detalhe = "") => out.push({ ok: Boolean(ok), nome, detalhe: String(detalhe) });
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const pack = game.packs.get("ordem_v2_classic.curses");
	const docs = await pack.getDocuments();
	const curse = (key) => docs.find((d) => d.system.curseKey === key);
	const settle = async (actor) => { await C.syncActorCurses(actor); await wait(400); };
	const msgs = [];
	let actor;
	try {
		actor = await Actor.create({ name: "ZZ Maldições (teste)", type: "agent" });
		const made = await actor.createEmbeddedDocuments("Item", [
			{ name: "ZZ Faca", type: "armament", system: { category: 1, critical: "19/x2", formulas: { damage: { formula: "1d6", type: "cuttingDamage" }, attack: { formula: "1d20", attr: "str", skill: "fighting" } }, types: { rangeType: { name: "melee" } } } },
			{ name: "ZZ Proteção Pesada", type: "protection", system: { category: 2, defense: 5 } },
			{ name: "ZZ Amuleto", type: "generalEquipment", system: { category: 1 } },
			{ name: "ZZ Anel", type: "generalEquipment", system: { category: 0 } },
		]);
		// createEmbeddedDocuments não devolve na ordem enviada: acha cada item pelo nome
		const byName = (n) => made.find((i) => i.name === n);
		const [weapon, vest, bag, ring] = ["ZZ Faca", "ZZ Proteção Pesada", "ZZ Amuleto", "ZZ Anel"].map(byName);
		// PV/PE máximos só são calculados com uma classe na ficha
		const classes = await game.packs.get("ordem_v2_classic.classes").getDocuments();
		const klass = classes.find((c) => /combatente/i.test(c.name)) ?? classes[0];
		await actor.createEmbeddedDocuments("Item", [klass.toObject()]);
		await wait(500);
		const RES = actor.usingWithoutSanityRule ? "PD" : "PE";
		const base = { def: actor.system.defense.value, pre: actor.system.attributes.pre.value, dex: actor.system.attributes.dex.value, pv: actor.system.PV.max, pe: actor.system[RES].max };
		check("compêndio com as 36 maldições", docs.length === 36, docs.length);

		// 1. Maldição solta num item (com o item já escolhido)
		check("Carisma entra no amuleto", await C.applyCurseDocument(curse("carisma"), { actor, target: bag }));
		await settle(actor);
		const catBag = (await import("/systems/ordem_v2_classic/module/helpers/item-categories.mjs")).effectiveCategory(bag);
		check("categoria do amuleto 1 → 3 (+II)", R.curseCount(bag.system) === 1 && catBag === 3, `${R.curseCount(bag.system)} maldições, categoria ${catBag}, ${JSON.stringify(bag.system.curses)}`);
		check("Presença +1 na ficha", actor.system.attributes.pre.value === base.pre + 1, actor.system.attributes.pre.value);
		check("efeito marcado curseRule no item", bag.effects.some((e) => e.getFlag("ordem_v2_classic", "curseRule") === "carisma" && !e.disabled));

		// 2. Segunda maldição igual em outro item não acumula
		check("Carisma também no anel", await C.addCurse(ring, "carisma"));
		await settle(actor);
		check("Presença continua +1 (não acumula)", actor.system.attributes.pre.value === base.pre + 1, actor.system.attributes.pre.value);
		check("repetida no mesmo item é barrada", (await C.addCurse(bag, "carisma", { silent: true })) === false);
		await C.removeCurse(ring, "carisma");
		await settle(actor);

		// 3. Desequipar desliga
		await bag.update({ "system.using.state": false });
		await wait(800);
		await settle(actor);
		check("amuleto guardado: Presença volta", actor.system.attributes.pre.value === base.pre, actor.system.attributes.pre.value);
		await bag.update({ "system.using.state": true });
		await wait(800);
		await settle(actor);
		check("amuleto equipado de novo: Presença +1", actor.system.attributes.pre.value === base.pre + 1);

		// 4. Proteção pesada: Cinética (Defesa +2, RD 5) e Profética (RD Conhecimento 10)
		const defBefore = actor.system.defense.value;
		await C.addCurse(vest, "cinetica");
		await C.addCurse(vest, "profetica");
		await settle(actor);
		check("Cinética pesada: Defesa +2", actor.system.defense.value === defBefore + 2, `${defBefore} → ${actor.system.defense.value}`);
		check("Cinética pesada: RD geral 5", actor.system.genericRd.value === 5, actor.system.genericRd.value);
		check("Profética: RD Conhecimento 10", actor.system.resistances.knowledgeDamage.value === 10, actor.system.resistances.knowledgeDamage.value);
		const cat = (await import("/systems/ordem_v2_classic/module/helpers/item-categories.mjs")).effectiveCategory(vest);
		check("categoria da proteção 2 + II + I = 5", cat === 5, cat);

		// 5. Esforço Adicional e Vitalidade só ligam depois de um dia
		const pdBefore = actor.system[RES].max;
		const pvBefore = actor.system.PV.max;
		await C.addCurse(ring, "esforcoAdicional");
		await C.addCurse(ring, "vitalidade");
		await settle(actor);
		const since = (await ring.system.curses.find((c) => c.key === "vitalidade"))?.since;
		check("início do uso marcado", since > 0, since);
		check("PE/PD ainda sem +5 no primeiro dia", actor.system[RES].max === pdBefore, `${pdBefore} → ${actor.system[RES].max}`);
		const later = ring.system.curses.map((c) => ({ key: c.key, chosen: c.chosen, since: 1 }));
		await ring.update({ "system.curses": later.map((c) => ({ ...c, since: game.time.worldTime - R.DAY - 5 })) });
		await wait(500);
		await settle(actor);
		check("depois de um dia: PE (PD sem Sanidade) +5", actor.system[RES].max === pdBefore + 5, `${pdBefore} → ${actor.system[RES].max}`);
		check("depois de um dia: PV +15", actor.system.PV.max === pvBefore + 15, `${pvBefore} → ${actor.system.PV.max}`);

		// 6. Sagacidade não vira perícia
		await C.addCurse(bag, "sagacidade");
		await settle(actor);
		const st = await import("/systems/ordem_v2_classic/module/helpers/skill-training.mjs");
		check("Sagacidade +1 Int na ficha mas fora do orçamento", actor.system.attributes.int.value >= 1 && st.permanentInt(actor) === (actor._source.system.attributes.int.value || 0), `${actor.system.attributes.int.value} vs ${st.permanentInt(actor)}`);

		// 7. Arma: Lancinante (dado extra), Energética e Predadora
		await C.addCurse(weapon, "lancinante");
		await C.addCurse(weapon, "energetica");
		await C.addCurse(weapon, "predadora");
		await settle(actor);
		const options = AO.collectOptions(weapon);
		check("opção Energética na tela de ataque (2 PE, +5)", options.some((o) => o.onUse.cost === 2 && o.onUse.attackBonus === 5), options.map((o) => o.label).join(","));
		const pred = options.find((o) => o.onUse.critMargin);
		check("Predadora: margem de ameaça 19 → +2", pred?.onUse.critMargin === 2, pred?.onUse.critMargin);
		const before = game.messages.size;
		const sel = AO.defaultSelection(weapon);
		await weapon.rollDamage({ attackOptions: sel, critical: { isCritical: true, multiplier: 2 }, lastId: true, hitResult: { isCritical: true } });
		await wait(500);
		const created = game.messages.contents.slice(before);
		msgs.push(...created);
		const lanc = created.find((m) => m.getFlag("ordem_v2_classic", "curseDamage")?.key === "lancinante");
		check("Lancinante: carta de dano de Sangue", Boolean(lanc), created.map((m) => m.flavor).join(" | "));
		check("Lancinante multiplica no crítico (2d8)", lanc?.rolls?.[0]?.formula === "2d8", lanc?.rolls?.[0]?.formula);
		const energ = options.find((o) => o.onUse.attackBonus === 5);
		const sel2 = AO.buildConfig(weapon, options, { counts: { [energ.id]: 1 } });
		check("Energética marcada custa 2 PE", sel2.cost === 2 && sel2.attackFlat === 5, `${sel2.cost}/${sel2.attackFlat}`);
		const before2 = game.messages.size;
		await weapon.rollDamage({ attackOptions: sel2 });
		await wait(500);
		const created2 = game.messages.contents.slice(before2);
		msgs.push(...created2);
		check("Energética converte o dano em Energia", /Energia/.test(created2[0]?.flavor ?? ""), created2[0]?.flavor);

		// 8. Antielemento só rola com a opção escolhida
		await C.addCurse(weapon, "antielemento", { chosen: "death" });
		await settle(actor);
		const opt3 = AO.collectOptions(weapon);
		const without = (await (async () => { const b = game.messages.size; await weapon.rollDamage({ attackOptions: AO.defaultSelection(weapon) }); await wait(400); const c = game.messages.contents.slice(b); msgs.push(...c); return c; })());
		check("Antielemento não rola sem escolher", !without.some((m) => m.getFlag("ordem_v2_classic", "curseDamage")?.key === "antielemento"));
		const anti = opt3.find((o) => o.label === "Antielemento");
		const withIt = (await (async () => { const b = game.messages.size; await weapon.rollDamage({ attackOptions: AO.buildConfig(weapon, opt3, { counts: { [anti.id]: 1 } }) }); await wait(400); const c = game.messages.contents.slice(b); msgs.push(...c); return c; })());
		const am = withIt.find((m) => m.getFlag("ordem_v2_classic", "curseDamage")?.key === "antielemento");
		check("Antielemento escolhido rola 4d8 de Morte", am?.rolls?.[0]?.formula === "4d8" && /Morte/.test(am.flavor), am?.flavor);

		// 9. Uso: Regenerativa cura
		await vest.update({ "system.category": 2 });
		await C.addCurse(vest, "regenerativa");
		await settle(actor);
		const hpMax = actor.system.PV.max;
		await actor.update({ "system.PV.value": Math.max(1, hpMax - 20), [`system.${RES}.value`]: 5 });
		const b3 = game.messages.size;
		await C.useCurse(vest, "regenerativa");
		await wait(400);
		msgs.push(...game.messages.contents.slice(b3));
		check("Regenerativa: gasta 1 PE/PD e cura PV", actor.system[RES].value === 4 && actor.system.PV.value > Math.max(1, hpMax - 20), `${actor.system[RES].value} ${RES}, ${actor.system.PV.value}/${hpMax} PV`);

		// 10. Preço da maldição: sem Sanidade cobra PD
		const counts = C.curseCounts(actor);
		check("contagem de maldições em uso por elemento", counts.blood >= 2 && counts.knowledge >= 2, JSON.stringify(counts));
		const key = actor.usingWithoutSanityRule ? "PD" : "SAN";
		await actor.update({ [`system.${key}.value`]: 10 });
		const paid = await C.payCursePrice(actor, "blood");
		check("preço do Sangue = 2 × maldições", paid === R.curseCost(counts, "blood") && actor.system[key].value === 10 - paid, `${paid} de ${key}`);

		// 11. Ficha do item mostra a aba de maldições
		const view = C.cursesView(weapon);
		check("visão da ficha do item lista as maldições", view.list.length === 4 && view.groups.length > 0, view.list.map((c) => c.label).join(","));
		const sheet = weapon.sheet;
		await sheet.render(true);
		await wait(800);
		check("aba Maldições na ficha da arma", Boolean(sheet.element?.querySelector('[data-tab="curses"]')), "");
		await sheet.close();

		// 12. Seletor do item amaldiçoado (diálogo): escolhe o item e consome a maldição da mochila
		const [loose] = await actor.createEmbeddedDocuments("Item", [curse("pujanca").toObject()]);
		const pending = C.applyCurseDocument(loose, { actor });
		await wait(800);
		const dialog = [...document.querySelectorAll("dialog, .application")].find((el) => el.querySelector("select[name='item']"));
		check("diálogo de escolha do item aparece", Boolean(dialog));
		if (dialog) {
			const select = dialog.querySelector("select[name='item']");
			select.value = [...select.options].find((o) => /Anel/.test(o.textContent))?.value ?? select.value;
			dialog.querySelector("button[data-action='ok']")?.click();
		}
		const done = await pending;
		await wait(500);
		check("Pujança foi para o item escolhido", done && ring.system.curses.some((c) => c.key === "pujanca"), `${done} ${JSON.stringify(ring.system.curses.map((c) => c.key))}`);
		check("a maldição avulsa saiu da mochila", !actor.items.get(loose.id), "");
	} catch (error) {
		check("erro inesperado", false, error?.stack ?? error);
	} finally {
		for (const m of msgs) await m.delete().catch(() => null);
		for (const m of game.messages.filter((x) => /ZZ Maldições|ZZ Faca|ZZ Anel|ZZ Amuleto|ZZ Prote/.test(x.alias ?? "") || /ZZ Maldições/.test(x.speaker?.alias ?? ""))) await m.delete().catch(() => null);
		if (actor) await actor.delete();
	}
	return out.map((o) => (o.ok ? "OK    " : "FALHA ") + o.nome + (o.ok ? "" : " :: " + o.detalhe)).join(" // ");
}
