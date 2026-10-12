// Registro do Grimório no sistema: configurações, atalho (Alt+G), comando /grimorio, API e folha de estilo.
// A janela (grimoire-app.mjs) é carregada só na primeira abertura. Spec: docs/arquivo/spec-grimorio-do-jogador.md, seção 3.
import { invalidateGrimoireIndex, POWER_PACKS } from "./grimoire-loader.mjs";
import { conditionNoticeContent, noticeConditionNames, splitConditionMentions } from "./grimoire-links.mjs";
import { STATUS_TO_CONDITION } from "./grimoire-conditions.mjs";

const SYSTEM = "ordem_v2_classic";

async function app() {
	return (await import("../applications/grimoire-app.mjs")).GrimoireApp;
}

/** Abre o Grimório. `tab`: "ritual" | "power" | "condition"; `query`: texto da busca; `uuid`: item a mostrar; `actor`: personagem. */
export async function openGrimoire(options = {}) {
	if (!game.settings.get(SYSTEM, "grimoireEnabled")) {
		ui.notifications.warn(game.i18n.localize("op.grimoire.disabled"));
		return null;
	}
	return (await app()).open(options);
}

export async function toggleGrimoire() {
	if (!game.settings.get(SYSTEM, "grimoireEnabled")) return null;
	return (await app()).toggle();
}

function addStylesheet() {
	if (document.getElementById("op-grimoire-css")) return;
	const link = document.createElement("link");
	link.id = "op-grimoire-css";
	link.rel = "stylesheet";
	link.href = `systems/${SYSTEM}/css/grimoire.css`;
	document.head.append(link);
}

/** Abre o Grimório no item de um link (`.op-gr-link`) ou de um ícone de condição. */
function openFromElement(el) {
	return openGrimoire({ tab: el.dataset.grimoireTab, kind: el.dataset.grimoireTab, name: el.dataset.grimoireName });
}

const SKIP_LINKING = "a, button, summary, input, textarea, select, script, style, header, .message-header, .dice-roll, .op-gr-link";

/** Troca cada menção a uma condição do livro, nos textos de `root`, por um link `.op-gr-link`. */
export function linkConditionMentions(root) {
	if (!root) return;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim() && !n.parentElement?.closest(SKIP_LINKING)) nodes.push(n);
	for (const node of nodes) {
		const parts = splitConditionMentions(node.nodeValue);
		if (!parts.some((p) => p.condition)) continue;
		const frag = document.createDocumentFragment();
		for (const part of parts) {
			if (!part.condition) { frag.append(part.text); continue; }
			const a = document.createElement("a");
			a.className = "op-gr-link";
			a.dataset.grimoireTab = "condition";
			a.dataset.grimoireName = part.condition;
			a.setAttribute("role", "button");
			a.tabIndex = 0;
			a.textContent = part.text;
			frag.append(a);
		}
		node.replaceWith(frag);
	}
}

/** GR-06: ícone de condição na ficha (efeito) e no menu do token (botão direito) abre a regra da condição. */
function registerConditionShortcuts() {
	document.addEventListener("click", (ev) => {
		const link = ev.target.closest?.(".op-gr-link");
		if (!link) return;
		ev.preventDefault();
		openFromElement(link);
	});
	document.addEventListener("keydown", (ev) => {
		const link = ev.target.closest?.(".op-gr-link");
		if (!link || (ev.key !== "Enter" && ev.key !== " ")) return;
		ev.preventDefault();
		openFromElement(link);
	});

	// chat: toda condição do livro citada num cartão do sistema vira link para o Grimório
	Hooks.on("renderChatMessageHTML", (message, html) => {
		if (!/</.test(message?.content ?? "")) return; // texto digitado por jogador não é cartão
		linkConditionMentions(html instanceof HTMLElement ? html : html?.[0]);
	});

	// ficha: cada efeito que é condição do livro ganha o botão "Ler no Grimório"
	Hooks.on("renderActorSheetV2", (sheet, html) => {
		const root = html instanceof HTMLElement ? html : html?.[0];
		for (const row of root?.querySelectorAll?.("li.effect[data-effect-id]") ?? []) {
			const controls = row.querySelector(".effect-controls");
			if (!controls || controls.querySelector("[data-grimoire-name]")) continue;
			const effect = sheet.document?.effects?.get(row.dataset.effectId);
			const [name] = noticeConditionNames(effect);
			if (!name) continue;
			const a = document.createElement("a");
			a.className = "effect-control op-gr-link";
			a.dataset.grimoireTab = "condition";
			a.dataset.grimoireName = name;
			a.title = game.i18n.localize("op.grimoire.readCondition");
			a.innerHTML = '<i class="fa-solid fa-book-skull" aria-hidden="true"></i>';
			controls.prepend(a);
		}
	});

	// menu do token: clique direito no ícone de status abre a regra (o clique normal continua ligando e desligando)
	Hooks.on("renderTokenHUD", (hud, html) => {
		const root = html instanceof HTMLElement ? html : html?.[0];
		root?.querySelectorAll?.(".status-effects .effect-control[data-status-id]").forEach((img) => {
			const name = STATUS_TO_CONDITION[img.dataset.statusId];
			if (!name) return;
			img.addEventListener("contextmenu", (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				openGrimoire({ tab: "condition", kind: "condition", name });
			});
		});
	});
}

