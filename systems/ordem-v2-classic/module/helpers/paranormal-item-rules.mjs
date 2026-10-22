/**
 * Itens paranormais: tabela de itens (Tabela 3.10 do livro e catalisadores do Sobrevivendo ao Horror) e regras
 * dos catalisadores ritualísticos. Puro (sem Foundry); a ficha e o conjurador chamam estas funções.
 * Especificação em docs/spec-itens-paranormais.md.
 */

export const PARANORMAL_ELEMENTS = Object.freeze({
	knowledge: "Conhecimento", energy: "Energia", death: "Morte", blood: "Sangue",
});

const ELEMENT_BY_WORD = Object.freeze({ conhecimento: "knowledge", energia: "energy", morte: "death", sangue: "blood" });

const plain = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const elementOf = (word) => ELEMENT_BY_WORD[plain(word)] ?? null;
export const elementName = (element) => PARANORMAL_ELEMENTS[element] ?? "";

/** Passos de alcance, do menor ao maior; "pessoal" e "toque" sobem para "curto". */
export const RANGE_STEPS = Object.freeze(["short", "medium", "long", "extreme"]);

export const CATALYSTS = Object.freeze({
	amplifier: { label: "Ampliador", effect: "Alcance +1 passo (ou área ×2)" },
	disturber: { label: "Perturbador", effect: "DT para resistir +2" },
	empowerer: { label: "Potencializador", effect: "+1 dado de dano do mesmo tipo" },
	prolonger: { label: "Prolongador", effect: "Duração ×2" },
});

const CATALYST_BY_WORD = Object.freeze({ ampliador: "amplifier", perturbador: "disturber", pertubador: "disturber", potencializador: "empowerer", prolongador: "prolonger" });

const use = (id, label, action, cost, extra = {}) => ({ id, label, action, cost: cost ? { type: "PE", value: cost } : null, ...extra });

/** Linha do item: sempre as mesmas chaves, para a ficha não precisar conferir cada uma. */
const entry = (kind, element, extra = {}) => ({
	kind, element, catalyst: null, consumable: false, uses: [], automation: "manual", reason: "", ...extra,
});

function amarras(element) {
	return entry("tool", element, {
		automation: "semi",
		reason: "Condição imóvel/paralisado é aplicada à mão no alvo; o cartão traz a DT e o teste.",
		uses: [
			use("trap", "Armadilha", "complete", 2, {
				consumesItem: true, area: "3×3 m", save: { skill: "reflexes", dtAttribute: "INT" }, condition: "immobile",
				note: "Quem passar pela área faz Reflexos ou fica imóvel até o fim da cena; a área vira terreno difícil mesmo se passar.",
			}),
			use("lasso", "Laçar", "standard", 1, {
				range: "short", save: { skill: "will", dtAttribute: "AGI" }, condition: "paralyzed", upkeep: { type: "PE", value: 1, per: "round" },
				note: "Vontade ou paralisado até o início do próximo turno do alvo, que repete o teste; manter custa 1 PE por rodada.",
			}),
		],
	});
}

/**
 * Tabela de itens paranormais pelo nome (sem acento, sem diferenciar maiúsculas).
 * @returns {null | {kind:"tool"|"component"|"catalyst", element:string|null, catalyst:string|null, consumable:boolean, uses:object[], automation:"auto"|"semi"|"manual", reason:string}}
 */
