// Compila e renderiza os templates do Grimório com o Handlebars do Foundry e dados de exemplo (estados: lista cheia, leitura de
// ritual com forma, vazio com sugestões, condições com "Você está", poder). Pega erro de sintaxe e chave de tradução faltando.
// Uso: npm run render-check  (roda junto com o da ficha de ameaça). Variáveis: GRIMORIO_ROOT (pasta do sistema), GRIMORIO_LANG (pasta lang).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// Usa o Handlebars do Foundry instalado (FOUNDRY_APP) quando existe; sem ele (CI, clone novo) usa o do projeto (devDependency).
const install = process.env.FOUNDRY_APP ?? "C:\\Users\\Geh\\VTT\\Foundry Virtual Tabletop\\resources\\app";
const require = createRequire(existsSync(path.join(install, "package.json")) ? path.join(install, "package.json") : import.meta.url);
const Handlebars = require("handlebars");
const root = path.resolve(process.env.GRIMORIO_ROOT ?? "systems/ordem-v2-classic");
const langDir = path.resolve(process.env.GRIMORIO_LANG ?? path.join(root, "lang"));
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const ptKeys = JSON.parse(readFileSync(path.join(langDir, "pt-BR.json"), "utf8"));
const enKeys = JSON.parse(readFileSync(path.join(langDir, "en.json"), "utf8"));

const used = new Set();
const hb = Handlebars.create();
hb.registerHelper("localize", (k) => { used.add(k); return `«${k}»`; });
const render = (name, ctx) => hb.compile(read(`templates/apps/grimoire-${name}.hbs`))(ctx);

const row = (o) => ({ uuid: `u.${o.name}`, img: null, selected: false, approx: false, rowStyle: "--gr-accent:#b3262d;", sub: "2º círculo · Morte", meta: "3 PE", isRitual: true, spriteX: 25, fallbackClass: "is-death", ...o });
const reading = {
	uuid: "u.Paradoxo", name: "Paradoxo", kind: "ritual", isRitual: true, img: "systems/x/paradoxo.png", subtitle: "2º círculo · Morte", spriteX: 25, elementClass: "is-death", hidden: false, wished: false, canWish: true, hasActor: true, sourceLabel: "Livro de Regras",
	cells: [{ key: "execution", label: "Execução", icon: "hourglass-start", value: "Padrão" }, { key: "cost", label: "Custo", icon: "droplet", value: "3 PE" }],
	functions: [{ name: "Dano" }, { name: "Controle" }],
	formTabs: [{ id: "basic", label: "Básico", active: true }, { id: "student", label: "Discente", active: false }],
	formCost: "3 PE", formExtra: "", body: "<p>Texto do ritual.</p>",
};
const base = {
	tabs: [{ id: "ritual", icon: "fa-book-skull", label: "Rituais", count: 98, active: true }, { id: "power", icon: "fa-hand-sparkles", label: "Poderes", count: 316, active: false }, { id: "condition", icon: "fa-skull", label: "Condições", count: 37, active: false }],
	actors: [{ id: "a1", name: "Caio Menezes", selected: true }], hasActor: true, query: "", hasQuery: false, announce: "2 resultados", tab: "ritual",
	filterRows: [{ key: "element", label: "Elemento", numeric: false, chips: [{ value: "blood", label: "Sangue", count: 22, active: false, spriteX: 0, elementClass: "is-blood" }] }, { key: "circle", label: "Círculo", numeric: true, chips: [{ value: 1, label: "1º", count: 33, active: true }] }],
	moreRows: [{ key: "functions", label: "Função", chips: [{ value: "Dano", label: "Dano", count: 40, active: false }] }], moreOpen: true, moreCount: 1, activeFilters: 1,
	conditionBar: null, youAre: [], hasYouAre: false, noYouAre: false,
	sortOptions: [{ value: "circle", label: "Círculo", selected: true }], rows: [row({ name: "Paradoxo", selected: true }), row({ name: "Eco Espiral", approx: true })], compact: false, summary: "2 de 98",
	approximate: false, onlyApproximate: false, bestGuess: null, suggestions: [], empty: false, packsNote: "", drawer: false, accentStyle: "--gr-accent:#b3262d;", reading, hasSelection: true,
	canForMe: true, forMe: true, helpOpen: false, showAll: false, forMeEmpty: false, forMeEmptyText: "", isGM: false, wishTotal: 0, onlyWished: false,
};

