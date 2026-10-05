/**
 * Tela de ataque: reúne as opções "ao usar" e os bônus já aplicados, abre a janela e paga o custo.
 * Regras puras em attack-options-rules.mjs; especificação em docs/spec-tela-de-ataque.md.
 */
import { appliesTo, combineSelection, specialAttackMax, weaponTags } from "./attack-options-rules.mjs";
import { activeConditions, attackConditionDetails, conditionDicePenalty } from "./conditions.mjs";
import { actionBlock, applyMode, canChooseAttribute, gripChoices, isMelee, rangeCheck, squaresBetween, weaponModes } from "./weapon-rules.mjs";

const SYSTEM = "ordem_v2_classic";
export const ON_USE_FLAG = "onUse";

const num = (v) => Number(v) || 0;
const signed = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/** Configuração "ao usar" de um efeito, ou null se o efeito não é uma opção de ataque. */
export function onUseOf(effect) {
	// O efeito "ao usar" fica desligado por padrão (não altera a ficha): `disabled` não o esconde da tela.
	const cfg = effect?.getFlag?.(SYSTEM, ON_USE_FLAG);
	return cfg?.enabled ? cfg : null;
}

function itemContributes(owner, weapon) {
	if (owner.id === weapon.id) return true;
	if (owner.type === "armament") return false;
	if (owner.type === "ability") return true;
	return owner.system?.using?.state !== false;
}

/** Descrição curta do que a opção faz (o texto do efeito, ou um resumo dos números). */
function summarize(u) {
	const parts = [];
	if (u.pool) parts.push(`+${num(u.unit) || 5} no ataque ou no dano, por acúmulo`);
	if (num(u.attackDice)) parts.push(`${signed(num(u.attackDice))} dado no ataque`);
	if (num(u.attackBonus)) parts.push(`${signed(num(u.attackBonus))} no ataque`);
	if (u.damageBonus !== undefined && u.damageBonus !== "" && u.damageBonus !== null && u.damageBonus !== 0) {
		const text = String(u.damageBonus);
		parts.push(`${/^[+\-−]/.test(text) ? text : `+${text}`} no dano`);
	}
	if (num(u.damageDice)) parts.push(`${signed(num(u.damageDice))} dado de dano`);
	return parts.join(", ");
}

/** Todas as opções de ataque que valem para esta arma, vindas da arma, dos outros itens e da ficha. */
export function collectOptions(item) {
	const actor = item.parent;
	if (!actor) return [];
	const tags = weaponTags(item.system);
	const nivel = actor.system?.nivel?.value ?? 1;
	const found = [];
	const consider = (effect, owner) => {
		const u = onUseOf(effect);
		if (!u || !appliesTo(u.applies, tags)) return;
		const max = u.pool && u.maxMode === "special" ? specialAttackMax(nivel) : Math.max(1, Math.trunc(num(u.max)) || 1);
		found.push({
			id: `${owner?.id ?? "actor"}-${effect.id}`,
			label: effect.name,
			description: effect.description ? String(effect.description).replace(/<[^>]+>/g, "") : "",
			summary: summarize(u),
			onUse: u,
			auto: Boolean(u.auto),
			max,
			stackable: !u.pool && max > 1,
			source: owner && owner.id !== item.id ? owner.name : null,
		});
	};
	for (const effect of item.effects) consider(effect, item);
	for (const owner of actor.items) {
		if (owner.id === item.id || !itemContributes(owner, item)) continue;
		for (const effect of owner.effects) consider(effect, owner);
	}
	for (const effect of actor.effects) consider(effect, null);
	return found;
}

/** Bônus que valem sem escolha: treinamento, efeitos de ficha na perícia/atributo do ataque, condições. */
const plain = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function passiveBuffs(item) {
	const actor = item.parent;
	const attack = item.system.formulas?.attack ?? {};
	const out = [];
	const skill = actor.system.skills?.[attack.skill];
	if (skill) {
		if (num(skill.degree?.value)) out.push({ description: "Grau de treinamento da perícia usada no ataque.", label: `Treinamento em ${game.i18n.localize(CONFIG.op?.skills?.[attack.skill] ?? attack.skill)}`, value: signed(num(skill.degree.value)) });
		if (num(skill.value)) out.push({ description: "Bônus fixo somado a esta perícia na ficha.", label: "Bônus da perícia", value: signed(num(skill.value)) });
	}
	const skillKey = `system.skills.${attack.skill}.mod`;
	const attrKey = `system.attributes.${attack.attr}.value`;
	for (const effect of actor.allApplicableEffects?.() ?? []) {
		if (effect.disabled || onUseOf(effect)) continue;
		for (const change of effect.changes ?? []) {
			if (change.key === skillKey || change.key === attrKey) {
				const value = num(change.value);
				if (value) out.push({ label: effect.name, value: change.key === attrKey ? `${signed(value)} dado` : signed(value), description: plain(effect.description) || plain(effect.parent?.system?.description?.value ?? effect.parent?.system?.description), source: effect.parent?.documentName === "Item" ? effect.parent.name : "" });
			}
		}
	}
	if (item.system.penalty) out.push({ label: "Arma", value: String(item.system.penalty), bad: true, description: "Penalidade da própria arma no teste de ataque." });
	return out;
}

