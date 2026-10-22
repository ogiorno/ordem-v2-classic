// Regras do "Para mim" do Grimório (GR-30 a GR-32, GR-52, GR-53): o que o personagem já tem, pode aprender, ainda não pode
// ou precisa conferir com a mesa. Funções puras: recebem os fatos do personagem (`facts`) montados pela janela.
// Spec: docs/arquivo/spec-grimorio-do-jogador.md, seção 6.
import { normalizeText } from "./grimoire-text.mjs";

export const STATE = Object.freeze({ HAVE: "have", AVAILABLE: "available", CHECK: "check", LATER: "later", OTHER: "other", NO_ACCESS: "no-access" });
/** Estados que aparecem no "Para mim" (o resto só aparece na busca ou com o interruptor desligado). */
export const FOR_ME = Object.freeze([STATE.HAVE, STATE.AVAILABLE, STATE.CHECK]);

/** NEX mínimo de cada círculo de ritual (Livro v1.3: 1º desde o início; 2º NEX 25%; 3º NEX 55%; 4º NEX 85%). */
export const CIRCLE_NEX = Object.freeze({ 1: 0, 2: 25, 3: 55, 4: 85 });

/** Maior círculo que o NEX permite lançar. */
export function circleUnlockedByNex(nex) {
	const n = Number(nex) || 0;
	return n >= 85 ? 4 : n >= 55 ? 3 : n >= 25 ? 2 : 1;
}

const ATTRS = { forca: "str", agilidade: "dex", inteligencia: "int", intelecto: "int", presenca: "pre", vigor: "vit" };
const ATTR_LABEL = { str: "Força", dex: "Agilidade", int: "Intelecto", pre: "Presença", vit: "Vigor" };
const ELEMENT_WORDS = ["conhecimento", "energia", "morte", "sangue", "medo"];

/**
 * Lê o texto de requisito (`preRequisite`) em cláusulas. `ctx.skillNames`: nomes de perícia já normalizados;
 * `ctx.powerNames`: nomes de poderes já normalizados. O que não casa vira `unknown` (nunca bloqueia por engano).
 * @returns {{type:"attr"|"nex"|"skill"|"path"|"power"|"stage"|"unknown", [k:string]:any, text:string}[]}
 */
export function parsePrerequisite(text, { skillNames = new Set(), powerNames = new Set() } = {}) {
	const raw = String(text ?? "").trim();
	if (!raw) return [];
	const isSkillList = (s) => s.split(/\s+ou\s+/).every((p) => skillNames.has(p));
	const parts = raw.split(/\s*&\s*|\s*,\s*/).flatMap((part) => {
		const n = normalizeText(part);
		// "Percepção e Tática": duas perícias exigidas
		const both = n.split(/\s+e\s+/);
		return both.length === 2 && both.every((p) => isSkillList(p)) ? both.map((p) => ({ text: p, n: p })) : [{ text: part.trim(), n }];
	});
	return parts.filter((p) => p.n).map(({ text: t, n }) => {
		let m;
		if ((m = /^(forca|agilidade|inteligencia|intelecto|presenca|vigor) (\d+)$/.exec(n))) return { type: "attr", attr: ATTRS[m[1]], min: Number(m[2]), text: t };
		if ((m = /^nex (\d+)$/.exec(n))) return { type: "nex", min: Number(m[1]), text: t };
		if ((m = /^trilha (.+)$/.exec(n))) return { type: "path", name: m[1], text: t };
		if ((m = /^treinad[oa] (?:em|na|no) (.+)$/.exec(n))) return isSkillList(m[1]) ? { type: "skill", names: m[1].split(/\s+ou\s+/), text: t } : { type: "unknown", text: t };
		if (isSkillList(n)) return { type: "skill", names: n.split(/\s+ou\s+/), text: t };
		if (ELEMENT_WORDS.some((e) => n.startsWith(`${e} `)) || /^especialista em /.test(n)) return { type: "unknown", text: t };
		if (powerNames.has(n)) return { type: "power", name: n, text: t };
		return { type: "unknown", text: t };
	});
}

/** Confere uma cláusula. @returns {{ok:boolean|null, reason?:string}} (`null` = não dá para avaliar) */
export function checkClause(c, facts) {
	switch (c.type) {
		case "attr": return (facts.attributes?.[c.attr] ?? 0) >= c.min ? { ok: true } : { ok: false, reason: `Falta ${ATTR_LABEL[c.attr]} ${c.min}` };
		case "nex": return (facts.nex ?? 0) >= c.min ? { ok: true } : { ok: false, reason: `Falta NEX ${c.min}%` };
		case "stage": return (facts.stage ?? 0) >= c.min ? { ok: true } : { ok: false, reason: `Falta o estágio ${c.min}` };
		case "skill": return c.names.some((n) => facts.trainedSkills?.has(n)) ? { ok: true } : { ok: false, reason: `Falta treinar ${c.text.replace(/^treinad[oa] (?:em|na|no) /i, "")}` };
		case "path": return facts.pathNames?.has(c.name) ? { ok: true } : { ok: false, reason: `Falta a trilha ${c.text.replace(/^trilha:\s*/i, "")}` };
		case "power": return facts.powerNames?.has(c.name) ? { ok: true } : { ok: false, reason: `Falta o poder ${c.text}` };
		default: return { ok: null };
	}
}

