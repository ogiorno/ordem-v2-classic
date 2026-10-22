// Combate conduzido pelo carrossel de combate (Carolingian UI): cada turno avança com um clique de mouse no botão
// de avançar do combatente ativo. No meio: ataques com arma dos agentes, Sangrando, Atordoado e uma zona de
// Miasma Entrópico (verdadeiro) que repete por 3 rodadas. Confere o efeito de cada um no turno certo.
async (page) => {
	const sleep = (ms) => page.waitForTimeout(ms);
	const out = { turnos: [], checagens: [] };
	const base = "/systems/ordem-v2-classic/module/macros/";
	await page.evaluate(() => window.__rt.cleanup());
	// preparação (na página): armas, condições e a zona
	await page.evaluate(async (base) => {
		const eng = await import(base + "ritual-area-engine.mjs");
		const rules = await import(base + "ritual-area-rules.mjs");
		const area = await import(base + "ritual-area.mjs");
		const arena = window.__arena = { threats: canvas.tokens.placeables.filter((t) => t.name.startsWith("ZZ ameaça")), agents: canvas.tokens.placeables.filter((t) => t.actor?.type === "agent") };
		// ameaças com a perícia de resistência forçada (+100 passa / -100 falha), sem RD
		for (const [i, t] of arena.threats.entries()) {
			const v = i % 2 === 0 ? -100 : 100;
			await t.actor.update({ "system.skills.resilience.value": v, "system.skills.reflexes.value": v, "system.skills.will.value": v, "system.attributes.hp.value": 5000, "system.attributes.hp.max": 5000 });
			for (const e of t.actor.effects.map((x) => x.id)) await t.actor.deleteEmbeddedDocuments("ActiveEffect", [e]).catch(() => {});
		}
		// armas
		const pack = game.packs.get("ordem-v2-classic.armaments");
		const weapons = { 0: "Revólver", 1: "Machete", 2: "Fuzil de Assalto", 3: "Revólver", 4: "Fuzil de Assalto" };
		for (const [i, t] of arena.agents.entries()) {
			if (t.actor.items.some((it) => it.type === "armament")) continue;
			const entry = pack.index.find((d) => d.name === weapons[i % 5]);
			await t.actor.createEmbeddedDocuments("Item", [(await pack.getDocument(entry._id)).toObject()]);
		}
		// condições
		await eng.applyCondition(arena.threats[0].actor, { key: "bleeding" }, { itemId: "combate" });
		await eng.applyCondition(arena.threats[1].actor, { key: "stun", rounds: 4 }, { itemId: "combate" });
		// zona: Miasma Entrópico verdadeiro sobre as ameaças 3 e 4, conjurada pelo agente da vez
		const caster = arena.agents[2].actor;
		const lib = game.actors.getName("Biblioteca de Rituais — Agente").items.getName("Miasma Entrópico");
		let item = caster.items.find((i) => i.name === "Miasma Entrópico");
		if (!item) [item] = await caster.createEmbeddedDocuments("Item", [lib.toObject()]);
		const rule = rules.areaRuleFor(item, "true");
		const data = area.areaTemplateData(null, rule);
		const spot = arena.threats[2].center;
		const region = await area.createAreaRegion({ direction: 0, ...data }, { x: spot.x, y: spot.y }, "Miasma (teste de combate)");
		const lines = await eng.resolveAreaCast({ actorId: caster.id, itemId: item.id, formId: "true", choiceId: null, cost: 10, targetIds: [], templateId: region.id, casterTokenId: arena.agents[2].id }, rule);
		window.__zoneInfo = lines;
		window.__combatLog = [];
		window.__before = Object.fromEntries(arena.threats.map((t) => [t.name, t.actor.system.attributes.hp.value]));
	}, base);
	await sleep(1500);
	const state0 = await page.evaluate(() => window.__rt.combatState());
	out.inicio = state0;

	// 3 rodadas completas pelo botão do carrossel
	const total = 11 * 3;
	for (let i = 0; i < total; i++) {
		const info = await page.evaluate(async () => {
			const combat = game.combats.find((c) => c.scene?.id === canvas.scene.id);
			const current = combat.combatant;
			const token = canvas.tokens.get(current.tokenId);
			const entry = { round: combat.round, turno: current.name, hp: token.actor.type === "threat" ? token.actor.system.attributes.hp.value : null, efeitos: token.actor.effects.map((e) => e.name) };
			// agente na sua vez: ataca a ameaça mais próxima com a arma
			if (token.actor.type === "agent") {
				const weapon = token.actor.items.find((it) => it.type === "armament");
				const targets = window.__arena.threats.filter((t) => t.actor.system.attributes.hp.value > 0).sort((a, b) => Math.hypot(a.center.x - token.center.x, a.center.y - token.center.y) - Math.hypot(b.center.x - token.center.x, b.center.y - token.center.y));
				const target = targets[0];
				game.user.targets.forEach((t) => t.setTarget(false, { releaseOthers: false }));
				target.setTarget(true, { releaseOthers: false, groupSelection: false });
				const before = target.actor.system.attributes.hp.value;
				const attack = await weapon.rollAttack();
				if (attack?.hitResult?.hit !== false) {
					const dmg = await weapon.rollDamage({ hitResult: attack?.hitResult, critical: attack?.criticalStatus ?? false });
					if (dmg) await target.actor.applyDamage(dmg.total, { damageType: weapon.system.formulas.damage.type });
				}
				entry.ataque = `${weapon.name} em ${target.name}: ${before} → ${target.actor.system.attributes.hp.value}`;
			}
			return entry;
		});
		out.turnos.push(info);
		await page.locator("button.crlngn-advance-turn").first().click({ timeout: 6000 }).catch(() => { info.semBotao = true; });
		await sleep(2600);
	}
	out.depois = await page.evaluate(() => window.__rt.threatState());
	out.antes = await page.evaluate(() => window.__before);
	out.zona = await page.evaluate(() => window.__zoneInfo);
	return out;
}
