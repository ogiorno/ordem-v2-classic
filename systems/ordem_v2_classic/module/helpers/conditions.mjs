// Condições aplicadas pelos rituais (Livro v1.3, capítulo de condições) com efeito mecânico de verdade.
// Cada condição vira um Efeito Ativo; a parte mecânica fica em `flags.ordem_v2_classic.condition`:
//   defense   número somado à Defesa (via `changes`, já aplicado pelo Foundry)
//   dice      d20 a menos nos testes: { <perícia>: n, attack: n, all: n }
//   noActions não pode fazer ações (o turno é pulado)
//   bleed     sangramento: no início do turno, Vigor DT 20 ou perde 1d6 PV
//   noHealing não recupera PV
//   noRituals não pode conjurar rituais
//   badCasting condição ruim para conjurar (concentração)

export const CONDITION_FLAG = "condition";
const SYSTEM = "ordem_v2_classic";
const ADD = 2; // CONST.ACTIVE_EFFECT_MODES.ADD

const defense = (value) => [{ key: "system.defense.value", mode: ADD, value: String(value) }];

/** Catálogo por id interno. `status` liga ao status oficial do sistema (ícone na ficha), quando existir. */
export const CONDITIONS = Object.freeze({
	vulnerable: { name: "Vulnerável", img: "icons/svg/downgrade.svg", changes: defense(-2), condition: { defense: -2 } },
	stun: { name: "Atordoado", status: "stun", changes: defense(-5), condition: { defense: -5, dice: { reflexes: 1 }, noActions: true } },
	grabbed: { name: "Agarrado", status: "restrain", changes: defense(-5), condition: { defense: -5, dice: { reflexes: 1, attack: 1 }, immobile: true } },
	deaf: { name: "Surdo", status: "deaf", changes: [], condition: { dice: { initiative: 2 }, badCasting: true } },
	silence: { name: "Silenciado", status: "silence", changes: [], condition: { noRituals: true } },
	bleeding: { name: "Sangrando", status: "bleeding", changes: [], condition: { bleed: true } },
	nauseated: { name: "Enjoado", img: "icons/svg/hazard.svg", changes: [], condition: { oneAction: true } },
	noHealing: { name: "Sem recuperar PV", img: "icons/svg/blood.svg", changes: [], condition: { noHealing: true } },
	burning: { name: "Em Chamas", img: "icons/svg/fire.svg", changes: [], condition: { burn: true } },
	unconscious: { name: "Inconsciente", status: "unconscious", changes: defense(-5), condition: { defense: -5, noActions: true, unconscious: true } },
	dying: { name: "Morrendo", img: "icons/svg/skull.svg", changes: [], condition: { dying: true } },
});

/** Texto da regra de cada condição, mostrado na tela de ataque. */
export const CONDITION_RULES = Object.freeze({
	vulnerable: "−2 na Defesa.",
	stun: "−5 na Defesa, −1 dado em Reflexos e não pode realizar ações.",
	grabbed: "−5 na Defesa, −1 dado em Reflexos e em ataques, e fica imóvel.",
	deaf: "−2 dados em Iniciativa e dificulta a conjuração de rituais.",
	silence: "Não pode conjurar rituais.",
	bleeding: "No início do turno faz um teste de Vigor (DT 20); se falhar, perde 1d6 PV.",
	nauseated: "Só pode realizar uma ação por rodada.",
	noHealing: "Não recupera PV.",
	burning: "No início do turno sofre 1d6 de dano de fogo; gastar uma ação padrão apaga as chamas.",
	unconscious: "Indefeso (−5 na Defesa) e não pode realizar ações. Termina com qualquer efeito que cure pelo menos 1 PV.",
	dying: "Com 0 PV. Ao iniciar três turnos morrendo na mesma cena, morre. Só termina com Medicina (DT 20) ou efeitos específicos.",
});

