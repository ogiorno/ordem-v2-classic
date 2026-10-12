// Chips da busca (GR-62): só o nome exato de um elemento ou "1º–4º círculo" digitado na busca vira chip de filtro.
// O chip tem ✕; desfazer devolve a palavra como texto da busca (e ela não vira chip de novo). Funções puras.
import { tokenize } from "./grimoire-text.mjs";

const ELEMENT_WORDS = Object.freeze({ sangue: "blood", morte: "death", conhecimento: "knowledge", energia: "energy", medo: "fear" });
const ELEMENT_NAMES = Object.freeze({ blood: "Sangue", death: "Morte", knowledge: "Conhecimento", energy: "Energia", fear: "Medo" });

/**
 * Separa a busca em chips de filtro e texto restante.
 * @param {string} query  o que o jogador digitou (nunca é reescrito)
 * @param {Set<string>} [dismissed]  ids de chips que o jogador desfez (`chip.id`)
 * @returns {{text:string, chips:{id:string,key:"element"|"circle",value:string|number,label:string}[]}}
 */
export function extractQueryChips(query, dismissed = new Set()) {
	const words = tokenize(query);
	const chips = [];
	const rest = [];
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		const circle = /^([1-4])o?$/.exec(w);
		if (circle && words[i + 1] === "circulo" && !dismissed.has(`${circle[1]} circulo`)) {
			chips.push({ id: `${circle[1]} circulo`, key: "circle", value: Number(circle[1]), label: `${circle[1]}º círculo` });
			i++;
		} else if (ELEMENT_WORDS[w] && !dismissed.has(w) && !chips.some((c) => c.key === "element" && c.value === ELEMENT_WORDS[w])) {
			chips.push({ id: w, key: "element", value: ELEMENT_WORDS[w], label: ELEMENT_NAMES[ELEMENT_WORDS[w]] });
		} else rest.push(w);
	}
	return { text: rest.join(" "), chips };
}

/** Soma os valores dos chips aos filtros ligados (sem mudar os filtros originais). */
export function mergeChipFilters(filters, chips) {
	const out = { ...filters };
	for (const c of chips) if (!(out[c.key] ?? []).includes(c.value)) out[c.key] = [...(out[c.key] ?? []), c.value];
	return out;
}
