// Fluxo do botão "Selecionar área" com mouse de verdade: cancela a área na conjuração (Esc), clica no botão da carta
// no chat, posiciona a área no mapa e confere que o dano e a resistência saíram.
async (page) => {
	const rt = (fn, ...args) => page.evaluate(([f, a]) => window.__rt[f](...a), [fn, args]);
	const sleep = (ms) => page.waitForTimeout(ms);
	const out = [];
	await rt("cleanup");
	const plan = await rt("plan", 2, "Paradoxo", "basic", null);
	await rt("prepare", plan);
	await rt("start", plan);
	const picker = page.locator('.application:has(.window-title:text-is("Conjurar Ritual"))').first();
	await picker.waitFor({ timeout: 10000 });
	await picker.locator(`button.ritual-caster-option[data-ritual-id="${plan.itemId}"]`).click();
	await sleep(400);
	for (const box of await picker.locator('input[type="checkbox"]').all()) if (!(await box.isChecked())) await box.check().catch(() => {});
	await picker.locator('button[data-action="conjure"]').click();
	for (let i = 0; i < 40 && !(await rt("previewActive")); i++) await sleep(250);
	out.push("prévia da área aberta: " + (await rt("previewActive")));
	await sleep(500);
	await page.keyboard.press("Escape"); // desiste da área na conjuração
	for (let i = 0; i < 60 && !(await rt("macroDone")); i++) {
		const roll = page.locator('.application:has(.window-title:text-matches("^Teste de"))');
		if (await roll.count()) await roll.first().locator('button[data-action="normal"]').click().catch(() => {});
		await sleep(300);
	}
	await sleep(1500);
	await page.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab("chat", "primary"); });
	await sleep(800);
	const cardId = await page.evaluate(() => game.messages.contents.filter((m) => !window.__known.has(m.id) && m.getFlag("ordem_v2_classic", "ritualCast")).at(-1)?.id);
	out.push("carta aguardando a área: " + (await page.evaluate((id) => game.messages.get(id)?.getFlag("ordem_v2_classic", "ritualCast")?.status, cardId)));
	const button = page.locator(`.message[data-message-id="${cardId}"] [data-action="ritual-area-place"]`);
	out.push("botão Selecionar área na carta: " + (await button.count()));
	await button.click();
	for (let i = 0; i < 40 && !(await rt("previewActive")); i++) await sleep(250);
	const threat = await page.evaluate(() => { const t = canvas.tokens.placeables.find((x) => x.name === "ZZ ameaça 2"); return { x: t.center.x, y: t.center.y, hp: t.actor.system.attributes.hp.value }; });
	const point = await rt("clientPoint", threat.x, threat.y);
	await page.mouse.move(point.x - 30, point.y - 30);
	await page.mouse.move(point.x, point.y);
	await sleep(400);
	await page.mouse.click(point.x, point.y);
	for (let i = 0; i < 60 && !(await rt("settled")); i++) {
		const roll = page.locator('.application:has(.window-title:text-matches("^Teste de"))');
		if (await roll.count()) await roll.first().locator('button[data-action="normal"]').click().catch(() => {});
		await sleep(300);
	}
	await sleep(2000);
	const res = await rt("result", plan);
	const after = await page.evaluate(() => canvas.tokens.placeables.find((x) => x.name === "ZZ ameaça 2").actor.system.attributes.hp.value);
	out.push(`carta: ${res.status}; PV da ameaça ${threat.hp} → ${after}; ${res.linhasArea.slice(0, 200)}`);
	await rt("cleanup");
	return out;
}
