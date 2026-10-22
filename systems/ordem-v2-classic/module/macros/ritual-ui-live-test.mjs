// Lado da página do teste dirigido por navegador (Playwright): monta a arena com combate aberto e responde às perguntas
// do orquestrador (scripts/ui-rituais.mjs), que faz os cliques de verdade (janela de conjuração, mapa, botão
// "próximo turno" do monitor de combate). Tudo que é criado fica na cena temporária e é apagado em `close()`.
//
// Uso (console, como Mestre): const rt = await import("/systems/ordem-v2-classic/module/macros/ritual-ui-live-test.mjs"); window.__rt = rt;

import { areaRuleFor, areaChoicesFor } from "./ritual-area-rules.mjs";
import { areaTemplateData } from "./ritual-area.mjs";
import { ritualFormOptions } from "./ritual-caster-logic.mjs";
import { ritualRange, ritualTargets } from "./ritual-targeting.mjs";
import { openArena, DEFAULT_AGENTS } from "./ritual-live-arena.mjs";

const SYSTEM = "ordem-v2-classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cell = (col, row) => ({ x: col * 100 + 50, y: row * 100 + 50 });

let arena = null;
let threats = [];
let extra = [];
let dsn = null;
const errors = [];
const notes = [];
let originalNotify = null;

const errorHook = (event) => errors.push(String(event.message ?? event.reason ?? event));
const ALL_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];

async function tuneThreat(token) {
	const update = { "system.genericRd": { value: 0, except: [] } };
	for (const type of ALL_TYPES) {
		update[`system.resistances.${type}.value`] = 0;
		update[`system.resistances.${type}.vulnerable`] = false;
		update[`system.resistances.${type}.immune`] = false;
	}
	await token.actor.update(update);
}

/** Cena temporária com 5 agentes (NEX 05 a 99), 6 ameaças e um combate já iniciado. */
export async function open() {
	window.addEventListener("error", errorHook);
	window.addEventListener("unhandledrejection", errorHook);
	try {
		dsn = game.settings.get("dice-so-nice", "enabled");
		await game.settings.set("dice-so-nice", "enabled", false); // sem animação 3D: o teste fica bem mais rápido
	} catch { dsn = null; }
	// guarda os avisos que o jogador veria (bloqueios, alcance, alvo faltando)
	if (!originalNotify) {
		originalNotify = {};
		for (const level of ["info", "warn", "error"]) {
			originalNotify[level] = ui.notifications[level].bind(ui.notifications);
			ui.notifications[level] = (message, ...rest) => { notes.push(`${level}: ${message}`); return originalNotify[level](message, ...rest); };
		}
	}
	arena = await openArena({ agents: DEFAULT_AGENTS, pd: 900 });
	const spots = [[5, 7], [7, 7], [9, 7], [5, 9], [7, 9], [9, 9]];
	const names = ["Bandido VD 10", "Capanga VD 20", "Policial VD 20", "Zumbi de Sangue", "Bandido VD 10", "Capanga VD 20"];
	threats = [];
	for (const [i, [col, row]] of spots.entries()) {
		const baseName = game.actors.getName(names[i]) ? names[i] : "Aberração de Carne";
		const token = await arena.mkThreat(`ZZ ameaça ${i + 1}`, cell(col, row).x, cell(col, row).y, { baseName, hp: 5000 });
		await tuneThreat(token);
		threats.push(token);
	}
	const combat = await Combat.create({ scene: arena.scene.id, active: true });
	await combat.createEmbeddedDocuments("Combatant", [...arena.agents.map((a) => a.token), ...threats].map((token, i) => ({
		tokenId: token.id, sceneId: arena.scene.id, actorId: token.actor.id, initiative: 200 - i * 10,
	})));
	await pause(400);
	await combat.startCombat();
	await pause(800);
	ui.sidebar?.changeTab?.("combat", "primary");
	return info();
}

export function info() {
	const combat = game.combats.find((entry) => entry.scene?.id === arena?.scene?.id);
	return {
		scene: canvas.scene?.name,
		round: combat?.round ?? null,
		turn: combat?.combatant?.name ?? null,
		agents: arena?.agents.map((a) => `${a.actor.name} PD ${a.actor.system.PD.value}`) ?? [],
		threats: threats.map((t) => `${t.name} ${t.actor.system.attributes.hp.value}`),
		errors: errors.length,
	};
}

