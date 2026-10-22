// Alvos e alcance de um ritual, lidos do item (campos `range`, `target`) e do texto da forma (Discente/Verdadeiro).
// Funções puras: não dependem do Foundry, para poderem ser testadas com `node --test`.

/** Alcance em metros (Livro v1.3). Toque = no espaço ao lado; Pessoal = só o conjurador. */
export const RANGE_METERS = Object.freeze({ short: 9, medium: 18, long: 36, extreme: 90 });

const RANGE_LABELS = Object.freeze({ personal: "pessoal", touch: "toque", short: "curto (9 m)", medium: "médio (18 m)", long: "longo (36 m)", extreme: "extremo (90 m)", unlimited: "ilimitado" });

const RANGE_WORDS = Object.freeze({
	pessoal: "personal", toque: "touch", curto: "short", médio: "medium", medio: "medium", longo: "long", extremo: "extreme", ilimitado: "unlimited",
});

const NUMBER_WORDS = Object.freeze({ um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 });

/**
 * Alcance efetivo do ritual.
 * - Sem informação no item, vale curto (9 m).
 * - Se o texto da forma muda o alcance ("muda o alcance para “longo”", "alcance médio"), ele vale no lugar do item.
 * @param {{system:{range?:string}}} item
 * @param {string} [formBody]  texto da forma escolhida (Discente/Verdadeiro), vazio no básico
 * @returns {{kind:"personal"|"touch"|"meters"|"unlimited", meters:number|null, key:string, label:string}}
 */
