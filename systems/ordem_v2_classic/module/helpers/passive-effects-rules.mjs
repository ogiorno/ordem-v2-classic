/**
 * Poderes passivos que já dão o bônus só de entrarem na ficha (regras puras, sem Foundry — testável em Node).
 *
 * Cada poder passivo do compêndio cai em um destes casos (o teste `passive-effects.test.mjs` confere que nenhum
 * ficou de fora):
 *  - `changes`: o sistema cria um Efeito Ativo no poder (transfer) com essas mudanças de ficha. Como o efeito mora
 *    no poder, apagar o poder da ficha tira o bônus (ver passive-effects.mjs).
 *  - `pack`: o compêndio já traz o efeito pronto no poder.
 *  - `attack`: o bônus vale na rolagem de ataque (attack-power-effects.mjs), não na ficha.
 *  - `manual`: não dá para automatizar com os campos da ficha; o motivo fica registrado.
 */

/** Perícias do sistema (chave do modelo) — `treino.<perícia>` vale 1 quando a perícia já é treinada. */
export const SKILL_KEYS = [
	"acrobatics", "animal", "arts", "athleticism", "relevance", "sciences", "crime", "diplomacy", "deception", "resilience",
	"stealth", "initiative", "intimidation", "intuition", "investigation", "fighting", "medicine", "occultism", "perception",
	"driving", "aim", "reflexes", "religion", "survival", "tactics", "technology", "will",
];

