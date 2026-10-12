import { resolveSkillKey } from "./threat-ability-resistance.mjs";
import { resolveDamageType } from "./threat-ability-damage.mjs";

// Modelo puro de `system.execution` das habilidades de ameaça (sem globais do Foundry).
// Ausência de execution = habilidade legada/manual. Nada aqui interpreta texto livre.

export const EXECUTION_VERSION = 1;
export const MODES = ["manual", "active", "passive", "triggered"];
export const AUTOMATION = ["manual", "assisted", "automatic"];
export const TARGET_KINDS = ["self", "token", "tokens", "area"];
export const TARGET_RELATIONS = ["agent", "threat", "any"];
export const AREA_SHAPES = ["line", "cone", "sphere", "cube", "circle", "rect"];
export const AREA_ORIGINS = ["caster", "point"];
export const AREA_PERSISTENCE = ["instant", "persistent"];
export const AREA_TRIGGERS = ["enter", "turn", "leave"];
export const SAVE_OUTCOMES = ["none", "half", "negate"];
export const DAMAGE_RESOURCES = ["pv", "san", "pe", "other"];
export const DAMAGE_KINDS = ["damage", "heal"];
export const ROLL_POLICIES = ["once", "perTarget"];
export const DURATION_UNITS = ["instant", "rounds", "turns", "minutes", "scene", "permanent", "untilSaved", "unspecified"];
export const EFFECT_TARGETS = ["target", "self", "area"];
export const EFFECT_ON_SAVE = ["always", "fail", "success"];
export const EFFECT_SUPPORT = ["mechanical", "marker"];
export const COST_TIMINGS = ["onConfirm", "onHit", "onResolve"];
export const COST_INSUFFICIENT = ["block", "warn"];
export const REQUIREMENT_KINDS = ["affectedBy", "combat", "perScene", "perRound", "narrative"];
export const TRIGGER_EVENTS = ["manual", "reaction", "turnStart", "turnEnd", "enter", "leave"];
export const TRIGGER_OWNERS = ["self", "target", "any"];
export const GRANT_WHEN = ["always", "fail", "success"];
export const VISIBILITY_LEVELS = ["gm", "owner", "public"];

const DICE_TERM = /^(?:\d+d\d+|\d+)$/i;

/** Fórmula simples: termos NdM ou inteiros ligados por + - *. */
export function isValidFormula(formula) {
	if (typeof formula !== "string") return false;
	const text = formula.replace(/\s+/g, "");
	if (!text) return false;
	if (/^[+\-*]|[+\-*]$/.test(text)) return false;
	return text.split(/[+\-*]/).every((t) => DICE_TERM.test(t));
}

const str = (v, d = "") => (typeof v === "string" ? v : d);
const num = (v, d = null) => (v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v, d = false) => (typeof v === "boolean" ? v : d);
const list = (v) => (Array.isArray(v) ? v : []);
const clone = (v) => JSON.parse(JSON.stringify(v));
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/**
 * Completa defaults sem perder campos desconhecidos (round-trip aditivo).
 * Retorna null quando não há bloco (habilidade legada/manual).
 */
