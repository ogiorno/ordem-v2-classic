// Motor dos rituais de área: resistência automática das ameaças dentro da área, dano cheio ou pela metade,
// condições, zonas que repetem o efeito no início dos turnos e gatilho de saída.
// Roda no cliente do Mestre (ele tem permissão sobre as ameaças). Regras: ritual-area-rules.mjs.

import { regionContains } from "./ritual-area.mjs";
import { CONDITION_FLAG, activeConditions, conditionEffectData, conditionIdFor, hasConditionProp } from "../helpers/conditions.mjs";

import { BLEED_DT, bleedCardOpen, bleedMode, bleedOutcome } from "../helpers/turn-effects-rules.mjs";

const SYSTEM = "ordem_v2_classic";
const ZONE_FLAG = "ritualZone";
const debug = (...args) => { if (globalThis.__areaDebug) console.log("[ritual-area]", ...args); };

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hpOf = (actor) => Number(actor.type === "threat" ? actor.system.attributes?.hp?.value : actor.system.PV?.value);

/* -------------------------------------------- */
/*  Rolagens                                    */
/* -------------------------------------------- */

/** Rola uma perícia sem diálogo e posta a carta normal de perícia no chat. Devolve { total, success }. */
async function autoRoll(actor, skill, dt) {
	const rolls = await actor.rollSkill({ skill, rolls: [{ options: { target: dt } }] }, { configure: false }, { create: false });
	const roll = Array.isArray(rolls) ? rolls[0] : rolls;
	const total = Number(roll?.total);
	if (!Number.isFinite(total)) return null;
	await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
	return { total, success: dt === null ? null : total >= dt };
}

/**
 * Rola cada parte do dano e posta a carta normal de rolagem (fórmula, cada dado e total), uma por tipo de dano,
 * como o sistema faz nos ataques. O dano vale para todos os alvos da área.
 */
async function rollDamageParts(parts, item, speaker) {
	const rolls = [];
	for (const part of parts) {
		const roll = await new Roll(part.formula).evaluate();
		await roll.toMessage(
			{ speaker, flavor: `${item.name} — dano de ${damageLabel(part.type)}` },
			{ rollMode: game.settings.get("core", "rollMode") },
		);
		rolls.push({ ...part, roll, amount: Math.max(0, Math.floor(Number(roll.total))) });
	}
	return rolls;
}

function damageLabel(type) {
	const key = CONFIG.op?.dropdownDamageType?.[type];
	return key ? game.i18n.localize(key) : type;
}

/* -------------------------------------------- */
/*  Condições                                   */
/* -------------------------------------------- */

const VULNERABLE_TYPES = ["ballisticDamage", "cuttingDamage", "impactDamage", "piercingDamage"];

export async function applyCondition(actor, cond, origin = {}) {
	if (cond.oncePerScene) {
		const used = actor.getFlag(SYSTEM, "areaOncePerScene") ?? {};
		const marker = `${cond.key ?? cond.label}:${canvas.scene?.id}:${origin.itemId ?? ""}`;
		if (used[marker]) return null;
		await actor.setFlag(SYSTEM, "areaOncePerScene", { ...used, [marker]: true });
	}
	let rounds = cond.rounds ?? null;
	if (typeof rounds === "string") rounds = Math.max(1, Math.floor(Number((await new Roll(rounds).evaluate()).total)));
	const areaEffect = { zoneId: origin.zoneId ?? null, itemId: origin.itemId ?? null, key: cond.key ?? null };
	const id = conditionIdFor(cond);
	let data;
	if (id) {
		// condição com efeito mecânico (defesa, d20 a menos, sangramento…): ver helpers/conditions.mjs
		data = conditionEffectData(id, { name: cond.label, rounds, origin: origin.itemUuid ?? null, startRound: game.combat?.round ?? null, extraFlags: { areaEffect } });
	} else {
		const status = cond.key ? CONFIG.statusEffects.find((entry) => entry.id === cond.key) : null;
		data = {
			name: cond.label ?? (status ? game.i18n.localize(status.name ?? status.label) : cond.key),
			img: status?.img ?? "icons/svg/aura.svg",
			statuses: status ? [status.id] : [],
			origin: origin.itemUuid ?? null,
			duration: rounds ? { rounds } : {},
			flags: { [SYSTEM]: { areaEffect } },
		};
	}
	const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
	const name = data.name;
	return { effect, name, rounds };
}

