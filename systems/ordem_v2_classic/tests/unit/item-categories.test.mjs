// Rodar: npm test. Categoria dos itens, modificações e limite da patente (docs/spec-categoria-de-itens.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROTECTION_MODIFICATIONS, WEAPON_MODIFICATIONS, categoryLabel, categoryReducer, categoryUsage, effectiveCategory, itemCategoryInfo, modificationCount } from "../../module/helpers/item-categories.mjs";
import { calculatePatent } from "../../module/helpers/actor-calculations.mjs";

const arma = (category, mods = [], quantity = 1) => ({ type: "armament", system: { category, modifications: new Set(mods), quantity } });
const prot = (category, mods = []) => ({ type: "protection", system: { category, modifications: new Set(mods), quantity: 1 } });
const geral = (category, quantity = 1) => ({ type: "generalEquipment", system: { category, quantity } });
const patente = (pontos) => calculatePatent(pontos);

describe("categoria final do item", () => {
	it("cada modificação sobe a categoria em I (katana I + certeira + perigosa = III)", () => {
		assert.equal(effectiveCategory(arma(1, ["certeira", "perigosa"])), 3);
		assert.equal(effectiveCategory(arma(1)), 1);
		assert.equal(effectiveCategory(arma(0, ["tatica"])), 1);
	});
	it("modificação repetida ou vazia não soma (modificações iguais não se acumulam)", () => {
		assert.equal(modificationCount({ modifications: ["certeira", "certeira", ""] }), 1);
		assert.equal(modificationCount({}), 0);
	});
	it("aceita lista comum e Set", () => {
		assert.equal(effectiveCategory({ system: { category: 2, modifications: ["cruel"] } }), 3);
		assert.equal(effectiveCategory({ system: { category: 2, modifications: new Set(["cruel"]) } }), 3);
	});
	it("rótulos: 0, I a IV, V em diante", () => {
		assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(categoryLabel), ["0", "I", "II", "III", "IV", "V", "VI"]);
	});
	it("as listas das tabelas 3.5 e 3.7 estão completas", () => {
		assert.equal(Object.keys(WEAPON_MODIFICATIONS).length, 15);
		assert.deepEqual(Object.keys(PROTECTION_MODIFICATIONS).sort(), ["antibombas", "blindada", "discreta", "reforcada"]);
	});
});

describe("uso do limite da patente (Tabela 3.1)", () => {
	it("recruta com um item de categoria III: o III passa do limite (—)", () => {
		const u = categoryUsage([arma(1, ["certeira", "perigosa"])], patente(0));
		const iii = u.rows.find((r) => r.cat === 3);
		assert.deepEqual([iii.used, iii.limit, iii.over], [1, 0, true]);
		assert.ok(u.anyOver);
		assert.ok(!u.rows.find((r) => r.cat === 1).over);
	});
	it("dentro do limite não marca nada", () => {
		const u = categoryUsage([arma(1), arma(1), geral(1)], patente(0));
		assert.equal(u.rows[0].limit, 2);
		assert.ok(u.rows[0].over); // recruta só pode 2 de categoria I e aqui há 3
		const ok = categoryUsage([arma(1), arma(1)], patente(0));
		assert.ok(!ok.anyOver);
	});
	it("operador: 3 de I e 1 de II", () => {
		const p = patente(20);
		assert.deepEqual([p.itemLimit1, p.itemLimit2], [3, 1]);
		assert.ok(!categoryUsage([arma(1), arma(1), arma(1), arma(2)], p).anyOver);
		assert.ok(categoryUsage([arma(1), arma(2), arma(2)], p).rows[1].over);
	});
	it("categoria 0 nunca conta", () => {
		assert.equal(categoryUsage([arma(0), geral(0, 5), prot(0)], patente(0)).rows.every((r) => r.used === 0), true);
	});
	it("a quantidade conta: duas facas modificadas são dois itens", () => {
		assert.equal(categoryUsage([arma(1, [], 2)], patente(50)).rows[0].used, 2);
		assert.equal(categoryUsage([geral(1, 3)], patente(50)).rows[0].used, 3);
	});
	it("acima de IV: sempre passa do limite, em linha à parte", () => {
		const u = categoryUsage([arma(4, ["certeira"])], patente(200));
		assert.deepEqual([u.above.used, u.above.over, u.anyOver], [1, true, true]);
		assert.ok(u.rows.every((r) => r.used === 0));
	});
	it("só armas, proteções e equipamentos entram", () => {
		const u = categoryUsage([{ type: "ability", system: { category: 3 } }, { type: "ritual", system: { category: 2 } }], patente(0));
		assert.ok(!u.anyOver);
	});
	it("patente sem a categoria no limite (null) conta como 0", () => {
		assert.equal(patente(20).itemLimit3, null);
		assert.equal(categoryUsage([], patente(20)).rows[2].limit, 0);
	});
});

