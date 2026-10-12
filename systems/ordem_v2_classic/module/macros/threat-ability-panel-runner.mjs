import { normalizeExecution } from "../helpers/threat-ability-execution.mjs";
import { previewChange, auditRecord, resourcePath, resolveDamageType } from "../helpers/threat-ability-damage.mjs";
import { damageMode, effectApplies } from "../helpers/threat-ability-resistance.mjs";
import { buildEffectPlan } from "../helpers/threat-ability-effects.mjs";
import {
	ROW_STATE, abortApply, applyAllPlan, beginApply, canApply, clonePanel, createPanel, createRow, editChange, effectiveAmount,
	markApplied, markIgnored, markRestored, markUndone, panelIssue, publicLine, restoreChange, undoCheck
} from "../helpers/threat-ability-panel.mjs";
import { rollSaves } from "./threat-ability-resistance-runner.mjs";
import { applyChange, rollEntries } from "./threat-ability-damage-runner.mjs";
import { applyAbilityEffect, removeExecutionEffects, rollDuration } from "./threat-ability-effects-runner.mjs";
import { PanelStore } from "../helpers/threat-ability-panel-store.mjs";
import { linkTarget } from "./threat-ability-triggers-runner.mjs";
import { canSee, executionAuthority, mayApplyPanel, ownerNote, recipients, resolveRollMode, visibilityOf } from "../helpers/threat-ability-visibility.mjs";

// Painel de resolução do Mestre (T09): planeja por alvo (resistência, dano, condições), nada vale até o Mestre aplicar.
// O painel vive numa mensagem de chat só para o Mestre (flag threatAbilityPanel); a janela é uma ApplicationV2.

const SYSTEM = "ordem_v2_classic";
const FLAG = "threatAbilityPanel";
const busy = new Set();

/** Painel privado do Mestre (navegador dele): ver threat-ability-panel-store.mjs sobre por que não vai em flag de chat. */
export const panelStore = () => new PanelStore(globalThis.localStorage, { worldId: game.world.id, userId: game.user.id });
export const loadPanel = (message) => { const id = message?.getFlag(SYSTEM, FLAG)?.panelId; return id ? panelStore().get(id) : null; };

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gmWhisper = () => ChatMessage.getWhisperRecipients("GM").map((user) => user.id);
export const newExecutionId = () => foundry.utils.randomID();

/** Quem pode usar a habilidade e onde ela roda (Mestre ativo resolve; dono/outro Mestre delegam). */
export const authorizeUse = ({ actor, user = game.user }) => executionAuthority({ user, actor, activeGmId: game.users.activeGM?.id ?? null });

/* -------------------------------------------- */
/*  Planejamento                                */
/* -------------------------------------------- */

/**
 * Planeja a resolução para os tokens atingidos. Rola resistência por alvo e dano conforme a política,
 * mas não aplica nada. Devolve o painel (objeto serializável).
 */