/** Nome comparável: sem acento, minúsculo, sem o prefixo "NEX 10% - " / "Estágio 2 - " das trilhas e da sobrevivência. */
export function passiveKey(name) {
	return String(name ?? "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/^(nex \d+|estagio \d+) /, "");
}

/** Mapa `treino` do ator: `1` quando a perícia está treinada (grau diferente de "untrained"), `0` quando não. */
export function trainingMap(skills = {}) {
	const out = {};
	for (const key of SKILL_KEYS) out[key] = skills?.[key]?.degree?.label && skills[key].degree.label !== "untrained" ? 1 : 0;
	return out;
}

const add = (key, value, label) => ({ key, value, label });
const skill = (key, value, label) => add(`system.skills.${key}.mod`, value, label);
const attribute = (key, value, label) => add(`system.attributes.${key}.value`, value, label);
const defense = (value, label) => add("system.defense.value", value, label);
const pv = (value, label) => add("system.PV.bonus", value, label);
const pe = (value, label) => add("system.PE.bonus", value, label);
const san = (value, label) => add("system.SAN.bonus", value, label);
const spaces = (value, label) => add("system.spaces.bonus.max", value, label);
const desloc = (value, label) => add("system.desloc.value", value, label);


/** Os três testes de resistência: Fortitude, Reflexos e Vontade. */
const saves = (value, label) => ["resilience", "reflexes", "will"].map((k) => skill(k, value, label));

const SKILL_NAMES = {
	acrobatics: "Acrobacia", animal: "Adestramento", arts: "Artes", athleticism: "Atletismo", relevance: "Atualidades", sciences: "Ciências",
	crime: "Crime", diplomacy: "Diplomacia", deception: "Enganação", resilience: "Fortitude", stealth: "Furtividade", initiative: "Iniciativa",
	intimidation: "Intimidação", intuition: "Intuição", investigation: "Investigação", fighting: "Luta", medicine: "Medicina",
	occultism: "Ocultismo", perception: "Percepção", driving: "Pilotagem", aim: "Pontaria", reflexes: "Reflexos", religion: "Religião",
	survival: "Sobrevivência", tactics: "Tática", technology: "Tecnologia", will: "Vontade",
};
export { SKILL_NAMES };
const ATTRIBUTE_NAMES = { str: "Força", dex: "Agilidade", vit: "Vigor", int: "Intelecto", pre: "Presença" };
const ATTRIBUTE_NAMES_LIST = Object.entries(ATTRIBUTE_NAMES).map(([value, label]) => ({ value, label }));
const skillOptions = (keys) => keys.map((value) => ({ value, label: SKILL_NAMES[value] })).sort((a, b) => a.label.localeCompare(b.label, "pt"));

export const PASSIVE_RULES = Object.freeze({
	// --- Poderes de classe (Combatente) ---
	"reflexos defensivos": { changes: [defense(2, "+2 em Defesa"), ...saves(2, "+2 em testes de resistência")] },
	"correria desesperada": { changes: [desloc(3, "+3 m de deslocamento")] },
	"mochileiro": { changes: [spaces(5, "+5 espaços de carga")] },

	// --- Poderes gerais (Sobrevivendo ao Horror) ---
	"atletico": { changes: [desloc(3, "+3 m de deslocamento")] },
	"inventario organizado": { changes: [spaces("@attributes.int.value", "Intelecto somado ao limite de espaços")] },
	"observador": { changes: [skill("intuition", "@attributes.int.value", "Intelecto somado em Intuição")] },
	"personalidade esoterica": { changes: [pe(3, "+3 PE")] },
	"vitalidade reforcada": { changes: [pv("@nivel.value", "+1 PV por 5% de NEX"), skill("resilience", 2, "+2 em Fortitude")] },
	"vontade inabalavel": { changes: [pe("floor(@nivel.value / 2)", "+1 PE por 10% de NEX"), skill("will", 2, "+2 em Vontade")] },

	// --- Poderes de origem ---
	"calejado": { changes: [pv("@nivel.value", "+1 PV por 5% de NEX")] },
	"cicatrizes psicologicas": { changes: [san("@nivel.value", "+1 de Sanidade por 5% de NEX")] },
	"dedicacao": {
		changes: [
			pe("1 + floor((@nivel.value - 1) / 2)", "+1 PE e +1 PE a cada NEX ímpar (15%, 25%...)"),
			add("system.PE.perRoundBonus", 1, "+1 no limite de PE por turno"),
		],
	},
	"folego de nadador": { changes: [pv(5, "+5 PV")] },
	// a RD 2 vale sempre; o +2 na perícia escolhida é uma concessão de treinamento (skill-training-rules.mjs)
	"mutacao": { changes: [add("system.genericRd.value", 2, "Resistência a dano 2")] },
	"aumento de atributo": {
		changes: [],
		choice: {
			kind: "attribute", prompt: "Atributo que aumenta em +1 (máximo 3)",
			options: ATTRIBUTE_NAMES_LIST,
			build: (value) => attribute(value, `(@attributes.${value}.value < 3 ? 1 : 0)`, `+1 em ${ATTRIBUTE_NAMES[value]}`),
		},
	},
	"luta ou fuga": { changes: [skill("will", 2, "+2 em Vontade")] },
	"patrulha": { changes: [defense(2, "+2 em Defesa")] },

	// --- Poderes paranormais ---
	"espreitar da besta": { changes: [skill("stealth", 5, "+5 em Furtividade")] },
	"potencial aprimorado": { changes: [pe("@nivel.value", "+1 PE por 5% de NEX")] },
	"precognicao": { changes: [defense(2, "+2 em Defesa"), ...saves(2, "+2 em testes de resistência")] },
	"sangue de ferro": { changes: [pv("2 * @nivel.value", "+2 PV por 5% de NEX")] },
	"sensitivo": {
		changes: [skill("diplomacy", 5, "+5 em Diplomacia"), skill("intimidation", 5, "+5 em Intimidação"), skill("intuition", 5, "+5 em Intuição")],
	},
	"visao do oculto": { changes: [skill("perception", 5, "+5 em Percepção")] },

	// --- Trilhas ---
	"casca grossa": { changes: [pv("@nivel.value", "+1 PV por 5% de NEX")] },
	"durao": { changes: [pv("4 + (@stage.value >= 3 ? 2 : 0)", "+4 PV (+2 no 3º estágio)")] },
	"gatuno": { changes: [skill("athleticism", 5, "+5 em Atletismo"), skill("crime", 5, "+5 em Crime")] },
	"iniciativa aprimorada": { changes: [skill("initiative", 5, "+5 em Iniciativa")] },
	// capacidade = 5 × (Força + Intelecto); com Força 0 a base da ficha é 2 espaços, então tira os 2 que já estão lá
	"inventario otimizado": { changes: [spaces("(@attributes.int.value > 0 ? 5 * @attributes.int.value - (@attributes.str.value > 0 ? 0 : 2) : 0)", "Intelecto somado à Força na capacidade de carga")] },
	"mascate": { changes: [spaces(5, "+5 espaços de carga")] },
	"a forca do saber": {
		changes: [attribute("int", 1, "+1 em Intelecto"), pe("@attributes.int.value + 1", "Intelecto somado aos PE")],
	},
});

/** Poderes cujo efeito de ficha já vem pronto no compêndio (o teste confere que o efeito está lá e ligado). */
export const PACK_EFFECTS = Object.freeze([
	"ser assustador conhecimento", "ser assustador morte",
	"ser aterrorizante conhecimento", "ser aterrorizante energia", "ser aterrorizante morte", "ser aterrorizante sangue",
]);

/** Poderes passivos que mexem no ataque: o bônus entra na tela de ataque (attack-power-effects.mjs). */
export const ATTACK_POWERS = Object.freeze([
	"golpe pesado", "tiro certeiro", "tecnica letal", "balistica avancada", "ninja urbano", "mira de elite", "golpe de sorte",
	"mao pesada", "para bellum", "potencia maxima",
]);

/** Dos poderes acima, os que não estão em POWER_EFFECTS: o compêndio traz o efeito (Mão Pesada, Para Bellum) ou o código trata pelo nome. */
export const ATTACK_ELSEWHERE = Object.freeze(["mao pesada", "para bellum", "potencia maxima"]);

const MANUAL = {
	escolha: "Depende de uma escolha do jogador (perícia, elemento, arma, item, ritual ou poder): o efeito é montado na ficha depois da escolha.",
	condicional: "Só vale numa situação (tipo de teste, cena, alvo, condição como machucado): efeito de ficha é sempre ligado e erraria fora dela.",
	acao: "Muda ações, perícia substituta, uso ou regra de jogo; não há número de ficha para somar.",
	rituais: "Ensina ou altera rituais (conjuração, custo, DT ou círculo): fica com o fluxo de rituais, não com a ficha.",
	rd: "Dá resistência a dano; a ficha de agente ainda não tem campo de RD.",
	item: "Muda proficiência, categoria ou espaço de itens específicos; tratado no inventário.",
	narrativa: "Efeito de interlúdio, aliado, informação ou história: sem número de ficha.",
	dano: "Muda dano, margem ou multiplicador de uma arma específica ou do ataque desarmado: entra na tela de ataque quando houver regra.",
	permanente: "O bônus depende de uma etapa ritualística/condição a cada dia; os efeitos do compêndio ficam desligados de propósito.",
};
export const MANUAL_REASONS = Object.freeze(MANUAL);

const BY_REASON = {
	escolha: [
		"especialista em elemento", "mestre em elemento conhecimento", "mestre em elemento energia",
		"mestre em elemento medo", "mestre em elemento morte", "mestre em elemento sangue", "ritual predileto",
		"tatuagem ritualistica variante", "ferramentas de trabalho", "resistir a elemento",
		"a favorita", "iniciado", "especialista diletante", "flashback",
		"tracos do outro lado", "ele me ensina",
	],
	condicional: [
		"atraente", "causalidade fortuita", "encarar a morte", "escapar da morte", "potencial reaproveitado", "anatomia insana",
		"instintos sanguinarios", "sangue fervente", "sangue vivo", "inquebravel", "mente sa", "presenca poderosa",
		"gladiador paranormal", "estudar fraquezas", "estudar a presa", "atacar das sombras", "hacker", "primeira impressao",
		"conhecimento oculto", "nao e fantasia e cosplay", "acalentar", "palavras chave", "identificacao paranormal",
		"intuicao paranormal", "envolto em misterio", "esconderijo desesperado", "instinto de fuga", "engolir o choro",
		"fuga obstinada", "poder da amizade",
		"forcas para enfrentar", "tecnicas de contencao", "quem nao arrisca nao petisca", "turno invertido", "sussurros e vultos",
	],
	rituais: [
		"criar selo", "escolhido pelo outro lado", "fluxo de poder", "ritual potente", "tatuagem ritualistica", "dominio esoterico",
		"mesclar elemento troca anular ritual", "canalizar o medo", "medo tangivel", "conhecendo o medo", "presenca do medo",
		"lamina do medo", "saber ampliado", "grimorio ritualistico", "rituais eficientes", "lamina maldita", "conjuracao marcial",
		"poder do flagelo", "macula ritualistica",
	],
	rd: ["eu ja sabia", "inabalavel", "sofrimento de sangue", "o que restou"],
	item: [
		"armamento pesado", "protecao pesada", "tanque de guerra", "ferramentas favoritas", "mochila de utilidades",
		"o crime compensa", "patrocinador da ordem", "ferramentas paranormais",
	],
	dano: ["artista marcial", "tecnica secreta", "tecnica sublime", "maquina de matar", "atirar para matar", "perito em explosivos", "tecnica medicinal"],
	acao: [
		"saque rapido", "incansavel", "sempre alerta", "ciente das cicatrizes", "olhar sinistro", "racionalidade inflexivel",
		"apego angustiado", "pensamento agil", "poder nao desejado", "existe uma explicacao", "registrar o paranormal",
	],
	narrativa: [
		"ingrediente secreto", "fome do outro lado", "o inteligentao", "acolher o terror", "leitura fria", "parceiro",
		"contatos oportunos", "companheiro animal", "nerd", "rato de biblioteca", "leitor contumaz", "fabricacao propria", "minha teoria absurda",
		"reprogramacao mental", "provisoes de emergencia",
	],
	permanente: ["ser macabro conhecimento", "ser macabro morte"],
};

/** Poderes passivos que ficam sem efeito de ficha: nome comparável → motivo (chave de MANUAL_REASONS). */
export const MANUAL_PASSIVES = Object.freeze(
	Object.fromEntries(Object.entries(BY_REASON).flatMap(([reason, names]) => names.map((name) => [name, reason])))
);

/** Efeitos de ficha de um poder passivo, ou null. */
export function passiveRuleFor(name) {
	return PASSIVE_RULES[passiveKey(name)] ?? null;
}

const toNumberOrString = (value) => (typeof value === "number" ? value : String(value));

/** Mudança no formato do Efeito Ativo do Foundry 14 (`system.changes`). */
export function changeData({ key, value }) {
	return { key, type: "add", value: toNumberOrString(value), phase: "initial", priority: null };
}

/** Chaves já cobertas por algum efeito do poder (ex.: o efeito que o compêndio já traz): não se duplica o bônus. */
export function coveredKeys(effects = []) {
	const keys = new Set();
	for (const effect of effects) for (const change of effect.system?.changes ?? effect.changes ?? []) keys.add(change.key);
	return keys;
}

/** Marca do efeito criado pelo sistema; um por poder, atualizado no lugar quando a regra muda. */
export const MANAGED_FLAG = "passiveRule";

/** Flag do poder com o valor que o jogador escolheu (perícia ou atributo). */
export const CHOICE_FLAG = "passiveChoice";

/** Dados do Efeito Ativo a criar para o poder `name` (ou null se não há o que criar). */
/** O valor escolhido é aceito? (uma das opções da regra) */
export function validChoice(name, value) {
	return Boolean(passiveRuleFor(name)?.choice?.options.some((o) => o.value === value));
}

export function passiveEffectData(name, { existing = [], choice = null } = {}) {
	const rule = passiveRuleFor(name);
	if (!rule) return null;
	const own = existing.find((e) => e.flags?.ordem_v2_classic?.[MANAGED_FLAG]);
	const covered = coveredKeys(existing.filter((e) => e !== own));
	const chosen = rule.choice && validChoice(name, choice) ? [rule.choice.build(choice)] : [];
	const changes = [...rule.changes, ...chosen].filter((c) => !covered.has(c.key));
	if (!changes.length) return null;
	return {
		name,
		img: "icons/svg/aura.svg",
		type: "base",
		transfer: true,
		disabled: false,
		description: changes.map((c) => c.label).filter(Boolean).join("; "),
		system: { changes: changes.map(changeData) },
		flags: { ordem_v2_classic: { [MANAGED_FLAG]: true } },
	};
}
