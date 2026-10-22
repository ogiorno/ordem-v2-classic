/**
 * Maldições de itens (armas, proteções e acessórios) — regras puras, sem Foundry (testável em Node).
 * Especificação: docs/spec-modificacoes-paranormais.md. Fonte: Livro de Regras v1.3, livro p. 144–147.
 *
 * Cada maldição se divide em até quatro partes, todas montadas aqui e aplicadas por curses.mjs:
 *  - `changes`: bônus de ficha (Efeito Ativo `transfer` no item, ligado enquanto o item está equipado);
 *  - `attack`: opção da tela de ataque (Efeito Ativo "ao usar" na arma);
 *  - `damage`: dano extra em carta própria (dado do elemento, separado do dano da arma);
 *  - `use`: botão de uso na ficha do item (gasta PE/PD, rola, posta o texto do livro).
 * `mode` diz o quanto é automático: auto (só funciona), semi (o sistema monta, a mesa confirma) ou manual (texto + custo).
 */

export const SYSTEM_ID = "ordem-v2-classic";
export const CURSE_FLAG = "curseRule";
export const CURSE_USE_FLAG = "curseUse";

export const ELEMENTS = Object.freeze({
	knowledge: { label: "Conhecimento", damage: "knowledgeDamage", color: "#c9a227" },
	energy: { label: "Energia", damage: "energyDamage", color: "#3b82f6" },
	death: { label: "Morte", damage: "deathDamage", color: "#6b7280" },
	blood: { label: "Sangue", damage: "bloodDamage", color: "#b91c1c" },
	fear: { label: "Medo", damage: "fearDamage", color: "#111827" },
});

/** Elementos opressores entre si (Livro, "Itens amaldiçoados"): Sangue–Conhecimento, Conhecimento–Energia, Energia–Morte, Morte–Sangue. */
export const OPPOSED = Object.freeze([["blood", "knowledge"], ["knowledge", "energy"], ["energy", "death"], ["death", "blood"]]);

export const KINDS = Object.freeze({ weapon: "Arma", protection: "Proteção", accessory: "Acessório" });

/** Item físico → tipo de maldição que ele aceita. */
export const ITEM_KIND = Object.freeze({ armament: "weapon", protection: "protection", generalEquipment: "accessory" });

/** Atributo cujo teste falhado cobra o preço da maldição, por elemento (Livro, "O preço da maldição"). */
export const PRICE_ATTRIBUTE = Object.freeze({
	knowledge: ["int"], energy: ["dex"], death: ["pre"], blood: ["str", "vit"], fear: [],
});

const ATTRIBUTE_NAMES = { str: "Força", dex: "Agilidade", vit: "Vigor", int: "Intelecto", pre: "Presença" };
export { ATTRIBUTE_NAMES };

const add = (key, value, label) => ({ key, value, label });
const skill = (k, v, label) => add(`system.skills.${k}.mod`, v, label);
const attribute = (k, v, label) => add(`system.attributes.${k}.value`, v, label);
const resist = (damage, v, label) => add(`system.resistances.${damage}.value`, v, label);

/** Cabeçalho comum: chave, nome, elemento e tipo do item; o resto vem em `rest`. */
const curse = (key, label, element, kind, mode, text, rest = {}) => [key, { key, label, element, kind, mode, text, ...rest }];

