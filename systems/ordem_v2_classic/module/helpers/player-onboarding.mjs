/**
 * Primeira entrada e ajuda ao jogador (spec-experiencia-jogador, Fase 3):
 *  - P02: aviso ao GM quando o token de um jogador não enxerga nada numa cena com visão de token.
 *  - P04: o token acompanha o retrato do personagem.
 *  - P05: classe nova enche PV, PE/PD e SAN atuais (antes começavam em 5).
 *  - P06: dica única de teclado (WASD anda, setas movem a câmera: padrão do Foundry).
 *  - P08: linha opcional no chat ao abrir/fechar porta.
 */

const SYSTEM = "ordem_v2_classic";

/** Regra pura: o token de jogador está sem visão numa cena que usa visão de token? */
export function tokenNeedsVisionWarning({ sceneTokenVision, tokenSightEnabled, ownedByPlayer }) {
	return Boolean(sceneTokenVision && ownedByPlayer && !tokenSightEnabled);
}

/** Regra pura: quais recursos ainda estão no valor inicial do schema (5) e devem ir ao máximo? */
export function resourcesToFill(system, initial = 5) {
	const fills = {};
	for (const key of ["PV", "PE", "PD", "SAN"]) {
		const res = system?.[key];
		if (!res || !(res.max > 0)) continue;
		if (res.value === initial && res.max !== res.value) fills[`system.${key}.value`] = res.max;
	}
	return fills;
}

/** Texto da linha de porta no chat. */
export function doorLine(name, state) {
	if (state === CONST.WALL_DOOR_STATES.OPEN) return game.i18n.format("op.door.opened", { name });
	if (state === CONST.WALL_DOOR_STATES.LOCKED) return game.i18n.format("op.door.locked", { name });
	return game.i18n.format("op.door.closed", { name });
}

export function registerPlayerOnboarding() {
	game.settings.register(SYSTEM, "movementTipShown", { scope: "client", config: false, type: Boolean, default: false });
	// P16 — chat compacto (cliente; desligado por padrão para respeitar o tema de interface do mundo).
	game.settings.register(SYSTEM, "compactChat", {
		name: "SETTINGS.compactChat",
		hint: "SETTINGS.compactChatHint",
		scope: "client",
		config: true,
		type: Boolean,
		default: false,
		onChange: (value) => document.body.classList.toggle("op-compact-chat", value),
	});
	Hooks.once("ready", () => document.body.classList.toggle("op-compact-chat", game.settings.get(SYSTEM, "compactChat")));

	game.settings.register(SYSTEM, "doorChatLog", {
		name: "SETTINGS.doorChatLog",
		hint: "SETTINGS.doorChatLogHint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false,
	});

	// P02 — GM é avisado em vez de o jogador descobrir pelo mapa preto.
	Hooks.on("createToken", (token, _options, userId) => {
		if (userId !== game.user.id || !game.user.isGM) return;
		const actor = token.actor;
		if (actor?.type !== "agent") return;
		const ownedByPlayer = game.users.some((u) => !u.isGM && actor.testUserPermission?.(u, "OWNER"));
		const warn = tokenNeedsVisionWarning({
			sceneTokenVision: token.parent?.tokenVision,
			tokenSightEnabled: token.sight?.enabled,
			ownedByPlayer,
		});
		if (warn) ui.notifications.warn(game.i18n.format("op.visionWarning", { name: token.name }), { permanent: true });
	});

	// P04 — token acompanha o retrato quando ele ainda usa a imagem padrão ou a anterior.
	Hooks.on("updateActor", async (actor, changes, _options, userId) => {
		if (userId !== game.user.id || actor.type !== "agent" || !changes.img) return;
		const current = actor.prototypeToken.texture.src;
		const previous = actor._source.img;
		if (!current || current === "icons/svg/mystery-man.svg" || current === previous || current === actor.img) return;
		await actor.update({ "prototypeToken.texture.src": changes.img });
	});

	// P05 — classe nova: valores atuais no máximo (só se ainda estão no valor inicial do schema).
	Hooks.on("createItem", async (item, options, userId) => {
		const actor = item.parent;
		if (userId !== game.user.id || item.type !== "class" || actor?.type !== "agent" || options?.opAutoGrant) return;
		if (actor.getFlag(SYSTEM, "resourcesInitialized")) return;
		const fills = resourcesToFill(actor.system);
		await actor.update({ ...fills, [`flags.${SYSTEM}.resourcesInitialized`]: true });
	});

	// P06 — dica única para quem controla um personagem.
	Hooks.once("ready", () => {
		if (game.user.isGM || game.settings.get(SYSTEM, "movementTipShown")) return;
		if (!game.user.character) return;
		ui.notifications.info(game.i18n.localize("op.movementTip"));
		game.settings.set(SYSTEM, "movementTipShown", true);
	});

	// P27a — ativar outra cena move todos os jogadores; avisa quando há combate em andamento na cena atual.
	Hooks.on("preUpdateScene", (scene, changes, options, userId) => {
		if (userId !== game.user.id || changes.active !== true || options?.opConfirmedActivate) return;
		const current = game.scenes.active;
		if (!current || current.id === scene.id) return;
		const combat = game.combats.find((c) => c.started && c.scene?.id === current.id);
		if (!combat) return;
		foundry.applications.api.DialogV2.confirm({
			window: { title: game.i18n.localize("op.sceneSwitch.title") },
			content: `<p>${foundry.utils.escapeHTML(game.i18n.format("op.sceneSwitch.body", { to: scene.name, from: current.name }))}</p>`,
			yes: { label: game.i18n.localize("op.sceneSwitch.confirm") },
			no: { label: game.i18n.localize("op.sceneSwitch.cancel") },
			rejectClose: false,
		}).then((yes) => {
			if (yes) scene.update({ active: true }, { opConfirmedActivate: true });
		});
		return false;
	});

	// P08 — porta no chat (desligado por padrão).
	Hooks.on("updateWall", async (wall, changes, _options, userId) => {
		if (userId !== game.user.id || !wall.door || changes.ds === undefined) return;
		if (!game.settings.get(SYSTEM, "doorChatLog")) return;
		const name = game.user.character?.name ?? game.user.name;
		await ChatMessage.create({
			content: `<em class="door-line">${foundry.utils.escapeHTML(doorLine(name, changes.ds))}</em>`,
			speaker: { alias: game.i18n.localize("op.door.speaker") },
		});
	});
}