async function applyVulnerabilities(actor, origin) {
	const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
		name: "Vulnerável (Purgatório)",
		img: "icons/svg/blood.svg",
		origin: origin.itemUuid ?? null,
		changes: VULNERABLE_TYPES.map((type) => ({ key: `system.resistances.${type}.vulnerable`, mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true" })),
		flags: { [SYSTEM]: { areaEffect: { zoneId: origin.zoneId ?? null, itemId: origin.itemId ?? null, key: "vulnerabilities" } } },
	}]);
	return effect;
}

/* -------------------------------------------- */
/*  Aplicação de um efeito a uma lista de tokens */
/* -------------------------------------------- */

const isEnemy = (token) => token.actor?.type === "threat" && hpOf(token.actor) > 0;

/**
 * Aplica um efeito (onCast / tick / exit) a cada token. Devolve as linhas do relatório e o dano total causado.
 * @param {object} spec    Efeito da regra.
 * @param {object} ctx     { caster, item, dt, tokens, origin, label }
 */
export async function applyAreaEffect(spec, ctx) {
	const { caster, item, dt, tokens, origin } = ctx;
	const lines = [];
	let totalDamage = 0;
	const speaker = ChatMessage.getSpeaker({ actor: caster });
	if (!tokens.length) return { lines: ["Nenhuma ameaça dentro da área."], totalDamage };

	const damageRolls = spec.damage?.length ? await rollDamageParts(spec.damage, item, speaker) : [];

	for (const token of tokens) {
		const actor = token.actor;
		const before = hpOf(actor);
		const parts = [];
		let passed = null;

		if (spec.special === "grapple") {
			parts.push(...await grappleTarget(spec, ctx, token, damageRolls));
			lines.push(`${token.name}: ${parts.join(" ")}`);
			continue;
		}

		if (spec.save) {
			const result = await autoRoll(actor, spec.save.skill, dt);
			passed = result ? result.success : false;
			parts.push(`${result ? result.total : "—"} contra DT ${dt}: ${passed ? "resistiu" : "falhou"}.`);
		}
		if (spec.negateAfterPasses && ctx.counter) {
			const key = `${origin.zoneId}:${token.id}`;
			const streak = passed ? (ctx.counter.get(key) ?? 0) + 1 : 0;
			ctx.counter.set(key, streak);
			if (streak >= spec.negateAfterPasses) parts.push("Passou em testes seguidos: o efeito é anulado para ele.");
		}

		let dealt = 0;
		const skipDamage = spec.damageOnFailOnly && passed;
		if (damageRolls.length && !skipDamage) {
			for (const entry of damageRolls) {
				let amount = entry.amount;
				if (passed && spec.save.success === "half") amount = Math.floor(amount / 2);
				else if (passed && (spec.save.success === "none" || spec.save.success === "negates")) amount = 0;
				if (amount <= 0) continue;
				const result = await actor.applyDamage(amount, { damageType: entry.type });
				dealt += result.finalDamage ?? 0;
				if (result.finalDamage === 0 && result.blocked > 0) parts.push(`Imune/resistente a ${damageLabel(entry.type)} (bloqueou ${result.blocked}).`);
			}
			const full = damageRolls.reduce((sum, entry) => sum + entry.amount, 0);
			const reduced = passed && ["none", "negates"].includes(spec.save.success);
			const mode = passed && spec.save.success === "half" ? "pela metade" : "total";
			parts.push(reduced ? "Sem dano." : `Dano ${mode}: ${dealt} PV (rolado ${full}).`);
		} else if (skipDamage) {
			parts.push("Sem dano.");
		}
		totalDamage += dealt;

		const conditions = passed === true ? spec.onSuccess : spec.onFail;
		const applied = [];
		for (const cond of spec.save ? (conditions ?? []) : [...(spec.onFail ?? []), ...(spec.onSuccess ?? [])].filter((c, i, all) => all.findIndex((x) => (x.key ?? x.label) === (c.key ?? c.label)) === i)) {
			const result = await applyCondition(actor, cond, origin);
			if (result) applied.push(result.name);
		}
		if (applied.length) parts.push(`Condição: ${applied.join(", ")}.`);

		if (spec.special === "killAtZero" && dealt > 0 && hpOf(actor) <= 0) {
			const kill = await autoRoll(actor, FORT_SKILL, dt);
			if (kill && !kill.success) {
				await actor.toggleStatusEffect?.("dead", { active: true });
				parts.push("Reduzido a 0 PV, falhou em Fortitude: reduzido a cinzas (morre).");
			} else parts.push("Reduzido a 0 PV, mas passou em Fortitude: não vira cinzas.");
		}
		if (spec.special === "vulnerabilities") {
			await applyVulnerabilities(actor, origin);
			parts.push("Vulnerável a dano balístico, de corte, de impacto e de perfuração enquanto estiver na área.");
		}
		lines.push(`${token.name}: ${parts.join(" ") || "afetado."} (PV ${before} → ${hpOf(actor)})`);
	}
	if (spec.special === "tempPvFromDamage") lines.push(`${caster.name} recebe ${totalDamage} PV temporários até o fim da cena (anote na ficha).`);
	return { lines, totalDamage };
}

