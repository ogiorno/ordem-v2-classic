/**
 * Eclético e Engenhosidade (Especialista) na janela do teste de perícia: testar como treinado, veterano ou expert por um
 * único teste, gastando PE (PD no mundo sem Sanidade). Não muda o grau da ficha. Regras em skill-training-rules.mjs.
 */
import { eclecticOptions, degreeIndex, trainingClassKey } from "./skill-training-rules.mjs";

/** Opções de Eclético para esta perícia da ficha (lista vazia se a ficha não é Especialista ou já tem o grau). */
export function eclecticFor(actor, skill) {
	if (!actor || actor.type !== "agent" || !skill) return [];
	const key = trainingClassKey(actor.itemTypes?.class?.[0]?.name);
	const resource = actor.usingWithoutSanityRule ? "PD" : "PE";
	return eclecticOptions({
		classKey: key,
		level: Number(actor.system?._progress ?? actor.system?.nivel?.value) || 1,
		degreeIndex: degreeIndex(actor.system?.skills?.[skill]?.degree?.label),
	}).map((o) => ({ ...o, resource, canPay: (Number(actor.system?.[resource]?.value) || 0) >= o.pe }));
}

/** Cobra o Eclético depois do teste (o custo fica em `config.eclecticUsed`). */
export async function payEclectic(actor, config) {
	const used = config?.eclecticUsed;
	if (!used) return false;
	const key = used.resource === "PD" ? "PD" : "PE";
	const current = Number(actor.system[key]?.value) || 0;
	await actor.update({ [`system.${key}.value`]: Math.max(0, current - used.pe) });
	return true;
}

/** Sem saldo o teste não sai com o Eclético. */
export function registerEclecticHooks() {
	Hooks.on("op.postSkillRollConfiguration", (rolls, config) => {
		const used = rolls?.map((r) => r?.options?.eclectic).find(Boolean);
		if (!used) return;
		config.eclecticUsed = used;
		const have = Number(config?.subject?.system?.[used.resource]?.value) || 0;
		if (have >= used.pe) return;
		ui.notifications.warn(game.i18n.format("op.attackDialog.noBalance", { cost: used.pe, balance: have, resource: used.resource }));
		return false;
	});
}
