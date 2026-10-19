(async () => {
	const SYS = "ordem_v2_classic";
	const Q = "05TWeYY9i4umPtWv"; // QA1: jogador de teste (não precisa estar conectado)
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150); } return false; };
	const user = game.users.get(Q);
	const out = { checks: {} };
	const check = (id, ok, info) => { out.checks[id] = ok ? "OK" : `FALHOU ${JSON.stringify(info ?? "")}`; };
	const hb = () => foundry.utils.deepClone(user.hotbar);
	const mine = () => game.macros.filter((m) => m.flags?.[SYS]?.hotbarMacro);
	const slotOf = (item) => Object.entries(user.hotbar).find(([, id]) => game.macros.get(id)?.flags?.[SYS]?.hotbarMacro?.itemId === item.id)?.[0] ?? null;
	const before = hb();
	let actor;
	try {
		const wpack = await game.packs.get(`${SYS}.armaments`).getDocuments();
		const weapon = wpack.find((x) => x.type === "armament");
		actor = await Actor.create({ name: "ZZ HB agente", type: "agent", system: { NEX: { value: 30 } }, ownership: { default: 0, [Q]: 3 } });
		check("HB-pre", game.users.activeGM?.isSelf, { gm: game.users.activeGM?.name });
		// HB-L01 e L02: arma, ritual e habilidade ativa entram; passiva não
		const [w] = await actor.createEmbeddedDocuments("Item", [weapon.toObject()]);
		await until(() => slotOf(w));
		const [r] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ ritual", type: "ritual", system: { execution: "default", circle: 1 } }]);
		await until(() => slotOf(r));
		const [a] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ hab ativa", type: "ability", system: { activation: "free", cost: 0 } }]);
		await until(() => slotOf(a));
		check("HB-L01", slotOf(w) === "1" && slotOf(r) === "2" && slotOf(a) === "3", { w: slotOf(w), r: slotOf(r), a: slotOf(a) });
		const [p] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ hab passiva", type: "ability", system: { activation: "passive" } }]);
		const [v] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ hab vazia", type: "ability", system: { activation: "" } }]);
		const [g] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ equipamento", type: "generalEquipment" }]);
		await sleep(1800);
		check("HB-L02", slotOf(p) === null && slotOf(v) === null && slotOf(g) === null && Object.keys(hb()).length === 3, { barra: hb() });
		// comando por id (HB-24)
		const mA = game.macros.get(user.hotbar[3]);
		check("HB-24", mA.command === `ordemparanormal.documents.macro.rollItemById('${actor.id}', '${a.id}')`, mA.command);
		// HB-L03: passiva -> ativa cria; ativa -> passiva remove
		await p.update({ "system.activation": "default" });
		await until(() => slotOf(p));
		const criou = slotOf(p);
		await p.update({ "system.activation": "passive" });
		await until(() => !slotOf(p));
		check("HB-L03", criou === "4" && slotOf(p) === null && hb()[4] === undefined, { criou, depois: slotOf(p), barra: hb() });
		// ativa -> ativa não mexe
		const s3 = slotOf(a);
		await a.update({ "system.activation": "reaction" });
		await sleep(1200);
		check("HB-L03b", slotOf(a) === s3, { antes: s3, depois: slotOf(a) });
		// HB-L06: renomear
		await r.update({ name: "ZZ ritual renomeado" });
		await until(() => game.macros.get(user.hotbar[2])?.name === "ZZ ritual renomeado");
		check("HB-L06", game.macros.get(user.hotbar[2])?.name === "ZZ ritual renomeado", game.macros.get(user.hotbar[2])?.name);
		// HB-L12: remove a arma, o 1 fica vazio, arma nova volta para o 1, os outros não andam
		await w.delete();
		await until(() => user.hotbar[1] === undefined);
		const vazio = user.hotbar[1] === undefined && !!user.hotbar[2] && !!user.hotbar[3];
		const [w2] = await actor.createEmbeddedDocuments("Item", [weapon.toObject()]);
		await until(() => slotOf(w2));
		check("HB-L12", vazio && slotOf(w2) === "1" && slotOf(r) === "2" && slotOf(a) === "3", { vazio, w2: slotOf(w2), r: slotOf(r), a: slotOf(a) });
		// HB-L07a: apagar ritual e habilidade libera os espaços
		await r.delete(); await a.delete();
		await until(() => !user.hotbar[2] && !user.hotbar[3]);
		check("HB-L07a", !user.hotbar[2] && !user.hotbar[3] && mine().filter((m) => m.flags[SYS].hotbarMacro.itemId === r.id || m.flags[SYS].hotbarMacro.itemId === a.id).length === 0, { barra: hb() });
		// HB-L08: jogador tira a macro da barra, edita o item: não volta
		const [a2] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ hab 2", type: "ability", system: { activation: "free" } }]);
		await until(() => slotOf(a2));
		const s = slotOf(a2);
		await user.update({ [`hotbar.-=${s}`]: null });
		await a2.update({ "system.activation": "movement" });
		await sleep(1500);
		check("HB-L08", slotOf(a2) === null, { barra: hb() });
		// HB-L11: configuração desligada
		await game.settings.set(SYS, "hotbarAuto", false);
		const [a3] = await actor.createEmbeddedDocuments("Item", [{ name: "ZZ hab 3", type: "ability", system: { activation: "free" } }]);
		await sleep(1800);
		const semAuto = slotOf(a3) === null;
		await game.settings.set(SYS, "hotbarAuto", true);
		check("HB-L11", semAuto, { barra: hb() });
		// HB-L10: Preencher barra completa sem duplicar
		const { fillHotbar } = await import(`/systems/${SYS}/module/helpers/hotbar-macros.mjs`);
		const f1 = await fillHotbar(actor);
		await sleep(500);
		const f2 = await fillHotbar(actor);
		const n = Object.values(user.hotbar).filter((id) => game.macros.get(id)?.flags?.[SYS]?.hotbarMacro?.actorId === actor.id).length;
		check("HB-L10", f1.added >= 2 && f2.added === 0 && n === actor.items.filter((i) => ["armament", "ritual", "ability"].includes(i.type) && (i.type !== "ability" || ["free", "movement", "default", "complete", "reaction"].includes(i.system.activation))).length, { f1, f2, n });
		// HB-L07: apagar o agente, nenhuma macro sobra
		await actor.delete(); actor = null;
		await until(() => Object.keys(hb()).length === Object.keys(before).length);
		check("HB-L07", JSON.stringify(hb()) === JSON.stringify(before) && mine().length === 0, { barra: hb() });
	} catch (e) {
		out.erro = String(e.stack ?? e);
	} finally {
		await actor?.delete();
		await sleep(1500);
		await game.settings.set(SYS, "hotbarAuto", true);
		out.sobrasMacros = mine().length;
		out.barraRestaurada = JSON.stringify(hb()) === JSON.stringify(before);
		if (!out.barraRestaurada) await user.update({ hotbar: before }, { recursive: false, diff: false });
	}
	return JSON.stringify(out);
})()
