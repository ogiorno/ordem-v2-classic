// Parte do Amaldiçoar Arma que fala com o Foundry: cria o buff ao conjurar, rola o dano do elemento,
// limpa no fim da cena e cria o efeito de Resistência à Fraqueza. As regras puras estão em weapon-curse.mjs.
// Especificação: docs/arquivo/spec-amaldicoar-arma.md

import { damageApplicationMode, requestCardDamage } from "./card-damage.mjs";
import {
	CURSE_ELEMENTS,
	CURSE_FORM_LABELS,
	SYSTEM_ID,
	WEAKNESS_TYPES,
	curseDamageFormula,
	curseEffectData,
	curseLink,
	curseOf,
	cursesForWeapon,
	cursesReplacedBy,
	hasWeaknessResist,
	labelOfDamageType,
	weaknessResistEffectData,
} from "./weapon-curse.mjs";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isRanged = (item) => item.system?.types?.rangeType?.name === "ranged";

/* -------------------------------------------- */
/*  Conjuração: cria o buff                     */
/* -------------------------------------------- */

/** Opções de ligação do alvo: cada arma corpo a corpo, o pacote de munição (armas à distância) ou qualquer arma. */
export function curseLinkOptions(actor) {
	const weapons = actor.items.filter((entry) => entry.type === "armament");
	const options = weapons
		.filter((entry) => !isRanged(entry))
		.map((entry) => ({ id: `weapon:${entry.id}`, label: `${entry.name} (corpo a corpo)`, link: curseLink("weapon", entry.id, entry.name) }));
	if (weapons.some(isRanged)) options.push({ id: "ammo", label: "Pacote de munição (armas à distância)", link: curseLink("ammo") });
	if (!options.length) options.push({ id: "any", label: "Qualquer arma", link: curseLink("any") });
	return options;
}

