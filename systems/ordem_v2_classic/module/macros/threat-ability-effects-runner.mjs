import { conditionEffectData } from "../helpers/conditions.mjs";
import { buildEffectPlan, isExpired, ownedBy, sourceFlag } from "../helpers/threat-ability-effects.mjs";
import { isValidFormula } from "../helpers/threat-ability-execution.mjs";

// Cria e remove os Efeitos Ativos das condições das habilidades de ameaça (T07). Roda no cliente do Mestre.
// Condição com mecânica no sistema usa conditions.mjs (expira em processConditionsAtTurnStart);
// as demais viram marcador de aplicação manual, com expiração própria por rodada quando há combate.

const SYSTEM = "ordem_v2_classic";
const FLAG = "abilityExec";

/** Rola a duração quando é fórmula (ex.: 1d4); inteiro volta como está. */
export async function rollDuration(duration) {
	const v = duration?.value;
	if (typeof v === "string" && isValidFormula(v) && /d/i.test(v)) {
		const roll = await new Roll(v).evaluate();
		return Math.max(1, Math.floor(Number(roll.total)));
	}
	return v === null || v === undefined || v === "" ? null : Number(v);
}

/**
 * Aplica um efeito configurado a um alvo, se o resultado da resistência pedir. Devolve o plano e o efeito criado.
 * @param {object} p  { actor, effect, passed, executionId, itemUuid, sourceActorUuid, effectIndex, rolled }
 */
export async function applyAbilityEffect({ actor, effect, passed = null, executionId, itemUuid = null, sourceActorUuid = null, effectIndex = 0, rolled = undefined }) {
	const combat = game.combat?.started ? game.combat : null;
	const duration = rolled === undefined ? await rollDuration(effect.duration) : rolled;
	const plan = buildEffectPlan({ effect, passed, rolled: duration, combat: combat ? { round: combat.round } : null });
	if (!plan.applies) return { plan, effect: null };
	const flag = sourceFlag({ executionId, itemUuid, sourceActorUuid, effectIndex, targetId: actor.id, plan });
	let data;
	if (plan.condition.support === "mechanical") {
		data = conditionEffectData(plan.condition.id, {
			name: plan.condition.label, rounds: plan.duration.rounds ?? null, origin: itemUuid,
			startRound: plan.duration.startRound ?? null, extraFlags: { [FLAG]: flag }
		});
	} else {
		data = {
			name: plan.condition.label, img: "icons/svg/aura.svg", origin: itemUuid,
			description: game.i18n.localize("op.threatExec.manualApplication"),
			duration: plan.duration.rounds ? { rounds: plan.duration.rounds, startRound: plan.duration.startRound ?? null } : {},
			flags: { [SYSTEM]: { [FLAG]: flag } }
		};
	}
	const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
	return { plan, effect: created };
}

/** Remove só os efeitos criados por esta execução (e, opcionalmente, por um índice de efeito). */
export async function removeExecutionEffects(actor, executionId, effectIndex = null) {
	const doomed = ownedBy(actor.effects, executionId, effectIndex).map((fx) => fx.id).filter((id) => actor.effects.has(id));
	if (doomed.length) await actor.deleteEmbeddedDocuments("ActiveEffect", doomed);
	return doomed;
}

/** Expira marcadores por rodada no início do turno do alvo (os mecânicos já expiram em processConditionsAtTurnStart). */
export async function expireAbilityEffects(combatant, combat) {
	const actor = combatant?.actor;
	if (!actor) return [];
	const expired = [];
	for (const fx of actor.effects) {
		const flag = fx.getFlag(SYSTEM, FLAG);
		if (flag && isExpired(flag.expiresRound, combat.round)) expired.push(fx.id);
	}
	const still = expired.filter((id) => actor.effects.has(id));
	if (still.length) await actor.deleteEmbeddedDocuments("ActiveEffect", still).catch((error) => console.debug("Habilidade de ameaça: efeito já removido por outro cliente", error.message));
	return expired;
}

export function registerAbilityEffectHooks() {
	Hooks.on("combatTurnChange", async (combat, _previous, current) => {
		if (!game.user.isActiveGM) return;
		const combatant = combat.combatants.get(current?.combatantId);
		try {
			await expireAbilityEffects(combatant, combat);
		} catch (error) {
			console.error("Habilidade de ameaça: falha ao expirar efeitos", error);
		}
	});
}
