/**
 * Mais de uma linha na barra inferior (docs/arquivo/spec-hotbar-automatica.md, §7a) e as configurações da barra automática.
 * O Foundry 14 mostra uma linha de 10 espaços e troca de página pelas setas; as linhas extras são desenhadas
 * pelo sistema, acima da barra, com as páginas seguintes. Só por clique e arrastar (sem atalhos de teclado:
 * Shift, Alt e Ctrl já são modificadores de rolagem do sistema).
 */
import { HOTBAR_AUTO_SETTING } from "./hotbar-macros.mjs";
import { SYSTEM, extraRowPages, normalizeRows, stepRows, visibleRows } from "./hotbar-rules.mjs";

export const HOTBAR_ROWS_SETTING = "hotbarRows";

const rowsSetting = () => {
	try {
		return game.settings.get(SYSTEM, HOTBAR_ROWS_SETTING);
	} catch {
		return "auto";
	}
};

export function registerHotbarSettings() {
	game.settings.register(SYSTEM, HOTBAR_AUTO_SETTING, { name: "SETTINGS.hotbarAuto", hint: "SETTINGS.hotbarAutoHint", scope: "world", config: true, type: Boolean, default: true });
	game.settings.register(SYSTEM, HOTBAR_ROWS_SETTING, {
		name: "SETTINGS.hotbarRows", hint: "SETTINGS.hotbarRowsHint", scope: "client", config: true, type: String, default: "auto",
		choices: { auto: "SETTINGS.hotbarRowsAuto", 1: "1", 2: "2", 3: "3" },
		onChange: () => ui.hotbar?.render(),
	});
}

function injectCss() {
	if (document.getElementById("op-hotbar-css")) return;
	const link = document.createElement("link");
	link.id = "op-hotbar-css";
	link.rel = "stylesheet";
	link.href = `systems/${SYSTEM}/css/hotbar-rows.css`;
	document.head.append(link);
}

/** Espaço da barra (li) igual ao do Foundry, sem o número da tecla (as linhas extras não têm teclas). */
function slotElement({ slot, macro }) {
	const li = document.createElement("li");
	li.className = `slot ${macro ? "full" : "open"}`;
	li.setAttribute("role", "button");
	li.dataset.action = "execute";
	li.dataset.slot = String(slot);
	const label = macro?.name ?? game.i18n.localize("HOTBAR.Empty");
	li.setAttribute("aria-label", label);
	if (macro) {
		li.dataset.tooltipText = macro.name;
		const img = document.createElement("img");
		img.className = "slot-icon";
		img.src = macro.img;
		img.alt = label;
		li.append(img);
	}
	return li;
}

function stepperElement(setting) {
	const value = normalizeRows(setting);
	const nav = document.createElement("nav");
	nav.className = "op-rows-stepper flexcol";
	const button = (direction, icon, tooltip) => {
		const b = document.createElement("button");
		b.type = "button";
		b.className = `plain op-rows-button fa-solid ${icon} icon`;
		b.dataset.tooltip = game.i18n.localize(tooltip);
		b.setAttribute("aria-label", game.i18n.localize(tooltip));
		b.disabled = (direction > 0 && value === 3) || (direction < 0 && value === "auto");
		b.addEventListener("click", () => game.settings.set(SYSTEM, HOTBAR_ROWS_SETTING, String(stepRows(rowsSetting(), direction))));
		return b;
	};
	const number = document.createElement("span");
	number.className = "op-rows-number";
	number.textContent = value === "auto" ? "A" : String(value);
	nav.append(button(1, "fa-plus", "op.hotbar.rowsMore"), number, button(-1, "fa-minus", "op.hotbar.rowsLess"));
	return nav;
}

/** Arrastar e soltar nas linhas extras, como na barra do Foundry. */
function bindDragDrop(app, wrap) {
	let dragSlot;
	let dropTarget;
	const clearTarget = () => {
		dropTarget?.classList.remove("drop-target");
		dropTarget = undefined;
	};
	new foundry.applications.ux.DragDrop.implementation({
		dragSelector: ".slot.full",
		dropSelector: ".slot",
		callbacks: {
			dragstart: (event) => {
				const li = event.target.closest(".slot");
				const macro = game.macros.get(game.user.hotbar[li.dataset.slot]);
				if (macro && app.locked) ui.notifications.warn("HOTBAR.IsLocked", { localize: true });
				if (!macro || app.locked) return event.preventDefault();
				dragSlot = li.dataset.slot;
				event.dataTransfer.setData("text/plain", JSON.stringify(foundry.utils.mergeObject(macro.toDragData(), { slot: dragSlot })));
			},
			dragend: () => {
				dragSlot = undefined;
			},
			dragover: (event) => {
				const target = event.target.closest(".slot");
				if (target === dropTarget) return;
				clearTarget();
				dropTarget = target;
				if (target && target.dataset.slot !== dragSlot) target.classList.add("drop-target");
			},
			drop: async (event) => {
				clearTarget();
				const dropSlot = event.target.closest(".slot")?.dataset.slot;
				if (!dropSlot || dragSlot === dropSlot) return;
				dragSlot = undefined;
				if (app.locked) return ui.notifications.warn("HOTBAR.IsLocked", { localize: true });
				const data = (foundry.applications.ux.TextEditor ?? TextEditor).implementation.getDragEventData(event);
				if (Hooks.call("hotbarDrop", app, data, dropSlot) === false) return;
				const cls = getDocumentClass(data.type);
				const doc = await cls?.fromDropData(data);
				if (!doc) return;
				let macro;
				if (data.type === "Macro") macro = game.macros.has(doc.id) ? doc : await cls.create(doc.toObject());
				else if (data.type === "RollTable") macro = await app._createRollTableRollMacro(doc);
				else macro = await app._createDocumentSheetToggle(doc);
				if (macro) await game.user.assignHotbarMacro(macro, dropSlot, { fromSlot: data.slot });
			},
		},
	}).bind(wrap);
}

/** Alinha as linhas extras com a linha de macros do Foundry. */
function alignRows(element, wrap) {
	const bar = element.querySelector("#action-bar");
	if (!bar) return;
	wrap.style.left = `${bar.offsetLeft}px`;
	wrap.style.width = `${bar.offsetWidth}px`;
}

function onRenderHotbar(app, html) {
	const element = html instanceof HTMLElement ? html : html?.[0];
	if (!element) return;
	element.querySelector(".op-extra-rows")?.remove();
	element.querySelector(".op-rows-stepper")?.remove();
	const setting = rowsSetting();
	element.querySelector("#hotbar-controls-right #hotbar-page-controls")?.after(stepperElement(setting));
	const rows = visibleRows(setting, game.user.hotbar);
	if (rows < 2) return;
	const wrap = document.createElement("div");
	wrap.className = "op-extra-rows";
	for (const page of extraRowPages(app.page, rows)) {
		const menu = document.createElement("menu");
		menu.className = "op-extra-row flexrow";
		menu.dataset.page = String(page);
		for (const entry of game.user.getHotbarMacros(page)) menu.append(slotElement(entry));
		wrap.append(menu);
	}
	element.append(wrap);
	alignRows(element, wrap);
	bindDragDrop(app, wrap);
}

export function registerHotbarRows() {
	injectCss();
	Hooks.on("renderHotbar", onRenderHotbar);
	window.addEventListener("resize", () => {
		const element = ui.hotbar?.element;
		const wrap = element?.querySelector(".op-extra-rows");
		if (wrap) alignRows(element, wrap);
	});
	ui.hotbar?.render();
}
