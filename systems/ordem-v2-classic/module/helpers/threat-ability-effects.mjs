// Condições e duração das habilidades de ameaça (lógica pura, sem Foundry).
// Só a mecânica que o sistema já tem (helpers/conditions.mjs) é "mechanical"; o resto vira marcador de
// aplicação manual. Nunca se inventa efeito para condição desconhecida.
import { CONDITIONS } from "./conditions.mjs";

/** Nome escrito na ficha → id do catálogo mecânico (helpers/conditions.mjs). */
const MECHANICAL = Object.freeze({
	"vulnerável": "vulnerable", vulneravel: "vulnerable", vulnerable: "vulnerable",
	atordoado: "stun", stun: "stun", stunned: "stun",
	agarrado: "grabbed", grabbed: "grabbed",
	surdo: "deaf", deaf: "deaf",
	silenciado: "silence", silence: "silence",
	sangrando: "bleeding", bleeding: "bleeding",
	enjoado: "nauseated", nauseated: "nauseated",
	"em chamas": "burning", queimando: "burning", burning: "burning",
	inconsciente: "unconscious", unconscious: "unconscious",
	morrendo: "dying", dying: "dying"
});

/** Condições do livro sem mecânica no sistema, com ícone de status quando existir (só marcador). */
const STATUS_ONLY = Object.freeze({
	"caído": "prone", caido: "prone", prone: "prone",
	paralisado: "paralysis", paralysis: "paralysis",
	cego: "blind", blind: "blind",
	amedrontado: "fear", "apavorado": "fear", fear: "fear",
	adormecido: "sleep", sleep: "sleep"
});

export const CONDITION_SUPPORT = Object.freeze({ mechanical: "mechanical", marker: "marker" });

/** Resolve o nome da condição: mecânica (usa conditions.mjs) ou marcador manual. */
export function resolveCondition(name) {
	const key = String(name ?? "").trim().toLowerCase();
	if (!key) return null;
	const id = MECHANICAL[key];
	if (id && CONDITIONS[id]) return { support: "mechanical", id, label: CONDITIONS[id].name, status: CONDITIONS[id].status ?? null };
	return { support: "marker", id: null, label: String(name).trim(), status: STATUS_ONLY[key] ?? null };
}

export const ROUNDS_PER_MINUTE = 10; // 1 rodada = 6 s

/**
 * Duração de um efeito. `rolled` = valor já rolado quando a duração é fórmula (ex.: 1d4).
 * Contagem em rodadas da cena de combate; fora de combate não dá para expirar sozinho.
 */
export function durationPlan({ duration, rolled = null, combat = null }) {
	const unit = duration?.unit;
	const raw = rolled ?? duration?.value;
	const n = Number(raw);
	if (unit === "instant") return { kind: "instant", expires: false, manual: false };
	if (unit === "permanent") return { kind: "permanent", expires: false, manual: false };
	if (unit === "scene") return { kind: "scene", expires: false, manual: true, note: "scene" };
	if (unit === "untilSaved") return { kind: "untilSaved", expires: false, manual: true, note: "untilSaved" };
	if (unit === "unspecified") return { kind: "unspecified", expires: false, manual: true, note: "unspecified" };
	if (["rounds", "turns", "minutes"].includes(unit)) {
		if (!Number.isInteger(n) || n < 1) return { kind: "invalid", expires: false, manual: true, note: "invalid" };
		const rounds = unit === "minutes" ? n * ROUNDS_PER_MINUTE : n;
		if (!combat || !Number.isInteger(combat.round)) return { kind: "rounds", rounds, expires: false, manual: true, note: "noCombat" };
		return { kind: "rounds", rounds, startRound: combat.round, expiresRound: combat.round + rounds - 1, expires: true, manual: false };
	}
	return { kind: "invalid", expires: false, manual: true, note: "invalid" };
}

/** O efeito expirou no início do turno do alvo? (mesma regra de processConditionsAtTurnStart) */
export const isExpired = (expiresRound, currentRound) => expiresRound !== null && expiresRound !== undefined && currentRound > expiresRound;

/**
 * Plano de um efeito para um alvo: aplica ou não conforme a resistência, resolve a condição e a duração.
 * `passed` = resultado da resistência do alvo (null = sem teste).
 */
export function buildEffectPlan({ effect, passed = null, rolled = null, combat = null }) {
	const when = effect.onSave ?? "always";
	const applies = when === "always" ? true : passed === null || passed === undefined ? false : when === "fail" ? passed === false : passed === true;
	if (!applies) return { applies: false, reason: "save-outcome" };
	const condition = resolveCondition(effect.condition);
	if (!condition) return { applies: false, reason: "no-condition" };
	const duration = durationPlan({ duration: effect.duration, rolled, combat });
	if (duration.kind === "invalid") return { applies: false, reason: "invalid-duration", condition };
	const support = effect.support === "marker" ? "marker" : condition.support;
	return {
		applies: true, condition, duration,
		support: condition.support === "mechanical" && effect.support !== "marker" ? "mechanical" : support,
		// condição fora do catálogo nunca é apresentada como automática
		manual: condition.support !== "mechanical" || duration.manual,
		notes: [condition.support !== "mechanical" ? "markerCondition" : null, duration.manual ? duration.note : null].filter(Boolean)
	};
}

/** Marca que liga o efeito à execução da habilidade (para remover só o que é dela). */
export function sourceFlag({ executionId, itemUuid = null, sourceActorUuid = null, effectIndex = 0, targetId = null, plan }) {
	return {
		executionId, itemUuid, sourceActorUuid, effectIndex, targetId,
		manual: !!plan.manual, support: plan.support,
		expiresRound: plan.duration?.expiresRound ?? null, startRound: plan.duration?.startRound ?? null,
		durationKind: plan.duration?.kind ?? null
	};
}

/** Efeitos de um ator criados por uma execução (e, se pedido, por um índice de efeito). */
export function ownedBy(effects, executionId, effectIndex = null) {
	return [...effects].filter((fx) => {
		const flag = fx.flags?.["ordem-v2-classic"]?.abilityExec ?? fx.getFlag?.("ordem-v2-classic", "abilityExec");
		return flag?.executionId === executionId && (effectIndex === null || flag.effectIndex === effectIndex);
	});
}