const ON_USE_PACKS = [["fighterPowers", "Ataque Especial"], ["originPowers", "Mão Pesada"], ["originPowers", "Para Bellum"], ["survivalPowers", "Estágio 4 - Pancada Forte"]];
const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const onUseSource = new Map();

/**
 * Habilidades copiadas para a ficha antes de o compêndio ganhar a opção "ao usar" não trazem o efeito.
 * Antes de abrir a tela, completa a ficha com os efeitos "ao usar" do compêndio (uma vez por habilidade).
 */
export async function syncOnUseEffects(actor) {
	if (!actor?.isOwner) return;
	for (const item of actor.items) {
		if (item.type !== "ability") continue;
		const entry = ON_USE_PACKS.find(([, name]) => norm(name) === norm(item.name));
		if (!entry || item.effects.some((e) => onUseOf(e))) continue;
		if (!onUseSource.has(entry[1])) {
			const pack = game.packs.get(`${SYSTEM}.${entry[0]}`);
			const hit = (await pack?.getIndex())?.find((e) => norm(e.name) === norm(entry[1]));
			const doc = hit ? await pack.getDocument(hit._id) : null;
			onUseSource.set(entry[1], doc ? doc.effects.filter((e) => onUseOf(e)).map((e) => e.toObject()) : []);
		}
		const effects = onUseSource.get(entry[1]).map((e) => { const copy = foundry.utils.deepClone(e); delete copy._id; return copy; });
		if (effects.length) await item.createEmbeddedDocuments("ActiveEffect", effects);
	}
}

export const costResource = (actor) => (actor.usingWithoutSanityRule ? "PD" : "PE");

/** Configuração só com o que vale sem escolha (Shift+clique, macros, tela fechada por padrão). */
export function defaultSelection(item) {
	const options = collectOptions(item);
	return buildConfig(item, options, {});
}

const ATTR_NAMES = { str: "Força", dex: "Agilidade", vit: "Vigor", int: "Intelecto", pre: "Presença" };
const MODE_NAMES = { normal: "Ataque normal", burst: "Rajada (−1d20, +1 dado de dano)", throw: "Arremessar a arma", blow: "Coronhada (corpo a corpo)" };
const GRIP_NAMES = { light: "Leve", oneHand: "Uma mão", twoHands: "Duas mãos" };

/** Token de quem ataca e o alvo marcado (um só), ou nulos se não houver mapa/alvo. */
export function attackTokens(item) {
	const actor = item.parent;
	const mine = actor?.getActiveTokens?.() ?? [];
	const attacker = mine.find((t) => t.controlled) ?? mine[0] ?? null;
	const targets = [...(game.user?.targets ?? [])];
	return { attacker, target: targets.length === 1 ? targets[0] : null };
}

function squaresToTarget(item) {
	const { attacker, target } = attackTokens(item);
	if (!attacker || !target || attacker.scene?.id !== target.scene?.id) return { distance: null, target };
	const size = attacker.scene.grid.size;
	const box = (t) => ({ x: t.document.x, y: t.document.y, w: t.document.width * size, h: t.document.height * size });
	return { distance: squaresBetween(box(attacker), box(target), size), target };
}

/** Atributo padrão do ataque: em arma ágil corpo a corpo, o maior entre Força e Agilidade. */
export function defaultAttribute(item, mode = "normal") {
	const attr = item.system.formulas.attack.attr;
	if (!canChooseAttribute(item.system, mode)) return attr;
	const a = item.parent.system.attributes;
	return num(a.dex?.value) > num(a.str?.value) ? "dex" : "str";
}