export const CURSES = Object.freeze(Object.fromEntries([
	// ---------------------------------------------------------------- Armas
	curse("antielemento", "Antielemento", "knowledge", "weapon", "auto",
		"A arma é letal contra criaturas de um elemento. Ao atacar uma criatura desse elemento, gaste 2 PE; se acertar, causa +4d8 de dano. Para sortear o elemento: 1d4 (1 Conhecimento, 2 Energia, 3 Morte, 4 Sangue).",
		{ choice: "element", attack: { label: "Antielemento", cost: 2, hint: "+4d8 contra criatura do elemento" }, damage: { formula: "4d8", typeFromChoice: true, optionRequired: true } }),
	curse("ritualistica", "Ritualística", "knowledge", "weapon", "semi",
		"Armazene na arma um ritual de alvo ou de área, pagando os PE como se o conjurasse. Ao acertar um ataque, descarregue-o como ação livre; o alvo (ou centro da área) é o ser atingido. Descarregado, outro pode ser armazenado.",
		{ choice: "ritual", use: { label: "Descarregar ritual", cost: 0, action: "free", text: "O ritual armazenado é descarregado no ser atingido. Conjure-o na ficha sem gestos nem componentes e sem pagar PE de novo." } }),
	curse("senciente", "Senciente", "knowledge", "weapon", "manual",
		"Gaste uma ação de movimento e 2 PE para a arma flutuar ao seu lado e atacar, uma vez por rodada, um ser em alcance curto (ou o da arma, o que for maior). Gaste 1 PE no início de cada turno seu para manter; senão a arma cai.",
		{ use: { label: "Ativar (2 PE)", cost: 2, action: "movement", text: "A arma flutua e ataca sozinha uma vez por rodada. Mantenha com 1 PE no início de cada turno seu." } }),
	curse("empuxo", "Empuxo", "energy", "weapon", "semi",
		"A arma pode ser arremessada em alcance curto (se já podia, o alcance sobe uma categoria) e causa mais um dado de dano do mesmo tipo assim. Após o ataque à distância, volta voando no mesmo turno; pegá-la é uma reação. Só armas corpo a corpo.",
		{ only: "melee", attack: { label: "Empuxo (arremessar)", applies: "throw", damageDice: 1, hint: "+1 dado de dano ao arremessar" } }),
	curse("energetica", "Energética", "energy", "weapon", "auto",
		"Gaste 2 PE por ataque para transformar a arma (ou a munição) em Energia pura: +5 em testes de ataque, ignora resistência a dano e converte todo o dano em Energia.",
		{ attack: { label: "Energética", cost: 2, attackBonus: 5, convertType: "energyDamage", ignoreRd: true, hint: "+5 no ataque, ignora RD, dano de Energia" } }),
	curse("vibrante", "Vibrante", "energy", "weapon", "manual",
		"Você recebe a habilidade Ataque Extra da trilha Operações Especiais do combatente. Se já a possui, o custo para usá-la diminui em –1 PE.",
		{ reason: "Ataque Extra é uma habilidade de trilha com custo próprio: o sistema mostra o aviso, a mesa concede ou reduz o custo." }),
	curse("consumidora", "Consumidora", "death", "weapon", "semi",
		"Ao atacar, gaste 2 PE. Se acertar, o alvo fica imóvel por uma rodada.",
		{ attack: { label: "Consumidora", cost: 2, hint: "alvo atingido fica imóvel por 1 rodada" }, afterHit: { condition: "paralyzed", rounds: 1, text: "O alvo atingido fica imóvel por uma rodada." } }),
	curse("erosiva", "Erosiva", "death", "weapon", "auto",
		"A arma causa +1d8 de dano de Morte. Ao atacar, gaste 2 PE: se acertar, a vítima sofre 2d4 de dano de Morte no início de seus turnos nas próximas duas rodadas.",
		{ attack: { label: "Erosiva (2d4 por 2 rodadas)", cost: 2, hint: "2d4 de Morte no início dos turnos do alvo por 2 rodadas" }, damage: { formula: "1d8", type: "deathDamage", always: true }, afterHit: { text: "A vítima sofre 2d4 de dano de Morte no início de seus turnos pelas próximas duas rodadas.", dot: { formula: "2d4", type: "deathDamage", rounds: 2 } } }),
	curse("repulsora", "Repulsora", "death", "weapon", "auto",
		"Uma aura de fumaça espiralada desacelera ataques: +2 de Defesa enquanto a arma estiver empunhada. Ao fazer um bloqueio, gaste 2 PE para +5 de Defesa adicional.",
		{ changes: [add("system.defense.value", 2, "+2 em Defesa (arma empunhada)")], use: { label: "Bloqueio reforçado (2 PE)", cost: 2, action: "reaction", text: "+5 de Defesa adicional no bloqueio." } }),
	curse("lancinante", "Lancinante", "blood", "weapon", "auto",
		"A arma causa +1d8 de dano de Sangue. Este dado é multiplicado em acertos críticos (crítico x3 → +3d8).",
		{ damage: { formula: "1d8", type: "bloodDamage", always: true, multiplyOnCrit: true } }),
	curse("predadora", "Predadora", "blood", "weapon", "auto",
		"A arma anula penalidades por camuflagem e cobertura leves; se for à distância, o alcance sobe uma categoria. A margem de ameaça da arma duplica (fuzil de caça 19 → 17).",
		{ doubleCritMargin: true, reason: "Alcance e camuflagem/cobertura leves ficam no texto; a margem de ameaça entra no ataque." }),
	curse("sanguinaria", "Sanguinária", "blood", "weapon", "semi",
		"Quem for atingido fica sangrando. O sangramento da arma é cumulativo (atingido duas vezes, perde 2d6 por rodada). Em acerto crítico, a arma drena o sangue e dá a você 2d10 PV temporários.",
		{ use: { label: "Crítico: drenar sangue", cost: 0, action: "free", roll: "2d10", text: "Acerto crítico: o alvo fica fraco e você recebe PV temporários.", tempPV: true } }),

	// ----------------------------------------------------------- Proteções
	curse("abascanta", "Abascanta", "knowledge", "protection", "semi",
		"+5 em testes de resistência contra rituais. Uma vez por cena, ao ser alvo de um ritual, gaste uma reação e PE igual ao custo dele para refleti-lo ao conjurador; as características se mantêm, mas você toma as decisões.",
		{ changes: [], use: { label: "Refletir ritual (1×/cena)", cost: 0, action: "reaction", text: "Gaste PE igual ao custo do ritual para refleti-lo de volta ao conjurador. O bônus de +5 em resistência contra rituais vale nos testes de resistência a rituais." }, ritualResist: 5 }),
	curse("profetica", "Profética", "knowledge", "protection", "auto",
		"Vislumbres de um futuro imediato: resistência a Conhecimento 10. Ao fazer um teste de resistência, gaste 2 PE para rolá-lo novamente.",
		{ changes: [resist("knowledgeDamage", 10, "Resistência a Conhecimento 10")], use: { label: "Rolar resistência de novo (2 PE)", cost: 2, action: "free", text: "Role o teste de resistência novamente." } }),
	curse("sombria", "Sombria", "knowledge", "protection", "auto",
		"+5 em Furtividade e ignora a penalidade de carga nessa perícia. Com uma ação de movimento e 1 PE, o item adquire a aparência de uma roupa comum, mantendo as propriedades.",
		{ changes: [skill("stealth", 5, "+5 em Furtividade")], use: { label: "Disfarçar (1 PE)", cost: 1, action: "movement", text: "O item parece uma roupa comum, mantendo defesa, espaço e penalidades." } }),
	curse("cinetica", "Cinética", "energy", "protection", "auto",
		"Barreira invisível: +2 em Defesa e resistência a dano 2 (proteção leve ou escudo) ou 5 (proteção pesada).",
		{ byClass: true }),
	curse("lepida", "Lépida", "energy", "protection", "auto",
		"+10 em Atletismo e +3 m de deslocamento. Gaste 2 PE: até o fim do turno você ignora terreno difícil, escala com deslocamento igual ao terrestre e fica imune a dano de queda de até 9 m.",
		{ changes: [skill("athleticism", 10, "+10 em Atletismo"), add("system.desloc.value", 3, "+3 m de deslocamento")], use: { label: "Movimento sobrenatural (2 PE)", cost: 2, action: "free", text: "Até o fim do turno: ignora terreno difícil, escalada igual ao deslocamento terrestre, imune a queda de até 9 m." } }),
	curse("voltaica", "Voltaica", "energy", "protection", "auto",
		"Resistência a Energia 10. Com ação de movimento e 2 PE, a proteção emite arcos de Energia até o fim da cena: no fim de cada turno seu, 2d6 de Energia em todos os seres adjacentes.",
		{ changes: [resist("energyDamage", 10, "Resistência a Energia 10")], use: { label: "Arcos de Energia (2 PE)", cost: 2, action: "movement", roll: "2d6", rollNote: "no fim de cada turno seu, em todos os adjacentes", text: "Até o fim da cena, no fim de cada turno seu: 2d6 de dano de Energia em todos os seres adjacentes." } }),
	curse("letargica", "Letárgica", "death", "protection", "semi",
		"+2 em Defesa. Chance de ignorar o dano extra de acertos críticos e ataques furtivos: 25% (leve ou escudo) ou 50% (pesada).",
		{ changes: [add("system.defense.value", 2, "+2 em Defesa")], chanceByClass: { light: 25, shield: 25, heavy: 50 }, use: { label: "Rolar a chance", cost: 0, action: "free", roll: "1d100", text: "Ignora o dano extra de crítico ou ataque furtivo se o resultado ficar dentro da chance da proteção." } }),
	curse("repulsiva", "Repulsiva", "death", "protection", "auto",
		"Resistência a Morte 10. Com ação de movimento e 2 PE, cobre o corpo de Lodo preto até o fim da cena: quem o ataca em corpo a corpo sofre 2d8 de dano de Morte.",
		{ changes: [resist("deathDamage", 10, "Resistência a Morte 10")], use: { label: "Lodo preto (2 PE)", cost: 2, action: "movement", roll: "2d8", rollNote: "em quem o ataca em corpo a corpo", text: "Até o fim da cena, quem o atacar em corpo a corpo sofre 2d8 de dano de Morte." } }),
	curse("regenerativa", "Regenerativa", "blood", "protection", "auto",
		"Resistência a Sangue 10. Com ação de movimento e 1 PE, recupera 1d12 pontos de vida.",
		{ changes: [resist("bloodDamage", 10, "Resistência a Sangue 10")], use: { label: "Regenerar (1 PE)", cost: 1, action: "movement", roll: "1d12", heal: true, text: "Recupera pontos de vida." } }),
	curse("sadica", "Sádica", "blood", "protection", "semi",
		"No início do seu turno, +1 em testes de ataque e rolagens de dano para cada 10 pontos de dano sofridos desde o fim do seu último turno.",
		{ use: { label: "Calcular bônus", cost: 0, action: "free", calc: "sadica", text: "+1 em ataque e dano para cada 10 pontos de dano sofridos desde o fim do último turno." } }),

	// ----------------------------------------------------------- Acessórios
	curse("carisma", "Carisma", "knowledge", "accessory", "auto",
		"O acessório gera uma aura carismática: +1 em Presença (sem PE adicionais).",
		{ changes: [attribute("pre", 1, "+1 em Presença")], attributeBonus: "pre" }),
	curse("conjuracao", "Conjuração", "knowledge", "accessory", "semi",
		"O acessório guarda um ritual de 1º círculo. Empunhando o item, você conjura o ritual como se o conhecesse; se já o conhece, o custo diminui em –1 PE.",
		{ choice: "ritual", use: { label: "Conjurar o ritual", cost: 0, action: "standard", text: "Conjure o ritual guardado como se o conhecesse; se já o conhece, o custo cai em –1 PE." } }),
	curse("escudoMental", "Escudo Mental", "knowledge", "accessory", "auto",
		"Barreira psíquica: resistência mental 10.",
		{ changes: [resist("mentalDamage", 10, "Resistência mental 10")] }),
	curse("reflexao", "Reflexão", "knowledge", "accessory", "manual",
		"Uma vez por rodada, ao ser alvo de um ritual, gaste PE igual ao custo dele para refleti-lo ao conjurador. As características do ritual se mantêm, mas você toma as decisões.",
		{ use: { label: "Refletir ritual (1×/rodada)", cost: 0, action: "reaction", text: "Gaste PE igual ao custo do ritual para refleti-lo de volta ao conjurador." } }),
	curse("sagacidade", "Sagacidade", "knowledge", "accessory", "auto",
		"+1 em Intelecto. Este aumento não fornece perícias nem graus de treinamento.",
		{ changes: [attribute("int", 1, "+1 em Intelecto (sem perícias)")], attributeBonus: "int" }),
	curse("defesa", "Defesa", "energy", "accessory", "auto",
		"Barreira de energia invisível: +5 de Defesa.",
		{ changes: [add("system.defense.value", 5, "+5 em Defesa")] }),
	curse("destreza", "Destreza", "energy", "accessory", "auto",
		"Aprimora coordenação e velocidade: +1 em Agilidade.",
		{ changes: [attribute("dex", 1, "+1 em Agilidade")], attributeBonus: "dex" }),
	curse("potencia", "Potência", "energy", "accessory", "auto",
		"Aumenta em +1 a DT contra suas habilidades, poderes e rituais.",
		{ changes: [add("system.ritual.DT", 1, "+1 na DT de habilidades, poderes e rituais")] }),
	curse("esforcoAdicional", "Esforço Adicional", "death", "accessory", "auto",
		"+5 PE. Este efeito só se ativa após um dia de uso.",
		{ changes: [add("system.PE.bonus", 5, "+5 PE")], lock: "day" }),
	curse("disposicao", "Disposição", "blood", "accessory", "auto",
		"Valendo-se do poder do Sangue: +1 em Vigor.",
		{ changes: [attribute("vit", 1, "+1 em Vigor")], attributeBonus: "vit" }),
	curse("pujanca", "Pujança", "blood", "accessory", "auto",
		"Aumenta sua potência muscular: +1 em Força.",
		{ changes: [attribute("str", 1, "+1 em Força")], attributeBonus: "str" }),
	curse("vitalidade", "Vitalidade", "blood", "accessory", "auto",
		"+15 PV. Este efeito só se ativa após um dia de uso.",
		{ changes: [add("system.PV.bonus", 15, "+15 PV")], lock: "day" }),
	curse("protecaoElemental", "Proteção Elemental", "knowledge", "accessory", "auto",
		"Resistência 10 contra um elemento (à escolha). Este acessório conta como item do elemento contra o qual fornece resistência.",
		{ choice: "element", elementFromChoice: true }),

	// ----------------------------------------- Sobrevivendo ao Horror
	curse("lenteDeRevelacao", "Lente de Revelação", "knowledge", "accessory", "manual",
		"Modificação paranormal de câmera de aura: vê seres invisíveis e incorpóreos e ignora a camuflagem deles. Com ação padrão e 1 PE, fotografa uma criatura em alcance curto, que perde a camuflagem até o fim da cena.",
		{ use: { label: "Fotografar (1 PE)", cost: 1, action: "standard", text: "A criatura fotografada em alcance curto perde a camuflagem até o fim da cena." } }),
]));

