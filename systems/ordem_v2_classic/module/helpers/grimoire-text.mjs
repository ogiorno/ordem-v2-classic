// Texto do Grimório: normalização, chave fonética do português, distância de edição e a busca tolerante a erro de digitação.
// Funções puras (sem Foundry) para rodar com `node --test`. Spec: docs/arquivo/spec-grimorio-do-jogador.md, seção 5.5.

/** Minúsculas, sem acento, sem pontuação, espaços colapsados. "Cicatrização" → "cicatrizacao". */
export function normalizeText(value) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

/** Palavras do texto, já normalizadas. */
export function tokenize(value) {
	const text = normalizeText(value);
	return text ? text.split(" ") : [];
}

/**
 * Chave fonética do português: grafias que soam iguais ficam com a mesma chave.
 * `cicatrizassão` e `cicatrização` → mesma chave; `hemofajia` e `hemofagia` → mesma chave.
 * Não tenta ser exaustiva: a lista cresce com os casos reais dos testes.
 */
export function phoneticKey(value) {
	let w = String(value ?? "").toLowerCase().replace(/ç/g, "s").normalize("NFD").replace(/[̀-ͯ]/g, "");
	w = w.replace(/[^a-z0-9]/g, "");
	if (!w) return "";
	// dígrafos primeiro (viram uma letra só): ch/sh → x, lh → L, nh → N
	w = w.replace(/ch|sh/g, "x").replace(/lh/g, "L").replace(/nh/g, "N");
	w = w.replace(/h/g, ""); // h mudo (inclusive no começo)
	w = w.replace(/qu(?=[ei])/g, "k").replace(/gu(?=[ei])/g, "g").replace(/q/g, "k");
	w = w.replace(/sc(?=[ei])|xc(?=[ei])|ss/g, "s");
	w = w.replace(/c(?=[ei])/g, "s").replace(/c/g, "k");
	w = w.replace(/g(?=[ei])/g, "j");
	w = w.replace(/z/g, "s").replace(/y/g, "i").replace(/w/g, "u");
	w = w.replace(/(.)\1+/g, "$1"); // letras dobradas
	w = w.replace(/(?:aum|ao|am)$/, "au");
	w = w.replace(/e$/, "i").replace(/o$/, "u");
	return w;
}

/**
 * Distância de edição (inserir, apagar, trocar e inverter duas letras vizinhas contam 1).
 * Para assim que passa de `max` (devolve `max + 1`).
 */
