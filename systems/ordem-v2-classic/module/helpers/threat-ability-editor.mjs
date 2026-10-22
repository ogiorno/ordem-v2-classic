// Lógica pura do editor de execução das habilidades de ameaça (view model + edição por caminho).
// A ficha só liga eventos; nada aqui toca o Foundry nem interpreta o texto da descrição.
import {
	AREA_ORIGINS, AREA_PERSISTENCE, AREA_SHAPES, AREA_TRIGGERS, AUTOMATION, COST_INSUFFICIENT, COST_TIMINGS,
	DAMAGE_KINDS, DAMAGE_RESOURCES, DURATION_UNITS, EFFECT_ON_SAVE, EFFECT_SUPPORT, EFFECT_TARGETS, EXECUTION_VERSION, MODES,
	REQUIREMENT_KINDS, ROLL_POLICIES, TRIGGER_EVENTS, TRIGGER_OWNERS, SAVE_OUTCOMES, TARGET_KINDS, TARGET_RELATIONS, VISIBILITY_LEVELS,
	normalizeExecution, validateExecution
} from "./threat-ability-execution.mjs";

const NUMBER_PATHS = /(^|\.)(range|count|length|width|radius|dc|amount|fraction)$/;
const BOOLEAN_PATHS = /(^|\.)(voluntary|requiresSight|retry|reviewed|rangeUnspecified)$/;
const clone = (v) => JSON.parse(JSON.stringify(v));

/** Bloco novo, deliberado: começa manual, sem nenhum campo mecânico preenchido. */
export function createExecution() {
	return normalizeExecution({ version: EXECUTION_VERSION, mode: "active", automation: "manual" });
}

const BLOCK_DEFAULTS = {
	cost: () => ({ type: "", amount: 0, timing: "onConfirm", insufficient: "block" }),
	targeting: () => ({ kind: "", range: null, count: null, relation: "any" }),
	area: () => ({ shape: "", length: null, width: null, radius: null, origin: "caster", persistence: "instant", triggers: [] }),
	save: () => ({ skill: "", dc: null, onSuccess: "none", retry: false }),
	trigger: () => ({ event: "", owner: "self" })
};
const LIST_DEFAULTS = {
	damage: () => ({ kind: "damage", formula: "", type: "", resource: "pv", frequency: "", roll: "once" }),
	effects: () => ({ condition: "", duration: { value: null, unit: "" }, target: "target", trigger: "", onSave: "always", support: "marker" }),
	requirements: () => ({ kind: "narrative", ref: "", text: "" })
};

export function setBlock(execution, block, enabled) {
	const next = clone(execution);
	if (!BLOCK_DEFAULTS[block]) throw new Error(`bloco desconhecido: ${block}`);
	next[block] = enabled ? (next[block] ?? BLOCK_DEFAULTS[block]()) : null;
	return normalizeExecution(next);
}

export function addEntry(execution, list) {
	if (!LIST_DEFAULTS[list]) throw new Error(`lista desconhecida: ${list}`);
	const next = clone(execution);
	next[list] = [...(next[list] ?? []), LIST_DEFAULTS[list]()];
	return normalizeExecution(next);
}

export function removeEntry(execution, list, index) {
	const next = clone(execution);
	next[list] = (next[list] ?? []).filter((_, i) => i !== Number(index));
	return normalizeExecution(next);
}

function coerce(path, raw) {
	if (path.endsWith("duration.value")) {
		const text = String(raw ?? "").trim();
		if (!text) return null;
		return /^\d+$/.test(text) ? Number(text) : text;
	}
	if (BOOLEAN_PATHS.test(path)) return raw === true || raw === "true" || raw === "on";
	if (NUMBER_PATHS.test(path)) {
		if (raw === "" || raw === null || raw === undefined) return null;
		const n = Number(String(raw).replace(",", "."));
		return Number.isFinite(n) ? n : null;
	}
	if (path === "area.triggers") return Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
	return raw === null || raw === undefined ? "" : String(raw);
}

/** Aplica uma alteração de campo ("save.dc", "damage.0.formula"...) e devolve um novo bloco normalizado. */
export function setField(execution, path, raw) {
	const next = clone(execution);
	const keys = path.split(".");
	let node = next;
	for (const key of keys.slice(0, -1)) {
		if (node[key] === null || node[key] === undefined) throw new Error(`caminho inexistente: ${path}`);
		node = node[key];
	}
	node[keys.at(-1)] = coerce(path, raw);
	return normalizeExecution(next);
}