export function paranormalItemInfo(name) {
	const text = plain(name);
	let m = /^amarras de (\p{L}+)$/u.exec(text);
	if (m && elementOf(m[1])) return amarras(elementOf(m[1]));
	m = /^componentes? (?:ritualisticos? )?de (\p{L}+)$/u.exec(text);
	if (m && elementOf(m[1])) return entry("component", elementOf(m[1]), { automation: "auto", reason: "O conjurador reconhece o componente do elemento (afinidade dispensa)." });
	m = /^(ampliador|perturbador|pertubador|potencializador|prolongador) de (\p{L}+)$/u.exec(text);
	if (m && elementOf(m[2])) {
		return entry("catalyst", elementOf(m[2]), { catalyst: CATALYST_BY_WORD[m[1]], consumable: true, automation: "auto", reason: "Escolhido na janela de conjurar; consumido ao conjurar." });
	}
	if (text === "camera de aura paranormal") {
		return entry("tool", null, { automation: "semi", reason: "Cartão informativo; as auras são narradas pelo Mestre.", uses: [use("photo", "Tirar foto", "standard", 1, { note: "Revela as auras de pessoas e objetos na foto, na cor do elemento." })] });
	}
	if (text === "emissor de pulsos paranormais") {
		return entry("tool", null, { automation: "semi", reason: "O cartão traz o teste de Vontade; atrair ou afastar criaturas é narrativo.", uses: [use("pulse", "Emitir pulso", "complete", 1, { save: { skill: "will", dtAttribute: "PRE" }, chooseElement: true, note: "Atrai criaturas do elemento escolhido e afasta as do elemento oposto; Vontade evita." })] });
	}
	if (text === "escuta de ruidos paranormais") {
		return entry("tool", null, { automation: "semi", reason: "Cartão informativo; o +5 em Ocultismo é marcado na janela do teste.", uses: [use("record", "Gravar", "complete", 2, { note: "Grava até 24 horas; ouvir a gravação dá +5 em Ocultismo para identificar a criatura.", bonus: { skill: "occultism", value: 5, label: "Escuta de Ruídos Paranormais" } })] });
	}
	if (text === "medidor de estabilidade da membrana") {
		return entry("tool", null, { automation: "manual", reason: "Indicativo sem resposta definitiva: o Mestre responde.", uses: [use("measure", "Medir a Membrana", "standard", 0, { note: "Agente treinado em Ocultismo avalia a Membrana de uma área; o resultado é indicativo, nunca definitivo." })] });
	}
	m = /^scanner de manifestacao paranormal de (?:\(elemento\)|(\p{L}+))$/u.exec(text);
	if (m) {
		const element = m[1] ? elementOf(m[1]) : null;
		if (!m[1] || element) {
			return entry("tool", element, { automation: "semi", reason: "Custo por rodada cobrado por turno; a direção é narrativa (sem ping no mapa).", uses: [use("scan", "Ativar", "standard", 1, { perRound: true, range: "long", chooseElement: !element, note: "Enquanto ativo, o usuário sabe a direção de todas as manifestações ativas do elemento em alcance longo (inclui criaturas com o elemento como complemento)." })] });
		}
	}
	return null;
}

export const isParanormalItem = (item) => item?.type === "generalEquipment" && Boolean(paranormalItemInfo(item.name));

/** PE do livro é cobrado como PD no mundo "Jogando sem Sanidade"; o valor é o mesmo. */
export const useCostPd = (usage) => usage?.cost?.value ?? 0;

/** Quanto sobra depois do uso (ou null se faltar). */
export function useBalanceAfter(usage, pd) {
	const cost = useCostPd(usage);
	const balance = Number(pd);
	return Number.isFinite(balance) && balance >= cost ? balance - cost : null;
}

/** DT de um teste do item: 10 + atributo. */
export const itemUseDt = (usage, attributes = {}) => {
	const attribute = usage?.save?.dtAttribute;
	return attribute ? 10 + (Number(attributes[attribute]) || 0) : null;
};

/* -------------------------------------------- */
/*  Catalisadores                               */
/* -------------------------------------------- */

/** Catalisador de um item (null se não for catalisador). */
export function catalystOf(item) {
	const info = paranormalItemInfo(item?.name);
	return info?.kind === "catalyst" ? { id: item.id, kind: info.catalyst, element: info.element, name: item.name } : null;
}

/** Catalisadores utilizáveis num ritual do elemento: do mesmo elemento, empunhados, com unidade sobrando. */
export function usableCatalysts(items, ritualElement) {
	return [...items].filter((item) => {
		const found = catalystOf(item);
		return found && found.element === ritualElement && item.system?.using?.state !== false && (Number(item.system?.quantity) || 0) > 0;
	}).map(catalystOf);
}

