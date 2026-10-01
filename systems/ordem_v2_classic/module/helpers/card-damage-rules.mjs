/**
 * Regras puras da aplicação de dano a partir do cartão de dano (sem Foundry).
 */

export const DAMAGE_APPLICATION_MODES = ["manual-gm", "attacker-click", "auto"];

/**
 * O botão "Aplicar" aparece para este usuário?
 * @param {{viewerIsGM: boolean, viewerId: string, authorId: string|null, mode: string}} ctx
 * @returns {boolean}
 */
export function canApplyDamage({ viewerIsGM, viewerId, authorId, mode }) {
	if (viewerIsGM) return true;
	if (mode === "manual-gm") return false;
	return Boolean(viewerId && authorId && viewerId === authorId);
}

/**
 * Validação, no cliente do GM, de um pedido de aplicação de dano vindo de um jogador.
 * O valor, o alvo e o tipo de dano vêm das flags da mensagem, nunca do pedido.
 * @param {object} ctx
 * @param {{isGM: boolean, id: string}|null} ctx.sender
 * @param {{authorId: string|null, damageTarget: object|null, damageApplied: object|null}|null} ctx.message
 * @param {{hit?: boolean, revealed?: boolean, attackResults?: object[]}|null} ctx.attackHit  hitResult do ataque associado (null se a mensagem não existe mais)
 * @param {string} ctx.mode
 * @param {boolean} ctx.senderOwnsAttacker
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateCardDamageRequest({ sender, message, attackHit, mode, senderOwnsAttacker }) {
	if (!sender || !message) return { ok: false, reason: "missing" };
	if (!message.damageTarget) return { ok: false, reason: "no-target" };
	if (message.damageApplied) return { ok: false, reason: "already-applied" };
	if (sender.isGM) return { ok: true };
	if (mode === "manual-gm") return { ok: false, reason: "mode" };
	if (!message.authorId || message.authorId !== sender.id) return { ok: false, reason: "not-author" };
	if (!senderOwnsAttacker) return { ok: false, reason: "not-owner" };
	if (!attackHit) return { ok: false, reason: "no-attack" };
	const results = attackHit.attackResults?.length ? attackHit.attackResults : [attackHit];
	const landed = results.some((r) => r.hit === true && r.revealed !== false);
	if (!landed) return { ok: false, reason: "not-hit" };
	return { ok: true };
}

/**
 * Leitura qualitativa do alvo depois do dano (o jogador não vê números de PV de ameaças).
 * @param {number} pvAfter
 * @param {number} pvMax
 * @returns {"felt"|"hurt"|"veryHurt"|"down"}
 */
export function damageStateKey(pvAfter, pvMax) {
	if (pvAfter <= 0) return "down";
	const ratio = pvMax > 0 ? pvAfter / pvMax : 0;
	if (ratio > 0.5) return "felt";
	if (ratio > 0.25) return "hurt";
	return "veryHurt";
}

export const UNDO_WINDOW_MS = 2 * 60 * 1000;

/**
 * O GM pode desfazer este dano? Só dentro da janela e se o PV do alvo não mudou desde a aplicação.
 * @param {{isGM: boolean, now: number, appliedAt: number, currentPv: number, pvAfter: number, windowMs?: number}} ctx
 * @returns {{ok: boolean, reason?: string}}
 */
export function canUndoDamage({ isGM, now, appliedAt, currentPv, pvAfter, windowMs = UNDO_WINDOW_MS }) {
	if (!isGM) return { ok: false, reason: "not-gm" };
	if (!(now - appliedAt <= windowMs)) return { ok: false, reason: "expired" };
	if (currentPv !== pvAfter) return { ok: false, reason: "changed" };
	return { ok: true };
}
