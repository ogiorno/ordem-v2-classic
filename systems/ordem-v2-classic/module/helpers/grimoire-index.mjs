// Índice do Grimório: transforma rituais, poderes e condições em entradas leves e iguais entre si (busca + filtros).
// Funções puras: recebem objetos simples (dados do documento) e não dependem do Foundry. O carregamento dos compêndios
// fica em grimoire-loader.mjs. Spec: docs/arquivo/spec-grimorio-do-jogador.md, seção 9.
import { searchFields } from "./grimoire-text.mjs";
import { ritualFunctions } from "./grimoire-functions.mjs";
import { conditionCategory } from "./grimoire-conditions.mjs";
import { ritualTargets } from "../macros/ritual-targeting.mjs";
import { ritualBaseCost } from "../macros/ritual-caster-logic.mjs";

export const KINDS = Object.freeze(["ritual", "power", "condition", "skill", "curse"]);
export const ELEMENTS = Object.freeze(["blood", "death", "knowledge", "energy", "fear"]);
export const ELEMENT_LABELS = Object.freeze({ blood: "Sangue", death: "Morte", knowledge: "Conhecimento", energy: "Energia", fear: "Medo" });
export const ABILITY_TYPE_LABELS = Object.freeze({ class: "Classe", path: "Trilha", general: "Geral", origin: "Origem", paranormal: "Paranormal", other: "Outros" });
export const CURSE_APPLIES_LABELS = Object.freeze({ weapon: "Arma", protection: "Proteção", accessory: "Acessório" });
export const CURSE_MODE_LABELS = Object.freeze({ auto: "Automática", semi: "Semi-automática", manual: "Manual" });
export const SOURCE_LABELS = Object.freeze({ livro: "Livro de Regras", sah: "Sobrevivendo ao Horror", mesa: "Mesa" });

/** Pacote de poderes → classe (para o filtro de classe). */
export const POWER_PACK_CLASS = Object.freeze({
	fighterPowers: "Combatente",
	specialistPowers: "Especialista",
	occultistPowers: "Ocultista",
	survivalPowers: "Sobrevivente",
	pathFighter: "Combatente",
	pathSpecialist: "Especialista",
	pathOccultist: "Ocultista",
});

/** Texto puro (sem HTML) de uma descrição. */
export function plainText(html) {
	return String(html ?? "")
		.replace(/@DisplayDice\[qtd:(\d+)\|sign:(minus|plus)\|dc:(d\d+)\]/g, (_, n, sign, die) => `${sign === "minus" ? "−" : "+"}${n}${die}`)
		.replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1")
		.replace(/@\w+\[[^\]]*\](?:\{([^}]*)\})?/g, "$1")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&amp;/gi, "&")
		.replace(/\s+/g, " ")
		.trim();
}

/** Valor de um campo do cabeçalho do chat ("Execução", "Alcance", "Alvo", "Duração", "Resistência", "Fonte"). */
export function chatHeaderField(chat, label) {
	const m = new RegExp(`<strong>${label}:</strong>\\s*(.*?)\\s*(?:·|</p>)`).exec(String(chat ?? ""));
	return m ? plainText(m[1]) : null;
}

/** Fonte do item: o cabeçalho do chat diz "Livro de Regras v1.3" ou "Sobrevivendo ao Horror v1.3". */
export function sourceFromText(text) {
	return /sobrevivendo/i.test(String(text ?? "")) ? "sah" : "livro";
}

/** Entrada de um ritual. `doc`: `{ uuid, name, img, system, flags? }`. */
export function ritualEntry(doc, { source } = {}) {
	const s = doc.system ?? {};
	const description = plainText(s.description);
	const targets = ritualTargets({ system: s });
	const header = (label) => chatHeaderField(s.chatDescription, label);
	return {
		kind: "ritual",
		uuid: doc.uuid,
		name: doc.name,
		img: doc.img ?? null,
		hidden: Boolean(doc.flags?.["ordem-v2-classic"]?.grimoire?.hidden),
		source: source ?? sourceFromText(header("Fonte")),
		...searchFields(doc.name, description),
		element: s.element || null,
		circle: Number(s.circle) || null,
		execution: s.execution || "",
		range: s.range || "",
		duration: s.duration || "",
		skillResis: s.skillResis || "",
		resistance: s.resistance || "",
		studentForm: Boolean(s.studentForm),
		trueForm: Boolean(s.trueForm),
		targetKind: targets.kind,
		target: s.target ?? "",
		areaName: s.area?.name ?? "",
		functions: ritualFunctions(doc.name),
		cost: ritualBaseCost(s.circle),
		facts: {
			execution: header("Execução"),
			range: header("Alcance"),
			target: header("Alvo"),
			duration: header("Duração"),
			resistance: header("Resistência"),
		},
		summary: description.slice(0, 160),
	};
}

