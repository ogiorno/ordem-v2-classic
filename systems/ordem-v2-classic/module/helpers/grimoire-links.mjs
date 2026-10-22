// Costura do Grimório com o resto da mesa (Fase 3): links clicáveis (@Condicao, @Ritual), cartão "recebe a condição" no chat
// e "Veja também". Funções puras (sem Foundry). Spec: docs/arquivo/spec-grimorio-do-jogador.md, GR-40, 41, 43 e 44.
import { normalizeText } from "./grimoire-text.mjs";
import { CONDITIONS, CONDITION_RULES } from "./conditions.mjs";
import { KNOWN_CONDITIONS, activeConditionNames } from "./grimoire-conditions.mjs";

/** Tipo do link → aba do Grimório. */
export const LINK_TABS = Object.freeze({ condition: "condition", ritual: "ritual", power: "power", skill: "skill" });

const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Link que abre o Grimório no item. Só clicável com o ouvinte de `.op-gr-link` (grimoire.mjs). */
export function grimoireLinkHtml({ kind, name, label = null }) {
	const tab = LINK_TABS[kind] ?? "condition";
	return `<a class="op-gr-link" data-grimoire-tab="${tab}" data-grimoire-name="${escapeHtml(name)}" role="button" tabindex="0"><i class="fa-solid fa-book-skull" aria-hidden="true"></i> ${escapeHtml(label ?? name)}</a>`;
}

/** Regra de uma linha da condição que tem mecânica no sistema, ou `""` (condições só do livro não têm). */
export function conditionRuleLine(name) {
	const key = normalizeText(name);
	const id = Object.keys(CONDITIONS).find((k) => normalizeText(CONDITIONS[k].name) === key);
	return id ? CONDITION_RULES[id] ?? "" : "";
}

/** Conteúdo do cartão de sistema "Fulano recebe a condição X" (GR-43). */
export function conditionNoticeContent(actorName, conditionName) {
	const rule = conditionRuleLine(conditionName);
	const link = grimoireLinkHtml({ kind: "condition", name: conditionName });
	return `<div class="op-gr-notice"><p><strong>${escapeHtml(actorName)}</strong> recebe a condição ${link}</p>${rule ? `<p class="op-gr-notice-rule">${escapeHtml(rule)}</p>` : ""}</div>`;
}

/** Nomes de condição do livro que um efeito recém-criado representa (status oficial ou nome do efeito). */
export function noticeConditionNames(effect) {
	return activeConditionNames([{ name: effect?.name, statuses: effect?.statuses ?? [], disabled: effect?.disabled }]);
}

/**
 * Casamento do enricher: `@Condicao[Abalado]` e `@Ritual[Paradoxo]{texto}` (com ou sem `{texto}`).
 * @returns {{kind:string,name:string,label:string|null}|null}
 */
export function parseEnricher(kind, inner, label = null) {
	const name = String(inner ?? "").trim();
	if (!name) return null;
	return { kind, name, label: label ? String(label).trim() : null };
}

/** Acha na lista a entrada de um tipo pelo nome (sem acento nem maiúscula). */
export function findByName(entries, kind, name) {
	const key = normalizeText(name);
	return entries.find((e) => e.kind === kind && e.nameNorm === key) ?? null;
}

const mentions = (textNorm, nameNorm) => Boolean(nameNorm) && ` ${textNorm} `.includes(` ${nameNorm} `);

/**
 * "Veja também" (GR-41): condições que o texto do item cita e, para uma condição, os poderes e rituais que a citam
 * (índice reverso). Pelo nome inteiro, sem acento. Não inclui o próprio item.
 * @param {object} entry  entrada do índice
 * @param {object[]} entries  índice completo (já filtrado pelo que o usuário pode ver)
 * @returns {{kind:string,name:string,uuid:string}[]}
 */
export function seeAlso(entry, entries, { limit = 8 } = {}) {
	if (!entry) return [];
	const out = [];
	const push = (e) => out.length < limit && e.uuid !== entry.uuid && !out.some((o) => o.uuid === e.uuid) && out.push({ kind: e.kind, name: e.name, uuid: e.uuid });
	for (const c of entries) if (c.kind === "condition" && mentions(entry.textNorm, c.nameNorm)) push(c);
	if (entry.kind === "condition") {
		for (const e of entries) if (e.kind !== "condition" && mentions(e.textNorm, entry.nameNorm)) push(e);
	}
	return out;
}

const LETTER = "\\p{L}\\p{N}";
const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Nome da condição solto no texto; "vulnerável a sangue" é vulnerabilidade a dano, não a condição. */
const MENTION = new RegExp(`(?<![${LETTER}])(${[...KNOWN_CONDITIONS].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|")})(?![${LETTER}])(?!\\s+(?:a|ao|aos|à|às)\\s)`, "giu");

/**
 * Quebra um texto em trechos: `{ text }` comum e `{ text, condition }` para cada menção a uma condição do livro.
 * `condition` é o nome canônico do Grimório (o texto mantém a grafia original).
 */
export function splitConditionMentions(text) {
	const source = String(text ?? "");
	const canon = new Map(KNOWN_CONDITIONS.map((n) => [normalizeText(n), n]));
	const out = [];
	let last = 0;
	for (const m of source.matchAll(MENTION)) {
		if (m.index > last) out.push({ text: source.slice(last, m.index) });
		out.push({ text: m[0], condition: canon.get(normalizeText(m[0])) });
		last = m.index + m[0].length;
	}
	if (last < source.length) out.push({ text: source.slice(last) });
	return out;
}
