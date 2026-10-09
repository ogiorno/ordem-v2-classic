/**
 * Opções "ao usar" dos poderes que mexem no ataque (docs/spec-tela-de-ataque.md, seção "Poderes integrados").
 * Cada entrada vira um Efeito Ativo desligado, com `flags.ordem_v2_classic.onUse`, no poder da ficha
 * (feito por syncOnUseEffects ao abrir a tela de ataque). A chave é o fim do nome do poder, sem acento.
 */
const auto = (extra) => ({ enabled: true, auto: true, ...extra });

export const POWER_EFFECTS = Object.freeze({
	"golpe pesado": { description: "O dano das armas corpo a corpo aumenta em mais um dado do mesmo tipo.", onUse: auto({ applies: "melee", damageDice: 1 }) },
	"tiro certeiro": { description: "Com arma de disparo, soma a Agilidade nas rolagens de dano.", onUse: auto({ applies: "shoot", damageAttr: "dex" }) },
	"tecnica letal": { description: "+2 na margem de ameaça com ataques corpo a corpo.", onUse: auto({ applies: "melee", critMargin: 2 }) },
	"golpe demolidor": { description: "Ao quebrar ou atacar um objeto, gaste 1 PE para causar dois dados de dano extra do mesmo tipo.", onUse: { enabled: true, applies: "all", cost: 1, damageDice: 2 } },
	"balistica avancada": { description: "+2 nas rolagens de dano com armas táticas de fogo.", onUse: auto({ applies: "fire", proficiency: "tacticalWeapons", damageBonus: 2 }) },
	"ninja urbano": { description: "+2 nas rolagens de dano com armas táticas corpo a corpo e de disparo (exceto de fogo).", onUse: auto({ applies: "all", proficiency: "tacticalWeapons", exclude: "fire", damageBonus: 2 }) },
	"mira de elite": { description: "Soma o Intelecto nas rolagens de dano com armas de fogo que usam balas longas.", onUse: auto({ applies: "fire", ammo: "longBullets", damageAttr: "int" }) },
	"ataque furtivo": { description: "Alvo desprevenido ou flanqueado, uma vez por rodada: gaste 1 PE para +1d6 de dano (+2d6 em NEX 40%, +3d6 em 65%, +4d6 em 99%).", onUse: { enabled: true, applies: "all", cost: 1, byLevel: [[2, "1d6"], [8, "2d6"], [13, "3d6"], [20, "4d6"]] } },
	"disparo letal": { description: "Depois de mirar, gaste 1 PE para +2 na margem de ameaça do próximo ataque.", onUse: { enabled: true, applies: "ranged", cost: 1, critMargin: 2 } },
	"combate defensivo": { description: "Combata defensivamente: −1d20 no ataque e +5 na Defesa até o início do seu próximo turno (aplique a Defesa na ficha).", onUse: { enabled: true, applies: "all", attackDice: -1 } },
});

const strip = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Entrada do registro para um poder da ficha, ou null. */
export function powerEffectFor(name) {
	const key = strip(name);
	return Object.entries(POWER_EFFECTS).find(([k]) => key === k || key.endsWith(` ${k}`))?.[1] ?? null;
}

/** Dados do Efeito Ativo "ao usar" de um poder. */
export function powerEffectData(name, entry) {
	return {
		name,
		img: "icons/svg/aura.svg",
		disabled: true,
		transfer: false,
		description: entry.description,
		flags: { ordem_v2_classic: { onUse: { ...entry.onUse } } },
	};
}
