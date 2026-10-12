// Resistência por alvo das habilidades de ameaça (lógica pura, sem Foundry).
// Usa só a DT escrita na habilidade: sem DT não há automação e nada é inferido de VD, NEX ou ritual.

/** Nomes aceitos na ficha → chave de perícia do sistema (Fortitude é "resilience" aqui). */
const SKILL_ALIASES = Object.freeze({
	reflexes: "reflexes", reflexos: "reflexes", reflexo: "reflexes", reflex: "reflexes",
	will: "will", vontade: "will", willpower: "will",
	resilience: "resilience", fortitude: "resilience", fort: "resilience",
	athleticism: "athleticism", atletismo: "athleticism",
	perception: "perception", percepcao: "perception", "percepção": "perception",
	occultism: "occultism", ocultismo: "occultism",
	intuition: "intuition", intuicao: "intuition", "intuição": "intuition",
	investigation: "investigation", investigacao: "investigation", "investigação": "investigation",
	stealth: "stealth", furtividade: "stealth",
	fighting: "fighting", luta: "fighting",
	acrobatics: "acrobatics", acrobacia: "acrobatics", acrobacias: "acrobatics"
});

export const resolveSkillKey = (name) => SKILL_ALIASES[String(name ?? "").trim().toLowerCase()] ?? null;

/** Empate favorece quem resiste: total ≥ DT passa (mesma conta de autoRoll nos rituais). */
export const savePassed = (total, dc) => Number(total) >= Number(dc);

/** Efeito do teste sobre o dano: `full` | `half` | `negate`. Falha ou ausência de teste = integral. */
export function damageMode(save, passed) {
	if (!save || passed !== true) return "full";
	if (save.onSuccess === "half") return "half";
	if (save.onSuccess === "negate") return "negate";
	return "full"; // "none": o sucesso não reduz o dano
}

/** Dano final (inteiro ≥ 0); metade arredonda para baixo, como o motor de rituais. */
export function damageForMode(amount, mode) {
	const full = Math.max(0, Math.floor(Number(amount) || 0));
	if (mode === "negate") return 0;
	if (mode === "half") return Math.floor(full / 2);
	return full;
}

/** A condição/efeito se aplica dado o resultado do alvo? (`onSave`: always | fail | success). */
export function effectApplies(effect, passed) {
	const rule = effect?.onSave ?? "always";
	if (rule === "always") return true;
	if (passed === null || passed === undefined) return false; // sem resultado: Mestre decide
	return rule === "fail" ? passed === false : passed === true;
}

/** Confere se a resistência pode ser rolada automaticamente. */
export function saveReadiness(save) {
	if (!save) return { ok: false, reason: "no-save" };
	if (!Number.isInteger(save.dc) || save.dc <= 0) return { ok: false, reason: "missing-dc" };
	const skill = resolveSkillKey(save.skill);
	if (!skill) return { ok: false, reason: "unknown-skill" };
	return { ok: true, skill };
}

const attempt = (total, dc, source) => ({ total: total ?? null, passed: total === null || total === undefined ? null : savePassed(total, dc), source });

/** Registro de resistência de um alvo; `total` null = aguarda rolagem manual do Mestre. */
export function buildSaveRecord({ save, targetId, name = "", total = null, source = "roll", rollRef = null }) {
	const ready = saveReadiness(save);
	if (!ready.ok) return { targetId, name, status: "unavailable", reason: ready.reason, attempts: [], passed: null, mode: "full" };
	const first = attempt(total, save.dc, source);
	return {
		targetId, name, status: first.passed === null ? "pending" : "resolved",
		skill: ready.skill, dc: save.dc, retry: !!save.retry,
		attempts: [{ ...first, rollRef }],
		passed: first.passed,
		mode: damageMode(save, first.passed)
	};
}

/** Nova tentativa (só se a habilidade permitir); vale a mais recente. Mantém o histórico. */
export function addAttempt(record, save, { total, source = "roll", rollRef = null }) {
	if (!record || record.status === "unavailable") return { ok: false, reason: "unavailable", record };
	if (record.attempts.length && !save?.retry) return { ok: false, reason: "no-retry", record };
	const next = attempt(total, save.dc, source);
	const attempts = [...record.attempts, { ...next, rollRef }];
	return { ok: true, record: { ...record, attempts, passed: next.passed, status: next.passed === null ? "pending" : "resolved", mode: damageMode(save, next.passed) } };
}

/** Define o resultado informado pelo Mestre (rolagem de mesa) para um alvo pendente. */
export function resolveManually(record, save, total) {
	if (!record || record.status !== "pending") return { ok: false, reason: "not-pending", record };
	return addAttempt({ ...record, attempts: [] }, save, { total, source: "manual" });
}

/** Resistência independente para cada alvo: `rolls` mapeia id → total (ou null). */
export function resolveSaves({ save, targets, rolls = {} }) {
	const ready = saveReadiness(save);
	if (!ready.ok) return { ok: false, reason: ready.reason, records: targets.map((t) => buildSaveRecord({ save, targetId: t.id, name: t.name })) };
	return { ok: true, records: targets.map((t) => buildSaveRecord({ save, targetId: t.id, name: t.name, total: rolls[t.id] ?? null })) };
}