const FORT_SKILL = "resilience";

async function grappleTarget(spec, ctx, token, damageRolls) {
	const { caster, origin } = ctx;
	const parts = [];
	const mine = await autoRoll(caster, "occultism", null);
	const theirSkill = token.actor.system.skills?.fighting ? "fighting" : "reflexes";
	const theirs = await autoRoll(token.actor, theirSkill, null);
	if (!mine || !theirs) return ["rolagem cancelada."];
	parts.push(`Ocultismo ${mine.total} contra ${theirs.total}.`);
	if (mine.total <= theirs.total) return [...parts, "Escapou dos tentáculos."];
	const grabbed = token.actor.effects.find((effect) => effect.getFlag(SYSTEM, "areaEffect")?.key === "grabbed" && effect.getFlag(SYSTEM, "areaEffect")?.itemId === (origin.itemId ?? null));
	if (!grabbed) {
		const result = await applyCondition(token.actor, { key: "restrain", label: "Agarrado (Tentáculos de Lodo)" }, origin);
		await result.effect.setFlag(SYSTEM, "areaEffect", { zoneId: origin.zoneId ?? null, itemId: origin.itemId ?? null, key: "grabbed" });
		return [...parts, "Agarrado."];
	}
	let dealt = 0;
	for (const entry of damageRolls) {
		const result = await token.actor.applyDamage(entry.amount, { damageType: entry.type });
		dealt += result.finalDamage ?? 0;
	}
	return [...parts, `Já estava agarrado: esmagado, ${dealt} PV de dano.`];
}

/* -------------------------------------------- */
/*  Geometria e zonas                           */
/* -------------------------------------------- */

/** Tokens (ameaças, por padrão) cujo centro está dentro da Região da área. */
export function tokensInside(region, { enemiesOnly = true } = {}) {
	// documentos da cena da Região: funciona mesmo que o Mestre ativo esteja vendo outra cena
	return (region.parent?.tokens ?? []).filter((token) => (!enemiesOnly || isEnemy(token)) && regionContains(region, tokenCenter(token)));
}

/** Centro (px) de um token a partir do documento, sem precisar do canvas. */
export function tokenCenter(tokenDoc, at = tokenDoc) {
	const size = tokenDoc.parent?.grid?.size ?? canvas.grid.size;
	return { x: at.x + (tokenDoc.width * size) / 2, y: at.y + (tokenDoc.height * size) / 2 };
}

function zoneInfo(template) {
	return template.getFlag(SYSTEM, ZONE_FLAG) ?? null;
}

async function postReport(caster, item, title, lines, extra = "") {
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: caster }),
		content: `<article class="ritual-area-report"><h4>${escapeHtml(item.name)} — ${escapeHtml(title)}</h4>${extra}<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></article>`,
	});
}

function originOf(info, item) {
	return { zoneId: info.zoneId, itemId: item?.id ?? info.itemId, itemUuid: item?.uuid };
}

/**
 * Resolve o ritual de área logo depois de conjurado: aplica `onCast` e, se houver `tick`/`exit`, registra a zona.
 * @param {object} cast       Dados salvos da conjuração (ator, item, forma, escolha, alvos, template)
 * @param {object} rule       Regra da forma
 * @returns {Promise<string[]>} linhas para a carta do chat
 */
