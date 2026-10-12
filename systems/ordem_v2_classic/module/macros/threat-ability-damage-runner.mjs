import { assignRolls, auditRecord, previewChange, resolveDamageType, resourcePath } from "../helpers/threat-ability-damage.mjs";
import { damageForMode } from "../helpers/threat-ability-resistance.mjs";

// Rola e aplica dano/cura das habilidades de ameaça (T06). Roda no cliente do Mestre.
// PV usa actor.applyDamage (RD, imunidade, vulnerabilidade, animação, Dano Massivo); SAN, PE e cura gravam direto.

const snapshotOf = (actor) => ({ type: actor.type, system: actor.system });

/** Rola cada entrada conforme a política (uma vez para todos ou por alvo) e posta uma carta por rolagem. */
export async function rollEntries({ entries, targetIds, item, speaker, rollMode = null }) {
	const values = {};
	const formulas = [];
	entries.forEach((entry, i) => {
		if (entry.roll === "perTarget") targetIds.forEach((id) => formulas.push([i, id, entry]));
		else formulas.push([i, null, entry]);
	});
	for (const [i, id, entry] of formulas) {
		const roll = await new Roll(entry.formula).evaluate();
		await roll.toMessage({ speaker, flavor: `${item?.name ?? ""} — ${entry.kind === "heal" ? "cura" : "dano"} ${entry.type ?? ""}`.trim() }, { rollMode: rollMode ?? game.settings.get("core", "rollMode") });
		values[`${i}:${id}`] = Math.max(0, Math.floor(Number(roll.total)));
	}
	return assignRolls(entries, targetIds, (entry, id) => values[`${entries.indexOf(entry)}:${id}`]);
}

/** Prévia (sem aplicar) de todas as entradas para um alvo. */
export function previewForTarget({ entries, rolls, targetId, mode, actor }) {
	return entries.map((entry, i) => previewChange({ entry, rolled: rolls[i][targetId], mode, snapshot: snapshotOf(actor) }));
}

/**
 * Aplica uma mudança prévia (de previewChange) ao ator. Devolve o registro auditável com valores reais lidos da ficha.
 * Recurso/alvo não suportado nunca cai em PV: devolve `supported:false` para aplicação manual.
 */
export async function applyChange({ actor, entry, change, source, userId = game.user?.id, sourceUuid = null }) {
	const base = { source, targetId: actor.id, targetName: actor.name, userId, at: Date.now() };
	if (!change.supported) return auditRecord({ ...base, change });
	const path = resourcePath(actor.type, change.resource);
	const before = Number(foundry.utils.getProperty(actor, `${path}.value`));
	if (change.kind === "heal") {
		if (change.healed > 0) await actor.update({ [`${path}.value`]: before + change.healed });
	} else if (change.resource === "pv") {
		const afterSave = damageForMode(change.rolled, change.mode);
		if (afterSave > 0) await actor.applyDamage(afterSave, { damageType: resolveDamageType(entry.type), ignoreRD: entry.ignoreRd === true, fx: sourceUuid ? { sourceUuid } : null });
	} else if (change.finalDamage > 0) {
		await actor.update({ [`${path}.value`]: Math.max(0, before - change.finalDamage) });
	}
	const after = Number(foundry.utils.getProperty(actor, `${path}.value`));
	return auditRecord({ ...base, change: { ...change, before, after } });
}