/** Lista de rituais, formas e escolhas de efeito para o orquestrador percorrer. */
export function catalog() {
	const lib = game.actors.getName("Biblioteca de Rituais — Agente");
	return lib.items.filter((item) => item.type === "ritual").map((item) => {
		const forms = ["basic", ...(item.system.studentForm ? ["student"] : []), ...(item.system.trueForm ? ["true"] : [])];
		return { name: item.name, id: item.id, circle: item.system.circle, element: item.system.element, forms, choices: Object.keys(areaChoicesFor(item) ?? {}) };
	});
}

async function ensureRitual(actor, name) {
	let item = actor.items.find((entry) => entry.type === "ritual" && entry.name === name);
	if (item) return item;
	const source = game.actors.getName("Biblioteca de Rituais — Agente").items.find((entry) => entry.type === "ritual" && entry.name === name);
	[item] = await actor.createEmbeddedDocuments("Item", [source.toObject()]);
	return item;
}

const gap = (a, b) => Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);

/** O que o jogador faria com este ritual: alvos a marcar, ponto da área ou nada. */
export async function plan(agentIndex, ritualName, form = "basic", choiceId = null) {
	const agent = arena.agents[agentIndex % arena.agents.length];
	const item = await ensureRitual(agent.actor, ritualName);
	const options = ritualFormOptions(item);
	const body = form === "basic" ? "" : (options[form]?.body ?? "");
	const req = ritualTargets(item, body);
	const range = ritualRange(item, body);
	const rule = areaRuleFor(item, form, choiceId);
	const placement = areaTemplateData(item, rule);
	const sorted = [...threats].filter((t) => t.actor.system.attributes.hp.value > 0).sort((a, b) => gap(agent.token, a) - gap(agent.token, b));
	const out = { agent: agent.actor.name, agentTokenId: agent.token.id, itemId: item.id, ritual: ritualName, form, choiceId, req: `${req.kind}/${req.max}`, range: range.key, rule: !!rule, mode: "none", targetIds: [], area: null };
	if (placement) {
		out.mode = "area";
		out.atCaster = rule?.area?.center === "caster";
		const nearest = sorted[0];
		out.area = nearest ? { x: Math.round(nearest.center.x), y: Math.round(nearest.center.y) } : cell(7, 7);
		// ritual de alcance curto/toque com área: aproxima o ponto do conjurador sem sair do alcance
		if (!out.atCaster && range.kind === "touch") out.area = { x: Math.round(agent.token.center.x + 100), y: Math.round(agent.token.center.y + 100) };
		if (rule?.chosen) out.targetIds = sorted.slice(0, 2).map((t) => t.id);
	} else if (req.kind === "creature" && range.kind !== "personal") {
		out.mode = "targets";
		const wanted = req.max === null ? 2 : Math.min(req.max || 1, 2);
		if (range.kind === "touch") {
			// alvo de toque: um token no espaço ao lado do conjurador
			const doc = await arena.mkThreat(`ZZ toque ${extra.length + 1}`, agent.token.center.x + 100, agent.token.center.y + 100, { baseName: "Bandido VD 10", hp: 5000 });
			await tuneThreat(doc);
			extra.push(doc);
			out.targetIds = [doc.id];
		} else {
			out.targetIds = sorted.slice(0, wanted).map((t) => t.id);
		}
	}
	return out;
}

/** Marca os alvos e seleciona o conjurador, como o jogador antes de abrir a macro. */
export async function prepare(p) {
	const agent = arena.agents.find((a) => a.token.id === p.agentTokenId);
	canvas.tokens.activate();
	// PD cheio a cada caso: o teste cobre centenas de conjurações e não deve parar por falta de PD
	if (Number(agent.actor.system.PD.value) < 300) await agent.actor.update({ "system.PD.value": 900 });
	agent.token.control({ releaseOthers: true });
	game.user.targets.forEach((token) => token.setTarget(false, { releaseOthers: false }));
	for (const id of p.targetIds) canvas.tokens.get(id)?.setTarget(true, { releaseOthers: false, groupSelection: false });
	notes.length = 0;
	window.__known = new Set(game.messages.contents.map((message) => message.id));
	window.__pd0 = Number(agent.actor.system.PD.value);
	window.__done = false;
	window.__macro = null;
	return true;
}