export function normalizeExecution(raw) {
	if (raw === null || raw === undefined) return null;
	const src = obj(raw);
	if (!Object.keys(src).length) return null;
	const out = clone(src);
	out.version = num(src.version, EXECUTION_VERSION);
	out.mode = str(src.mode, "manual");
	out.automation = str(src.automation, "manual");
	out.cost = src.cost ? { ...clone(obj(src.cost)), type: str(src.cost.type), amount: num(src.cost.amount, 0), timing: str(src.cost.timing, "onConfirm"), insufficient: str(src.cost.insufficient, "block") } : null;
	out.targeting = src.targeting ? { ...clone(obj(src.targeting)), kind: str(src.targeting.kind), range: num(src.targeting.range), count: num(src.targeting.count), relation: str(src.targeting.relation, "any"), voluntary: bool(src.targeting.voluntary), rangeUnspecified: bool(src.targeting.rangeUnspecified), requiresSight: bool(src.targeting.requiresSight) } : null;
	out.area = src.area ? { ...clone(obj(src.area)), shape: str(src.area.shape), length: num(src.area.length), width: num(src.area.width), radius: num(src.area.radius), origin: str(src.area.origin, "caster"), persistence: str(src.area.persistence, "instant"), triggers: list(src.area.triggers).map(String) } : null;
	out.save = src.save ? { ...clone(obj(src.save)), skill: str(src.save.skill), dc: num(src.save.dc), onSuccess: str(src.save.onSuccess, "none"), retry: bool(src.save.retry) } : null;
	out.damage = list(src.damage).map((d) => ({ ...clone(obj(d)), formula: str(d?.formula), kind: str(d?.kind, "damage"), type: str(d?.type), resource: str(d?.resource, "pv"), frequency: str(d?.frequency), roll: str(d?.roll, "once") }));
	out.effects = list(src.effects).map((e) => ({ ...clone(obj(e)), condition: str(e?.condition), duration: { ...clone(obj(e?.duration)), value: e?.duration?.value ?? null, unit: str(e?.duration?.unit) }, target: str(e?.target, "target"), trigger: str(e?.trigger), onSave: str(e?.onSave, "always"), support: str(e?.support, "marker") }));
	out.grants = list(src.grants).map((g) => ({ ...clone(obj(g)), ref: str(g?.ref), onSave: str(g?.onSave, "always") }));
	out.trigger = src.trigger ? { ...clone(obj(src.trigger)), event: str(src.trigger.event), owner: str(src.trigger.owner, "self") } : null;
	out.requirements = list(src.requirements).map((r) => ({ ...clone(obj(r)), kind: str(r?.kind, "narrative"), ref: str(r?.ref), text: str(r?.text) }));
	out.visibility = { ...clone(obj(src.visibility)), dc: str(src.visibility?.dc, "gm"), defense: str(src.visibility?.defense, "gm"), result: str(src.visibility?.result, "public") };
	out.source = { ...clone(obj(src.source)), reference: str(src.source?.reference), reviewed: bool(src.source?.reviewed) };
	return out;
}

const issue = (path, code, message) => ({ path, code, message });

/**
 * Valida um bloco. `activation` é o `system.activation` do item (fonte do tipo de ação).
 * `automatic` só é verdadeiro sem nenhum erro; com erros o estado efetivo cai para manual.
 */
