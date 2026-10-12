// Fluxo do botão "Usar" das habilidades de ameaça (lógica pura, sem Foundry).
// Valida antes de cobrar ou rolar; cancelar nunca deixa efeito; confirmação dupla vale uma vez.
import { normalizeExecution, validateExecution } from "./threat-ability-execution.mjs";

export const FLOW = Object.freeze({
	IDLE: "idle", VALIDATING: "validating", REFUSED: "refused", SUMMARY: "summary", SELECTING: "selecting",
	CONFIRMING: "confirming", EXECUTING: "executing", DONE: "done", CANCELLED: "cancelled", MANUAL: "manual"
});

/** O sistema usa passive|free|movement|default|complete|reaction; o livro extraído fala standard/full. */
const ACTIVATION_ALIASES = Object.freeze({ standard: "default", full: "complete" });
export const activationKey = (activation) => ACTIVATION_ALIASES[activation] ?? activation ?? "";

export const ROUTE = Object.freeze({ ATTACK: "attack", PASSIVE: "passive", MANUAL: "manual", INCOMPLETE: "incomplete", ASSISTED: "assisted", AUTOMATIC: "automatic" });

/**
 * Rota do botão da ficha. Ataque (`armament`) segue o fluxo próprio; sem execution/manual usa "Mostrar no chat";
 * passiva não tem Usar; configuração com erro lista o que falta e oferece o chat.
 */
export function routeUse(item) {
	if (!item) return { route: ROUTE.MANUAL, usable: false, missing: [] };
	if (item.type === "armament") return { route: ROUTE.ATTACK, usable: false, missing: [] };
	const execution = normalizeExecution(item.system?.execution);
	if (!execution || execution.mode === "manual") return { route: ROUTE.MANUAL, usable: false, missing: [] };
	if (execution.mode === "passive") return { route: ROUTE.PASSIVE, usable: false, missing: [] };
	const verdict = validateExecution(execution, { activation: item.system?.activation ?? "" });
	if (!verdict.valid) return { route: ROUTE.INCOMPLETE, usable: true, missing: verdict.errors.map((e) => e.path), errors: verdict.errors };
	return { route: verdict.effective === "automatic" ? ROUTE.AUTOMATIC : ROUTE.ASSISTED, usable: true, missing: [], triggered: execution.mode === "triggered" };
}

const resourceOf = (actor, type) => {
	const key = String(type ?? "").toUpperCase();
	if (!["PE", "PD", "SAN", "PV"].includes(key)) return null;
	const res = actor?.type === "threat" && key === "PV" ? actor.system?.attributes?.hp : actor?.system?.[key];
	return res && Number.isFinite(Number(res.value)) ? { key, path: key === "PV" && actor.type === "threat" ? "system.attributes.hp" : `system.${key}`, value: Number(res.value) } : null;
};

/**
 * Custo só quando declarado (`execution.cost.amount > 0`). Recurso inexistente na ficha não é inventado:
 * `unsupported` pede confirmação manual do Mestre.
 */
export function checkCost({ execution, actor }) {
	const cost = execution?.cost;
	if (!cost || !(cost.amount > 0)) return { declared: false, ok: true, charge: null };
	const res = resourceOf(actor, cost.type);
	if (!res) return { declared: true, ok: false, unsupported: true, policy: cost.insufficient, reason: "resource-missing", amount: cost.amount, type: cost.type };
	if (res.value >= cost.amount) return { declared: true, ok: true, charge: { path: `${res.path}.value`, from: res.value, to: res.value - cost.amount, amount: cost.amount, type: res.key } };
	return { declared: true, ok: cost.insufficient === "warn", policy: cost.insufficient, reason: "insufficient", shortfall: cost.amount - res.value, amount: cost.amount, type: res.key, charge: cost.insufficient === "warn" ? { path: `${res.path}.value`, from: res.value, to: Math.max(0, res.value - cost.amount), amount: cost.amount, type: res.key } : null };
}

/** Linhas do cartão do "Usar": campos ausentes viram "Definir manualmente", nunca zero inventado. */
export function summaryLines({ execution, activation = "" }) {
	const missing = { missing: true };
	const val = (v, suffix = "") => (v === null || v === undefined || v === "" ? missing : { text: `${v}${suffix}` });
	const lines = [{ key: "action", ...val(activation) }];
	if (execution?.cost) lines.push({ key: "cost", ...(execution.cost.type && execution.cost.amount >= 0 ? { text: `${execution.cost.amount} ${execution.cost.type}` } : missing) });
	if (execution?.targeting) {
		lines.push({ key: "target", ...val(execution.targeting.kind) });
		lines.push({ key: "range", ...val(execution.targeting.range, " m") });
	}
	if (execution?.area) lines.push({ key: "area", ...(execution.area.shape ? { text: [execution.area.shape, execution.area.length, execution.area.width, execution.area.radius].filter((x) => x).join(" × ") } : missing) });
	if (execution?.save) lines.push({ key: "save", ...(execution.save.skill && execution.save.dc ? { text: `${execution.save.skill} DT ${execution.save.dc}` } : missing) });
	for (const d of execution?.damage ?? []) lines.push({ key: d.kind === "heal" ? "heal" : "damage", ...(d.formula ? { text: `${d.formula} ${d.type ?? ""}`.trim() } : missing) });
	for (const e of execution?.effects ?? []) lines.push({ key: "effect", ...(e.condition ? { text: `${e.condition} (${e.duration?.value ?? "?"} ${e.duration?.unit ?? ""})`.trim() } : missing) });
	return lines;
}

const TABLE = {
	[FLOW.IDLE]: { use: FLOW.VALIDATING },
	[FLOW.VALIDATING]: { valid: FLOW.SUMMARY, invalid: FLOW.REFUSED, manual: FLOW.MANUAL },
	[FLOW.REFUSED]: { fallback: FLOW.MANUAL, cancel: FLOW.CANCELLED },
	[FLOW.SUMMARY]: { proceed: FLOW.SELECTING, cancel: FLOW.CANCELLED },
	[FLOW.SELECTING]: { selected: FLOW.CONFIRMING, noScene: FLOW.MANUAL, cancel: FLOW.CANCELLED, invalid: FLOW.SELECTING },
	[FLOW.CONFIRMING]: { confirm: FLOW.EXECUTING, cancel: FLOW.CANCELLED, back: FLOW.SELECTING },
	[FLOW.EXECUTING]: { done: FLOW.DONE, error: FLOW.CANCELLED },
	[FLOW.DONE]: {}, [FLOW.CANCELLED]: {}, [FLOW.MANUAL]: {}
};

/** Efeitos colaterais (cobrar, rolar, criar painel) só existem a partir de EXECUTING. */
export const hasSideEffects = (state) => state === FLOW.EXECUTING || state === FLOW.DONE;

/**
 * Transição do fluxo. Evento inválido para o estado é ignorado (`ignored: true`), o que torna a confirmação
 * repetida inofensiva: o segundo `confirm` encontra EXECUTING e não faz nada.
 */
export function reduce(state, event) {
	const next = TABLE[state]?.[event];
	if (!next) return { state, ignored: true, sideEffects: hasSideEffects(state) };
	return { state: next, ignored: false, sideEffects: hasSideEffects(next), firstExecution: next === FLOW.EXECUTING };
}

/** Pedido de uso delegado ao Mestre ativo (dono/outro Mestre): só dados mínimos, sem segredos. */
export const delegateRequest = ({ actorUuid, itemUuid, userId }) => ({ type: "threatAbilityUse", actorUuid, itemUuid, userId });