/** Abre a janela de conjuração (sem esperar): o orquestrador clica nela. */
export async function start(p) {
	const { runRitualCasterMacro } = await import("./ritual-caster.mjs");
	const agent = arena.agents.find((a) => a.token.id === p.agentTokenId);
	const macro = runRitualCasterMacro(agent.actor, p.itemId);
	window.__macro = macro;
	macro.finally(() => { window.__done = true; });
	return true;
}

export const clientPoint = (x, y) => {
	const point = canvas.clientCoordinatesFromCanvas ? canvas.clientCoordinatesFromCanvas({ x, y }) : canvas.stage.toGlobal({ x, y });
	const rect = (canvas.app.canvas ?? canvas.app.view).getBoundingClientRect();
	return { x: Math.round(rect.left + (point.x ?? 0)), y: Math.round(rect.top + (point.y ?? 0)) };
};

export const previewActive = () => canvas.templates.preview.children.length > 0;
export const macroDone = () => !!window.__done;

/** A resolução automática (Mestre) terminou? */
export function settled() {
	const card = lastCard();
	return window.__done && (!card || !["effects", "rolling"].includes(card.getFlag(SYSTEM, "ritualCast")?.status));
}

function lastCard() {
	return game.messages.contents.filter((message) => !window.__known?.has(message.id) && message.getFlag(SYSTEM, "ritualCast")).at(-1) ?? null;
}

export function result(p) {
	const card = lastCard();
	const agent = arena.agents.find((a) => a.token.id === p.agentTokenId);
	const text = card?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
	return {
		status: card?.getFlag(SYSTEM, "ritualCast")?.status ?? null,
		buttons: [...(card?.content.matchAll(/data-action="([^"]+)"/g) ?? [])].map((match) => match[1]),
		pdSpent: window.__pd0 - Number(agent.actor.system.PD.value),
		resumo: text.slice(0, 160),
		linhasArea: (text.match(/Ritual de área (.*?)(Consequências|Detalhes)/)?.[1] ?? "").slice(0, 300),
		avisos: notes.splice(0),
		erros: errors.splice(0),
	};
}

/** Limpa o que o ritual deixou (regiões, tokens de toque) para o próximo caso. */
export async function cleanup() {
	// fecha o que sobrou de um caso que deu errado: prévia da área, janelas de teste e de conjuração
	document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
	for (const app of document.querySelectorAll(".application")) {
		const title = app.querySelector(".window-title")?.innerText ?? "";
		// qualquer janela de diálogo (conjuração, testes, escolha de efeito, aviso de versão); o monitor de combate fica
		if (app.classList.contains("dialog") || /^(Teste de|Conjurar Ritual)/.test(title) || title === "") app.querySelector('[data-action="close"]')?.click();
	}
	canvas.templates.preview?.removeChildren?.();
	window.__done = true;
	const regions = canvas.scene.regions.filter((region) => region.getFlag(SYSTEM, "ritualZone")).map((region) => region.id);
	if (regions.length) await canvas.scene.deleteEmbeddedDocuments("Region", regions);
	for (const doc of extra.splice(0)) await doc.document?.delete().catch(() => {});
	await pause(200);
	return regions.length;
}

export function combatState() {
	const combat = game.combats.find((entry) => entry.scene?.id === arena.scene.id);
	return { round: combat?.round, turn: combat?.combatant?.name, effects: [...threats, ...arena.agents.map((a) => a.token)].reduce((sum, t) => sum + t.actor.effects.size, 0) };
}

export function threatState() {
	return threats.map((token) => ({ name: token.name, hp: token.actor.system.attributes.hp.value, max: token.actor.system.attributes.hp.max, effects: token.actor.effects.map((effect) => effect.name) }));
}

export async function close() {
	window.removeEventListener("error", errorHook);
	window.removeEventListener("unhandledrejection", errorHook);
	const total = errors.length;
	if (arena) await arena.close();
	arena = null;
	try { if (dsn !== null) await game.settings.set("dice-so-nice", "enabled", dsn); } catch { /* ignora */ }
	return { errosNaSessao: total };
}
