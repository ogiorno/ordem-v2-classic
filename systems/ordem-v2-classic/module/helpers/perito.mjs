/**
 * Perito na janela do teste de perícia: caixa "gastar PE para somar o dado", com o custo da faixa do nível.
 * Regras puras em perito-rules.mjs.
 */
import { peritoPlan } from "./perito-rules.mjs";

const SYSTEM = "ordem-v2-classic";
const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** O poder Perito da ficha (só o "Perito" exato; "Perito em Explosivos" é outro poder). */
export function peritoItem(actor) {
	return actor?.items?.find((i) => i.type === "ability" && norm(i.name) === "perito") ?? null;
}

const resourceOf = (actor) => (actor.usingWithoutSanityRule ? "PD" : "PE");

/** Plano do Perito para este teste (ou null se a ficha não tem o poder ou a perícia não vale). */
export function peritoFor(actor, skill) {
	const item = peritoItem(actor);
	if (!item || actor.type !== "agent") return null;
	const resource = resourceOf(actor);
	const plan = peritoPlan({
		nivel: actor.system._progress ?? actor.system.nivel?.value,
		skill,
		degree: actor.system.skills?.[skill]?.degree?.value,
		chosen: item.getFlag?.(SYSTEM, "peritoSkills"),
		balance: actor.system[resource]?.value,
	});
	return plan.available ? { ...plan, resource } : null;
}

/** Cobra o Perito depois do teste. O custo fica em `config.peritoUsed` (guardado antes de rolar: ao postar a mensagem as rolagens viram texto). */
export async function payPerito(actor, config) {
	const used = config?.peritoUsed;
	if (!used) return false;
	const key = used.resource === "PD" ? "PD" : "PE";
	const current = Number(actor.system[key]?.value) || 0;
	await actor.update({ [`system.${key}.value`]: Math.max(0, current - used.pe) });
	return true;
}

/** Antes de rolar: sem saldo, o teste não sai com o Perito. */
export function registerPeritoHooks() {
	Hooks.on("op.postSkillRollConfiguration", (rolls, config) => {
		const used = rolls?.map((r) => r?.options?.perito).find(Boolean);
		if (!used) return;
		config.peritoUsed = used;
		const actor = config?.subject;
		const have = Number(actor?.system?.[used.resource]?.value) || 0;
		if (have >= used.pe) return;
		ui.notifications.warn(game.i18n.format("op.attackDialog.noBalance", { cost: used.pe, balance: have, resource: used.resource }));
		return false;
	});
}
