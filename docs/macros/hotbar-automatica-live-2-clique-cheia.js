(async () => {
	const SYS = "ordem-v2-classic";
	const Q = "05TWeYY9i4umPtWv";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150); } return false; };
	const user = game.users.get(Q);
	const out = { checks: {} };
	const check = (id, ok, info) => { out.checks[id] = ok ? "OK" : `FALHOU ${JSON.stringify(info ?? "")}`; };
	const mine = () => game.macros.filter((m) => m.flags?.[SYS]?.hotbarMacro);
	const slotOf = (item) => Object.entries(user.hotbar).find(([, id]) => game.macros.get(id)?.flags?.[SYS]?.hotbarMacro?.itemId === item.id)?.[0] ?? null;
	const before = foundry.utils.deepClone(user.hotbar);
	const startTime = Date.now();
	const createdMessages = () => game.messages.filter((m) => m.timestamp >= startTime);
	let a1, a2, dummy;
	try {
		a1 = await Actor.create({ name: "ZZ HB agente A", type: "agent", system: { NEX: { value: 30 }, PD: { value: 20, max: 20 } }, ownership: { default: 0, [Q]: 3 } });
		a2 = await Actor.create({ name: "ZZ HB agente B", type: "agent", system: { NEX: { value: 30 } }, ownership: { default: 0, [Q]: 3 } });
		// HB-L05: clicar na macro da habilidade posta carta no chat
		const [ab] = await a1.createEmbeddedDocuments("Item", [{ name: "ZZ hab clique", type: "ability", system: { activation: "free", chatDescription: "teste" } }]);
		await until(() => slotOf(ab));
		const n0 = createdMessages().length;
		await game.macros.get(user.hotbar[slotOf(ab)]).execute();
		const msgOk = await until(() => createdMessages().length > n0);
		check("HB-L05", msgOk, { mensagens: createdMessages().length - n0 });
		// HB-L04: clicar na macro do ritual abre o fluxo rápido
		const [ri] = await a1.createEmbeddedDocuments("Item", [{ name: "ZZ ritual clique", type: "ritual", system: { execution: "default", circle: 1, range: "personal", target: "você" } }]);
		await until(() => slotOf(ri));
		const n1 = createdMessages().length;
		const dialogsAntes = document.querySelectorAll(".application").length;
		const run = game.macros.get(user.hotbar[slotOf(ri)]).execute();
		const sinal = await until(() => createdMessages().length > n1 || document.querySelectorAll(".application").length > dialogsAntes, 15000);
		out.ritualClique = { sinal, novasMensagens: createdMessages().length - n1, novasJanelas: document.querySelectorAll(".application").length - dialogsAntes, notificacoes: [...document.querySelectorAll("#notifications .notification")].map((e) => e.textContent.trim()) };
		check("HB-L04", sinal, out.ritualClique);
		// HB-L07c: mover item entre agentes
		const [mv] = await a1.createEmbeddedDocuments("Item", [{ name: "ZZ mover", type: "ability", system: { activation: "default" } }]);
		await until(() => slotOf(mv));
		const [mv2] = await a2.createEmbeddedDocuments("Item", [mv.toObject()]);
		await mv.delete();
		await until(() => slotOf(mv2) && !slotOf(mv));
		const info = game.macros.get(user.hotbar[slotOf(mv2)])?.flags?.[SYS]?.hotbarMacro;
		check("HB-L07c", !!slotOf(mv2) && !slotOf(mv) && info?.actorId === a2.id, { novo: slotOf(mv2), antigo: slotOf(mv), info });
		// HB-L07e: macro marcada de item inexistente é limpa
		const orf = await Macro.create({ name: "ZZ orfa", type: "script", command: "", flags: { [SYS]: { hotbarMacro: { actorId: "naoexiste", itemId: "naoexiste" } } } });
		const { cleanOrphanHotbarMacros } = await import(`/systems/${SYS}/module/helpers/hotbar-macros.mjs`);
		await cleanOrphanHotbarMacros();
		await sleep(800);
		check("HB-L07e", !game.macros.get(orf.id), "órfã continua");
		// HB-L09: barra cheia: não entra e há um único aviso
		dummy = await Macro.create({ name: "ZZ dummy", type: "chat", command: "x" });
		await user.update({ hotbar: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i + 1, dummy.id])) }, { recursive: false, diff: false });
		const t9 = Date.now();
		await a1.createEmbeddedDocuments("Item", [{ name: "ZZ cheio 1", type: "ability", system: { activation: "free" } }, { name: "ZZ cheio 2", type: "ability", system: { activation: "free" } }]);
		await sleep(2500);
		const avisos = game.messages.filter((m) => m.timestamp >= t9 && m.whisper?.includes(Q) && m.speaker?.alias === "Barra de macros");
		const naBarra = Object.values(user.hotbar).filter((id) => id !== dummy.id).length;
		check("HB-L09", avisos.length === 1 && naBarra === 0, { avisos: avisos.length, naBarra });
		await user.update({ hotbar: before }, { recursive: false, diff: false });
	} catch (e) {
		out.erro = String(e.stack ?? e);
	} finally {
		await a1?.delete(); await a2?.delete();
		await sleep(1500);
		await dummy?.delete();
		for (const m of createdMessages()) await m.delete().catch(() => {});
		for (const m of game.macros.filter((x) => x.name === "ZZ orfa")) await m.delete();
		for (const app of [...document.querySelectorAll(".application")].filter((e) => /ZZ/.test(e.textContent))) app.querySelector("[data-action=close]")?.click();
		out.sobrasMacros = mine().length;
		out.barraRestaurada = JSON.stringify(user.hotbar) === JSON.stringify(before);
		if (!out.barraRestaurada) await user.update({ hotbar: before }, { recursive: false, diff: false });
	}
	return JSON.stringify(out);
})()
