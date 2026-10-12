import { buildSaveRecord, saveReadiness } from "../helpers/threat-ability-resistance.mjs";

// Rola a resistência de cada alvo com a ficha dele (T05). Não aplica dano nem condição.
// A carta da rolagem não leva a DT: o resultado (passou/falhou) é calculado aqui e fica no registro.

/** Rola a perícia sem diálogo; devolve { total, rollRef } ou null se a ficha não consegue rolar. */
export async function rollTargetSkill(actor, skill, { flavor = "", rollMode = null } = {}) {
	if (!actor || typeof actor.rollSkill !== "function" || !actor.system?.skills?.[skill]) return null;
	const rolls = await actor.rollSkill({ skill }, { configure: false }, { create: false });
	const roll = Array.isArray(rolls) ? rolls[0] : rolls;
	const total = Number(roll?.total);
	if (!Number.isFinite(total)) return null;
	const message = await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor }, rollMode ? { rollMode } : {});
	return { total, rollRef: message?.id ?? null };
}

/**
 * Uma resistência independente por alvo. `tokens` = tokens (ou documentos) afetados.
 * Alvo que não pode rolar (ficha sem a perícia) fica `pending` para o Mestre informar o total.
 */
export async function rollSaves({ save, tokens, flavor = "", rollMode = null }) {
	const ready = saveReadiness(save);
	const named = tokens.map((t) => ({ id: t.id, name: t.name, actor: t.actor }));
	if (!ready.ok) return { ok: false, reason: ready.reason, records: named.map((t) => buildSaveRecord({ save, targetId: t.id, name: t.name })) };
	const records = [];
	for (const t of named) {
		const result = await rollTargetSkill(t.actor, ready.skill, { flavor, rollMode });
		records.push(buildSaveRecord({ save, targetId: t.id, name: t.name, total: result?.total ?? null, rollRef: result?.rollRef ?? null }));
	}
	return { ok: true, records };
}