export function validateExecution(execution, { activation = "" } = {}) {
	if (!execution) return { valid: true, errors: [], requested: "manual", effective: "manual", automatic: false };
	const e = normalizeExecution(execution);
	if (!e) return { valid: true, errors: [], requested: "manual", effective: "manual", automatic: false };
	const errors = [];
	const oneOf = (value, allowed, path) => {
		if (!allowed.includes(value)) errors.push(issue(path, "enum", `${path}: valor inválido "${value}"`));
	};
	oneOf(e.mode, MODES, "mode");
	oneOf(e.automation, AUTOMATION, "automation");
	if (e.version > EXECUTION_VERSION) errors.push(issue("version", "version", "versão do esquema maior que a suportada"));

	if (e.mode === "active" && !activation) errors.push(issue("action", "missing-action", "tipo de ação (activation) vazio: revisar antes de automatizar"));

	if (e.cost) {
		if (!e.cost.type) errors.push(issue("cost.type", "required", "custo sem tipo de recurso"));
		if (!Number.isInteger(e.cost.amount) || e.cost.amount < 0) errors.push(issue("cost.amount", "invalid-cost", "custo deve ser inteiro ≥ 0"));
		oneOf(e.cost.timing, COST_TIMINGS, "cost.timing");
		oneOf(e.cost.insufficient, COST_INSUFFICIENT, "cost.insufficient");
	}

	if (e.targeting) {
		oneOf(e.targeting.kind, TARGET_KINDS, "targeting.kind");
		oneOf(e.targeting.relation, TARGET_RELATIONS, "targeting.relation");
		if (["token", "tokens"].includes(e.targeting.kind)) {
			if (!e.targeting.rangeUnspecified && (e.targeting.range === null || e.targeting.range < 0)) errors.push(issue("targeting.range", "required", "alvo exige alcance em metros (ou marque alcance não informado)"));
			if (e.targeting.kind === "tokens" && !(e.targeting.count >= 1)) errors.push(issue("targeting.count", "required", "vários alvos exigem quantidade ≥ 1"));
		}
		if (e.targeting.kind === "area" && !e.area) errors.push(issue("area", "required", "alvo em área exige bloco area"));
	}

	if (e.area) {
		oneOf(e.area.shape, AREA_SHAPES, "area.shape");
		oneOf(e.area.origin, AREA_ORIGINS, "area.origin");
		oneOf(e.area.persistence, AREA_PERSISTENCE, "area.persistence");
		for (const t of e.area.triggers) oneOf(t, AREA_TRIGGERS, "area.triggers");
		if (e.area.persistence === "instant" && e.area.triggers.length) errors.push(issue("area.triggers", "conflict", "área instantânea não tem gatilhos"));
		const positive = (v) => v !== null && v > 0;
		if (["line", "cone", "cube", "rect"].includes(e.area.shape) && !positive(e.area.length)) errors.push(issue("area.length", "required", "comprimento em metros obrigatório"));
		if (e.area.shape === "line" && !positive(e.area.width)) errors.push(issue("area.width", "required", "largura em metros obrigatória"));
		if (["sphere", "circle"].includes(e.area.shape) && !positive(e.area.radius)) errors.push(issue("area.radius", "required", "raio em metros obrigatório"));
	}

	if (e.save) {
		if (!e.save.skill) errors.push(issue("save.skill", "required", "resistência sem perícia"));
		else if (!resolveSkillKey(e.save.skill)) errors.push(issue("save.skill", "unknown-skill", "perícia da resistência não reconhecida"));
		if (!Number.isInteger(e.save.dc) || e.save.dc <= 0) errors.push(issue("save.dc", "missing-dc", "DT ausente ou inválida; não inferir da VD nem de ritual"));
		oneOf(e.save.onSuccess, SAVE_OUTCOMES, "save.onSuccess");
	}

	e.damage.forEach((d, i) => {
		const p = `damage[${i}]`;
		if (!isValidFormula(d.formula)) errors.push(issue(`${p}.formula`, "invalid-formula", "fórmula de dano inválida"));
		oneOf(d.kind, DAMAGE_KINDS, `${p}.kind`);
		if (d.kind === "damage") {
			if (!d.type) errors.push(issue(`${p}.type`, "required", "dano sem tipo"));
			else if (!resolveDamageType(d.type)) errors.push(issue(`${p}.type`, "unknown-type", "tipo de dano não reconhecido"));
		}
		oneOf(d.resource, DAMAGE_RESOURCES, `${p}.resource`);
		oneOf(d.roll, ROLL_POLICIES, `${p}.roll`);
		if (d.resource === "other" && !d.otherResource) errors.push(issue(`${p}.otherResource`, "required", "recurso other exige o nome do recurso"));
		if (d.fraction !== undefined && !e.save) errors.push(issue(`${p}.fraction`, "conflict", "fração de dano exige resistência"));
	});

	e.effects.forEach((f, i) => {
		const p = `effects[${i}]`;
		if (!f.condition) errors.push(issue(`${p}.condition`, "required", "efeito sem condição"));
		oneOf(f.duration.unit, DURATION_UNITS, `${p}.duration.unit`);
		if (["rounds", "turns", "minutes"].includes(f.duration.unit)) {
			const v = f.duration.value;
			if (!(Number.isInteger(v) && v > 0) && !isValidFormula(String(v ?? ""))) errors.push(issue(`${p}.duration.value`, "invalid-duration", "duração exige inteiro ou fórmula"));
		}
		oneOf(f.target, EFFECT_TARGETS, `${p}.target`);
		oneOf(f.onSave, EFFECT_ON_SAVE, `${p}.onSave`);
		oneOf(f.support, EFFECT_SUPPORT, `${p}.support`);
		if (["fail", "success"].includes(f.onSave) && !e.save) errors.push(issue(`${p}.onSave`, "conflict", "regra de resistência do efeito exige save"));
	});

	e.grants.forEach((g, i) => {
		if (!g.ref) errors.push(issue(`grants[${i}].ref`, "required", "vínculo exige a referência"));
		oneOf(g.onSave, GRANT_WHEN, `grants[${i}].onSave`);
		if (["fail", "success"].includes(g.onSave) && !e.save) errors.push(issue(`grants[${i}].onSave`, "conflict", "vínculo condicionado ao teste exige save"));
	});
	if (e.trigger) {
		oneOf(e.trigger.event, TRIGGER_EVENTS, "trigger.event");
		oneOf(e.trigger.owner, TRIGGER_OWNERS, "trigger.owner");
	} else if (e.mode === "triggered") errors.push(issue("trigger", "required", "habilidade com gatilho exige o evento"));
	e.requirements.forEach((r, i) => {
		oneOf(r.kind, REQUIREMENT_KINDS, `requirements[${i}].kind`);
		if (["perScene", "perRound"].includes(r.kind) && r.count !== undefined && r.count !== null && !(Number.isInteger(r.count) && r.count >= 1)) errors.push(issue(`requirements[${i}].count`, "invalid-count", "limite deve ser inteiro ≥ 1"));
		if (r.kind === "affectedBy" && !r.ref) errors.push(issue(`requirements[${i}].ref`, "required", "pré-requisito de vínculo exige a habilidade de origem"));
	});
	for (const key of ["dc", "defense", "result"]) oneOf(e.visibility[key], VISIBILITY_LEVELS, `visibility.${key}`);

	const requested = AUTOMATION.includes(e.automation) ? e.automation : "manual";
	let effective = requested;
	if (errors.length || e.mode === "manual") effective = "manual";
	else if (requested === "automatic" && (e.requirements.some((r) => r.kind === "narrative") || e.effects.some((f) => f.support === "marker"))) effective = "assisted";
	return { valid: !errors.length, errors, requested, effective, automatic: effective === "automatic" };
}

