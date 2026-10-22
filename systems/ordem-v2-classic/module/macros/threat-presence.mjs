import { groupPresenceFormula, presenceTargetResult } from "../helpers/threat-calc.mjs";
import { rollTargetSkill } from "./threat-ability-resistance-runner.mjs";

const MODE_LABEL = { immune: "imune", half: "passou (metade)", full: "falhou (integral)" };

/** Pergunta quantas criaturas além da de maior VD estão na cena; devolve null se cancelar. */
async function askGroup() {
	const result = await foundry.applications.api.DialogV2.prompt({
		window: { title: game.i18n.localize("op.threat.presence") },
		content: `<div class="form-group"><label>${game.i18n.localize("op.disturbingPresence.extraCreatures")}</label><input type="number" name="extra" value="0" min="0" step="1" autofocus></div>
<div class="form-group"><label>${game.i18n.localize("op.disturbingPresence.applySanity")}</label><input type="checkbox" name="apply"></div>`,
		ok: { label: game.i18n.localize("op.threat.presenceRoll"), callback: (_e, button) => new foundry.applications.ux.FormDataExtended(button.form).object },
		rejectClose: false,
	});
	if (!result || result === "cancel") return null;
	return { extra: Math.max(0, Math.trunc(Number(result.extra) || 0)), apply: !!result.apply };
}

/**
 * Presença Perturbadora em grupo: rola o dano mental uma vez (+1d6 por criatura adicional) e, para cada
 * token mirado, aplica a imunidade por NEX e rola Vontade contra a DT (passou = metade). A perda de
 * Sanidade só é gravada se o Mestre marcar a opção; sem alvos, só rola o dano.
 */
export async function rollDisturbingPresence(actor) {
	const presence = actor.system.disturbingPresence;
	if (!String(presence.mentalDamage ?? "").trim()) return ui.notifications.warn(game.i18n.localize("op.disturbingPresence.noFormula"));
	const choice = await askGroup();
	if (!choice) return null;

	const formula = groupPresenceFormula(presence.mentalDamage, choice.extra);
	let roll;
	try {
		roll = await new Roll(formula, actor.getRollData()).evaluate();
	} catch (err) {
		return ui.notifications.error(`${game.i18n.localize("op.disturbingPresence.errorFormula")} ${err.message}`);
	}
	const speaker = ChatMessage.getSpeaker({ actor });
	const flavor = game.i18n.localize("op.disturbingPresence.mentalDamageRollFlavor");
	const tokens = [...game.user.targets].filter((t) => t.actor && t.actor.id !== actor.id);
	if (!tokens.length) {
		await roll.toMessage({ speaker, flavor });
		return { roll, results: [] };
	}

	const dt = Number(presence.dt) || 0;
	const results = [];
	for (const token of tokens) {
		const target = token.actor;
		const nex = Number(target.system?.NEX?.value) || 0;
		const immune = presenceTargetResult({ nex, immuneNex: presence.immuneNex, damage: roll.total }).mode === "immune";
		const save = immune ? null : await rollTargetSkill(target, "will", { flavor: game.i18n.localize("op.threat.presence") });
		const outcome = presenceTargetResult({ nex, immuneNex: presence.immuneNex, total: save?.total ?? null, dt, damage: roll.total });
		if (choice.apply && outcome.amount > 0 && target.system?.SAN && target.isOwner) {
			const san = target.system.SAN;
			await target.update({ "system.SAN.value": Math.max(0, (Number(san.value) || 0) - outcome.amount) });
		}
		results.push({ name: token.name, total: save?.total ?? null, ...outcome });
	}

	const rows = results.map((r) => `<li><strong>${foundry.utils.escapeHTML(r.name)}</strong>: ${r.total === null ? "" : `Vontade ${r.total} — `}${MODE_LABEL[r.mode]}${r.mode === "immune" ? "" : `, ${r.amount} de dano mental`}</li>`).join("");
	await roll.toMessage({
		speaker,
		flavor: `${flavor} — DT ${dt}${choice.extra ? ` (+${choice.extra} criatura${choice.extra > 1 ? "s" : ""})` : ""}<ul class="op-presence-results">${rows}</ul>`,
	});
	return { roll, results };
}
