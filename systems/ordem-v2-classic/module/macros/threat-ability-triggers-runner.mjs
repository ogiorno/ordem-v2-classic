import { normalizeExecution } from "../helpers/threat-ability-execution.mjs";
import { addLink, claimForTargets, claimFire, cleanupScene, emptyState, endPersistent, pruneCombat, removeLink, stableId } from "../helpers/threat-ability-triggers.mjs";

// Disparo único de gatilhos das habilidades de ameaça (T08). Só o Mestre ativo grava; as chamadas por ator são
// serializadas para que dois eventos simultâneos não concedam o mesmo disparo duas vezes.
// Nada dispara "invisível": início/fim de turno só avisam o Mestre (assistido) e emitem o hook opThreatAbilityTrigger.

const SYSTEM = "ordem-v2-classic";
const STATE_FLAG = "abilityState";
const locks = new Map();

const stateOf = (actor) => ({ ...emptyState(), ...(actor.getFlag(SYSTEM, STATE_FLAG) ?? {}) });
const saveState = (actor, state) => actor.update({ [`flags.${SYSTEM}.==${STATE_FLAG}`]: state });

/** Executa `fn` depois das chamadas anteriores para o mesmo ator. */
function serialized(actor, fn) {
	const previous = locks.get(actor.id) ?? Promise.resolve();
	const next = previous.catch(() => {}).then(fn);
	locks.set(actor.id, next);
	next.finally(() => { if (locks.get(actor.id) === next) locks.delete(actor.id); });
	return next;
}

const sceneOf = () => canvas?.scene?.id ?? null;

export function contextFor(event, { actor, owner = actor, combat = game.combat, targetId = null, at = null } = {}) {
	return {
		event, ownerRelation: owner?.id === actor?.id ? "self" : "target",
		inCombat: !!combat?.started, sceneId: sceneOf(), combatId: combat?.id ?? null,
		round: at?.round ?? combat?.round ?? null, turn: at?.turn ?? combat?.turn ?? null, targetId
	};
}

/**
 * Tenta disparar uma habilidade com gatilho. Devolve { ok, claimed, reason, targets }.
 * `ctx` vem de contextFor(); `targetIds` dispara uma vez por alvo.
 */
export function fireTrigger({ actor, item, ctx, targetIds = null, confirmedNarrative = false }) {
	if (!game.user.isActiveGM) return Promise.resolve({ ok: false, reason: "not-active-gm" });
	const execution = normalizeExecution(item.system.execution);
	if (!execution) return Promise.resolve({ ok: false, reason: "no-execution" });
	return serialized(actor, async () => {
		const state = stateOf(actor);
		const executionId = item.uuid;
		if (targetIds) {
			const result = claimForTargets({ execution, executionId, ctx, targetIds, state, now: Date.now(), confirmedNarrative });
			if (result.claimed.length) await saveState(actor, result.state);
			return { ok: result.claimed.length > 0, claimed: result.claimed.length > 0, targets: result.claimed, skipped: result.skipped, reason: result.claimed.length ? null : result.skipped[0]?.reason ?? "empty" };
		}
		const result = claimFire({ execution, executionId, ctx, state, now: Date.now(), confirmedNarrative });
		if (result.claimed) await saveState(actor, result.state);
		return { ok: result.claimed, claimed: result.claimed, reason: result.reason ?? null };
	});
}

/** Vínculo origem → alvo (ex.: alvo afetado por Falsa Nostalgia). */
export function linkTarget({ actor, ref, targetId, sourceId = actor.id, executionId = null }) {
	return serialized(actor, () => saveState(actor, addLink(stateOf(actor), { ref, sourceId, targetId, sceneId: sceneOf(), executionId })));
}

export function unlinkTarget({ actor, ref, targetId, sourceId = null }) {
	return serialized(actor, () => saveState(actor, removeLink(stateOf(actor), { ref, targetId, sourceId })));
}

/** Encerra uma execução persistente sob comando do Mestre. */
export function endExecution({ actor, executionId }) {
	return serialized(actor, () => saveState(actor, endPersistent(stateOf(actor), executionId)));
}

export function clearSceneState({ actor, sceneId = sceneOf() }) {
	return serialized(actor, () => saveState(actor, cleanupScene(stateOf(actor), sceneId)));
}

const triggeredItems = (actor, event) => actor.items.filter((i) => i.type === "ability" && i.system.execution?.mode === "triggered" && i.system.execution?.trigger?.event === event);

/** Fim/início de turno: avisa o Mestre (assistido) das habilidades que podem disparar agora. */
export async function processTurnTriggers(combat, previous, current) {
	const jobs = [["turnEnd", previous], ["turnStart", current]];
	for (const [event, at] of jobs) {
		const combatant = combat.combatants.get(at?.combatantId);
		if (!combatant) continue;
		for (const holder of combat.combatants.map((c) => c.actor).filter(Boolean)) {
			for (const item of triggeredItems(holder, event)) {
				const ctx = contextFor(event, { actor: holder, owner: combatant.actor, combat, at });
				// só avisa o Mestre: pré-requisito narrativo é confirmado por ele no botão Acionar
				const result = await fireTrigger({ actor: holder, item, ctx, confirmedNarrative: true });
				if (!result.claimed) continue;
				Hooks.callAll("opThreatAbilityTrigger", { event, actor: holder, item, combatant, ctx });
				// id estável: se dois clientes do Mestre processarem o mesmo turno, só o primeiro aviso é criado
				const noticeId = stableId(`${item.uuid}|${event}|${combat.id}|${at.round}|${at.turn}`);
				if (game.messages.has(noticeId)) continue;
				await ChatMessage.create({
					_id: noticeId,
					whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
					speaker: ChatMessage.getSpeaker({ actor: holder }),
					content: `<p>${game.i18n.format("op.threatExec.triggerNotice", { ability: item.name, actor: holder.name, event: game.i18n.localize(`op.threatExec.triggerEvent.${event}`), who: combatant.name })}</p>`,
					flags: { [SYSTEM]: { abilityTrigger: { itemUuid: item.uuid, event, combatantId: combatant.id, round: at.round, turn: at.turn } } }
				}, { keepId: true }).catch((error) => console.debug("Habilidade de ameaça: aviso de gatilho já criado por outro cliente", error.message));
			}
		}
	}
}

export function registerTriggerHooks() {
	Hooks.on("combatTurnChange", async (combat, previous, current) => {
		if (!game.user.isActiveGM) return;
		try {
			await processTurnTriggers(combat, previous, current);
		} catch (error) {
			console.error("Habilidade de ameaça: falha ao processar gatilhos do turno", error);
		}
	});
	Hooks.on("deleteCombat", async (combat) => {
		if (!game.user.isActiveGM) return;
		for (const actor of combat.combatants.map((c) => c.actor).filter(Boolean)) {
			const state = stateOf(actor);
			if (Object.keys(state.fired).length || Object.keys(state.uses).length) await serialized(actor, () => saveState(actor, pruneCombat(state, combat.id)));
		}
	});
}
