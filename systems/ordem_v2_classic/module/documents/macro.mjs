/* eslint-disable indent */
/**
 * Attempt to create a macro from the dropped data. Will use an existing macro if one exists.
 * @param {object} dropData     The dropped data
 * @param {number} slot         The hotbar slot to use
 */
export async function createOPMacro(dropData, slot) {
	const macroData = { type: "script", scope: "actor" };
	switch (dropData.type) {
		case "Item": {
			const itemData = await Item.implementation.fromDropData(dropData);
			if (!itemData) return ui.notifications.warn(game.i18n.localize("MACRO.opUnownedWarn"));
			foundry.utils.mergeObject(macroData, {
				name: itemData.name,
				img: itemData.img,
				command: `ordemparanormal.documents.macro.rollItem('${itemData.name}')`,
				flags: { "ordem_v2_classic.itemMacro": true },
			});
			break;
		}
		case "ActiveEffect": {
			const effectData = await ActiveEffect.implementation.fromDropData(dropData);
			if (!effectData) return ui.notifications.warn(game.i18n.localize("MACRO.opUnownedWarn"));
			foundry.utils.mergeObject(macroData, {
				name: effectData.name,
				img: effectData.icon,
				command: `ordemparanormal.documents.macro.toggleEffect('${effectData.name}')`,
				flags: { "ordem_v2_classic.effectMacro": true },
			});
			break;
		}
		default:
			return;
	}

	// Assign the macro to the hotbar
	const macro =
		game.macros.find((m) => {
			return m.name === macroData.name && m.command === macroData.command && m.isAuthor;
		}) || (await Macro.create(macroData));
	game.user.assignHotbarMacro(macro, slot);
}

/* -------------------------------------------- */

/**
 * Find a document of the specified name and type on an assigned or selected actor.
 * @param {string} name          Document name to locate.
 * @param {string} documentType  Type of embedded document (e.g. "Item" or "ActiveEffect").
 * @returns {Document}           Document if found, otherwise nothing.
 */
function getMacroTarget(name, documentType) {
	let actor;
	const speaker = ChatMessage.getSpeaker();
	if (speaker.token) actor = game.actors.tokens[speaker.token];
	actor ??= game.actors.get(speaker.actor);
	if (!actor) {
		ui.notifications.warn(game.i18n.localize("MACRO.opNoActorSelected"));
		return null;
	}

	const collection = documentType === "Item" ? actor.items : Array.from(actor.allApplicableEffects());

	// Find item in collection
	const documents = collection.filter((i) => i.name === name);
	const type = game.i18n.localize(`DOCUMENT.${documentType}`);
	if (documents.length === 0) {
		ui.notifications.warn(game.i18n.format("MACRO.opMissingTargetWarn", { actor: actor.name, type, name }));
		return null;
	}
	if (documents.length > 1) {
		ui.notifications.warn(game.i18n.format("MACRO.opMultipleTargetsWarn", { actor: actor.name, type, name }));
	}

	return documents[0];
}

/* -------------------------------------------- */

/**
 * Trigger an item to roll when a macro is clicked.
 * @param {string} itemName                Name of the item on the selected actor to trigger.
 * @returns {Promise<ChatMessage|object>}  Roll result.
 */
export async function rollItem(itemName) {
	const item = getMacroTarget(itemName, "Item");
	if (!item) return null;
	return useHotbarItem(item);
}

/**
 * Macros automáticas da barra (docs/arquivo/spec-hotbar-automatica.md, HB-24): usam o item pelo id do agente e do item,
 * então não dependem de seleção nem de nome único.
 * @param {string} actorId  Id do agente dono do item.
 * @param {string} itemId   Id do item.
 */
export async function rollItemById(actorId, itemId) {
	const actor = game.actors.get(actorId);
	const item = actor?.items.get(itemId);
	if (!item) {
		ui.notifications.warn(game.i18n.localize("op.hotbar.itemMissing"));
		return null;
	}
	if (!actor.isOwner) {
		ui.notifications.warn(game.i18n.format("op.hotbar.notOwner", { actor: actor.name }));
		return null;
	}
	return useHotbarItem(item);
}

async function useHotbarItem(item) {
	// Rituais da hotbar abrem o fluxo rápido de conjuração (docs/arquivo/spec-fluxo-conjuracao-rapida.md, FC-04)
	if (item.type === "ritual") {
		const { castRitualFast } = await import("../macros/ritual-cast-card.mjs");
		return castRitualFast(item.actor, item);
	}
	if (item.type === "generalEquipment") {
		const { itemUses, useParanormalItem } = await import("../helpers/paranormal-items.mjs");
		if (itemUses(item).length) return useParanormalItem(item);
	}
	return item.use();
}

/* -------------------------------------------- */

/**
 * Toggle an effect on and off when a macro is clicked.
 * @param {string} effectName        Name of the effect to be toggled.
 * @returns {Promise<ActiveEffect>}  The effect after it has been toggled.
 */
export function toggleEffect(effectName) {
	const effect = getMacroTarget(effectName, "ActiveEffect");
	return effect?.update({ disabled: !effect.disabled });
}