export async function resolveAreaCast(cast, rule) {
	const caster = game.actors.get(cast.actorId);
	const item = caster?.items.get(cast.itemId);
	if (!caster || !item) throw new Error("Agente ou ritual não encontrado.");
	const dt = Number(caster.system.ritual?.DT);
	const template = cast.templateId ? canvas.scene?.regions.get(cast.templateId) : null;
	const lines = [];

	let tokens;
	if (rule.chosen || !template) tokens = (cast.targetIds ?? []).map((id) => canvas.scene?.tokens.get(id)).filter(Boolean);
	else tokens = tokensInside(template);
	tokens = tokens.filter(isEnemy);

	let zoneId = null;
	if (template && (rule.tick || rule.exit || rule.onCast?.special === "vulnerabilities" || rule.persistent)) {
		zoneId = foundry.utils.randomID();
		await template.setFlag(SYSTEM, ZONE_FLAG, {
			zoneId, ruleKey: rule.key, formId: rule.formId, choiceId: rule.choiceId ?? null,
			casterId: caster.id, itemId: item.id, dt,
			// "3 rodadas" a partir da conjuração: a da conjuração e as duas seguintes
			expiresRound: rule.tick?.rounds && game.combat ? game.combat.round + rule.tick.rounds - 1 : null,
			follow: rule.area?.follow ? (cast.casterTokenId ?? null) : null,
		});
	}
	const origin = { zoneId, itemId: item.id, itemUuid: item.uuid };

	if (rule.narrative) lines.push(rule.narrative);
	if (rule.onCast) {
		const report = await applyAreaEffect(rule.onCast, { caster, item, dt, tokens, origin, counter: counters });
		lines.push(...report.lines);
	}
	if (rule.tick) lines.push(`Zona ativa: ${rule.tick.when === "casterTurn" ? "repete no início de cada turno de quem conjurou" : "repete no início do turno de cada criatura dentro da área"}${rule.tick.rounds ? ` por ${rule.tick.rounds} rodadas` : ""}.`);
	if (rule.exit) lines.push("Quem tentar sair da área sofre o efeito de saída (resistência automática).");
	lines.affected = tokens.length; // quantas ameaças foram atingidas (0 = faltou alvo ou área)
	return lines;
}

const counters = new Map();

/** Efeito do início de turno de uma zona. */
async function tickZone(template, info, combatant, combat) {
	const caster = game.actors.get(info.casterId);
	const item = caster?.items.get(info.itemId);
	const rule = item ? areaRuleFromInfo(item, info) : null;
	if (!caster || !item || !rule?.tick) return debug("sem regra/tick", { caster: !!caster, item: !!item, rule: !!rule, info });
	debug("tick", { combatente: combatant.name, rodada: combat.round, expira: info.expiresRound });
	if (info.expiresRound && combat.round > info.expiresRound) return removeZone(template);
	let tokens;
	if (rule.tick.when === "casterTurn") {
		if (combatant.actor?.id !== caster.id) return debug("turno não é do conjurador");
		tokens = tokensInside(template);
	} else {
		const token = combatant.token;
		if (!token || !isEnemy(token) || !tokensInside(template).some((entry) => entry.id === token.id)) return debug("criatura fora da área ou não é ameaça", token?.name);
		tokens = [token];
	}
	if (!tokens.length) return debug("ninguém na área");
	const origin = originOf(info, item);
	const report = await applyAreaEffect(rule.tick, { caster, item, dt: info.dt, tokens, origin, counter: counters });
	await postReport(caster, item, `início do turno de ${combatant.name} (rodada ${combat.round})`, report.lines);
}

async function removeZone(template) {
	const info = zoneInfo(template);
	const scene = template.parent;
	await template.delete();
	if (!info) return;
	for (const token of scene?.tokens ?? []) {
		const doomed = token.actor?.effects.filter((effect) => effect.getFlag(SYSTEM, "areaEffect")?.zoneId === info.zoneId).map((effect) => effect.id) ?? [];
		if (doomed.length) await token.actor.deleteEmbeddedDocuments("ActiveEffect", doomed);
	}
}

let ruleResolver = null;
/** Injetado por ritual-caster.mjs para evitar dependência circular. */
export function setRuleResolver(fn) {
	ruleResolver = fn;
}
function areaRuleFromInfo(item, info) {
	return ruleResolver?.(item, info.formId, info.choiceId);
}

/* -------------------------------------------- */
/*  Condições no início do turno                */
/* -------------------------------------------- */

const hpPath = (actor) => (actor.type === "threat" ? "system.attributes.hp.value" : "system.PV.value");

