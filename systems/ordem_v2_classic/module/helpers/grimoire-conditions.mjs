// Condições do Grimório: categorias (tabela nossa, ajustável pela mesa; o livro não categoriza) e ligação com os status do sistema.
// Spec 5.3 e decisão 3 (§10). As 37 condições do livro estão em bookrules → "Condições".
import { normalizeText } from "./grimoire-text.mjs";

export const CONDITION_CATEGORIES = Object.freeze({
	mental: "Mental / Medo",
	movement: "Movimento",
	damage: "Dano contínuo",
	perception: "Percepção",
	exhaustion: "Esgotamento",
	incapacity: "Incapacidade",
});

const TABLE = {
	mental: ["Abalado", "Alquebrado", "Apavorado", "Confuso", "Enlouquecendo", "Esmorecido", "Fascinado", "Frustrado", "Pasmo", "Perturbado"],
	movement: ["Agarrado", "Caído", "Enredado", "Imóvel", "Lento", "Paralisado", "Petrificado"],
	damage: ["Asfixiado", "Doente", "Em Chamas", "Envenenado", "Morrendo", "Sangrando"],
	perception: ["Cego", "Desprevenido", "Ofuscado", "Surdo"],
	exhaustion: ["Debilitado", "Enjoado", "Exausto", "Fatigado", "Fraco", "Machucado"],
	incapacity: ["Atordoado", "Inconsciente", "Indefeso", "Vulnerável"],
};

const BY_NAME = new Map();
for (const [category, names] of Object.entries(TABLE)) for (const name of names) BY_NAME.set(normalizeText(name), category);

/** Categoria da condição pelo nome; `null` se a mesa criou uma condição que não está na tabela. */
export function conditionCategory(name) {
	return BY_NAME.get(normalizeText(name)) ?? null;
}

export const KNOWN_CONDITIONS = Object.freeze(Object.values(TABLE).flat());

/** Status do sistema (CONFIG.statusEffects) → nome da condição do livro. */
export const STATUS_TO_CONDITION = Object.freeze({
	stun: "Atordoado",
	restrain: "Agarrado",
	deaf: "Surdo",
	bleeding: "Sangrando",
	unconscious: "Inconsciente",
	burning: "Em Chamas",
	blind: "Cego",
	prone: "Caído",
	paralysis: "Paralisado",
	poison: "Envenenado",
	frightened: "Apavorado",
	dying: "Morrendo",
});

/**
 * Nomes das condições do livro que estão ativas num ator, a partir dos efeitos.
 * Cada efeito: `{ name, statuses: Iterable<string>, disabled? }`. Conta pelo status oficial ou pelo nome do efeito
 * (os rituais criam efeitos com o nome da condição, ex.: "Enjoado").
 * @returns {string[]} sem repetição, na ordem em que aparecem
 */
export function activeConditionNames(effects = []) {
	const out = [];
	const add = (name) => { if (name && !out.includes(name)) out.push(name); };
	const known = new Map(KNOWN_CONDITIONS.map((n) => [normalizeText(n), n]));
	for (const effect of effects) {
		if (!effect || effect.disabled) continue;
		for (const status of effect.statuses ?? []) add(STATUS_TO_CONDITION[status]);
		const base = String(effect.name ?? "").replace(/\(.*?\)/g, "").trim();
		add(known.get(normalizeText(base)));
	}
	return out;
}
