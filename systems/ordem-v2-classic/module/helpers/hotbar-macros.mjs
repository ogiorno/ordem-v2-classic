/**
 * Macro de cada arma, ritual e habilidade ativa na barra inferior (hotbar). Ver docs/arquivo/spec-hotbar-automatica.md.
 * Item elegível novo na ficha de um agente ganha uma macro no primeiro espaço vazio da barra de quem joga com ele;
 * item removido (ou que deixa de ser ativo) perde a macro e o espaço fica vazio no mesmo lugar.
 */
import { SYSTEM, belongsOnHotbar, freeHotbarSlot, hotbarKind, hotbarMacroData, hotbarMacroInfo, hotbarSlotsOf, hotbarTransition, orphanMacroIds } from "./hotbar-rules.mjs";

export const HOTBAR_AUTO_SETTING = "hotbarAuto";

/** Preenchimento automático ligado? (HB-42; sem a configuração registrada vale o padrão: ligado) */
function autoEnabled() {
	try {
		return game.settings.get(SYSTEM, HOTBAR_AUTO_SETTING) !== false;
	} catch {
		return true;
	}
}

/** Usuários que jogam com o agente: o personagem do usuário ou dono (jogador) da ficha. */
function usersOf(actor) {
	return game.users.filter((user) => user.character?.id === actor.id || (!user.isGM && actor.testUserPermission(user, "OWNER")));
}

/** Só um cliente cuida das barras: o MJ ativo (ou, sem MJ, quem fez a alteração). */
function isExecutor(userId) {
	const gm = game.users.activeGM;
	return gm ? gm.isSelf : userId === game.user.id;
}

const isAgentItem = (item) => hotbarKind(item) !== null && item.parent?.documentName === "Actor";

const hasMacroFor = (user, actorId, itemId) =>
	game.macros.some((m) => {
		const info = hotbarMacroInfo(m);
		return info?.itemId === itemId && info?.actorId === actorId && m.testUserPermission(user, "OWNER") && Object.values(user.hotbar ?? {}).includes(m.id);
	});

const fullNotified = new Set();

/** Aviso único por usuário quando a barra está cheia (HB-17). */
function warnFull(user, item) {
	if (fullNotified.has(user.id)) return;
	fullNotified.add(user.id);
	setTimeout(() => fullNotified.delete(user.id), 10000);
	ChatMessage.create({ whisper: [user.id], speaker: { alias: "Barra de macros" }, content: game.i18n.format("op.hotbar.full", { name: item.name }) }).catch(() => {});
}

/** Cria a macro do item na barra de cada usuário do agente. Devolve quantas criou e quantas não coube. */
export async function addHotbarMacro(item) {
	let added = 0;
	let full = 0;
	for (const user of usersOf(item.parent)) {
		if (hasMacroFor(user, item.parent.id, item.id)) continue;
		const slot = freeHotbarSlot(user.hotbar);
		if (!slot) {
			full++;
			warnFull(user, item);
			continue;
		}
		const macro = await Macro.create({ ...hotbarMacroData(item), ownership: { default: 0, [user.id]: 3 } });
		await user.update({ hotbar: { [slot]: macro.id } });
		added++;
	}
	return { added, full };
}

/** Tira da barra de todos os usuários e apaga as macros marcadas que casam com `match(info)`. */
export async function removeHotbarMacros(match) {
	const macros = game.macros.filter((m) => {
		const info = hotbarMacroInfo(m);
		return info && match(info);
	});
	if (!macros.length) return;
	const ids = macros.map((m) => m.id);
	for (const user of game.users) {
		const slots = hotbarSlotsOf(user.hotbar, ids);
		if (slots.length) await user.update(Object.fromEntries(slots.map((slot) => [`hotbar.-=${slot}`, null])));
	}
	await Macro.deleteDocuments(ids);
}

let queue = Promise.resolve();
/** Em fila: dois itens de uma vez não podem escolher o mesmo espaço vazio. */
const enqueue = (task) => {
	queue = queue.then(task).catch((error) => console.warn("Ordem Paranormal | Macro da barra falhou:", error));
	return queue;
};

/** "Preencher barra" (HB-41): cria as macros que faltam dos itens elegíveis do agente. Só o cliente que cuida das barras deve chamar. */
export function fillHotbar(actor) {
	let total = { added: 0, full: 0 };
	return enqueue(async () => {
		for (const item of actor.items.filter((i) => belongsOnHotbar(i))) {
			const result = await addHotbarMacro(item);
			total = { added: total.added + result.added, full: total.full + result.full };
		}
	}).then(() => total);
}