/** O que a tela mostra sobre a arma: peculiaridades, modos, atributo, empunhadura e alvo. */
export function weaponContext(item, picked = {}) {
	const s = item.system;
	const modes = weaponModes(s, item.name);
	const mode = modes.includes(picked.mode) ? picked.mode : "normal";
	const grip = gripChoices(s, item.name);
	const attr = canChooseAttribute(s, mode) ? (picked.attr || defaultAttribute(item, mode)) : null;
	const chips = [];
	if (s.types?.gripType) chips.push(GRIP_NAMES[s.types.gripType] ?? s.types.gripType);
	if (s.conditions?.agile) chips.push("Ágil: usa Agilidade ou Força");
	if (s.conditions?.automatic) chips.push("Automática: aceita rajada");
	if (s.conditions?.throwable) chips.push("Arremessável");
	if (s.conditions?.pistolBlow) chips.push("Coronhada");
	if (grip.adaptable) chips.push("Empunhadura adaptável");
	if (s.range) chips.push(`Alcance ${s.range}`);
	if (s.critical) chips.push(`Crítico ${s.critical}`);
	return {
		chips,
		modes: modes.map((id) => ({ id, label: MODE_NAMES[id], checked: id === mode })),
		showModes: modes.length > 1,
		attrChoice: canChooseAttribute(s, mode) ? ["str", "dex"].map((id) => ({ id, label: `${ATTR_NAMES[id]} (${item.parent.system.attributes[id]?.value ?? 0})`, selected: id === attr })) : null,
		grips: grip.adaptable ? grip.options.map((id) => ({ id, label: GRIP_NAMES[id], selected: id === (picked.grip || grip.base) })) : null,
	};
}

export function buildConfig(item, options, selection = {}) {
	const combined = combineSelection(options, selection);
	const conditions = attackConditionDetails(item.parent);
	const mode = weaponModes(item.system, item.name).includes(selection.weapon?.mode) ? selection.weapon.mode : "normal";
	const reach = applyMode(item.system, mode);
	const attrPick = canChooseAttribute(item.system, mode) ? (selection.weapon?.attr || defaultAttribute(item, mode)) : null;
	const { distance, target } = squaresToTarget(item);
	const range = rangeCheck(reach, distance);
	const weaponLines = [];
	if (mode !== "normal") weaponLines.push(reach.label);
	if (attrPick && attrPick !== item.system.formulas.attack.attr) weaponLines.push(`ataque com ${ATTR_NAMES[attrPick]}`);
	if (range.state === "penalty") weaponLines.push("além do alcance (−1d20)");
	const grip = gripChoices(item.system, item.name);
	if (grip.adaptable && selection.weapon?.grip === "oneHand") weaponLines.push("empunhada com uma mão");
	const attrs = item.parent.system.attributes;
	const damageFlat = combined.damageFlat + combined.damageAttrs.reduce((sum, key) => sum + num(attrs[key]?.value), 0);
	return {
		attackDice: combined.attackDice + reach.attackDice + (range.state === "penalty" ? range.attackDice : 0),
		attackFlat: combined.attackFlat,
		attackTerms: combined.attackTerms,
		damageFlat,
		damageTerms: combined.damageTerms,
		damageDice: combined.damageDice + reach.damageDice,
		critMargin: combined.critMargin,
		cost: combined.cost,
		lines: [...weaponLines, ...combined.lines],
		conditions,
		used: combined.used,
		resource: costResource(item.parent),
		weapon: {
			mode,
			skill: reach.skill ?? null,
			attr: reach.attr ?? attrPick ?? null,
			damageFormula: reach.damageFormula ?? null,
			damageType: reach.damageType ?? null,
			damageAttr: reach.damageAttr ?? null,
			grip: selection.weapon?.grip || null,
		},
		range: { ...range, target: target?.name ?? null },
	};
}

/** Motivo para o ataque não poder acontecer (sem gastar nada), ou null. */
export function attackBlockReason(item, config) {
	const flags = activeConditions(item.parent).map((e) => e.getFlag(SYSTEM, "condition"));
	const stunned = actionBlock(flags);
	if (stunned) return stunned;
	const range = (config ?? defaultSelection(item)).range;
	if (range?.state === "blocked") return range.text;
	return null;
}

/** Paga o custo; devolve false (sem gastar) se não houver saldo. */
export async function payCost(actor, config) {
	if (!config?.cost) return true;
	const key = config.resource === "PD" ? "PD" : "PE";
	const current = num(actor.system[key]?.value);
	if (current < config.cost) {
		ui.notifications.warn(game.i18n.format("op.attackDialog.noBalance", { cost: config.cost, balance: current, resource: key }));
		return false;
	}
	await actor.update({ [`system.${key}.value`]: current - config.cost });
	return true;
}

const readSelection = (form) => {
	const fd = new foundry.applications.ux.FormDataExtended(form).object;
	const counts = {};
	for (const [name, value] of Object.entries(fd)) {
		let m = /^opt\.(.+)$/.exec(name);
		if (m) counts[m[1]] = typeof value === "boolean" ? (value ? 1 : 0) : Number(value) || 0;
		m = /^pool\.(.+)\.(attack|damage)$/.exec(name);
		if (m) (counts[m[1]] ??= {})[m[2]] = Number(value) || 0;
	}
	return { counts, freeAttack: fd.freeAttack ?? "", freeDamage: fd.freeDamage ?? "" };
};

