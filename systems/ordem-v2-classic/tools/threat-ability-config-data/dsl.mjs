// Vocabulário para escrever as configurações de execução das habilidades do Livro v1.3 (revisão humana, nunca por
// leitura de texto em tempo de jogo). Cada função devolve pedaços do bloco `system.execution`.
import { resolveCondition } from "../../module/helpers/threat-ability-effects.mjs";

/** Alcances do livro em metros (ritual-targeting.mjs: curto 9, médio 18, longo 36, extremo 90). */
export const RANGE = Object.freeze({ adjacente: 1.5, curto: 9, medio: 18, longo: 36, extremo: 90 });

export const tokens = (range, count = 1, relation = "any") => ({ targeting: { kind: count === 1 ? "token" : "tokens", range, count, relation, ...(range === null ? { rangeUnspecified: true } : {}) } });
export const self = () => ({ targeting: { kind: "self", relation: "any" } });

/** Todos os personagens em alcance X da criatura (emanação a partir da borda do token). */
export const emanation = (radius, relation = "any") => ({ targeting: { kind: "area", relation }, area: { shape: "sphere", radius, origin: "caster", persistence: "instant", triggers: [] } });
export const line = (length, width, relation = "any") => ({ targeting: { kind: "area", relation }, area: { shape: "line", length, width, origin: "caster", persistence: "instant", triggers: [] } });
export const cone = (length, relation = "any") => ({ targeting: { kind: "area", relation }, area: { shape: "cone", length, origin: "caster", persistence: "instant", triggers: [] } });
export const sphereAt = (radius, range, relation = "any") => ({ targeting: { kind: "area", range, relation }, area: { shape: "sphere", radius, origin: "point", persistence: "instant", triggers: [] } });

export const cubeAt = (side, range, relation = "any") => ({ targeting: { kind: "area", range, relation }, area: { shape: "cube", length: side, origin: "point", persistence: "instant", triggers: [] } });

export const save = (skill, dc, onSuccess = "none", retry = false) => ({ save: { skill, dc, onSuccess, retry } });

export const dmg = (formula, type, { resource = "pv", roll = "once", kind = "damage" } = {}) => ({ kind, formula, type, resource, roll });
/** Dano Mental reduz SAN (nunca PV). */
export const mental = (formula, opts = {}) => dmg(formula, "mental", { resource: "san", ...opts });
export const heal = (formula, resource = "pv") => ({ kind: "heal", formula, type: "", resource, roll: "once" });

/** Condição com duração; `support` sai do catálogo do sistema (mecânica existente) ou vira marcador manual. */
export const fx = (condition, unit, value = null, { onSave = "fail", support = null, target = "target" } = {}) => ({
	condition,
	duration: { unit, value },
	onSave,
	target,
	trigger: "",
	support: support ?? (resolveCondition(condition)?.support === "mechanical" ? "mechanical" : "marker")
});

export const req = {
	perScene: (count = 1) => ({ kind: "perScene", count }),
	perRound: (count = 1) => ({ kind: "perRound", count }),
	narrative: (text) => ({ kind: "narrative", text }),
	affectedBy: (ref) => ({ kind: "affectedBy", ref }),
	combat: () => ({ kind: "combat" })
};

export const trigger = (event, owner = "self") => ({ event, owner });

/** Junta os pedaços num bloco execution. */
export function exec(parts, { mode = "active", automation = "automatic" } = {}) {
	const out = { mode, automation, damage: [], effects: [], requirements: [], grants: [] };
	for (const part of [].concat(parts)) {
		if (!part) continue;
		for (const [key, value] of Object.entries(part)) {
			if (["damage", "effects", "requirements", "grants"].includes(key)) out[key].push(...[].concat(value));
			else out[key] = value;
		}
	}
	return out;
}

const D = (key, value) => ({ [key]: value });
export const damage = (...entries) => D("damage", entries);
export const effects = (...entries) => D("effects", entries);
export const requirements = (...entries) => D("requirements", entries);
export const grants = (...entries) => D("grants", entries);
export const triggerPart = (event, owner) => D("trigger", trigger(event, owner));
export const costPart = (type, amount, insufficient = "block") => D("cost", { type, amount, timing: "onConfirm", insufficient });

/**
 * Entrada de uma habilidade. `state` é o que se afirma e o teste confere contra automationState().
 * - manual: execution = null (a habilidade segue legada, com "Mostrar no chat");
 * - gaps: partes da habilidade que o sistema não resolve (movimento, manobras, ataques...), sempre ficam com o Mestre;
 * - notes: observações que não pertencem ao uso (ex.: a flor murcha, texto de ambientação).
 */
export function ability(id, { state, execution = null, gaps = [], notes = [], why = "", testActivation = null }) {
	return { id, state, execution, gaps, notes, why, testActivation };
}

/** Atalho: ataque descrito como ação "Agredir" (aponta para um ataque armament, que não vira habilidade). */
export const attackPointer = (id, attackName) => ability(id, { state: "manual", why: `Ação que remete ao ataque ${attackName} (armament): usa o fluxo de ataque existente.` });