/** GR-43: ao aplicar uma condição num agente, a mesa vê "X recebe a condição Y" com o nome clicável. */
function registerConditionNotice() {
	Hooks.on("createActiveEffect", (effect, options, userId) => {
		if (userId !== game.user.id || !game.settings.get(SYSTEM, "grimoireConditionCards")) return;
		const actor = effect.parent;
		if (!(actor instanceof Actor) || actor.type !== "agent") return;
		for (const name of noticeConditionNames(effect)) {
			ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: conditionNoticeContent(actor.name, name), flags: { [SYSTEM]: { grimoireNotice: true } } });
		}
	});
}

/** GR-45: lançador na barra lateral. Não é uma aba de verdade (o Foundry só monta abas de aplicações próprias dele); só abre a janela. */
function registerSidebarLauncher() {
	Hooks.on("renderSidebar", (sidebar, html) => {
		const root = html instanceof HTMLElement ? html : html?.[0];
		const menu = root?.querySelector?.("nav.tabs menu");
		if (!menu || menu.querySelector("[data-op-grimoire]") || !game.settings.get(SYSTEM, "grimoireEnabled")) return;
		const li = document.createElement("li");
		li.innerHTML = `<button type="button" class="ui-control plain icon fa-solid fa-book-skull" data-op-grimoire="1" data-tooltip aria-label="${game.i18n.localize("op.grimoire.title")}"></button>`;
		li.querySelector("button").addEventListener("click", () => toggleGrimoire());
		const collapse = menu.querySelector(".collapse")?.closest("li");
		menu.insertBefore(li, collapse ?? null);
	});
}

/** Chamado uma vez no `init` do sistema. */
export function registerGrimoire() {
	game.settings.register(SYSTEM, "grimoireEnabled", { name: "op.grimoire.settings.enabled", hint: "op.grimoire.settings.enabledHint", scope: "world", config: true, type: Boolean, default: true, requiresReload: false });
	game.settings.register(SYSTEM, "grimoireWishlistNotify", { name: "op.grimoire.settings.wishNotify", hint: "op.grimoire.settings.wishNotifyHint", scope: "world", config: true, type: Boolean, default: true });
	game.settings.register(SYSTEM, "grimoireConditionCards", { name: "op.grimoire.settings.conditionCards", hint: "op.grimoire.settings.conditionCardsHint", scope: "world", config: true, type: Boolean, default: true });
	game.settings.register(SYSTEM, "grimoireCompactList", { name: "op.grimoire.settings.compactList", hint: "op.grimoire.settings.compactListHint", scope: "client", config: true, type: Boolean, default: false, onChange: () => import("../applications/grimoire-app.mjs").then((m) => m.GrimoireApp.refresh()) });
	game.settings.register(SYSTEM, "grimoireTextTheme", { name: "op.grimoire.settings.textTheme", hint: "op.grimoire.settings.textThemeHint", scope: "client", config: true, type: String, default: "dark", choices: { dark: "op.grimoire.theme.dark", parchment: "op.grimoire.theme.parchment" }, onChange: () => import("../applications/grimoire-app.mjs").then((m) => m.GrimoireApp.refresh()) });
	game.settings.register(SYSTEM, "grimoireState", { scope: "client", config: false, type: Object, default: {} });
	game.settings.register(SYSTEM, "grimoireTipShown", { scope: "client", config: false, type: Boolean, default: false });

	game.keybindings.register(SYSTEM, "openGrimoire", {
		name: "op.grimoire.keybinding",
		editable: [{ key: "KeyG", modifiers: ["Alt"] }],
		onDown: () => {
			toggleGrimoire();
			return true;
		},
	});

	// Comando de chat: precisa ser síncrono (vide chat-commands.mjs). `/grimorio abalado` abre com a busca preenchida.
	Hooks.on("chatMessage", (chatLog, content) => {
		const m = /^\/gr[ií]m[óo]rio(?:\s+(.*))?$/i.exec(String(content).trim());
		if (!m) return true;
		openGrimoire({ query: m[1] ?? "" });
		return false;
	});

	// um item de compêndio mudou: o índice é refeito na próxima abertura
	const watched = (doc) => doc?.pack && (doc.pack.startsWith(`${SYSTEM}.`) || doc.pack === "world.biblioteca-de-rituais");
	for (const hook of ["createItem", "updateItem", "deleteItem", "updateJournalEntryPage", "createJournalEntryPage", "deleteJournalEntryPage"]) {
		Hooks.on(hook, (doc) => { if (watched(doc) || watched(doc?.parent)) invalidateGrimoireIndex(); });
	}

	registerConditionShortcuts();
	registerConditionNotice();
	registerSidebarLauncher();

	Hooks.once("ready", () => {
		addStylesheet();
		game.ordemparanormal.grimoire = { open: openGrimoire, toggle: toggleGrimoire, invalidate: invalidateGrimoireIndex, packs: ["rituals", ...POWER_PACKS] };
		// Dica de primeira vez (uma só, por usuário), só para quem joga com um agente.
		const temAgente = game.user.character?.type === "agent" || game.actors.some((a) => a.type === "agent" && a.isOwner && !game.user.isGM);
		if (!game.user.isGM && temAgente && !game.settings.get(SYSTEM, "grimoireTipShown")) {
			game.settings.set(SYSTEM, "grimoireTipShown", true);
			ui.notifications.info(game.i18n.localize("op.grimoire.tip"), { permanent: false });
		}
	});
}
