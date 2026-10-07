// Orquestrador Playwright: conjura os rituais pela interface de verdade (janela de conjuração, mouse no mapa, botões do
// chat) e avança o combate clicando no botão do carrossel de combate (Carolingian UI). Rodar com:
//   playwright-cli run-code --filename=scripts/ui-rituais.js
// Opções: window.__rtOpts = { only: ["Esfolar"], forms: ["basic"] } antes de rodar; resultados em window.__rtResults.
// A página precisa estar no jogo como Mestre, com a arena aberta (window.__rt.open()).
async (page) => {
	// Opções e resultados passam pela página (este script não tem acesso a arquivos): window.__rtOpts e window.__rtResults.
	const opts = await page.evaluate(() => window.__rtOpts || {});
	const only = opts.only || [];
	const formsFilter = opts.forms || [];
	const rt = (fn, ...args) => page.evaluate(([f, a]) => window.__rt[f](...a), [fn, args]);
	const results = [];
	const save = () => page.evaluate((r) => { window.__rtResults = r; }, results);
	const dialog = (title) => page.locator(`.application:has(.window-title:text-is("${title}"))`);
	const sleep = (ms) => page.waitForTimeout(ms);

	const catalog = await rt("catalog");
	const list = catalog.filter((entry) => !only.length || only.includes(entry.name));
	let n = 0;
	for (const entry of list) {
		for (const form of entry.forms) {
			if (formsFilter.length && !formsFilter.includes(form)) continue;
			const choices = entry.choices.length ? entry.choices : [null];
			for (const choice of choices) {
				const id = `${entry.name} [${form}${choice ? "/" + choice : ""}]`;
				const record = { ritual: entry.name, form, choice, circulo: entry.circle };
				try {
					await rt("cleanup"); // fecha restos de um caso anterior (janelas, prévia da área)
						// os cartoes de rolagem flutuantes ficam por cima do mapa e engolem o clique da area
						await page.evaluate(() => { if (!document.getElementById("rt-no-popups")) { const s = document.createElement("style"); s.id = "rt-no-popups"; s.textContent = "#chat-notifications{pointer-events:none !important}"; document.head.append(s); } });
					const plan = await rt("plan", n++, entry.name, form, choice);
					Object.assign(record, { agente: plan.agent, modo: plan.mode, alvos: plan.targetIds.length, alcance: plan.range, exige: plan.req, regra: plan.rule });
					await rt("prepare", plan);
					await rt("start", plan);

					// janela de conjuração
					const picker = dialog("Conjurar Ritual").first();
					await picker.waitFor({ timeout: 10000 });
					await picker.locator(`button.ritual-caster-option[data-ritual-id="${plan.itemId}"]`).click();
					await sleep(300);
					if (form !== "basic") await picker.locator(`input[name="ritualForm"][value="${form}"]`).evaluate((el) => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
					await sleep(300);
					// confirmações obrigatórias (gestos, afinidade, personagem Marcado)
					for (const box of await picker.locator('input[type="checkbox"]').all()) if (!(await box.isChecked()) && (await box.isEnabled())) await box.check().catch(() => {});
					await sleep(200);
					const conjure = picker.locator('button[data-action="conjure"]');
					if (await conjure.isDisabled()) {
						record.resultado = "bloqueado pelo seletor";
						record.motivo = (await picker.locator(".ritual-cast-summary").innerText().catch(() => "")).slice(0, 200);
						await picker.locator('button[data-action="cancel"]').click();
						await sleep(300);
						results.push(record);
						await save();
						continue;
					}
					await conjure.click();

					// o resto do fluxo, como o jogador: escolha de efeito, área no mapa, testes
					let placed = false;
					const started = Date.now();
					for (let i = 0; i < 120; i++) {
						// a área não foi aceita em 15 s: cancela com Esc (vira a carta com o botão Selecionar área) e segue
						if (plan.mode === "area" && !plan.atCaster && !placed && Date.now() - started > 15000 && (await rt("previewActive"))) {
							record.areaNaoAceita = true;
							record.cliqueEm = await rt("clientPoint", plan.area.x, plan.area.y);
							record.avisosNoMomento = await page.evaluate(() => [...document.querySelectorAll("#notifications .notification")].map((n) => n.innerText));
							await page.screenshot({ path: "C:/Users/Geh/VTT/foundry-dev/work/area-falhou-" + id.replace(/[^a-zA-Z0-9]/g, "_") + ".png" });
							await page.keyboard.press("Escape");
							placed = true;
						}
						if (await rt("macroDone") && (await rt("settled"))) break;
						const choiceDialog = dialog(entry.name).last();
						if (choice && (await choiceDialog.count())) {
							await choiceDialog.locator('select[name="choice"]').selectOption(choice);
							await choiceDialog.locator('button[data-action="ok"]').click();
							await sleep(300);
							continue;
						}
						if (plan.mode === "area" && !plan.atCaster && !placed && (await rt("previewActive"))) {
							const point = await rt("clientPoint", plan.area.x, plan.area.y);
							await page.mouse.move(point.x - 20, point.y - 20);
							await page.mouse.move(point.x, point.y);
							await sleep(250);
							await page.mouse.click(point.x, point.y);
							await sleep(500);
							if (!(await rt("previewActive"))) placed = true;
						}
						const rollDialog = page.locator('.application:has(.window-title:text-matches("^Teste de"))');
						if (await rollDialog.count()) {
							await rollDialog.first().locator('button[data-action="normal"]').click().catch(() => {});
						}
						await sleep(350);
					}
					await sleep(1200);
					const res = await rt("result", plan);
					Object.assign(record, { resultado: res.status ?? "sem carta", botoes: res.buttons, pd: res.pdSpent, resumo: res.resumo, area: res.linhasArea, avisos: res.avisos, erros: res.erros });
					// o combate segue pelo carrossel (botão de avançar turno)
					await page.locator("button.crlngn-advance-turn").first().click({ timeout: 4000 }).catch(() => { record.avancou = false; });
					await sleep(1800);
					record.estado = await rt("combatState");
					await rt("cleanup");
				} catch (error) {
					record.resultado = "erro";
					record.erro = String(error).slice(0, 300);
					await page.keyboard.press("Escape").catch(() => {});
					await rt("cleanup").catch(() => {});
				}
				results.push(record);
				await save();
				console.log(`${results.length}. ${id}: ${record.resultado}${record.erro ? " " + record.erro : ""}`);
			}
		}
	}
	await save();
	return { total: results.length, porResultado: results.reduce((m, r) => { m[r.resultado] = (m[r.resultado] || 0) + 1; return m; }, {}) };
}