async function chooseCurseLink(actor, ritualName) {
	const options = curseLinkOptions(actor);
	if (options.length === 1) return options[0];
	const select = options.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`).join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: ritualName },
		content: `<div class="standard-form"><p>Em qual arma de ${escapeHtml(actor.name)} fica a maldição?</p><div class="form-group"><label>Arma</label><select name="link">${select}</select></div></div>`,
		ok: { label: "Amaldiçoar" },
		rejectClose: false,
		position: { width: 440 },
	}).catch(() => null);
	return options.find((entry) => entry.id === result?.link) ?? options[0];
}

/**
 * Cria o Efeito Ativo "Arma Amaldiçoada" nos alvos do ritual. Devolve as linhas para a carta do ritual.
 * @param {object} p
 * @param {Actor} p.caster
 * @param {Item} p.item          o ritual (o elemento vem dele)
 * @param {string} p.formId      "basic" | "student" | "true"
 * @param {Actor[]} p.targets    sem alvos, o próprio conjurador
 */
export async function applyWeaponCurse({ caster, item, formId, targets = [], linkId = null, silent = false }) {
	const element = item.system?.element;
	const lines = [];
	// efeitos criados, para o botão "Trocar alvo" da carta do ritual (docs/arquivo/spec-fluxo-conjuracao-rapida.md, FC-90)
	const created = [];
	const recipients = targets.length ? targets : [caster];
	for (const actor of recipients) {
		const options = curseLinkOptions(actor);
		const choice = options.find((entry) => entry.id === linkId) ?? (silent ? options[0] : await chooseCurseLink(actor, item.name));
		const data = curseEffectData({
			element,
			form: formId,
			link: choice.link,
			casterName: caster.name,
			casterUuid: caster.uuid,
			itemUuid: item.uuid,
			sceneId: canvas.scene?.id ?? null,
		});
		if (!data) {
			lines.push(`${actor.name}: elemento ou forma sem Amaldiçoar Arma (${element}/${formId}).`);
			continue;
		}
		const old = cursesReplacedBy(actor.effects, choice.link).map((effect) => effect.id);
		if (old.length) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
		const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
		if (effect) created.push({ actorUuid: actor.uuid, effectId: effect.id, actorName: actor.name, linkId: choice.id, linkLabel: choice.label });
		lines.push(`${actor.name}: ${data.name} em ${choice.label} — +${data.flags[SYSTEM_ID].weaponCurse.formula} de ${CURSE_ELEMENTS[element].label} até o fim da cena.`);
	}
	lines.created = created;
	return lines;
}

/* -------------------------------------------- */
/*  Dano do elemento                            */
/* -------------------------------------------- */

/**
 * Rola o dano do elemento de cada maldição que vale para a arma, uma carta por maldição, separada do dano da arma.
 * Não dobra no crítico. Devolve as mensagens criadas.
 */
export async function rollWeaponCurseDamage(item, { hitResult = null, attackMessageId = null, attackIndex = null, attackTotal = null } = {}) {
	const actor = item.parent;
	if (!actor || item.type !== "armament") return [];
	const matches = cursesForWeapon(actor.effects, { id: item.id, ranged: isRanged(item) });
	const messages = [];
	for (const { curse, effect } of matches) {
		// o buff foi usado: a carta do ritual deixa de oferecer "Trocar alvo" ao jogador (FC-93)
		if (!effect.getFlag?.(SYSTEM_ID, "used")) await effect.setFlag?.(SYSTEM_ID, "used", true).catch?.(() => {});
		const roll = await new Roll(curseDamageFormula(curse)).evaluate();
		let targetName = null;
		if (hitResult?.actorUuid) {
			try {
				targetName = fromUuidSync(hitResult.actorUuid)?.name ?? null;
			} catch {
				targetName = null;
			}
		}
		const label = `Amaldiçoar Arma — ${CURSE_FORM_LABELS[curse.form]} · ${CURSE_ELEMENTS[curse.element].label}`;
		const flags = { [SYSTEM_ID]: { weaponCurseDamage: { element: curse.element, form: curse.form, weapon: item.name } } };
		if (hitResult?.actorUuid) {
			flags[SYSTEM_ID].damageTarget = { actorUuid: hitResult.actorUuid, targetName, damageType: curse.damageType, attackMessageId };
			flags[SYSTEM_ID].damageInfo = { formula: curse.formula, isCritical: false, multiplier: 1, weapon: `${item.name} (${label})` };
		}
		const message = await roll.toMessage(
			{
				speaker: ChatMessage.getSpeaker({ actor }),
				flavor: `${label}: +${curse.formula} de ${labelOfDamageType(curse.damageType)} (${item.name})${attackIndex ? ` (${attackIndex}/${attackTotal})` : ""}${targetName ? ` → ${targetName}` : ""}`,
				flags,
			},
			{ rollMode: game.settings.get("core", "rollMode") }
		);
		messages.push(message);
		if (message && flags[SYSTEM_ID].damageTarget && damageApplicationMode() === "auto" && hitResult?.hit === true && hitResult?.revealed !== false) {
			requestCardDamage(message).catch((err) => console.error("Ordem Paranormal | aplicação automática do dano amaldiçoado falhou", err));
		}
	}
	return messages;
}

/* -------------------------------------------- */
/*  Fim da cena                                 */
/* -------------------------------------------- */

export async function removeCurses(actor, { keepScene = null } = {}) {
	const ids = [];
	for (const effect of actor?.effects ?? []) {
		const curse = effect.flags?.[SYSTEM_ID]?.weaponCurse;
		if (!curse) continue;
		if (keepScene && (!curse.sceneId || curse.sceneId === keepScene)) continue;
		ids.push(effect.id);
	}
	if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
	return ids.length;
}

/** Liga a limpeza: fim do combate e troca da cena ativa. Roda só no primeiro Mestre ativo. */
export function registerWeaponCurseHooks() {
	const isFirstGM = () => game.users.find((user) => user.isGM && user.active)?.id === game.user.id;
	Hooks.on("deleteCombat", async (combat) => {
		if (!isFirstGM()) return;
		for (const combatant of combat.combatants ?? []) await removeCurses(combatant.actor).catch(() => {});
	});
	Hooks.on("canvasReady", async () => {
		if (!isFirstGM() || !canvas.scene) return;
		const actors = new Set(game.actors.contents);
		for (const token of canvas.tokens?.placeables ?? []) if (token.actor) actors.add(token.actor);
		for (const actor of actors) await removeCurses(actor, { keepScene: canvas.scene.id }).catch(() => {});
	});
}

/* -------------------------------------------- */
/*  Resistência à Fraqueza                      */
/* -------------------------------------------- */

/** Abre a escolha do elemento e cria o efeito "Resistência à Fraqueza (Elemento)" na ficha. */
export async function promptWeaknessResist(actor) {
	if (!actor) return null;
	const select = WEAKNESS_TYPES.map((type) => `<option value="${type}">${escapeHtml(labelOfDamageType(type))}</option>`).join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: "Resistência à Fraqueza" },
		content: `<div class="standard-form"><p>${escapeHtml(actor.name)} não sofrerá o dobro do dano deste elemento, mesmo com vulnerabilidade a ele.</p><div class="form-group"><label>Elemento</label><select name="type">${select}</select></div></div>`,
		ok: { label: "Criar efeito" },
		rejectClose: false,
		position: { width: 440 },
	}).catch(() => null);
	if (!result?.type) return null;
	return createWeaknessResist(actor, result.type);
}

/** Cria o efeito (sem duplicar o mesmo tipo). */
export async function createWeaknessResist(actor, damageType) {
	const data = weaknessResistEffectData(damageType, { origin: actor.uuid });
	if (!data) return null;
	if (hasWeaknessResist([...actor.effects].filter((effect) => !effect.disabled), damageType)) {
		ui.notifications.info(`${actor.name} já tem ${data.name}.`);
		return null;
	}
	const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
	return effect;
}

export { curseOf };
