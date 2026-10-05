// Confere o texto dos itens do suplemento contra o texto extraído do PDF (tools/sah/pdf_extract.py).
//   node tools/sah/verify.mjs <arquivo-com-o-texto-do-pdf>
// Mostra, por item, as palavras do jogo que não existem no livro ("extra") e as do livro que faltam no jogo ("falta").
import fs from "node:fs";
import { PackSource, htmlToBookText } from "./lib.mjs";

const bookFile = process.argv[2];
if (!bookFile) throw new Error("informe o arquivo de texto do PDF");

const tok = (text) =>
	String(text)
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/\[d\]/g, " xdicex ")
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

const raw = fs
	.readFileSync(bookFile, "utf8")
	.split(/\r?\n/)
	.filter((l) => !l.startsWith("====="))
	.map((l) => l.replace(/^\[c\d y\d+ x\d+\]\s*/, ""))
	.join("\n")
	.replace(/¬\n/g, "")
	.replace(/\n/g, " ");
const book = tok(raw);

function lcs(a, b) {
	const n = a.length;
	const m = b.length;
	const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
	for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
	const matchA = new Set();
	const matchB = new Set();
	let i = n;
	let j = m;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			matchA.add(i - 1);
			matchB.add(j - 1);
			i--;
			j--;
		} else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
		else j--;
	}
	return { matchA, matchB, score: dp[n][m] };
}

function check(label, text) {
	const words = tok(text);
	if (words.length < 3) return null;
	// candidatos: posições do livro onde as 3 primeiras palavras aparecem em sequência
	const cands = [];
	for (let p = 0; p < book.length - 3; p++) if (book[p] === words[0] && book[p + 1] === words[1] && book[p + 2] === words[2]) cands.push(p);
	if (!cands.length) {
		// tenta a partir de qualquer trecho de 3 palavras do item
		for (let k = 1; k < Math.min(words.length - 2, 12) && !cands.length; k++)
			for (let p = 0; p < book.length - 3; p++) if (book[p] === words[k] && book[p + 1] === words[k + 1] && book[p + 2] === words[k + 2]) cands.push(Math.max(0, p - k));
	}
	if (!cands.length) return { label, error: "início não encontrado no livro", words: words.length };
	let best = null;
	for (const p of cands) {
		const window = book.slice(p, p + Math.round(words.length * 2.2) + 40);
		const r = lcs(words, window);
		if (!best || r.score > best.r.score) best = { p, window, r };
	}
	const { window, r } = best;
	const extra = words.filter((_w, i) => !r.matchA.has(i));
	const lastB = Math.max(...r.matchB);
	const firstB = Math.min(...r.matchB);
	const falta = window.slice(firstB, lastB + 1).filter((_w, i) => !r.matchB.has(i + firstB));
	return { label, extra, falta, words: words.length };
}

const targets = [];
const add = (packName, pred) => {
	const src = new PackSource(packName);
	for (const d of src.items) if (pred(d)) targets.push({ label: `${packName}: ${d.json.name}`, html: d.json.system?.description ?? "" });
};
const sah = (d) => d.file.includes("sobrevivendo-ao-horror");
add("origins", (d) => sah(d) && !d.json.system.description.includes("Você pode encontrar"));
add("originPowers", (d) => sah(d));
for (const p of ["fighterPowers", "specialistPowers", "occultistPowers", "generalPowers", "pathFighter", "pathSpecialist", "pathOccultist", "paths"]) add(p, sah);
add("survivalPowers", () => true);
add("armaments", sah);
add("general", sah);
add("paranormalPowers", (d) => /Afinidade|Pré-requisito|Conhecimento 1|Energia 1/.test(d.json.system.description) && !d.json.system.description.includes("OGL"));

let bad = 0;
for (const t of targets) {
	let text = htmlToBookText(t.html).replace(/^Origem da comunidade[^\n]*\n\n/, "");
	// o resumo "Elemento desta trilha" e o texto comum do Monstruoso são do gerador
	text = text.replace(/Elemento desta trilha:[^\n]*/g, "").replace(/^\s+|\s+$/g, "");
	const res = check(t.label, text);
	if (!res) continue;
	if (res.error) {
		console.log(`✗ ${res.label}: ${res.error}`);
		bad++;
	} else if (res.extra.length || (res.falta.length && res.falta.length <= 8)) {
		console.log(`△ ${res.label}\n    extra: ${res.extra.join(" ") || "—"}\n    falta: ${res.falta.length <= 8 ? res.falta.join(" ") || "—" : "(trecho do livro intercalado: " + res.falta.length + " palavras)"}`);
		bad++;
	}
}
console.log(`\n${targets.length} itens verificados, ${bad} com diferença`);