describe("situação de cada item", () => {
	it("a pílula da arma modificada fica vermelha quando a categoria passa", () => {
		const katana = arma(1, ["certeira", "perigosa"]);
		const u = categoryUsage([katana], patente(0));
		const info = itemCategoryInfo(katana, u);
		assert.deepEqual([info.category, info.label, info.over], [3, "III", true]);
		assert.match(info.tip, /I \+ 2 modificações = III/);
	});
	it("com patente suficiente não fica vermelha", () => {
		const katana = arma(1, ["certeira", "perigosa"]);
		const info = itemCategoryInfo(katana, categoryUsage([katana], patente(100)));
		assert.equal(info.over, false);
	});
	it("item de categoria 0 nunca fica vermelho", () => {
		assert.equal(itemCategoryInfo(geral(0), categoryUsage([], patente(0))).over, false);
	});
});

describe("tabela 3.5: toda modificação de arma sobe a categoria em I", () => {
	const livro = ["Certeira", "Cruel", "Discreta", "Perigosa", "Tática", "Alongada", "Calibre Grosso", "Compensador", "Ferrolho Automático", "Mira Laser", "Mira Telescópica", "Silenciador", "Visão de Calor", "Munição Dum dum", "Munição Explosiva"];
	it("a lista cobre as 15 modificações do livro", () => {
		const nomes = Object.values(WEAPON_MODIFICATIONS).map((n) => n.replace(/^Munição /, ""));
		for (const m of livro) assert.ok(nomes.includes(m.replace(/^Munição /, "")), m);
	});
	it("cada uma, sozinha, leva uma arma de categoria I para II", () => {
		for (const key of Object.keys(WEAPON_MODIFICATIONS)) assert.equal(effectiveCategory(arma(1, [key])), 2, key);
	});
	it("todas juntas somam 15", () => {
		assert.equal(effectiveCategory(arma(1, Object.keys(WEAPON_MODIFICATIONS))), 16);
	});
});

describe("habilidades que reduzem a categoria", () => {
	const fav = (item) => ({ ...item, system: { ...item.system, favorite: true } });
	it("A Favorita (NEX 10%): arma favorita −I; só a marcada", () => {
		const r = categoryReducer(["NEX 10% - A Favorita"]);
		assert.equal(effectiveCategory(fav(arma(2)), r), 1);
		assert.equal(effectiveCategory(arma(2), r), 2);
	});
	it("Técnica Secreta −II e Máquina de Matar −III não somam com A Favorita", () => {
		assert.equal(effectiveCategory(fav(arma(3)), categoryReducer(["A Favorita", "NEX 40% - Técnica Secreta"])), 1);
		assert.equal(effectiveCategory(fav(arma(4)), categoryReducer(["A Favorita", "Técnica Secreta", "NEX 99% - Máquina de Matar"])), 1);
	});
	it("a redução nunca deixa a categoria abaixo de 0", () => {
		assert.equal(effectiveCategory(fav(arma(1)), categoryReducer(["Máquina de Matar"])), 0);
	});
	it("arma modificada favorita: a redução abre espaço para mais modificações", () => {
		const r = categoryReducer(["Técnica Secreta"]);
		const katana = fav(arma(2, ["certeira", "perigosa"])); // II + 2 = IV, −II = II
		assert.equal(effectiveCategory(katana, r), 2);
		assert.equal(effectiveCategory(fav(arma(2, ["certeira", "perigosa", "cruel", "tatica"])), r), 4);
	});
	it("sem a habilidade, marcar favorito não muda nada", () => {
		assert.equal(effectiveCategory(fav(arma(2)), categoryReducer([])), 2);
	});
	it("Ferramentas Favoritas: um item (exceto arma) −I", () => {
		const r = categoryReducer(["Ferramentas Favoritas"]);
		assert.equal(effectiveCategory(fav(prot(3)), r), 2);
		assert.equal(effectiveCategory(fav(geral(2)), r), 1);
		assert.equal(effectiveCategory(fav(arma(2)), r), 2);
		assert.equal(effectiveCategory(geral(2), r), 2);
	});
	it("Remendão: todo equipamento geral −I, proteção e arma não", () => {
		const r = categoryReducer(["NEX 40% - Remendão"]);
		assert.equal(effectiveCategory(geral(2), r), 1);
		assert.equal(effectiveCategory(prot(2), r), 2);
		assert.equal(effectiveCategory(arma(2), r), 2);
	});
	it("o limite da patente usa a categoria reduzida", () => {
		const katana = fav(arma(1, ["certeira", "perigosa"])); // III
		const sem = categoryUsage([katana], patente(20));
		assert.ok(sem.anyOver);
		const r = categoryReducer(["Técnica Secreta"]); // III −II = I
		const com = categoryUsage([katana], patente(20), r);
		assert.ok(!com.anyOver);
		assert.equal(com.rows[0].used, 1);
		const info = itemCategoryInfo(katana, com, r);
		assert.deepEqual([info.category, info.reduced, info.over], [1, 2, false]);
		assert.match(info.tip, /I \+ 2 modificações − 2 \(habilidade\) = I/);
	});
});
