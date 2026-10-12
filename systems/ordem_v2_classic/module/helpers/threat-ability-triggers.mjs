// Gatilhos, limites e vínculos das habilidades de ameaça (lógica pura, sem Foundry).
// Evento sempre explícito: nada de inferir "quando enxerga", "sempre que se move" a partir do texto.
// O estado (`state`) é um objeto simples guardado numa flag do ator de origem; as funções devolvem cópias.

/** Estado vazio. `fired`: chaves já disparadas; `uses`: contagem por escopo; `links`: vínculos origem→alvo; `ended`: execuções encerradas. */
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Id de documento (16 caracteres base 62) derivado de uma chave: criar duas vezes com o mesmo id falha no servidor. */
export function stableId(key) {
	let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
	for (let i = 0; i < key.length; i++) {
		const c = key.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 2654435761);
		h2 = Math.imul(h2 ^ c, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	let n = (BigInt(h2 >>> 0) << 32n) | BigInt(h1 >>> 0);
	let out = "";
	for (let i = 0; i < 16; i++) { out += B62[Number(n % 62n)]; n = (n / 62n) + BigInt(i + 1) * 977n; }
	return out;
}

export const emptyState = () => ({ fired: {}, uses: {}, links: [], ended: {} });

/** Chaves de objeto não podem ter ponto (o Foundry expande "a.b" em objetos aninhados ao gravar flags). */
const safe = (value) => String(value ?? "").replaceAll(".", "~");
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
const norm = (state) => ({ ...emptyState(), ...(clone(state) ?? {}) });

/** Escopo do evento: turno/rodada de um combate, ou a cena. */
export function scopeKey({ event, combatId = null, round = null, turn = null, sceneId = null, targetId = null }) {
	const t = targetId ? `:${targetId}` : "";
	if (["turnStart", "turnEnd"].includes(event)) return `${event}:${combatId}:${round}:${turn}${t}`;
	if (event === "reaction") return `reaction:${combatId}:${round}:${turn}${t}`;
	if (["enter", "leave"].includes(event)) return `${event}:${sceneId}:${combatId}:${round}:${turn}${t}`;
	return `${event}:${sceneId}:${combatId}:${round}:${turn}${t}`; // manual: mesmo turno/rodada = mesmo disparo (clique repetido)
}

/** Chave de idempotência de um disparo. */
export const fireKey = (executionId, ctx) => `${safe(executionId)}|${scopeKey(ctx)}`;

const countKey = (kind, executionId, ctx) => (kind === "perScene" ? `scene:${ctx.sceneId}:${safe(executionId)}` : `round:${ctx.combatId}:${ctx.round}:${safe(executionId)}`);

/**
 * Pode disparar? Confere evento, dono, estado de combate, pré-requisitos e duplicação. Não altera o estado.
 * `ctx`: { event, ownerRelation: "self"|"target"|"any", inCombat, sceneId, combatId, round, turn, targetId }
 */
export function canFire({ execution, executionId, ctx, state, skipLinks = false, confirmedNarrative = false }) {
	const s = norm(state);
	// habilidade ativa sem gatilho declarado vale como uso manual pelo botão Usar
	const trigger = execution?.trigger ?? (ctx?.event === "manual" && execution?.mode !== "triggered" ? { event: "manual", owner: "any" } : null);
	if (!trigger?.event) return { ok: false, reason: "no-trigger" };
	if (s.ended[safe(executionId)]) return { ok: false, reason: "ended" };
	if (trigger.event !== ctx.event) return { ok: false, reason: "wrong-event" };
	if (trigger.owner && trigger.owner !== "any" && ctx.ownerRelation && trigger.owner !== ctx.ownerRelation) return { ok: false, reason: "wrong-owner" };
	if (Object.hasOwn(s.fired, fireKey(executionId, ctx))) return { ok: false, reason: "duplicate" };
	for (const req of execution.requirements ?? []) {
		if (req.kind === "combat" && !ctx.inCombat) return { ok: false, reason: "needs-combat" };
		if (req.kind === "narrative" && !confirmedNarrative) return { ok: false, reason: "needs-gm-confirmation" };
		if (["perScene", "perRound"].includes(req.kind)) {
			const used = s.uses[countKey(req.kind, executionId, ctx)] ?? 0;
			if (used >= (req.count ?? 1)) return { ok: false, reason: req.kind === "perScene" ? "scene-limit" : "round-limit" };
		}
		if (req.kind === "affectedBy" && !skipLinks && !isLinked(s, { ref: req.ref, targetId: ctx.targetId })) return { ok: false, reason: "not-linked" };
	}
	return { ok: true };
}

/** Registra o disparo (atômico dentro do estado): grava a chave e soma os limites. Devolve o novo estado. */
export function claimFire({ execution, executionId, ctx, state, now = 0, skipLinks = false, confirmedNarrative = false }) {
	const check = canFire({ execution, executionId, ctx, state, skipLinks, confirmedNarrative });
	if (!check.ok) return { claimed: false, reason: check.reason, state: norm(state) };
	const s = norm(state);
	s.fired[fireKey(executionId, ctx)] = now;
	for (const req of execution.requirements ?? []) {
		if (["perScene", "perRound"].includes(req.kind)) {
			const key = countKey(req.kind, executionId, ctx);
			s.uses[key] = (s.uses[key] ?? 0) + 1;
		}
	}
	return { claimed: true, state: s };
}

/* ---- Vínculos origem → alvo (ex.: Falsa Nostalgia → Absorver Memórias) ---- */

export function addLink(state, { ref, sourceId, targetId, sceneId = null, executionId = null }) {
	const s = norm(state);
	if (!s.links.some((l) => l.ref === ref && l.targetId === targetId && l.sourceId === sourceId)) s.links.push({ ref, sourceId, targetId, sceneId, executionId });
	return s;
}

export const isLinked = (state, { ref, targetId, sourceId = null }) =>
	norm(state).links.some((l) => l.ref === ref && l.targetId === targetId && (sourceId === null || l.sourceId === sourceId));

/** Remove o vínculo (ex.: o Mestre tirou a condição). Não desfaz o que já foi resolvido, só impede usos futuros. */
export function removeLink(state, { ref, targetId, sourceId = null }) {
	const s = norm(state);
	s.links = s.links.filter((l) => !(l.ref === ref && l.targetId === targetId && (sourceId === null || l.sourceId === sourceId)));
	return s;
}

/* ---- Encerramento e troca de cena ---- */

/** Encerra uma área/efeito persistente por comando; novos disparos são recusados. */
export function endPersistent(state, executionId) {
	const s = norm(state);
	s.ended[safe(executionId)] = true;
	return s;
}

/** Limpa limites e vínculos de uma cena (troca de cena ou fim de combate). */
export function cleanupScene(state, sceneId) {
	const s = norm(state);
	for (const key of Object.keys(s.uses)) if (key.startsWith(`scene:${sceneId}:`)) delete s.uses[key];
	s.links = s.links.filter((l) => l.sceneId !== sceneId);
	return s;
}

/** Remove limites por rodada de combates antigos e chaves de disparo velhas (cleanup). */
export function pruneCombat(state, combatId) {
	const s = norm(state);
	for (const key of Object.keys(s.uses)) if (key.startsWith(`round:${combatId}:`)) delete s.uses[key];
	for (const key of Object.keys(s.fired)) if (key.includes(`:${combatId}:`)) delete s.fired[key];
	return s;
}

/**
 * Vários alvos no mesmo evento: o uso (limites, duplicação) é contado uma vez para o lote; cada alvo é
 * processado no máximo uma vez e só se cumprir o vínculo exigido.
 */
export function claimForTargets({ execution, executionId, ctx, targetIds, state, now = 0, confirmedNarrative = false }) {
	const batch = claimFire({ execution, executionId, ctx: { ...ctx, targetId: null }, state, now, skipLinks: true, confirmedNarrative });
	if (!batch.claimed) return { claimed: [], skipped: targetIds.map((targetId) => ({ targetId, reason: batch.reason })), state: batch.state };
	const s = batch.state;
	const claimed = [];
	const skipped = [];
	for (const targetId of targetIds) {
		const key = fireKey(executionId, { ...ctx, targetId });
		const needsLink = (execution.requirements ?? []).find((r) => r.kind === "affectedBy");
		if (needsLink && !isLinked(s, { ref: needsLink.ref, targetId })) skipped.push({ targetId, reason: "not-linked" });
		else if (Object.hasOwn(s.fired, key)) skipped.push({ targetId, reason: "duplicate" });
		else { s.fired[key] = now; claimed.push(targetId); }
	}
	return { claimed, skipped, state: s };
}
