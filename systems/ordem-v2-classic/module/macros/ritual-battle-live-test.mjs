// Testes ao vivo de combate com rituais: condições com efeito mecânico, seleção de alvos e área pelo chat, e uma batalha
// com agentes de NEX variados. Roda numa cena temporária com cópias dos agentes (ver ritual-live-arena.mjs).
//
//   const t = await import("/systems/ordem-v2-classic/module/macros/ritual-battle-live-test.mjs");
//   await t.runBattleTests();                 // tudo
//   await t.runBattleTests({ only: "CD" });    // por prefixo: CD = condições, TG = alvos/área, BT = batalha
//
// Devolve uma tabela { id, caso, ok, detalhe }.

import { areaRuleFor } from "./ritual-area-rules.mjs";
import { applyCondition } from "./ritual-area-engine.mjs";
import { runRitualCasterMacro } from "./ritual-caster.mjs";
import { withArena, DEFAULT_AGENTS } from "./ritual-live-arena.mjs";
import { activeConditions, conditionDicePenalty } from "../helpers/conditions.mjs";

const SYSTEM = "ordem-v2-classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hp = (token) => Number(token.actor.system.attributes.hp.value);

/* -------------------------------------------- */
/*  Ferramentas                                 */
/* -------------------------------------------- */

const ALL_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];

/** Deixa a ameaça sem RD/imunidade e com as resistências forçadas (pass = sempre passa, fail = sempre falha). */
async function tuneThreat(token, mode = "normal") {
	const update = { "system.genericRd": { value: 0, except: [] } };
	for (const type of ALL_TYPES) {
		update[`system.resistances.${type}.value`] = 0;
		update[`system.resistances.${type}.vulnerable`] = false;
		update[`system.resistances.${type}.immune`] = false;
	}
	if (mode !== "normal") {
		for (const skill of ["resilience", "reflexes", "will", "fighting"]) update[`system.skills.${skill}.value`] = mode === "pass" ? 100 : -100;
	}
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
	const pack = game.packs.get("ordem-v2-classic.armaments");
	const entry = pack.index.find((doc) => doc.name === name);
	if (!entry) throw new Error(`Arma "${name}" não existe no compêndio.`);
	const doc = await pack.getDocument(entry._id);
	[item] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	return item;
}

const dialogs = () => [...document.querySelectorAll(".application")];
const dialogByTitle = (title) => dialogs().find((entry) => entry.querySelector(".window-title")?.innerText?.startsWith(title));

async function waitFor(check, { timeout = 15000, step = 150 } = {}) {
	const t0 = Date.now();
	while (Date.now() - t0 < timeout) {
		const value = await check();
		if (value) return value;
		await pause(step);
	}
	return null;
}

/** Evento de ponteiro de verdade no elemento do canvas, no ponto (x, y) da cena (a área é posicionada por eventos do DOM). */
function domPointer(type, x, y) {
	const client = canvas.clientCoordinatesFromCanvas({ x, y });
	(canvas.app.canvas ?? canvas.app.view).dispatchEvent(new PointerEvent(type, { clientX: client.x, clientY: client.y, button: 0, shiftKey: true, bubbles: true, cancelable: true }));
}

/** Marca exatamente estes tokens como alvos do usuário. */
function setTargets(tokens) {
	game.user.targets.forEach((token) => token.setTarget(false, { releaseOthers: false }));
	tokens.forEach((token, i) => token.setTarget(true, { releaseOthers: false, groupSelection: false, user: game.user }));
}

/**
 * Conjura um ritual pela macro, clicando na janela como um jogador.
 * @param {object} p
 * @param {{actor:Actor, token:Token}} p.agent
 * @param {string} p.ritual              nome do ritual
 * @param {"basic"|"student"|"true"} [p.form]
 * @param {Token[]} [p.targets]          alvos marcados antes de conjurar
 * @param {null|{x:number,y:number}|"cancel"} [p.area]  ponto onde clicar para posicionar a área, ou "cancel"
 * @returns {Promise<{blocked:boolean, card:ChatMessage|null, pdSpent:number, warnings:string[]}>}
 */