/** Pedido de "Preencher barra": o Mestre executa direto; jogador pede ao Mestre pelo socket. */
export async function requestFillHotbar(actor) {
	if (!actor || actor.type !== "agent") {
		ui.notifications.warn(game.i18n.localize("op.hotbar.needAgent"));
		return null;
	}
	if (game.user.isGM || !game.users.activeGM) {
		const result = await fillHotbar(actor);
		ui.notifications.info(game.i18n.format("op.hotbar.filled", { count: result.added }));
		return result;
	}
	game.socket.emit(`system.${SYSTEM}`, { type: "fillHotbar", actorId: actor.id, userId: game.user.id });
	return null;
}

/** Trata o pedido de um jogador (chamado pelo Mestre ativo). */
export async function handleFillHotbarRequest(data, senderId) {
	const sender = game.users.get(senderId);
	const actor = game.actors.get(data.actorId);
	if (!sender || !actor || actor.type !== "agent") return;
	if (!sender.isGM && !actor.testUserPermission(sender, "OWNER")) return;
	const result = await fillHotbar(actor);
	game.socket.emit(`system.${SYSTEM}`, { type: "fillHotbarResult", userId: sender.id, added: result.added });
}

/** Limpa macros marcadas cujo item ou agente sumiu (HB-11e). */
export async function cleanOrphanHotbarMacros() {
	const macros = game.macros.filter((m) => hotbarMacroInfo(m));
	const ids = new Set(orphanMacroIds(macros, (actorId, itemId) => game.actors.get(actorId)?.items.get(itemId) ?? null));
	if (ids.size) await removeHotbarMacros((info) => macros.some((m) => ids.has(m.id) && hotbarMacroInfo(m) === info));
}

export function registerHotbarMacroHooks() {
	Hooks.on("createItem", (item, options, userId) => {
		if (!isAgentItem(item) || !belongsOnHotbar(item) || !autoEnabled() || !isExecutor(userId)) return;
		enqueue(() => addHotbarMacro(item));
	});
	Hooks.on("deleteItem", (item, options, userId) => {
		if (!isExecutor(userId) || item?.parent?.documentName !== "Actor") return;
		enqueue(() => removeHotbarMacros((info) => info.itemId === item.id && info.actorId === item.parent.id));
	});
	Hooks.on("deleteActor", (actor, options, userId) => {
		if (!isExecutor(userId)) return;
		enqueue(() => removeHotbarMacros((info) => info.actorId === actor.id));
	});
	// guarda se o item era elegível antes da alteração, para saber se passou a ser ou deixou de ser (HB-14, HB-15, HB-33)
	Hooks.on("preUpdateItem", (item, changes, options) => {
		if (isAgentItem(item)) options.opHotbarWas = belongsOnHotbar(item);
	});
	Hooks.on("updateItem", (item, changes, options, userId) => {
		if (!isAgentItem(item) || !isExecutor(userId)) return;
		if (changes.name !== undefined || changes.img !== undefined) {
			const data = hotbarMacroData(item);
			for (const macro of game.macros.filter((m) => hotbarMacroInfo(m)?.itemId === item.id)) macro.update({ name: data.name, img: data.img, command: data.command }).catch(() => {});
		}
		const touched = changes.system && ("activation" in changes.system || "execution" in changes.system);
		if (!touched) return;
		const action = hotbarTransition(options?.opHotbarWas, belongsOnHotbar(item));
		if (action === "add" && autoEnabled()) enqueue(() => addHotbarMacro(item));
		if (action === "remove") enqueue(() => removeHotbarMacros((info) => info.itemId === item.id && info.actorId === item.parent.id));
	});
	Hooks.once("ready", () => {
		if (isExecutor(game.user.id)) enqueue(cleanOrphanHotbarMacros);
		game.socket.on(`system.${SYSTEM}`, (data, senderId) => {
			if (data?.type === "fillHotbar" && game.users.activeGM?.isSelf) handleFillHotbarRequest(data, senderId).catch((error) => console.warn("Ordem Paranormal | Preencher barra falhou:", error));
			if (data?.type === "fillHotbarResult" && game.users.get(senderId)?.isGM && data.userId === game.user.id) ui.notifications.info(game.i18n.format("op.hotbar.filled", { count: data.added }));
		});
	});
}
