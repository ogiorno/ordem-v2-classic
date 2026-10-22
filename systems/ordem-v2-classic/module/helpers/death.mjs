// Ferimentos e morte do agente: 0 PV vira Inconsciente + Morrendo, três turnos morrendo na mesma cena matam,
// Dano Massivo e estabilização com Medicina. Regras puras: death-rules.mjs. Spec: docs/arquivo/spec-morte-do-jogador.md.
// Roda no cliente do Mestre (ele tem permissão sobre as fichas).

import { activeConditions, conditionEffectData } from "./conditions.mjs";
import { DYING_TURN_LIMIT, STABILIZED_PV, downedState, dyingTurnOutcome, stabilizeDT, threatShouldDie, tokensAdjacent } from "./death-rules.mjs";

const SYSTEM = "ordem-v2-classic";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const busy = new Set();

export const isDead = (actor) => actor.statuses?.has("dead") ?? false;
export const isDying = (actor) => activeConditions(actor, "dying").length > 0;

/** Passa o ator ao estado de queda (Inconsciente e/ou Morrendo) conforme os PV; devolve se ficou morrendo agora. */
export async function syncDownedState(actor) {
	if (actor?.type !== "agent" || isDead(actor) || busy.has(actor.id)) return false;
	busy.add(actor.id);
	try {
		const { dying, unconscious } = downedState({ pv: actor.system.PV?.value, nonLethal: actor.system.PV?.nonLethal });
		const toCreate = [];
		let becameDying = false;
		if (dying && !isDying(actor)) { toCreate.push(conditionEffectData("dying")); becameDying = true; }
		if (unconscious && !activeConditions(actor, "unconscious").length) toCreate.push(conditionEffectData("unconscious"));
		if (toCreate.length) await actor.createEmbeddedDocuments("ActiveEffect", toCreate);
		// Qualquer cura de pelo menos 1 PV encerra Inconsciente; Morrendo só sai com Medicina.
		if (!unconscious) {
			const wake = activeConditions(actor, "unconscious").map((effect) => effect.id);
			if (wake.length) {
				await actor.deleteEmbeddedDocuments("ActiveEffect", wake);
				await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${escapeHtml(actor.name)} recobra a consciência.</p>` });
			}
		}
		if (becameDying) await postDyingCard(actor);
		return becameDying;
	} finally {
		busy.delete(actor.id);
	}
}

async function postDyingCard(actor) {
	const dt = stabilizeDT(actor.getFlag(SYSTEM, "stabilizations"));
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="op-turn-save"><p><strong>${escapeHtml(actor.name)}</strong> chegou a 0 PV: <strong>inconsciente e morrendo</strong>. Ao iniciar ${DYING_TURN_LIMIT} turnos morrendo na mesma cena, morre.</p>
			<p>Um aliado adjacente pode estabilizar com Medicina (DT ${dt}).</p>
			<button type="button" data-action="stabilize"><i class="fa-solid fa-kit-medical"></i> Estabilizar (Medicina DT ${dt})</button></div>`,
		flags: { [SYSTEM]: { stabilizePending: { actorId: actor.id, resolved: false } } },
	});
}

/** Início do turno de um agente morrendo: conta o turno e, no terceiro, morre. */
export async function processDyingAtTurnStart(combatant) {
	const actor = combatant?.actor;
	if (actor?.type !== "agent" || !isDying(actor) || isDead(actor)) return null;
	const count = (Number(actor.getFlag(SYSTEM, "dyingTurns")) || 0) + 1;
	await actor.setFlag(SYSTEM, "dyingTurns", count);
	const speaker = ChatMessage.getSpeaker({ actor });
	if (dyingTurnOutcome(count) === "dead") {
		await actor.toggleStatusEffect("dead", { active: true, overlay: true });
		await ChatMessage.create({ speaker, content: `<p><strong>${escapeHtml(actor.name)}</strong> iniciou o ${count}º turno morrendo e <strong>morreu</strong>.</p>` });
		return "dead";
	}
	await ChatMessage.create({ speaker, content: `<p><strong>${escapeHtml(actor.name)}</strong> está morrendo: turno ${count} de ${DYING_TURN_LIMIT}.</p>` });
	return "dying";
}

/** Dano Massivo: Fortitude falhou → o dano zera os PV. Devolve true se o agente cai. */
export async function massiveDamageSave(actor, damage, dt) {
	const { autoRoll } = await import("../macros/ritual-area-engine.mjs");
	const result = await autoRoll(actor, "resilience", dt);
	const failed = result ? result.success === false : false;
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<p>Dano massivo (${damage}): Fortitude DT ${dt} — ${failed ? "<strong>falhou</strong>: cai a 0 PV." : "passou: aguenta o golpe."}</p>`,
	});
	return failed;
}

/** Médico e caído lado a lado na cena atual. Sem token dos dois na mesma cena não há como medir: vale. */
function medicIsAdjacent(medic, actor) {
	const scene = canvas?.scene;
	if (!scene) return true;
	const tokenOf = (target) => scene.tokens.find((token) => token.actor?.id === target.id);
	const a = tokenOf(medic);
	const b = tokenOf(actor);
	if (!a || !b) return true;
	// tokens menores que o quadrado (0,7) ocupam o quadrado inteiro: mede por quadrados do grid
	const g = scene.grid.size;
	const rect = (token) => {
		const x0 = Math.floor(token.x / g) * g;
		const y0 = Math.floor(token.y / g) * g;
		return { x: x0, y: y0, width: Math.ceil((token.x + token.width * g) / g) * g - x0, height: Math.ceil((token.y + token.height * g) / g) * g - y0 };
	};
	return tokensAdjacent(rect(a), rect(b));
}

/**
 * Estabiliza o agente da carta: Medicina do `medic` contra a DT (20, +5 por estabilização na cena).
 * Sucesso encerra Morrendo e Inconsciente e deixa 1 PV (se estava a 0). Devolve "stabilized" | "failed" | "far" | null.
 */
export async function resolveStabilize(messageId, medic) {
	const message = game.messages.get(messageId);
	const flag = message?.getFlag(SYSTEM, "stabilizePending");
	const actor = flag ? game.actors.get(flag.actorId) : null;
	if (!actor || !medic) return null;
	if (!isDying(actor) || isDead(actor)) {
		await message.setFlag(SYSTEM, "stabilizePending", { ...flag, resolved: true });
		return null;
	}
	if (medic.id === actor.id || activeConditions(medic, "unconscious").length) {
		ui.notifications.warn("Quem estabiliza precisa estar consciente e ser outra pessoa.");
		return null;
	}
	if (!medicIsAdjacent(medic, actor)) {
		ui.notifications.warn(`${medic.name} precisa estar adjacente a ${actor.name} para estabilizar.`);
		return "far";
	}
	const times = Number(actor.getFlag(SYSTEM, "stabilizations")) || 0;
	const dt = stabilizeDT(times);
	const { autoRoll } = await import("../macros/ritual-area-engine.mjs");
	const roll = await autoRoll(medic, "medicine", dt);
	if (!roll?.success) {
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: medic }), content: `<p>${escapeHtml(medic.name)} não conseguiu estabilizar ${escapeHtml(actor.name)} (Medicina ${roll?.total ?? "?"} contra DT ${dt}).</p>` });
		return "failed";
	}
	const ids = [...activeConditions(actor, "dying"), ...activeConditions(actor, "unconscious")].map((effect) => effect.id);
	if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
	await actor.setFlag(SYSTEM, "stabilizations", times + 1);
	if (Number(actor.system.PV.value) <= 0) await actor.update({ "system.PV.value": STABILIZED_PV });
	await message.setFlag(SYSTEM, "stabilizePending", { ...flag, resolved: true });
	await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: medic }), content: `<p>${escapeHtml(medic.name)} estabilizou ${escapeHtml(actor.name)}: sai de morrendo e fica com ${Math.max(STABILIZED_PV, Number(actor.system.PV.value))} PV.</p>` });
	return "stabilized";
}

/** Fim da cena (combate apagado): zera a contagem de turnos morrendo e de estabilizações. */
async function resetScene(combat) {
	for (const combatant of combat.combatants) {
		const actor = combatant.actor;
		if (actor?.type !== "agent") continue;
		if (actor.getFlag(SYSTEM, "dyingTurns") !== undefined) await actor.unsetFlag(SYSTEM, "dyingTurns");
		if (actor.getFlag(SYSTEM, "stabilizations") !== undefined) await actor.unsetFlag(SYSTEM, "stabilizations");
	}
}

/** Ameaça a 0 PV: marca como morta (caveira no token, derrotada no combate). Curada acima de 0, volta à vida. */
export async function syncThreatDeath(actor) {
	if (actor?.type !== "threat") return false;
	const hp = actor.system.attributes?.hp;
	const shouldDie = threatShouldDie({ hp: hp?.value, max: hp?.max });
	if (shouldDie === isDead(actor)) return shouldDie;
	await actor.toggleStatusEffect("dead", { active: shouldDie, overlay: shouldDie });
	if (shouldDie) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p><strong>${escapeHtml(actor.name)}</strong> chegou a 0 PV e <strong>morreu</strong>.</p>` });
	return shouldDie;
}

