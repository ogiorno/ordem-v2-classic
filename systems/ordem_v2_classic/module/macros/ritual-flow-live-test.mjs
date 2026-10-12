// Testes ao vivo do fluxo de conjuração rápida (docs/arquivo/spec-fluxo-conjuracao-rapida.md, seção 9.2, FC-L1 a FC-L15).
// Conjura de verdade pela ficha e pelo cartão, clicando nos botões como o jogador. Roda na arena temporária
// (ritual-live-arena.mjs): cena e cópias dos agentes são apagadas no fim; o mundo em uso não é tocado.
//
//   const t = await import("/systems/ordem_v2_classic/module/macros/ritual-flow-live-test.mjs");
//   await t.runFlowTests();                 // tudo
//   await t.runFlowTests({ only: "FC-L7" }); // por prefixo
//
// Devolve uma tabela { id, caso, ok, detalhe }.

import { withArena } from "./ritual-live-arena.mjs";
import { castRitualFast } from "./ritual-cast-card.mjs";
import { activeRitualsOf, buildRitualSelection, swapState } from "./ritual-caster.mjs";
import { applyCondition } from "./ritual-area-engine.mjs";
import { handleAreaPanelAction } from "./ritual-area-panel.mjs";
import { FLOW_SETTING } from "../helpers/ritual-flow-settings.mjs";

const SYSTEM = "ordem_v2_classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hp = (token) => Number(token.actor.system.attributes.hp.value);
/** Espera uma promessa do fluxo, mas não deixa o teste pendurado para sempre (a janela fica aberta e o caso falha com a causa). */
const within = (promise, ms = 120000) => Promise.race([promise, pause(ms).then(() => { throw new Error("tempo esgotado esperando o fluxo terminar"); })]);
const pd = (actor) => Number(actor.system.PD.value);
const cell = (col, row) => ({ x: col * 100 + 50, y: row * 100 + 50 });
/** Rastro para achar onde um caso trava: window.__flowTrace */
// a mira só recebe eventos depois de registrar os ouvintes (marca data-placing-area); um evento enviado antes se perde.
// Reenvia o gesto até a conjuração terminar, em vez de apostar num único evento.
const aimReady = () => (canvas.app.canvas ?? canvas.app.view).dataset.placingArea === "true";
async function resendUntilDone(run, send, attempts = 8) {
	let done = false;
	run.finally(() => { done = true; });
	for (let i = 0; i < attempts && !done; i++) { send(); await pause(700); }
	await within(run);
}
const trace = (message) => (globalThis.__flowTrace ??= []).push(`${Math.round(performance.now())} ${message}`);

async function waitFor(check, { timeout = 15000, step = 150 } = {}) {
	const t0 = Date.now();
	while (Date.now() - t0 < timeout) {
		const value = await check();
		if (value) return value;
		await pause(step);
	}
	return null;
}

const ALL_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];

/** Deixa a ameaça sem RD/imunidade e com a resistência forçada (pass = sempre passa, fail = sempre falha). */
async function tuneThreat(token, mode = "normal") {
	const update = { "system.genericRd": { value: 0, except: [] } };
	for (const type of ALL_TYPES) {
		update[`system.resistances.${type}.value`] = 0;
		update[`system.resistances.${type}.vulnerable`] = false;
		update[`system.resistances.${type}.immune`] = false;
	}
	if (mode !== "normal") for (const skill of ["resilience", "reflexes", "will", "fighting"]) update[`system.skills.${skill}.value`] = mode === "pass" ? 100 : -100;
	await token.actor.update(update);
}

async function ensureRitual(actor, name) {
	let item = actor.items.find((entry) => entry.type === "ritual" && entry.name === name);
	if (item) return item;
	const source = game.actors.getName("Biblioteca de Rituais — Agente")?.items.find((entry) => entry.type === "ritual" && entry.name === name);
	if (!source) throw new Error(`Ritual "${name}" não está na biblioteca.`);
	[item] = await actor.createEmbeddedDocuments("Item", [source.toObject()]);
	return item;
}

async function ensureWeapon(actor, name) {
	let item = actor.items.find((entry) => entry.type === "armament" && entry.name === name);
	if (item) return item;
	const pack = game.packs.get("ordem_v2_classic.armaments");
	const entry = pack.index.find((doc) => doc.name === name);
	const doc = await pack.getDocument(entry._id);
	[item] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	return item;
}

// Só janelas abertas de verdade: uma janela que acabou de fechar ainda fica um instante no DOM e enganaria o teste.
const liveApps = () => [...foundry.applications.instances.values()].filter((app) => app.state === foundry.applications.api.ApplicationV2.RENDER_STATES.RENDERED && app.element?.isConnected);
const dialogs = () => liveApps().map((app) => app.element);
const dialogByTitle = (title) => liveApps().filter((app) => String(app.title ?? "").startsWith(title)).at(-1)?.element ?? null;
const castCard = () => dialogByTitle("Conjurar ·");
const text = (node) => node?.innerText?.replace(/\s+/g, " ").trim() ?? "";

function setTargets(tokens) {
	game.user.targets.forEach((token) => token.setTarget(false, { releaseOthers: false }));
	tokens.forEach((token) => token.setTarget(true, { releaseOthers: false, groupSelection: false, user: game.user }));
}

/** Registra os avisos (notifications) enquanto `fn` roda. */
async function withWarnings(fn) {
	const warnings = [];
	const originals = {};
	for (const level of ["info", "warn", "error"]) {
		originals[level] = ui.notifications[level];
		ui.notifications[level] = function (message, ...rest) {
			warnings.push(String(message));
			return originals[level].call(this, message, ...rest);
		};
	}
	try {
		return { value: await fn(), warnings };
	} finally {
		for (const level of Object.keys(originals)) ui.notifications[level] = originals[level];
	}
}

const newMessages = (known) => game.messages.contents.filter((message) => !known.has(message.id));
const knownIds = () => new Set(game.messages.contents.map((message) => message.id));
const castCardOf = (known, actor) => newMessages(known).filter((message) => message.getFlag(SYSTEM, "ritualCast")?.actorId === actor.id).at(-1) ?? null;
const castStatus = (message) => game.messages.get(message?.id)?.getFlag(SYSTEM, "ritualCast")?.status;

/** Espera a carta do ritual sair do estado de resolução. */
async function settle(known, actor, { rollDamage = true } = {}) {
	await waitFor(() => {
		const card = castCardOf(known, actor);
		// ritual com dano: a carta espera o botão "Rolar dano", que o jogador clica (revisão 2 da carta)
		if (rollDamage && card && castStatus(card) === "needsDamage") document.querySelector(`.message[data-message-id="${card.id}"] [data-action="ritual-roll-damage"]`)?.click();
		return card && !["effects", "rolling", ...(rollDamage ? ["needsDamage"] : [])].includes(castStatus(card)) ? card : null;
	}, { timeout: 90000 });
	await pause(500);
	return castCardOf(known, actor);
}

/** Abre o cartão pelo fluxo rápido e devolve a janela. */
async function openCard(actor, item, options = {}) {
	const promise = castRitualFast(actor, item, options);
	const dlg = await waitFor(() => castCard());
	return { promise, dlg };
}

