// Regras dos rituais de área (e das formas de ritual que viram área), mapeadas do Livro de Regras v1.3.
// Chave = nome do ritual; depois a forma ("basic", "student" = Discente, "true" = Verdadeiro).
// A especificação de cada caso está em docs/arquivo/spec-rituais-area.md (requisitos AR-xx).
//
// Campos de uma forma:
//   area      { shape: circle|cone|rect|ray, distance, width?, center?: "placed"|"caster", follow?: true }
//             Medidas em metros. circle = raio; rect = lado do quadrado; ray = comprimento (width = largura).
//             Sem `area`, o ritual age sobre os alvos marcados pelo jogador na janela de conjuração.
//   chosen    true = só os alvos escolhidos pelo jogador (ex.: "alvos a sua escolha"), mesmo havendo área.
//   onCast    efeito aplicado ao conjurar.
//   tick      efeito repetido numa zona persistente; `when`: "casterTurn" (início de cada turno do conjurador)
//             ou "targetTurn" (início do turno de cada criatura dentro da área); `rounds`: duração em rodadas.
//   exit      efeito quando uma criatura tenta sair da zona.
//   narrative texto mostrado no chat quando o ritual não tem automação (a área ainda é colocada no mapa).
//
// Um efeito (`onCast`, `tick`, `exit`) aceita:
//   damage    [{ formula, type }]   dano rolado uma vez e dividido entre os alvos
//   save      { skill, success: "half"|"none"|"negates"|"full" }   resistência de cada alvo (DT do conjurador):
//             half = dano pela metade; none/negates = sem dano; full = dano igual (a resistência decide só o resto)
//   onFail / onSuccess   [{ key?|label, rounds?, oncePerScene? }]   condições aplicadas
//   damageOnFailOnly      só causa dano a quem falhar
//   special   "killAtZero" | "grapple" | "tempPvFromDamage" | "vulnerabilities" | "blockExit"

const FORT = "resilience";
const REF = "reflexes";
const WILL = "will";
const circle = (distance, extra = {}) => ({ shape: "circle", distance, ...extra });

