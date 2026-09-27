export const RITUAL_CIRCLE_COSTS = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10 });

export const RITUAL_ELEMENTS = Object.freeze({
	blood: { label: "Sangue", color: "#b3262d", iconIndex: 0 },
	death: { label: "Morte", color: "#6b6f7a", iconIndex: 1 },
	knowledge: { label: "Conhecimento", color: "#c98a12", iconIndex: 2 },
	energy: { label: "Energia", color: "#7d3fc4", iconIndex: 3 },
	fear: { label: "Medo", color: "#4a4a4a", iconIndex: 4 },
});

const FORM_LABELS = Object.freeze({ student: "Discente", true: "Verdadeiro" });

export function ritualBaseCost(circle) {
	const normalizedCircle = Number(circle);
	return RITUAL_CIRCLE_COSTS[normalizedCircle] ?? null;
}

export function ritualLimitFromNex(nex) {
	const value = Number(nex);
	if (!Number.isFinite(value) || value < 0) return null;
	return Math.max(1, Math.min(20, Math.ceil(value / 5)));
}

export function ritualDescriptionText(description = "") {
	return String(description)
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/\s+/g, " ")
		.trim();
}

export function ritualFormDetails(description, form) {
	const label = FORM_LABELS[form];
	if (!label) return null;

	const text = ritualDescriptionText(description);
	const header = new RegExp(`\\b${label}\\s*\\(\\s*\\+\\s*(\\d+)\\s*PE\\s*\\)\\s*:`, "i");
	const match = header.exec(text);
	if (!match) return null;

	const bodyStart = match.index + match[0].length;
	const nextForm = /\b(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/gi;
	nextForm.lastIndex = bodyStart;
	const nextMatch = nextForm.exec(text);
	const body = text.slice(bodyStart, nextMatch?.index ?? text.length).trim();
	const circleMatch = /\bRequer\s+(\d+)\s*[º°o]?\s*c[ií]rculo\b/i.exec(body);
	const affinityMatch = /\bafinidade(?:\s+com\s+([\p{L} ]+?))?(?=[.;,]|$)/iu.exec(body);

	return {
		additionalCost: Number(match[1]),
		body,
		requiredCircle: circleMatch ? Number(circleMatch[1]) : null,
		requiredAffinity: affinityMatch ? affinityMatch[1]?.trim() || "afinidade" : null,
	};
}

export function ritualFormOptions(item) {
	const description = item?.system?.description ?? "";
	const advanced = (form) => {
		const details = ritualFormDetails(description, form);
		return details ?? { additionalCost: undefined, body: "", requiredCircle: null, requiredAffinity: null, needsManualConfirmation: true };
	};
	return {
		basic: { available: true, additionalCost: 0, body: "", requiredCircle: null, requiredAffinity: null },
		student: item?.system?.studentForm ? advanced("student") : null,
		true: item?.system?.trueForm ? advanced("true") : null,
	};
}

export function ritualFinalCost(circle, form, advancedDetails, manualAdditionalCost = null) {
	const baseCost = ritualBaseCost(circle);
	if (baseCost === null) return null;
	if (form === "basic") return baseCost;
	if (!FORM_LABELS[form]) return null;

	if (advancedDetails?.additionalCost === undefined && (manualAdditionalCost === null || manualAdditionalCost === "")) return null;
	const additional = advancedDetails?.additionalCost ?? Number(manualAdditionalCost);
	if (!Number.isInteger(additional) || additional < 0) return null;
	return baseCost + additional;
}

export function inspectRitualResource(actor, globalPlayingWithoutSanity) {
	if (!globalPlayingWithoutSanity) {
		return { ok: false, reason: "mode-required", key: null, resource: null };
	}
	const resource = actor?.system?.PD;
	if (!resource || !Number.isFinite(Number(resource.value))) {
		return { ok: false, reason: "pd-missing", key: "PD", resource: null };
	}
	return { ok: true, reason: null, key: "PD", resource };
}

export function validateRitualCast({
	cost,
	balance,
	perRoundLimit,
	minimumCost = 1,
	advanced = false,
	requirementsConfirmed = true,
	preparationConfirmed = true,
	specialRequirementConfirmed = true,
	minimumCostExceptionConfirmed = false,
}) {
	const errors = [];
	if (!Number.isInteger(cost) || cost < 1) errors.push("custo-invalido");
	if (!Number.isInteger(Number(perRoundLimit)) || Number(perRoundLimit) < 1 || Number(perRoundLimit) > 99) errors.push("limite-invalido");
	if (advanced && !requirementsConfirmed) errors.push("pre-requisitos-nao-confirmados");
	if (!preparationConfirmed) errors.push("preparacao-nao-confirmada");
	if (!specialRequirementConfirmed) errors.push("requisito-especial-nao-confirmado");
	if (Number.isInteger(Number(perRoundLimit)) && Number(perRoundLimit) >= 1 && cost > Number(perRoundLimit) && !(cost === Number(minimumCost) && minimumCostExceptionConfirmed)) {
		errors.push("acima-do-limite-por-uso");
	}
	if (!Number.isFinite(Number(balance)) || cost > Number(balance)) errors.push("pd-insuficiente");
	return { ok: errors.length === 0, errors };
}

export function ritualResistanceTarget(item) {
	const skill = item?.system?.skillResis;
	return ["resilience", "reflexes", "will"].includes(skill) ? skill : null;
}