async function castRitual({ agent, ritual, form = "basic", targets = [], area = null }) {
	const { actor, token } = agent;
	const item = await ensureRitual(actor, ritual);
	canvas.tokens.activate();
	token.control({ releaseOthers: true });
	setTargets(targets);
	await pause(200);
	const pdBefore = Number(actor.system.PD.value);
	const known = new Set(game.messages.contents.map((message) => message.id));
	document.querySelectorAll("#notifications .notification").forEach((node) => node.remove());
	const warnings = [];
	const hook = Hooks.on("renderNotifications", () => {});
	// registra os avisos direto na chamada (ler o DOM perde os avisos de vida curta)
	const originals = {};
	for (const level of ["info", "warn", "error"]) {
		originals[level] = ui.notifications[level];
		ui.notifications[level] = function (message, ...rest) {
			warnings.push(String(message));
			return originals[level].call(this, message, ...rest);
		};
	}
	const watch = { disconnect: () => { for (const level of Object.keys(originals)) ui.notifications[level] = originals[level]; } };
	const macro = runRitualCasterMacro(actor, item.id);
	let done = false;
	macro.finally(() => { done = true; });

	const dlg = await waitFor(() => dialogByTitle("Conjurar Ritual") ?? (done ? "closed" : null));
	if (dlg === "closed") {
		// a macro terminou sem abrir a janela (ex.: Silenciado bloqueia antes): conta como bloqueada, com os avisos
		watch.disconnect();
		Hooks.off("renderNotifications", hook);
		return { blocked: true, card: null, pdSpent: pdBefore - Number(actor.system.PD.value), warnings: [...new Set(warnings)] };
	}
	if (!dlg) { watch.disconnect(); throw new Error("A janela de conjuração não abriu."); }
	[...dlg.querySelectorAll("button")].find((button) => button.innerText.includes(ritual))?.click();
	await pause(500);
	if (form !== "basic") {
		const radio = dlg.querySelector(`input[name="ritualForm"][value="${form}"]`);
		if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
		await pause(400);
	}
	const conjure = dlg.querySelector("[data-action=conjure]");
	if (conjure?.disabled) {
		const reason = dlg.innerText.replace(/\s+/g, " ").slice(-200);
		dlg.querySelector("[data-action=cancel]")?.click();
		watch.disconnect();
		Hooks.off("renderNotifications", hook);
		return { blocked: true, card: null, pdSpent: 0, warnings: [`botão desabilitado: ${reason}`] };
	}
	conjure.click();

	// o resto do fluxo: posicionar a área, rolar os testes e esperar a resolução
	let placed = false;
	for (let i = 0; i < 80 && !done; i++) {
		if (area && !placed && canvas.templates.preview.children.length && (canvas.app.canvas ?? canvas.app.view).dataset.placingArea) {
			if (area === "cancel") {
				document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			} else {
				domPointer("pointermove", area.x, area.y);
				await pause(250);
				const warningsBefore = warnings.length;
				domPointer("pointerdown", area.x, area.y);
				// clique fora do alcance é recusado: dá um instante para ver se a prévia continua
				await pause(400);
				if (!canvas.templates.preview.children.length) placed = true;
				else if (area.retryAt) {
					// o clique "longe" tem de produzir o aviso de recusa; se o evento se perdeu (nada mudou), manda de novo antes de seguir
					if (warnings.length === warningsBefore && (area.lost = (area.lost ?? 0) + 1) <= 3) continue;
					area = area.retryAt;
					continue;
				}
			}
			if (area === "cancel") placed = true;
		}
		const roll = dialogByTitle("Teste de");
		if (roll) [...roll.querySelectorAll("button")].find((button) => button.dataset.action === "normal")?.click();
		await pause(300);
	}
	// a macro pode ficar parada num diálogo ou na mira que o teste não respondeu: sem prazo o teste esperaria para sempre
	const macroEnded = await Promise.race([macro.catch(() => {}).then(() => true), pause(60000).then(() => false)]);
	if (!macroEnded) warnings.push("TRAVADO: a macro não terminou em 60 s (diálogo ou mira sem resposta)");
	await pause(2500);
	// espera a resolução automática (Mestre) terminar
	const settle = await waitFor(() => {
		const messages = game.messages.contents.filter((message) => !known.has(message.id) && message.getFlag(SYSTEM, "ritualCast"));
		const card = messages.at(-1);
		return !card || !["effects", "rolling"].includes(card.getFlag(SYSTEM, "ritualCast")?.status) ? true : null;
	}, { timeout: 20000 });
	void settle;
	watch.disconnect();
	Hooks.off("renderNotifications", hook);
	const card = game.messages.contents.filter((message) => !known.has(message.id) && message.getFlag(SYSTEM, "ritualCast")).at(-1) ?? null;
	return { blocked: !card, card, pdSpent: pdBefore - Number(actor.system.PD.value), warnings: [...new Set(warnings)] };
}

