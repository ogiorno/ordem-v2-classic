/**
 * Durante o combate o jogador costuma estar na aba "Combate" da barra lateral e não vê o chat.
 * Quando chega uma mensagem de outra pessoa e o chat não está aberto, mostra um aviso curto.
 */

/** Regra pura: avisar? */
export function shouldNoticeChatMessage({ combatStarted, activeTab, authorId, viewerId, visible }) {
	return Boolean(combatStarted && visible && activeTab && activeTab !== "chat" && authorId !== viewerId);
}

function plainText(html) {
	const div = document.createElement("div");
	div.innerHTML = String(html ?? "");
	return div.textContent.replace(/\s+/g, " ").trim();
}

export function registerCombatChatNotice() {
	Hooks.on("createChatMessage", (message) => {
		const activeTab = ui.sidebar?.tabGroups?.primary ?? ui.sidebar?.activeTab ?? null;
		const notice = shouldNoticeChatMessage({
			combatStarted: Boolean(game.combat?.started),
			activeTab,
			authorId: message.author?.id ?? null,
			viewerId: game.user.id,
			visible: message.visible,
		});
		if (!notice) return;
		const who = message.speaker?.alias || message.author?.name || "";
		const line = plainText(message.flavor) || plainText(message.content).slice(0, 80);
		if (!line) return;
		ui.notifications.info(`${who}: ${line}`);
	});
}