export async function planPanel({ item, actor, tokens, executionId = newExecutionId() }) {
	const execution = normalizeExecution(item.system.execution);
	const speaker = ChatMessage.getSpeaker({ actor });
	const targetIds = tokens.map((t) => t.id);
	const entries = execution.damage;
	const rollMode = resolveRollMode({ result: visibilityOf(execution).result, tableMode: game.settings.get("core", "rollMode") });
	const rolls = entries.length ? await rollEntries({ entries, targetIds, item, speaker, rollMode }) : {};
	const saves = execution.save ? await rollSaves({ save: execution.save, tokens, flavor: item.name, rollMode }) : { ok: true, records: tokens.map((t) => ({ targetId: t.id, passed: null, mode: "full", status: "none", attempts: [] })) };
	const byTarget = Object.fromEntries(saves.records.map((r) => [r.targetId, r]));
	const rows = [];
	for (const token of tokens) {
		const save = byTarget[token.id];
		const mode = execution.save ? damageMode(execution.save, save?.passed ?? null) : "full";
		const changes = entries.map((entry, i) => previewChange({ entry, rolled: rolls[i]?.[token.id] ?? 0, mode, snapshot: { type: token.actor.type, system: token.actor.system } }));
		const effects = [];
		for (const [index, effect] of execution.effects.entries()) {
			const rolled = await rollDuration(effect.duration);
			const plan = buildEffectPlan({ effect, passed: execution.save ? save?.passed ?? null : null, rolled, combat: game.combat?.started ? { round: game.combat.round } : null });
			effects.push({ index, rolled, applies: plan.applies, reason: plan.reason ?? null, condition: plan.condition ?? null, support: plan.support ?? null, manual: plan.manual ?? false, notes: plan.notes ?? [], durationKind: plan.duration?.kind ?? null, durationRounds: plan.duration?.rounds ?? null });
		}
		rows.push(createRow({
			targetId: token.id, tokenId: token.id, sceneId: token.parent?.id ?? canvas.scene?.id ?? null, name: token.name, img: token.texture?.src ?? token.actor.img ?? "",
			save: execution.save ? { ...save, skillLabel: execution.save.skill, onSuccess: execution.save.onSuccess } : null, changes, effects, notes: saves.ok ? [] : [`resistência indisponível: ${saves.reason}`]
		}));
	}
	return createPanel({ executionId, itemUuid: item.uuid, itemName: item.name, sourceActorId: actor.id, sourceName: actor.name, sceneId: canvas.scene?.id ?? null, userId: game.user.id, at: Date.now(), rows });
}

/** Cria a mensagem do painel (só Mestre) e uma nota pública sem números. */
export async function createPanelMessage(panel) {
	const actor = game.actors.get(panel.sourceActorId);
	const panelId = foundry.utils.randomID();
	panelStore().prune();
	if (!panelStore().set(panelId, panel)) ui.notifications.warn(game.i18n.localize("op.threatPanel.storeFailed"));
	const message = await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }), whisper: gmWhisper(),
		content: `<article class="threat-ability-panel-card"><p><strong>${escapeHtml(panel.itemName)}</strong> — ${escapeHtml(game.i18n.localize("op.threatPanel.cardNote"))}</p><button type="button" data-action="threat-ability-open-panel"><i class="fa-solid fa-burst"></i> ${escapeHtml(game.i18n.localize("op.threatPanel.open"))}</button></article>`,
		flags: { [SYSTEM]: { [FLAG]: { panelId, itemName: panel.itemName } } }
	});
	const affected = panel.rows.length;
	await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p class="threat-ability-summary">${escapeHtml(panel.itemName)}: ${affected} ${affected === 1 ? "alvo" : "alvos"}. O Mestre aplica o resultado.</p>` });
	return message;
}

/* -------------------------------------------- */
/*  Aplicação e desfazer                        */
/* -------------------------------------------- */

const tokenOf = (row) => game.scenes.get(row.sceneId)?.tokens.get(row.tokenId) ?? null;

/** Valor editado pelo Mestre: grava direto, sem recalcular defesas (o número é o final). */
async function applyEdited({ actor, change, source }) {
	const path = resourcePath(actor.type, change.resource);
	const before = Number(foundry.utils.getProperty(actor, `${path}.value`));
	const amount = Math.max(0, Math.floor(Number(change.edited)));
	const max = Number(foundry.utils.getProperty(actor, `${path}.max`));
	const next = change.kind === "heal" ? Math.min(Number.isFinite(max) ? max : before + amount, before + amount) : Math.max(0, before - amount);
	if (next !== before) await actor.update({ [`${path}.value`]: next });
	const after = Number(foundry.utils.getProperty(actor, `${path}.value`));
	return auditRecord({ source, targetId: actor.id, targetName: actor.name, userId: game.user.id, at: Date.now(), change: { ...change, before, after, finalDamage: change.kind === "heal" ? 0 : amount, healed: change.kind === "heal" ? amount : 0 } });
}

async function executeRow(panel, row, index) {
	const token = tokenOf(row);
	const actor = token?.actor;
	if (!actor) return { ok: false, lines: [`${row.name}: o alvo não está mais na cena.`] };
	const item = fromUuidSync(panel.itemUuid);
	const execution = normalizeExecution(item?.system?.execution);
	const records = [];
	for (const [i, change] of row.changes.entries()) {
		if (!change.supported) { records.push(auditRecord({ source: panel.itemName, targetId: actor.id, targetName: actor.name, change })); continue; }
		const entry = execution?.damage?.[i] ?? { kind: change.kind, resource: change.resource, type: change.type };
		const edited = change.edited !== null && change.edited !== undefined && change.edited !== change.original;
		records.push(edited
			? await applyEdited({ actor, change: { ...change, edited: change.edited }, source: panel.itemName })
			: await applyChange({ actor, entry, change, source: panel.itemName }));
	}
	const effectIds = [];
	for (const fx of row.effects) {
		if (!fx.applies || !execution?.effects?.[fx.index]) continue;
		const result = await applyAbilityEffect({ actor, effect: execution.effects[fx.index], passed: row.save?.passed ?? null, executionId: panel.executionId, itemUuid: panel.itemUuid, sourceActorUuid: game.actors.get(panel.sourceActorId)?.uuid ?? null, effectIndex: fx.index, rolled: fx.rolled });
		if (result.effect) effectIds.push(result.effect.id);
	}
	return { ok: true, records, effectIds, lines: [] };
}

async function persist(message, panel) {
	const id = message.getFlag(SYSTEM, FLAG)?.panelId;
	panelStore().set(id, panel);
	Hooks.callAll("opThreatAbilityPanelChanged", message.id);
}

async function publicNote(panel, text) {
	if (!text) return;
	const actor = game.actors.get(panel.sourceActorId);
	await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p class="threat-ability-applied">${escapeHtml(text)}</p>` });
}

