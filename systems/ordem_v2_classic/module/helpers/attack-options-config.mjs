/**
 * Seção "Opção de ataque" na janela de configuração do Efeito Ativo (aba Detalhes).
 * Grava em flags.ordem_v2_classic.onUse (ver docs/arquivo/spec-tela-de-ataque.md).
 */
const SYSTEM = "ordem_v2_classic";
const t = (key) => game.i18n.localize(`op.attackDialog.cfg.${key}`);

Hooks.on("renderActiveEffectConfig", (app, html) => {
	const root = html instanceof HTMLElement ? html : html?.[0];
	const section = root?.querySelector("section[data-tab='details']");
	if (!section || section.querySelector(".op-onuse-config")) return;
	const u = app.document.getFlag(SYSTEM, "onUse") ?? {};
	const field = (name, label, control) => `<div class="form-group"><label>${label}</label><div class="form-fields">${control}</div></div>`;
	const num = (name, value, step = 1) => `<input type="number" name="flags.${SYSTEM}.onUse.${name}" value="${value ?? ""}" step="${step}">`;
	const check = (name, value) => `<input type="checkbox" name="flags.${SYSTEM}.onUse.${name}" ${value ? "checked" : ""}>`;
	const applies = ["all", "melee", "ranged", "fire", "throw"]
		.map((v) => `<option value="${v}" ${(u.applies ?? "all") === v ? "selected" : ""}>${t(`applies.${v}`)}</option>`)
		.join("");
	const wrapper = document.createElement("fieldset");
	wrapper.className = "op-onuse-config";
	wrapper.innerHTML = `
		<legend>${t("legend")}</legend>
		<p class="hint">${t("hint")}</p>
		${field("enabled", t("enabled"), check("enabled", u.enabled))}
		${field("applies", t("appliesLabel"), `<select name="flags.${SYSTEM}.onUse.applies">${applies}</select>`)}
		${field("auto", t("auto"), check("auto", u.auto))}
		${field("cost", t("cost"), num("cost", u.cost))}
		${field("stepCost", t("stepCost"), num("stepCost", u.stepCost))}
		${field("max", t("max"), num("max", u.max))}
		${field("pool", t("pool"), check("pool", u.pool))}
		${field("maxMode", t("maxMode"), `<select name="flags.${SYSTEM}.onUse.maxMode"><option value="" ${!u.maxMode ? "selected" : ""}>${t("maxFixed")}</option><option value="special" ${u.maxMode === "special" ? "selected" : ""}>${t("maxSpecial")}</option></select>`)}
		${field("attackDice", t("attackDice"), num("attackDice", u.attackDice))}
		${field("attackBonus", t("attackBonus"), num("attackBonus", u.attackBonus))}
		${field("damageBonus", t("damageBonus"), `<input type="text" name="flags.${SYSTEM}.onUse.damageBonus" value="${u.damageBonus ?? ""}" placeholder="+2 · 1d6">`)}
		${field("damageDice", t("damageDice"), num("damageDice", u.damageDice))}`;
	section.appendChild(wrapper);
});