const must = (html, ...frags) => frags.forEach((f) => assert.ok(html.includes(f), `faltou "${f}" em:\n${html.slice(0, 400)}`));
const clean = (html, label) => {
	assert.ok(!/undefined|\[object|NaN|\{\{/.test(html), `${label}: lixo no HTML`);
	const open = (html.match(/<(div|section|ul|li|nav|button|span|header|footer|dl|label|select|p)\b/g) ?? []).length;
	const close = (html.match(/<\/(div|section|ul|li|nav|button|span|header|footer|dl|label|select|p)>/g) ?? []).length;
	assert.equal(open, close, `${label}: tags desbalanceadas (${open} abrem, ${close} fecham)`);
};

// 1. lista cheia + abas + filtros + leitura de ritual
let html = render("tabs", base); clean(html, "tabs"); must(html, "Rituais", "98", "Caio Menezes", 'role="tablist"', 'data-tab="power"');
html = render("search", base); clean(html, "search"); must(html, "op.grimoire.searchPlaceholder", "data-action=\"clearSearch\"");
html = render("filters", base); clean(html, "filters"); must(html, 'data-key="element"', 'data-value="blood"', 'data-numeric="true"', "op-gr-morepanel", "Dano");
html = render("list", base); clean(html, "list"); must(html, "Paradoxo", "Eco Espiral", "is-selected", "is-approx", "2 de 98", 'role="listbox"');
html = render("reading", base); clean(html, "reading"); must(html, "Paradoxo", "Execução", "Discente", "Texto do ritual.", "data-action=\"toggleWish\"", "data-action=\"sendChat\"", 'data-whisper="gm"', "op.grimoire.back", "is-death");

// 2. vazio com "Você quis dizer", busca aproximada e aviso do pacote
html = render("list", { ...base, rows: [], empty: true, emptyText: "Nada com \"xyz\" aqui.", shown: 0, summary: "0 de 98", suggestions: [{ name: "Paradoxo" }], onlyApproximate: true, bestGuess: "Paradoxo", packsNote: "aviso do pacote" });
clean(html, "list vazio"); must(html, "Nada com", "op.grimoire.didYouMean", "<em>Paradoxo</em>", "op.grimoire.nothingExact", "aviso do pacote");
html = render("list", { ...base, compact: true }); clean(html, "list compacta"); assert.ok(!html.includes("op-gr-thumb"), "lista compacta não tem miniatura");

// 3. condições: "Você está", barra de controles, leitura de condição
const cond = { ...base, tab: "condition", hasYouAre: true, youAre: [{ name: "Abalado" }, { name: "Sangrando" }], conditionBar: { onlyActive: true, hasActor: true, categories: [{ value: "", label: "Todas", selected: true }, { value: "mental", label: "Mental / Medo (10)", selected: false }] }, filterRows: [], moreRows: [] };
html = render("filters", cond); clean(html, "filters condições"); must(html, 'data-action="pickCondition"', 'data-name="Abalado"', "op.grimoire.activeOnMe", 'data-change="category"', "Mental / Medo (10)");
html = render("filters", { ...cond, youAre: [], noYouAre: true }); must(html, "op.grimoire.noConditions");
html = render("filters", { ...cond, hasActor: false, conditionBar: { ...cond.conditionBar, hasActor: false } }); must(html, "disabled");
html = render("reading", { ...cond, reading: { uuid: "u.Abalado", name: "Abalado", kind: "condition", isCondition: true, subtitle: "Mental / Medo", rule: "Regra curta.", blocks: [{ title: null, body: "<p>Texto.</p>" }, { title: "Efeitos", body: "<p>−1.</p>" }], canWish: false, hasActor: true } });
clean(html, "reading condição"); must(html, "Regra curta.", "Efeitos", "op-gr-rule"); assert.ok(!html.includes("toggleWish"), "condição não tem ★");

// 4. poder e estado sem seleção
html = render("reading", { ...base, reading: { uuid: "u.P", name: "Golpe Pesado", kind: "power", isPower: true, subtitle: "Classe · Combatente", prerequisite: "NEX 10%", cells: [{ label: "Custo", value: "2 PE" }], body: "<p>Texto.</p>", canWish: true, hasActor: true, wished: true } });
clean(html, "reading poder"); must(html, "NEX 10%", "op.grimoire.wishedBtn", 'aria-pressed="true"');
html = render("reading", { ...base, reading: null, hasSelection: false }); must(html, "op.grimoire.pickOne");

// 6. Fase 2: "Para mim", ajuda, selos, mostrar todos, vazio do "Para mim", disponibilidade, Conjurar, aviso do Mestre
html = render("search", base); clean(html, "search para mim"); must(html, 'role="switch"', 'aria-checked="true"', 'data-action="toggleForMe"', 'data-action="toggleHelp"', "op.grimoire.forMe");
assert.ok(!html.includes("op-gr-help\""), "ajuda fechada não aparece");
html = render("search", { ...base, helpOpen: true }); must(html, "op-gr-help", "op.grimoire.forMeHelp");
html = render("search", { ...base, canForMe: false }); assert.ok(!html.includes("toggleForMe"), "sem personagem o interruptor some");
html = render("list", { ...base, rows: [row({ name: "Possessão", seal: { id: "later", label: "Ainda não", icon: "fa-lock", reason: "Falta NEX 85%" } }), row({ name: "Cicatrização", seal: { id: "have", label: "Você já tem", icon: "fa-check" } }), row({ name: "Paradoxo" })], showAll: true, summary: "3 de 98" });
clean(html, "list com selos"); must(html, "op-gr-seal is-later", "Falta NEX 85%", "op-gr-seal is-have", 'data-action="showAll"', "op-gr-rowreason");
assert.equal((html.match(/op-gr-seal/g) ?? []).length, 2, "só as exceções levam selo");
html = render("list", { ...base, rows: [], empty: true, forMeEmpty: true, forMeEmptyText: "Sua classe não aprende rituais por padrão.", summary: "0 de 98" });
clean(html, "vazio do Para mim"); must(html, "Sua classe não aprende rituais", 'data-action="showAll"');
html = render("reading", { ...base, reading: { ...reading, availText: "Ainda não: Falta NEX 55%", availTone: "later", canCast: true, hasWishers: true, wishers: [{ name: "Caio" }, { name: "Mila" }] } });
clean(html, "reading fase 2"); must(html, "op-gr-avail is-later", "Falta NEX 55%", 'data-action="castRitual"', "op.grimoire.cast", "Caio, Mila", "op.grimoire.markedBy");
html = render("filters", { ...base, isGM: true, wishTotal: 3, onlyWished: true }); clean(html, "filters Mestre"); must(html, 'data-action="toggleOnlyWished"', "(3)", "is-active");
html = render("filters", { ...base, wishTotal: 0 }); assert.ok(!html.includes("toggleOnlyWished"), "sem marcações o chip do Mestre some");

// 5. toda chave de tradução usada existe em pt-BR e en
for (const key of used) {
	assert.ok(key in ptKeys, `chave ausente em pt-BR: ${key}`);
	assert.ok(key in enKeys, `chave ausente em en: ${key}`);
}
console.log(`render-check-grimoire ok (${used.size} chaves de tradução conferidas)`);