/** Vínculos origem→alvo declarados na habilidade (ex.: "afetado por Falsa Nostalgia"), conforme o resultado da resistência. */
async function grantLinks(panel, row) {
	const item = fromUuidSync(panel.itemUuid);
	const execution = normalizeExecution(item?.system?.execution);
	const source = game.actors.get(panel.sourceActorId);
	if (!execution?.grants?.length || !source) return;
	for (const grant of execution.grants) {
		if (!effectApplies({ onSave: grant.onSave }, row.save?.passed ?? null)) continue;
		await linkTarget({ actor: source, ref: grant.ref, targetId: row.tokenId, executionId: panel.executionId });
	}
}

/** Resultado narrável ao público (se a habilidade deixa) e a mudança real ao dono do agente atingido. */
async function announceApplied(panel, row) {
	const item = fromUuidSync(panel.itemUuid);
	const level = visibilityOf(normalizeExecution(item?.system?.execution)).result;
	if (level === "public") await publicNote(panel, publicLine(row, panel.itemName));
	const actor = game.scenes.get(row.sceneId)?.tokens.get(row.tokenId)?.actor;
	const text = actor?.type === "agent" ? ownerNote({ itemName: panel.itemName, row, level }) : null;
	const to = actor ? recipients({ level: "owner", targetActor: actor, users: game.users }).filter((id) => !game.users.get(id)?.isGM) : [];
	if (text && to.length) await ChatMessage.create({ whisper: to, speaker: ChatMessage.getSpeaker({ actor: game.actors.get(panel.sourceActorId) }), content: `<p class="threat-ability-owner-note">${escapeHtml(text)}</p>` });
}

