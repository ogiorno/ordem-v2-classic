/**
 * Pure visibility/permission helpers extracted from chat-message and combat hooks
 * so the visibility rules added by the PR-87 QoL pass have unit-test coverage
 * (Foundry mocks can't easily flip `game.user.isGM` at runtime).
 *
 * Cada função recebe o contexto explicitamente — sem referências globais —
 * para ser executável em Node/Vitest.
 */

/**
 * Whisper recipient list for damage application chat messages.
 *
 * Threats têm donos só MJ (`isGM` users). Agents podem ter donos humanos
 * (`testUserPermission(user, "OWNER") === true`). Para uma criatura, o
 * resultado fica restrito ao MJ — bloqueando o vazamento de HP/RD para a
 * mesa. Para um agente, MJ + dono(s) recebem.
 *
 * @param {object|null} targetActor    Actor com `testUserPermission` (Foundry doc)
 * @param {Iterable<object>} users     Coleção `game.users` (cada user com `isGM`/`id`)
 * @returns {string[]} userIds únicos
 */
export function damageRecipients(targetActor, users) {
	const ids = new Set();
	for (const u of users ?? []) {
		if (u.isGM) ids.add(u.id);
		else if (targetActor?.testUserPermission?.(u, "OWNER")) ids.add(u.id);
	}
	return [...ids];
}

/**
 * Should the combat tracker render the HP block for this combatant to the
 * current viewer?
 *
 *   - Threats: GM-only. Players never see threat HP.
 *   - Agents: GM sees all; players see only agents they own. This mirrors the
 *     token-bar policy (Bar Brawl `ownerVisibility=HOVER`, `otherVisibility=NONE`)
 *     applied at `hooks.mjs:162-174` — the tracker shouldn't be a side-channel
 *     that leaks PV the canvas already hides.
 *
 * @param {object} actor             Actor com `.type` em {"agent","threat"}
 * @param {boolean} viewerIsGM
 * @param {boolean} viewerOwnsActor  Resultado de `actor.isOwner` resolvido pelo chamador
 * @returns {boolean}
 */
export function shouldShowCombatantHP(actor, viewerIsGM, viewerOwnsActor = false) {
	if (!actor) return false;
	if (viewerIsGM) return true;
	if (actor.type === "threat") return false;
	if (actor.type === "agent") return Boolean(viewerOwnsActor);
	return true;
}

/**
 * Should the hit-result block include the numeric Defense value?
 * Visível somente para o MJ ou para o dono do alvo (que já conhece a própria
 * Defesa). Demais espectadores só veem HIT/MISS — não devem inferir o número.
 *
 * @param {object} ctx
 * @param {boolean} ctx.viewerIsGM
 * @param {boolean} ctx.viewerOwnsTarget   Resultado de `actor.isOwner` resolvido pelo chamador
 * @returns {boolean}
 */
export function shouldShowDefenseValue({ viewerIsGM }) {
	// Regra da mesa: nenhum jogador vê o número da Defesa (nem o dono do alvo). Só o mestre.
	return Boolean(viewerIsGM);
}

/**
 * Remove os campos secretos de Defesa de um hitResult antes de ele ser gravado nas flags da mensagem
 * (flags de mensagem chegam a todos os clientes que enxergam a mensagem).
 * @param {object|null} hitResult
 * @returns {object|null}
 */
export function stripDefenseFields(hitResult) {
	if (!hitResult || typeof hitResult !== "object") return hitResult;
	const { targetDefense: _t, baseDefense: _b, ...rest } = hitResult;
	if (Array.isArray(rest.attackResults)) rest.attackResults = rest.attackResults.map((r) => stripDefenseFields(r));
	return rest;
}

/** O hitResult carrega algum campo secreto de Defesa? */
export function hasDefenseFields(hitResult) {
	if (!hitResult || typeof hitResult !== "object") return false;
	if ("targetDefense" in hitResult || "baseDefense" in hitResult) return true;
	return Array.isArray(hitResult.attackResults) && hitResult.attackResults.some((r) => hasDefenseFields(r));
}

/**
 * Defesa mostrada ao mestre: valor antigo da flag (mensagens legadas) ou Defesa atual do ator + bônus de esquiva.
 * @param {{legacy: number|null, live: number|null, dodgeBonus?: number}} ctx
 * @returns {number|null}
 */
export function gmDefenseValue({ legacy, live, dodgeBonus = 0 }) {
	if (legacy !== null && legacy !== undefined) return legacy;
	if (live === null || live === undefined) return null;
	return live + (dodgeBonus || 0);
}

/**
 * Is the current viewer a "participant" in the attack — i.e. allowed to see
 * the hit/miss outcome? Third-party agents not involved in the exchange must
 * NOT see the HIT/MISS card; otherwise the table loses tactical fog (a player
 * watching another player's swing learns the target's Defense indirectly).
 *
 * Participation:
 *   • GM — always (run the table, sees everything).
 *   • Attacker — the user who triggered the roll (recorded via
 *     `flags.ordemparanormal.attackerUserId` at toMessage time).
 *   • Target owner — owner of the actor under attack (per the
 *     `hitResult.actorUuid` flag).
 *
 * Pure function: takes pre-resolved booleans/strings so it's unit-testable
 * without Foundry globals. The caller resolves `viewerOwnsTarget` via the
 * sync UUID helper in chat-message.mjs.
 *
 * @param {object} ctx
 * @param {boolean} ctx.viewerIsGM
 * @param {string|null} ctx.viewerId          `game.userId` of the current viewer
 * @param {string|null|undefined} ctx.attackerUserId  id stored in the attack message flag
 * @param {boolean} ctx.viewerOwnsTarget      Resultado de `actor.isOwner` para o alvo
 * @returns {boolean}
 */
export function isAttackParticipant({ viewerIsGM, viewerId, attackerUserId, viewerOwnsTarget }) {
	if (viewerIsGM) return true;
	if (attackerUserId && viewerId && attackerUserId === viewerId) return true;
	return Boolean(viewerOwnsTarget);
}