/**
 * Abre a tela de ataque. Resolve com a configuração escolhida, ou null se o jogador cancelar
 * (ou se faltar PE). Com Shift+clique o chamador nem chega aqui.
 */
export async function promptAttackOptions(item) {
	const actor = item.parent;
	await syncOnUseEffects(actor).catch((err) => console.warn("Ordem Paranormal | Não foi possível completar as opções de ataque:", err));
	const options = collectOptions(item);
	const resource = costResource(actor);
	const balance = num(actor.system[resource]?.value);
	const autos = options.filter((o) => o.auto);
	const choices = options.filter((o) => !o.auto);
	const html = await foundry.applications.handlebars.renderTemplate("systems/ordem_v2_classic/templates/dialog/attack-options.hbs", {
		weapon: item.name,
		skillLine: `${game.i18n.localize(CONFIG.op?.skills?.[item.system.formulas.attack.skill] ?? item.system.formulas.attack.skill)} · ${item.system.critical || "—"}`,
		passive: passiveBuffs(item),
		conditions: attackConditionDetails(actor),
		canRemoveConditions: actor.isOwner,
		autos,
		toggles: choices.filter((o) => !o.onUse.pool && !o.stackable),
		stackables: choices.filter((o) => o.stackable),
		pools: choices.filter((o) => o.onUse.pool),
		hasChoices: choices.length > 0,
		resource,
		balance,
	});
	const config = await new Promise((resolve) => {
		let done = false;
		const finish = (value) => {
			if (done) return;
			done = true;
			resolve(value);
		};
		foundry.applications.api.DialogV2.wait({
			window: { title: game.i18n.format("op.attackDialog.title", { weapon: item.name }), icon: "fa-solid fa-crosshairs" },
			position: { width: 520 },
			classes: ["op-attack-dialog"],
			content: html,
			rejectClose: false,
			buttons: [
				{
					action: "attack",
					label: game.i18n.localize("op.attackDialog.attack"),
					icon: "fa-solid fa-bullseye",
					default: true,
					callback: (_event, button) => {
						const chosen = buildConfig(item, options, readSelection(button.form));
						finish(chosen);
						return chosen;
					},
				},
			],
			render: (_event, dialog) => {
				const form = dialog.element.querySelector("form");
				const total = dialog.element.querySelector("[data-total]");
				const left = dialog.element.querySelector("[data-left]");
				const conditionBlock = dialog.element.querySelector("[data-condition-block]");
				const conditionList = dialog.element.querySelector("[data-condition-list]");
				const refreshConditions = () => {
					const conditions = attackConditionDetails(actor);
					conditionBlock.hidden = conditions.length === 0;
					conditionList.replaceChildren();
					for (const condition of conditions) {
						const row = document.createElement("div");
						row.className = "op-ad-condition";
						const label = document.createElement("span");
						label.className = "op-ad-condition-label";
						label.textContent = condition.detail ? `${condition.name} · ${condition.detail}` : condition.name;
						if (condition.description) {
							const note = document.createElement("small");
							note.textContent = condition.description;
							label.append(note);
						}
						row.append(label);
						if (actor.isOwner) {
							const remove = document.createElement("button");
							remove.type = "button";
							remove.dataset.action = "remove-condition";
							remove.dataset.effectId = condition.id;
							remove.textContent = game.i18n.localize("op.attackDialog.removeCondition");
							row.append(remove);
						}
						conditionList.append(row);
					}
				};
				const refresh = () => {
					const chosen = buildConfig(item, options, readSelection(form));
					total.textContent = `${chosen.cost} ${resource}`;
					left.textContent = `${balance - chosen.cost}`;
					total.classList.toggle("is-short", chosen.cost > balance);
				};
				form.addEventListener("input", refresh);
				form.addEventListener("change", refresh);
				form.addEventListener("click", async (event) => {
					const button = event.target.closest('[data-action="remove-condition"]');
					if (!button || !actor.isOwner) return;
					event.preventDefault();
					const effect = actor.effects.get(button.dataset.effectId);
					if (!effect) return refreshConditions();
					button.disabled = true;
					try {
						await effect.delete();
						refreshConditions();
					} catch (error) {
						button.disabled = false;
						ui.notifications.warn(error.message ?? String(error));
					}
				});
				refreshConditions();
				refresh();
			},
			close: () => finish(null),
		}).catch(() => finish(null));
	});
	if (!config) return null;
	return (await payCost(actor, config)) ? config : null;
}

// O mestre completa, ao abrir o mundo, as fichas de agentes criadas antes das opções "ao usar" existirem.
Hooks.once("ready", () => {
	if (!game.user.isGM) return;
	(async () => {
		for (const actor of game.actors.filter((a) => a.type === "agent")) await syncOnUseEffects(actor);
	})().catch((err) => console.warn("Ordem Paranormal | Sincronização das opções de ataque falhou:", err));
});
