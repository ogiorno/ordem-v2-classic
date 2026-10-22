// Opções da tela de ataque (docs/arquivo/spec-tela-de-ataque.md): efeitos desligados com flags.ordem-v2-classic.onUse.
export const ONUSE = [
	{
		pack: "fighterPowers",
		item: "Ataque Especial",
		effect: "Ataque Especial",
		description: "Quando faz um ataque, gaste 2 PE para receber +5 no teste de ataque ou na rolagem de dano; cada +5 adicional custa +1 PE. O limite de acúmulos cresce com o nível (NEX 25%, 55% e 85%).",
		onUse: { enabled: true, applies: "all", pool: true, maxMode: "special", unit: 5, cost: 2, stepCost: 1 },
	},
	{
		pack: "originPowers",
		item: "Mão Pesada",
		effect: "Mão Pesada",
		description: "+2 nas rolagens de dano com ataques corpo a corpo.",
		onUse: { enabled: true, applies: "melee", auto: true, damageBonus: 2 },
	},
	{
		pack: "originPowers",
		item: "Para Bellum",
		effect: "Para Bellum",
		description: "+2 nas rolagens de dano com armas de fogo.",
		onUse: { enabled: true, applies: "fire", auto: true, damageBonus: 2 },
	},
	{
		pack: "survivalPowers",
		item: "Estágio 4 - Pancada Forte",
		effect: "Pancada Forte",
		description: "Gaste 1 PE para receber +1 dado no teste de ataque.",
		onUse: { enabled: true, applies: "all", cost: 1, attackDice: 1 },
	},
];
