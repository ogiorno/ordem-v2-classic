/**
 * Tela de ataque: reúne as opções "ao usar" e os bônus já aplicados, abre a janela e paga o custo.
 * Regras puras em attack-options-rules.mjs; especificação em docs/arquivo/spec-tela-de-ataque.md.
 */
import { combineSelection, optionCost, poolCap, poolChoices, poolState, scaleOnUse, specialAttackMax, weaponMatches, weaponTags } from "./attack-options-rules.mjs";
import { activeConditions, attackConditionDetails, conditionDicePenalty } from "./conditions.mjs";
import { powerEffectData, powerEffectFor } from "./attack-power-effects.mjs";
import { areaKind, BAZOOKA_RADIUS_SQUARES } from "./weapon-area.mjs";
import { pickAreaPoint } from "./weapon-area-visual.mjs";
import { actionBlock, applyMode, canChooseAttribute, consumesReload, effectiveGrip, gripChoices, rangeCheck, squaresBetween, weaponModes, weaponRules } from "./weapon-rules.mjs";

const SYSTEM = "ordem-v2-classic";
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
	// Potência Máxima (Guerreiro, NEX 99%): com arma corpo a corpo, os bônus do Ataque Especial valem o dobro
	const doubled = actor.items.some((i) => i.type === "ability" && norm(i.name).endsWith("potenciamaxima"));
	const consider = (effect, owner) => {
		const raw = onUseOf(effect);
		if (!raw || !weaponMatches(raw, item.system)) return;
		const u = scaleOnUse(raw, { nivel, doubleUnit: doubled && tags.has("melee") });
		const abilityMax = u.pool && u.maxMode === "special" ? specialAttackMax(nivel) : Math.max(1, Math.trunc(num(u.max)) || 1);
		// opção de bônus: também não passa do limite de PE por turno do agente
		const perTurn = num(actor.system?.[costResource(actor)]?.perRound);
		const cap = u.pool ? poolCap(u, abilityMax, perTurn) : null;
		const max = cap ? cap.max : abilityMax;
		found.push({
			id: `${owner?.id ?? "actor"}-${effect.id}`,
			label: effect.name,
			description: effect.description ? String(effect.description).replace(/<[^>]+>/g, "") : "",
			summary: summarize(u),
			onUse: u,
			auto: Boolean(u.auto),
			max,
			abilityMax,
			perTurn,
			limit: cap?.limit ?? "ability",
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
const syncLocks = new Map();
export function syncOnUseEffects(actor) {
	if (!actor?.isOwner) return Promise.resolve();
	// uma sincronização por vez por ficha: vários poderes novos juntos não duplicam o efeito
	const next = (syncLocks.get(actor.id) ?? Promise.resolve()).then(() => syncOnUseEffectsNow(actor)).catch((err) => console.warn("Ordem Paranormal | sincronização das opções de ataque:", err));
	syncLocks.set(actor.id, next);
	return next;
}

async function syncOnUseEffectsNow(actor) {
	for (const item of actor.items) {
		if (item.type !== "ability") continue;
		// efeitos "ao usar" repetidos (a ficha pode ter criado o mesmo duas vezes): fica um só por nome
		const seen = new Set();
		const repeated = item.effects.filter((e) => onUseOf(e)).filter((e) => (seen.has(e.name) ? true : (seen.add(e.name), false)));
		if (repeated.length) await item.deleteEmbeddedDocuments("ActiveEffect", repeated.map((e) => e.id));
		const registered = powerEffectFor(item.name);
		if (registered) {
			if (!item.effects.some((e) => onUseOf(e))) await item.createEmbeddedDocuments("ActiveEffect", [powerEffectData(item.name, registered)]);
			continue;
		}
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
const MODE_NAMES = { normal: "Ataque normal", burst: "Rajada", throw: "Arremessar a arma", blow: "Coronhada", point: "Disparar num ponto" };
const modeDescription = (id, melee) => ({
	normal: melee ? "Faz um ataque corpo a corpo com a arma." : "Faz um ataque à distância com a arma.",
	burst: "Dispara em rajada: −1d20 no ataque e +1 dado de dano.",
	throw: "Realiza um ataque à distância arremessando a arma.",
	blow: "Ataca corpo a corpo com a coronha da arma.",
	point: "Dispara num ponto do mapa, sem teste de ataque, com raio de 3 m.",
}[id] ?? "");
const GRIP_NAMES = { light: "Leve", oneHand: "Uma mão", twoHands: "Duas mãos" };

/** Token de quem ataca e o alvo marcado (um só), ou nulos se não houver mapa/alvo. */
export function attackTokens(item) {
	const actor = item.parent;
	const mine = actor?.getActiveTokens?.() ?? [];
	const attacker = mine.find((t) => t.controlled) ?? mine[0] ?? null;
	const targets = [...(game.user?.targets ?? [])];
	return { attacker, target: targets.length === 1 ? targets[0] : null };
}

function squaresToTarget(item, areaPoint = null) {
	const { attacker, target } = attackTokens(item);
	const size = attacker?.scene?.grid?.size;
	const box = (t) => ({ x: t.document.x, y: t.document.y, w: t.document.width * size, h: t.document.height * size });
	// Disparo num ponto com a área escolhida no mapa: a distância é até o ponto, não até um alvo
	if (areaPoint) {
		if (!attacker || attacker.scene?.id !== areaPoint.sceneId) return { distance: null, target: null, area: true };
		return { distance: squaresBetween(box(attacker), { x: areaPoint.x, y: areaPoint.y, w: 0, h: 0 }, size), target: null, area: true };
	}
	if (!attacker || !target || attacker.scene?.id !== target.scene?.id) return { distance: null, target };
	return { distance: squaresBetween(box(attacker), box(target), size), target };
}

/** Atributo padrão do ataque: em arma ágil corpo a corpo, o maior entre Força e Agilidade. */
export function defaultAttribute(item, mode = "normal") {
	const attr = item.system.formulas.attack.attr;
	if (!canChooseAttribute(item.system, mode)) return attr;
	const a = item.parent.system.attributes;
	return num(a.dex?.value) > num(a.str?.value) ? "dex" : "str";
}

/** Dados da ficha e da tela que as regras próprias da arma consultam (Força, graus de Luta e Pontaria, distância, caixas marcadas). */
function ruleContext(item, mode, pick = {}, distance = null) {
	const sys = item.parent.system;
	return {
		mode,
		grip: pick.grip || "",
		str: num(sys.attributes?.str?.value),
		fightingDegree: num(sys.skills?.fighting?.degree?.value),
		aimDegree: num(sys.skills?.aim?.degree?.value),
		distance,
		picked: { tripod: Boolean(pick.tripod), aimed: Boolean(pick.aimed), far: Boolean(pick.far), maneuver: Boolean(pick.maneuver), reloaded: Boolean(pick.reloaded) },
		reload: { pending: Boolean(item.getFlag?.(SYSTEM, "reload")?.pending) },
	};
}

/** O que a tela mostra sobre a arma: peculiaridades, modos, atributo, empunhadura e alvo. */
export function weaponContext(item, picked = {}) {
	const s = item.system;
	const modes = weaponModes(s, item.name);
	const mode = modes.includes(picked.mode) ? picked.mode : "normal";
	const fightingDegree = num(item.parent.system.skills?.fighting?.degree?.value);
	const grip = gripChoices(s, item.name, { fightingDegree });
	const attr = canChooseAttribute(s, mode) ? (picked.attr || defaultAttribute(item, mode)) : null;
	const rules = weaponRules(s, item.name, ruleContext(item, "normal", {}, squaresToTarget(item).distance));
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
		modes: modes.map((id) => ({ id, label: MODE_NAMES[id], desc: modeDescription(id, s.types?.rangeType?.name === "melee"), checked: id === mode })),
		showModes: modes.length > 1,
		attrChoice: canChooseAttribute(s, mode) ? ["str", "dex"].map((id) => ({ id, label: `${ATTR_NAMES[id]} (${item.parent.system.attributes[id]?.value ?? 0})`, selected: id === attr })) : null,
		grips: grip.adaptable ? grip.options.map((id) => ({ id, label: GRIP_NAMES[id], selected: id === (picked.grip || grip.base), disabled: grip.locked.includes(id) })) : null,
		rules: rules.notes,
		ruleChoices: rules.choices,
	};
}

export function buildConfig(item, options, selection = {}) {
	const combined = combineSelection(options, selection);
	const conditions = attackConditionDetails(item.parent);
	const mode = weaponModes(item.system, item.name).includes(selection.weapon?.mode) ? selection.weapon.mode : "normal";
	const reach = applyMode(item.system, mode);
	const attrPick = canChooseAttribute(item.system, mode) ? (selection.weapon?.attr || defaultAttribute(item, mode)) : null;
	const areaPoint = mode === "point" ? selection.weapon?.areaPoint ?? null : null;
	const { distance, target } = squaresToTarget(item, areaPoint);
	const range = rangeCheck(reach, distance);
	if (areaPoint) range.text = range.text.replace(/^Alvo/, "Área");
	const weaponLines = [];
	if (mode !== "normal") weaponLines.push(reach.label);
	if (attrPick && attrPick !== item.system.formulas.attack.attr) weaponLines.push(`ataque com ${ATTR_NAMES[attrPick]}`);
	if (range.state === "penalty") weaponLines.push("além do alcance (−1d20)");
	const pick = selection.weapon ?? {};
	const rules = weaponRules(item.system, item.name, ruleContext(item, mode, pick, distance));
	if (gripChoices(item.system, item.name).adaptable && mode === "normal" && pick.grip && !rules.lines.some((l) => /mão|mãos/.test(l))) weaponLines.push(pick.grip === "oneHand" ? "empunhada com uma mão" : "empunhada com duas mãos");
	weaponLines.push(...rules.lines);
	const attrs = item.parent.system.attributes;
	const damageFlat = combined.damageFlat + combined.damageAttrs.reduce((sum, key) => sum + num(attrs[key]?.value), 0);
	return {
		attackDice: combined.attackDice + reach.attackDice + rules.attackDice + (range.state === "penalty" ? range.attackDice : 0),
		attackFlat: combined.attackFlat + rules.attackFlat,
		attackTerms: combined.attackTerms,
		damageFlat,
		damageTerms: combined.damageTerms,
		damageDice: combined.damageDice + reach.damageDice,
		critMargin: combined.critMargin + rules.critMargin,
		cost: combined.cost,
		lines: [...weaponLines, ...combined.lines],
		conditions,
		used: combined.used,
		resource: costResource(item.parent),
		weapon: {
			mode,
			skill: reach.skill ?? null,
			attr: reach.attr ?? attrPick ?? null,
			damageFormula: reach.damageFormula ?? rules.damageFormula ?? null,
				explode: rules.explode,
				halve: rules.halve,
				noRoll: Boolean(reach.noRoll),
				area: areaKind(item.name),
				areaPoint,
				block: rules.block,
				rules: { notes: rules.notes, choices: rules.choices },
			damageType: reach.damageType ?? null,
			damageAttr: reach.damageAttr ?? null,
			grip: pick.grip || null,
		},
		range: { ...range, target: areaPoint ? "área escolhida" : (target?.name ?? null), meters: distance === null || distance === undefined ? null : Math.round(distance * 1.5 * 10) / 10 },
	};
}

/** Motivo para o ataque não poder acontecer (sem gastar nada), ou null. */
export function attackBlockReason(item, config) {
	const flags = activeConditions(item.parent).map((e) => e.getFlag(SYSTEM, "condition"));
	const stunned = actionBlock(flags);
	if (stunned) return stunned;
	const chosen = config ?? defaultSelection(item);
	if (chosen.weapon?.block) return chosen.weapon.block;
	if (chosen.weapon?.noRoll && !chosen.range?.target) return "Escolha a área no mapa (botão) ou marque o alvo que define o ponto do disparo.";
	const range = chosen.range;
	if (range?.state === "blocked") return `O alvo está muito longe. ${range.text}`;
	return null;
}

/** Depois de um disparo de arma que recarrega (Balestra, Besta, Bazuca), deixa a recarga pendente para o próximo ataque. */
export async function markReload(item, config) {
	if (!item.parent || !consumesReload(item.name, config?.weapon?.mode ?? "normal")) return;
	await item.setFlag(SYSTEM, "reload", { pending: true });
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

const readSelection = (form, areaPoint = null) => {
	const fd = new foundry.applications.ux.FormDataExtended(form).object;
	const counts = {};
	for (const [name, value] of Object.entries(fd)) {
		let m = /^opt\.(.+)$/.exec(name);
		if (m) counts[m[1]] = typeof value === "boolean" ? (value ? 1 : 0) : Number(value) || 0;
		m = /^pool\.(.+)\.(attack|damage)$/.exec(name);
		if (m) (counts[m[1]] ??= {})[m[2]] = Number(value) || 0;
	}
	return { counts, freeAttack: fd.freeAttack ?? "", freeDamage: fd.freeDamage ?? "", weapon: { mode: fd.weaponMode || "normal", attr: fd.weaponAttr || "", grip: fd.weaponGrip || "", tripod: Boolean(fd.ruleTripod), aimed: Boolean(fd.ruleAim), far: Boolean(fd.ruleFar), maneuver: Boolean(fd.ruleManeuver), reloaded: Boolean(fd.ruleReload), areaPoint } };
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
	const html = await foundry.applications.handlebars.renderTemplate("systems/ordem-v2-classic/templates/dialog/attack-options.hbs", {
		weapon: item.name,
		skillLine: `${game.i18n.localize(CONFIG.op?.skills?.[item.system.formulas.attack.skill] ?? item.system.formulas.attack.skill)} · ${item.system.critical || "—"}`,
		passive: passiveBuffs(item),
		weapon: weaponContext(item),
		conditions: attackConditionDetails(actor),
		canRemoveConditions: actor.isOwner,
		autos,
		toggles: choices.filter((o) => !o.onUse.pool && !o.stackable),
		stackables: choices.filter((o) => o.stackable),
		pools: choices.filter((o) => o.onUse.pool).map((o) => ({ ...o, choices: poolChoices(o.onUse.unit, o.max) })),
		hasChoices: choices.length > 0,
		resource,
		balance,
	});
	let areaPoint = null; // centro da área escolhido no mapa (disparo num ponto)
	const config = await new Promise((resolve) => {
		let done = false;
		const finish = (value) => {
			if (done) return;
			done = true;
			resolve(value);
		};
		foundry.applications.api.DialogV2.wait({
			window: { title: game.i18n.format("op.attackDialog.title", { weapon: item.name }), icon: "fa-solid fa-crosshairs" },
			position: { width: 860 },
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
						const chosen = buildConfig(item, options, readSelection(button.form, areaPoint));
						finish(chosen);
						return chosen;
					},
				},
			],
			render: (_event, dialog) => {
				const form = dialog.element.querySelector("form");
				// Duas colunas: o botao Atacar desce para o fim da coluna da direita e o subtitulo vai para o cabecalho
				const slot = dialog.element.querySelector("[data-attack-slot]");
				const footer = dialog.element.querySelector(".form-footer");
				if (slot && footer) slot.append(footer);
				const sub = dialog.element.querySelector(".op-ad-sub");
				const titleEl = dialog.element.querySelector(".window-title");
				if (sub && titleEl && !titleEl.querySelector(".op-ad-title-sub")) {
					const small = document.createElement("small");
					small.className = "op-ad-title-sub";
					small.textContent = sub.textContent;
					titleEl.append(small);
					sub.hidden = true;
				}
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
				const attackButton = dialog.element.querySelector("button[data-action=attack]");
				let blockReason = null;
				const areaRow = dialog.element.querySelector("[data-area-row]");
				const areaNote = dialog.element.querySelector("[data-area-note]");
				const areaButton = dialog.element.querySelector("[data-action=pick-area]");
				areaButton?.addEventListener("click", async () => {
					dialog.element.style.visibility = "hidden";
					try {
						const picked = await pickAreaPoint({ radiusSquares: BAZOOKA_RADIUS_SQUARES });
						if (picked) areaPoint = picked;
					} finally {
						dialog.element.style.visibility = "";
					}
					form.dispatchEvent(new Event("change", { bubbles: true }));
				});
				attackButton?.addEventListener("click", (event) => {
					if (!blockReason) return;
					event.preventDefault();
					event.stopImmediatePropagation();
					ui.notifications.warn(blockReason);
				}, true);
				const rangeNote = dialog.element.querySelector("[data-range-note]");
				const attrRow = dialog.element.querySelector("[data-attr-row]");
				const rulesList = dialog.element.querySelector("[data-rules]");
				const refreshPools = () => {
					for (const row of dialog.element.querySelectorAll("[data-pool]")) {
						const option = options.find((o) => o.id === row.dataset.pool);
						const attack = row.querySelector('select[name$=".attack"]');
						const damage = row.querySelector('select[name$=".damage"]');
						const state = poolState({ max: row.dataset.max, limit: row.dataset.limit, attack: attack.value, damage: damage.value });
						for (const [select, room] of [[attack, state.attackRoom], [damage, state.damageRoom]]) {
							for (const opt of select.options) opt.disabled = Number(opt.value) > room;
						}
						const flag = row.querySelector("[data-pool-flag]");
						flag.hidden = !state.flag;
						flag.dataset.limit = state.flag?.key ?? "";
						flag.textContent = state.flag ? game.i18n.format(`op.attackDialog.max.${state.flag.key}`, { max: state.flag.max, ability: row.dataset.abilityMax, perTurn: row.dataset.perTurn, resource }) : "";
						row.querySelector("[data-pool-cost]").textContent = `${option ? optionCost(option.onUse, state.total) : 0} ${resource}`;
					}
				};
				const refresh = () => {
					refreshPools();
					const picked = readSelection(form, areaPoint);
					const chosen = buildConfig(item, options, picked);
					if (areaRow) {
						areaRow.hidden = chosen.weapon.mode !== "point";
						if (areaNote) areaNote.textContent = areaPoint ? `Área escolhida: coluna ${Math.floor(areaPoint.x / canvas.grid.size) + 1}, linha ${Math.floor(areaPoint.y / canvas.grid.size) + 1}` : "Nenhuma área escolhida (sem ela, vale a posição do alvo marcado).";
						if (areaButton) areaButton.lastChild.textContent = areaPoint ? " Mudar a área" : " Escolher área no mapa";
					}
					if (attrRow) attrRow.hidden = !canChooseAttribute(item.system, chosen.weapon.mode);
					if (rulesList) {
						const live = new Set(chosen.weapon.rules.choices.map((c) => c.id));
						for (const row of dialog.element.querySelectorAll("[data-rule-choice]")) row.hidden = !live.has(row.dataset.ruleChoice);
						rulesList.replaceChildren(...chosen.weapon.rules.notes.map((note) => {
							const row = document.createElement("div");
							row.className = `op-ad-applied-row is-${note.state}`;
							row.textContent = note.text;
							return row;
						}));
						rulesList.hidden = chosen.weapon.rules.notes.length === 0;
					}
					const reason = attackBlockReason(item, chosen);
					const rangeBlocked = chosen.range.state === "blocked";
					const targetName = dialog.element.querySelector("[data-target-name]");
					if (targetName) {
						targetName.textContent = chosen.range.target ?? "Nenhum alvo marcado";
						dialog.element.querySelector("[data-target-dist]").textContent = chosen.range.meters !== null && chosen.range.meters !== undefined ? `${String(chosen.range.meters).replace(".", ",")} m` : "";
					}
					if (rangeNote) {
						const title = reason ? (rangeBlocked ? "Alvo fora do alcance" : "Ataque impedido") : chosen.range.state === "penalty" ? "Além do alcance" : chosen.range.state === "ok" ? "Dentro do alcance" : "";
						const detail = reason ? reason.replace(/^O alvo está muito longe\.\s*/, "") : chosen.range.text;
						rangeNote.querySelector("[data-alert-title]").textContent = title;
						rangeNote.querySelector("[data-alert-text]").textContent = detail.replace(/(\d)\.(\d)/g, "$1,$2");
						rangeNote.classList.toggle("is-blocked", Boolean(reason));
						rangeNote.classList.toggle("is-penalty", !reason && chosen.range.state === "penalty");
						rangeNote.classList.toggle("is-ok", !reason && chosen.range.state === "ok");
						rangeNote.querySelector("i").className = `fa-solid ${reason ? "fa-triangle-exclamation" : chosen.range.state === "ok" ? "fa-circle-check" : "fa-circle-info"}`;
						rangeNote.hidden = !title && !detail;
					}
					// O botão fica ativo: clicar com o ataque barrado avisa o motivo num aviso em vez de não fazer nada.
					blockReason = reason;
					if (attackButton) {
						attackButton.classList.toggle("is-blocked", Boolean(reason));
						const label = reason ? `Atacar — ${rangeBlocked ? "alvo fora do alcance" : "ataque impedido"}` : game.i18n.localize("op.attackDialog.attack");
						attackButton.replaceChildren(Object.assign(document.createElement("i"), { className: `fa-solid ${reason ? "fa-ban" : "fa-bullseye"}` }), ` ${label}`);
					}
					// Resumo do ataque: teste, dano, empunhadura
					{
						const attrKey = chosen.weapon.attr ?? item.system.formulas.attack.attr;
						const skillKey = chosen.weapon.skill ?? item.system.formulas.attack.skill;
						const skill = game.i18n.localize(CONFIG.op?.skills?.[skillKey] ?? skillKey);
						const signed = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
						const extra = [chosen.attackFlat ? signed(chosen.attackFlat) : "", chosen.attackDice ? `${signed(chosen.attackDice)}d20` : ""].filter(Boolean).join(" ");
						dialog.element.querySelector("[data-sum-test]").textContent = `${ATTR_NAMES[attrKey] ?? attrKey} ${signed(num(actor.system.attributes?.[attrKey]?.value))} · ${skill}${extra ? ` ${extra}` : ""}`;
						const base = chosen.weapon.damageFormula ?? item.system.formulas.damage.formula ?? "—";
						const dmg = [base, chosen.damageDice ? `+ ${chosen.damageDice} ${chosen.damageDice === 1 ? "dado" : "dados"}` : "", ...chosen.damageTerms.map((t) => `${t}`.replace(/^\+/, "+ ")), chosen.damageFlat ? `+ ${chosen.damageFlat}` : ""].filter(Boolean).join(" ");
						dialog.element.querySelector("[data-sum-damage]").textContent = dmg;
						const gripKey = chosen.weapon.grip || item.system.types?.gripType;
						const gripRow = dialog.element.querySelector("[data-sum-grip-row]");
						if (gripRow) {
							gripRow.hidden = !gripKey;
							dialog.element.querySelector("[data-sum-grip]").textContent = GRIP_NAMES[gripKey] ?? gripKey ?? "";
						}
					}
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

// Poder novo na ficha: já ganha a opção "ao usar" (aparece na tela de ataque sem esperar o primeiro clique).
Hooks.on("createItem", (item) => {
	if (item.type !== "ability" || item.parent?.type !== "agent" || !item.parent.isOwner) return;
	// um instante depois da criação, quando a ficha já terminou de gravar o poder
	setTimeout(() => syncOnUseEffects(item.parent), 600);
});

// O mestre completa, ao abrir o mundo, as fichas de agentes criadas antes das opções "ao usar" existirem.
Hooks.once("ready", () => {
	if (!game.user.isGM) return;
	(async () => {
		for (const actor of game.actors.filter((a) => a.type === "agent")) await syncOnUseEffects(actor);
	})().catch((err) => console.warn("Ordem Paranormal | Sincronização das opções de ataque falhou:", err));
});
