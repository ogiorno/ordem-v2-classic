// Regras puras do fluxo de conjuração rápida (docs/arquivo/spec-fluxo-conjuracao-rapida.md): alvo padrão, estado do
// botão "Conjurar", quando "Trocar alvo" está disponível e a confirmação de gasto. Sem Foundry, testável em Node.

import { PROFILE } from "./ritual-profiles.mjs";

/**
 * Alvo padrão do cartão (FC-21, FC-30).
 * @param {object} p
 * @param {string} p.profile
 * @param {string[]} p.markedIds   tokens marcados como alvo
 * @param {number|null} [p.maxTargets]
 * @returns {{mode:"none"|"self"|"marked"|"area", ids:string[], byDefault:boolean}}
 *   mode "self" = o próprio conjurador; byDefault = o alvo é o padrão, não uma escolha (o chip destaca isso).
 */
export function defaultTarget({ profile, markedIds = [], maxTargets = null }) {
	const marked = maxTargets && maxTargets > 0 ? markedIds.slice(0, maxTargets) : [...markedIds];
	switch (profile) {
		case PROFILE.PERSONAL:
			return { mode: "self", ids: [], byDefault: false };
		case PROFILE.ALLY:
			return marked.length ? { mode: "marked", ids: marked, byDefault: false } : { mode: "self", ids: [], byDefault: true };
		case PROFILE.HOSTILE:
			return marked.length ? { mode: "marked", ids: marked, byDefault: false } : { mode: "none", ids: [], byDefault: false };
		case PROFILE.AREA:
			return { mode: "area", ids: marked, byDefault: false };
		default:
			return marked.length ? { mode: "marked", ids: marked, byDefault: false } : { mode: "none", ids: [], byDefault: false };
	}
}

/** O perfil precisa que o jogador escolha um alvo antes de conjurar? */
export function needsTarget(profile, target) {
	if (profile === PROFILE.HOSTILE) return target.mode !== "marked" || !target.ids.length;
	return false;
}

export const BUTTON_STATE = Object.freeze({
	READY: "ready",
	SILENCED: "silenced",
	NO_PD: "noPd",
	NEED_VARIANT: "needVariant",
	NEED_TARGET: "needTarget",
	OUT_OF_RANGE: "outOfRange",
	NEED_FEAR: "needFear",
	NEED_WEAPON: "needWeapon",
	INVALID: "invalid",
});

/**
 * Estado do botão principal (UI-02). Só `ready` é clicável. A ordem das condições decide qual motivo aparece.
 */
export function castButtonState({
	profile, cost, pd, silenced = false,
	variantRequired = false, variantChosen = true,
	target = { mode: "none", ids: [] }, targetProblems = [],
	fearRequired = false, fearConfirmed = true,
	weaponRequired = false, weaponChosen = true,
	validCost = true,
}) {
	if (silenced) return { state: BUTTON_STATE.SILENCED, enabled: false, label: "Silenciado não pode conjurar", reason: "Silenciado" };
	if (!validCost || !Number.isInteger(cost)) return { state: BUTTON_STATE.INVALID, enabled: false, label: "Custo inválido", reason: "Escolha um círculo válido" };
	if (Number(pd) < cost) {
		const missing = cost - Math.max(0, Number(pd) || 0);
		return { state: BUTTON_STATE.NO_PD, enabled: false, label: `PD insuficiente (faltam ${missing})`, reason: `Faltam ${missing} PD` };
	}
	if (variantRequired && !variantChosen) return { state: BUTTON_STATE.NEED_VARIANT, enabled: false, label: "Escolha a variante", reason: "Escolha a variante do ritual" };
	if (needsTarget(profile, target)) return { state: BUTTON_STATE.NEED_TARGET, enabled: false, label: "Escolha o alvo", reason: "Marque um alvo" };
	if (targetProblems.length) return { state: BUTTON_STATE.OUT_OF_RANGE, enabled: false, label: "Fora de alcance", reason: targetProblems.join(" ") };
	if (weaponRequired && !weaponChosen) return { state: BUTTON_STATE.NEED_WEAPON, enabled: false, label: "Escolha a arma", reason: "Escolha a arma" };
	if (fearRequired && !fearConfirmed) return { state: BUTTON_STATE.NEED_FEAR, enabled: false, label: "Confirme: personagem Marcado", reason: "Rituais de Medo exigem personagem Marcado" };
	return { state: BUTTON_STATE.READY, enabled: true, label: `Conjurar (${cost} PD)`, reason: "" };
}

/**
 * A primeira confirmação de gasto (FC-11): ritual pessoal ou de reação com custo ≥ 1 arma o botão e o segundo clique confirma.
 */
export function needsSpendConfirm({ profile, modifiers = [], cost, enabled = true }) {
	if (!enabled || !(cost >= 1)) return false;
	return profile === PROFILE.PERSONAL || modifiers.includes("RAP");
}

/**
 * "Trocar alvo" está disponível? (FC-90 a FC-94)
 * @param {object} p
 * @param {string} p.profile
 * @param {boolean} p.effectActive    o efeito do ritual ainda existe
 * @param {boolean} p.used            o efeito já foi usado de forma relevante (ex.: a arma amaldiçoada já causou dano)
 * @param {boolean} p.isGM
 * @param {boolean} p.isCaster        quem clica é dono do conjurador
 */
export function canSwapTarget({ profile, effectActive, used = false, isGM = false, isCaster = false }) {
	if (profile !== PROFILE.ALLY || !effectActive) return false;
	if (isGM) return true;
	return isCaster && !used;
}

/** Quem pode encerrar um ritual sustentado / ativo. */
export function canEndRitual({ isGM = false, isCaster = false, effectActive = true }) {
	return effectActive && (isGM || isCaster);
}

/** Texto da linha de resumo da carta (FC-81). */
export function summaryLine({ casterName, ritualName, targetNames = [], cost, occultism = null, interrupted = false }) {
	const where = targetNames.length ? ` em ${targetNames.join(", ")}` : "";
	const test = occultism ? ` · Ocultismo ${occultism.total} vs DT ${occultism.dt} — ${occultism.success ? "sucesso" : "falha"}` : "";
	if (interrupted) return `${casterName} perdeu a concentração em ${ritualName} · ${cost} PD pagos`;
	return `${casterName} conjurou ${ritualName}${where} · ${cost} PD${test}`;
}

/** Cor/estado da carta (FC-80). */
export function cardTone({ pending = false, interrupted = false, occultismFailed = false }) {
	if (pending) return "pending";
	if (interrupted || occultismFailed) return "failure";
	return "success";
}