export function editDistance(a, b, max = Infinity) {
	if (a === b) return 0;
	const la = a.length;
	const lb = b.length;
	if (Math.abs(la - lb) > max) return max + 1;
	if (!la) return lb;
	if (!lb) return la;
	let prev2 = null;
	let prev = Array.from({ length: lb + 1 }, (_, j) => j);
	for (let i = 1; i <= la; i++) {
		const cur = [i];
		let rowMin = i;
		for (let j = 1; j <= lb; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
			cur[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		prev2 = prev;
		prev = cur;
	}
	return prev[lb] > max ? max + 1 : prev[lb];
}

/** Erros aceitos pelo tamanho da palavra digitada: 1–3 letras só exato ou prefixo; 4–7: um erro; 8 ou mais: dois. */
export function toleranceFor(length) {
	if (length <= 3) return 0;
	return length <= 7 ? 1 : 2;
}

/** Mesmo radical: o começo comum tem pelo menos 5 letras e 70% da menor palavra. */
export function sharedStem(a, b) {
	const min = Math.min(a.length, b.length);
	let n = 0;
	while (n < min && a[n] === b[n]) n++;
	return n >= 5 && n >= Math.ceil(min * 0.7);
}

/** Camadas da busca, da mais exata para a mais frouxa. */
export const MATCH = Object.freeze({ EXACT: 0, PREFIX: 1, CONTAINS: 2, STEM: 3, PHONETIC: 4, EDIT1: 5, EDIT2: 6 });
export const FUZZY_FROM = MATCH.PHONETIC;

/**
 * Como a palavra digitada `q` casa com a palavra `t` do nome.
 * `fuzzy` liga a fonética e a distância de edição. Devolve `null` se não casa.
 */
export function matchWord(q, t, { fuzzy = false } = {}) {
	if (!q || !t) return null;
	if (q === t) return MATCH.EXACT;
	if (t.startsWith(q)) return MATCH.PREFIX;
	if (q.length >= 3 && t.includes(q)) return MATCH.CONTAINS;
	if (sharedStem(q, t)) return MATCH.STEM;
	if (!fuzzy || q.length < 4 || /\d/.test(q)) return null;
	if (phoneticKey(q) && phoneticKey(q) === phoneticKey(t)) return MATCH.PHONETIC;
	const tol = toleranceFor(q.length);
	if (!tol) return null;
	const d = editDistance(q, t, tol);
	if (d <= tol) return d === 1 ? MATCH.EDIT1 : MATCH.EDIT2;
	// o jogador ainda está digitando e errou: compara com o começo da palavra do mesmo tamanho
	const head = t.slice(0, q.length);
	if (head.length >= 4) {
		const dh = editDistance(q, head, tol);
		if (dh <= tol) return dh === 1 ? MATCH.EDIT1 : MATCH.EDIT2;
	}
	return null;
}

/**
 * Prepara uma entrada para a busca (uma vez, no índice): palavras do nome e texto normalizado.
 * `aliases`: outros nomes pelos quais o item é conhecido (fica para a Fase 3).
 */
export function searchFields(name, text = "", aliases = []) {
	const nameTokens = tokenize(name);
	for (const alias of aliases) nameTokens.push(...tokenize(alias));
	return { nameNorm: normalizeText(name), nameTokens, textNorm: normalizeText(text) };
}

function bestNameMatch(qWord, nameTokens, fuzzy) {
	let best = null;
	let via = null;
	for (const t of nameTokens) {
		const m = matchWord(qWord, t, { fuzzy });
		if (m !== null && (best === null || m < best)) {
			best = m;
			via = t;
			if (best === MATCH.EXACT) break;
		}
	}
	return best === null ? null : { kind: best, via };
}

/**
 * Casa uma entrada com a busca. Cada palavra digitada precisa casar ("E"); o nome tem prioridade sobre o texto.
 * O texto da descrição só casa exato (trecho), nunca aproximado.
 * @returns {{tier:number, name:number, approx:boolean, hits:{word:string,kind:number|"text",via:string|null}[]}|null}
 */
export function matchEntry(entry, words, { fuzzy = false } = {}) {
	const hits = [];
	let tier = 0;
	let nameHits = 0;
	for (const w of words) {
		const m = bestNameMatch(w, entry.nameTokens, fuzzy);
		if (m) {
			hits.push({ word: w, kind: m.kind, via: m.via });
			tier = Math.max(tier, m.kind);
			nameHits++;
			continue;
		}
		if (w.length >= 2 && entry.textNorm.includes(w)) {
			hits.push({ word: w, kind: "text", via: null });
			tier = Math.max(tier, 90);
			continue;
		}
		return null;
	}
	return { tier, name: nameHits, approx: hits.some((h) => h.kind !== "text" && h.kind >= FUZZY_FROM), hits };
}

const byRank = (a, b) => a.tier - b.tier || b.name - a.name || a.entry.nameNorm.localeCompare(b.entry.nameNorm);

/**
 * Busca no índice. Primeiro só o que é exato (nome inteiro, prefixo, trecho, mesmo radical, texto);
 * se vierem menos de `minExact` resultados, entram também os aproximados (fonética e erro de digitação),
 * marcados e sempre depois dos exatos.
 * @returns {{results:{entry:object, tier:number, name:number, approx:boolean, hits:object[]}[], approximate:boolean, onlyApproximate:boolean, suggestions:object[]}}
 */
export function searchEntries(entries, query, { fuzzy = true, minExact = 5 } = {}) {
	const words = tokenize(query);
	if (!words.length) return { results: entries.map((entry) => ({ entry, tier: 0, name: 0, approx: false, hits: [] })), approximate: false, onlyApproximate: false, suggestions: [] };
	const exact = [];
	for (const entry of entries) {
		const m = matchEntry(entry, words, { fuzzy: false });
		if (m) exact.push({ entry, ...m });
	}
	exact.sort(byRank);
	if (!fuzzy || exact.length >= minExact) return { results: exact, approximate: false, onlyApproximate: false, suggestions: [] };
	const seen = new Set(exact.map((r) => r.entry.uuid ?? r.entry.nameNorm));
	const loose = [];
	for (const entry of entries) {
		if (seen.has(entry.uuid ?? entry.nameNorm)) continue;
		const m = matchEntry(entry, words, { fuzzy: true });
		if (m) loose.push({ entry, ...m, approx: true });
	}
	loose.sort(byRank);
	const results = [...exact, ...loose];
	return { results, approximate: loose.length > 0, onlyApproximate: !exact.length && loose.length > 0, suggestions: results.length ? [] : didYouMean(entries, words.join(" ")) };
}

/** Até `limit` nomes parecidos com o que foi digitado, para o "Você quis dizer". */
export function didYouMean(entries, query, limit = 3) {
	const q = normalizeText(query);
	if (q.length < 3) return [];
	const scored = [];
	for (const entry of entries) {
		let best = Infinity;
		for (const t of [entry.nameNorm, ...entry.nameTokens]) {
			const max = Math.max(2, Math.ceil(Math.max(q.length, t.length) * 0.4));
			const d = editDistance(q, t, max);
			if (d <= max) best = Math.min(best, d / Math.max(q.length, t.length));
		}
		if (best <= 0.45) scored.push({ entry, score: best });
	}
	scored.sort((a, b) => a.score - b.score || a.entry.nameNorm.localeCompare(b.entry.nameNorm));
	return scored.slice(0, limit).map((s) => s.entry);
}