const cardStatus = (card) => card?.getFlag(SYSTEM, "ritualCast")?.status;
const cardText = (card) => card?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
const buttonsOf = (card) => [...(card?.content.matchAll(/data-action="([^"]+)"/g) ?? [])].map((match) => match[1]);

/** Clica num botão da carta do chat (o mesmo que o jogador faria). */
async function clickCardButton(card, action) {
	const node = document.querySelector(`.message[data-message-id="${card.id}"] [data-action="${action}"]`) ?? document.querySelector(`[data-action="${action}"]`);
	if (!node) throw new Error(`Botão ${action} não encontrado na carta.`);
	node.click();
	await pause(1200);
}

/* -------------------------------------------- */
/*  CD — condições com efeito mecânico          */
/* -------------------------------------------- */

const dicePart = (formula) => Number(String(formula).match(/^(\d+)d20/)?.[1] ?? 0);
const normalizeDice = (formula) => {
	const m = String(formula).match(/^(\d+)d20(kh|kl)?/);
	return m ? { n: Number(m[1]), mode: m[2] ?? "" } : { n: 0, mode: "" };
};

async function rollFormula(actor, skill) {
	const rolls = await actor.rollSkill({ skill, rolls: [{ options: { target: null } }] }, { configure: false }, { create: false });
	const roll = Array.isArray(rolls) ? rolls[0] : rolls;
	return roll?.formula ?? "";
}

async function bleedStackCases(arena, add) {
	const [{ token: agentToken }] = arena.agents;
	const origin = { zoneId: null, itemId: "teste", itemUuid: null };
	// SG-01/02: Sangrando acumula (2 aplicações = 1 efeito ×2; falha custa 2d6; passar estanca tudo)
	for (const [id, label, mode] of [["SG-01", "Sangrando ×2: falhou em Vigor, perde 2d6 PV e segue ×2", "fail"], ["SG-02", "Sangrando ×2: passou em Vigor e estanca tudo", "pass"]]) {
		const target = await arena.mkThreat(`ZZ sangra x2 ${mode}`, 2200, 900);
		await tuneThreat(target, mode);
		await applyCondition(target.actor, { key: "bleeding" }, origin);
		await applyCondition(target.actor, { key: "bleeding" }, origin);
		const effects = activeConditions(target.actor, "bleeding");
		const stacksBefore = effects[0]?.getFlag(SYSTEM, "condition")?.stacks;
		const known = new Set(game.messages.contents.map((message) => message.id));
		const before = hp(target);
		await withCombat(arena, [agentToken, target], async (combat) => {
			await advanceTo(combat, target.id);
			await pause(2200);
		});
		const lost = before - hp(target);
		const left = activeConditions(target.actor, "bleeding");
		const formula = game.messages.contents.find((message) => !known.has(message.id) && /Sangrando ×2/.test(message.flavor ?? ""))?.rolls?.[0]?.formula;
		const setup = effects.length === 1 && stacksBefore === 2;
		const ok = setup && (mode === "fail"
			? lost >= 2 && lost <= 12 && formula === "2d6" && left.length === 1 && left[0].getFlag(SYSTEM, "condition")?.stacks === 2
			: lost === 0 && left.length === 0);
		add(id, label, ok, `efeitos ${effects.length}, acúmulos ${stacksBefore}; PV ${before} → ${hp(target)}; dano ${formula ?? "—"}; ainda sangrando: ${left.length}`);
		await target.document.delete();
	}
}

async function conditionCases(arena, add) {
	const [{ actor: agent, token: agentToken }] = arena.agents;
	const threat = await arena.mkThreat("ZZ ameaça", 1600, 900);
	await tuneThreat(threat);
	const origin = { zoneId: null, itemId: "teste", itemUuid: null };

	// CD-01 Vulnerável: -2 na Defesa
	{
		const before = threat.actor.system.defense.value;
		await applyCondition(threat.actor, { label: "Vulnerável", rounds: 2 }, origin);
		const during = threat.actor.system.defense.value;
		await activeConditions(threat.actor).forEach((effect) => effect.delete());
		await pause(200);
		add("CD-01", "Vulnerável: Defesa -2 (e volta ao normal ao sair)", during === before - 2 && threat.actor.system.defense.value === before, `Defesa ${before} → ${during} → ${threat.actor.system.defense.value}`);
	}
	// CD-02 Atordoado: -5 Defesa e -1d20 em Reflexos
	{
		const base = normalizeDice(await rollFormula(threat.actor, "reflexes"));
		const defBefore = threat.actor.system.defense.value;
		await applyCondition(threat.actor, { key: "stun", rounds: 1 }, origin);
		const penalized = normalizeDice(await rollFormula(threat.actor, "reflexes"));
		const defense = threat.actor.system.defense.value;
		const expectedDice = base.n - 1 < 1 ? { n: 2, mode: "kl" } : { n: base.n - 1 };
		const diceOk = penalized.n === expectedDice.n && (!expectedDice.mode || penalized.mode === expectedDice.mode);
		await activeConditions(threat.actor).forEach((effect) => effect.delete());
		await pause(200);
		add("CD-02", "Atordoado: Defesa -5 e -1d20 em Reflexos", defense === defBefore - 5 && diceOk, `Defesa ${defBefore} → ${defense}; Reflexos ${base.n}d20${base.mode} → ${penalized.n}d20${penalized.mode}`);
	}
	// CD-03 Surdo: -2d20 em Iniciativa
	{
		const baseInit = normalizeDice(await rollFormula(agent, "initiative"));
		await applyCondition(agent, { key: "deaf" }, origin);
		const init = normalizeDice(await rollFormula(agent, "initiative"));
		await activeConditions(agent).forEach((effect) => effect.delete());
		await pause(200);
		const effective = (r) => (r.mode === "kl" ? -r.n + 2 : r.n); // 2d20kl equivale a 0 dados
		const expected = Math.max(baseInit.n - 2, 0);
		add("CD-03", "Surdo: -2d20 em Iniciativa", (init.n === Math.max(baseInit.n - 2, 1) || init.mode === "kl") && conditionDicePenalty(agent, "initiative") === 0, `Iniciativa ${baseInit.n}d20${baseInit.mode} → ${init.n}d20${init.mode} (esperado ${expected} dado(s))`);
		void effective;
	}
	// CD-04 Agarrado: -1d20 nos ataques
	{
		const weapon = await ensureWeapon(agent, "Revólver");
		const dex = agent.system.attributes[weapon.system.formulas.attack.attr].value;
		// alvo colado no agente: além do alcance o ataque já perde 1d20 e contaminaria a conta
		const attackTarget = await arena.mkThreat("ZZ alvo do ataque", agentToken.center.x + 150, agentToken.center.y);
		setTargets([attackTarget]);
		const known = new Set(game.messages.contents.map((message) => message.id));
		await weapon.rollAttack();
		await pause(800);
		const baseRoll = game.messages.contents.filter((message) => !known.has(message.id) && message.rolls.length).at(0)?.rolls[0];
		await applyCondition(agent, { key: "restrain" }, origin);
		const known2 = new Set(game.messages.contents.map((message) => message.id));
		await weapon.rollAttack();
		await pause(800);
		const grabRoll = game.messages.contents.filter((message) => !known2.has(message.id) && message.rolls.length).at(0)?.rolls[0];
		await activeConditions(agent).forEach((effect) => effect.delete());
		await attackTarget.document.delete();
		const a = normalizeDice(baseRoll?.formula ?? "");
		const b = normalizeDice(grabRoll?.formula ?? "");
		const expectedN = dex - 1 < 1 ? 2 : dex - 1;
		add("CD-04", "Agarrado: -1d20 no ataque", a.n === (dex < 1 ? 2 : dex) && b.n === expectedN, `atributo ${dex}: ataque ${baseRoll?.formula} → ${grabRoll?.formula}`);
	}
	// CD-05 Sem recuperar PV
	{
		await applyCondition(threat.actor, { label: "Sem recuperar PV (1 rodada)", rounds: 1 }, origin);
		await threat.actor.update({ "system.attributes.hp.value": 100 });
		await threat.actor.update({ "system.attributes.hp.value": 150 });
		const blocked = hp(threat);
		await activeConditions(threat.actor).forEach((effect) => effect.delete());
		await pause(200);
		await threat.actor.update({ "system.attributes.hp.value": 150 });
		add("CD-05", "Sem recuperar PV: a cura é bloqueada", blocked === 100 && hp(threat) === 150, `tentou ir de 100 para 150: ficou ${blocked}; depois de remover a condição: ${hp(threat)}`);
		await threat.actor.update({ "system.attributes.hp.value": 9999 });
	}
	// CD-06 Silenciado bloqueia a conjuração
	const nearTarget = await arena.mkThreat("ZZ alvo da conjuração", agentToken.center.x + 300, agentToken.center.y);
	await tuneThreat(nearTarget, "fail");
	{
		await applyCondition(agent, { key: "silence" }, origin);
		const result = await castRitual({ agent: arena.agents[0], ritual: "Esfolar", targets: [nearTarget] });
		await activeConditions(agent).forEach((effect) => effect.delete());
		add("CD-06", "Silenciado: não conjura ritual (nada é gasto)", result.blocked && result.pdSpent === 0 && /Silenciado/.test(result.warnings.join(" ")), `PD gasto ${result.pdSpent}; avisos: ${result.warnings.join(" | ")}`);
	}
	// CD-07 Surdo: conjurar exige teste de Vontade (condição ruim)
	{
		await applyCondition(agent, { key: "deaf" }, origin);
		const result = await castRitual({ agent: arena.agents[0], ritual: "Esfolar", targets: [nearTarget] });
		await activeConditions(agent).forEach((effect) => effect.delete());
		add("CD-07", "Surdo: conjurar rola Vontade de concentração", /Concentração[ ,(]+Vontade/.test(cardText(result.card)), cardText(result.card).slice(0, 220));
	}
	await threat.document.delete();
	await nearTarget.document.delete();

	// CD-08..CD-10: efeitos que agem no turno de quem os carrega (precisa de combate)
	for (const [id, label, mode] of [["CD-08", "Sangrando: falhou em Vigor, perde 1d6 PV e continua sangrando", "fail"], ["CD-09", "Sangrando: passou em Vigor e estanca", "pass"]]) {
		const target = await arena.mkThreat(`ZZ sangra ${mode}`, 2200, 900);
		await tuneThreat(target, mode);
		await applyCondition(target.actor, { key: "bleeding" }, origin);
		const before = hp(target);
		await withCombat(arena, [agentToken, target], async (combat) => {
			await advanceTo(combat, target.id);
			await pause(2200);
		});
		const lost = before - hp(target);
		const stillBleeding = activeConditions(target.actor, "bleeding").length > 0;
		const ok = mode === "fail" ? lost >= 1 && lost <= 6 && stillBleeding : lost === 0 && !stillBleeding;
		add(id, label, ok, `PV ${before} → ${hp(target)}; ainda sangrando: ${stillBleeding}`);
		await target.document.delete();
	}
	{
		const target = await arena.mkThreat("ZZ atordoado", 2200, 1100);
		const other = await arena.mkThreat("ZZ outro", 2400, 1100);
		await applyCondition(target.actor, { key: "stun", rounds: 3 }, origin);
		const visited = [];
		await withCombat(arena, [agentToken, target, other], async (combat) => {
			const hook = Hooks.on("combatTurnChange", (_c, _p, current) => visited.push(current?.tokenId));
			await advanceTo(combat, other.id);
			await pause(1500);
			Hooks.off("combatTurnChange", hook);
		});
		add("CD-10", "Atordoado: perde o turno (o combate pula quem não pode agir)", visited.includes(target.id) && visited.at(-1) === other.id, `passou pelos tokens: ${visited.map((id) => canvas.tokens.get(id)?.name ?? id).join(" → ")}`);
		await target.document.delete();
		await other.document.delete();
	}
	{
		const target = await arena.mkThreat("ZZ expira", 2200, 700);
		await tuneThreat(target);
		let expired = false;
		await withCombat(arena, [agentToken, target], async (combat) => {
			await applyCondition(target.actor, { label: "Enjoado", rounds: 1 }, origin);
			const has = () => activeConditions(target.actor, "nauseated").length > 0;
			const startedWith = has();
			// rodada 1: agente, ameaça; rodada 2: agente, ameaça → no início do turno da ameaça na rodada 2 a condição já venceu
			await advanceTo(combat, target.id);
			await pause(800);
			const roundOneStill = has();
			await combat.nextTurn(); await pause(900);
			await advanceTo(combat, target.id);
			await pause(1500);
			expired = startedWith && roundOneStill && !has();
		});
		add("CD-11", "Condição com duração em rodadas vence sozinha", expired, expired ? "durou a rodada da conjuração e saiu no turno seguinte" : "não expirou como esperado");
		await target.document.delete();
	}
}

/* -------------------------------------------- */
/*  Combate                                     */
/* -------------------------------------------- */

async function withCombat(arena, tokens, fn) {
	const combat = await Combat.create({ scene: arena.scene.id, active: true });
	const docs = tokens.map((token, i) => ({ tokenId: token.id, sceneId: arena.scene.id, actorId: token.actor.id, initiative: 100 - i * 10 }));
	await combat.createEmbeddedDocuments("Combatant", docs);
	await pause(300);
	try {
		await combat.startCombat();
		await pause(700);
		return await fn(combat);
	} finally {
		await combat.delete().catch(() => {});
	}
}

async function advanceTo(combat, tokenId, limit = 14) {
	for (let i = 0; i < limit; i++) {
		if (combat.combatant?.tokenId === tokenId) return true;
		await combat.nextTurn();
		await pause(1700);
	}
	return combat.combatant?.tokenId === tokenId;
}

/* -------------------------------------------- */
/*  TG — seleção de alvos e de área             */
/* -------------------------------------------- */

const cell = (col, row) => ({ x: col * 100 + 50, y: row * 100 + 50 });

async function targetingCases(arena, add) {
	const agent = arena.agents[0];
	const at = (name, col, row, mode = "normal") => arena.mkThreat(name, cell(col, row).x, cell(col, row).y).then(async (token) => { await tuneThreat(token, mode); return token; });
	const caster = agent.token;
	const cc = { col: Math.round(caster.document.x / 100), row: Math.round(caster.document.y / 100) };
	const clear = async (tokens) => { for (const token of tokens) await token.document.delete().catch(() => {}); };

	// TG-01 sem alvo marcado: a carta traz o botão; sem marcar não faz nada; marcando, resolve
	{
		const a = await at("ZZ alvo A", cc.col + 3, cc.row + 3, "fail");
		const result = await castRitual({ agent, ritual: "Esfolar", targets: [] });
		const buttons = buttonsOf(result.card);
		const waiting = cardStatus(result.card) === "needsTargets";
		setTargets([]);
		await clickCardButton(result.card, "ritual-area-roll");
		const stillWaiting = cardStatus(game.messages.get(result.card.id)) === "needsTargets";
		setTargets([a]);
		const before = hp(a);
		await clickCardButton(result.card, "ritual-area-roll");
		await pause(2500);
		const final = game.messages.get(result.card.id);
		add("TG-01", "Sem alvo marcado: botão 'Selecionar alvos e rolar dano'", waiting && buttons.includes("ritual-area-roll") && stillWaiting && cardStatus(final) === "resolved" && hp(a) < before,
			`botões ${buttons.join(",")}; esperando=${waiting}; clique sem alvo manteve a carta=${stillWaiting}; depois status=${cardStatus(final)}; PV ${before} → ${hp(a)}`);
		await clear([a]);
	}
	// TG-02 marcou alvos demais: bloqueia antes de pagar
	{
		const [a, b] = [await at("ZZ alvo B1", cc.col + 3, cc.row + 2), await at("ZZ alvo B2", cc.col + 3, cc.row + 4)];
		const result = await castRitual({ agent, ritual: "Esfolar", targets: [a, b] });
		add("TG-02", "Ritual de 1 alvo com 2 marcados: bloqueado, nada gasto", result.blocked && result.pdSpent === 0 && result.warnings.some((w) => /no máximo 1 alvo/.test(w)), `PD gasto ${result.pdSpent}; avisos: ${result.warnings.join(" | ")}`);
		await clear([a, b]);
	}
	// TG-03 fora do alcance (curto = 9 m = 6 quadrados)
	{
		const near = await at("ZZ perto", cc.col + 5, cc.row, "fail");
		const far = await at("ZZ longe", cc.col + 14, cc.row);
		const blocked = await castRitual({ agent, ritual: "Esfolar", targets: [far] });
		const ok = await castRitual({ agent, ritual: "Esfolar", targets: [near] });
		add("TG-03", "Alcance curto (9 m): alvo a 5 quadrados vale, alvo a 14 não", blocked.blocked && blocked.pdSpent === 0 && /fora do alcance/.test(blocked.warnings.join(" ")) && cardStatus(ok.card) === "resolved", `longe: bloqueado=${blocked.blocked} (${blocked.warnings.join(" | ")}); perto: ${cardStatus(ok.card)}`);
		await clear([near, far]);
	}
	// TG-04 toque: só no espaço ao lado
	{
		const adjacent = await at("ZZ colado", cc.col + 1, cc.row, "fail");
		const two = await at("ZZ a dois", cc.col + 4, cc.row);
		const blocked = await castRitual({ agent, ritual: "Decadência", targets: [two] });
		const ok = await castRitual({ agent, ritual: "Decadência", targets: [adjacent] });
		add("TG-04", "Alcance toque: só o alvo ao lado (não 9 m)", blocked.blocked && /fora do alcance \(toque\)/.test(blocked.warnings.join(" ")) && cardStatus(ok.card) === "resolved", `a 3 quadrados: bloqueado=${blocked.blocked} (${blocked.warnings.join(" | ")}); ao lado: ${cardStatus(ok.card)}`);
		await clear([adjacent, two]);
	}
	// TG-05 vários alvos: Desfazer Sinapses discente (até 5 seres, alcance longo)
	{
		const six = [];
		for (let i = 0; i < 6; i++) six.push(await at(`ZZ vários ${i + 1}`, cc.col + 4 + (i % 3), cc.row + 2 + Math.floor(i / 3) * 2));
		const blocked = await castRitual({ agent, ritual: "Desfazer Sinapses", form: "student", targets: six });
		const five = await castRitual({ agent, ritual: "Desfazer Sinapses", form: "student", targets: six.slice(0, 5) });
		add("TG-05", "Até 5 seres: 6 marcados bloqueia, 5 passa", blocked.blocked && /no máximo 5 alvos/.test(blocked.warnings.join(" ")) && !five.blocked, `6 marcados: bloqueado=${blocked.blocked} (${blocked.warnings.join(" | ")}); 5 marcados: ${five.blocked ? "bloqueado" : cardStatus(five.card)}`);
		await clear(six);
	}
	// TG-06 área posicionada pelo mapa, dentro do alcance (Paradoxo médio = 18 m = 12 quadrados), com clique fora recusado
	{
		const inside = await at("ZZ na área", cc.col + 8, cc.row + 3, "fail");
		const point = cell(cc.col + 8, cc.row + 3);
		const result = await castRitual({ agent, ritual: "Paradoxo", area: { ...point, retryAt: point }, targets: [] });
		add("TG-06", "Área colocada pelo mapa: a ameaça dentro leva dano e faz resistência", cardStatus(result.card) === "resolved" && hp(inside) < 9999 && /falhou/.test(cardText(result.card)), `${cardStatus(result.card)}; PV ${hp(inside)}; ${cardText(result.card).slice(0, 700)}`);
		await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === "Paradoxo").map((region) => region.id));
		await clear([inside]);
	}
	// TG-07 clique fora do alcance é recusado; o jogador então clica dentro
	{
		const inside = await at("ZZ alvo da área", cc.col + 9, cc.row + 4, "fail");
		const far = cell(cc.col + 25, cc.row + 4);
		const good = cell(cc.col + 9, cc.row + 4);
		const result = await castRitual({ agent, ritual: "Paradoxo", area: { ...far, retryAt: good }, targets: [] });
		add("TG-07", "Clique fora do alcance (18 m) é recusado; clicando dentro, vale", /Fora do alcance/.test(result.warnings.join(" ")) && cardStatus(result.card) === "resolved" && hp(inside) < 9999, `avisos: ${result.warnings.join(" | ")}; ${cardStatus(result.card)}; PV ${hp(inside)}`);
		await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === "Paradoxo").map((region) => region.id));
		await clear([inside]);
	}
	// TG-08 sem posicionar a área: a carta traz 'Selecionar área'; o botão posiciona e resolve
	{
		const inside = await at("ZZ alvo tardio", cc.col + 6, cc.row + 5, "fail");
		const spot = cell(cc.col + 6, cc.row + 5);
		const result = await castRitual({ agent, ritual: "Paradoxo", area: "cancel", targets: [] });
		const waiting = cardStatus(result.card) === "needsTargets" && buttonsOf(result.card).includes("ritual-area-place");
		const before = hp(inside);
		// o clique no botão abre a prévia; posicionamos como no mapa
		const click = clickCardButton(result.card, "ritual-area-place");
		// a mira só recebe eventos depois de registrar os ouvintes (marca data-placing-area): espera a marca e reenvia o clique até a carta resolver
		await waitFor(() => (canvas.app.canvas ?? canvas.app.view).dataset.placingArea === "true");
		domPointer("pointermove", spot.x, spot.y);
		await pause(250);
		let clicked = false;
		click.finally(() => { clicked = true; });
		for (let i = 0; i < 8 && !clicked; i++) { domPointer("pointerdown", spot.x, spot.y); await pause(700); }
		await Promise.race([click, pause(60000)]);
		await pause(3500);
		const final = game.messages.get(result.card.id);
		add("TG-08", "Área adiada: botão 'Selecionar área' na carta posiciona e resolve", waiting && cardStatus(final) === "resolved" && hp(inside) < before, `esperando com botão=${waiting}; depois ${cardStatus(final)}; PV ${before} → ${hp(inside)}`);
		await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === "Paradoxo").map((region) => region.id));
		await clear([inside]);
	}
	// TG-09 área centrada no conjurador (Decadência verdadeiro): sem clique
	{
		const near = await at("ZZ perto do conjurador", cc.col + 2, cc.row + 1, "fail");
		const result = await castRitual({ agent, ritual: "Decadência", form: "true", targets: [] });
		add("TG-09", "Explosão centrada no conjurador: sem clique, atinge quem está em volta", cardStatus(result.card) === "resolved" && hp(near) < 9999, `${cardStatus(result.card)}; PV ${hp(near)}`);
		await canvas.scene.deleteEmbeddedDocuments("Region", canvas.scene.regions.filter((region) => region.name === "Decadência").map((region) => region.id));
		await clear([near]);
	}
}