const opt = (values, prefix) => Object.fromEntries(values.map((v) => [v, `${prefix}.${v}`]));
export const OPTION_MAPS = {
	mode: opt(MODES, "op.threatExec.mode"),
	automation: opt(AUTOMATION, "op.threatExec.automation"),
	targetKind: opt(TARGET_KINDS, "op.threatExec.targetKind"),
	relation: opt(TARGET_RELATIONS, "op.threatExec.relation"),
	shape: opt(AREA_SHAPES, "op.threatExec.shape"),
	origin: opt(AREA_ORIGINS, "op.threatExec.origin"),
	persistence: opt(AREA_PERSISTENCE, "op.threatExec.persistence"),
	areaTriggers: opt(AREA_TRIGGERS, "op.threatExec.areaTrigger"),
	saveOutcome: opt(SAVE_OUTCOMES, "op.threatExec.saveOutcome"),
	damageKind: opt(DAMAGE_KINDS, "op.threatExec.damageKind"),
	resource: opt(DAMAGE_RESOURCES, "op.threatExec.resource"),
	rollPolicy: opt(ROLL_POLICIES, "op.threatExec.rollPolicy"),
	durationUnit: opt(DURATION_UNITS, "op.threatExec.durationUnit"),
	effectTarget: opt(EFFECT_TARGETS, "op.threatExec.effectTarget"),
	effectOnSave: opt(EFFECT_ON_SAVE, "op.threatExec.effectOnSave"),
	effectSupport: opt(EFFECT_SUPPORT, "op.threatExec.effectSupport"),
	costTiming: opt(COST_TIMINGS, "op.threatExec.costTiming"),
	costInsufficient: opt(COST_INSUFFICIENT, "op.threatExec.costInsufficient"),
	requirementKind: opt(REQUIREMENT_KINDS, "op.threatExec.requirementKind"),
	triggerEvent: opt(TRIGGER_EVENTS, "op.threatExec.triggerEvent"),
	triggerOwner: opt(TRIGGER_OWNERS, "op.threatExec.triggerOwner"),
	visibility: opt(VISIBILITY_LEVELS, "op.threatExec.visibility")
};

const MISSING = "op.threatExec.defineManually";

/** Linhas da prévia da carta; campo ausente vira "Definir manualmente", nunca zero. */
export function previewLines(e) {
	const val = (v, unit = "") => (v === null || v === undefined || v === "" ? { missing: true } : { text: `${v}${unit}` });
	const lines = [];
	if (e.cost) lines.push({ key: "op.threatExec.preview.cost", ...val(e.cost.type ? `${e.cost.amount} ${e.cost.type}` : "") });
	if (e.targeting) {
		lines.push({ key: "op.threatExec.preview.target", ...val(e.targeting.kind), kind: e.targeting.kind });
		lines.push({ key: "op.threatExec.preview.range", ...val(e.targeting.range, " m") });
	}
	if (e.area) {
		const dims = e.area.shape === "line" ? [e.area.length, e.area.width] : e.area.shape === "cone" ? [e.area.length] : ["sphere", "circle"].includes(e.area.shape) ? [e.area.radius] : [e.area.length];
		const ok = e.area.shape && dims.every((d) => d > 0);
		lines.push({ key: "op.threatExec.preview.area", ...(ok ? { text: `${e.area.shape} ${dims.join(" × ")} m` } : { missing: true }) });
	}
	if (e.save) lines.push({ key: "op.threatExec.preview.save", ...(e.save.skill && e.save.dc > 0 ? { text: `${e.save.skill} DT ${e.save.dc}` } : { missing: true }) });
	e.damage.forEach((d) => lines.push({ key: "op.threatExec.preview.damage", ...(d.formula && d.type ? { text: `${d.formula} ${d.type}` } : { missing: true }) }));
	e.effects.forEach((f) => lines.push({ key: "op.threatExec.preview.effect", ...(f.condition && f.duration.unit ? { text: `${f.condition} (${f.duration.value ?? ""} ${f.duration.unit})`.replace("( ", "(") } : { missing: true }) }));
	return lines.map((l) => (l.missing ? { ...l, text: MISSING, missing: true } : l));
}

/** Dados prontos para o template. `system` é o `system` do item ability. */
export function buildEditorViewModel(system = {}) {
	const execution = normalizeExecution(system.execution);
	if (!execution) {
		return { hasExecution: false, state: "manual", errors: {}, errorList: [], options: OPTION_MAPS, defineManually: MISSING };
	}
	const result = validateExecution(execution, { activation: system.activation ?? "" });
	const errors = {};
	const errorList = result.errors.map((err) => {
		const messageKey = `op.threatExec.error.${err.code}`;
		errors[err.path] = messageKey;
		return { path: err.path, code: err.code, messageKey, message: err.message };
	});
	return {
		hasExecution: true,
		execution,
		state: result.effective,
		requested: result.requested,
		valid: result.valid,
		downgraded: result.requested !== result.effective,
		errors,
		errorList,
		preview: previewLines(execution),
		areaTriggersText: (execution.area?.triggers ?? []).join(", "),
		options: OPTION_MAPS,
		defineManually: MISSING
	};
}