/** Durações que o sistema não expira sozinho: o Mestre encerra. */
export const MANUAL_DURATIONS = ["scene", "untilSaved", "unspecified"];

/**
 * Estado real de automação de uma configuração (não o pedido): quanto do uso o sistema resolve sozinho.
 * - manual: sem configuração utilizável (ausente, mode manual ou inválida);
 * - assistida: o sistema resolve o que está configurado, mas algo fica com o Mestre (pré-requisito narrativo,
 *   marcador sem mecânica, duração sem expiração automática, lacunas declaradas em `gaps`);
 * - automática: tudo o que a habilidade faz está configurado e é resolvido pelo sistema.
 */
export function automationState(execution, { activation = "", gaps = [] } = {}) {
	const e = normalizeExecution(execution);
	if (!e || e.mode === "manual") return { state: "manual", reasons: ["sem configuração de execução"] };
	const verdict = validateExecution(e, { activation });
	if (!verdict.valid) return { state: "manual", reasons: verdict.errors.map((x) => `${x.path}: ${x.code}`) };
	const reasons = [];
	if (e.automation !== "automatic") reasons.push("automação pedida: " + e.automation);
	if (e.requirements.some((r) => r.kind === "narrative")) reasons.push("pré-requisito narrativo");
	if (e.effects.some((f) => f.support === "marker")) reasons.push("condição como marcador manual");
	if (e.effects.some((f) => MANUAL_DURATIONS.includes(f.duration.unit))) reasons.push("duração sem expiração automática");
	if (e.mode === "triggered" && e.trigger?.event === "manual") reasons.push("disparo acionado pelo Mestre");
	if (e.targeting?.rangeUnspecified) reasons.push("alcance não informado no texto");
	for (const gap of gaps) reasons.push("lacuna: " + gap);
	return { state: reasons.length ? "assisted" : "automatic", reasons };
}

/** Campos ausentes/inválidos que o botão Usar deve listar (nunca zero inventado). */
export function missingFields(execution, { activation = "" } = {}) {
	return validateExecution(execution, { activation }).errors.map((x) => x.path);
}
