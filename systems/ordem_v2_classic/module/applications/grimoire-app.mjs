// Grimório: janela de consulta de rituais, poderes e condições para o jogador (spec: docs/arquivo/spec-grimorio-do-jogador.md).
// ApplicationV2. A lógica (busca, filtros, leitura, teclado) está em module/helpers/grimoire-*.mjs e é testada sem o Foundry.
import { loadGrimoireIndex, grimoirePackIds } from "../helpers/grimoire-loader.mjs";
import { normalizeText, searchEntries } from "../helpers/grimoire-text.mjs";
import { EMPTY_FILTERS, applyFilters, countActiveFilters, emptyFilters, facetCounts, sortEntries, toggleFilter } from "../helpers/grimoire-filters.mjs";
import { findRitualEntry } from "../macros/ritual-card-view.mjs";
import { ABILITY_TYPE_LABELS, CURSE_APPLIES_LABELS, CURSE_MODE_LABELS, ELEMENTS, ELEMENT_LABELS, SOURCE_LABELS, visibleEntries } from "../helpers/grimoire-index.mjs";
import { CURSES, curseCostLabels } from "../helpers/curse-rules.mjs";
import { applyCurseDocument } from "../helpers/curses.mjs";
import { ritualFactCells, ritualForms, shortConditionRule } from "../helpers/grimoire-reading.mjs";
import { CONDITION_CATEGORIES, activeConditionNames } from "../helpers/grimoire-conditions.mjs";
import { DEFAULT_SIZE, LAYOUT_BREAKPOINT, MIN_SIZE, keyAction, layoutFor, pickFocusActor } from "../helpers/grimoire-layout.mjs";
import { themeFor } from "../helpers/grimoire-colors.mjs";
import { STATE, availabilityFor, emptyReason, forMeOnly, sealFor } from "../helpers/grimoire-rules.mjs";
import { CONDITION_RULES, CONDITIONS } from "../helpers/conditions.mjs";
import { extractQueryChips, mergeChipFilters } from "../helpers/grimoire-chips.mjs";
import { findByName, seeAlso } from "../helpers/grimoire-links.mjs";
import { trainingReadingForItem, trainingReadingForSkill } from "../helpers/skill-training.mjs";
import { affinityMeets } from "../helpers/affinity-rules.mjs";
import { affinityLineFor, affinityParagraph } from "../helpers/affinity-powers.mjs";

/** O módulo Quick Insert está ativo (GR-69)? */
const quickInsertActive = () => Boolean(game.modules.get("quick-insert")?.active && globalThis.QuickInsert?.open);

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const SYSTEM = "ordem_v2_classic";
const TEMPLATE = (name) => `systems/${SYSTEM}/templates/apps/grimoire-${name}.hbs`;
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