const clickIn = (dlg, selector) => {
	const node = dlg.querySelector(selector);
	if (!node) throw new Error(`Não achei ${selector} no cartão.`);
	node.click();
	return node;
};

function sheetRow(actor, item) {
	return actor.sheet.element?.querySelector(`li.item[data-item-id="${item.id}"]`) ?? null;
}

async function openSheet(actor) {
	await actor.sheet.render(true);
	await waitFor(() => actor.sheet.element?.querySelector('[data-tab="rituals"]'));
	await pause(300);
}

const cardButtons = (message) => [...(game.messages.get(message?.id)?.content.matchAll(/data-action="([^"]+)"/g) ?? [])].map((match) => match[1]);

/* -------------------------------------------- */

export async function runFlowTests({ only = null } = {}) {
	const results = [];
	// FC-L3 e FC-L4 usam a carta que o FC-L2 conjura, então pedir um deles roda antes o FC-L2 (e o FC-L4, também o FC-L3)
	const want = (id) => !only || id.startsWith(only) || (id === "FC-L2" && /^FC-L[34]/.test(only)) || (id === "FC-L3" && /^FC-L4/.test(only));
	const add = (id, caso, ok, detalhe = "") => results.push({ id, caso, ok: Boolean(ok), detalhe: String(detalhe) });
	const guard = async (id, caso, fn) => {
		if (!want(id)) return;
		try {
			await fn();
		} catch (error) {
			add(id, caso, false, `erro: ${error.message}\n${String(error.stack).split("\n").slice(1, 3).join("\n")}`);
		}
	};

	// a forma e a variante lembradas de execuções anteriores não podem mudar o ponto de partida dos casos
	try { for (const key of Object.keys(localStorage).filter((name) => name.startsWith("ordem_v2_classic.ritualFlow."))) localStorage.removeItem(key); } catch { /* sem armazenamento */ }
	const withoutSanity = game.settings.get(SYSTEM, "globalPlayingWithoutSanity");
	// a macro só funciona com "Jogando sem Sanidade" (PD): liga durante o teste e devolve o valor do mundo
	if (!withoutSanity) await game.settings.set(SYSTEM, "globalPlayingWithoutSanity", true);
	const confirmBefore = game.settings.get(SYSTEM, FLOW_SETTING.confirmSpend);
	const nameBefore = game.settings.get(SYSTEM, FLOW_SETTING.nameClick);

	try {
		await withArena(async (arena) => {
			const [{ actor: caster, token: casterToken }, { actor: allyA, token: allyAToken }, { actor: allyB, token: allyBToken }, { actor: fourth, token: fourthToken }] = arena.agents;
			for (const actor of [caster, allyA, allyB, fourth]) {
				const old = actor.items.filter((entry) => entry.type === "armament").map((entry) => entry.id);
				if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
				await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.map((effect) => effect.id));
				await actor.update({ "system.PD.value": 200, "system.skills.occultism.mod": 100 });
			}
			// os aliados ficam colados no conjurador (o alcance de Amaldiçoar Arma é toque)
			await allyAToken.document.update({ x: casterToken.document.x + 100, y: casterToken.document.y });
			await allyBToken.document.update({ x: casterToken.document.x - 100, y: casterToken.document.y });
			// o quarto agente só participa pelo ator (FC-L25): o token sai da cena para nenhuma área contá-lo
			await fourthToken.document.delete();
			await ensureWeapon(caster, "Faca");
			await ensureWeapon(allyA, "Faca");
			await ensureWeapon(allyB, "Faca");
			const at = async (name, col, row, mode = "normal") => {
				const token = await arena.mkThreat(name, cell(col, row).x, cell(col, row).y);
				await tuneThreat(token, mode);
				return token;
			};
			const cc = { col: Math.round(casterToken.document.x / 100), row: Math.round(casterToken.document.y / 100) };
			await game.settings.set(SYSTEM, FLOW_SETTING.confirmSpend, true);
			await game.settings.set(SYSTEM, FLOW_SETTING.nameClick, "cast");
			setTargets([]);

			/* ---- FC-L1: pessoal pela ficha (arma o botão, confirma no 2º clique) e sem janela de rolagem ---- */
			await guard("FC-L1", "Pessoal pela ficha", async () => {
				const item = await ensureRitual(caster, "Terceiro Olho");
				await openSheet(caster);
				const button = sheetRow(caster, item)?.querySelector("a.item-cast");
				if (!button) throw new Error("botão ✦ não apareceu na linha do ritual");
				const known = knownIds();
				const before = pd(caster);
				button.click();
				await pause(500);
				const armed = button.classList.contains("ritual-armed");
				const spentAfterFirst = before - pd(caster);
				const rollDialog = () => dialogs().some((entry) => /^Teste de/.test(entry.querySelector(".window-title")?.innerText ?? ""));
				button.click();
				const card = await settle(known, caster);
				const sawRollDialog = rollDialog();
				const messages = newMessages(known);
				const occultismCard = messages.some((message) => /Ocultismo/.test(message.flavor ?? "") || /Ocultismo/.test(message.content ?? ""));
				add("FC-L1", "Pessoal pela ficha: 1º clique arma, 2º conjura; sem janela de rolagem; o teste de Ocultismo sai no chat", armed && spentAfterFirst === 0 && castStatus(card) === "resolved" && before - pd(caster) === 1 && !sawRollDialog && occultismCard,
					`armado=${armed}; gasto após 1º clique=${spentAfterFirst}; carta=${castStatus(card)}; PD gasto=${before - pd(caster)}; janela de rolagem=${sawRollDialog}; teste de Ocultismo no chat=${occultismCard}`);
				// 1 clique só quando a confirmação está desligada (FC-15, O-1)
				await game.settings.set(SYSTEM, FLOW_SETTING.confirmSpend, false);
				await caster.sheet.render(true);
				await pause(600);
				const known2 = knownIds();
				const before2 = pd(caster);
				sheetRow(caster, item).querySelector("a.item-cast").click();
				const card2 = await settle(known2, caster);
				add("FC-L15a", "Pessoal: 1 clique conjura quando a confirmação está desligada", castStatus(card2) === "resolved" && before2 - pd(caster) === 1, `carta=${castStatus(card2)}; PD gasto=${before2 - pd(caster)}`);
				await game.settings.set(SYSTEM, FLOW_SETTING.confirmSpend, true);
			});

			/* ---- FC-L9: reação (rápido) conjura em 1 toque, sem cartão; sem PD abre aviso ---- */
			await guard("FC-L9", "Reação", async () => {
				const item = await ensureRitual(caster, "Overclock");
				const known = knownIds();
				const before = pd(caster);
				const run = castRitualFast(caster, item, { skipConfirm: true });
				await pause(400);
				const cardOpen = Boolean(castCard());
				const card = await settle(known, caster);
				await within(run);
				add("FC-L9", "Reação conjura direto, sem cartão", !cardOpen && castStatus(card) === "resolved" && before - pd(caster) === 1, `cartão aberto=${cardOpen}; carta=${castStatus(card)}; PD gasto=${before - pd(caster)}`);
				await caster.update({ "system.PD.value": 0 });
				const known2 = knownIds();
				const { warnings } = await withWarnings(() => castRitualFast(caster, item, { skipConfirm: true }));
				add("FC-L9a", "Reação sem PD: aviso e nada é gasto", pd(caster) === 0 && !castCardOf(known2, caster) && warnings.some((w) => /PD/.test(w)), `avisos: ${warnings.join(" | ")}`);
				await caster.update({ "system.PD.value": 200 });
			});

			/* ---- FC-L2: buff em aliado; sem token marcado vale "você" (padrão, destacado) ---- */
			let curseCard = null;
			await guard("FC-L2", "Buff em aliado", async () => {
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Sangue");
				setTargets([]);
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				if (!dlg) throw new Error("o cartão não abriu");
				const chip = dlg.querySelector('.rc-person');
				const defaultChip = chip?.dataset.state === "default" && /Você/.test(text(chip));
				const buttonLabel = text(dlg.querySelector('[data-action="conjure"]'));
				setTargets([allyAToken]);
				await pause(500);
				const chosen = text(dlg.querySelector('.rc-person'));
				const stillEnabled = !dlg.querySelector('[data-action="conjure"]').disabled;
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				curseCard = await settle(known, caster);
				const onAlly = [...allyA.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse);
				const onCaster = [...caster.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse);
				add("FC-L2", "Sem marcar: chip 'você (padrão)'; trocar para aliado pela lista; buff só no aliado", defaultChip && /Conjurar \(1 PD\)/.test(buttonLabel) && /Zz|ZZ|Agente/.test(chosen) && !/Você/.test(chosen) && stillEnabled && onAlly.length === 1 && onCaster.length === 0 && before - pd(caster) === 1,
					`chip padrão=${defaultChip}; botão="${buttonLabel}"; chip depois="${chosen}"; efeitos no aliado=${onAlly.length}, no conjurador=${onCaster.length}; PD gasto=${before - pd(caster)}`);
			});

			/* ---- FC-L3 / FC-L4: trocar alvo ---- */
			await guard("FC-L3", "Trocar alvo", async () => {
				if (!curseCard) throw new Error("depende do FC-L2");
				const before = pd(caster);
				const buttons = cardButtons(curseCard);
				const node = document.querySelector(`.message[data-message-id="${curseCard.id}"] [data-action="ritual-swap-target"]`);
				if (!node) throw new Error("botão Trocar alvo não está na carta");
				node.click();
				const dlg = await waitFor(() => dialogByTitle("Trocar alvo"));
				if (!dlg) throw new Error("a janela de trocar alvo não abriu");
				const select = dlg.querySelector("select[name=tokenId]");
				select.value = allyBToken.id;
				dlg.querySelector("button[data-action=ok]")?.click();
				await waitFor(() => [...allyB.effects].some((effect) => effect.flags?.[SYSTEM]?.weaponCurse));
				await pause(800);
				const onA = [...allyA.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse).length;
				const onB = [...allyB.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse).length;
				const card = game.messages.get(curseCard.id);
				const log = (card.getFlag(SYSTEM, "ritualCast")?.outcome?.swapLog ?? []).join(" ");
				add("FC-L3", "Trocar alvo: o efeito sai do primeiro e entra no segundo, PD não muda, carta registra", buttons.includes("ritual-swap-target") && onA === 0 && onB === 1 && pd(caster) === before && /Alvo trocado de .* para /.test(log), `no 1º=${onA}, no 2º=${onB}; PD ${before} → ${pd(caster)}; ${log}`);
			});
			await guard("FC-L4", "Trocar alvo some depois do uso", async () => {
				if (!curseCard) throw new Error("depende do FC-L2");
				const player = game.users.find((user) => !user.isGM && user.name === "QA1") ?? game.users.find((user) => !user.isGM);
				await caster.update({ [`ownership.${player.id}`]: 3 });
				const free = await swapState(curseCard.id, { user: player });
				const effect = [...allyB.effects].find((entry) => entry.flags?.[SYSTEM]?.weaponCurse);
				await effect.setFlag(SYSTEM, "used", true);
				const usedPlayer = await swapState(curseCard.id, { user: player });
				const usedGm = await swapState(curseCard.id, { user: game.user });
				await effect.delete();
				const gone = await swapState(curseCard.id, { user: game.user });
				add("FC-L4", "Trocar alvo: o jogador perde o botão depois do uso, o Mestre não; sem efeito ninguém troca", free.available && !usedPlayer.available && usedPlayer.used && usedGm.available && !gone.available, `jogador livre=${free.available}; jogador após uso=${usedPlayer.available}; Mestre após uso=${usedGm.available}; sem efeito=${gone.available}`);
			});

			/* ---- FC-L5 / FC-L6: alvo hostil ---- */
			await guard("FC-L5", "Alvo hostil", async () => {
				const target = await at("ZZ hostil colado", cc.col + 1, cc.row, "fail");
				setTargets([]);
				const known = knownIds();
				const before = pd(caster);
				const hpBefore = hp(target);
				const { promise, dlg } = await openCard(caster, await ensureRitual(caster, "Decadência"));
				const disabledLabel = text(dlg.querySelector('[data-action="conjure"]'));
				const disabled = dlg.querySelector('[data-action="conjure"]').disabled;
				setTargets([target]);
				await pause(500);
				const enabled = !dlg.querySelector('[data-action="conjure"]').disabled;
				const resist = text(dlg.querySelector(".rc-resist"));
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const sawRollDialog = dialogs().some((entry) => /^Teste de/.test(entry.querySelector(".window-title")?.innerText ?? ""));
				add("FC-L5", "Hostil sem alvo: 'Escolha o alvo' desabilitado; marcando, conjura; resistência rolada pelo alvo sem janela", disabled && /Escolha o alvo/.test(disabledLabel) && enabled && /Fortitude/.test(resist) && castStatus(card) === "resolved" && hp(target) < hpBefore && before - pd(caster) >= 1 && !sawRollDialog,
					`sem alvo="${disabledLabel}"; resistência="${resist}"; carta=${castStatus(card)}; PV ${hpBefore} → ${hp(target)}; janela de rolagem=${sawRollDialog}`);
				await target.document.delete();
				setTargets([]);
			});
			await guard("FC-L6", "Hostil fora de alcance", async () => {
				const far = await at("ZZ hostil longe", cc.col + 6, cc.row + 6);
				setTargets([far]);
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, await ensureRitual(caster, "Decadência"));
				await pause(400);
				const label = text(dlg.querySelector('[data-action="conjure"]'));
				const disabled = dlg.querySelector('[data-action="conjure"]').disabled;
				const hint = text(dlg.querySelector(".rc-hint"));
				clickIn(dlg, '[data-action="cancel"]');
				await within(promise);
				add("FC-L6", "Hostil fora do alcance (toque): botão desabilitado com motivo, nada gasto", disabled && /Fora de alcance/.test(label) && /fora do alcance/i.test(hint) && pd(caster) === before, `botão="${label}"; dica="${hint}"; PD ${before} → ${pd(caster)}`);
				await far.document.delete();
				setTargets([]);
			});

			/* ---- FC-L13 / FC-L14: cancelar não gasta; clique duplo gasta uma vez ---- */
			await guard("FC-L13", "Cancelar", async () => {
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Sangue");
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				clickIn(dlg, '[data-action="cancel"]');
				await within(promise);
				await pause(400);
				add("FC-L13", "Cancelar o cartão: nada gasto, nada no chat", pd(caster) === before && newMessages(known).length === 0, `PD ${before} → ${pd(caster)}; mensagens novas ${newMessages(known).length}`);
			});
			await guard("FC-L14", "Clique duplo", async () => {
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Sangue");
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const button = dlg.querySelector('[data-action="conjure"]');
				button.click();
				button.click();
				await within(promise);
				await settle(known, caster);
				const cards = newMessages(known).filter((message) => message.getFlag(SYSTEM, "ritualCast")?.actorId === caster.id).length;
				add("FC-L14", "Duplo clique em Conjurar: debita uma vez e cria uma carta", before - pd(caster) === 1 && cards === 1, `PD gasto ${before - pd(caster)}; cartas ${cards}`);
			});

			/* ---- FC-L8: variante ---- */
			await guard("FC-L8", "Variante", async () => {
				const item = await ensureRitual(caster, "Transfigurar Água");
				setTargets([]);
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const label = text(dlg.querySelector('[data-action="conjure"]'));
				const disabled = dlg.querySelector('[data-action="conjure"]').disabled;
				const variants = dlg.querySelectorAll('input[name="variant"]').length;
				dlg.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
				await pause(400);
				const afterKey = dlg.querySelector('[data-action="conjure"]').disabled;
				clickIn(dlg, '[data-action="cancel"]');
				await within(promise);
				add("FC-L8", "Variante: botão 'Escolha a variante' até escolher; tecla 1 escolhe", disabled && /Escolha a variante/.test(label) && variants >= 4 && afterKey === false && pd(caster) === before, `botão="${label}"; variantes=${variants}; habilitou com a tecla 1=${!afterKey}`);
			});

			/* ---- FC-L10: sustentado ---- */
			await guard("FC-L10", "Sustentado", async () => {
				const item = await ensureRitual(caster, "Fedor Pútrido");
				const known = knownIds();
				const run = castRitualFast(caster, item, { skipConfirm: true });
				const card = await settle(known, caster);
				await within(run);
				const listed = activeRitualsOf(caster).find((entry) => /Fedor/.test(entry.name));
				const node = document.querySelector(`.message[data-message-id="${card?.id}"] [data-action="ritual-end"]`);
				if (!listed || !node) throw new Error(`ativo=${Boolean(listed)}; botão Encerrar=${Boolean(node)}`);
				node.click();
				await waitFor(() => !activeRitualsOf(caster).some((entry) => /Fedor/.test(entry.name)));
				await pause(600);
				add("FC-L10", "Sustentado: aparece em Rituais ativos e Encerrar remove", !activeRitualsOf(caster).some((entry) => /Fedor/.test(entry.name)) && /encerrad/i.test(game.messages.contents.at(-1)?.content ?? ""), `ativos agora: ${activeRitualsOf(caster).map((entry) => entry.name).join(",") || "nenhum"}`);
			});

			/* ---- FC-L11: Medo ---- */
			await guard("FC-L11", "Medo", async () => {
				const item = await ensureRitual(caster, "Medo Tangível");
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const label = text(dlg.querySelector('[data-action="conjure"]'));
				const disabled = dlg.querySelector('[data-action="conjure"]').disabled;
				const noOcc = /sem teste de Ocultismo/i.test(text(dlg));
				const checkbox = dlg.querySelector('input[name="fear"]');
				checkbox.click();
				await pause(400);
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const flagged = game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome;
				const occultismRoll = newMessages(known).some((message) => /Ocultismo/i.test(message.flavor ?? "") || /Ocultismo/i.test(message.content ?? "") && !message.getFlag(SYSTEM, "ritualCast"));
				add("FC-L11", "Medo: exige 'Marcado', não rola Ocultismo e, com o Custo do Paranormal desligado (padrão), só cobra o custo do ritual", disabled && /Marcado/.test(label) && noOcc && !flagged?.extra && !occultismRoll && before - pd(caster) === 10, `botão="${label}"; sem Ocultismo=${!occultismRoll}; extra=${JSON.stringify(flagged?.extra)}; PD gasto ${before - pd(caster)}`);
			});

			/* ---- Medo com o Custo do Paranormal ligado: a perda extra vira PD na hora ---- */
			await guard("FC-L28", "Medo com custo do Paranormal", async () => {
				const item = await ensureRitual(caster, "Medo Tangível");
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const toggle = dlg.querySelector('input[name="paranormalCost"]');
				if (!toggle) throw new Error("o interruptor não aparece no ritual de Medo");
				toggle.click();
				dlg.querySelector('input[name="fear"]')?.click();
				await pause(400);
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const flagged = game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome;
				add("FC-L28", "Medo com o Custo do Paranormal ligado: sem Ocultismo, a perda extra sai na hora em PD", flagged?.extra?.kind === "fear" && flagged?.extra?.applied === true && !flagged?.occultism && before - pd(caster) === 20, `extra=${JSON.stringify(flagged?.extra)}; PD gasto ${before - pd(caster)}`);
			});

			/* ---- Custo do Paranormal: interruptor no cartão, extra cobrado na hora (revisão 2) ---- */
			await guard("FC-L16", "Custo extra", async () => {
				await caster.update({ "system.skills.occultism.mod": -100 });
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Morte");
				setTargets([]);
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const toggle = dlg.querySelector('input[name="paranormalCost"]');
				const startsOff = toggle?.checked === false;
				toggle.click();
				await pause(400);
				const footer = text(dlg.querySelector(".rc-footer-cost"));
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const spent = before - pd(caster);
				const outcome = game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome;
				const buttons = cardButtons(card);
				const html = game.messages.get(card.id).content;
				add("FC-L16", "Custo do Paranormal: desligado por padrão; ligado e falhando no Ocultismo, o PD extra sai na hora, sem botão, e a carta mostra +N na ficha", startsOff && /Falha: perde \+1 PD/.test(footer) && spent === 2 && outcome?.extra?.applied === true && !buttons.includes("ritual-extra-cost") && /rc2-extra/.test(html) && /DT 21/.test(html),
					`desligado no início=${startsOff}; rodapé="${footer}"; PD gasto=${spent}; extra=${JSON.stringify(outcome?.extra)}; botão=${buttons.includes("ritual-extra-cost")}`);
				await caster.update({ "system.skills.occultism.mod": 100 });
			});

			await guard("FC-L27", "Custo do Paranormal desligado", async () => {
				await caster.update({ "system.skills.occultism.mod": -100 });
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Morte");
				setTargets([]);
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const footer = text(dlg.querySelector(".rc-footer-cost"));
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const outcome = game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome;
				const html = game.messages.get(card.id).content;
				add("FC-L27", "Custo do Paranormal desligado (padrão): o Ocultismo é rolado e aparece (DT e ✖), mas a falha não cobra PD extra", /Ocultismo vs DT 21/.test(footer) && !/Falha: perde/.test(footer) && before - pd(caster) === 1 && outcome?.occultism?.success === false && !outcome?.extra && /rc2-roll/.test(html) && /DT 21/.test(html) && !/rc2-extra/.test(html),
					`rodapé="${footer}"; PD gasto=${before - pd(caster)}; teste=${JSON.stringify({ total: outcome?.occultism?.total, success: outcome?.occultism?.success })}; extra=${JSON.stringify(outcome?.extra)}`);
				await caster.update({ "system.skills.occultism.mod": 100 });
			});

			/* ---- FC-L12: manual ---- */
			await guard("FC-L12", "Manual", async () => {
				const item = await ensureRitual(caster, "Luz");
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item);
				const warning = /resolvido pelo Mestre/i.test(text(dlg));
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				add("FC-L12", "Manual: cobra, avisa e não aplica efeito", warning && castStatus(card) === "resolved" && before - pd(caster) >= 1 && !game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome?.effects?.length, `aviso no cartão=${warning}; carta=${castStatus(card)}; PD gasto=${before - pd(caster)}`);
			});

			/* ---- FC-L17: hotbar (macro do item) ---- */
			await guard("FC-L17", "Hotbar", async () => {
				const item = await ensureRitual(caster, "Terceiro Olho");
				canvas.tokens.activate(); // depois da mira de área a camada de modelos segue ativa e o token não seria selecionado
				casterToken.control({ releaseOthers: true });
				await pause(300);
				const known = knownIds();
				const before = pd(caster);
				const run = ordemparanormal.documents.macro.rollItem(item.name);
				const confirm = await waitFor(() => dialogByTitle(item.name));
				const sawConfirm = Boolean(confirm);
				confirm?.querySelector('[data-action="yes"]')?.click();
				await within(run);
				const card = await settle(known, caster);
				add("FC-L17", "Hotbar: a macro do ritual abre o fluxo rápido (confirma o gasto e conjura)", sawConfirm && castStatus(card) === "resolved" && before - pd(caster) === 1, `confirmação=${sawConfirm}; carta=${castStatus(card)}; PD gasto=${before - pd(caster)}`);
			});

			/* ---- FC-L18: Shift abre os Ajustes; forma Discente muda o custo; a escolha é lembrada ---- */
			await guard("FC-L18", "Ajustes e forma", async () => {
				const item = await ensureRitual(caster, "Terceiro Olho");
				const student = buildRitualSelection(item, "student");
				const known = knownIds();
				const before = pd(caster);
				const { promise, dlg } = await openCard(caster, item, { advanced: true });
				const open = Boolean(dlg.querySelector("section.rc-adjust"));
				const radio = dlg.querySelector('input[name="form"][value="student"]');
				radio.click();
				await pause(500);
				const label = text(dlg.querySelector('[data-action="conjure"]'));
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const spent = before - pd(caster);
				// reabre: a forma Discente vem marcada (UI-07)
				const again = await openCard(caster, item, { advanced: true });
				const remembered = again.dlg.querySelector('input[name="form"][value="student"]')?.checked === true;
				clickIn(again.dlg, '[data-action="cancel"]');
				await within(again.promise);
				add("FC-L18", "Shift abre os Ajustes; Discente muda o custo e o botão; a forma é lembrada na próxima vez", open && student.ok && label.includes(`Conjurar (${student.cost} PD)`) && spent === student.cost && castStatus(card) === "resolved" && remembered, `Ajustes abertos=${open}; botão="${label}"; custo esperado ${student.cost}, gasto ${spent}; lembrou=${remembered}`);
			});

			/* ---- FC-L19: Silenciado não conjura ---- */
			await guard("FC-L19", "Silenciado", async () => {
				const item = await ensureRitual(caster, "Terceiro Olho");
				await applyCondition(caster, { key: "silence" }, { zoneId: null, itemId: "teste", itemUuid: null });
				const known = knownIds();
				const before = pd(caster);
				const { warnings } = await withWarnings(() => castRitualFast(caster, item, { skipConfirm: true }));
				await openSheet(caster);
				const blockedClass = sheetRow(caster, item)?.querySelector("a.item-cast")?.classList.contains("is-blocked");
				await caster.deleteEmbeddedDocuments("ActiveEffect", caster.effects.map((effect) => effect.id));
				add("FC-L19", "Silenciado: nada é gasto, o aviso aparece e a linha do ritual fica bloqueada", pd(caster) === before && !castCard() && !castCardOf(known, caster) && warnings.some((w) => /Silenciado/.test(w)) && blockedClass === true, `avisos: ${warnings.join(" | ")}; linha bloqueada=${blockedClass}`);
			});

			/* ---- FC-L20: escolha da arma no cartão (FC-25) ---- */
			await guard("FC-L20", "Arma do buff", async () => {
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Sangue");
				const machete = await ensureWeapon(caster, "Machete");
				setTargets([]);
				const known = knownIds();
				const { promise, dlg } = await openCard(caster, item);
				const select = dlg.querySelector('select[name="link"]');
				const options = [...(select?.options ?? [])].map((option) => option.value);
				if (!select || options.length < 2) throw new Error(`o seletor de arma não apareceu (opções: ${options.join(",")})`);
				select.value = `weapon:${machete.id}`;
				select.dispatchEvent(new Event("change", { bubbles: true }));
				await pause(400);
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				await settle(known, caster);
				await pause(500);
				const curse = [...caster.effects].map((effect) => effect.flags?.[SYSTEM]?.weaponCurse).filter(Boolean).at(-1);
				add("FC-L20", "Com duas armas o cartão pergunta qual; a maldição fica na escolhida, sem janela extra", options.length >= 2 && curse?.weaponId === machete.id && !dialogByTitle("Amaldiçoar"), `opções=${options.length}; arma da maldição=${curse?.weaponName}`);
				await caster.deleteEmbeddedDocuments("ActiveEffect", [...caster.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse).map((effect) => effect.id));
				await machete.delete();
			});

			/* ---- FC-L21: área centrada no conjurador não usa a mira ---- */
			await guard("FC-L21", "Área centrada", async () => {
				const item = await ensureRitual(caster, "Detecção de Ameaças");
				const known = knownIds();
				const before = pd(caster);
				const run = castRitualFast(caster, item);
				const confirm = await waitFor(() => dialogByTitle(item.name));
				const bannerSeen = Boolean(document.querySelector(".ritual-area-banner"));
				confirm?.querySelector('[data-action="yes"]')?.click();
				await within(run);
				const card = await settle(known, caster);
				add("FC-L21", "Área centrada em você: confirma o gasto, sem mira no mapa", Boolean(confirm) && !bannerSeen && castStatus(card) === "resolved" && before - pd(caster) >= 2, `confirmação=${Boolean(confirm)}; barra da mira=${bannerSeen}; carta=${castStatus(card)}; PD gasto=${before - pd(caster)}`);
				await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === item.name).map((region) => region.id));
			});

			/* ---- FC-L22: Desfazer o dano de um ritual em alvo escolhido (só o Mestre) ---- */
			await guard("FC-L22", "Desfazer hostil", async () => {
				const target = await at("ZZ desfazer", cc.col + 1, cc.row + 2, "fail");
				setTargets([target]);
				const known = knownIds();
				const hpBefore = hp(target);
				const { promise, dlg } = await openCard(caster, await ensureRitual(caster, "Decadência"));
				await pause(400);
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				const card = await settle(known, caster);
				const hpHit = hp(target);
				const creaturesId = game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome?.creatureMessageId;
				const onCard = document.querySelector(`.message[data-message-id="${card.id}"] [data-action="ritual-undo-hostile"]`);
				const node = document.querySelector(`.message[data-message-id="${creaturesId}"] [data-action="ritual-undo-hostile"]`);
				if (onCard) throw new Error("o Desfazer não deve estar na carta do jogador");
				if (!node) throw new Error("o botão Desfazer não está na mensagem das criaturas");
				node.click();
				await waitFor(() => hp(target) > hpHit);
				await pause(600);
				const after = game.messages.get(card.id).getFlag(SYSTEM, "ritualCast")?.outcome;
				add("FC-L22", "Ritual em alvo escolhido: o Mestre desfaz o dano (PV voltam) e a carta registra", hpHit < hpBefore && hp(target) === hpBefore && after?.undone === true, `PV ${hpBefore} → ${hpHit} → ${hp(target)}; desfeito=${after?.undone}`);
				await target.document.delete();
				setTargets([]);
			});

			/* ---- FC-L23: clique no nome conjura; com a configuração "descrição" só abre o texto ---- */
			await guard("FC-L23", "Clique no nome", async () => {
				const item = await ensureRitual(caster, "Terceiro Olho");
				await game.settings.set(SYSTEM, FLOW_SETTING.confirmSpend, false);
				await openSheet(caster);
				const known = knownIds();
				const before = pd(caster);
				sheetRow(caster, item).querySelector(".ritual-cast-name").click();
				const card = await settle(known, caster);
				const cast = castStatus(card) === "resolved" && before - pd(caster) === 1;
				await game.settings.set(SYSTEM, FLOW_SETTING.nameClick, "describe");
				await caster.sheet.render(true);
				await pause(700);
				const before2 = pd(caster);
				sheetRow(caster, item).querySelector(".ritual-cast-name").click();
				await pause(1200);
				const expanded = Boolean(sheetRow(caster, item)?.querySelector(".item-description"));
				add("FC-L23", "Clique no nome conjura; com a configuração 'descrição' só mostra o texto e não gasta", cast && expanded && pd(caster) === before2, `conjurou=${cast}; descrição aberta=${expanded}; PD depois=${pd(caster)} (antes ${before2})`);
				await game.settings.set(SYSTEM, FLOW_SETTING.nameClick, "cast");
				await game.settings.set(SYSTEM, FLOW_SETTING.confirmSpend, true);
			});

			/* ---- FC-L26: o dano é rolado na própria carta; as criaturas vão para a mensagem do Mestre ---- */
			await guard("FC-L26", "Rolar dano na carta", async () => {
				const target = await at("ZZ dano carta", cc.col + 1, cc.row, "fail");
				setTargets([target]);
				const known = knownIds();
				const hpBefore = hp(target);
				const { promise, dlg } = await openCard(caster, await ensureRitual(caster, "Decadência"));
				await pause(400);
				trace('L26: conjure');
				clickIn(dlg, '[data-action="conjure"]');
				await within(promise);
				trace('L26: promise ok');
				const card = await settle(known, caster, { rollDamage: false });
				trace(`L26: card status ${castStatus(card)}`);
				await waitFor(() => castStatus(card) === "needsDamage");
				const waitingCard = game.messages.get(card.id);
				const hpWaiting = hp(target);
				const hasButton = cardButtons(waitingCard).includes("ritual-roll-damage");
				const noPublicThreatRoll = !newMessages(known).some((message) => !message.getFlag(SYSTEM, "ritualCast") && !message.whisper.length && /ZZ dano carta/.test(message.speaker?.alias ?? ""));
				const node = document.querySelector(`.message[data-message-id="${card.id}"] [data-action="ritual-roll-damage"]`);
				node?.click();
				await waitFor(() => castStatus(card) === "resolved", { timeout: 90000 });
				await pause(1200);
				const done = game.messages.get(card.id);
				const outcome = done.getFlag(SYSTEM, "ritualCast")?.outcome;
				const creatures = game.messages.get(outcome?.creatureMessageId);
				const gmOnly = creatures && creatures.whisper.length > 0 && creatures.whisper.every((id) => game.users.get(id)?.isGM);
				const threatRolls = newMessages(known).filter((message) => !message.getFlag(SYSTEM, "ritualCast") && message.rolls?.length && message.speaker?.token === target.id);
				const threatRollsPublic = threatRolls.filter((message) => !message.whisper.length).length;
				const cardHtml = done.content;
				add("FC-L26", "Rolar dano na carta: nada é rolado antes do clique; depois a carta mostra o dano e os dados; a criatura fica na mensagem só do Mestre, com Desfazer", hasButton && hpWaiting === hpBefore && hp(target) < hpBefore && /rc2-dmg/.test(cardHtml) && /rc2-die-chip/.test(cardHtml) && !/rc2-creature|Fortitude|resist/i.test(cardHtml) && Boolean(gmOnly) && /ritual-undo-hostile/.test(creatures?.content ?? "") && /ZZ dano carta/.test(creatures?.content ?? "") && noPublicThreatRoll && threatRollsPublic === 0,
					`botão=${hasButton}; PV esperando=${hpWaiting} (antes ${hpBefore}); PV depois=${hp(target)}; carta com dados=${/rc2-die-chip/.test(cardHtml)}; criaturas só Mestre=${Boolean(gmOnly)}; rolagens públicas da criatura=${threatRollsPublic}`);
				await target.document.delete();
				setTargets([]);
			});

			/* ---- FC-L24: descrição e efeito por forma no cartão (duas colunas) ---- */
			await guard("FC-L24", "Descrição no cartão", async () => {
				const item = await ensureRitual(caster, "Terceiro Olho");
				const { promise, dlg } = await openCard(caster, item, { advanced: true });
				const lore = dlg.querySelector("aside.rc-lore");
				const columns = Boolean(dlg.querySelector(".rc-cols .rc-main")) && Boolean(lore);
				const described = text(lore).length > 30;
				const selected = lore?.querySelector(".rc-lore-form.is-selected h4")?.textContent ?? "";
				const checked = dlg.querySelector('input[name="form"]:checked')?.value ?? "basic";
				const labels = { basic: "Básico", student: "Discente", true: "Verdadeiro" };
				const formsListed = lore?.querySelectorAll(".rc-lore-form").length ?? 0;
				clickIn(dlg, '[data-action="cancel"]');
				await within(promise);
				add("FC-L24", "O cartão mostra a descrição do ritual e cada forma numa coluna ao lado; a forma escolhida fica destacada", columns && described && selected.startsWith(labels[checked]) && formsListed >= 1, `colunas=${columns}; descrição=${text(lore).length} caracteres; destacada="${selected}"; formas listadas=${formsListed}`);
			});

			/* ---- FC-L25: quatro conjuradores ao mesmo tempo (cada um paga o seu PD uma vez, sem misturar cartas) ---- */
			await guard("FC-L25", "Quatro conjuradores", async () => {
				const four = [caster, allyA, allyB, fourth];
				const items = await Promise.all(four.map((actor) => ensureRitual(actor, "Terceiro Olho")));
				const before = four.map(pd);
				const known = knownIds();
				await within(Promise.all(four.map((actor, i) => castRitualFast(actor, items[i], { skipConfirm: true }))), 150000);
				await pause(1500);
				const cards = four.map((actor) => castCardOf(known, actor));
				const spent = four.map((actor, i) => before[i] - pd(actor));
				const distinct = new Set(cards.filter(Boolean).map((card) => card.id)).size;
				add("FC-L25", "Quatro agentes conjuram ao mesmo tempo: cada um paga o seu custo uma vez e tem a sua carta resolvida", cards.every((card) => card && castStatus(card) === "resolved") && distinct === 4 && spent.every((value) => value === 1), `PD gasto=${spent.join("/")}; cartas distintas=${distinct}; status=${cards.map((card) => castStatus(card)).join("/")}`);
			});

			/* ---- FC-L7: área com painel do Mestre ---- */
			let panelMsg = null;
			let victims = [];
			await guard("FC-L7", "Área", async () => {
				const item = await ensureRitual(caster, "Paradoxo");
				setTargets([]);
				victims = [await at("ZZ área 1", cc.col + 6, cc.row + 3, "fail"), await at("ZZ área 2", cc.col + 7, cc.row + 3, "pass"), await at("ZZ área 3", cc.col + 6, cc.row + 4, "fail")];
				const centre = cell(cc.col + 6, cc.row + 3);
				const known = knownIds();
				const before = pd(caster);
				const hpBefore = victims.map(hp);
				// 1) Esc cancela sem gastar (FC-42)
				trace("L7: run1 start");
				const run1 = castRitualFast(caster, item, { skipConfirm: true });
				const preview = await waitFor(() => aimReady() && document.querySelector(".ritual-area-banner"));
				trace(`L7: preview=${preview}`);
				const banner = text(document.querySelector(".ritual-area-banner"));
				await resendUntilDone(run1, () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
				trace("L7: run1 terminou");
				const cancelledFree = pd(caster) === before && !castCardOf(known, caster);
				// 2) clique válido resolve
				trace("L7: run2 start");
				const run2 = castRitualFast(caster, item, { skipConfirm: true });
				await waitFor(() => aimReady() && document.querySelector(".ritual-area-banner"));
				trace("L7: run2 mira aberta");
				const canvasEl = canvas.app.canvas ?? canvas.app.view;
				const point = (type, p) => { const c = canvas.clientCoordinatesFromCanvas(p); canvasEl.dispatchEvent(new PointerEvent(type, { clientX: c.x, clientY: c.y, button: 0, shiftKey: true, bubbles: true, cancelable: true })); };
				point("pointermove", centre);
				await pause(250);
				trace("L7: clicando");
				await resendUntilDone(run2, () => point("pointerdown", centre));
				trace("L7: run2 terminou");
				const card = await settle(known, caster);
				trace(`L7: card=${castStatus(card)}`);
				await pause(1500);
				panelMsg = game.messages.contents.find((message) => !known.has(message.id) && message.getFlag(SYSTEM, "ritualAreaPanel"));
				const panel = panelMsg?.getFlag(SYSTEM, "ritualAreaPanel");
				const hpAfter = victims.map(hp);
				const unchanged = hpAfter.every((value, i) => value === hpBefore[i]);
				const gmOnly = panelMsg && panelMsg.whisper.length > 0 && panelMsg.whisper.every((id) => game.users.get(id)?.isGM);
				add("FC-L7", "Área: Esc cancela sem gastar; mira com barra flutuante; clique válido resolve", Boolean(preview) && /Paradoxo/.test(banner) && cancelledFree && castStatus(card) === "resolved" && before - pd(caster) >= 3,
					`barra="${banner}"; cancelou sem gastar=${cancelledFree}; carta=${castStatus(card)}; PD gasto=${before - pd(caster)}`);
				add("FC-L7a", "Área em modo manual: nenhum PV muda; o painel lista todos os afetados com o dano calculado", unchanged && panel?.rows?.length === 3 && panel.rows.every((row) => row.state === "pending" && row.parts.length > 0) && Boolean(gmOnly),
					`PV antes ${hpBefore.join("/")} depois ${hpAfter.join("/")}; linhas ${panel?.rows?.length}; estados ${panel?.rows?.map((row) => row.state).join(",")}; só Mestre=${Boolean(gmOnly)}`);
			});

			const panelClick = async (action, row = null) => {
				const root = document.querySelector(`.message[data-message-id="${panelMsg.id}"]`);
				const node = root?.querySelector(row === null ? `[data-action="${action}"]` : `[data-action="${action}"][data-row="${row}"]`);
				if (node) node.click();
				else await handleAreaPanelAction(panelMsg.id, action, { row });
				await pause(1500);
				return Boolean(node);
			};
			const panelRows = () => game.messages.get(panelMsg.id).getFlag(SYSTEM, "ritualAreaPanel").rows;

			await guard("FC-L7b", "Aplicar numa linha", async () => {
				if (!panelMsg) throw new Error("depende do FC-L7");
				const hpBefore = victims.map(hp);
				const clicked = await panelClick("ritual-area-apply", 0);
				const hpAfter = victims.map(hp);
				const rows = panelRows();
				add("FC-L7b", "Aplicar numa linha tira o PV só daquele alvo e marca Aplicado", hpAfter[0] < hpBefore[0] && hpAfter[1] === hpBefore[1] && hpAfter[2] === hpBefore[2] && rows[0].state === "applied" && rows[1].state === "pending", `botão clicado de verdade=${clicked}; PV ${hpBefore.join("/")} → ${hpAfter.join("/")}; estados ${rows.map((row) => row.state).join(",")}`);
			});
			await guard("FC-L7d", "Desfazer, ignorar, reativar e editar", async () => {
				if (!panelMsg) throw new Error("depende do FC-L7");
				const hpFull = victims.map(hp);
				const row0 = panelRows()[0];
				const lost = row0.applied.dealt;
				// desfazer a linha 0
				await panelClick("ritual-area-undo", 0);
				const restored = hp(victims[0]);
				const undoState = panelRows()[0].state;
				// ignorar a linha 1 e reativar
				await panelClick("ritual-area-ignore", 1);
				const ignored = panelRows()[1].state;
				await panelClick("ritual-area-restore", 1);
				const reactivated = panelRows()[1].state;
				// editar o dano da linha 2 para 1 e aplicar
				await handleAreaPanelAction(panelMsg.id, "ritual-area-edit", { row: 2, part: 0, value: 1 });
				const edited = panelRows()[2].parts[0].amount;
				const hp2 = hp(victims[2]);
				await panelClick("ritual-area-apply", 2);
				const lostEdited = hp2 - hp(victims[2]);
				add("FC-L7d", "Desfazer devolve o PV; Ignorar e Reativar funcionam; Editar dano aplica o valor editado", restored === hpFull[0] + lost && undoState === "pending" && ignored === "ignored" && reactivated === "pending" && edited === 1 && lostEdited === 1,
					`desfeito: PV ${hpFull[0]} → ${restored} (perdeu ${lost}); ignorar=${ignored}; reativar=${reactivated}; dano editado=${edited}, perdeu ${lostEdited}`);
			});
			await guard("FC-L7c", "Aplicar em todos", async () => {
				if (!panelMsg) throw new Error("depende do FC-L7");
				// estado: linha 0 pendente (desfeita), 1 pendente, 2 aplicada com dano editado; ignora a 1 para provar que ela fica de fora
				await panelClick("ritual-area-ignore", 1);
				const hpBefore = victims.map(hp);
				await panelClick("ritual-area-apply-all");
				const hpAfter = victims.map(hp);
				const rows = panelRows();
				add("FC-L7c", "Aplicar em todos aplica só os pendentes; ignorado e já aplicado ficam como estão", hpAfter[0] < hpBefore[0] && hpAfter[1] === hpBefore[1] && hpAfter[2] === hpBefore[2] && rows[0].state === "applied" && rows[1].state === "ignored" && rows[2].state === "applied", `PV ${hpBefore.join("/")} → ${hpAfter.join("/")}; estados ${rows.map((row) => row.state).join(",")}`);
			});
			await guard("FC-L7e", "Adicionar alvo", async () => {
				if (!panelMsg) throw new Error("depende do FC-L7");
				const extra = await at("ZZ extra fora da área", cc.col + 12, cc.row + 8, "fail");
				const rowsBefore = panelRows().length;
				const run = handleAreaPanelAction(panelMsg.id, "ritual-area-add", {});
				const dlg = await waitFor(() => dialogByTitle("Adicionar alvo"));
				if (!dlg) throw new Error("a janela de adicionar alvo não abriu");
				dlg.querySelector("select[name=tokenId]").value = extra.id;
				dlg.querySelector("button[data-action=ok]")?.click();
				await within(run);
				await pause(800);
				const rows = panelRows();
				const added = rows.at(-1);
				add("FC-L7e", "Adicionar alvo inclui um token fora da área com resistência rolada na hora", rows.length === rowsBefore + 1 && added.name === "ZZ extra fora da área" && Boolean(added.save) && added.state === "pending", `linhas ${rowsBefore} → ${rows.length}; nova=${added?.name}; resistência=${JSON.stringify(added?.save)}`);
				await extra.document.delete();
			});
			await guard("FC-L7f", "Visão do jogador", async () => {
				if (!panelMsg) throw new Error("depende do FC-L7");
				const player = game.users.find((user) => !user.isGM && user.name === "QA1") ?? game.users.find((user) => !user.isGM);
				const visibleToPlayer = panelMsg.testUserPermission?.(player, "OBSERVER") && (panelMsg.whisper.length === 0 || panelMsg.whisper.includes(player.id));
				const fresh = game.messages.contents.filter((message) => message.timestamp >= panelMsg.timestamp - 60000);
				const summary = fresh.filter((message) => /Paradoxo na área/.test(message.content ?? "")).at(-1);
				const lines = fresh.filter((message) => /sofreu .* de dano/.test(message.content ?? ""));
				add("FC-L7f", "Jogador não vê o painel e o chat público não recebe mensagem de ação do Mestre (nem resumo da área nem 'sofreu N de dano')", !visibleToPlayer && !summary && lines.length === 0,
					`jogador vê o painel=${Boolean(visibleToPlayer)}; resumo público=${Boolean(summary)}; linhas públicas de dano=${lines.length}`);
				for (const token of victims) await token.document.delete().catch(() => {});
				await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === "Paradoxo").map((region) => region.id));
			});

			/* ---- FC-L7g: o modo automático antigo continua valendo ---- */
			await guard("FC-L7g", "Modo automático", async () => {
				globalThis.__opAreaApplyOverride = "automatic";
				try {
					const item = await ensureRitual(caster, "Paradoxo");
					const victim = await at("ZZ automático", cc.col + 6, cc.row + 3, "fail");
					const known = knownIds();
					const hpBefore = hp(victim);
					const run = castRitualFast(caster, item, { skipConfirm: true });
					await waitFor(() => aimReady() && document.querySelector(".ritual-area-banner"));
					const canvasEl = canvas.app.canvas ?? canvas.app.view;
					const c = canvas.clientCoordinatesFromCanvas(cell(cc.col + 6, cc.row + 3));
					canvasEl.dispatchEvent(new PointerEvent("pointermove", { clientX: c.x, clientY: c.y, button: 0, shiftKey: true, bubbles: true, cancelable: true }));
					await pause(250);
					await resendUntilDone(run, () => canvasEl.dispatchEvent(new PointerEvent("pointerdown", { clientX: c.x, clientY: c.y, button: 0, shiftKey: true, bubbles: true, cancelable: true })));
					await settle(known, caster);
					await pause(1500);
					const panel = game.messages.contents.some((message) => !known.has(message.id) && message.getFlag(SYSTEM, "ritualAreaPanel"));
					add("FC-L7g", "areaApply = automatic reproduz o comportamento antigo (aplica na hora, sem painel)", hp(victim) < hpBefore && !panel, `PV ${hpBefore} → ${hp(victim)}; painel criado=${panel}`);
					await victim.document.delete();
					await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === "Paradoxo").map((region) => region.id));
				} finally {
					globalThis.__opAreaApplyOverride = "manual";
				}
			});

			/* ---- FC-L15b: contagem de cliques do buff (ficha ✦ + Conjurar = 2) ---- */
			await guard("FC-L15", "Cliques do buff", async () => {
				const item = await ensureRitual(caster, "Amaldiçoar Arma - Sangue");
				await openSheet(caster);
				setTargets([allyBToken]);
				const known = knownIds();
				let clicks = 0;
				const row = sheetRow(caster, item);
				const castButton = row.querySelector("a.item-cast");
				clicks += 1;
				castButton.click();
				const dlg = await waitFor(() => castCard());
				const enabled = !dlg.querySelector('[data-action="conjure"]').disabled;
				clicks += 1;
				clickIn(dlg, '[data-action="conjure"]');
				const card = await settle(known, caster);
				const onB = [...allyB.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse).length;
				add("FC-L15", "Buff com alvo marcado: ✦ + Conjurar = 2 cliques", clicks === 2 && enabled && castStatus(card) === "resolved" && onB >= 1, `cliques=${clicks}; carta=${castStatus(card)}; efeitos no aliado=${onB}`);
				setTargets([]);
			});
		}, { agents: ["Agente NEX 50 — Ocultista", "Agente NEX 25 — Analista", "Agente NEX 75 — Vanguarda", "Agente NEX 05 — Recruta"], areaApply: "manual" });
	} finally {
		await game.settings.set(SYSTEM, FLOW_SETTING.confirmSpend, confirmBefore).catch(() => {});
		await game.settings.set(SYSTEM, FLOW_SETTING.nameClick, nameBefore).catch(() => {});
		if (!withoutSanity) await game.settings.set(SYSTEM, "globalPlayingWithoutSanity", false);
	}
	const failed = results.filter((entry) => !entry.ok);
	console.log(`Fluxo rápido: ${results.length - failed.length}/${results.length} passaram`, failed.map((entry) => `${entry.id} ${entry.caso}: ${entry.detalhe.slice(0, 300)}`));
	return results;
}
