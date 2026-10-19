// Teste ao vivo dos itens paranormais (docs/spec-itens-paranormais.md). Rodar no console do navegador como Mestre.
// Cria o agente "ZZ Itens Paranormais (teste)", usa Amarras, Escuta e Scanner, conjura rituais com cada catalisador
// e apaga tudo no fim. Não mexe em nenhuma outra ficha nem cena. Precisa da regra "Jogando sem Sanidade" ligada.
// Resultado: texto com uma linha por conferência.
async () => {
	const P = await import("/systems/ordem_v2_classic/module/helpers/paranormal-items.mjs");
	const HR = await import("/systems/ordem_v2_classic/module/helpers/hotbar-rules.mjs");
	const RC = await import("/systems/ordem_v2_classic/module/macros/ritual-caster.mjs");
	const out = [];
	const check = (nome, ok, detalhe = "") => out.push({ ok: Boolean(ok), nome, detalhe: String(detalhe) });
	const wait = (ms) => new Promise((r) => setTimeout(r, ms));
	const NAME = "ZZ Itens Paranormais (teste)";
	// clica o botão de um diálogo aberto (data-action) assim que ele aparecer
	const clickDialog = async (action, timeout = 20000) => {
		const t0 = Date.now();
		while (Date.now() - t0 < timeout) {
			const button = document.querySelector(`dialog button[data-action="${action}"], .application button[data-action="${action}"]`);
			if (button) { button.click(); return true; }
			await wait(150);
		}
		return false;
	};
	let actor;
	try {
		check("regra Jogando sem Sanidade ligada", game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity"));
		actor = await Actor.create({ name: NAME, type: "agent", system: { NEX: { value: 30 } } });
		const rituals = await game.packs.get("ordem_v2_classic.rituals").getDocuments();
		const ritual = (name) => rituals.find((r) => r.name === name);
		const given = await actor.createEmbeddedDocuments("Item", [
			{ name: "Amarras de Sangue", type: "generalEquipment", system: { category: 2, quantity: 2 } },
			{ name: "Escuta de Ruídos Paranormais", type: "generalEquipment", system: { category: 2, quantity: 1 } },
			{ name: "Scanner de Manifestação Paranormal de (elemento)", type: "generalEquipment", system: { category: 2, quantity: 1 } },
			{ name: "Potencializador de Sangue", type: "generalEquipment", system: { category: 1, quantity: 1 } },
			{ name: "Perturbador de Sangue", type: "generalEquipment", system: { category: 1, quantity: 1 } },
			{ name: "Ampliador de Sangue", type: "generalEquipment", system: { category: 1, quantity: 1 } },
			{ name: "Prolongador de Sangue", type: "generalEquipment", system: { category: 1, quantity: 1 } },
			{ name: "Ampliador de Morte", type: "generalEquipment", system: { category: 1, quantity: 1 } },
			ritual("Esfolar").toObject(), ritual("Corpo Adaptado").toObject(),
		]);
		const by = (n) => given.find((i) => i.name === n);
		const amarras = by("Amarras de Sangue");
		const pd = () => actor.system.PD.value;

		// 1. Barra de macros e ficha
		check("Amarras entram na barra de macros", HR.hotbarKind(amarras) === "paranormal" && HR.belongsOnHotbar(amarras), HR.hotbarKind(amarras));
		check("Componente comum não entra na barra", HR.hotbarKind({ type: "generalEquipment", name: "Componente de Sangue", parent: { type: "agent" } }) === null);
		const sheet = amarras.sheet;
		await sheet.render(true);
		await wait(900);
		check("aba Uso na ficha das Amarras, com Armadilha e Laçar", Boolean(sheet.element?.querySelector('[data-tab="paranormal"] [data-use="trap"]')) && Boolean(sheet.element?.querySelector('[data-use="lasso"]')));
		await sheet.close();

		// 2. Amarras: Laçar (1 PE) e Armadilha (2 PE, consome)
		await actor.update({ "system.PD.value": 30 });
		let before = pd();
		await P.useParanormalItem(amarras, "lasso");
		check("Laçar gasta 1 PD e não consome as amarras", before - pd() === 1 && amarras.system.quantity === 2, `${before}→${pd()} qtd ${amarras.system.quantity}`);
		before = pd();
		await P.useParanormalItem(amarras, "trap");
		check("Armadilha gasta 2 PD e consome 1 unidade", before - pd() === 2 && actor.items.get(amarras.id)?.system.quantity === 1, `${before}→${pd()} qtd ${actor.items.get(amarras.id)?.system.quantity}`);
		const card = game.messages.contents.reverse().find((m) => m.flags?.ordem_v2_classic?.paranormalItemUse?.use === "trap" && m.speaker?.actor === actor.id);
		check("cartão da Armadilha traz Reflexos e a DT", /Reflexos/.test(card?.content ?? "") && /DT \d+/.test(card?.content ?? ""), card?.content?.slice(0, 160));

		// 3. Escuta: +5 em Ocultismo como efeito na ficha
		const escuta = by("Escuta de Ruídos Paranormais");
		before = pd();
		await P.useParanormalItem(escuta, "record");
		await wait(400);
		const bonus = actor.effects.find((e) => e.getFlag("ordem_v2_classic", "paranormalItemBonus"));
		check("Escuta gasta 2 PD e dá +5 em Ocultismo", before - pd() === 2 && Boolean(bonus) && bonus.system.changes[0].value === 5, `${before}→${pd()}`);

		// 4. Scanner pergunta o elemento e cobra 1 PD
		const scanner = by("Scanner de Manifestação Paranormal de (elemento)");
		before = pd();
		const scanning = P.useParanormalItem(scanner, "scan");
		await wait(700);
		const select = document.querySelector('.application select[name="element"]');
		if (select) { select.value = "death"; await clickDialog("ok"); }
		await scanning;
		check("Scanner pede o elemento e gasta 1 PD", Boolean(select) && before - pd() === 1, `${before}→${pd()}`);

		// 5. Catalisadores no conjurador
		const castBase = (item, extra = {}) => ({
			itemId: item.id, formId: "basic", circle: Number(item.system.circle), cost: 1, effect: RC.buildRitualSelection(item).effect,
			preparationConfirmed: true, markedConfirmed: true, targetIds: [], concentration: "none", damageDt: null, configureRoll: false, ...extra,
		});
		const esfolar = by("Esfolar");
		const corpo = by("Corpo Adaptado");
		const castOf = (item) => game.messages.contents.reverse().find((m) => m.flags?.ordem_v2_classic?.ritualCast?.itemId === item.id && m.speaker?.actor === actor.id)?.flags?.ordem_v2_classic?.ritualCast;
		const clearCasts = async () => { for (const m of game.messages.filter((x) => x.speaker?.actor === actor.id)) await m.delete().catch(() => null); };
		const opts = RC.buildRitualSelection;
		check("conjurador oferece só catalisadores do elemento", P.catalystOptions(actor, "blood").length === 4 && P.catalystOptions(actor, "death").length === 1, P.catalystOptions(actor, "blood").map((c) => c.label).join(", "));

		// 5a. catalisador de outro elemento é recusado sem gastar nada
		await actor.update({ "system.PD.value": 30 });
		before = pd();
		await RC.resolveCast(actor, castBase(esfolar, { catalystId: by("Ampliador de Morte").id }));
		check("catalisador de Morte num ritual de Sangue: nada gasto", pd() === before && actor.items.get(by("Ampliador de Morte").id)?.system.quantity === 1, `${before}→${pd()}`);

		// 5b. Potencializador: +1 dado e o item é consumido
		await RC.resolveCast(actor, castBase(esfolar, { catalystId: by("Potencializador de Sangue").id }));
		await wait(800);
		let cast = castOf(esfolar);
		check("Potencializador: 3d4+3 vira 4d4+3", cast && /^4d4\+3$/.test(cast.effect?.formula ?? "") || cast?.extraDie === true, JSON.stringify(cast?.effect));
		check("Potencializador consumido", !actor.items.get(by("Potencializador de Sangue").id), "");
		check("cartão mostra o catalisador", /Potencializador de Sangue/.test(cast?.catalystNote ?? ""), cast?.catalystNote);
		await clearCasts();

		// 5c. Perturbador: DT +2
		await RC.resolveCast(actor, castBase(esfolar, { catalystId: by("Perturbador de Sangue").id }));
		await wait(800);
		cast = castOf(esfolar);
		check("Perturbador: DT +2 guardado na conjuração", cast?.dtBonus === 2, cast?.dtBonus);
		check("Perturbador consumido", !actor.items.get(by("Perturbador de Sangue").id), "");
		await clearCasts();

		// 5d. Prolongador em ritual instantâneo: confirma "conjurar sem gastar"; nada é consumido
		const prolong = RC.resolveCast(actor, castBase(esfolar, { catalystId: by("Prolongador de Sangue").id }));
		const asked = await clickDialog("yes");
		await prolong;
		await wait(800);
		cast = castOf(esfolar);
		check("Prolongador em instantâneo pergunta e não é consumido", asked && actor.items.get(by("Prolongador de Sangue").id)?.system.quantity === 1 && /sem efeito/.test(cast?.catalystNote ?? ""), cast?.catalystNote);
		await clearCasts();

		// 5e. Ampliador (alcance +1 passo) em ritual de toque; Prolongador em ritual de cena é aceito
		const amp = RC.resolveCast(actor, castBase(corpo, { catalystId: by("Ampliador de Sangue").id }));
		const chose = await clickDialog("range");
		await amp;
		await wait(800);
		cast = castOf(corpo);
		check("Ampliador: alcance subiu e o item foi consumido", chose && /Alcance/.test(cast?.catalystNote ?? "") && !actor.items.get(by("Ampliador de Sangue").id), cast?.catalystNote);
		await clearCasts();
		await RC.resolveCast(actor, castBase(corpo, { catalystId: by("Prolongador de Sangue").id }));
		await wait(800);
		cast = castOf(corpo);
		check("Prolongador em ritual de cena: duração ×2 e consumido", /Duração/.test(cast?.catalystNote ?? "") && !actor.items.get(by("Prolongador de Sangue").id), cast?.catalystNote);
		await clearCasts();
	} catch (error) {
		check("erro inesperado", false, error?.stack ?? error);
	} finally {
		for (const m of game.messages.filter((x) => x.speaker?.alias === NAME || x.speaker?.actor === actor?.id)) await m.delete().catch(() => null);
		if (actor) await actor.delete();
	}
	return out.map((o) => (o.ok ? "OK    " : "FALHA ") + o.nome + (o.ok ? "" : " :: " + o.detalhe)).join(" // ");
}