const TABS = [
	{ id: "ritual", icon: "fa-book-skull", label: "op.grimoire.tab.ritual" },
	{ id: "power", icon: "fa-hand-sparkles", label: "op.grimoire.tab.power" },
	{ id: "condition", icon: "fa-skull", label: "op.grimoire.tab.condition" },
	{ id: "skill", icon: "fa-dice-d20", label: "op.grimoire.tab.skill" },
	{ id: "curse", icon: "fa-link-slash", label: "op.grimoire.tab.curse" },
];
const FUNCTION_LABELS = ["Dano", "Proteção", "Controle", "Utilidade", "Detecção"];
const EXECUTION_LABELS = { default: "Padrão", complete: "Completa", free: "Livre", reaction: "Reação" };
const RANGE_LABELS = { personal: "Pessoal", touch: "Toque", short: "Curto", medium: "Médio", long: "Longo", extreme: "Extremo", unlimited: "Ilimitado" };
const DURATION_LABELS = { instantaneous: "Instantânea", scene: "Cena", sustained: "Sustentada", setDuration: "Definida" };
const SKILL_LABELS = { will: "Vontade", resilience: "Fortitude", reflexes: "Reflexos", none: "Nenhuma" };
const FORM_LABELS = { student: "Discente", true: "Verdadeiro" };
const TARGET_LABELS = { self: "Você", creature: "Criatura", object: "Objeto", area: "Área" };
const ACTIVATION_LABELS = { passive: "Passiva", free: "Livre", reaction: "Reação", complete: "Completa", default: "Padrão", movement: "Movimento", none: "Sem ação" };
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export class GrimoireApp extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: "op-grimoire",
		classes: ["ordemparanormal", "op-grimoire"],
		tag: "section",
		window: { title: "op.grimoire.title", icon: "fa-solid fa-book-skull", resizable: true, minimizable: true },
		position: { width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height },
		actions: {
			selectTab: GrimoireApp.#selectTab,
			selectItem: GrimoireApp.#selectItem,
			toggleFilter: GrimoireApp.#toggleFilter,
			clearFilters: GrimoireApp.#clearFilters,
			clearSearch: GrimoireApp.#clearSearch,
			toggleMore: GrimoireApp.#toggleMore,
			selectForm: GrimoireApp.#selectForm,
			back: GrimoireApp.#back,
			sendChat: GrimoireApp.#sendChat,
			toggleSendMenu: GrimoireApp.#toggleSendMenu,
			copyLink: GrimoireApp.#copyLink,
			toggleWish: GrimoireApp.#toggleWish,
			pickCondition: GrimoireApp.#pickCondition,
			toggleOnlyActive: GrimoireApp.#toggleOnlyActive,
			toggleForMe: GrimoireApp.#toggleForMe,
			showAll: GrimoireApp.#showAll,
			toggleHelp: GrimoireApp.#toggleHelp,
			castRitual: GrimoireApp.#castRitual,
			toggleOnlyWished: GrimoireApp.#toggleOnlyWished,
			pickRelated: GrimoireApp.#pickRelated,
			dismissChip: GrimoireApp.#dismissChip,
			quickInsert: GrimoireApp.#quickInsert,
			curseItem: GrimoireApp.#curseItem,
		},
	};

	static PARTS = {
		tabs: { template: TEMPLATE("tabs") },
		search: { template: TEMPLATE("search") },
		filters: { template: TEMPLATE("filters") },
		list: { template: TEMPLATE("list"), scrollable: [".op-gr-list"] },
		reading: { template: TEMPLATE("reading"), scrollable: [".op-gr-read-body"] },
	};

	/** @type {GrimoireApp|null} */
	static instance = null;

	#index = null;
	#tab = "ritual";
	#query = "";
	#filters = emptyFilters();
	#sort = "";
	#selected = null;
	#form = "basic";
	#moreOpen = false;
	#drawer = false;
	#menuOpen = false;
	#onlyActive = false;
	#actorId = null;
	#results = [];
	#pendingFocusSearch = false;
	#forMe = null; // null = padrão: ligado quando há personagem em foco
	#onlyWished = false;
	#helpOpen = false;
	#rulesCtx = null;
	#dismissedChips = new Set(); // chips da busca desfeitos pelo jogador (voltam a valer como texto)

	/** Abre (ou traz para a frente) o Grimório. `tab`, `query`, `uuid` e `name` (+ `form`; `kind` para condição, poder ou perícia) posicionam a janela; `actor` define o personagem; `forMe` liga ou desliga o "Para mim". */
	static async open({ tab = null, query = null, uuid = null, name = null, form = null, actor = null, forMe = null, kind = null } = {}) {
		const app = GrimoireApp.instance ?? (GrimoireApp.instance = new GrimoireApp());
		await app.#restore();
		if (actor) app.#actorId = actor.id;
		if (typeof forMe === "boolean") app.#forMe = forMe;
		if (tab) app.#tab = tab;
		if (query !== null) app.#query = String(query);
		if (uuid) await app.#focusUuid(uuid);
		else if (name) await app.#focusName(name, form, kind);
		app.#pendingFocusSearch = true;
		await app.render({ force: true });
		return app;
	}

	static toggle() {
		const app = GrimoireApp.instance;
		if (app?.rendered) return app.close();
		return GrimoireApp.open();
	}

	static refresh() {
		GrimoireApp.instance?.rendered && GrimoireApp.instance.render();
	}

	/* -------------------------------------------- */
	/*  Estado                                      */
	/* -------------------------------------------- */

	async #restore() {
		if (this.#restored) return;
		this.#restored = true;
		let saved = {};
		try { saved = game.settings.get(SYSTEM, "grimoireState") ?? {}; } catch { /* sem preferência salva */ }
		if (TABS.some((tb) => tb.id === saved.tab)) this.#tab = saved.tab;
		if (saved.filters) this.#filters = { ...emptyFilters(), ...Object.fromEntries(Object.entries(saved.filters).filter(([k]) => k in EMPTY_FILTERS)) };
		if (typeof saved.sort === "string") this.#sort = saved.sort;
		if (typeof saved.forMe === "boolean") this.#forMe = saved.forMe;
	}
	#restored = false;

	#save() {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => {
			game.settings.set(SYSTEM, "grimoireState", this.#state()).catch(() => {});
		}, 400);
	}
	#saveTimer = null;

	async #focusUuid(uuid) {
		const index = await this.#loadIndex();
		const entry = index.find((e) => e.uuid === uuid);
		if (!entry) return;
		this.#tab = entry.kind;
		this.#selected = uuid;
		this.#form = "basic";
		this.#query = "";
		this.#filters = emptyFilters();
		this.#forMe = false; // quem pede um item (link do chat, ícone) quer vê-lo, mesmo que o personagem ainda não possa usar
		this.#drawer = true;
	}

	/** Seleciona o ritual pelo nome (a cópia na ficha não está no índice); sem correspondência, preenche a busca. */
	async #focusName(name, form, kind = null) {
		const index = await this.#loadIndex();
		if (kind && kind !== "ritual") {
			const found = findByName(index, kind, name);
			if (found) return this.#focusUuid(found.uuid);
			this.#tab = kind;
			this.#query = String(name);
			this.#selected = null;
			return;
		}
		const entry = findRitualEntry(index, name);
		if (entry) {
			await this.#focusUuid(entry.uuid);
			if (form) this.#form = form;
			return;
		}
		this.#tab = "ritual";
		this.#query = String(name);
		this.#selected = null;
	}

	async #loadIndex() {
		if (!this.#index) this.#index = visibleEntries(await loadGrimoireIndex(), { isGM: game.user.isGM });
		return this.#index;
	}

	/** Quando há personagem em foco: diz se a afinidade dele atende ao requisito da forma do ritual. */
	#affinityNote(required, ritualElement) {
		const actor = this.#actor;
		if (!actor) return "";
		const p = actor.system?.paranormal ?? {};
		return affinityMeets(p, required, ritualElement) ? " (você tem)" : " (você não tem)";
	}

	get #actor() {
		const agents = this.#agents();
		if (this.#actorId) return agents.find((a) => a.id === this.#actorId) ?? null;
		return pickFocusActor({
			userCharacter: game.user.character,
			controlled: canvas?.tokens?.controlled?.map((tk) => tk.actor).filter(Boolean) ?? [],
			owned: agents.filter((a) => a.isOwner && !game.user.isGM),
		});
	}

	#agents() {
		return game.actors.filter((a) => a.type === "agent" && (game.user.isGM || a.isOwner));
	}

	#state() {
		return { tab: this.#tab, filters: this.#filters, sort: this.#sort, forMe: this.#forMe };
	}

	/** Fatos do personagem para as regras do "Para mim" (NEX, classe, atributos, perícias treinadas, trilhas, poderes e rituais). */
	#facts(actor) {
		if (!actor) return null;
		const sys = actor.system;
		const className = ["Combatente", "Especialista", "Ocultista", "Sobrevivente"].find((c) => normalizeText(c) === normalizeText(actor.itemTypes.class?.[0]?.name ?? "")) ?? null;
		const trainedSkills = new Set();
		for (const [key, skill] of Object.entries(sys.skills ?? {})) if ((skill?.degree?.value ?? 0) > 0) trainedSkills.add(normalizeText(game.i18n.localize(CONFIG.op.skills[key] ?? key)));
		const ritualNames = new Set(actor.itemTypes.ritual.map((i) => normalizeText(i.name)));
		const powerNames = new Set(actor.itemTypes.ability.map((i) => normalizeText(i.name)));
		const hasRitualAccess = className === "Ocultista" || ritualNames.size > 0 || [...powerNames].some((n) => /escolhido pelo outro lado|iniciado|esoterico/.test(n));
		return {
			nex: Number(sys.NEX?.value) || 0,
			stage: Number(sys.stage?.value) || 1,
			className,
			hasRitualAccess,
			attributes: Object.fromEntries(["str", "dex", "int", "pre", "vit"].map((k) => [k, Number(sys.attributes?.[k]?.value) || 0])),
			trainedSkills,
			pathNames: new Set(actor.itemTypes.path.map((i) => normalizeText(i.name))),
			powerNames,
			ritualNames,
		};
	}

	/** Nomes de perícias e de poderes (normalizados) para ler os requisitos dos poderes. */
	#rulesContext(index) {
		if (!this.#rulesCtx) {
			this.#rulesCtx = {
				skillNames: new Set(Object.values(CONFIG.op.skills).map((k) => normalizeText(game.i18n.localize(k)))),
				powerNames: new Set(index.filter((e) => e.kind === "power").map((e) => normalizeText(e.name))),
			};
		}
		return this.#rulesCtx;
	}

	/** Quem marcou ★ em cada item (só o Mestre vê): uuid → nomes dos personagens. */
	#wishers() {
		const map = new Map();
		if (!game.user.isGM) return map;
		for (const a of game.actors) {
			if (a.type !== "agent") continue;
			for (const uuid of a.getFlag(SYSTEM, "grimoire.wishlist") ?? []) map.set(uuid, [...(map.get(uuid) ?? []), a.name]);
		}
		return map;
	}

	/* -------------------------------------------- */
	/*  Contexto                                    */
	/* -------------------------------------------- */

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const index = await this.#loadIndex();
		const actor = this.#actor;
		const q = this.#query.trim();
		const facts = this.#facts(actor);
		const rctx = this.#rulesContext(index);
		const availabilityOf = (e) => (facts ? availabilityFor(e, facts, rctx) : null);
		// "Para mim" só filtra a navegação: assim que o jogador digita, a busca procura em tudo (GR-50)
		const forMeOn = Boolean(facts) && (this.#forMe ?? true);
		const wishers = this.#wishers();

		// contagem de cada aba: segue a busca e, sem busca, o "Para mim" (GR-65)
		const tabs = TABS.map((tab) => {
			const ofKind = index.filter((e) => e.kind === tab.id);
			let found = q ? this.#searchKind(tab.id, ofKind, q).filtered : ofKind;
			if (forMeOn && !q) found = forMeOnly(found, availabilityOf);
			return { id: tab.id, icon: tab.icon, label: t(tab.label), count: found.length, active: tab.id === this.#tab };
		});

		const ofKind = index.filter((e) => e.kind === this.#tab);
		if (!q) this.#dismissedChips.clear();
		const searched = this.#searchKind(this.#tab, ofKind, q);
		let list = applyFilters(searched.results.map((r) => r.entry), mergeChipFilters(this.#filters, searched.chips));
		if (this.#tab === "condition" && this.#onlyActive) {
			const active = new Set(this.#activeConditions(actor));
			list = list.filter((e) => active.has(e.name));
		}
		if (game.user.isGM && this.#onlyWished) list = list.filter((e) => wishers.has(e.uuid));
		const forMeCount = facts && q ? forMeOnly(list, availabilityOf).length : null;
		let hiddenByForMe = 0;
		if (forMeOn && !q) {
			const before = list.length;
			list = forMeOnly(list, availabilityOf);
			hiddenByForMe = before - list.length;
		}
		const sort = this.#sort || (q ? "relevance" : this.#tab === "ritual" ? "circle" : "name");
		list = sortEntries(list, q && !this.#sort ? "relevance" : sort);
		this.#results = list.map((e) => e.uuid);
		if (!list.some((e) => e.uuid === this.#selected)) {
			this.#selected = list[0]?.uuid ?? null;
			this.#form = "basic";
		}
		const approxFor = new Map(searched.results.map((r) => [r.entry.uuid, r.approx]));
		const selected = list.find((e) => e.uuid === this.#selected) ?? null;
		const compact = game.settings.get(SYSTEM, "grimoireCompactList");
		const theme = themeFor(selected?.element);

		const rows = list.map((e) => this.#row(e, approxFor.get(e.uuid), availabilityOf(e)));
		const activeNames = this.#tab === "condition" ? this.#activeConditions(actor) : [];

		Object.assign(context, {
			tabs,
			tab: this.#tab,
			actors: this.#agents().map((a) => ({ id: a.id, name: a.name, selected: a.id === actor?.id })),
			hasActor: Boolean(actor),
			actorName: actor?.name ?? "",
			query: this.#query,
			hasQuery: Boolean(q),
			announce: t("op.grimoire.announce", { n: list.length }),
			filterRows: this.#filterRows(ofKind),
			moreRows: this.#moreRows(ofKind),
			moreOpen: this.#moreOpen,
			moreCount: countActiveFilters(this.#filters, this.#moreKeys()),
			activeFilters: countActiveFilters(this.#filters) + (this.#onlyActive ? 1 : 0) + (this.#onlyWished ? 1 : 0),
			conditionBar: this.#tab === "condition" ? this.#conditionBar(ofKind) : null,
			youAre: activeNames.map((name) => ({ name })),
			hasYouAre: this.#tab === "condition" && Boolean(actor),
			noYouAre: this.#tab === "condition" && Boolean(actor) && !activeNames.length,
			sortOptions: this.#sortOptions(sort),
			rows,
			compact,
			total: ofKind.length,
			shown: rows.length,
			summary: this.#summary({ n: rows.length, total: ofKind.length, q, forMeCount, hiddenByForMe, facts }),
			canForMe: Boolean(facts),
			forMe: forMeOn,
			helpOpen: this.#helpOpen,
			showAll: forMeOn && hiddenByForMe > 0,
			forMeEmpty: forMeOn && !q && rows.length === 0 && ofKind.length > 0,
			forMeEmptyText: t(emptyReason(this.#tab, facts, ofKind.length) === "noAccess" ? "op.grimoire.empty.noAccess" : "op.grimoire.empty.nothingNew"),
			isGM: game.user.isGM,
			wishTotal: game.user.isGM ? wishers.size : 0,
			onlyWished: this.#onlyWished,
			approximate: searched.approximate,
			onlyApproximate: searched.onlyApproximate,
			bestGuess: searched.onlyApproximate ? searched.results[0]?.entry.name : null,
			suggestions: searched.suggestions.map((e) => ({ name: e.name })),
			queryChips: searched.chips,
			empty: rows.length === 0,
			quickInsert: rows.length === 0 && Boolean(q) && quickInsertActive(),
			emptyText: q ? t("op.grimoire.noResultsFor", { q }) : t("op.grimoire.noResults"),
			packsNote: this.#tab === "ritual" && !game.packs.get(`${SYSTEM}.rituals`) ? t("op.grimoire.packFallback") : "",
			drawer: this.#drawer,
			accentStyle: `--gr-accent:${theme.accent};--gr-on-accent:${theme.onAccent};--gr-ink:${theme.ink};--gr-edge:${theme.edge};`,
		});
		const wantsReading = !options.parts || options.parts.includes("reading");
		context.reading = wantsReading && selected ? await this.#reading(selected, actor, availabilityOf(selected), wishers.get(selected.uuid) ?? []) : null;
		context.hasSelection = Boolean(selected);
		return context;
	}

	/** Busca na aba. Na aba de rituais, elemento exato e "Nº círculo" digitados viram chips de filtro (GR-62). */
	#searchKind(kind, entries, q) {
		const { text, chips } = kind === "ritual" ? extractQueryChips(q, this.#dismissedChips) : { text: q, chips: [] };
		const searched = searchEntries(entries, text);
		return { ...searched, chips, filtered: applyFilters(searched.results.map((r) => r.entry), mergeChipFilters(emptyFilters(), chips)) };
	}

	#summary({ n, total, q, forMeCount, hiddenByForMe, facts }) {
		if (q && facts) return n === 1 ? t("op.grimoire.oneResultForMe", { m: forMeCount }) : t("op.grimoire.nResultsForMe", { n, m: forMeCount });
		if (hiddenByForMe > 0) return t("op.grimoire.nOfTotal", { n, total });
		return n === total ? (n === 1 ? t("op.grimoire.oneResult") : t("op.grimoire.nResults", { n })) : t("op.grimoire.nOfTotal", { n, total });
	}

	#activeConditions(actor) {
		if (!actor) return [];
		return activeConditionNames([...actor.effects].map((e) => ({ name: e.name, statuses: [...(e.statuses ?? [])], disabled: e.disabled })));
	}

	#row(e, approx, availability = null) {
		const theme = themeFor(e.element);
		const base = { uuid: e.uuid, name: e.name, selected: e.uuid === this.#selected, img: e.img, approx: Boolean(approx), seal: sealFor(availability), rowStyle: `--gr-accent:${theme.accent};--gr-edge:${theme.edge};--gr-ink:${theme.ink};` };
		if (e.kind === "ritual") {
			const idx = ELEMENTS.indexOf(e.element);
			return { ...base, spriteX: idx < 0 ? 0 : idx * 25, sub: `${e.circle}º círculo · ${ELEMENT_LABELS[e.element] ?? ""}`, meta: e.cost ? `${e.cost} PE` : "", isRitual: true, fallbackClass: `is-${e.element}` };
		}
		if (e.kind === "power") {
			const parts = [ABILITY_TYPE_LABELS[e.abilityType]];
			if (e.pathName) parts.push(e.pathName);
			else if (e.className) parts.push(e.className);
			return { ...base, sub: parts.filter(Boolean).join(" · "), meta: e.cost ? `${e.cost} ${e.costType}` : "" };
		}
		if (e.kind === "skill") return { ...base, sub: t("op.grimoire.skillSub"), meta: "", isSkill: true };
		if (e.kind === "curse") {
			const idx = ELEMENTS.indexOf(e.element);
			return { ...base, spriteX: idx < 0 ? 0 : idx * 25, sub: `${CURSE_APPLIES_LABELS[e.curseKind] ?? ""} · ${ELEMENT_LABELS[e.element] ?? ""}`, meta: "", isCurse: true };
		}
		return { ...base, sub: CONDITION_CATEGORIES[e.category] ?? "Condição", meta: "", isCondition: true };
	}

	/* ---- filtros ---- */

	#moreKeys() {
		if (this.#tab === "ritual") return ["functions", "execution", "range", "duration", "resistance", "form", "target", "source"];
		if (this.#tab === "power") return ["cost", "activation", "source", "pathName"];
		return [];
	}

	#chips(entries, key, labels, { numeric = false, only = null, labelOf = null } = {}) {
		const counts = facetCounts(entries, this.#filters, key);
		const values = only ?? Object.keys(counts);
		return values
			.filter((v) => counts[v] || this.#filters[key]?.includes(numeric ? Number(v) : v))
			.map((v) => {
				const value = numeric ? Number(v) : v;
				return { value, label: labelOf ? labelOf(v) : (labels?.[v] ?? String(v)), count: counts[v] ?? 0, active: this.#filters[key]?.includes(value) };
			});
	}

	#filterRows(entries) {
		if (this.#tab === "ritual") {
			return [
				{ key: "element", label: t("op.grimoire.f.element"), numeric: false, element: true, chips: this.#chips(entries, "element", ELEMENT_LABELS, { only: ELEMENTS }).map((c) => ({ ...c, spriteX: ELEMENTS.indexOf(c.value) * 25, elementClass: `is-${c.value}` })) },
				{ key: "circle", label: t("op.grimoire.f.circle"), numeric: true, chips: this.#chips(entries, "circle", null, { numeric: true, only: [1, 2, 3, 4], labelOf: (v) => `${v}º` }) },
			];
		}
		if (this.#tab === "power") {
			return [
				{ key: "abilityType", label: t("op.grimoire.f.type"), chips: this.#chips(entries, "abilityType", ABILITY_TYPE_LABELS, { only: ["class", "path", "general", "origin", "paranormal"] }) },
				{ key: "className", label: t("op.grimoire.f.class"), chips: this.#chips(entries, "className", null, { only: ["Combatente", "Especialista", "Ocultista", "Sobrevivente"] }) },
			];
		}
		if (this.#tab === "curse") {
			return [
				{ key: "element", label: t("op.grimoire.f.element"), numeric: false, element: true, chips: this.#chips(entries, "element", ELEMENT_LABELS, { only: ELEMENTS.filter((el) => el !== "fear") }).map((c) => ({ ...c, spriteX: ELEMENTS.indexOf(c.value) * 25, elementClass: `is-${c.value}` })) },
				{ key: "curseKind", label: t("op.grimoire.f.curseKind"), chips: this.#chips(entries, "curseKind", CURSE_APPLIES_LABELS, { only: ["weapon", "protection", "accessory"] }) },
			];
		}
		return [];
	}

	#moreRows(entries) {
		if (this.#tab === "ritual") {
			return [
				{ key: "functions", label: t("op.grimoire.f.function"), chips: this.#chips(entries, "functions", { none: "Sem função" }, { only: [...FUNCTION_LABELS, "none"] }) },
				{ key: "execution", label: t("op.grimoire.f.execution"), chips: this.#chips(entries, "execution", EXECUTION_LABELS) },
				{ key: "range", label: t("op.grimoire.f.range"), chips: this.#chips(entries, "range", RANGE_LABELS) },
				{ key: "duration", label: t("op.grimoire.f.duration"), chips: this.#chips(entries, "duration", DURATION_LABELS) },
				{ key: "resistance", label: t("op.grimoire.f.resistance"), chips: this.#chips(entries, "resistance", { ...SKILL_LABELS, none: "Nenhuma" }) },
				{ key: "form", label: t("op.grimoire.f.form"), chips: this.#chips(entries, "form", FORM_LABELS, { only: ["student", "true"] }) },
				{ key: "target", label: t("op.grimoire.f.target"), chips: this.#chips(entries, "target", TARGET_LABELS, { only: ["self", "creature", "object", "area"] }) },
				{ key: "source", label: t("op.grimoire.f.source"), chips: this.#chips(entries, "source", SOURCE_LABELS) },
			].filter((r) => r.chips.length);
		}
		if (this.#tab === "power") {
			return [
				{ key: "cost", label: t("op.grimoire.f.cost"), chips: this.#chips(entries, "cost", { 0: "Sem custo", 1: "1 PE", 2: "2 PE", "3+": "3+ PE" }, { only: ["0", "1", "2", "3+"] }) },
				{ key: "activation", label: t("op.grimoire.f.activation"), chips: this.#chips(entries, "activation", ACTIVATION_LABELS) },
				{ key: "source", label: t("op.grimoire.f.source"), chips: this.#chips(entries, "source", SOURCE_LABELS) },
			].filter((r) => r.chips.length);
		}
		return [];
	}

	#conditionBar(entries) {
		const counts = facetCounts(entries, this.#filters, "category");
		return {
			onlyActive: this.#onlyActive,
			hasActor: Boolean(this.#actor),
			categories: [{ value: "", label: t("op.grimoire.allCategories"), selected: !this.#filters.category.length }].concat(
				Object.entries(CONDITION_CATEGORIES).filter(([id]) => counts[id] || this.#filters.category.includes(id)).map(([id, label]) => ({ value: id, label: `${label} (${counts[id] ?? 0})`, selected: this.#filters.category.includes(id) })),
			),
		};
	}

	#sortOptions(current) {
		const opts = this.#tab === "ritual" ? ["relevance", "circle", "name", "cost", "function"] : this.#tab === "power" ? ["relevance", "name", "cost"] : ["name"];
		return opts.map((id) => ({ value: id, label: t(`op.grimoire.sort.${id}`), selected: id === current }));
	}

	/* ---- leitura ---- */

	async #reading(entry, actor, availability = null, wishers = []) {
		const doc = await fromUuid(entry.uuid).catch(() => null);
		const enrich = (html) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? "", { secrets: false });
		const theme = themeFor(entry.element);
		const wished = actor ? (actor.getFlag(SYSTEM, "grimoire.wishlist") ?? []).includes(entry.uuid) : false;
		const tone = availability ? { have: "have", available: "ok", check: "check" }[availability.state] ?? "later" : null;
		const availText = !availability ? "" : availability.state === STATE.HAVE ? t("op.grimoire.avail.have") : availability.state === STATE.AVAILABLE ? t("op.grimoire.avail.available") : availability.state === STATE.CHECK ? t("op.grimoire.avail.check", { reason: availability.reason ?? "" }) : t("op.grimoire.avail.later", { reason: availability.reason ?? "" });
		const castItem = entry.kind === "ritual" && availability?.state === STATE.HAVE ? actor?.itemTypes.ritual.find((i) => normalizeText(i.name) === normalizeText(entry.name)) : null;
		const base = { uuid: entry.uuid, name: entry.name, img: entry.img, kind: entry.kind, wished, hasActor: Boolean(actor), availText, availTone: tone, canCast: Boolean(castItem), wishers: wishers.map((name) => ({ name })), hasWishers: wishers.length > 0, canWish: entry.kind === "ritual" || entry.kind === "power", related: seeAlso(entry, this.#index ?? []).map((r) => ({ uuid: r.uuid, name: r.name, kindLabel: t(`op.grimoire.tab.${r.kind}`) })), sourceLabel: SOURCE_LABELS[entry.source] ?? "", hidden: entry.hidden, theme };
		if (entry.kind === "ritual") {
			const html = doc?.system?.description ?? "";
			const forms = ritualForms(html, entry.circle, { studentForm: entry.studentForm, trueForm: entry.trueForm });
			const current = forms[this.#form] ? this.#form : "basic";
			const form = forms[current];
			const idx = ELEMENTS.indexOf(entry.element);
			const resource = game.settings.get(SYSTEM, "globalPlayingWithoutSanity") ? "PD" : "PE";
			return {
				...base,
				isRitual: true,
				subtitle: `${entry.circle}º círculo · ${ELEMENT_LABELS[entry.element] ?? ""}`,
				elementLabel: ELEMENT_LABELS[entry.element] ?? "",
				spriteX: idx < 0 ? 0 : idx * 25,
				elementClass: `is-${entry.element}`,
				cells: ritualFactCells(entry, { resource }),
				formTabs: [{ id: "basic", label: "Básico", active: current === "basic" }, ...(forms.student ? [{ id: "student", label: "Discente", active: current === "student" }] : []), ...(forms.true ? [{ id: "true", label: "Verdadeiro", active: current === "true" }] : [])],
				formCost: form.cost ? `${form.cost} ${resource}` : "",
				formExtra: current === "basic" ? "" : [form.requiredCircle ? `Requer ${form.requiredCircle}º círculo` : "", form.requiredAffinity ? `Requer afinidade${form.requiredAffinity === "afinidade" ? "" : ` com ${form.requiredAffinity}`}${this.#affinityNote(form.requiredAffinity, entry.element)}` : ""].filter(Boolean).join(" · "),
				body: await enrich(`<p>${escapeHtml(form.text)}</p>`),
				functions: entry.functions.map((f) => ({ name: f })),
			};
		}
		if (entry.kind === "power") {
			return {
				...base,
				isPower: true,
				subtitle: [ABILITY_TYPE_LABELS[entry.abilityType], entry.pathName, entry.className].filter(Boolean).join(" · "),
				prerequisite: entry.prerequisite,
				cells: [
					entry.cost ? { label: "Custo", icon: "droplet", value: `${entry.cost} ${entry.costType}` } : null,
					entry.activation ? { label: "Ativação", icon: "bolt", value: ACTIVATION_LABELS[entry.activation] ?? entry.activation } : null,
				].filter(Boolean),
				body: await enrich(`${doc?.system?.description ?? ""}${affinityParagraph(entry.name, { hasAffinity: actor ? Boolean(actor.system?.paranormal?.affinity) && actor.system.paranormal.affinity === affinityLineFor(entry.name)?.element : null })}`),
				training: actor ? trainingReadingForItem(actor, actor.items.find((i) => i.type === "ability" && normalizeText(i.name) === normalizeText(entry.name))) : null,
			};
		}
		const html = doc?.text?.content ?? "";
		if (entry.kind === "skill") {
			const skillKey = Object.keys(CONFIG.op.skills ?? {}).find((k) => normalizeText(game.i18n.localize(CONFIG.op.skills[k])) === normalizeText(entry.name)) ?? (/profiss/i.test(entry.name) ? "freeSkill" : null);
			return { ...base, isSkill: true, subtitle: t("op.grimoire.skillSub"), training: actor ? trainingReadingForSkill(actor, skillKey) : null, body: await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { secrets: false, relativeTo: doc ?? undefined }) };
		}
		if (entry.kind === "curse") {
			const idx = ELEMENTS.indexOf(entry.element);
			const def = CURSES[entry.curseKey];
			const cost = curseCostLabels(2);
			return {
				...base,
				isCurse: true,
				subtitle: `${CURSE_APPLIES_LABELS[entry.curseKind] ?? ""} · ${ELEMENT_LABELS[entry.element] ?? ""}`,
				elementClass: `is-${entry.element}`,
				spriteX: idx < 0 ? 0 : idx * 25,
				cells: [
					{ label: t("op.grimoire.f.curseKind"), icon: "link", value: CURSE_APPLIES_LABELS[entry.curseKind] ?? "" },
					{ label: t("op.grimoire.f.element"), icon: "droplet", value: ELEMENT_LABELS[entry.element] ?? "" },
					{ label: t("op.grimoire.curseCategory"), icon: "layer-group", value: `${t("op.category")}: ${cost[0]} / ${cost[1]}` },
					{ label: t("op.grimoire.curseMode"), icon: "gears", value: CURSE_MODE_LABELS[entry.mode] ?? "" },
					def?.use?.cost ? { label: t("op.grimoire.cost"), icon: "bolt", value: `${def.use.cost} ${game.settings.get(SYSTEM, "globalPlayingWithoutSanity") ? "PD" : "PE"}` } : null,
				].filter(Boolean),
				body: await enrich(doc?.system?.description ?? ""),
				canCurse: Boolean(actor),
			};
		}
		const key = Object.entries(CONDITIONS).find(([, def]) => def.name === entry.name)?.[0];
		return {
			...base,
			isCondition: true,
			subtitle: CONDITION_CATEGORIES[entry.category] ?? "Condição",
			rule: shortConditionRule(html, key ? CONDITION_RULES[key] : null, { name: entry.name }),
			// o texto do livro inteiro (com as condições relacionadas e os dados), com links relativos à página
			blocks: [{ title: null, body: await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { secrets: false, relativeTo: doc ?? undefined }) }],
		};
	}

	/* -------------------------------------------- */
	/*  Renderização e eventos                      */
	/* -------------------------------------------- */

	async _preFirstRender(context, options) {
		await super._preFirstRender(context, options);
		options.position = { ...(options.position ?? {}), width: options.position?.width ?? DEFAULT_SIZE.width, height: options.position?.height ?? DEFAULT_SIZE.height };
	}

	_onRender(context, options) {
		super._onRender?.(context, options);
		const root = this.element;
		root.classList.toggle("is-reading", this.#drawer && layoutFor(root.querySelector(".window-content")?.clientWidth ?? root.clientWidth) === "stacked");
		root.classList.toggle("is-compact-list", Boolean(context.compact));
		root.classList.toggle("is-parchment", game.settings.get(SYSTEM, "grimoireTextTheme") === "parchment");
		root.style.minWidth = `${MIN_SIZE.width}px`;
		root.style.minHeight = `${MIN_SIZE.height}px`;
		// os ouvintes ficam no elemento da janela, que é recriado a cada abertura: marca no próprio elemento
		if (!root.dataset.grBound) {
			root.dataset.grBound = "1";
			root.addEventListener("input", (ev) => {
				if (ev.target.matches(".op-gr-search input")) this.#onQuery(ev.target.value);
			});
			root.addEventListener("change", (ev) => this.#onChange(ev));
			root.addEventListener("keydown", (ev) => this.#onKey(ev));
			// link de condição dentro do texto ("Veja também"): abre no Grimório em vez da página do diário
			root.addEventListener("click", (ev) => this.#onContentLink(ev), { capture: true });
		}
		if (this.#pendingFocusSearch) {
			this.#pendingFocusSearch = false;
			requestAnimationFrame(() => root.querySelector(".op-gr-search input")?.focus());
		}
		const row = root.querySelector(".op-gr-row.is-selected");
		row?.scrollIntoView?.({ block: "nearest" });
	}

	async _onClose(options) {
		clearTimeout(this.#saveTimer);
		await game.settings.set(SYSTEM, "grimoireState", this.#state()).catch(() => {});
		return super._onClose?.(options);
	}

	#rerender(parts = ["tabs", "filters", "list", "reading"]) {
		this.#save();
		return this.render({ parts });
	}

	#onContentLink(ev) {
		const link = ev.target.closest?.(".op-gr-text a.content-link[data-uuid]");
		const entry = link && this.#index?.find((e) => e.uuid === link.dataset.uuid);
		if (!entry) return;
		ev.preventDefault();
		ev.stopImmediatePropagation();
		this.#goTo(entry);
	}

	/** Abre o item na leitura, limpando busca e filtros. */
	#goTo(entry) {
		this.#query = "";
		const input = this.element.querySelector(".op-gr-search input");
		if (input) input.value = "";
		this.#filters = emptyFilters();
		this.#onlyActive = false;
		this.#tab = entry.kind;
		this.#selected = entry.uuid;
		this.#form = "basic";
		this.#drawer = true;
		this.#rerender();
	}

	#onQuery(value) {
		this.element.querySelector(".op-gr-clear")?.toggleAttribute("hidden", !value);
		this.#query = value;
		this.#selected = null;
		this.#form = "basic";
		this.#rerender();
	}

	#onChange(ev) {
		const el = ev.target;
		if (el.matches("[data-change='actor']")) {
			this.#actorId = el.value || null;
			this.#rerender();
		} else if (el.matches("[data-change='sort']")) {
			this.#sort = el.value === "relevance" && !this.#query.trim() ? "" : el.value;
			this.#rerender(["list", "reading", "filters"]);
		} else if (el.matches("[data-change='category']")) {
			this.#filters = { ...this.#filters, category: el.value ? [el.value] : [] };
			this.#rerender(["tabs", "filters", "list", "reading"]);
		}
	}

	#onKey(ev) {
		const root = this.element;
		const inInput = ev.target.matches("input, select, textarea");
		const width = root.querySelector(".window-content")?.clientWidth ?? root.clientWidth;
		const action = keyAction(ev, { inInput, hasQuery: Boolean(this.#query), drawerOpen: this.#drawer && layoutFor(width) === "stacked", onTabs: Boolean(ev.target.closest?.(".op-gr-tabs")) });
		if (!action) return;
		const stop = () => { ev.preventDefault(); ev.stopPropagation(); };
		switch (action) {
			case "focus-search": stop(); root.querySelector(".op-gr-search input")?.focus(); break;
			case "clear-search": stop(); this.#clearSearchField(); break;
			case "close-drawer": stop(); this.#drawer = false; this.render({ parts: ["reading"] }); break;
			case "close": stop(); this.close(); break;
			case "next": case "prev": stop(); this.#move(action === "next" ? 1 : -1); break;
			case "open-selected": stop(); this.#drawer = true; this.render({ parts: ["reading"] }); break;
			case "tab-next": case "tab-prev": stop(); this.#setTab(TABS[(TABS.findIndex((x) => x.id === this.#tab) + (action === "tab-next" ? 1 : TABS.length - 1)) % TABS.length].id); break;
			default:
				if (action.startsWith("tab-")) { stop(); this.#setTab(TABS[Number(action.slice(4)) - 1]?.id ?? this.#tab); }
		}
	}

	#clearSearchField() {
		this.#query = "";
		const input = this.element.querySelector(".op-gr-search input");
		if (input) input.value = "";
		this.#selected = null;
		this.#rerender();
	}

	#move(step) {
		if (!this.#results.length) return;
		const i = this.#results.indexOf(this.#selected);
		const next = this.#results[Math.min(this.#results.length - 1, Math.max(0, (i < 0 ? 0 : i + step)))];
		this.#selected = next;
		this.#form = "basic";
		this.#rerender(["list", "reading"]);
	}

	#setTab(id) {
		if (id === this.#tab) return;
		this.#tab = id;
		this.#selected = null;
		this.#form = "basic";
		this.#drawer = false;
		this.#moreOpen = false;
		this.#rerender();
	}

	/* -------------------------------------------- */
	/*  Ações                                       */
	/* -------------------------------------------- */

	static #selectTab(event, target) {
		this.#setTab(target.dataset.tab);
	}

	static #selectItem(event, target) {
		this.#selected = target.dataset.uuid;
		this.#form = "basic";
		this.#drawer = true;
		this.#menuOpen = false;
		this.#rerender(["list", "reading"]);
	}

	static #toggleFilter(event, target) {
		const { key, value, numeric } = target.dataset;
		const v = numeric === "true" ? Number(value) : value;
		this.#filters = toggleFilter(this.#filters, key, v);
		this.#selected = null;
		this.#rerender();
	}

	static #clearFilters() {
		this.#filters = emptyFilters();
		this.#onlyActive = false;
		this.#query = "";
		const input = this.element.querySelector(".op-gr-search input");
		if (input) input.value = "";
		this.#selected = null;
		this.#rerender();
	}

	static #clearSearch() {
		this.#clearSearchField();
		this.element.querySelector(".op-gr-search input")?.focus();
	}

	static #toggleMore() {
		this.#moreOpen = !this.#moreOpen;
		this.render({ parts: ["filters"] });
	}

	static #selectForm(event, target) {
		this.#form = target.dataset.form;
		this.render({ parts: ["reading"] });
	}

	static #back() {
		this.#drawer = false;
		this.render({ parts: ["reading"] });
		this.element.classList.remove("is-reading");
	}

	static #toggleSendMenu() {
		this.#menuOpen = !this.#menuOpen;
		this.element.querySelector(".op-gr-menu")?.toggleAttribute("hidden", !this.#menuOpen);
	}

	static #toggleOnlyActive() {
		this.#onlyActive = !this.#onlyActive;
		this.#selected = null;
		this.#rerender();
	}

	static #pickCondition(event, target) {
		const entry = this.#index?.find((e) => e.kind === "condition" && e.name === target.dataset.name);
		if (!entry) return;
		this.#query = "";
		const input = this.element.querySelector(".op-gr-search input");
		if (input) input.value = "";
		this.#filters = emptyFilters();
		this.#onlyActive = false;
		this.#selected = entry.uuid;
		this.#drawer = true;
		this.#rerender();
	}

	static #pickRelated(event, target) {
		const entry = this.#index?.find((e) => e.uuid === target.dataset.uuid);
		if (entry) this.#goTo(entry);
	}

	static #dismissChip(event, target) {
		this.#dismissedChips.add(target.dataset.id);
		this.#selected = null;
		this.#rerender();
	}

	static #quickInsert() {
		if (quickInsertActive()) globalThis.QuickInsert.open({ startText: this.#query });
	}

	static #toggleForMe() {
		this.#forMe = !(this.#forMe ?? true);
		this.#selected = null;
		this.#save();
		this.render({ parts: ["search", "tabs", "filters", "list", "reading"] });
	}

	static #showAll() {
		this.#forMe = false;
		this.#selected = null;
		this.#save();
		this.render({ parts: ["search", "tabs", "filters", "list", "reading"] });
	}

	static #toggleHelp() {
		this.#helpOpen = !this.#helpOpen;
		this.render({ parts: ["search"] });
	}

	static #toggleOnlyWished() {
		this.#onlyWished = !this.#onlyWished;
		this.#selected = null;
		this.#rerender();
	}

	static async #castRitual() {
		const entry = this.#index?.find((e) => e.uuid === this.#selected);
		const actor = this.#actor;
		const item = entry && actor?.itemTypes.ritual.find((i) => normalizeText(i.name) === normalizeText(entry.name));
		if (!item) return ui.notifications.warn(t("op.grimoire.cantCast"));
		const { runRitualCasterMacro } = await import("../macros/ritual-caster.mjs");
		await runRitualCasterMacro(actor, item.id);
	}

	/** Maldição aberta no Grimório: o agente escolhe qual item da ficha vira amaldiçoado. */
	static async #curseItem() {
		const entry = this.#index?.find((e) => e.uuid === this.#selected);
		const actor = this.#actor;
		if (!entry || entry.kind !== "curse") return;
		if (!actor) return ui.notifications.warn(t("op.grimoire.pickActor"));
		const doc = await fromUuid(entry.uuid).catch(() => null);
		if (doc) await applyCurseDocument(doc, { actor });
	}

	static async #copyLink(event, target) {
		const entry = this.#index?.find((e) => e.uuid === this.#selected);
		if (!entry) return;
		const text = `@UUID[${entry.uuid}]{${entry.name}}`;
		try {
			await navigator.clipboard.writeText(text);
			ui.notifications.info(t("op.grimoire.linkCopied", { name: entry.name }));
		} catch {
			ui.notifications.warn(t("op.grimoire.linkFailed"));
		}
	}

	static async #sendChat(event, target) {
		const entry = this.#index?.find((e) => e.uuid === this.#selected);
		if (!entry) return;
		const toGM = target.dataset.whisper === "gm";
		const actor = this.#actor;
		const sub = entry.kind === "curse" ? `${CURSE_APPLIES_LABELS[entry.curseKind] ?? ""} · ${ELEMENT_LABELS[entry.element] ?? ""}` : entry.kind === "skill" ? t("op.grimoire.skillSub") : entry.kind === "ritual" ? `${entry.circle}º círculo · ${ELEMENT_LABELS[entry.element] ?? ""}` : entry.kind === "power" ? ABILITY_TYPE_LABELS[entry.abilityType] : CONDITION_CATEGORIES[entry.category] ?? "Condição";
		const rule = entry.kind === "condition" ? escapeHtml(shortConditionRule(entry.summary)) : escapeHtml(entry.summary);
		const content = `<div class="op-gr-card">${entry.img ? `<img src="${escapeHtml(entry.img)}" alt="" width="48" height="48">` : ""}<div><strong>@UUID[${entry.uuid}]{${escapeHtml(entry.name)}}</strong><br><span class="op-gr-card-sub">${escapeHtml(sub)}</span><p>${rule}${entry.summary?.length >= 160 ? "…" : ""}</p></div></div>`;
		const data = { content, speaker: ChatMessage.getSpeaker({ actor: actor ?? undefined }) };
		if (toGM) data.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
		await ChatMessage.create(data);
		this.#menuOpen = false;
		this.element.querySelector(".op-gr-menu")?.setAttribute("hidden", "");
		ui.notifications.info(t(toGM ? "op.grimoire.sentToGM" : "op.grimoire.sentToAll", { name: entry.name }));
	}

	static async #toggleWish() {
		const entry = this.#index?.find((e) => e.uuid === this.#selected);
		const actor = this.#actor;
		if (!entry) return;
		if (!actor) return ui.notifications.warn(t("op.grimoire.pickActor"));
		const list = new Set(actor.getFlag(SYSTEM, "grimoire.wishlist") ?? []);
		const added = !list.has(entry.uuid);
		if (added) list.add(entry.uuid);
		else list.delete(entry.uuid);
		await actor.setFlag(SYSTEM, "grimoire.wishlist", [...list]);
		ui.notifications.info(t(added ? "op.grimoire.wished" : "op.grimoire.unwished", { name: entry.name }));
		if (added && !game.user.isGM && game.settings.get(SYSTEM, "grimoireWishlistNotify")) {
			// aviso curto, só para os Mestres (sussurro); desligável pela configuração do mundo
			await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), speaker: ChatMessage.getSpeaker({ actor }), content: t("op.grimoire.wishNotice", { actor: escapeHtml(actor.name), link: `@UUID[${entry.uuid}]{${escapeHtml(entry.name)}}` }) });
		}
		this.render({ parts: ["reading"] });
	}
}

export { LAYOUT_BREAKPOINT, grimoirePackIds };