/** Entrada de um poder (habilidade). `meta`: `{ pack, folderName }`. */
export function powerEntry(doc, { pack, folderName = null } = {}) {
	const s = doc.system ?? {};
	const type = ["class", "path", "general", "origin", "paranormal"].includes(s.abilityType) ? s.abilityType : "other";
	const description = plainText(s.description);
	const folderIsSource = folderName === "Livro de Regras" || folderName === "Sobrevivendo ao Horror";
	let source = "livro";
	// A marca gravada no item vale mais que a pasta; a pasta e o pacote ficam de reserva para itens sem marca.
	if (doc.flags?.["ordem-v2-classic"]?.source === "sah" || folderName === "Sobrevivendo ao Horror" || pack === "survivalPowers") source = "sah";
	const element = type === "paranormal" ? ({ Conhecimento: "knowledge", Energia: "energy", Morte: "death", Sangue: "blood" }[String(folderName ?? "").replace("Poderes de ", "")] ?? null) : null;
	return {
		kind: "power",
		uuid: doc.uuid,
		name: doc.name,
		img: doc.img ?? null,
		hidden: Boolean(doc.flags?.["ordem-v2-classic"]?.grimoire?.hidden),
		source,
		...searchFields(doc.name, `${description} ${s.preRequisite ?? ""}`),
		abilityType: type,
		className: POWER_PACK_CLASS[pack] ?? null,
		pathName: type === "path" ? folderName : (!folderIsSource && pack === "survivalPowers" ? folderName : null),
		element,
		cost: Number.isFinite(Number(s.cost)) ? Number(s.cost) : 0,
		costType: s.costType || "PE",
		activation: s.activation || "",
		prerequisite: plainText(s.preRequisite),
		summary: description.slice(0, 160),
	};
}

/** Entrada de uma condição (página do diário "Condições"). `page`: `{ uuid, name, text:{content}, img? }`. */
export function conditionEntry(page, { img = null } = {}) {
	const content = page.text?.content ?? "";
	const description = plainText(content);
	return {
		kind: "condition",
		uuid: page.uuid,
		name: page.name,
		img,
		hidden: false,
		source: "livro",
		...searchFields(page.name, description),
		category: conditionCategory(page.name),
		summary: description.slice(0, 160),
	};
}

/** Páginas do diário "Perícias" que não são uma perícia (introdução, título de seção e tabela-resumo). */
export const NON_SKILL_PAGES = Object.freeze(["Sobre Perícias", "Descrição das Perícias", "Tabela de Perícias"]);

/** Entrada de uma perícia (página do diário "Perícias"). `page`: `{ uuid, name, text:{content} }`. */
export function skillEntry(page) {
	const description = plainText(page.text?.content ?? "");
	return {
		kind: "skill",
		uuid: page.uuid,
		name: page.name,
		img: null,
		hidden: false,
		source: "livro",
		...searchFields(page.name, description),
		summary: description.slice(0, 160),
	};
}

/** Entrada de uma maldição de item (compêndio "Maldições Paranormais", item `curse`). */
export function curseEntry(doc) {
	const s = doc.system ?? {};
	const description = plainText(s.description);
	return {
		kind: "curse",
		uuid: doc.uuid,
		name: doc.name,
		img: doc.img ?? null,
		hidden: Boolean(doc.flags?.["ordem-v2-classic"]?.grimoire?.hidden),
		source: s.curseKey === "lenteDeRevelacao" ? "sah" : "livro",
		...searchFields(doc.name, description),
		curseKey: s.curseKey || "",
		element: s.element || null,
		curseKind: s.applies || "weapon",
		mode: s.mode || "auto",
		summary: description.slice(0, 160),
	};
}

/** Remove o que o jogador não pode ver (a não ser que seja o Mestre). */
export function visibleEntries(entries, { isGM = false } = {}) {
	return isGM ? entries : entries.filter((e) => !e.hidden);
}

/** Valores distintos de um campo, para montar os chips de filtro. */
export function distinctValues(entries, key) {
	const set = new Set();
	for (const e of entries) {
		const v = e[key];
		if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
		else if (v !== undefined && v !== null && v !== "") set.add(v);
	}
	return [...set];
}