/** Início do turno de quem carrega condições: expira as vencidas, faz o teste do Sangrando e pula o turno de quem não pode agir. */
async function processConditionsAtTurnStart(combatant, combat) {
	const actor = combatant.actor;
	if (!actor) return;
	const speaker = ChatMessage.getSpeaker({ actor });
	for (const effect of activeConditions(actor)) {
		const data = effect.getFlag(SYSTEM, CONDITION_FLAG);
		if (data.expiresRound !== null && data.expiresRound !== undefined && combat.round > data.expiresRound) {
			await effect.delete();
			continue;
		}
		if (data.bleed) {
			const hasOnlineOwner = game.users.some((u) => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
			const mode = bleedMode({ setting: game.settings.get(SYSTEM, "turnSavePrompt"), actorType: actor.type, hasOnlineOwner });
			if (mode === "ask") await postBleedCard(actor, effect, speaker);
			else await resolveBleed(actor, effect.id);
		}
		if (data.noActions && combat.combatant?.id === combatant.id) {
			await ChatMessage.create({ speaker, content: `<p>${escapeHtml(actor.name)} está ${escapeHtml(effect.name)} e não pode fazer ações: perde o turno.</p>` });
			await combat.nextTurn();
			return;
		}
	}
}

/** Teste de Vigor do Sangrando (DT 20): passou estanca; falhou perde 1d6 PV e continua. Roda no cliente do Mestre. */
export async function resolveBleed(actor, effectId) {
	const effect = actor.effects.get(effectId);
	if (!effect) return null;
	const speaker = ChatMessage.getSpeaker({ actor });
	const save = await autoRoll(actor, "resilience", BLEED_DT);
	if (bleedOutcome(save?.total) === "stanched") {
		await effect.delete();
		await ChatMessage.create({ speaker, content: `<p>${escapeHtml(actor.name)} passou em Vigor (DT ${BLEED_DT}) e estancou o sangramento.</p>` });
		return "stanched";
	}
	const roll = await new Roll("1d6").evaluate();
	await roll.toMessage({ speaker, flavor: `${actor.name} — Sangrando: perde PV` }, { rollMode: game.settings.get("core", "rollMode") });
	await actor.applyDamage(Math.max(0, Math.floor(Number(roll.total))), { ignoreRD: true });
	return "bleeds";
}

/** Cartão pedindo ao jogador o teste de Sangrando; um cartão aberto por efeito. */
async function postBleedCard(actor, effect, speaker) {
	const open = game.messages.some((m) => {
		const flag = m.getFlag(SYSTEM, "bleedPending");
		return flag && flag.effectId === effect.id && bleedCardOpen(flag);
	});
	if (open) return;
	await ChatMessage.create({
		speaker,
		content: `<div class="op-turn-save"><p><strong>${escapeHtml(actor.name)}</strong> está Sangrando. Faça um teste de Vigor (DT ${BLEED_DT}); se falhar, perde 1d6 PV.</p>
			<button type="button" data-action="bleed-test"><i class="fa-solid fa-dice-d20"></i> Rolar Vigor</button></div>`,
		flags: { [SYSTEM]: { bleedPending: { actorId: actor.id, effectId: effect.id, dt: BLEED_DT, resolved: false } } },
	});
}

/** Resolve o cartão (clique do dono ou do Mestre). Idempotente: o segundo clique não faz nada. */
export async function resolvePendingBleed(messageId) {
	const message = game.messages.get(messageId);
	const flag = message?.getFlag(SYSTEM, "bleedPending");
	if (!bleedCardOpen(flag)) return null;
	await message.setFlag(SYSTEM, "bleedPending", { ...flag, resolved: true });
	const actor = game.actors.get(flag.actorId);
	const result = actor ? await resolveBleed(actor, flag.effectId) : null;
	const text = result === "stanched" ? "estancou o sangramento." : result === "bleeds" ? "continua sangrando." : "não está mais sangrando.";
	await message.update({ content: `<div class="op-turn-save"><p><strong>${escapeHtml(actor?.name ?? "")}</strong> testou Vigor: ${text}</p></div>` });
	return result;
}

/** Impede a recuperação de PV de quem está com "Sem recuperar PV". */
function blockHealing(actor, changes) {
	if (!hasConditionProp(actor, "noHealing")) return;
	const path = hpPath(actor);
	const next = foundry.utils.getProperty(changes, path);
	const current = Number(foundry.utils.getProperty(actor, path));
	if (next === undefined || !(Number(next) > current)) return;
	foundry.utils.setProperty(changes, path, current);
	ui.notifications.info(`${actor.name} não pode recuperar PV agora.`);
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

export function registerAreaHooks() {
	Hooks.on("combatTurnChange", async (combat, _previous, current) => {
		if (!game.user.isActiveGM) return;
		const combatant = combat.combatants.get(current?.combatantId);
		if (!combatant) return;
		try {
			await processConditionsAtTurnStart(combatant, combat);
		} catch (error) {
			console.error("Ritual de área: falha ao processar condições do turno", error);
		}
	});
	Hooks.on("preUpdateActor", (actor, changes) => blockHealing(actor, changes));

	Hooks.on("combatTurnChange", async (combat, _previous, current) => {
		if (!game.user.isActiveGM) return;
		const combatant = combat.combatants.get(current?.combatantId);
		if (!combatant || !combat.scene) return;
		for (const template of combat.scene.regions) {
			const info = zoneInfo(template);
			if (!info) continue;
			try {
				await tickZone(template, info, combatant, combat);
			} catch (error) {
				console.error("Ritual de área: falha ao aplicar o efeito do turno", error);
				ui.notifications.error(`Ritual de área: falha no efeito do turno (${error.message})`);
			}
		}
	});

	// Presença do Medo (emanação) acompanha o conjurador.
	Hooks.on("updateToken", async (tokenDoc, changes, options) => {
		if (!game.user.isActiveGM || !tokenDoc.parent) return;
		if (changes.x === undefined && changes.y === undefined) return;
		for (const template of tokenDoc.parent.regions) {
			const info = zoneInfo(template);
			if (!info) continue;
			if (info.follow && info.follow === tokenDoc.id) {
				const center = tokenCenter(tokenDoc);
				if (center) await template.update({ shapes: template.shapes.map((shape) => ({ ...shape.toObject(), x: center.x, y: center.y })) });
			}
		}
		await checkExit(tokenDoc, options);
	});

	Hooks.on("preUpdateToken", (tokenDoc, changes, options) => {
		if (changes.x !== undefined || changes.y !== undefined) options.ritualFrom = tokenCenter(tokenDoc);
	});

	// Apagou a zona: remove as condições que ela aplicou.
	Hooks.on("deleteRegion", async (template) => {
		if (!game.user.isActiveGM) return;
		const info = zoneInfo(template);
		if (!info) return;
		for (const token of template.parent?.tokens ?? []) {
			const doomed = token.actor?.effects.filter((effect) => effect.getFlag(SYSTEM, "areaEffect")?.zoneId === info.zoneId).map((effect) => effect.id) ?? [];
			if (doomed.length) await token.actor.deleteEmbeddedDocuments("ActiveEffect", doomed);
		}
	});
}

/** Gatilho de saída (Purgatório): a criatura que tenta sair faz a resistência; se falhar, não consegue se mover. */
async function checkExit(tokenDoc, options) {
	const from = options?.ritualFrom;
	const token = tokenDoc;
	debug("checkExit", { from, token: token?.name, enemy: token ? isEnemy(token) : null });
	if (!from || !token.actor || !isEnemy(token)) return;
	const to = tokenCenter(tokenDoc);
	for (const template of tokenDoc.parent.regions) {
		const info = zoneInfo(template);
		if (!info) continue;
		const caster = game.actors.get(info.casterId);
		const item = caster?.items.get(info.itemId);
		const rule = item ? areaRuleFromInfo(item, info) : null;
		debug("exit-regra", { zona: template.name, rule: !!rule, exit: !!rule?.exit, dentroAntes: regionContains(template, from), dentroDepois: regionContains(template, to), to });
		if (!rule?.exit) continue;
		if (!regionContains(template, from) || regionContains(template, to)) continue;
		const origin = originOf(info, item);
		const report = await applyAreaEffect(rule.exit, { caster, item, dt: info.dt, tokens: [token], origin, counter: counters });
		const resisted = /resistiu/.test(report.lines.join(" "));
		if (!resisted) {
			await tokenDoc.update({ x: tokenDoc.x - (to.x - from.x), y: tokenDoc.y - (to.y - from.y) }, { animate: false, teleport: true, ritualBounce: true });
			await applyCondition(token.actor, { label: "Sem ação de movimento (Purgatório)", rounds: 1 }, origin);
			report.lines.push("A dor o impede de sair: volta para dentro da área e perde a ação de movimento.");
		} else report.lines.push("Consegue sair da área.");
		await postReport(caster, item, `${token.name} tenta sair da área`, report.lines);
	}
}
