// Layout, teclado e personagem em foco do Grimório. Funções puras. Spec 4.6, GR-20, GR-22, GR-51, GR-59.

export const LAYOUT_BREAKPOINT = 700;
export const DEFAULT_SIZE = Object.freeze({ width: 880, height: 600 });
export const MIN_SIZE = Object.freeze({ width: 320, height: 360 });

/** Dois layouts pela largura da janela: lado a lado (≥ 700 px) ou empilhado com gaveta (< 700 px). */
export function layoutFor(width) {
	return Number(width) >= LAYOUT_BREAKPOINT ? "side" : "stacked";
}

/**
 * Ação de teclado do Grimório. Nenhuma tecla numérica solta (os números do Foundry disparam macros da barra de atalhos).
 * @param {{key:string, ctrlKey?:boolean, altKey?:boolean, metaKey?:boolean, shiftKey?:boolean}} event
 * @param {{inInput?:boolean, hasQuery?:boolean, drawerOpen?:boolean, onTabs?:boolean}} [ctx]
 * @returns {string|null}
 */
export function keyAction(event, ctx = {}) {
	const { key } = event;
	const mod = event.ctrlKey || event.metaKey;
	if (mod && !event.altKey && /^[1-9]$/.test(key)) return Number(key) <= 4 ? `tab-${key}` : null;
	if (mod || event.altKey) return null;
	if (key === "Escape") {
		if (ctx.inInput && ctx.hasQuery) return "clear-search";
		return ctx.drawerOpen ? "close-drawer" : "close";
	}
	if (key === "/" && !ctx.inInput) return "focus-search";
	if (key === "ArrowDown") return "next";
	if (key === "ArrowUp") return "prev";
	if (key === "Enter" && !ctx.inInput) return "open-selected";
	if (ctx.onTabs && key === "ArrowRight") return "tab-next";
	if (ctx.onTabs && key === "ArrowLeft") return "tab-prev";
	return null;
}

/**
 * Personagem em foco (GR-51): o do usuário; senão o token selecionado; senão o único agente que ele possui.
 * Cada candidato: `{ id, type }`. Só vale agente.
 */
export function pickFocusActor({ userCharacter = null, controlled = [], owned = [] } = {}) {
	const isAgent = (a) => a && a.type === "agent";
	if (isAgent(userCharacter)) return userCharacter;
	const fromTokens = [...new Map(controlled.filter(isAgent).map((a) => [a.id, a])).values()];
	if (fromTokens.length === 1) return fromTokens[0];
	const ownedAgents = owned.filter(isAgent);
	if (ownedAgents.length === 1) return ownedAgents[0];
	return null;
}
