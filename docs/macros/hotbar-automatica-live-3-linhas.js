(async () => {
	const SYS = "ordem-v2-classic";
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const until = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; };
	const out = { checks: {} };
	const check = (id, ok, info) => { out.checks[id] = ok ? "OK" : `FALHOU ${JSON.stringify(info ?? "")}`; };
	const user = game.user;
	const before = foundry.utils.deepClone(user.hotbar);
	const named = (n) => game.macros.find((m) => m.name === n);
	const rows = () => document.querySelectorAll("#hotbar .op-extra-row").length;
	const setRows = async (v) => { await game.settings.set(SYS, "hotbarRows", v); await sleep(500); };
	const li = (slot) => document.querySelector(`#hotbar .slot[data-slot="${slot}"]`);
	const num = () => document.querySelector("#hotbar .op-rows-number")?.textContent;
	const btn = (dir) => document.querySelector(`#hotbar .op-rows-button.${dir > 0 ? "fa-plus" : "fa-minus"}`);
	const drag = async (fromSlot, toSlot, extra) => {
		const dt = new DataTransfer();
		const from = li(fromSlot), to = li(toSlot);
		if (from) from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
		if (extra) dt.setData("text/plain", JSON.stringify(extra));
		to.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
		to.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
		await sleep(900);
	};
	let temp;
	const t0 = Date.now();
	try {
		// estado inicial: macros ZZ m1 (1), m2 (2), m11 (11), m12 (12), m21 (21)
		check("HB-pre", [1, 2, 11, 12, 21].every((s) => user.hotbar[s]), user.hotbar);
		// L15: automático
		await setRows("auto");
		check("HB-L15a", rows() === 2 && num() === "A", { rows: rows(), num: num() });
		await user.update({ "hotbar.-=21": null }); await sleep(600);
		check("HB-L15b", rows() === 1, { rows: rows() });
		await user.update({ "hotbar.-=12": null, "hotbar.-=11": null }); await sleep(600);
		check("HB-L15c", rows() === 0, { rows: rows() });
		await user.assignHotbarMacro(named("ZZ m11"), 11); await user.assignHotbarMacro(named("ZZ m12"), 12); await user.assignHotbarMacro(named("ZZ m21"), 21); await sleep(600);
		// L17: componente −/+
		await setRows("auto");
		btn(1).click(); await sleep(600);
		const passo1 = { v: game.settings.get(SYS, "hotbarRows"), n: num(), r: rows() };
		btn(1).click(); await sleep(600);
		const passo2 = { v: game.settings.get(SYS, "hotbarRows"), n: num(), r: rows() };
		btn(1).click(); await sleep(600);
		const passo3 = { v: game.settings.get(SYS, "hotbarRows"), n: num(), r: rows(), maisDesab: btn(1).disabled };
		btn(-1).click(); await sleep(600);
		const volta = { v: game.settings.get(SYS, "hotbarRows"), n: num(), r: rows() };
		check("HB-L17", passo1.v === "1" && passo1.n === "1" && passo1.r === 0 && passo2.v === "2" && passo2.r === 1 && passo3.v === "3" && passo3.r === 2 && passo3.maisDesab && volta.v === "2" && volta.r === 1, { passo1, passo2, passo3, volta });
		// L13: 3 linhas: páginas 3 (topo) e 2 acima da atual
		await setRows("3");
		const pages = [...document.querySelectorAll("#hotbar .op-extra-row")].map((e) => e.dataset.page);
		check("HB-L13", pages.join() === "3,2" && !!li(21).querySelector("img") && !!li(11).querySelector("img"), { pages });
		// L14: clique usa a macro (chat)
		const n0 = game.messages.size;
		li(11).click();
		const clicou = await until(() => game.messages.size > n0);
		check("HB-L14a", clicou, { msgs: game.messages.size - n0 });
		// L14b: arrastar de uma linha extra para outra linha extra move a macro
		const idm12 = user.hotbar[12];
		await drag(12, 15);
		check("HB-L14b", user.hotbar[15] === idm12 && user.hotbar[12] === undefined, { barra: user.hotbar });
		// L14c: arrastar da linha extra para a linha principal (espaço 5)
		await drag(15, 5);
		check("HB-L14c", user.hotbar[5] === idm12 && user.hotbar[15] === undefined, { barra: user.hotbar });
		// L14d: arrastar da linha principal para a extra
		await drag(5, 14);
		check("HB-L14d", user.hotbar[14] === idm12 && user.hotbar[5] === undefined, { barra: user.hotbar });
		// L14e: soltar um item da ficha numa linha extra cria macro ali
		temp = await Actor.create({ name: "ZZ HB soltar", type: "agent", system: { NEX: { value: 30 } } });
		const [it] = await temp.createEmbeddedDocuments("Item", [{ name: "ZZ soltar hab", type: "ability", system: { activation: "passive" } }]);
		await sleep(600);
		await drag(null, 16, { type: "Item", uuid: it.uuid });
		const soltou = user.hotbar[16] ? game.macros.get(user.hotbar[16]) : null;
		check("HB-L14e", !!soltou && soltou.name === "ZZ soltar hab", { barra: user.hotbar[16], nome: soltou?.name });
		if (soltou) await soltou.delete();
		// L14f: barra trancada tranca também as extras
		await game.settings.set("core", "hotbarLock", true);
		const idm14 = user.hotbar[14];
		await drag(14, 17);
		check("HB-L14f", user.hotbar[14] === idm14 && user.hotbar[17] === undefined, { barra: user.hotbar });
		await game.settings.set("core", "hotbarLock", false);
		// L16: trocar de 1 para 3 e voltar não move nada; persiste
		const snap = JSON.stringify(user.hotbar);
		await setRows("1"); await setRows("3"); await setRows("1");
		check("HB-L16", JSON.stringify(user.hotbar) === snap && game.settings.get(SYS, "hotbarRows") === "1" && rows() === 0, { snap, agora: JSON.stringify(user.hotbar) });
		// L13b: página atual 4 com 3 linhas: extras 1 (topo) e 5 (cicla)
		await setRows("3");
		await ui.hotbar.changePage(4); await sleep(600);
		const pages2 = [...document.querySelectorAll("#hotbar .op-extra-row")].map((e) => e.dataset.page);
		check("HB-L13b", pages2.join() === "1,5", { pages2 });
		await ui.hotbar.changePage(1);
	} catch (e) {
		out.erro = String(e.stack ?? e);
	} finally {
		await game.settings.set("core", "hotbarLock", false);
		await game.settings.set(SYS, "hotbarRows", "auto");
		await temp?.delete();
		for (const m of game.macros.filter((x) => x.name.startsWith("ZZ m") || x.name === "ZZ soltar hab")) await m.delete();
		for (const m of game.messages.filter((x) => x.timestamp >= t0 && x.author?.id === user.id)) await m.delete().catch(() => {});
		await user.update({ hotbar: before }, { recursive: false, diff: false });
		out.barraRestaurada = JSON.stringify(user.hotbar) === JSON.stringify(before);
	}
	return JSON.stringify(out);
})()