/* -------------------------------------------- */
/*  BT — batalha com vários agentes             */
/* -------------------------------------------- */

async function battleCase(arena, add) {
	const names = ["Zumbi de Sangue", "Bandido VD 10", "Capanga VD 20", "Policial VD 20", "Assassino VD 80"];
	const cols = [4, 6, 8, 10, 12];
	const threats = [];
	for (let i = 0; i < names.length; i++) {
		const base = game.actors.getName(names[i]) ? names[i] : "Aberração de Carne";
		const token = await arena.mkThreat(`ZZ ${names[i]}`, cell(cols[i], 7 + (i % 2)).x, cell(cols[i], 7 + (i % 2)).y, { baseName: base, hp: 120 });
		await tuneThreat(token, i % 2 ? "fail" : "normal");
		threats.push(token);
	}
	const errors = [];
	const errorHook = (event) => errors.push(String(event.message ?? event));
	window.addEventListener("error", errorHook);
	const hpStart = threats.map((token) => hp(token));
	const agents = arena.agents;
	// armas: quem tem Mira usa revólver/fuzil, quem tem Luta usa machete
	const weapons = [];
	for (const [i, agent] of agents.entries()) weapons.push(await ensureWeapon(agent.actor, ["Revólver", "Machete", "Fuzil de Assalto", "Revólver", "Fuzil de Assalto"][i]));
	// atributos variados ("upa" a ficha): mais dados nos de NEX alto
	for (const [i, agent] of agents.entries()) {
		await agent.actor.update({ "system.attributes.dex.value": 1 + Math.floor(i / 2) + 1, "system.attributes.str.value": 1 + Math.floor(i / 2) + 1, "system.attributes.int.value": 2 + Math.floor(i / 2), "system.attributes.pre.value": 2 + Math.floor(i / 2) });
	}
	const log = [];
	await withCombat(arena, [...agents.map((agent) => agent.token), ...threats], async (combat) => {
		for (let round = 1; round <= 3; round++) {
			for (const [i, agent] of agents.entries()) {
				const alive = threats.filter((token) => hp(token) > 0);
				if (!alive.length) break;
				await advanceTo(combat, agent.token.id, 16);
				const target = alive[(i + round) % alive.length];
				// 1) ataque com arma
				setTargets([target]);
				const before = hp(target);
				const attack = await weapons[i].rollAttack();
				await pause(600);
				if (attack?.hitResult?.hit !== false) {
					const damage = await weapons[i].rollDamage({ hitResult: attack?.hitResult, critical: attack?.criticalStatus ?? false });
					if (damage) await target.actor.applyDamage(damage.total, { damageType: weapons[i].system.formulas.damage.type });
				}
				log.push(`R${round} ${agent.actor.name.replace("ZZ ", "")} ataca ${target.name}: ${before} → ${hp(target)}`);
				// 2) ritual de área/alvo (quem tem círculo para isso)
				if (i === 2 && round === 1) {
					const point = cell(cols[1], 7);
					const result = await castRitual({ agent, ritual: "Paradoxo", area: { ...point, retryAt: point }, targets: [] });
					log.push(`R${round} ${agent.actor.name.replace("ZZ ", "")} conjura Paradoxo: ${cardStatus(result.card)}`);
				}
				if (i === 3 && round === 2) {
					const near = [...alive].sort((p, q) => Math.hypot(p.center.x - agent.token.center.x, p.center.y - agent.token.center.y) - Math.hypot(q.center.x - agent.token.center.x, q.center.y - agent.token.center.y))[0];
					const result = await castRitual({ agent, ritual: "Esfolar", targets: [near] });
					log.push(`R${round} ${agent.actor.name.replace("ZZ ", "")} conjura Esfolar: ${cardStatus(result.card)}`);
				}
			}
			// as ameaças passam o turno (a ordem do combate continua; zonas/condições disparam)
			await advanceTo(combat, agents[0].token.id, 16);
		}
	});
	window.removeEventListener("error", errorHook);
	const lost = threats.map((token, i) => hpStart[i] - hp(token));
	const totalLost = lost.reduce((sum, n) => sum + n, 0);
	const pdSpent = agents.reduce((sum, agent) => sum + (200 - Number(agent.actor.system.PD.value)), 0);
	const ritualsResolved = log.filter((line) => /conjura .*: resolved$/.test(line)).length;
	const hpNeverUp = threats.every((token) => hp(token) <= 120);
	add("BT-01", "Batalha: 5 agentes (NEX 05 a 99) com armas e rituais contra 5 ameaças, 3 rodadas", totalLost > 0 && errors.length === 0 && log.length >= 10 && pdSpent > 0 && ritualsResolved === 2 && hpNeverUp,
		`dano total nas ameaças ${totalLost} (${lost.join("/")}); PD gasto ${pdSpent}; ${log.length} ações; erros ${errors.length}\n${log.join("\n")}`);
	return log;
}

