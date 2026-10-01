import { gmNotice } from "./gm-notice.mjs";
import { canUndoDamage, damageStateKey } from "./card-damage-rules.mjs";

const SYSTEM = "ordem_v2_classic";

/** Modo de aplicação de dano do mundo: manual-gm | attacker-click | auto. */
export function damageApplicationMode() {
	return game.settings.get(SYSTEM, "damageApplication") ?? "attacker-click";
}

/**
 * Aplica o dano de um cartão de dano. Roda SOMENTE no cliente do GM (ou de quem é dono do alvo):
 * valor, alvo e tipo vêm das flags da mensagem. Idempotente via flag `damageApplied`.
 * @param {ChatMessage} message
 * @param {{byUserId?: string}} [options]
 * @returns {Promise<object|null>}
 */
export async function applyDamageFromMessage(message, { byUserId = game.user.id } = {}) {
	const damageTarget = message?.getFlag(SYSTEM, "damageTarget");
	if (!damageTarget || message.getFlag(SYSTEM, "damageApplied")) return null;
	const targetActor = await fromUuid(damageTarget.actorUuid);
	const roll = message.rolls?.[0];
	if (!targetActor || !roll) return null;

	const attackMsg = damageTarget.attackMessageId ? game.messages.get(damageTarget.attackMessageId) : null;
	const extraRD = attackMsg?.getFlag(SYSTEM, "damageBlock")?.amount ?? 0;
	const max = targetActor.type === "threat" ? targetActor.system.attributes?.hp?.max : targetActor.system.PV?.max;
	const isThreat = targetActor.type === "threat";
	const hpKey = isThreat ? "system.attributes.hp.value" : "system.PV.value";
	const pvBefore = foundry.utils.getProperty(targetActor, hpKey);
	const result = await targetActor.applyDamage(roll.total, { damageType: damageTarget.damageType, extraRD });
	// PV antes/depois ficam no ator (flags de ator não vão para quem não tem permissão), nunca na mensagem.
	if (result.newPV !== null && result.newPV !== undefined) {
		await targetActor.setFlag(SYSTEM, "lastDamage", {
			messageId: message.id,
			pvBefore,
			pvAfter: result.newPV,
			at: Date.now(),
		});
	}

	const blockedNote = result.blocked > 0 ? ` (${game.i18n.format("op.damageBlocked", { blocked: result.blocked })})` : "";
	await gmNotice(
		game.i18n.format("op.gmNotice.damageApplied", {
			by: game.users.get(byUserId)?.name ?? "",
			amount: result.finalDamage,
			target: targetActor.name,
			before: pvBefore,
			after: result.newPV ?? "?",
		}) + blockedNote,
		{ kind: "damage" }
	);

	await message.setFlag(SYSTEM, "damageApplied", {
		at: Date.now(),
		by: byUserId,
		amount: result.finalDamage,
		targetUuid: damageTarget.actorUuid,
		targetName: damageTarget.targetName ?? targetActor.name,
		state: result.newPV === null || result.newPV === undefined ? null : damageStateKey(result.newPV, max ?? 0),
	});
	return result;
}

/**
 * Pede a aplicação do dano de um cartão: o GM aplica direto; o jogador envia um pedido ao GM
 * (que revalida tudo no handler de socket `applyCardDamage`).
 * @param {ChatMessage} message
 */
export async function requestCardDamage(message) {
	if (game.user.isGM) return applyDamageFromMessage(message, { byUserId: game.user.id });
	if (!game.users.some((u) => u.isGM && u.active)) {
		ui.notifications.warn(game.i18n.localize("op.applyDamageNeedsGM"));
		return null;
	}
	game.socket.emit(`system.${SYSTEM}`, { type: "applyCardDamage", messageId: message.id, userId: game.user.id });
	return null;
}

/**
 * Desfaz o último dano aplicado por um cartão (somente GM, 2 minutos, PV do alvo inalterado).
 * @param {ChatMessage} message
 */
export async function undoCardDamage(message) {
	const applied = message?.getFlag(SYSTEM, "damageApplied");
	if (!applied) return false;
	const actor = await fromUuid(applied.targetUuid);
	const last = actor?.getFlag(SYSTEM, "lastDamage");
	if (!actor || !last || last.messageId !== message.id) {
		ui.notifications.warn(game.i18n.localize("op.dmgCard.undoStale"));
		return false;
	}
	const hpKey = actor.type === "threat" ? "system.attributes.hp.value" : "system.PV.value";
	const verdict = canUndoDamage({
		isGM: game.user.isGM,
		now: Date.now(),
		appliedAt: last.at,
		currentPv: foundry.utils.getProperty(actor, hpKey),
		pvAfter: last.pvAfter,
	});
	if (!verdict.ok) {
		ui.notifications.warn(game.i18n.localize(verdict.reason === "expired" ? "op.dmgCard.undoExpired" : "op.dmgCard.undoStale"));
		return false;
	}
	await actor.update({ [hpKey]: last.pvBefore });
	await gmNotice(
		game.i18n.format("op.gmNotice.damageUndone", { target: actor.name, before: last.pvAfter, after: last.pvBefore }),
		{ kind: "damage" }
	);
	await actor.unsetFlag(SYSTEM, "lastDamage");
	await message.unsetFlag(SYSTEM, "damageApplied");
	ui.notifications.info(game.i18n.format("op.dmgCard.undone", { target: actor.name }));
	return true;
}