export const CURSE_KEYS = Object.freeze(Object.keys(CURSES));

export const curseOf = (key) => CURSES[key] ?? null;

/** Maldições que cada tipo de item aceita (a Lente de Revelação é modificação de câmera: equipamento geral). */
export function cursesForKind(kind) {
	return Object.values(CURSES).filter((c) => c.kind === kind);
}

/** Tipo de maldição que o item aceita, ou null (munição, poderes e outros itens não aceitam). */
export const kindOfItem = (type) => ITEM_KIND[type] ?? null;

export const isOpposed = (a, b) => OPPOSED.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Elemento efetivo de uma maldição já no item (Proteção Elemental e Antielemento usam a escolha). */
export function elementOf(entry) {
	const def = CURSES[entry?.key];
	if (!def) return null;
	if (def.elementFromChoice && ELEMENTS[entry.chosen]) return entry.chosen;
	return def.element;
}

/** Quantas maldições o item tem (sem repetidas). */
export function curseCount(system = {}) {
	const list = Array.isArray(system.curses) ? system.curses : Array.from(system.curses ?? []);
	return new Set(list.map((c) => c?.key).filter((k) => CURSES[k])).size;
}

/** A primeira maldição soma +II à categoria; cada seguinte, +I (Livro, "Itens amaldiçoados"). */
export const curseCategoryBonus = (count) => (count > 0 ? 2 + (count - 1) : 0);

