// Painel de resolução do Mestre para habilidades de ameaça (lógica pura, sem Foundry).
// O motor planeja (alvos, resistência, dano, condições); nada vale até o Mestre aplicar. Cada linha guarda o que
// foi feito (valor anterior/posterior) para desfazer só a mudança própria, com checagem de conflito.

export const PANEL_VERSION = 1;
export const ROW_STATE = Object.freeze({ PENDING: "pending", APPLYING: "applying", APPLIED: "applied", IGNORED: "ignored", DISABLED: "disabled" });

const clone = (v) => JSON.parse(JSON.stringify(v));
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

/**
 * Linha de um alvo.
 * `changes`: resultados de previewChange (T06); `effects`: planos de buildEffectPlan (T07) já com o índice do efeito;
 * `save`: registro de buildSaveRecord (T05) ou null.
 */
export function createRow({ targetId, tokenId = null, sceneId = null, name, img = "", save = null, changes = [], effects = [], notes = [], disabledReason = null }) {
	return {
		targetId, tokenId, sceneId, name, img, save, notes, disabledReason,
		changes: changes.map((c) => ({ ...c, original: c.kind === "heal" ? int(c.healed) : int(c.finalDamage), edited: null })),
		effects,
		state: disabledReason ? ROW_STATE.DISABLED : ROW_STATE.PENDING,
		applied: null
	};
}

export function createPanel({ executionId, itemUuid = null, itemName, sourceActorId, sourceName, rows, sceneId = null, userId = null, at = null }) {
	return { version: PANEL_VERSION, executionId, itemUuid, itemName, sourceActorId, sourceName, sceneId, userId, at, rows };
}

export const canApply = (row) => row?.state === ROW_STATE.PENDING;
export const pendingIndexes = (rows) => rows.map((row, i) => (canApply(row) ? i : -1)).filter((i) => i >= 0);
export const pendingCount = (rows) => pendingIndexes(rows).length;

/** Valor atual do campo editável de uma mudança: o editado, ou o original calculado. */
export const effectiveAmount = (change) => (change.edited !== null && change.edited !== undefined ? change.edited : change.original);
export const rowEdited = (row) => row.changes.some((c) => c.edited !== null && c.edited !== undefined && c.edited !== c.original);

/** Edita o valor final de uma mudança (só em linha pendente). Inválido/negativo vira 0; igual ao original limpa a edição. */
export function editChange(row, index, value) {
	if (!canApply(row) || !row.changes[index] || !row.changes[index].supported) return row;
	const n = int(value);
	return { ...row, changes: row.changes.map((c, i) => (i === index ? { ...c, edited: n === c.original ? null : n } : c)) };
}

export function restoreChange(row, index) {
	if (!canApply(row) || !row.changes[index]) return row;
	return { ...row, changes: row.changes.map((c, i) => (i === index ? { ...c, edited: null } : c)) };
}

/** Pendente → aplicando: impede segundo clique (e segundo cliente) antes de a primeira aplicação terminar. */
export function beginApply(row) {
	return canApply(row) ? { ...row, state: ROW_STATE.APPLYING } : row;
}

/** Aplicando → aplicado, com o registro auditável (valores antes/depois, efeitos criados). */
export function markApplied(row, result) {
	if (row?.state !== ROW_STATE.APPLYING) return row;
	return { ...row, state: ROW_STATE.APPLIED, applied: { records: result.records ?? [], effectIds: result.effectIds ?? [], at: result.at ?? null, userId: result.userId ?? null, lines: result.lines ?? [] } };
}

/** Falha na aplicação: volta a pendente sem registro (nada foi mantido). */
export function abortApply(row) {
	return row?.state === ROW_STATE.APPLYING ? { ...row, state: ROW_STATE.PENDING, applied: null } : row;
}

export function markUndone(row) {
	return row?.state === ROW_STATE.APPLIED ? { ...row, state: ROW_STATE.PENDING, applied: null } : row;
}

export const markIgnored = (row) => (row?.state === ROW_STATE.PENDING ? { ...row, state: ROW_STATE.IGNORED } : row);
export const markRestored = (row) => (row?.state === ROW_STATE.IGNORED || row?.state === ROW_STATE.DISABLED ? { ...row, state: ROW_STATE.PENDING } : row);

export const rowStateLabel = (row) => ({ pending: "Pendente", applying: "Aplicando", applied: "Aplicado", ignored: "Ignorado", disabled: "Desabilitado" }[row?.state] ?? "");

/** "Aplicar todos" age só nas pendentes; pede confirmação se alguma foi editada. */
export function applyAllPlan(rows) {
	const indexes = pendingIndexes(rows);
	return { count: indexes.length, indexes, needsConfirm: indexes.some((i) => rowEdited(rows[i])) };
}

/**
 * Desfazer com checagem de conflito. `current` mapeia o caminho do recurso (ex.: "system.PV", valor = PV atual) → valor atual do alvo.
 * Sem conflito: devolve os valores a restaurar. Com conflito (valor mudou depois): não reverte; instrui ajuste manual.
 */
export function undoCheck(row, current) {
	if (row?.state !== ROW_STATE.APPLIED) return { ok: false, reason: "not-applied" };
	const restore = [];
	const conflicts = [];
	for (const rec of row.applied?.records ?? []) {
		if (!rec.supported || rec.before === null || rec.before === undefined || rec.before === rec.after) continue;
		const path = rec.path;
		const now = Number(current[path]);
		if (now === rec.after) restore.push({ path, value: rec.before, after: rec.after, resource: rec.resource });
		else conflicts.push({ path, expected: rec.after, now, before: rec.before, resource: rec.resource });
	}
	if (conflicts.length) return { ok: false, reason: "conflict", conflicts, instruction: conflictText(row.name, conflicts) };
	return { ok: true, restore, effectIds: row.applied?.effectIds ?? [] };
}

export function conflictText(name, conflicts) {
	const parts = conflicts.map((c) => `${c.resource?.toUpperCase?.() ?? c.path}: estava ${c.expected} após a aplicação e agora é ${c.now} (antes era ${c.before})`);
	return `${name}: houve alteração depois da aplicação (${parts.join("; ")}). Ajuste manualmente na ficha; nada foi revertido.`;
}

/** Resumo público (sem números nem DT): só o que é narrável. */
export function publicLine(row, itemName) {
	if (row.state === ROW_STATE.IGNORED || row.state === ROW_STATE.DISABLED) return null;
	const dealt = row.changes.some((c) => c.kind === "damage" && c.supported && effectiveAmount(c) > 0);
	const healed = row.changes.some((c) => c.kind === "heal" && c.supported && effectiveAmount(c) > 0);
	const conds = row.effects.filter((e) => e.applies && !e.hidden).map((e) => e.condition?.label).filter(Boolean);
	const bits = [];
	if (dealt) bits.push("sofreu dano");
	if (healed) bits.push("foi curado");
	if (row.save?.passed === true && !bits.length && !conds.length) bits.push("resistiu");
	if (conds.length) bits.push(`ficou ${conds.join(", ")}`);
	if (!bits.length) bits.push("foi afetado");
	return `${row.name} ${bits.join(" e ")} por ${itemName}.`;
}

/** Mensagem antiga ou de esquema desconhecido não quebra o painel. */
export function panelIssue(panel) {
	if (!panel || typeof panel !== "object") return "missing";
	if (!Array.isArray(panel.rows)) return "corrupt";
	if ((panel.version ?? 0) > PANEL_VERSION) return "newer-version";
	return null;
}

export const clonePanel = (panel) => clone(panel);