/* -------------------------------------------- */
/*  Execução                                    */
/* -------------------------------------------- */

export async function runBattleTests({ only = null } = {}) {
	const results = [];
	const wanted = (prefix) => !only || prefix.startsWith(only) || only.startsWith(prefix);
	const add = (id, caso, ok, detalhe) => results.push({ id, caso, ok: !!ok, detalhe });
	// a macro de conjuração só funciona com "Jogando sem Sanidade" (PD); liga durante o teste e devolve o valor do mundo
	const sanityKey = "globalPlayingWithoutSanity";
	const sanityBefore = game.settings.get(SYSTEM, sanityKey);
	if (!sanityBefore) await game.settings.set(SYSTEM, sanityKey, true);
	try {
	await withArena(async (arena) => {
		const guard = async (prefix, fn) => {
			if (!wanted(prefix)) return;
			try {
				await fn();
			} catch (error) {
				add(prefix, "erro", false, error.stack?.split("\n").slice(0, 3).join(" ") ?? String(error));
			}
		};
		await guard("CD", () => conditionCases(arena, add));
		await guard("SG", () => bleedStackCases(arena, add));
		await guard("TG", () => targetingCases(arena, add));
		await guard("BT", () => battleCase(arena, add));
	}, { agents: DEFAULT_AGENTS, pd: 200 });
	} finally {
		if (!sanityBefore) await game.settings.set(SYSTEM, sanityKey, sanityBefore);
	}
	console.table(results);
	return results;
}

export { castRitual, areaRuleFor };