export const AREA_RULES = Object.freeze({
	"Paradoxo": {
		basic: { area: circle(6), onCast: { damage: [{ formula: "6d6", type: "deathDamage" }], save: { skill: FORT, success: "half" } } },
		// Esfera de 1,5 m de diâmetro que você move 9 m por ação de movimento (arraste o modelo no mapa).
		student: { area: circle(0.75), tick: { when: "targetTurn", damage: [{ formula: "4d6", type: "deathDamage" }] } },
		true: {
			area: circle(6),
			onCast: { damage: [{ formula: "13d6", type: "deathDamage" }], save: { skill: FORT, success: "half" }, special: "killAtZero" },
		},
	},
	"Miasma Entrópico": {
		basic: {
			area: circle(6),
			onCast: { damage: [{ formula: "4d8", type: "chemicalDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Enjoado", rounds: 1 }] },
		},
		student: {
			area: circle(6),
			onCast: { damage: [{ formula: "6d8", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Enjoado", rounds: 1 }] },
		},
		true: {
			area: circle(6),
			onCast: { damage: [{ formula: "6d8", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Enjoado", rounds: 1 }] },
			tick: {
				when: "targetTurn", rounds: 3,
				damage: [{ formula: "6d8", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Enjoado", rounds: 1 }],
			},
		},
	},
	"Deflagração de Energia": {
		basic: {
			area: circle(15),
			onCast: {
				damage: [{ formula: "(3d10)*10", type: "energyDamage" }], save: { skill: FORT, success: "half" },
				onFail: [{ label: "Itens tecnológicos quebrados" }], onSuccess: [{ label: "Itens tecnológicos inoperantes (1d4 rodadas)", rounds: "1d4" }],
			},
		},
		true: {
			area: circle(15), chosen: true,
			onCast: {
				damage: [{ formula: "(3d10)*10", type: "energyDamage" }], save: { skill: FORT, success: "half" },
				onFail: [{ label: "Itens tecnológicos quebrados" }], onSuccess: [{ label: "Itens tecnológicos inoperantes (1d4 rodadas)", rounds: "1d4" }],
			},
		},
	},
	"Esfolar": {
		basic: { onCast: { damage: [{ formula: "3d4+3", type: "cuttingDamage" }], save: { skill: REF, success: "half" }, onFail: [{ key: "bleeding" }] } },
		student: { area: circle(6), onCast: { damage: [{ formula: "5d4+5", type: "cuttingDamage" }], save: { skill: REF, success: "half" }, onFail: [{ key: "bleeding" }] } },
		true: {
			area: circle(6),
			onCast: { damage: [{ formula: "10d4+10", type: "cuttingDamage" }], save: { skill: REF, success: "half" }, onFail: [{ key: "bleeding" }], onSuccess: [{ key: "bleeding" }] },
		},
	},
	"Eletrocussão": {
		basic: { onCast: { damage: [{ formula: "3d6", type: "eletricDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Vulnerável", rounds: 1 }] } },
		student: { area: { shape: "ray", distance: 30, width: 1.5 }, onCast: { damage: [{ formula: "6d6", type: "energyDamage" }], save: { skill: FORT, success: "half" } } },
		true: { chosen: true, onCast: { damage: [{ formula: "8d6", type: "energyDamage" }], save: { skill: FORT, success: "half" } } },
	},
	"Decadência": {
		basic: { onCast: { damage: [{ formula: "2d8+2", type: "deathDamage" }], save: { skill: FORT, success: "half" } } },
		student: { onCast: { damage: [{ formula: "3d8+3", type: "deathDamage" }] } },
		true: { area: circle(6, { center: "caster" }), onCast: { damage: [{ formula: "8d8+8", type: "deathDamage" }], save: { skill: FORT, success: "half" } } },
	},
	"Consumir Manancial": {
		true: {
			area: circle(6, { center: "caster" }),
			onCast: { damage: [{ formula: "3d6", type: "deathDamage" }], save: { skill: FORT, success: "half" }, special: "tempPvFromDamage" },
		},
	},
	"Transfigurar Água": {
		choices: {
			evaporar: { label: "Evaporar (dano de Energia)" },
			congelar: { label: "Congelar", narrative: "Toda a água mundana na área congela. Seres nadando ficam imóveis; escapar exige ação padrão e Atletismo (DT do ritual)." },
			derreter: { label: "Derreter", narrative: "O gelo mundano na área vira água e o ritual termina." },
			enchente: { label: "Enchente", narrative: "O nível da água mundana na área sobe até 4,5 m." },
			partir: { label: "Partir", narrative: "O nível da água mundana na área baixa até 4,5 m." },
		},
		basic: { area: circle(30), byChoice: { evaporar: { onCast: { damage: [{ formula: "5d8", type: "energyDamage" }], save: { skill: FORT, success: "half" } } } } },
		true: { area: circle(30), byChoice: { evaporar: { onCast: { damage: [{ formula: "10d8", type: "energyDamage" }], save: { skill: FORT, success: "half" } } } } },
	},
	"Transfigurar Terra": {
		choices: {
			amolecer: { label: "Amolecer (desabamento)" },
			modelar: { label: "Modelar", narrative: "Terra, pedra ou argila viram objetos simples ou paredes (cobertura total, RD 8, 50 PV a cada 3 m)." },
			solidificar: { label: "Solidificar" },
		},
		basic: {
			area: { shape: "rect", distance: 4.5 },
			byChoice: {
				amolecer: { onCast: { damage: [{ formula: "10d6", type: "impactDamage" }], save: { skill: REF, success: "half" } } },
				solidificar: { onCast: { onFail: [{ key: "restrain" }], onSuccess: [{ key: "restrain" }] } },
			},
		},
		student: {
			area: { shape: "ray", distance: 7.5, width: 4.5 },
			byChoice: {
				amolecer: { onCast: { damage: [{ formula: "10d6", type: "impactDamage" }], save: { skill: REF, success: "half" } } },
				solidificar: { onCast: { onFail: [{ key: "restrain" }], onSuccess: [{ key: "restrain" }] } },
			},
		},
	},
	"Poeira da Podridão": {
		basic: {
			area: circle(6),
			onCast: { damage: [{ formula: "4d8", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Sem recuperar PV (1 rodada)", rounds: 1 }] },
			tick: { when: "casterTurn", damage: [{ formula: "4d8", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Sem recuperar PV (1 rodada)", rounds: 1 }] },
		},
		true: {
			area: circle(6),
			onCast: { damage: [{ formula: "4d8+16", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Sem recuperar PV (1 rodada)", rounds: 1 }] },
			tick: { when: "casterTurn", damage: [{ formula: "4d8+16", type: "deathDamage" }], save: { skill: FORT, success: "half" }, onFail: [{ label: "Sem recuperar PV (1 rodada)", rounds: 1 }] },
		},
	},
	"Presença do Medo": {
		basic: {
			area: circle(9, { center: "caster", follow: true }),
			onCast: {
				damage: [{ formula: "5d8", type: "mentalDamage" }, { formula: "5d8", type: "fearDamage" }], save: { skill: WILL, success: "half" },
				onFail: [{ key: "stun", rounds: 1, oncePerScene: true }],
			},
			tick: {
				when: "targetTurn",
				damage: [{ formula: "5d8", type: "mentalDamage" }, { formula: "5d8", type: "fearDamage" }], save: { skill: WILL, success: "half" },
				onFail: [{ key: "stun", rounds: 1, oncePerScene: true }],
			},
		},
	},
	"Tentáculos de Lodo": {
		basic: {
			area: circle(6),
			onCast: { special: "grapple", damage: [{ formula: "2d6", type: "impactDamage" }, { formula: "2d6", type: "deathDamage" }] },
			tick: { when: "casterTurn", special: "grapple", damage: [{ formula: "2d6", type: "impactDamage" }, { formula: "2d6", type: "deathDamage" }] },
		},
		true: {
			area: circle(9),
			onCast: { special: "grapple", damage: [{ formula: "3d6", type: "impactDamage" }, { formula: "3d6", type: "deathDamage" }] },
			tick: { when: "casterTurn", special: "grapple", damage: [{ formula: "3d6", type: "impactDamage" }, { formula: "3d6", type: "deathDamage" }] },
		},
	},
	"Purgatório": {
		basic: {
			area: circle(6),
			onCast: { special: "vulnerabilities" },
			// A dor causa o dano sempre; a resistência só decide se a criatura consegue sair.
			exit: { damage: [{ formula: "6d6", type: "bloodDamage" }], save: { skill: FORT, success: "full" }, special: "blockExit" },
		},
	},
	"Aurora da Verdade": {
		basic: { area: circle(3), onCast: { save: { skill: WILL, success: "negates" }, onFail: [{ label: "Compelido a dizer a verdade" }] } },
		student: { area: circle(9), onCast: { save: { skill: WILL, success: "negates" }, onFail: [{ label: "Compelido a dizer a verdade" }] } },
		true: { area: circle(9), onCast: { save: { skill: WILL, success: "negates" }, onFail: [{ label: "Compelido a dizer a verdade" }] } },
	},
	"Dissonância Acústica": {
		basic: { area: circle(6), onCast: { onFail: [{ key: "deaf" }, { key: "silence" }], onSuccess: [{ key: "deaf" }, { key: "silence" }] } },
	},
	"Tecer Ilusão": {
		basic: { narrative: "Ilusão de até 4 cubos de 1,5 m (sem dano). Seres e objetos a atravessam sem efeito." },
		student: { narrative: "Ilusão de até 8 cubos de 1,5 m, com imagem, som, odor e tato; seres só a atravessam passando em Vontade." },
		true: {
			area: { shape: "rect", distance: 3 },
			onCast: { damage: [{ formula: "6d6", type: "knowledgeDamage" }], save: { skill: WILL, success: "negates" }, damageOnFailOnly: true },
			tick: { when: "casterTurn", damage: [{ formula: "6d6", type: "knowledgeDamage" }], save: { skill: WILL, success: "negates" }, damageOnFailOnly: true, negateAfterPasses: 2 },
		},
	},
	"Cinerária": { basic: { area: circle(6), narrative: "Rituais conjurados dentro da névoa têm DT +5." }, student: { area: circle(6), narrative: "DT +5 e custo –2 PE para rituais conjurados na névoa." }, true: { area: circle(6), narrative: "DT +5 e dano de rituais conjurados na névoa é maximizado." } },
	"Rejeitar Névoa": { basic: { area: circle(6), narrative: "Rituais conjurados na área custam +2 PE por círculo e têm a execução aumentada em um passo. Anula Cinerária." }, student: { area: circle(6), narrative: "Como o básico, e a DT de resistência contra rituais na área cai em 5." }, true: { area: circle(6), narrative: "Como o discente, e o dano de rituais dentro da névoa é sempre mínimo." } },
	"Nuvem de Cinzas": { basic: { area: circle(6), narrative: "Camuflagem leve a até 1,5 m e total a partir de 3 m. Vento forte dispersa em 4 rodadas." }, student: { area: circle(6), narrative: "Seres escolhidos enxergam através da nuvem." }, true: { area: circle(6), narrative: "Nuvem espessa: deslocamento 3 m e –2 em ataques para quem estiver dentro." } },
	"Detecção de Ameaças": { basic: { area: circle(18), narrative: "Percepção DT 20 (ação de movimento) quando um hostil ou armadilha entra na área." }, student: { area: circle(18), narrative: "Sem desprevenido contra perigos detectados; +5 em resistência contra armadilhas." }, true: { area: circle(18), narrative: "Duração de 1 dia, com os benefícios do discente." } },
	"Localização": { basic: { area: circle(90), narrative: "Indica direção e distância da pessoa ou objeto mais próximo do tipo escolhido." } },
});

/**
 * Regra de uma forma do ritual, já resolvendo a escolha de efeito (ex.: Evaporar), ou null.
 * @param {Item} item
 * @param {string} formId  "basic" | "student" | "true"
 * @param {string|null} choiceId
 */
export function areaRuleFor(item, formId, choiceId = null) {
	const entry = AREA_RULES[item?.name];
	const form = entry?.[formId];
	if (!form) return null;
	const { byChoice, ...rest } = form;
	if (!byChoice) return { ...rest, key: item.name, formId };
	const choice = entry.choices?.[choiceId];
	return { ...rest, ...(byChoice[choiceId] ?? {}), narrative: byChoice[choiceId] ? undefined : choice?.narrative, key: item.name, formId, choiceId };
}

/** Escolhas de efeito do ritual (ex.: Congelar, Evaporar), ou null. */
export function areaChoicesFor(item) {
	return AREA_RULES[item?.name]?.choices ?? null;
}