async function applyIndex(message, panel, index) {
	if (!canApply(panel.rows[index])) return false;
	panel.rows[index] = beginApply(panel.rows[index]);
	await persist(message, panel); // grava "aplicando" antes: um segundo clique ou cliente vê que já está em curso
	let result;
	try {
		result = await executeRow(panel, panel.rows[index], index);
	} catch (error) {
		console.error("Habilidade de ameaça: falha ao aplicar", error);
		result = { ok: false, lines: [error.message] };
	}
	if (!result.ok) {
		panel.rows[index] = abortApply(panel.rows[index]);
		ui.notifications.warn(result.lines.join(" "));
		return false;
	}
	panel.rows[index] = markApplied(panel.rows[index], { records: result.records, effectIds: result.effectIds, at: Date.now(), userId: game.user.id });
	await grantLinks(panel, panel.rows[index]);
	await announceApplied(panel, panel.rows[index]);
	return true;
}

async function undoIndex(panel, index) {
	const row = panel.rows[index];
	const actor = tokenOf(row)?.actor;
	if (!actor) return { ok: false, text: `${row.name}: o alvo não está mais na cena.` };
	const current = {};
	for (const rec of row.applied?.records ?? []) if (rec.path) current[rec.path] = Number(foundry.utils.getProperty(actor, `${rec.path}.value`));
	const check = undoCheck(row, current);
	if (!check.ok) return { ok: false, text: check.instruction ?? "Não foi possível desfazer.", conflict: check.reason === "conflict" };
	for (const r of check.restore) await actor.update({ [`${r.path}.value`]: r.value });
	await removeExecutionEffects(actor, panel.executionId);
	panel.rows[index] = markUndone(row);
	return { ok: true };
}

/**
 * Ação do Mestre no painel. Idempotente por mensagem: cliques repetidos enquanto uma ação roda são ignorados.
 * ações: apply | applyAll | ignore | restore | undo | edit | restorePart
 */
export async function handlePanelAction(messageId, action, data = {}) {
	if (!mayApplyPanel(game.user)) return ui.notifications.warn(game.i18n.localize("op.threatPanel.gmOnly"));
	const message = game.messages.get(messageId);
	const panel = clonePanel(loadPanel(message));
	const issue = panelIssue(panel);
	if (issue) return ui.notifications.warn(game.i18n.localize(`op.threatPanel.issue.${issue}`));
	if (busy.has(messageId)) return;
	busy.add(messageId);
	try {
		const index = Number(data.row);
		let result = null;
		switch (action) {
			case "apply": if (!(await applyIndex(message, panel, index))) return; break;
			case "applyAll": {
				const plan = applyAllPlan(panel.rows);
				if (!plan.count) return ui.notifications.info(game.i18n.localize("op.threatPanel.nothingPending"));
				if (plan.needsConfirm && !(await foundry.applications.api.DialogV2.confirm({ window: { title: game.i18n.localize("op.threatPanel.applyAll") }, content: `<p>${game.i18n.localize("op.threatPanel.confirmEdited")}</p>`, rejectClose: false }))) return;
				for (const i of plan.indexes) await applyIndex(message, panel, i);
				break;
			}
			case "ignore": panel.rows[index] = markIgnored(panel.rows[index]); break;
			case "restore": panel.rows[index] = markRestored(panel.rows[index]); break;
			case "edit": panel.rows[index] = editChange(panel.rows[index], Number(data.change), data.value); break;
			case "restorePart": panel.rows[index] = restoreChange(panel.rows[index], Number(data.change)); break;
			case "undo": {
				result = await undoIndex(panel, index);
				if (!result.ok) {
					ui.notifications.warn(result.text);
					if (result.conflict) await ChatMessage.create({ whisper: gmWhisper(), content: `<p>${escapeHtml(result.text)}</p>` });
					return;
				}
				await publicNote(panel, `${panel.rows[index].name}: ${game.i18n.localize("op.threatPanel.undone")}`);
				break;
			}
			default: return;
		}
		await persist(message, panel);
	} finally {
		busy.delete(messageId);
	}
	return { panel };
}

/** Vincula o alvo à habilidade de origem (T08) quando a execução aplica condição que outras habilidades exigem. */
export const linkAffected = ({ actor, ref, tokenId }) => linkTarget({ actor, ref, targetId: tokenId });

export { ROW_STATE, effectiveAmount, effectApplies, resolveDamageType };