export function ritualRange(item, formBody = "") {
	let key = String(item?.system?.range ?? "").trim();
	const fromForm = /alcance\s+(?:para\s+)?[“"']?\s*(pessoal|toque|curto|médio|medio|longo|extremo|ilimitado)/i.exec(String(formBody ?? ""));
	if (fromForm) key = RANGE_WORDS[fromForm[1].toLowerCase()];
	if (!RANGE_LABELS[key]) key = "short";
	if (key === "personal") return { kind: "personal", meters: 0, key, label: RANGE_LABELS[key] };
	if (key === "touch") return { kind: "touch", meters: 0, key, label: RANGE_LABELS[key] };
	if (key === "unlimited") return { kind: "unlimited", meters: null, key, label: RANGE_LABELS[key] };
	return { kind: "meters", meters: RANGE_METERS[key], key, label: RANGE_LABELS[key] };
}

function wordToNumber(word) {
	const clean = String(word).toLowerCase();
	return NUMBER_WORDS[clean] ?? (Number.isFinite(Number(clean)) ? Number(clean) : null);
}

/** Maior quantidade de alvos citada no trecho ("1 ser ou 2 pessoas" → 2, "até 5 seres" → 5, "alvos escolhidos" → null = sem limite). */
function countTargets(text) {
	const lower = String(text ?? "").toLowerCase();
	if (/alvos?\s+escolhidos?|seres\s+escolhidos?\s+(?:no|dentro)/.test(lower) && !/\d|\buma?\b|dois|três|quatro|cinco/.test(lower)) return { max: null };
	const numbers = [...lower.matchAll(/(?:até\s+)?(\d+|um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:outros?\s+)?(?:seres?|pessoas?|alvos?|criaturas?|inimigos?|aliados?|voluntários?)/g)]
		.map((match) => wordToNumber(match[1]))
		.filter((value) => Number.isFinite(value));
	if (numbers.length) return { max: Math.max(...numbers) };
	return null;
}

/**
 * O que o ritual pede como alvo.
 * @returns {{kind:"self"|"creature"|"object"|"area"|"unknown", max:number|null, label:string}}
 *   max = quantidade máxima de alvos (null = sem limite conhecido).
 */
export function ritualTargets(item, formBody = "") {
	const base = String(item?.system?.target ?? "").trim();
	const body = String(formBody ?? "");
	// "muda o alvo para “até 5 seres escolhidos”" / "muda o alvo para “alvos escolhidos”"
	const changed = /(?:muda|mudam)\s+o\s+alvo\s+para\s+[“"']?([^”"'.;]+)/i.exec(body);
	const targetText = changed ? changed[1] : base;
	const lower = targetText.toLowerCase();

	if (/(^|\s)você(\s|$)/.test(lower) && !/\d/.test(lower)) return { kind: "self", max: 0, label: "você" };
	if (/área/.test(lower)) return { kind: "area", max: null, label: targetText };
	const counted = countTargets(targetText) ?? countTargets(body.match(/até\s+[^.;]{0,40}\b(?:seres|alvos|pessoas)[^.;]{0,30}/i)?.[0]);
	if (/objeto|arma|acess[oó]rio|cad[aá]ver/.test(lower) && !/\bser(es)?\b|pessoa/.test(lower)) {
		return { kind: "object", max: counted?.max ?? 1, label: targetText };
	}
	if (counted) return { kind: "creature", max: counted.max, label: targetText };
	if (!lower || /veja texto|veja descri/.test(lower)) return { kind: "unknown", max: null, label: targetText };
	return { kind: "creature", max: 1, label: targetText };
}

/** Menor distância entre dois retângulos (px). Zero quando se tocam, inclusive na diagonal. */
export function rectGap(a, b) {
	const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
	const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
	return Math.hypot(dx, dy);
}

/** Distância (px) de um ponto até um retângulo. */
export function pointGap(point, rect) {
	return rectGap({ x: point.x, y: point.y, w: 0, h: 0 }, rect);
}

/** O alvo está dentro do alcance? `gapPx` = distância entre o conjurador e o alvo em pixels. */
export function withinRange(range, gapPx, pxPerMeter) {
	if (range.kind === "unlimited") return true;
	if (range.kind === "personal") return false;
	if (range.kind === "touch") return gapPx <= 1; // espaço ao lado (inclusive diagonal)
	return gapPx / pxPerMeter <= range.meters + 1e-6;
}

/**
 * Confere a seleção de alvos contra o que o ritual exige.
 * @param {object} p
 * @param {ReturnType<ritualRange>} p.range
 * @param {ReturnType<ritualTargets>} p.targets
 * @param {{x:number,y:number,w:number,h:number}} p.caster   retângulo do token do conjurador (px)
 * @param {{id:string,name:string,x:number,y:number,w:number,h:number}[]} p.selected   alvos marcados
 * @param {number} p.pxPerMeter
 * @returns {{ok:boolean, valid:string[], problems:string[]}}
 */
export function validateTargetSelection({ range, targets, caster, selected, pxPerMeter }) {
	const problems = [];
	if (targets.kind === "self" || range.kind === "personal") {
		return { ok: true, valid: [], problems: [] };
	}
	if (!selected.length) return { ok: false, valid: [], problems: ["Nenhum alvo marcado."] };
	if (targets.max !== null && targets.max > 0 && selected.length > targets.max) {
		problems.push(`Este ritual afeta no máximo ${targets.max} alvo${targets.max > 1 ? "s" : ""}; você marcou ${selected.length}.`);
	}
	const valid = [];
	for (const target of selected) {
		if (withinRange(range, rectGap(caster, target), pxPerMeter)) valid.push(target.id);
		else problems.push(`${target.name} está fora do alcance (${range.label}).`);
	}
	return { ok: problems.length === 0 && valid.length > 0, valid, problems };
}

/** O ponto escolhido para a área está dentro do alcance do ritual? (área centrada no conjurador não precisa de teste) */
export function validateAreaPlacement({ range, caster, point, pxPerMeter }) {
	if (range.kind === "personal" || range.kind === "unlimited") return { ok: true };
	if (range.kind === "touch") {
		return pointGap(point, caster) < pxPerMeter * 1.5 ? { ok: true } : { ok: false, reason: "A área precisa começar ao lado de você (alcance toque)." };
	}
	const gap = pointGap(point, caster) / pxPerMeter;
	return gap <= range.meters + 1e-6 ? { ok: true } : { ok: false, reason: `Fora do alcance (${range.label}): a área só pode ser colocada até ${range.meters} m de você.` };
}
