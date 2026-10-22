import { planConfigApplication, planIconApplication, summarizePlan } from "../helpers/threat-ability-config-match.mjs";

// Aplicação EXPLÍCITA das configurações revisadas (fixtures/threat-ability-configs-v1-3.json) a uma ficha de ameaça.
// Só roda por ação do Mestre, mostra o que vai mudar e pede confirmação. Nunca altera `activation`, nunca sobrescreve
// uma `execution` existente (a menos que se peça) e nada acontece durante a instalação do sistema.
//
// Uso (console do Mestre): await (await import("/systems/ordem-v2-classic/module/macros/threat-ability-config-apply.mjs")).applyThreatAbilityConfigs(actor)

const BASE = "/systems/ordem-v2-classic/fixtures/";
let cache = null;

async function loadData() {
	if (cache) return cache;
	const read = async (file) => (await fetch(`${BASE}${file}`)).json();
	const [configs, corpus, extra, icons] = await Promise.all([read("threat-ability-configs-v1-3.json"), read("threat-abilities-v1-3.json"), read("threat-abilities-extra.json"), read("threat-ability-icons.json")]);
	const corpusById = new Map([...corpus.creatures, ...extra.creatures].flatMap((c) => c.abilities.map((a) => [a.id, a])));
	cache = { configs: configs.abilities, corpusById, icons: icons.icons };
	return cache;
}

/** Plano sem efeitos: o que seria aplicado a esta ficha. */
export async function previewThreatAbilityConfigs(actor, { overwrite = false } = {}) {
	const { configs, corpusById } = await loadData();
	return planConfigApplication({ actorName: actor.name, items: actor.items.map((i) => ({ id: i.id, type: i.type, name: i.name, system: { description: i.system.description, execution: i.system.execution, activation: i.system.activation } })), configs, corpusById, overwrite });
}

/** Aplica após confirmação do Mestre. Devolve { applied, skipped, cancelled }. */
export async function applyThreatAbilityConfigs(actor, { overwrite = false, confirm = true } = {}) {
	if (!game.user.isGM) { ui.notifications.warn(game.i18n.localize("op.threatConfig.gmOnly")); return { cancelled: true, applied: 0, skipped: 0 }; }
	const plan = await previewThreatAbilityConfigs(actor, { overwrite });
	const sum = summarizePlan(plan);
	if (!plan.matched) { ui.notifications.info(game.i18n.format("op.threatConfig.unknown", { name: actor.name })); return { cancelled: true, applied: 0, skipped: sum.skipped }; }
	const { icons: iconMap } = await loadData();
	const pendingIcons = planIconApplication(plan.rows, actor.items.map((i) => ({ id: i.id, img: i.img })), iconMap);
	if (!sum.apply && !pendingIcons.length) { ui.notifications.info(game.i18n.localize("op.threatConfig.nothing")); return { cancelled: false, applied: 0, skipped: sum.skipped }; }
	if (confirm) {
		const list = plan.rows.filter((r) => r.action === "apply").map((r) => `<li>${foundry.utils.escapeHTML(r.name)} (${r.state})${r.reviewActivation ? ` — ${game.i18n.localize("op.threatConfig.reviewActivation")}` : ""}</li>`).join("");
		const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: game.i18n.localize("op.threatConfig.title") }, content: `<p>${game.i18n.format("op.threatConfig.confirm", { name: actor.name, n: sum.apply })}</p><ul>${list}</ul>`, rejectClose: false });
		if (!ok) return { cancelled: true, applied: 0, skipped: sum.skipped };
	}
	const { configs } = await loadData();
	const updates = plan.rows.filter((r) => r.action === "apply").map((r) => ({ _id: r.itemId, "system.==execution": foundry.utils.deepClone(configs.find((c) => c.id === r.configId).execution) }));
	const { icons } = await loadData();
	const iconUpdates = planIconApplication(plan.rows, actor.items.map((i) => ({ id: i.id, img: i.img })), icons);
	const byId = new Map(updates.map((u) => [u._id, u]));
	for (const u of iconUpdates) { if (byId.has(u._id)) byId.get(u._id).img = u.img; else updates.push(u); }
	await actor.updateEmbeddedDocuments("Item", updates);
	return { cancelled: false, applied: plan.rows.filter((r) => r.action === "apply").length, icons: iconUpdates.length, skipped: sum.skipped };
}
