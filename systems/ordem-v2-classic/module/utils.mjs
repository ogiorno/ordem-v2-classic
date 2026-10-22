// This code was taken from the DND5E System repository:
// https://github.com/foundryvtt/dnd5e/blob/5.1.x/module/utils.mjs
// This code is taken from DND5e under MIT license.

/* -------------------------------------------- */
/*  Keybindings Helper                          */
/* -------------------------------------------- */

const { MODIFIER_CODES: CODES, MODIFIER_KEYS } = foundry.helpers?.interaction?.KeyboardManager ?? KeyboardManager;

/**
 * Track which KeyboardEvent#code presses associate with each modifier.
 * Added support for treating Meta separate from Control.
 * @enum {string[]}
 */
const MODIFIER_CODES = {
	Alt: CODES.Alt,
	Control: CODES.Control.filter((k) => k.startsWith("Control")),
	Meta: CODES.Control.filter((k) => !k.startsWith("Control")),
	Shift: CODES.Shift,
};

/**
 * Based on the provided event, determine if the keys are pressed to fulfill the specified keybinding.
 * @param {Event} event    Triggering event.
 * @param {string} action  Keybinding action within the `dnd5e` namespace.
 * @returns {boolean}      Is the keybinding triggered?
 */
export function areKeysPressed(event, action) {
	if (!event) return false;
	const activeModifiers = {};
	const addModifiers = (key, pressed) => {
		activeModifiers[key] = pressed;
		MODIFIER_CODES[key].forEach((n) => (activeModifiers[n] = pressed));
	};
	addModifiers(MODIFIER_KEYS.ALT, event.altKey);
	addModifiers(MODIFIER_KEYS.CONTROL, event.ctrlKey);
	addModifiers("Meta", event.metaKey);
	addModifiers(MODIFIER_KEYS.SHIFT, event.shiftKey);
	return game.keybindings.get("ordem-v2-classic", action).some((b) => {
		if (game.keyboard.downKeys.has(b.key) && b.modifiers.every((m) => activeModifiers[m])) return true;
		if (b.modifiers.length) return false;
		return activeModifiers[b.key];
	});
}

/* -------------------------------------------- */
/*  Handlebars Template Helpers                 */
/* -------------------------------------------- */

/**
 * Define a set of template paths to pre-load. Pre-loaded templates are compiled and cached for fast access when
 * rendering. These paths will also be available as Handlebars partials by using the file name
 * @returns {Promise}
 */
export async function preloadHandlebarsTemplates() {
	const partials = [
		// Shared Partials
		"systems/ordem-v2-classic/templates/shared/effects.hbs",

		// Actor Sheet Partials
		"systems/ordem-v2-classic/templates/actor/parts/actor-abilities.hbs",
		"systems/ordem-v2-classic/templates/actor/parts/actor-inventory.hbs",
		"systems/ordem-v2-classic/templates/actor/parts/actor-rituals.hbs",
		"systems/ordem-v2-classic/templates/actor/parts/actor-skills.hbs",

		// Chat Message Partials
		"systems/ordem-v2-classic/templates/chat/item-card.hbs",
		"systems/ordem-v2-classic/templates/chat/dt-card.hbs",
		"systems/ordem-v2-classic/templates/chat/oposto-request.hbs",
		"systems/ordem-v2-classic/templates/chat/oposto-results.hbs",

		// Item Sheet Partials
		"systems/ordem-v2-classic/templates/item/item-header.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-ability-attributes.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-ability-execution.hbs",
		"systems/ordem-v2-classic/templates/apps/threat-ability-panel.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-armament-combat.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-armament-spec.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-description.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-general-attributes.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-protection-attributes.hbs",
		"systems/ordem-v2-classic/templates/item/parts/item-ritual-attributes.hbs",

		// Threat Sheet Partials
		"systems/ordem-v2-classic/templates/threat/parts/threat-test-chip.hbs",
		"systems/ordem-v2-classic/templates/threat/parts/threat-test-table.hbs",
		"systems/ordem-v2-classic/templates/threat/parts/threat-item-row.hbs",
	];

	const paths = {};
	for (const path of partials) {
		// Também disponível pelo caminho completo: {{> "systems/.../arquivo.hbs"}}
		paths[path] = path;
		paths[path.replace(".hbs", ".html")] = path;
		paths[`op.${path.split("/").pop().replace(".hbs", "")}`] = path;
	}

	return foundry.applications.handlebars.loadTemplates(paths);
}

/**
 * Resolve the actor a chat command should roll for.
 *
 * Lookup priority (chosen so /dt and /oposto "just work" when a player has a
 * single character):
 *   1. Currently controlled token on the canvas. When multiple tokens are
 *      controlled, prefer one the current user owns (deterministic) —
 *      falling back to the first only if none is owned.
 *   2. The user's bound character (`game.user.character`).
 *   3. (Players only) the first agent the user has OWNER permission on —
 *      typically their PC. Skipped for the GM, who owns every actor and
 *      would otherwise fall into a non-deterministic pick.
 * @returns {Actor|null}
 */
export function resolveChatCommandActor() {
	const controlled = canvas?.tokens?.controlled ?? [];
	if (controlled.length) {
		const ownedToken = controlled.find((t) => t.actor?.testUserPermission?.(game.user, "OWNER"));
		const tokenActor = (ownedToken ?? controlled[0])?.actor;
		if (tokenActor) return tokenActor;
	}

	const speaker = ChatMessage.getSpeaker();
	if (speaker?.actor) {
		const fromSpeaker = game.actors.get(speaker.actor);
		if (fromSpeaker) return fromSpeaker;
	}

	if (!game.user?.isGM) {
		const ownedAgent = game.actors.contents.find((a) => a.type === "agent" && a.testUserPermission?.(game.user, "OWNER"));
		if (ownedAgent) return ownedAgent;
	}

	return null;
}

/**
 * Authorize a socket payload that claims to be a roll on behalf of `data.actorId`
 * coming from the authenticated socket sender. The payload's `userId` is not
 * proof of identity because clients can change it.
 *
 * Pure: takes its dependencies via parameter so it can be unit-tested without
 * booting Foundry. The default uses the live `game` global.
 *
 * @param {{actorId?: string}} data
 * @param {{users: {get: (id: string) => any}, actors: {get: (id: string) => any}}} [deps]
 * @param {string} senderId  ID supplied by Foundry as the socket callback's second argument
 * @returns {boolean}
 */
export function isOpostoSenderAuthorized(data, deps, senderId) {
	const g = deps ?? globalThis.game;
	if (!senderId || !data?.actorId) return false;
	const sender = g?.users?.get?.(senderId);
	const actor = g?.actors?.get?.(data.actorId);
	if (!sender || !actor) return false;
	return Boolean(sender.isGM || actor.testUserPermission?.(sender, "OWNER"));
}
