// Lógica pura do Painel de Resolução da Área (docs/arquivo/spec-fluxo-conjuracao-rapida.md, FC-45 a FC-49b e UI-20 a UI-28).
// O motor resolve a área (acha os afetados, rola resistência e dano) mas não aplica nada: cada linha fica pendente
// até o Mestre clicar em Aplicar. Aqui ficam as contas e as transições de estado, sem Foundry.

export const ROW_STATE = Object.freeze({ PENDING: "pending", APPLIED: "applied", IGNORED: "ignored", DISABLED: "disabled" });

/**
 * Dano final de uma parte, conforme a resistência (a mesma conta do motor automático).
 * @param {number} amount  dano rolado (inteiro ≥ 0)
 * @param {{success?:string}|null} save   regra da resistência ("half" | "none" | "negates" | "full")
 * @param {boolean|null} passed           resultado do teste do alvo (null = sem teste)
 * @param {boolean} [damageOnFailOnly]
 */
export function partDamage(amount, save, passed, damageOnFailOnly = false) {
	const full = Math.max(0, Math.floor(Number(amount) || 0));
	if (damageOnFailOnly && passed) return 0;
	if (!passed || !save) return full;
	if (save.success === "half") return Math.floor(full / 2);
	if (save.success === "none" || save.success === "negates") return 0;
	return full;
}

/** Texto curto de como a resistência alterou o dano de um alvo. */
export function resistMode(save, passed) {
	if (!save || passed === null || passed === undefined) return "total";
	if (!passed) return "total";
	if (save.success === "half") return "metade";
	if (save.success === "none" || save.success === "negates") return "anulado";
	return "total";
}

/**
 * Monta uma linha pendente do painel.
 * @param {object} p
 * @param {string} p.tokenId
 * @param {string} p.sceneId
 * @param {string} p.name
 * @param {string} [p.img]
 * @param {{skill:string,total:number|null,dt:number,passed:boolean|null}|null} [p.save]
 * @param {{type:string,full:number,amount:number}[]} [p.parts]  `full` = dano rolado, `amount` = dano já com a resistência
 * @param {{key?:string,label?:string,rounds?:number|string|null,oncePerScene?:boolean}[]} [p.conditions]
 * @param {string[]} [p.notes]
 * @param {string|null} [p.disabledReason]  alvo que a regra não afeta (aliado): linha desabilitada, o Mestre pode habilitar
 */
export function createRow({ tokenId, sceneId, name, img = "", save = null, parts = [], conditions = [], notes = [], disabledReason = null }) {
	return {
		tokenId, sceneId, name, img, save,
		parts: parts.map((part) => ({ type: part.type, full: part.full, amount: part.amount, original: part.amount })),
		conditions, notes,
		state: disabledReason ? ROW_STATE.DISABLED : ROW_STATE.PENDING,
		disabledReason,
		applied: null,
	};
}

export const rowTotal = (row) => row.parts.reduce((sum, part) => sum + Math.max(0, Math.floor(Number(part.amount) || 0)), 0);
export const rowEdited = (row) => row.parts.some((part) => part.amount !== part.original);

export const canApplyRow = (row) => row?.state === ROW_STATE.PENDING;
export const pendingRows = (rows) => rows.filter(canApplyRow);
export const pendingCount = (rows) => pendingRows(rows).length;

/** Edita o dano de uma parte (UI-23). Valor inválido ou negativo vira 0; só linhas pendentes são editáveis. */
export function editPart(row, partIndex, value) {
	if (!canApplyRow(row) || !row.parts[partIndex]) return row;
	const amount = Math.max(0, Math.floor(Number(value)));
	return { ...row, parts: row.parts.map((part, index) => (index === partIndex ? { ...part, amount: Number.isFinite(amount) ? amount : 0 } : part)) };
}

export function restorePart(row, partIndex) {
	if (!canApplyRow(row) || !row.parts[partIndex]) return row;
	return { ...row, parts: row.parts.map((part, index) => (index === partIndex ? { ...part, amount: part.original } : part)) };
}

/** Linha aplicada: guarda o que foi feito para poder desfazer (PV perdidos e efeitos criados). */
export function markApplied(row, result) {
	if (!canApplyRow(row)) return row;
	return { ...row, state: ROW_STATE.APPLIED, applied: { dealt: result?.dealt ?? 0, hpBefore: result?.hpBefore ?? null, effectIds: result?.effectIds ?? [], lines: result?.lines ?? [] } };
}

/** Desfazer: volta a pendente e esquece o registro (o motor devolve os PV e apaga os efeitos). */
export function markUndone(row) {
	if (row?.state !== ROW_STATE.APPLIED) return row;
	return { ...row, state: ROW_STATE.PENDING, applied: null };
}

export function markIgnored(row) {
	return row?.state === ROW_STATE.PENDING ? { ...row, state: ROW_STATE.IGNORED } : row;
}

/** Reativar uma linha ignorada ou habilitar um aliado desabilitado (UI-25). */
export function markRestored(row) {
	return row?.state === ROW_STATE.IGNORED || row?.state === ROW_STATE.DISABLED ? { ...row, state: ROW_STATE.PENDING } : row;
}

/** Rótulo e texto do estado (nunca só cor: UI-21). */
export function rowStateLabel(row) {
	return { pending: "Pendente", applied: "Aplicado", ignored: "Ignorado", disabled: "Desabilitado" }[row?.state] ?? "";
}

/** "Aplicar em todos" age só nas pendentes (UI-22); há confirmação se alguma tem dano editado. */
export function applyAllPlan(rows) {
	const pending = pendingRows(rows);
	return { count: pending.length, indexes: rows.map((row, index) => (canApplyRow(row) ? index : -1)).filter((index) => index >= 0), needsConfirm: pending.some(rowEdited) };
}

/** Resumo para os jogadores (FC-49b): só quantos foram afetados, sem dano nem resistência. */
export function publicSummary({ ritualName, rows }) {
	const affected = rows.filter((row) => row.state !== ROW_STATE.DISABLED).length;
	if (!affected) return `${ritualName}: nenhuma ameaça na área.`;
	return `${ritualName} na área: ${affected} afetado${affected > 1 ? "s" : ""}.`;
}

/** Linha de chat público depois de aplicar (UI-26). */
export function appliedLine(row) {
	const dealt = row.applied?.dealt ?? rowTotal(row);
	const types = row.parts.filter((part) => part.amount > 0).map((part) => part.type).join(", ");
	const damage = dealt > 0 ? `sofreu ${dealt} de dano${types ? ` (${types})` : ""}` : "não sofreu dano";
	const conds = row.conditions?.length ? `; ${row.conditions.map((cond) => cond.label ?? cond.key).join(", ")}` : "";
	return `${row.name} ${damage}${conds}.`;
}
