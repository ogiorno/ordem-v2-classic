/**
 * O que uma origem concede (regras puras, sem Foundry — testável em Node): perícias treinadas, poder e buffs de ficha.
 * Alimenta a seção "O que esta origem concede" da ficha do item e a conferência de troca de origem.
 * Spec: docs/spec-origens-ui.md.
 */
import { originPlan, resolveTraining, skillSlot } from "./skill-training-rules.mjs";
import { MANUAL_PASSIVES, MANUAL_REASONS, SKILL_NAMES, passiveKey, passiveRuleFor } from "./passive-effects-rules.mjs";
import { findOriginPower, stripHtml } from "./level-progression-rules.mjs";

const PROFESSION_LABEL = (name) => (name ? `Profissão (${name})` : "Profissão (você escolhe qual)");
const skillLabel = (key) => SKILL_NAMES[key] ?? key;
/** Alvo do link para o Grimório (a ficha monta o `<a class="op-gr-link">` com `grimoireLinkHtml`). */
const link = (kind, name) => ({ kind, name });

/** Resumo curto de um poder: primeira frase do texto da descrição. */
export function powerSummary(html, max = 160) {
	const text = stripHtml(html).replace(/\s+/g, " ").trim();
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40))}…`;
}

/**
 * Leitura da origem para a ficha do item.
 * @param {{name: string, description?: string}} origin
 * @param {{name: string, description?: string}[]} powers poderes do compêndio `originPowers`
 * @returns {{
 *   status: "ready"|"none",
 *   skills: {key: string, label: string}[],
 *   professions: {name: string|null, label: string}[],
 *   choose: number, chooseOptions: {key: string, label: string}[],
 *   power: null|{name: string, summary: string, buffs: string[], manual: string|null},
 *   lines: string[],
 *   rows: {key: string, icon: string, title: string, items: {text: string, link?: object, choice?: boolean}[], note?: string}[],
 * }}
 */
export function originGrantsView(origin, powers = []) {
	const plan = originPlan(origin?.name);
	const found = findOriginPower(origin?.name, origin?.description, powers.map((p) => p.name));
	const power = found ? powers.find((p) => p.name === found) : null;
	let powerView = null;
	if (power) {
		const rule = passiveRuleFor(power.name);
		const reason = MANUAL_PASSIVES[passiveKey(power.name)];
		powerView = {
			name: power.name,
			summary: powerSummary(power.description),
			link: link("power", power.name),
			buffs: (rule?.changes ?? []).map((c) => c.label),
			manual: reason ? MANUAL_REASONS[reason] : null,
		};
	}
	const view = {
		status: plan ? "ready" : "none",
		skills: (plan?.fixed ?? []).map((key) => ({ key, label: skillLabel(key), link: link("skill", skillLabel(key)) })),
		professions: (plan?.professions ?? []).map((name) => ({ name, label: PROFESSION_LABEL(name) })),
		choose: plan?.choose ?? 0,
		chooseOptions: (plan?.chooseOptions ?? []).map((key) => ({ key, label: skillLabel(key) })),
		power: powerView,
		lines: [],
	};
	view.lines = describe(view);
	view.rows = rowsOf(view);
	return view;
}

/** Linhas da seção como a ficha desenha: ícone, título, itens (com link para o Grimório quando há) e uma nota. */
function rowsOf(view) {
	const rows = [];
	const items = [
		...view.skills.map((s) => ({ text: s.label, link: s.link })),
		...view.professions.map((p) => ({ text: p.label })),
	];
	if (view.choose) {
		const from = view.chooseOptions.length ? ` entre ${view.chooseOptions.map((o) => o.label).join(", ")}` : "";
		items.push({ text: `${view.choose} à sua escolha${from}`, choice: true });
	}
	if (items.length) rows.push({ key: "skills", icon: "fa-graduation-cap", title: "Perícias treinadas", items });
	if (view.power) {
		rows.push({ key: "power", icon: "fa-star", title: "Habilidade", items: [{ text: view.power.name, link: view.power.link }], note: view.power.summary });
		if (view.power.buffs.length) rows.push({ key: "buff", icon: "fa-bolt", title: "Buff automático", items: view.power.buffs.map((text) => ({ text })) });
		else if (view.power.manual) rows.push({ key: "manual", icon: "fa-hand", title: "Sem buff automático", items: [], note: view.power.manual });
	} else if (items.length) rows.push({ key: "nopower", icon: "fa-star", title: "Habilidade", items: [], note: "Esta origem não concede habilidade própria." });
	return rows;
}

/** Linhas de texto da seção (a ficha mostra cada uma como item; o teste confere o texto). */
function describe(view) {
	const lines = [];
	const names = [...view.skills.map((s) => s.label), ...view.professions.map((p) => p.label)];
	if (names.length) lines.push(`Perícias treinadas: ${names.join(" e ")}.`);
	if (view.choose) {
		const from = view.chooseOptions.length ? ` entre ${view.chooseOptions.map((o) => o.label).join(", ")}` : "";
		lines.push(`Você escolhe ${view.choose} perícia${view.choose > 1 ? "s" : ""}${from} ao pôr a origem na ficha.`);
	}
	if (view.power) {
		lines.push(`Habilidade: ${view.power.name}.`);
		for (const buff of view.power.buffs) lines.push(`Buff automático: ${buff}.`);
		if (view.power.manual) lines.push(`Sem buff automático: ${view.power.manual}`);
	} else if (view.status !== "none") lines.push("Esta origem não concede habilidade própria.");
	return lines;
}

/**
 * O que sai da ficha quando a origem sai (apagada ou trocada): poderes concedidos por ela e entradas do livro-caixa.
 * @param {string} originId
 * @param {{id: string, granted?: {source?: string}|null}[]} items itens da ficha com a marca `granted`
 * @param {{id: string, sourceItem?: string|null}[]} entries entradas de treinamento
 */
export function originRemovalPlan(originId, items = [], entries = []) {
	return {
		itemIds: items.filter((i) => i.granted?.source === originId).map((i) => i.id),
		entryIds: entries.filter((e) => e.sourceItem === originId).map((e) => e.id),
	};
}

const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const labelOf = (key) => (String(key).startsWith("profession:") ? `Profissão (${String(key).slice(11)})` : skillLabel(key));

/**
 * O que a ficha perde ao tirar a origem: nomes dos poderes que ela concedeu e das perícias que só ela treinava
 * (perícia que outra fonte também treina continua treinada e não entra na lista).
 */
export function originLoss(originId, items = [], entries = []) {
	const plan = originRemovalPlan(originId, items, entries);
	const gone = new Set(plan.entryIds);
	const kept = entries.filter((e) => !gone.has(e.id));
	const after = resolveTraining({ entries: kept }).degrees;
	const skills = [];
	for (const e of entries) {
		if (!gone.has(e.id) || !e.skill || e.kind === "plus" || e.kind === "hold" || e.kind === "raise") continue;
		if ((after[skillSlot(e.skill)] ?? 0) < 1 && !skills.includes(e.skill)) skills.push(e.skill);
	}
	return {
		powers: plan.itemIds.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean),
		skills: skills.map(labelOf),
	};
}

/** Texto da confirmação de troca: o que sai e o que entra (HTML seguro). */
export function originSwapHtml({ existing, replacement, loss, gain }) {
	const list = (items) => items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
	const lose = [...loss.skills.map((s) => `Perícia treinada: ${s}`), ...loss.powers.map((p) => `Habilidade: ${p}`)];
	const get = [];
	if (gain.skills.length || gain.professions.length) get.push(`Perícias: ${[...gain.skills, ...gain.professions].map((s) => s.label).join(", ")}`);
	if (gain.choose) get.push(`${gain.choose} perícia${gain.choose > 1 ? "s" : ""} à sua escolha`);
	if (gain.power) get.push(`Habilidade: ${gain.power.name}`);
	return `<p>Trocar <strong>${escapeHtml(existing)}</strong> por <strong>${escapeHtml(replacement)}</strong>?</p>`
		+ `<p><strong>Você perde</strong></p>${lose.length ? `<ul class="op-swap-lose">${list(lose)}</ul>` : "<p><em>Nada (a origem antiga não deu perícias nem habilidades).</em></p>"}`
		+ `${get.length ? `<p><strong>Você ganha</strong></p><ul class="op-swap-gain">${list(get)}</ul>` : ""}`
		+ "<p><small>Perícias que a classe, um poder ou você mesmo também treinam continuam treinadas.</small></p>";
}
