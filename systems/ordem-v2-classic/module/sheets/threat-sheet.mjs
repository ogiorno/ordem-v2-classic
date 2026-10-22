/* eslint-disable new-cap */
import { prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { promptWeaknessResist } from "../helpers/weapon-curse-runtime.mjs";
import { ResistanceConfig } from "../applications/resistance-config.mjs";
import { TraitsConfig } from "../applications/traits-config.mjs";
import { SKILL_DEFAULT_ATTR, formatTest, formatTestHtml, signed, summarizeResistances } from "../helpers/threat-calc.mjs";
import { routeUse } from "../helpers/threat-ability-flow.mjs";

const { api, sheets } = foundry.applications;

/** Ordem em que os grupos de ação aparecem na ficha (como no livro). */
const ACTION_GROUP_ORDER = ["default", "movement", "complete", "free", "reaction"];

/** Tipos de ação do ataque (armament) → chave de execução das habilidades (ability). */
const ACTION_TYPE_TO_EXECUTION = { standard: "default", free: "free", movement: "movement", reaction: "reaction", full: "complete" };

/** Atributos da ameaça: chave interna, sigla do livro. */
const ATTRIBUTES = [
	{ key: "dex", abbr: "AGI", i18n: "op.attDex" },
	{ key: "str", abbr: "FOR", i18n: "op.attStr" },
	{ key: "int", abbr: "INT", i18n: "op.attInt" },
	{ key: "pre", abbr: "PRE", i18n: "op.attPre" },
	{ key: "vit", abbr: "VIG", i18n: "op.attVit" },
];

/**
 * Ficha de Ameaça (V2) - Versão Estável e Funcional
 * @extends {ActorSheetV2}
 */
export class OrdemThreatSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
	/**
	 *
	 */
	constructor(options = {}) {
		super(options);
		/** Modo de edição da ficha (campos extras visíveis). Só vive na instância. */
		this.editMode = false;
		/** Aba ativa ("stats" | "actions" | "description" | "effects"). Só vive na instância. */
		this.activeTab = "stats";
	}

	/** @inheritDoc */
	static DEFAULT_OPTIONS = {
		classes: ["ordemparanormal", "sheet", "actor", "threat", "themed", "theme-light"],
		tag: "form",
		position: { width: 720, height: 640 },
		window: {
			resizable: true,
			title: "op.threatSheetTitle",
		},
		form: {
			submitOnChange: true,
		},
		// Mapeamento de Ações (data-action="nomeDaAcao")
		actions: {
			onEditImage: this.prototype._onEditImage,
			toggleEdit: this.#onToggleEdit,
			sbTab: this.#onSwitchTab,
			sbEditText: this.#onEditText,
			removeElement: this.#onRemoveElement,

			// Rolagens
			rollThreatTest: this.#onRollThreatTest,
			rollThreatExtra: this.#onRollThreatExtra,
			rollThreatItem: this.#onRollThreatItem,
			useThreatAbility: this.#onUseThreatAbility,
			addExtraSkill: this.#onAddExtraSkill,
			removeExtraSkill: this.#onRemoveExtraSkill,
			onRollAttributeTest: this.#onRollAttributeTest,
			onRollSkillCheck: this.#onRollSkillCheck,
			onRollSkill: this.#onRollSkill,
			onRollMentalDamage: this.#onRollMentalDamage,
			onRoll: this.#onRoll,

			// Gestão de Itens e Efeitos
			createDoc: this.prototype._onCreateDoc,
			createThreatAttack: OrdemThreatSheet.#onCreateThreatAttack,
			editThreatAttack: OrdemThreatSheet.#onEditThreatAttack,
			viewDoc: this.prototype._onViewDoc,
			deleteDoc: this.prototype._onDeleteDoc,
			toggleDescription: this.prototype._onToggleDescription,
			toggleEffect: this.prototype._onToggleEffect,
			addWeaknessResist: function () {
				return promptWeaknessResist(this.actor);
			},
			// Configurações
			openResistanceConfig: this.#onOpenResistanceConfig,
			openTraitsConfig: this.#onOpenTraitsConfig,
		},
	};

	/** @inheritDoc */
	static PARTS = {
		threat: {
			id: "sheet",
			template: "systems/ordem-v2-classic/templates/threat/actor-threat-sheet.hbs",
			scrollable: [""],
		},
		enigmas: {
			id: "enigmas",
			template: "systems/ordem-v2-classic/templates/threat/parts/threat-enigmas.hbs",
			scrollable: [""],
		},
		effects: { id: "effects", template: "systems/ordem-v2-classic/templates/threat/parts/threat-effects.hbs", scrollable: [""] },
	};

	/** @override */
	_configureRenderOptions(options) {
		super._configureRenderOptions(options);
		// A ficha é um bloco único (como no livro): cabeçalho/estatísticas/ações, depois enigma+descrição e efeitos.
		options.parts = ["threat"];
		// Visão limitada só mostra o bloco principal
		if (this.document.limited) return;
		options.parts.push("enigmas", "effects");
	}

	/** @override */
	async _onRender(context, options) {
		await super._onRender(context, options);
		this.#disableOverrides();

		this.#applyTab();

		// Seletor "+ Elemento": acrescenta um elemento secundário à criatura.
		this.element.querySelector("[data-element-picker]")?.addEventListener("change", async (event) => {
			event.stopPropagation();
			const value = event.target.value;
			event.target.value = "";
			if (value) await this.addElement(value);
		});

		// Seletor "+ Perícia": escolher uma perícia do sistema (ou "Outra…") adiciona a linha já configurada.
		this.element.querySelector("[data-skill-picker]")?.addEventListener("change", async (event) => {
			event.stopPropagation();
			const value = event.target.value;
			if (!value) return;
			event.target.value = "";
			await this.addExtraSkill(value === "__custom" ? "" : value);
		});

		// Só inputs numéricos que declaram `data-name` usam o clamp próprio; os demais seguem o submitOnChange.
		for (const input of this.element.querySelectorAll("input[type='number'][data-name]")) {
			input.addEventListener("change", this._onChangeInputOP.bind(this));
		}

		// V13 DOM API (no jQuery)
		for (const compendiumSkill of this.element.querySelectorAll(".compendium-event-contextmenu")) {
			compendiumSkill.addEventListener("contextmenu", this._onOpenCompendiumEntry.bind(this));
		}
	}

	/** * Prepara os dados para o Handlebars
	 * @override
	 */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);

		// Mescla dados essenciais no contexto
		foundry.utils.mergeObject(context, {
			system: this.document.system,
			actor: this.document,
			editable: this.isEditable,
			owner: this.document.isOwner,
			effects: prepareActiveEffectCategories(this.actor.allApplicableEffects()),
			// Listas para Dropdowns
			optionDegree: CONFIG.op.dropdownDegree || {},
			optionDegreeThreat: CONFIG.op.dropdownDegreeThreat || {},
			elements: CONFIG.op.dropdownElement || {},
			threatTypes: CONFIG.op.dropdownThreatType,
			threatSizes: CONFIG.op.dropdownThreatSize,
			damageTypes: CONFIG.op.dropdownDamageType || {},
			editMode: this.editMode,
		});

		// Prepara visualização de Resistências e Características
		this._prepareResistances(context);
		this._prepareTraits(context);

		// Prepara Itens e Perícias
		this._prepareItems(context);

		// Blocos no formato do livro (descritores, testes xO+y, atributos, tags de defesa)
		this._prepareStatBlock(context);

		return context;
	}

	/**
	 * Monta os dados de exibição do bloco de ameaça: rótulos, testes `xO+y`, atributos e tags de defesa.
	 * @param {object} context
	 */
	_prepareStatBlock(context) {
		const system = this.document.system;
		const L = (key) => game.i18n.localize(key);
		const label = (map, key) => (key && map?.[key] ? L(map[key]) : "");

		context.elementLabel = label(CONFIG.op.dropdownElement, system.elements?.main);
		context.typeLabel = label(CONFIG.op.dropdownThreatType, system.details?.creatureType);
		context.sizeLabel = label(CONFIG.op.dropdownThreatSize, system.size || "medium");
		const mainKey = system.elements?.main;
		const others = this.#otherElementKeys();
		context.otherElements = others.map((key) => ({ key, label: label(CONFIG.op.dropdownElement, key) }));
		context.elementPicker = Object.keys(CONFIG.op.dropdownElement ?? {})
			.filter((key) => key !== mainKey && !others.includes(key))
			.map((key) => ({ key, label: label(CONFIG.op.dropdownElement, key) }));
		const hasEffects = !this.document.limited;
		context.activeEffectsCount = Array.from(this.actor.allApplicableEffects()).filter((e) => !e.disabled).length;
		context.tabs = [
			{ id: "stats", icon: "fa-solid fa-file-lines", label: L("op.threat.tab.stats") },
			{ id: "actions", icon: "fa-solid fa-hand-fist", label: L("op.threat.tab.actions") },
			...(hasEffects
				? [
						{ id: "effects", icon: "fa-solid fa-wand-sparkles", label: L("op.threat.tab.effects") },
						{ id: "description", icon: "fa-solid fa-book-open", label: L("op.threat.tab.description") },
				  ]
				: []),
		].map((t) => ({ ...t, active: t.id === this.activeTab }));
		const hp = system.attributes?.hp;
		context.hpPercent = hp?.max > 0 ? Math.round(Math.clamp((hp.value / hp.max) * 100, 0, 100)) : 0;
		context.resistanceRows = Object.entries(CONFIG.op.dropdownDamageType ?? {}).map(([key, i18n]) => ({
			key,
			label: L(i18n),
			value: system.resistances?.[key]?.value ?? 0,
			vulnerable: !!system.resistances?.[key]?.vulnerable,
			immune: !!system.resistances?.[key]?.immune,
		}));
		context.isCreature = system.details?.creatureType === "creature";

		// Atributos (siglas do livro)
		context.attrRows = ATTRIBUTES.map(({ key, abbr, i18n }) => ({
			key,
			abbr,
			label: L(i18n),
			value: system.attributes?.[key]?.value ?? 0,
		}));
		context.attributeChoices = Object.fromEntries(ATTRIBUTES.map(({ key, i18n }) => [key, i18n]));

		// Testes fixos: sentidos e defesa
		const testRow = (key) => {
			const skill = system.skills?.[key];
			return {
				key,
				label: skill?.label ?? key,
				testLabel: skill?.testLabel ?? "O",
				testHtml: skill?.testHtml ?? formatTestHtml(1, 0),
				formula: skill?.formula ?? "",
				degreeLabel: skill?.degree?.label ?? "untrained",
				override: skill?.degree?.override ?? "",
				derived: skill?.degree?.value ?? 0,
				// Buff temporário (system.skills.<chave>.value): somado ao bônus base em todo teste/ataque da perícia
				buff: skill?.value ?? 0,
				hasBuff: (skill?.value ?? 0) !== 0,
				buffText: signed(skill?.value ?? 0),
				buffClass: (skill?.value ?? 0) < 0 ? "neg" : "pos",
				tooltip: `${skill?.formula ?? ""} · ${L("op.threat.base")} ${signed(skill?.degree?.value ?? 0)} · ${L("op.threat.buff")} ${signed(skill?.value ?? 0)} · ${L("op.threat.shiftHint")}`,
			};
		};
		context.senseTests = ["perception", "initiative"].map(testRow);
		context.defenseTests = ["resilience", "reflexes", "will"].map(testRow);

		// Sentidos especiais ativos (Faro, Percepção às cegas, Visão...)
		const senseKeys = ["smell", "blindsight", "lowLightVision", "darkvision"];
		context.senseTraits = senseKeys
			.filter((key) => system.traits?.[key] === true)
			.map((key) => ({ key, label: L(`op.traits.${key}`) }));

		// Perícias além das cinco acima: a "perícia livre" (se nomeada) e a lista extra
		const skillRows = [];
		const free = system.skills?.freeSkill;
		if (free?.name) {
			skillRows.push({ name: free.name, testLabel: free.testLabel, testHtml: free.testHtml, key: "freeSkill", action: "rollThreatTest", isExtra: false });
		}
		(system.extraSkills ?? []).forEach((extra, index) => {
			const known = extra.key && CONFIG.op.skills?.[extra.key];
			skillRows.push({
				name: known ? L(CONFIG.op.skills[extra.key]) : extra.name || L("op.skill.freeSkill"),
				testLabel: extra.testLabel,
				testHtml: extra.testHtml,
				tooltip: `${extra.formula} · ${L("op.threat.base")} ${signed(extra.bonus)} · ${L("op.threat.buff")} ${signed(extra.buff)} · ${L("op.threat.shiftHint")}`,
				hasBuff: (extra.buff ?? 0) !== 0,
				buffText: signed(extra.buff),
				buffClass: (extra.buff ?? 0) < 0 ? "neg" : "pos",
				skillKey: extra.key ?? "",
				rawName: extra.name ?? "",
				// campos de edição
				attr: extra.attr,
				diceOverride: extra.diceOverride,
				bonus: extra.bonus,
				buff: extra.buff,
				isCustom: !known,
				index,
				action: "rollThreatExtra",
				isExtra: true,
			});
		});
		context.skillRows = skillRows;
		context.hasSkills = skillRows.length > 0;

		// Seletor de "adicionar perícia": perícias do sistema ainda não adicionadas, em ordem alfabética
		const taken = new Set((system.extraSkills ?? []).map((e) => e.key).filter(Boolean));
		context.skillPicker = Object.keys(SKILL_DEFAULT_ATTR)
			.filter((key) => !taken.has(key) && CONFIG.op.skills?.[key])
			.map((key) => ({ key, label: L(CONFIG.op.skills[key]) }))
			.sort((a, b) => a.label.localeCompare(b.label));

		// Resistências, vulnerabilidades e imunidades como tags legíveis
		const typeName = (key) => L(`op.damageTypeAbv.${key}`);
		const { rd, vulnerable, immune } = summarizeResistances(system.resistances);
		context.rdTags = rd.map(({ type, value }) => ({ text: `RD ${typeName(type)} ${value}`, title: type }));
		if (system.genericRd?.value > 0) {
			const except = (system.genericRd.except ?? []).map(typeName).join(", ");
			context.rdTags.unshift({
				text: except ? `RD ${system.genericRd.value}/${except}` : `RD ${system.genericRd.value}`,
				title: L("op.threat.genericRd"),
			});
		}
		context.vulnerableTags = vulnerable.map(typeName);
		context.immuneTags = immune.map(typeName);
		context.healingText = "";
		if (system.fastHealing?.value > 0) {
			const except = (system.fastHealing.except ?? []).map(typeName).join(", ");
			context.healingText = `${L("op.threat.fastHealing")} ${system.fastHealing.value}${except ? `/${except}` : ""}`;
		}
	}

	/**
	 * Handle opening a skill's compendium entry
	 * @param {Event} event	 The originating click event
	 * @private
	 */
	async _onOpenCompendiumEntry(event) {
		const parent = event.currentTarget.closest("li") ?? event.currentTarget;
		const skill = parent.dataset.key ?? null;
		if (!skill || !CONFIG.op.skillCompendiumEntries[skill]) return;
		const entryKey = CONFIG.op.skillCompendiumEntries[skill];
		await foundry.documents.collections.Journal._showEntry(entryKey, true);
	}

	/**
	 *  Separei a lógica de resistências para limpar o _prepareContext
	 * */
	_prepareResistances(context) {
		context.viewResistances = {};
		const allDamageTypes = CONFIG.op.dropdownDamageType || {};
		const actorResistances = context.system.resistances || {};

		for (const [key] of Object.entries(allDamageTypes)) {
			const resData = actorResistances[key] || { value: 0, vulnerable: false, immune: false };
			// Mostra apenas se tiver algum valor relevante
			const isVisible = resData.value > 0 || resData.vulnerable === true || resData.immune === true;

			context.viewResistances[key] = {
				...resData,
				isVisible: isVisible,
				translatedLabel: game.i18n.localize(`op.damageTypeAbv.${key}`),
			};
		}
	}

	/**
	 *  Separei a lógica de resistências para limpar o _prepareContext
	 * */
	_prepareTraits(context) {
		context.viewTraits = {};
		const allTraitsTypes = CONFIG.op.traits || {};
		const actorTraits = context.system.traits || {};

		for (const [key] of Object.entries(allTraitsTypes)) {
			const traitData = actorTraits[key];
			// Mostra apenas se tiver algum valor relevante
			const isVisible = traitData == undefined || traitData === true;

			context.viewTraits[key] = {
				...traitData,
				isVisible: isVisible,
				translatedLabel: game.i18n.localize(`op.traits.${key}`),
			};
		}
	}

	/**
	 * Separa os itens embutidos em Ações (ataques + habilidades ativas, agrupadas por tipo de ação)
	 * e Habilidades passivas, já com os rótulos de teste/dano no formato do livro.
	 * @param {object} context
	 */
	_prepareItems(context) {
		const actor = this.document;
		const L = (key) => game.i18n.localize(key);
		const attacks = [];
		const abilities = [];

		for (const i of actor.items) {
			i.img = i.img || DEFAULT_TOKEN;

			if (i.type === "armament") {
				const attack = i.system.formulas?.attack ?? {};
				const rangeType = i.system.types?.rangeType?.name;
				const attrKey = attack.attr || (rangeType === "ranged" ? "dex" : "str");
				const skillKey = attack.skill || (rangeType === "ranged" ? "aim" : "fighting");
				const skill = actor.system.skills?.[skillKey];

				// Mesma conta de OrdemItem#rollAttack: dados = atributo; bônus = grau + valor + mod + bônus do ataque.
				const attrValue = actor.system.attributes?.[attrKey]?.value ?? 0;
				// attack.bonus pode vir como texto ("0"): sempre converter, senão a soma vira concatenação ("100").
				const num = (n) => Number(n) || 0;
				const bonus = num(skill?.degree?.value) + num(skill?.value) + num(skill?.mod) + num(attack.bonus);
				i.testLabel = formatTest(attrValue, bonus);
				i.testHtml = formatTestHtml(attrValue, bonus);

				const dmgFormula = i.system.formulas?.damage?.formula || "0";
				const dmgTypeKey = i.system.formulas?.damage?.type;
				i.damageLabel = `${dmgFormula} ${dmgTypeKey ? L(`op.damageTypeAbv.${dmgTypeKey}`) : ""}`.trim();

				const metaParts = [rangeType === "ranged" ? L("op.rangeType.ranged") : L("op.rangeType.melee")];
				if (i.system.rangeCategory) metaParts.push(L(`op.rangeCategory.${i.system.rangeCategory}`));
				const count = i.system.numberOfAttacks ?? 1;
				if (count > 1) metaParts.push(`x${count}`);
				const crit = String(i.system.critical ?? "20");
				if (crit !== "20") metaParts.push(`${L("op.critical")} ${crit}`);
				i.rowMeta = metaParts.join(" ");

				i.rowKind = "attack";
				i.groupKey = ACTION_TYPE_TO_EXECUTION[i.system.actionType ?? "standard"] ?? "default";
				i.editAction = i.flags?.["ordem-v2-classic"]?.createdByThreatDialog ? "editThreatAttack" : "viewDoc";
				i.dieTooltip = L("op.threat.rollAttack");
				attacks.push(i);
			} else if (i.type === "ability") {
				i.rowKind = "ability";
				i.rowMeta = "";
				i.testLabel = "";
				i.testHtml = "";
				i.damageLabel = "";
				i.editAction = "viewDoc";
				i.dieTooltip = L("op.threat.rollAbility");
				// Habilidade configurada para uso no jogo (execution): botão Usar/Acionar; o dado vira "Mostrar no chat".
				const route = routeUse(i);
				if (route.usable) {
					i.canUse = true;
					i.useIncomplete = route.route === "incomplete";
					i.useLabel = L(route.triggered ? "op.threatUse.trigger" : "op.threatUse.use");
					i.dieTooltip = L("op.threatUse.showInChat");
				}
				// Sem execução definida conta como passiva (habilidade sempre ativa)
				i.groupKey = i.system.activation || "passive";
				abilities.push(i);
			}
		}

		const bySort = (a, b) => (a.sort || 0) - (b.sort || 0);
		attacks.sort(bySort);
		abilities.sort(bySort);

		context.attacks = attacks;
		context.abilities = abilities;
		context.passives = abilities.filter((i) => i.groupKey === "passive");

		const active = [...attacks, ...abilities.filter((i) => i.groupKey !== "passive")];
		context.actionGroups = ACTION_GROUP_ORDER.map((key) => ({
			key,
			label: L(`op.threat.group.${key}`),
			items: active.filter((i) => i.groupKey === key),
		})).filter((g) => g.items.length > 0);
	}

	/** */
	async _preparePartContext(partId, context) {
		// Todas as partes ficam empilhadas (sem abas): `tab.cssClass` ativo mantém as seções visíveis.
		context.tab = { cssClass: "active" };
		const enrich = (html) =>
			foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
				secrets: this.document.isOwner,
				rollData: this.actor.getRollData(),
				relativeTo: this.actor,
			});
		switch (partId) {
			case "enigmas":
				context.enrichedFearRiddle = await enrich(this.actor.system.details.fearRiddle);
				context.enrichedDescription = await enrich(this.actor.system.details.description);
				break;
			case "effects":
				// Prepare active effects
				context.effects = prepareActiveEffectCategories(
					// A generator that returns all effects stored on the actor
					// as well as any items
					this.actor.allApplicableEffects()
				);
				break;
		}
		return context;
	}


	/** */
	_getEmbeddedDocument(target) {
		const docRow = target.closest("li[data-document-class]");
		if (!docRow) return null;
		if (docRow.dataset.documentClass === "Item") {
			return this.actor.items.get(docRow.dataset.itemId);
		} else if (docRow.dataset.documentClass === "ActiveEffect") {
			return Array.from(this.actor.allApplicableEffects()).find((e) => e.id === docRow.dataset.effectId) ?? null;
		}
	}

	/* -------------------------------------------- */
	/* Action Handlers (MÉTODOS DE INSTÂNCIA)      */
	/* -------------------------------------------- */

	/** Chaves dos elementos secundários (`system.elements.others`, lista separada por vírgula). */
	#otherElementKeys() {
		const known = CONFIG.op.dropdownElement ?? {};
		const raw = String(this.document.system.elements?.others ?? "");
		return [...new Set(raw.split(",").map((k) => k.trim()).filter((k) => k in known))];
	}

	/**
	 * Acrescenta um elemento secundário à criatura (ignora o principal e repetidos).
	 * @param {string} key  Chave de CONFIG.op.dropdownElement.
	 */
	async addElement(key) {
		if (!(key in (CONFIG.op.dropdownElement ?? {}))) return;
		if (key === this.document.system.elements?.main) return;
		const list = this.#otherElementKeys();
		if (list.includes(key)) return;
		await this.document.update({ "system.elements.others": [...list, key].join(",") });
	}

	/** Remove um elemento secundário. */
	async removeElement(key) {
		const list = this.#otherElementKeys().filter((k) => k !== key);
		await this.document.update({ "system.elements.others": list.join(",") });
	}

	static async #onRemoveElement(event, target) {
		event.preventDefault();
		await this.removeElement(target.dataset.key);
	}

	/** Mostra só o conteúdo da aba ativa (as seções internas e as partes enigmas/efeitos). */
	#applyTab() {
		const tab = this.activeTab;
		for (const el of this.element.querySelectorAll(".sb-tab[data-sb-tab]")) el.hidden = el.dataset.sbTab !== tab;
		const partTab = { enigmas: "description", effects: "effects" };
		for (const [part, id] of Object.entries(partTab)) {
			const el = this.element.querySelector(`[data-application-part="${part}"]`);
			if (el) el.toggleAttribute("data-sb-hidden", id !== tab);
		}
		for (const link of this.element.querySelectorAll(".sb-tab-link")) {
			link.classList.toggle("active", link.dataset.tab === tab);
		}
	}

	/**
	 * Abre o editor de texto (enigma ou descrição) do cartão: mostra o editor escondido
	 * e aciona o botão de edição do próprio <prose-mirror>.
	 */
	static #onEditText(event, target) {
		event.preventDefault();
		const card = target.closest("[data-text-card]");
		card?.querySelector(".fx-emptystate")?.remove();
		card?.querySelector(".fx-text")?.classList.remove("is-empty");
		card?.querySelector("prose-mirror button.toggle, prose-mirror .toggle, prose-mirror button")?.click();
	}

	/** Troca de aba sem recarregar a ficha. */
	static #onSwitchTab(event, target) {
		event.preventDefault();
		this.activeTab = target.dataset.tab;
		this.#applyTab();
	}

	/** Alterna o modo de edição (campos extras da ficha) sem recarregar a janela. */
	static #onToggleEdit(event) {
		event.preventDefault();
		this.editMode = !this.editMode;
		this.element.querySelector(".sb")?.classList.toggle("sb-editing", this.editMode);
		this.element.querySelector(".sb-edit-toggle")?.classList.toggle("active", this.editMode);
	}

	/** Rola um teste fixo da ameaça (Percepção, Iniciativa, Fortitude, Reflexos, Vontade, perícia livre). */
	static #onRollThreatTest(event, target) {
		event.preventDefault();
		// Shift+clique: em vez de rolar, abre o mini-menu para editar o buff do teste
		if (event.shiftKey) return this.openBuffMenu(target, { type: "skill", key: target.dataset.key });
		return this.actor.rollThreatTest(target.dataset.key);
	}

	/** Rola uma perícia da lista extra (`system.extraSkills[index]`). */
	static #onRollThreatExtra(event, target) {
		event.preventDefault();
		if (event.shiftKey) return this.openBuffMenu(target, { type: "extra", index: Number(target.dataset.index) });
		return this.actor.rollThreatExtraSkill(Number(target.dataset.index));
	}

	/**
	 * Mini-menu do buff (Shift+clique num teste): campo numérico com −/+, prévia do teste e Aplicar/Zerar.
	 * Enter aplica, Esc ou clique fora fecha. O buff é somado ao bônus base em toda rolagem do teste.
	 * @param {HTMLElement} anchor   O chip do teste clicado.
	 * @param {{type: "skill"|"extra", key?: string, index?: number}} spec
	 */
	openBuffMenu(anchor, spec) {
		if (!this.isEditable) return;
		this.closeBuffMenu();

		const system = this.document.system;
		const isExtra = spec.type === "extra";
		const entry = isExtra ? system.extraSkills?.[spec.index] : system.skills?.[spec.key];
		if (!entry) return;

		const title = isExtra
			? (entry.key && CONFIG.op.skills?.[entry.key] ? game.i18n.localize(CONFIG.op.skills[entry.key]) : entry.name) ||
			  game.i18n.localize("op.skill.freeSkill")
			: entry.label ?? spec.key;
		const base = isExtra ? entry.bonus : entry.degree?.value ?? 0;
		const dice = isExtra ? entry.dice : system.attributes?.[entry.attr?.[0]]?.value ?? 0;
		const current = isExtra ? entry.buff ?? 0 : entry.value ?? 0;
		// Listas (ArrayField) são gravadas inteiras: um caminho "extraSkills.0.buff" recriaria o item só com o buff.
		const save = (next) => {
			if (!isExtra) return this.document.update({ [`system.skills.${spec.key}.value`]: next });
			const list = this.document.toObject().system.extraSkills ?? [];
			if (list[spec.index]) list[spec.index].buff = next;
			return this.document.update({ "system.extraSkills": list });
		};

		const menu = document.createElement("div");
		menu.className = "sb-buff-menu";
		menu.setAttribute("role", "dialog");

		const heading = document.createElement("div");
		heading.className = "sb-bm-title";
		heading.textContent = `${title} · ${game.i18n.localize("op.threat.buff")}`;

		const row = document.createElement("div");
		row.className = "sb-bm-row";
		const minus = Object.assign(document.createElement("button"), { type: "button", textContent: "−" });
		const plus = Object.assign(document.createElement("button"), { type: "button", textContent: "+" });
		const input = Object.assign(document.createElement("input"), { type: "number", value: String(current), step: "1" });
		input.setAttribute("aria-label", game.i18n.localize("op.threat.buff"));
		row.append(minus, input, plus);

		const preview = document.createElement("div");
		preview.className = "sb-bm-preview";
		const hint = document.createElement("div");
		hint.className = "sb-bm-hint";
		hint.textContent = game.i18n.localize("op.threat.buffHint");

		const actions = document.createElement("div");
		actions.className = "sb-bm-actions";
		const clear = Object.assign(document.createElement("button"), { type: "button", textContent: game.i18n.localize("op.threat.buffClear") });
		const apply = Object.assign(document.createElement("button"), { type: "button", textContent: game.i18n.localize("op.threat.buffApply") });
		apply.classList.add("sb-bm-apply");
		actions.append(clear, apply);

		const value = () => Math.trunc(Number(input.value)) || 0;
		const refresh = () => {
			preview.innerHTML = `${game.i18n.localize("op.threat.base")} ${signed(base)} ${signed(value())} = ${formatTestHtml(dice, base + value())}`;
		};
		const commit = async (next) => {
			this.closeBuffMenu();
			await save(next);
		};
		minus.addEventListener("click", () => { input.value = String(value() - 1); refresh(); });
		plus.addEventListener("click", () => { input.value = String(value() + 1); refresh(); });
		input.addEventListener("input", refresh);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") { e.preventDefault(); commit(value()); }
			if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.closeBuffMenu(); }
		});
		clear.addEventListener("click", () => commit(0));
		apply.addEventListener("click", () => commit(value()));

		menu.append(heading, row, preview, hint, actions);
		this.element.append(menu);
		refresh();

		// Posição: logo abaixo do chip, dentro da janela
		const host = this.element.getBoundingClientRect();
		const chip = anchor.getBoundingClientRect();
		const left = Math.max(4, Math.min(chip.left - host.left, host.width - menu.offsetWidth - 4));
		const top = Math.min(chip.bottom - host.top + 4, host.height - menu.offsetHeight - 4);
		menu.style.left = `${left}px`;
		menu.style.top = `${Math.max(4, top)}px`;
		input.focus();
		input.select();

		// Clique fora fecha
		this._buffMenuOutside = (e) => { if (!menu.contains(e.target)) this.closeBuffMenu(); };
		setTimeout(() => document.addEventListener("pointerdown", this._buffMenuOutside, true), 0);
		this._buffMenu = menu;
	}

	/** Fecha o mini-menu de buff, se aberto. */
	closeBuffMenu() {
		this._buffMenu?.remove();
		this._buffMenu = null;
		if (this._buffMenuOutside) document.removeEventListener("pointerdown", this._buffMenuOutside, true);
		this._buffMenuOutside = null;
	}

	/** @override */
	async close(options) {
		this.closeBuffMenu();
		return super.close(options);
	}

	/**
	 * Dado à direita da ação. Habilidades postam o card normalmente; ataques já rolam o teste de ataque
	 * (o card continua com o botão "Rolar dano", que respeita alvo, crítico e reações do sistema).
	 */
	/** Botão Usar: fluxo da habilidade configurada (alvo/área, custo, painel do Mestre). Ações sem configuração seguem no chat. */
	static async #onUseThreatAbility(event, target) {
		event.preventDefault();
		const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
		if (!item) return;
		const { useAbility } = await import("../macros/threat-ability-use.mjs");
		await useAbility({ actor: this.actor, item });
	}

	static async #onRollThreatItem(event, target) {
		event.preventDefault();
		const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
		if (!item) return;
		if (item.type !== "armament") return item.roll();

		let messageId = null;
		const hookId = Hooks.on("ordemparanormal.itemUsed", (data) => {
			if (data.item === item) messageId = data.message?.id ?? null;
		});
		try {
			await item.roll();
		} finally {
			Hooks.off("ordemparanormal.itemUsed", hookId);
		}
		if (!messageId) return;

		// O card é renderizado de forma assíncrona: espera o botão aparecer (até ~1s) e clica em "Rolar ataque",
		// o que passa por todo o fluxo normal do sistema.
		// Escopo em #chat: a cópia do card nas notificações (#chat-notifications) não tem os listeners do sistema.
		const selector = `#chat .message[data-message-id="${messageId}"] button[data-action="attack"]`;
		for (let i = 0; i < 10; i++) {
			const button = document.querySelector(selector);
			if (button) return button.click();
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		// Sem o chat renderizado (barra lateral fechada ou aba de chat oculta) não há botão para clicar:
		// rola o ataque direto e grava o resultado no card, como o handler do card faz.
		const attack = await item.rollAttack({});
		item.lastMessageId = messageId;
		item.critical = attack.criticalStatus;
		item.hitResult = attack.hitResult ?? null;
		if (attack.hitResult) await game.messages.get(messageId)?.setFlag("ordem-v2-classic", "hitResult", attack.hitResult);
	}

	/** Acrescenta uma perícia personalizada (em branco) à lista extra. */
	static async #onAddExtraSkill(event) {
		event.preventDefault();
		await this.addExtraSkill("");
	}

	/**
	 * Acrescenta uma perícia à lista extra. Com `key` de uma perícia do sistema (ex.: "athleticism"),
	 * já vem com o atributo padrão dela; sem `key`, é uma perícia personalizada para nomear.
	 * @param {string} [key]
	 */
	async addExtraSkill(key = "") {
		const list = this.document.toObject().system.extraSkills ?? [];
		list.push({ key, name: "", attr: SKILL_DEFAULT_ATTR[key] ?? "dex", diceOverride: null, bonus: 0, buff: 0 });
		await this.document.update({ "system.extraSkills": list });
	}

	/** Remove uma perícia da lista extra. */
	static async #onRemoveExtraSkill(event, target) {
		event.preventDefault();
		const index = Number(target.dataset.index);
		const list = this.document.toObject().system.extraSkills ?? [];
		if (!(index >= 0 && index < list.length)) return;
		list.splice(index, 1);
		await this.document.update({ "system.extraSkills": list });
	}

	/** */
	async _onEditImage(event, target) {
		const attr = target.dataset.edit;
		const current = foundry.utils.getProperty(this.document, attr);
		const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
		// V13: Use namespaced FilePicker
		const fp = new foundry.applications.apps.FilePicker({
			current,
			type: "image",
			redirectToRoot: img ? [img] : [],
			callback: (path) => this.document.update({ [attr]: path }),
			top: this.position.top + 40,
			left: this.position.left + 10,
		});
		return fp.browse();
	}

	// CORREÇÃO: Passando o objeto corretamente para evitar o erro "One of original or other are not Objects"
	/** */
	static #onRollAttributeTest(event, target) {
		event.preventDefault();
		const attribute = target.dataset.key;
		if (this.actor.rollAttribute) {
			this.actor.rollAttribute({ attribute, event });
		} else {
			console.error("Função rollAttribute não encontrada no ator.");
		}
	}

	/**
	 * Handle rolling a Skill check.
	 * @param {Event} event      The originating click event.
	 * @returns {Promise<Roll>}  The resulting roll.
	 * @private
	 */
	static #onRollSkillCheck(event, target) {
		event.preventDefault();
		const skill = target.closest("[data-key]").dataset.key;
		return this.actor.rollSkill({ skill, event });
	}

	/** */
	static async #onRollSkill(event, target) {
		event.preventDefault();
		const skillKey = target.dataset.key;
		const attrKey = target.dataset.attr;
		const label = target.dataset.label;

		const skillData = this.document.system.skills[skillKey] || {};

		// `skill.degree.value` is the canonical resolved bonus — either derived
		// from `degree.label` (the dropdown) or overridden manually via
		// `degree.override` (the input). Read it as the single source of truth
		// so homebrew threats with off-grid values roll with the correct bonus.
		const skillValue = skillData.degree?.value ?? 0;
		const attrValue = this.document.system.attributes[attrKey]?.value || 0;

		// 0 Atributo rola 2d20kl1, senão rola Xd20kh1
		const diceFormula = attrValue > 0 ? `${attrValue}d20kh` : "2d20kl";
		const formula = `${diceFormula} + ${skillValue}`;

		const roll = await new Roll(formula, this.actor.getRollData()).evaluate();
		await roll.toMessage({
			flavor: `Teste de ${label} <span style="font-size: 0.8em; color: gray">(${attrKey.toUpperCase()})</span>`,
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
		});
	}

	/** */
	static async #onRollMentalDamage(event, _target) {
		event.preventDefault();
		const { rollDisturbingPresence } = await import("../macros/threat-presence.mjs");
		await rollDisturbingPresence(this.document);
	}

	/** */
	async _onCreateDoc(event, target) {
		event.preventDefault();
		const docClass = target.dataset.documentClass;
		const docCls = getDocumentClass(docClass);

		if (docClass === "ActiveEffect") {
			const effectData = {
				name: docCls.defaultName({ parent: this.document }),
				icon: "icons/svg/aura.svg",
			};
			await docCls.create(effectData, { parent: this.document });
		} else {
			const type = target.dataset.type;
			const docData = {
				name: docCls.defaultName({ type: type, parent: this.document }),
				type: type,
				system: {},
			};
			await docCls.create(docData, { parent: this.document });
		}
	}

	/** */
	_onViewDoc(event, target) {
		const doc = this._getEmbeddedDocument(target);
		if (doc) doc.sheet.render(true);
	}

	/** */
	async _onDeleteDoc(event, target) {
		const doc = this._getEmbeddedDocument(target);
		if (doc) await doc.delete();
	}

	/**
	 * Handle clickable rolls.
	 * @param {Event} event   The originating click event
	 * @private
	 */
	static async #onRoll(event, target) {
		event.preventDefault();
		const dataset = target.dataset;

		// Handle item rolls.
		if (dataset.rollType) {
			if (dataset.rollType == "item") {
				const itemId = target.closest(".item").dataset.itemId;
				const item = this.actor.items.get(itemId);
				if (item) return item.roll();
			}
		}
	}

	/**
	 *
	 * @param {*} event
	 * @returns
	 */
	async _onChangeInputOP(event) {
		event.stopImmediatePropagation();
		const min = event.target.min !== "" ? Number(event.target.min) : -Infinity;
		const max = event.target.max !== "" ? Number(event.target.max) : Infinity;
		const value = Math.clamp(event.target.valueAsNumber, min, max);

		if (Number.isNaN(value)) return;

		event.target.value = value;
		await this.document.update({ [event.target.dataset.name]: value });
	}

	/** */
	async _onToggleDescription(event, target) {
		const li = target.closest("li");
		const summary = li.querySelector(".item-summary");
		if (summary) {
			summary.remove();
		} else {
			const item = this._getEmbeddedDocument(li);
			if (!item) return;
			const div = document.createElement("div");
			div.classList.add("item-summary");
			div.style.flexBasis = "100%";
			div.style.padding = "5px 10px";
			div.style.fontSize = "0.9em";
			div.style.borderTop = "1px dashed #ccc";
			div.style.marginTop = "5px";
			div.innerHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, {
				secrets: this.document.isOwner,
				rollData: this.actor.getRollData(),
				async: true,
			});
			li.appendChild(div);
		}
	}

	/** */
	async _onToggleEffect(event, target) {
		const effect = this._getEmbeddedDocument(target);
		if (effect) await effect.update({ disabled: !effect.disabled });
	}

	/**
	 * Disables inputs subject to active effects
	 */
	#disableOverrides() {
		const flatOverrides = foundry.utils.flattenObject(this.actor.overrides);
		for (const override of Object.keys(flatOverrides)) {
			const input = this.element.querySelector(`[name="${override}"]`);
			if (input) {
				input.disabled = true;
			}
		}
	}

	/** Build the HTML content for the threat attack dialog. */
	static #buildAttackDialogContent(existing = null) {
		const damageTypes = CONFIG.op?.dropdownDamageType ?? {};
		const attributes = CONFIG.op?.attributes ?? {};
		// Limit to skills actually present on ThreatData.skills — using one outside the
		// schema would crash rollAttack later when reading skill.degree.
		const threatSkillKeys = [
			"fighting",
			"aim",
			"resilience",
			"reflexes",
			"will",
			"initiative",
			"perception",
			"freeSkill",
		];
		const allAttackSkills = CONFIG.op?.attackSkills ?? {};
		const attackSkills = Object.fromEntries(Object.entries(allAttackSkills).filter(([k]) => threatSkillKeys.includes(k)));

		const selectOpts = (obj, selected = "") =>
			Object.entries(obj)
				.map(([k, v]) => `<option value="${k}" ${k === selected ? "selected" : ""}>${game.i18n.localize(v)}</option>`)
				.join("");

		const actionTypeOpts = ["standard", "free", "movement", "reaction", "full"]
			.map(
				(k) =>
					`<option value="${k}" ${(existing?.actionType ?? "standard") === k ? "selected" : ""}>${game.i18n.localize(
						`op.actionType.${k}`
					)}</option>`
			)
			.join("");

		const rangeCatOpts = ["", "short", "medium", "long", "extreme"]
			.map(
				(k) =>
					`<option value="${k}" ${(existing?.rangeCategory ?? "") === k ? "selected" : ""}>${
						k ? game.i18n.localize(`op.rangeCategory.${k}`) : "—"
					}</option>`
			)
			.join("");

		const isRanged = existing ? existing.types?.rangeType?.name === "ranged" : false;

		return `
<div class="threat-attack-dialog" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px;">
  <label>${game.i18n.localize("op.name")}<input name="name" type="text" value="${
			existing?.name ?? ""
		}" style="width:100%;margin-top:2px;" /></label>
  <label>${game.i18n.localize(
			"op.actionType.label"
		)}<select name="actionType" style="width:100%;margin-top:2px;">${actionTypeOpts}</select></label>
  <label>${game.i18n.localize(
			"op.numberOfAttacks"
		)}<input name="numberOfAttacks" type="number" min="1" max="8" value="${
			existing?.numberOfAttacks ?? 1
		}" style="width:100%;margin-top:2px;" /></label>
  <label>${game.i18n.localize("op.RollAttribute")}<select name="attr" style="width:100%;margin-top:2px;">${selectOpts(
			attributes,
			existing?.formulas?.attack?.attr ?? "str"
		)}</select></label>
  <label>${game.i18n.localize("op.skill.label")}<select name="skill" style="width:100%;margin-top:2px;">${selectOpts(
			attackSkills,
			existing?.formulas?.attack?.skill ?? "fighting"
		)}</select></label>
  <label>${game.i18n.localize("op.bonus")}<input name="atkBonus" type="number" value="${
			existing?.formulas?.attack?.bonus ?? 0
		}" style="width:100%;margin-top:2px;" /></label>
  <label>${game.i18n.localize("op.rangeType.label")}<select name="rangeType" style="width:100%;margin-top:2px;">
    <option value="melee" ${!isRanged ? "selected" : ""}>${game.i18n.localize("op.rangeType.melee")}</option>
    <option value="ranged" ${isRanged ? "selected" : ""}>${game.i18n.localize("op.rangeType.ranged")}</option>
  </select></label>
  <label>${game.i18n.localize(
			"op.rangeCategory.label"
		)}<select name="rangeCategory" style="width:100%;margin-top:2px;">${rangeCatOpts}</select></label>
  <label>${game.i18n.localize("op.formulaDamage")}<input name="dmgFormula" type="text" value="${
			existing?.formulas?.damage?.formula ?? "1d6"
		}" style="width:100%;margin-top:2px;" /></label>
  <label>${game.i18n.localize("op.damage")}<select name="dmgType" style="width:100%;margin-top:2px;">${selectOpts(
			damageTypes,
			existing?.formulas?.damage?.type ?? "impactDamage"
		)}</select></label>
  <label>${game.i18n.localize("op.critical")}<input name="critical" type="text" value="${
			existing?.critical ?? "20"
		}" style="width:100%;margin-top:2px;" /></label>
</div>`;
	}

	/** Open dialog to create a new threat attack (embedded armament item). */
	static async #onCreateThreatAttack(event, _target) {
		event.preventDefault();
		const result = await foundry.applications.api.DialogV2.prompt({
			window: { title: game.i18n.localize("op.atkDialogTitle") },
			content: OrdemThreatSheet.#buildAttackDialogContent(),
			ok: {
				label: game.i18n.localize("op.addThreatAttack"),
				callback: (_event, button) => new FormDataExtended(button.form).object,
			},
		});
		if (!result || !result.name) return;
		// Create the item and mark it with a flag so we know it came from the
		// threat attack dialog. Store the flag on the Item's flags under our
		// system namespace (flags.ordem-v2-classic.createdByThreatDialog = true)
		const itemData = OrdemThreatSheet.#attackFormDataToItem(result);
		const created = await this.actor.createEmbeddedDocuments("Item", [itemData]);
		if (created?.length) {
			const item = created[0];
			await item.update({
				"flags.ordem-v2-classic.createdByThreatDialog": true,
			});
		}
	}

	/** Open dialog to edit an existing threat attack item. */
	static async #onEditThreatAttack(event, target) {
		event.preventDefault();
		const li = target.closest("[data-item-id]");
		const item = this.actor.items.get(li?.dataset.itemId);
		if (!item) return;
		const result = await foundry.applications.api.DialogV2.prompt({
			window: { title: game.i18n.localize("op.editThreatAttack") },
			content: OrdemThreatSheet.#buildAttackDialogContent({ ...item.system, name: item.name }),
			ok: {
				label: game.i18n.localize("op.saveChanges"),
				callback: (_event, button) => new FormDataExtended(button.form).object,
			},
		});
		if (!result) return;
		const update = OrdemThreatSheet.#attackFormDataToItem(result);
		await item.update({ name: update.name, system: update.system });
	}

	/** Convert form data from the attack dialog into an Item creation object. */
	static #attackFormDataToItem(data) {
		return {
			name: data.name || game.i18n.localize("op.attack"),
			type: "armament",
			system: {
				formulas: {
					attack: { attr: data.attr, skill: data.skill, bonus: Number(data.atkBonus) || 0 },
					damage: { formula: data.dmgFormula || "1d6", attr: "", type: data.dmgType, bonus: 0, parts: [] },
					extraFormula: "",
				},
				critical: data.critical || "20",
				proficiency: "simpleWeapons",
				types: { rangeType: { name: data.rangeType === "ranged" ? "ranged" : "melee" } },
				actionType: data.actionType ?? "standard",
				numberOfAttacks: Number(data.numberOfAttacks) || 1,
				rangeCategory: data.rangeCategory ?? "",
				using: { state: true },
				quantity: 1,
				weight: 0,
			},
		};
	}

	/** */
	static async #onOpenResistanceConfig(event, target) {
		event.preventDefault();
		new ResistanceConfig({ document: this.document }).render(true);
	}

	/** */
	static async #onOpenTraitsConfig(event, target) {
		event.preventDefault();
		new TraitsConfig({ document: this.document }).render(true);
	}

	/** ******************
	 *
	 * Actor Override Handling
	 *
	 ********************/

	/**
	 * Submit a document update based on the processed form data.
	 * @param {SubmitEvent} event                   The originating form submission event
	 * @param {HTMLFormElement} form                The form element that was submitted
	 * @param {object} submitData                   Processed and validated form data to be used for a document update
	 * @returns {Promise<void>}
	 * @protected
	 * @override
	 */
	async _processSubmitData(event, form, submitData) {
		// Normalize cleared `degree.override` inputs to null. Foundry's default
		// form parser turns an empty `<input type="number">` into NaN, which the
		// nullable NumberField then rejects, leaving the threat in a stuck
		// "phantom override" state where the dropdown can't take back control.
		// IMPORTANT: keep everything in flat-key form so the active-effect
		// override deletion below still matches. Expanding to nested objects
		// here would silently strand override deletions and let synthetic effect
		// values be persisted onto the actor on the next save (PR #87 R2 had
		// this bug — see codex review note).
		const flat = foundry.utils.flattenObject(submitData);
		for (const [key, value] of Object.entries(flat)) {
			const nullable = key.endsWith(".degree.override") || key.endsWith(".diceOverride");
			if (nullable && (value === "" || value == null || Number.isNaN(value))) {
				flat[key] = null;
			}
		}
		const overrides = foundry.utils.flattenObject(this.actor.overrides);
		for (const k of Object.keys(overrides)) delete flat[k];
		await this.document.update(flat);
	}

	/* -------------------------------------------- */
	/*  Form Submission                             */
	/* -------------------------------------------- */

	/** @inheritdoc */
	async _onSubmit(...args) {
		await super._onSubmit(...args);
	}

	/* -------------------------------------------- */
}
