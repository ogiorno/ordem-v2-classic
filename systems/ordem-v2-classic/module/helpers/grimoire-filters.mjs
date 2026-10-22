// Filtros do Grimório (GR-15 a GR-17, GR-55): "E" entre filtros diferentes, "OU" dentro do mesmo filtro. Funções puras.

/** Filtros vazios (nenhum filtro ligado). Cada chave é uma lista de valores aceitos. */
export const EMPTY_FILTERS = Object.freeze({
	element: [],
	circle: [],
	functions: [],
	execution: [],
	range: [],
	duration: [],
	resistance: [],
	form: [],
	target: [],
	abilityType: [],
	className: [],
	pathName: [],
	cost: [],
	activation: [],
	category: [],
	curseKind: [],
	source: [],
});

/** Filtros que só existem para um tipo de entrada (o resto vale para todos). */
export const FILTER_KINDS = Object.freeze({
	circle: "ritual", functions: "ritual", execution: "ritual", range: "ritual", duration: "ritual", resistance: "ritual", form: "ritual", target: "ritual",
	abilityType: "power", className: "power", pathName: "power", cost: "power", activation: "power",
	category: "condition",
	curseKind: "curse",
});

export function emptyFilters() {
	return Object.fromEntries(Object.keys(EMPTY_FILTERS).map((k) => [k, []]));
}

/** Faixa de custo de um poder: 0, 1, 2 ou 3+ (PE). */
export function costBucket(cost) {
	const n = Number(cost) || 0;
	return n >= 3 ? "3+" : String(n);
}

function valuesOf(entry, key) {
	switch (key) {
		case "circle": return [entry.circle];
		case "resistance": return [entry.skillResis || "none"];
		case "form": return [entry.studentForm && "student", entry.trueForm && "true"].filter(Boolean);
		case "target": return [entry.targetKind];
		case "functions": return entry.functions?.length ? entry.functions : ["none"];
		case "cost": return [costBucket(entry.cost)];
		case "activation": return [entry.activation || "none"];
		default: return [entry[key]];
	}
}

function passes(entry, key, wanted) {
	if (!wanted?.length) return true;
	const need = FILTER_KINDS[key];
	if (need && entry.kind !== need) return false;
	const have = valuesOf(entry, key);
	return have.some((v) => wanted.includes(v));
}

/** Aplica os filtros. `ignore`: chave que não deve ser aplicada (para a contagem de cada chip). */
export function applyFilters(entries, filters = {}, { ignore = null } = {}) {
	const keys = Object.keys(EMPTY_FILTERS).filter((k) => k !== ignore && filters[k]?.length);
	if (!keys.length) return entries.slice();
	return entries.filter((e) => keys.every((k) => passes(e, k, filters[k])));
}

/** Quantos itens cada valor de um filtro traria, considerando os outros filtros já ligados. */
export function facetCounts(entries, filters, key) {
	const base = applyFilters(entries, filters, { ignore: key });
	const counts = {};
	for (const e of base) {
		if (FILTER_KINDS[key] && e.kind !== FILTER_KINDS[key]) continue;
		for (const v of valuesOf(e, key)) if (v !== undefined && v !== null && v !== "") counts[v] = (counts[v] ?? 0) + 1;
	}
	return counts;
}

/** Quantos filtros estão ligados (para o botão "Mais filtros (n)"). `only`: restringe a algumas chaves. */
export function countActiveFilters(filters, only = null) {
	return Object.keys(EMPTY_FILTERS).filter((k) => (!only || only.includes(k)) && filters[k]?.length).length;
}

/** Liga ou desliga um valor num filtro (devolve filtros novos; não altera o original). */
export function toggleFilter(filters, key, value) {
	const next = { ...emptyFilters(), ...filters };
	const list = new Set(next[key] ?? []);
	if (list.has(value)) list.delete(value);
	else list.add(value);
	next[key] = [...list];
	return next;
}

export const SORT_MODES = Object.freeze(["relevance", "name", "circle", "cost", "function"]);

/** Ordena para exibição. `relevance` mantém a ordem recebida (a da busca). */
export function sortEntries(entries, mode = "name") {
	const byName = (a, b) => a.nameNorm.localeCompare(b.nameNorm);
	const list = entries.slice();
	switch (mode) {
		case "relevance": return list;
		case "circle": return list.sort((a, b) => (a.circle ?? 99) - (b.circle ?? 99) || byName(a, b));
		case "cost": return list.sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || byName(a, b));
		case "function": return list.sort((a, b) => (a.functions?.length ? 0 : 1) - (b.functions?.length ? 0 : 1) || String(a.functions?.[0] ?? "").localeCompare(String(b.functions?.[0] ?? "")) || byName(a, b));
		default: return list.sort(byName);
	}
}
