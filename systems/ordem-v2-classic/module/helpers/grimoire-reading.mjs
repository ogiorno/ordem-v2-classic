// Leitura do Grimório: faixa de dados do ritual (GR-64), formas Básico/Discente/Verdadeiro (GR-18) e regra curta da condição (GR-67).
// Funções puras. Spec 5.1 e 4.10.
import { ritualFormDetails, ritualDescriptionText, ritualBaseCost } from "../macros/ritual-caster-logic.mjs";
import { plainText } from "./grimoire-index.mjs";

const EXECUTION = { default: "Padrão", complete: "Completa", free: "Livre", reaction: "Reação" };
const RANGE = { personal: "Pessoal", touch: "Toque", short: "Curto", medium: "Médio", long: "Longo", extreme: "Extremo", unlimited: "Ilimitado" };
const DURATION = { instantaneous: "Instantânea", scene: "Cena", sustained: "Sustentada", setDuration: "Definida" };
const SKILL = { will: "Vontade", resilience: "Fortitude", reflexes: "Reflexos" };
const EFFECT = { nullifies: "anula", partial: "parcial", reducesByHalf: "reduz à metade", discredits: "desacredita" };

const clean = (v) => {
	const t = String(v ?? "").trim();
	return !t || t === "—" || t === "-" ? "" : t;
};
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/** Tira o marcador de lista (-, –, •) que sobra no fim do trecho quando a descrição vem de uma lista "- Discente (+2 PE): …". */
const tidy = (t) => String(t ?? "").replace(/(?:\s*[-–—•])+\s*$/, "").trim();

/**
 * Células da faixa de dados do ritual, num conjunto único: Execução, Alcance, Alvo/Área, Duração, Resistência, Custo.
 * Célula sem dado some (sem "—"). Usa o cabeçalho do livro (já conferido) e, na falta, os campos do item.
 * @param {object} entry  entrada do índice (grimoire-index.mjs)
 * @param {{resource?: string}} [opts]  `resource`: "PE" ou "PD" (regra Jogando sem Sanidade)
 */
export function ritualFactCells(entry, { resource = "PE" } = {}) {
	const f = entry.facts ?? {};
	const execution = clean(f.execution) || EXECUTION[entry.execution] || "";
	const range = clean(f.range) || RANGE[entry.range] || "";
	const veja = /^veja/i.test(clean(f.target) || entry.target || "");
	const target = veja ? clean(entry.areaName) : clean(f.target) || clean(entry.target) || clean(entry.areaName); // "Veja texto" sem área: a célula some e a descrição explica
	const duration = clean(f.duration) || DURATION[entry.duration] || "";
	const resistance = clean(f.resistance) || [SKILL[entry.skillResis], EFFECT[entry.resistance]].filter(Boolean).join(" ");
	const cost = entry.cost ?? ritualBaseCost(entry.circle);
	return [
		{ key: "execution", label: "Execução", icon: "hourglass-start", value: cap(execution) },
		{ key: "range", label: "Alcance", icon: "crosshairs", value: cap(range) },
		{ key: "target", label: "Alvo/Área", icon: "bullseye", value: cap(target) },
		{ key: "duration", label: "Duração", icon: "clock", value: cap(duration) },
		{ key: "resistance", label: "Resistência", icon: "shield-halved", value: cap(resistance) },
		{ key: "cost", label: "Custo", icon: "droplet", value: cost ? `${cost} ${resource}` : "" },
	].filter((c) => c.value);
}

/**
 * Formas do ritual a partir da descrição (HTML do item): texto básico e, quando existem, Discente e Verdadeiro,
 * cada uma com o custo adicional, o círculo exigido e a afinidade (via `ritualFormDetails`).
 * @returns {{basic:{text:string,cost:number|null}, student:object|null, true:object|null}}
 */
export function ritualForms(descriptionHtml, circle, { studentForm = true, trueForm = true } = {}) {
	const text = ritualDescriptionText(descriptionHtml);
	const cut = /\b(?:Discente|Verdadeiro)\s*\(\s*\+\s*\d+\s*PE\s*\)\s*:/i.exec(text);
	const base = ritualBaseCost(circle);
	const form = (key, enabled) => {
		if (!enabled) return null;
		const d = ritualFormDetails(descriptionHtml, key);
		if (!d) return null;
		return { text: tidy(d.body), additionalCost: d.additionalCost, cost: base === null ? null : base + d.additionalCost, requiredCircle: d.requiredCircle, requiredAffinity: d.requiredAffinity };
	};
	return {
		basic: { text: tidy(cut ? text.slice(0, cut.index) : text), cost: base },
		student: form("student", studentForm),
		true: form("true", trueForm),
	};
}

/**
 * Regra curta de uma condição: a do sistema, se houver; senão a primeira frase do texto do livro
 * (sem o nome da condição que abre o texto, ex.: "Abalado. O personagem sofre…" → "O personagem sofre −1d20 em testes.").
 */
export function shortConditionRule(bookHtml, systemRule = null, { name = "", max = 160 } = {}) {
	if (systemRule) return systemRule;
	let text = plainText(bookHtml.replace(/<blockquote[\s\S]*$/i, ""));
	if (name) {
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		text = text.replace(new RegExp(`^${escaped}\\.\\s*`, "i"), "");
	}
	const first = /^(.+?[.!?])(?:\s|$)/.exec(text)?.[1] ?? text;
	return first.length > max ? `${first.slice(0, max - 1).trim()}…` : first;
}

/**
 * Blocos de uma condição. O livro traz um texto só; só vira bloco o que o texto de fato tem
 * (ex.: um parágrafo começando por "Efeitos"), sem inventar subtítulos.
 * @returns {{title:string|null, text:string}[]}
 */
export function conditionBlocks(bookHtml) {
	const paragraphs = String(bookHtml ?? "").split(/<\/p>|<br\s*\/?>/i).map((p) => ritualDescriptionText(p)).filter(Boolean);
	const blocks = [];
	let current = null;
	for (const p of paragraphs) {
		const m = /^(Descrição|Efeitos?|Como remover|Remoção|Veja também)\s*[:.]?\s*(.*)$/i.exec(p);
		if (m && p.length - m[1].length < 400) {
			current = { title: m[1].replace(/^./, (c) => c.toUpperCase()), text: m[2] };
			blocks.push(current);
		} else if (current) current.text = `${current.text} ${p}`.trim();
		else blocks.push((current = { title: null, text: p }));
	}
	return blocks.filter((b) => b.text || b.title);
}