/**
 * Pode acrescentar a maldição `key` a um item?
 * @returns {{ ok: boolean, error?: string, warnings: string[] }} `error` bloqueia (repetida, tipo errado); `warnings` só avisam.
 */
export function validateAdd(existing, key, { itemType, weaponRange = null } = {}) {
	const def = CURSES[key];
	const warnings = [];
	if (!def) return { ok: false, error: "Maldição desconhecida.", warnings };
	const kind = kindOfItem(itemType);
	if (!kind) return { ok: false, error: "Só armas, proteções e equipamentos gerais (acessórios) podem ser amaldiçoados.", warnings };
	const allowed = cursesForKind(kind).some((c) => c.key === key);
	if (!allowed) return { ok: false, error: `${def.label} é uma maldição de ${KINDS[def.kind].toLowerCase()}, não de ${KINDS[kind].toLowerCase()}.`, warnings };
	if ((existing ?? []).some((c) => c?.key === key)) return { ok: false, error: `${def.label} já está neste item (maldições iguais não se acumulam).`, warnings };
	if (def.only === "melee" && weaponRange === "ranged") return { ok: false, error: `${def.label} só pode ficar em armas corpo a corpo.`, warnings };
	const element = elementOf({ key });
	for (const c of existing ?? []) {
		const other = elementOf(c);
		if (other && element && isOpposed(other, element)) warnings.push(`${def.label} (${ELEMENTS[element].label}) é opressora de ${CURSES[c.key].label} (${ELEMENTS[other].label}): o livro não permite as duas no mesmo item.`);
	}
	return { ok: true, warnings };
}