/** Espera o final do elemento aparecer antes de marcar a ameaça como morta (só no cliente do Mestre; sem token, nada). */
async function waitForDeathFx(actor) {
	const hp = actor.system.attributes?.hp?.value;
	if (!(hp <= 0)) return;
	const { deathFxDelayMs } = await import("../integrations/damage-fx.mjs");
	const wait = deathFxDelayMs(actor);
	if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

export function registerDeathHooks() {
	Hooks.on("updateActor", async (actor, changes) => {
		if (game.user.isActiveGM && actor.type === "threat" && foundry.utils.getProperty(changes, "system.attributes.hp.value") !== undefined) {
			try { await waitForDeathFx(actor); await syncThreatDeath(actor); } catch (error) { console.error("Morte da ameaça: falha ao marcar", error); }
			return;
		}
		if (!game.user.isActiveGM || actor.type !== "agent") return;
		if (foundry.utils.getProperty(changes, "system.PV.value") === undefined && foundry.utils.getProperty(changes, "system.PV.nonLethal") === undefined) return;
		try { await syncDownedState(actor); } catch (error) { console.error("Morte do agente: falha ao atualizar o estado", error); }
	});
	Hooks.on("combatTurnChange", async (combat, _previous, current) => {
		if (!game.user.isActiveGM) return;
		const combatant = combat.combatants.get(current?.combatantId);
		try { await processDyingAtTurnStart(combatant); } catch (error) { console.error("Morte do agente: falha ao contar o turno", error); }
	});
	Hooks.on("deleteCombat", async (combat) => {
		if (!game.user.isActiveGM) return;
		try { await resetScene(combat); } catch (error) { console.error("Morte do agente: falha ao zerar a cena", error); }
	});
}