/** Um catalisador por ritual; improvisado não vale; precisa do elemento do ritual e de unidade sobrando. */
export function catalystCheck({ catalyst, ritualElement, equipped = true, quantity = 1, improvised = false, picked = 1 } = {}) {
	if (!catalyst) return { ok: false, reason: "Sem catalisador." };
	if (picked > 1) return { ok: false, reason: "Só um catalisador por ritual." };
	if (improvised) return { ok: false, reason: "Catalisadores não podem ser improvisados." };
	if (catalyst.element !== ritualElement) return { ok: false, reason: `O catalisador é de ${elementName(catalyst.element)}; o ritual é de ${elementName(ritualElement) || "outro elemento"}.` };
	if (!equipped) return { ok: false, reason: "Empunhe o catalisador para usá-lo." };
	if (!(Number(quantity) > 0)) return { ok: false, reason: "O catalisador acabou." };
	return { ok: true, reason: "" };
}

/** Alcance +1 passo: pessoal e toque sobem para curto; extremo e ilimitado ficam como estão. */
export function nextRange(key) {
	if (key === "personal" || key === "touch") return "short";
	const index = RANGE_STEPS.indexOf(key);
	if (index < 0) return key;
	return RANGE_STEPS[Math.min(index + 1, RANGE_STEPS.length - 1)];
}

/** "2d6+3" → "3d6+3": mais um dado do mesmo tipo no primeiro termo de dados. */
export function addOneDie(formula) {
	let done = false;
	const result = String(formula ?? "").replace(/(\d*)d(\d+)/i, (_all, count, faces) => { done = true; return `${(Number(count) || 1) + 1}d${faces}`; });
	return done ? result : formula;
}

/** Dano do ritual: +1 dado no primeiro componente que causa dano (cura não é dano). */
export function empowerDamageParts(parts) {
	let done = false;
	return (parts ?? []).map((part) => {
		if (done || !part?.formula || !/d\d+/i.test(part.formula)) return part;
		done = true;
		return { ...part, formula: addOneDie(part.formula) };
	});
}

/**
 * Efeitos do catalisador num ritual.
 * @param {string} kind  amplifier | disturber | empowerer | prolonger
 * @param {{duration?:string, range?:string, hasDamage?:boolean, hasArea?:boolean, ampliador?:"range"|"area"}} ritual
 * @returns {{applies:boolean, note:string, dtBonus?:number, rangeKey?:string, areaFactor?:number, extraDie?:boolean, durationFactor?:number}}
 */
export function catalystEffect(kind, ritual = {}) {
	switch (kind) {
		case "disturber":
			return { applies: true, dtBonus: 2, note: "DT +2" };
		case "empowerer":
			return ritual.hasDamage ? { applies: true, extraDie: true, note: "+1 dado de dano" } : { applies: false, note: "O ritual não causa dano." };
		case "amplifier": {
			if (ritual.ampliador === "area") return ritual.hasArea ? { applies: true, areaFactor: 2, note: "Área ×2" } : { applies: false, note: "O ritual não tem área." };
			const key = ritual.range ?? "short";
			const next = nextRange(key);
			return next !== key && key !== "unlimited" ? { applies: true, rangeKey: next, note: `Alcance ${key} → ${next}` } : { applies: false, note: "O alcance já é o máximo." };
		}
		case "prolonger":
			if (ritual.duration === "instantaneous") return { applies: false, note: "Ritual instantâneo." };
			if (ritual.duration === "sustained") return { applies: false, note: "Ritual sustentado." };
			return { applies: true, durationFactor: 2, note: "Duração ×2" };
		default:
			return { applies: false, note: "Catalisador desconhecido." };
	}
}

export const catalystLabel = (catalyst) => (catalyst ? `${CATALYSTS[catalyst.kind]?.label ?? ""} de ${elementName(catalyst.element)}`.trim() : "");