/** Categoria final do item por maldições e modificações (para a ficha). */
export function categoryParts({ base = 0, modifications = 0, curses = 0 } = {}) {
	return { base, mods: modifications, curseBonus: curseCategoryBonus(curses), total: base + modifications + curseCategoryBonus(curses) };
}

/** Classe da proteção pelo nome (o item não guarda leve/pesada): escudo, pesada ou leve. */
export function protectionClass(item) {
	const name = String(item?.name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
	if (/escudo/.test(name)) return "shield";
	if (/pesad/.test(name)) return "heavy";
	return "light";
}

/** Mudanças de ficha da maldição (Cinética depende da classe da proteção; Proteção Elemental, da escolha). */
export function changesFor(entry, { protectionClass: cls = "light" } = {}) {
	const def = CURSES[entry?.key];
	if (!def) return [];
	if (def.byClass) {
		const heavy = cls === "heavy";
		return [add("system.defense.value", 2, "+2 em Defesa"), add("system.genericRd.value", heavy ? 5 : 2, `Resistência a dano ${heavy ? 5 : 2}`)];
	}
	if (def.elementFromChoice) {
		const element = ELEMENTS[entry.chosen];
		if (!element || entry.chosen === "fear") return [];
		return [resist(element.damage, 10, `Resistência a ${element.label} 10`)];
	}
	return def.changes ?? [];
}

/** O efeito de tempo ("só após um dia de uso") já liberou? `since` é o tempo do mundo (s) em que o item passou a ser usado. */
export const DAY = 86400;
export function isUnlocked(entry, now) {
	const def = CURSES[entry?.key];
	if (!def?.lock) return true;
	if (entry?.since === null || entry?.since === undefined) return false; // o item ainda não foi usado
	const since = Number(entry.since);
	if (!Number.isFinite(since)) return false;
	return Number(now) - since >= DAY;
}

/**
 * Decide quais maldições dos itens do agente valem. Maldições iguais não se acumulam: só a primeira (item equipado) vale.
 * @param {Array<{itemId:string, using:boolean, curses:Array}>} items
 * @returns {Map<string, boolean>} `${itemId}:${key}` → vale?
 */
export function resolveActive(items, now = 0) {
	const out = new Map();
	const seen = new Set();
	for (const item of items) {
		for (const entry of item.curses ?? []) {
			const id = `${item.itemId}:${entry.key}`;
			if (!CURSES[entry.key]) continue;
			const duplicate = seen.has(entry.key);
			const active = Boolean(item.using) && !duplicate && isUnlocked(entry, now);
			if (item.using && !duplicate) seen.add(entry.key);
			out.set(id, active);
		}
	}
	return out;
}

/** Quantas maldições de cada elemento estão em uso (base do preço da maldição). */
export function countByElement(items) {
	const counts = { knowledge: 0, energy: 0, death: 0, blood: 0, fear: 0 };
	for (const item of items) {
		if (!item.using) continue;
		for (const entry of item.curses ?? []) {
			const element = elementOf(entry);
			if (element) counts[element] += 1;
		}
	}
	return counts;
}

/** Preço da maldição ao falhar no teste do atributo do elemento: 2 de Sanidade por maldição (Livro, p. 145). */
export const PRICE_PER_CURSE = 2;
export function curseCost(counts, element) {
	return PRICE_PER_CURSE * Math.max(0, Number(counts?.[element]) || 0);
}

/** Elementos que cobram preço quando o atributo `attr` falha no teste (Sangue: Força ou Vigor). */
export function elementsForAttribute(attr) {
	return Object.entries(PRICE_ATTRIBUTE).filter(([, attrs]) => attrs.includes(attr)).map(([element]) => element);
}

/** Margem de ameaça duplicada: crítico "19/x2" (margem 19 = 2 números) vira 17 (4 números). */
export function doubledMarginBonus(criticalText) {
	const m = /^\s*(\d{1,2})/.exec(String(criticalText ?? ""));
	const threat = m ? Number(m[1]) : 20;
	const range = 21 - Math.min(20, Math.max(2, threat));
	return range;
}

/** Sádica: +1 em ataque e dano para cada 10 de dano sofrido desde o último turno. */
export const sadicaBonus = (damageTaken) => Math.floor(Math.max(0, Number(damageTaken) || 0) / 10);

/** Texto curto de custo de categoria para a ficha: "+II" na primeira maldição, "+I" nas seguintes. */
export function curseCostLabels(count) {
	return Array.from({ length: count }, (_, i) => (i === 0 ? "+II" : "+I"));
}

/** Classificação completa (o teste exige que toda maldição tenha modo e motivo). */
export function classification() {
	return CURSE_KEYS.map((key) => {
		const c = CURSES[key];
		return { key, mode: c.mode, auto: Boolean(c.changes?.length || c.byClass || c.elementFromChoice || c.attack || c.damage || c.doubleCritMargin), manual: Boolean(c.use) };
	});
}
