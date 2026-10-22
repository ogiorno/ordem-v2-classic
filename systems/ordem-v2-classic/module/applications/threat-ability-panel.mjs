import { buildPanelView } from "../helpers/threat-ability-panel-view.mjs";
import { handlePanelAction, loadPanel, panelStore } from "../macros/threat-ability-panel-runner.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const SYSTEM = "ordem-v2-classic";
const FLAG = "threatAbilityPanel";
const open = new Map();

/** Painel de resolução do Mestre para habilidades de ameaça (T09). Só lê a mensagem; as ações passam pelo runner. */
export class ThreatAbilityPanel extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		classes: ["ordemparanormal", "threat-ability-panel-app"],
		position: { width: 560, height: "auto" },
		window: { title: "op.threatPanel.title", resizable: true },
		actions: {
			apply: ThreatAbilityPanel.#act("apply"),
			applyAll: ThreatAbilityPanel.#act("applyAll"),
			ignore: ThreatAbilityPanel.#act("ignore"),
			restore: ThreatAbilityPanel.#act("restore"),
			undo: ThreatAbilityPanel.#act("undo"),
			restorePart: ThreatAbilityPanel.#act("restorePart")
		}
	};

	static PARTS = { body: { template: "systems/ordem-v2-classic/templates/apps/threat-ability-panel.hbs" } };

	constructor({ messageId, ...options }) {
		super({ id: `threat-ability-panel-${messageId}`, ...options });
		this.messageId = messageId;
	}

	/** Abre (ou traz para frente) o painel de uma mensagem. */
	static show(messageId) {
		if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("op.threatPanel.gmOnly"));
		let app = open.get(messageId);
		if (!app) { app = new ThreatAbilityPanel({ messageId }); open.set(messageId, app); }
		return app.render({ force: true });
	}

	static #act(action) {
		return function (event, target) {
			return handlePanelAction(this.messageId, action, { row: target.dataset.row, change: target.dataset.change });
		};
	}

	get panel() {
		return loadPanel(game.messages.get(this.messageId));
	}

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const panel = this.panel;
		context.view = panel ? buildPanelView(panel, (key, data) => game.i18n.format(key, data ?? {})) : { itemName: "", sourceName: "", rows: [], pending: 0, applyAllDisabled: true, empty: true };
		return context;
	}

	_onRender(context, options) {
		super._onRender(context, options);
		for (const input of this.element.querySelectorAll("[data-tap-edit]")) {
			input.addEventListener("change", (event) => {
				event.stopPropagation();
				handlePanelAction(this.messageId, "edit", { row: input.dataset.row, change: input.dataset.change, value: input.value });
			});
		}
	}

	async close(options) {
		open.delete(this.messageId);
		return super.close(options);
	}

	/** Liga o botão "Abrir painel" das mensagens e re-renderiza painéis abertos quando a mensagem muda. */
	static registerHooks() {
		Hooks.on("renderChatMessageHTML", (message, html) => {
			if (!message.getFlag(SYSTEM, FLAG)) return;
			html.querySelector('[data-action="threat-ability-open-panel"]')?.addEventListener("click", () => ThreatAbilityPanel.show(message.id));
		});
		Hooks.on("opThreatAbilityPanelChanged", (messageId) => open.get(messageId)?.render());
		Hooks.on("deleteChatMessage", (message) => {
			open.get(message.id)?.close();
			const id = message.getFlag(SYSTEM, FLAG)?.panelId;
			if (id && game.user.isGM) panelStore().delete(id);
		});
	}
}
