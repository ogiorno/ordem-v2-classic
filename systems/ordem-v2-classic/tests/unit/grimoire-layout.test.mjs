// Rodar: npm test. Layout (GR-22/28), teclado (GR-20/59), personagem em foco (GR-51), cores (GR-24) e condições (GR-54).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_BREAKPOINT, keyAction, layoutFor, pickFocusActor } from "../../module/helpers/grimoire-layout.mjs";
import { ELEMENT_THEME, SURFACE, contrastRatio, themeFor } from "../../module/helpers/grimoire-colors.mjs";
import { KNOWN_CONDITIONS, activeConditionNames, conditionCategory } from "../../module/helpers/grimoire-conditions.mjs";

describe("layout por largura", () => {
	it("lado a lado a partir de 700 px, empilhado abaixo", () => {
		assert.equal(LAYOUT_BREAKPOINT, 700);
		assert.deepEqual([320, 420, 699].map(layoutFor), ["stacked", "stacked", "stacked"]);
		assert.deepEqual([700, 760, 1200].map(layoutFor), ["side", "side", "side"]);
		assert.equal(layoutFor(undefined), "stacked");
	});
});

describe("teclado sem conflito com o Foundry", () => {
	const k = (key, extra = {}) => ({ key, ...extra });
	it("nenhuma tecla numérica solta vira ação (os números disparam macros da barra de atalhos)", () => {
		for (const d of "0123456789") {
			assert.equal(keyAction(k(d)), null, d);
			assert.equal(keyAction(k(d), { inInput: true }), null, d);
		}
	});
	it("Ctrl+1 a 4 vão direto à aba; Ctrl+5 em diante e Alt não fazem nada", () => {
		assert.equal(keyAction(k("1", { ctrlKey: true })), "tab-1");
		assert.equal(keyAction(k("3", { metaKey: true })), "tab-3");
		assert.equal(keyAction(k("4", { ctrlKey: true })), "tab-4");
		assert.equal(keyAction(k("5", { ctrlKey: true })), null);
		assert.equal(keyAction(k("1", { altKey: true })), null);
		assert.equal(keyAction(k("a", { ctrlKey: true })), null);
	});
	it("/ foca a busca, mas não dentro de um campo de texto", () => {
		assert.equal(keyAction(k("/")), "focus-search");
		assert.equal(keyAction(k("/"), { inInput: true }), null);
	});
	it("Esc: limpa a busca se tem texto; senão fecha a gaveta; senão fecha a janela", () => {
		assert.equal(keyAction(k("Escape"), { inInput: true, hasQuery: true }), "clear-search");
		assert.equal(keyAction(k("Escape"), { inInput: true, hasQuery: false, drawerOpen: true }), "close-drawer");
		assert.equal(keyAction(k("Escape"), { drawerOpen: true }), "close-drawer");
		assert.equal(keyAction(k("Escape")), "close");
	});
	it("setas movem na lista; ← → trocam de aba só com o foco nas abas; Enter seleciona fora do campo", () => {
		assert.equal(keyAction(k("ArrowDown")), "next");
		assert.equal(keyAction(k("ArrowUp")), "prev");
		assert.equal(keyAction(k("ArrowRight")), null);
		assert.equal(keyAction(k("ArrowRight"), { onTabs: true }), "tab-next");
		assert.equal(keyAction(k("ArrowLeft"), { onTabs: true }), "tab-prev");
		assert.equal(keyAction(k("Enter")), "open-selected");
		assert.equal(keyAction(k("Enter"), { inInput: true }), null);
	});
});

describe("personagem em foco (GR-51)", () => {
	const a = (id, type = "agent") => ({ id, type });
	it("o personagem do usuário vem primeiro", () => {
		assert.equal(pickFocusActor({ userCharacter: a("c"), controlled: [a("t")], owned: [a("o")] }).id, "c");
	});
	it("sem personagem, vale o token selecionado (um só)", () => {
		assert.equal(pickFocusActor({ controlled: [a("t")], owned: [a("o1"), a("o2")] }).id, "t");
		assert.equal(pickFocusActor({ controlled: [a("t"), a("t")] }).id, "t"); // dois tokens do mesmo agente
	});
	it("sem token, vale o único agente que o usuário possui", () => {
		assert.equal(pickFocusActor({ owned: [a("o1")] }).id, "o1");
	});
	it("dois tokens diferentes ou dois agentes: não adivinha", () => {
		assert.equal(pickFocusActor({ controlled: [a("t1"), a("t2")] }), null);
		assert.equal(pickFocusActor({ owned: [a("o1"), a("o2")] }), null);
	});
	it("ameaça nunca é o personagem em foco", () => {
		assert.equal(pickFocusActor({ userCharacter: a("x", "threat"), controlled: [a("y", "threat")], owned: [a("z", "threat")] }), null);
	});
});

describe("cores dos elementos (GR-24): contraste AA no tema escuro", () => {
	for (const [nome, t] of Object.entries(ELEMENT_THEME)) {
		it(`${nome}: texto de destaque ≥ 4,5, borda ≥ 3 e texto sobre o preenchimento ≥ 4,5`, () => {
			assert.ok(contrastRatio(t.ink, SURFACE) >= 4.5, `ink ${contrastRatio(t.ink, SURFACE).toFixed(2)}`);
			assert.ok(contrastRatio(t.edge, SURFACE) >= 3, `edge ${contrastRatio(t.edge, SURFACE).toFixed(2)}`);
			assert.ok(contrastRatio(t.onAccent, t.accent) >= 4.5, `onAccent ${contrastRatio(t.onAccent, t.accent).toFixed(2)}`);
		});
	}
	it("Morte é cinza e Medo é preto (preenchimento quase preto com borda clara)", () => {
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(themeFor("death").accent.slice(i, i + 2), 16));
		assert.ok(Math.abs(r - g) < 12 && Math.abs(g - b) < 12, "cinza = canais próximos");
		assert.ok(parseInt(themeFor("fear").accent.slice(1, 3), 16) < 20, "preto");
	});
	it("elemento desconhecido cai no padrão vermelho", () => assert.equal(themeFor("x"), ELEMENT_THEME.default));
	it("a razão de contraste conhece os extremos", () => {
		assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
		assert.equal(contrastRatio("#777777", "#777777"), 1);
	});
});

describe("condições", () => {
	it("as 37 do livro estão categorizadas em seis categorias", () => {
		assert.equal(KNOWN_CONDITIONS.length, 37);
		assert.ok(KNOWN_CONDITIONS.every((n) => conditionCategory(n)));
		assert.equal(conditionCategory("abalado"), "mental");
		assert.equal(conditionCategory("EM CHAMAS"), "damage");
		assert.equal(conditionCategory("Inventada"), null);
	});
	it("'Você está': condições ativas pelo status oficial ou pelo nome do efeito, sem repetir", () => {
		const efeitos = [
			{ name: "Atordoado", statuses: ["stun"] },
			{ name: "Enjoado (1 rodada)", statuses: [] },
			{ name: "Sangrando", statuses: ["bleeding"] },
			{ name: "Sangrando ×2", statuses: [] },
			{ name: "Bônus de Vontade", statuses: [] },
			{ name: "Surdo", statuses: ["deaf"], disabled: true },
		];
		assert.deepEqual(activeConditionNames(efeitos), ["Atordoado", "Enjoado", "Sangrando"]);
		assert.deepEqual(activeConditionNames([]), []);
	});
});