/** Resultado do requisito: falhou (primeira razão), não dá para avaliar, ou ok. */
export function checkPrerequisite(text, facts, ctx) {
	const clauses = parsePrerequisite(text, ctx);
	let unknown = null;
	for (const c of clauses) {
		const r = checkClause(c, facts);
		if (r.ok === false) return { ok: false, reason: r.reason };
		if (r.ok === null) unknown ??= c.text;
	}
	return unknown ? { ok: null, text: String(text).trim() } : { ok: true };
}

/**
 * Fatos do personagem (a janela monta a partir da ficha).
 * @typedef {object} Facts
 * @property {number} nex
 * @property {number} [stage]                estágio do Sobrevivente
 * @property {string|null} className         "Combatente" | "Especialista" | "Ocultista" | "Sobrevivente"
 * @property {boolean} hasRitualAccess       a classe ou um poder dá acesso a rituais
 * @property {{[k:string]:number}} attributes  str, dex, int, pre, vit
 * @property {Set<string>} trainedSkills     nomes normalizados das perícias treinadas
 * @property {Set<string>} pathNames         trilhas do personagem (normalizadas)
 * @property {Set<string>} powerNames        poderes que já tem (normalizados)
 * @property {Set<string>} ritualNames       rituais que já tem (normalizados)
 */

/** Disponibilidade de um ritual para o personagem. */
export function ritualAvailability(entry, facts) {
	if (facts.ritualNames?.has(normalizeText(entry.name))) return { state: STATE.HAVE };
	if (!facts.hasRitualAccess) return { state: STATE.NO_ACCESS, reason: "Sua classe não aprende rituais por padrão" };
	if (facts.className !== "Ocultista") return { state: STATE.CHECK, reason: "O círculo depende do poder que dá acesso a rituais" };
	const max = circleUnlockedByNex(facts.nex);
	if (entry.circle > max) return { state: STATE.LATER, reason: `Falta NEX ${CIRCLE_NEX[entry.circle]}%` };
	return { state: STATE.AVAILABLE };
}

/** Disponibilidade de um poder para o personagem. `ctx`: nomes de perícias e de poderes (normalizados) para ler o requisito. */
export function powerAvailability(entry, facts, ctx) {
	const norm = normalizeText(entry.name);
	if (facts.powerNames?.has(norm)) return { state: STATE.HAVE };
	if (entry.abilityType === "origin") return { state: STATE.OTHER, reason: "Poder de origem" };
	if ((entry.abilityType === "class" || entry.abilityType === "path") && entry.className && facts.className && entry.className !== facts.className) return { state: STATE.OTHER, reason: `Poder de ${entry.className}` };
	// poder de trilha só vale para quem tem a trilha ("Monstruoso (Conhecimento)" contém "Conhecimento")
	if (entry.abilityType === "path" && entry.pathName) {
		const trilha = normalizeText(entry.pathName);
		if (![...(facts.pathNames ?? [])].some((p) => p === trilha || p.includes(trilha))) return { state: STATE.LATER, reason: `Falta a trilha ${entry.pathName}` };
	}
	// poderes de trilha e do Sobrevivente trazem o NEX ou o estágio no nome ("NEX 40% - O Sorriso", "Estágio 2 - Durão")
	const fromName = [];
	let m;
	if ((m = /^NEX (\d+)% - /.exec(entry.name))) fromName.push({ type: "nex", min: Number(m[1]), text: `NEX ${m[1]}%` });
	if ((m = /^Estágio (\d+) - /.exec(entry.name))) fromName.push({ type: "stage", min: Number(m[1]), text: `Estágio ${m[1]}` });
	for (const c of fromName) {
		const r = checkClause(c, facts);
		if (r.ok === false) return { state: STATE.LATER, reason: r.reason };
	}
	const pre = checkPrerequisite(entry.prerequisite, facts, ctx);
	if (pre.ok === false) return { state: STATE.LATER, reason: pre.reason };
	if (pre.ok === null) return { state: STATE.CHECK, reason: pre.text };
	if (entry.abilityType === "paranormal") return { state: STATE.CHECK, reason: "Poder paranormal: confira com o Mestre" };
	return { state: STATE.AVAILABLE };
}

/** Disponibilidade de qualquer entrada. Condições não têm estado. */
export function availabilityFor(entry, facts, ctx) {
	if (!facts) return null;
	if (entry.kind === "ritual") return ritualAvailability(entry, facts);
	if (entry.kind === "power") return powerAvailability(entry, facts, ctx);
	return null;
}

/** O selo que a lista mostra (só exceções; item disponível fica sem selo). */
export function sealFor(av) {
	if (!av) return null;
	switch (av.state) {
		case STATE.HAVE: return { id: "have", label: "Você já tem", icon: "fa-check" };
		case STATE.LATER: case STATE.OTHER: case STATE.NO_ACCESS: return { id: "later", label: "Ainda não", icon: "fa-lock", reason: av.reason };
		case STATE.CHECK: return { id: "check", label: "Confira o requisito", icon: "fa-circle-half-stroke", reason: av.reason };
		default: return null;
	}
}

/** Entradas que o personagem vê no "Para mim". */
export function forMeOnly(entries, availabilityOf) {
	return entries.filter((e) => {
		const av = availabilityOf(e);
		return !av || FOR_ME.includes(av.state);
	});
}

/** Por que a lista "Para mim" ficou vazia (para a mensagem explicando). */
export function emptyReason(kind, facts, totalForKind) {
	if (!facts || !totalForKind) return null;
	if (kind === "ritual" && !facts.hasRitualAccess) return "noAccess";
	return "nothingNew";
}