/** Nome/status usados nas regras de ritual → id do catálogo. */
const ALIASES = Object.freeze({
	stun: "stun", burning: "burning", "Em Chamas": "burning", restrain: "grabbed", deaf: "deaf", silence: "silence", bleeding: "bleeding",
	"Vulnerável": "vulnerable", "Enjoado": "nauseated", "Sem recuperar PV (1 rodada)": "noHealing",
	"Agarrado (Tentáculos de Lodo)": "grabbed",
});

/** Id do catálogo para uma condição de regra de ritual (`{ key }` ou `{ label }`), ou null se não tiver mecânica. */
export function conditionIdFor(cond) {
	return ALIASES[cond.key] ?? ALIASES[cond.label] ?? null;
}

/** Dados do Efeito Ativo para a condição. */
export function conditionEffectData(id, { name, rounds = null, origin = null, extraFlags = {}, startRound = null } = {}) {
	const def = CONDITIONS[id];
	const status = def.status ? CONFIG.statusEffects.find((entry) => entry.id === def.status) : null;
	return {
		name: name ?? def.name,
		img: def.img ?? status?.img ?? "icons/svg/aura.svg",
		statuses: status ? [status.id] : [],
		origin,
		changes: def.changes.map((change) => ({ ...change })),
		duration: rounds ? { rounds, startRound } : {},
		flags: { [SYSTEM]: { [CONDITION_FLAG]: { id, ...def.condition, expiresRound: rounds && startRound !== null ? startRound + rounds - 1 : null }, ...extraFlags } },
	};
}

/** Efeitos ativos do ator que trazem a condição `id` (ou qualquer condição mecânica, sem `id`). */
export function activeConditions(actor, id = null) {
	return (actor?.effects ?? []).filter((effect) => {
		if (effect.disabled) return false;
		const data = effect.getFlag(SYSTEM, CONDITION_FLAG);
		return data && (id === null || data.id === id);
	});
}

/** Resumo das condições mecânicas ativas, para a tela e o cartão de ataque. */
export function attackConditionDetails(actor) {
	return activeConditions(actor).map((effect) => {
		const data = effect.getFlag(SYSTEM, CONDITION_FLAG) ?? {};
		const dice = data.dice ?? {};
		const attackPenalty = Math.max(0, Number(dice.attack) || 0) + Math.max(0, Number(dice.all) || 0);
		const details = [];
		if (attackPenalty) details.push(`−${attackPenalty} dado${attackPenalty === 1 ? "" : "s"} no ataque`);
		if (Number(data.defense)) {
			const defense = Number(data.defense);
			details.push(`${defense < 0 ? "−" : "+"}${Math.abs(defense)} Defesa`);
		}
		if (data.noActions) details.push("sem ações");
		else if (data.oneAction) details.push("uma ação por rodada");
		if (data.immobile) details.push("imóvel");
		if (data.bleed) details.push("sangramento");
		if (data.burn) details.push("1d6 de fogo por turno");
		if (data.noHealing) details.push("não recupera PV");
		if (data.noRituals) details.push("não conjura rituais");
		if (data.badCasting) details.push("dificulta conjuração");
		const text = String(effect.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
		return { id: effect.id, name: effect.name, detail: details.join(" · "), description: text || CONDITION_RULES[data.id] || "", attackPenalty };
	});
}

/** Algum efeito ativo do ator tem a propriedade `prop` (ex.: "noRituals")? */
export function hasConditionProp(actor, prop) {
	return activeConditions(actor).some((effect) => effect.getFlag(SYSTEM, CONDITION_FLAG)?.[prop]);
}

/**
 * Quantos d20 a menos o ator tem num teste, somando as condições ativas.
 * @param {Actor} actor
 * @param {string} kind  chave da perícia ("reflexes", "initiative"…) ou "attack"
 */
export function conditionDicePenalty(actor, kind) {
	let total = 0;
	for (const effect of activeConditions(actor)) {
		const dice = effect.getFlag(SYSTEM, CONDITION_FLAG)?.dice;
		if (!dice) continue;
		total += Number(dice[kind] ?? 0) + Number(dice.all ?? 0);
	}
	return total;
}
