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
});

/** Nome/status usados nas regras de ritual → id do catálogo. */
const ALIASES = Object.freeze({
	stun: "stun", restrain: "grabbed", deaf: "deaf", silence: "silence", bleeding: "bleeding",
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
		total += Number(dice[kind] ?? 0) + (kind === "attack" ? 0 : Number(dice.all ?? 0));
	}
	return total;
}
