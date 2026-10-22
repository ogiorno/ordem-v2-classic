// Rodar: npm test. Barra inferior automática (docs/arquivo/spec-hotbar-automatica.md): regras puras.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	belongsOnHotbar, extraRowPages, freeHotbarSlot, hotbarMacroData, hotbarMacroInfo, hotbarSlotsOf, hotbarTransition, normalizeRows, orphanMacroIds, stepRows, visibleRows,
} from "../../module/helpers/hotbar-rules.mjs";
import { weaponMacroInfo } from "../../module/helpers/weapon-macros.mjs";

const agent = { id: "ator1", type: "agent" };
const item = (type, system = {}, parent = agent, extra = {}) => ({ id: `i-${type}`, name: "X", img: "i.png", type, system, parent, ...extra });

describe("quem entra na barra (HB-T01 a T03)", () => {
	it("arma sempre; ritual salvo passivo; vazio entra", () => {
		assert.equal(belongsOnHotbar(item("armament")), true);
		assert.equal(belongsOnHotbar(item("ritual", { execution: "default" })), true);
		assert.equal(belongsOnHotbar(item("ritual", { execution: "" })), true);
		assert.equal(belongsOnHotbar(item("ritual", { execution: "passive" })), false);
	});
	it("não entram classe, origem, trilha, proteção, munição, equipamento", () => {
		for (const type of ["class", "origin", "path", "protection", "ammunition", "generalEquipment"]) assert.equal(belongsOnHotbar(item(type)), false, type);
	});
	it("habilidade: execuções ativas entram; passiva e vazia não", () => {
		for (const activation of ["free", "movement", "default", "complete", "reaction"]) assert.equal(belongsOnHotbar(item("ability", { activation })), true, activation);
		assert.equal(belongsOnHotbar(item("ability", { activation: "passive" })), false);
		assert.equal(belongsOnHotbar(item("ability", { activation: "" })), false);
		assert.equal(belongsOnHotbar(item("ability", {})), false);
	});
	it("ameaça, item solto e item sem dono não entram", () => {
		const threat = { id: "t1", type: "threat" };
		for (const type of ["armament", "ritual", "ability"]) {
			assert.equal(belongsOnHotbar(item(type, { execution: "default", activation: "free" }, threat)), false, type);
			assert.equal(belongsOnHotbar(item(type, { execution: "default", activation: "free" }, null)), false, type);
		}
	});
});

describe("dados da macro (HB-T04, HB-T05)", () => {
	it("usa o id do agente e do item e guarda de onde veio", () => {
		const m = hotbarMacroData(item("ritual", { execution: "default" }));
		assert.equal(m.command, "ordemparanormal.documents.macro.rollItemById('ator1', 'i-ritual')");
		assert.deepEqual(hotbarMacroInfo(m), { actorId: "ator1", itemId: "i-ritual", kind: "ritual" });
		assert.equal(m.flags["ordem-v2-classic"].itemMacro, true);
	});
	it("arma continua com a marca antiga", () => {
		const m = hotbarMacroData(item("armament"));
		assert.deepEqual(m.flags["ordem-v2-classic"].weaponMacro, { actorId: "ator1", itemId: "i-armament" });
		assert.deepEqual(weaponMacroInfo(m), { actorId: "ator1", itemId: "i-armament", kind: "weapon" });
	});
	it("lê só a marca antiga de macros já criadas", () => {
		assert.deepEqual(hotbarMacroInfo({ flags: { "ordem-v2-classic": { weaponMacro: { actorId: "a", itemId: "b" } } } }), { actorId: "a", itemId: "b" });
		assert.equal(hotbarMacroInfo({ flags: {} }), null);
		assert.equal(hotbarMacroInfo(null), null);
	});
	it("aspas no id não quebram o comando", () => {
		assert.ok(hotbarMacroData({ ...item("armament"), id: "d'x" }).command.includes(String.raw`'d\'x'`));
	});
});

describe("transição de execução (HB-T06)", () => {
	it("passiva→ativa cria; ativa→passiva remove; ativa→ativa nada", () => {
		assert.equal(hotbarTransition(false, true), "add");
		assert.equal(hotbarTransition(true, false), "remove");
		assert.equal(hotbarTransition(true, true), "none");
		assert.equal(hotbarTransition(false, false), "none");
	});
	it("sem saber o estado anterior só remove, nunca recria (HB-33)", () => {
		assert.equal(hotbarTransition(undefined, true), "none");
		assert.equal(hotbarTransition(undefined, false), "remove");
	});
});

describe("espaços da barra (HB-T07, HB-T09)", () => {
	it("primeiro espaço vazio", () => {
		assert.equal(freeHotbarSlot({}), 1);
		assert.equal(freeHotbarSlot({ 1: "a", 2: "b", 4: "c" }), 3);
		assert.equal(freeHotbarSlot(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i + 1, "x"]))), null);
	});
	it("acha os espaços de uma macro", () => {
		assert.deepEqual(hotbarSlotsOf({ 1: "a", 2: "b", 7: "a" }, ["a"]), ["1", "7"]);
		assert.deepEqual(hotbarSlotsOf({ 1: "a" }, ["z"]), []);
	});
	it("buraco reaproveitado: o item novo ocupa o lugar do removido e ninguém anda", () => {
		const bar = { 1: "arma", 2: "ritual", 3: "hab" };
		delete bar[1];
		assert.equal(freeHotbarSlot(bar), 1);
		bar[freeHotbarSlot(bar)] = "arma2";
		assert.deepEqual(bar, { 1: "arma2", 2: "ritual", 3: "hab" });
		delete bar[1]; delete bar[2];
		const first = freeHotbarSlot(bar); bar[first] = "n1";
		const second = freeHotbarSlot(bar); bar[second] = "n2";
		assert.deepEqual([first, second], [1, 2]);
		assert.equal(bar[3], "hab");
	});
});

describe("macros órfãs (HB-T08)", () => {
	const mk = (id, actorId, itemId) => ({ id, flags: { "ordem-v2-classic": { hotbarMacro: { actorId, itemId } } } });
	it("devolve só as cujo item ou agente sumiu, ou que deixaram de ser elegíveis", () => {
		const items = { "a:vivo": item("ritual", { execution: "default" }), "a:passiva": item("ability", { activation: "passive" }) };
		const lookup = (actorId, itemId) => items[`${actorId}:${itemId}`] ?? null;
		const macros = [mk("m1", "a", "vivo"), mk("m2", "a", "sumiu"), mk("m3", "b", "vivo"), mk("m4", "a", "passiva"), { id: "feita-a-mao", flags: {} }];
		assert.deepEqual(orphanMacroIds(macros, lookup), ["m2", "m3", "m4"]);
	});
});

describe("linhas visíveis (HB-T10)", () => {
	const barra = (...slots) => Object.fromEntries(slots.map((s) => [s, "m"]));
	it("normaliza a configuração", () => {
		assert.equal(normalizeRows("auto"), "auto");
		assert.equal(normalizeRows("2"), 2);
		assert.equal(normalizeRows(5), 3);
		assert.equal(normalizeRows(4), 3);
		assert.equal(normalizeRows("lixo"), "auto");
		assert.equal(normalizeRows(0), "auto");
		assert.equal(normalizeRows(undefined), "auto");
	});
	it("automático conta até o maior espaço ocupado, de 1 a 3", () => {
		assert.equal(visibleRows("auto", {}), 1);
		assert.equal(visibleRows("auto", barra(1, 10)), 1);
		assert.equal(visibleRows("auto", barra(1, 11)), 2);
		assert.equal(visibleRows("auto", barra(21)), 3);
		assert.equal(visibleRows("auto", barra(50)), 3);
	});
	it("valor fixo devolve o próprio valor", () => {
		assert.equal(visibleRows(1, barra(30)), 1);
		assert.equal(visibleRows("3", {}), 3);
	});
	it("componente −/+ : Auto → 1 → 2 → 3, parando nos limites", () => {
		assert.equal(stepRows("auto", 1), 1);
		assert.equal(stepRows(1, 1), 2);
		assert.equal(stepRows(2, 1), 3);
		assert.equal(stepRows(3, 1), 3);
		assert.equal(stepRows(3, -1), 2);
		assert.equal(stepRows(1, -1), "auto");
		assert.equal(stepRows("auto", -1), "auto");
	});
	it("páginas das linhas extras: a mais distante em cima, cicla de 5 para 1", () => {
		assert.deepEqual(extraRowPages(1, 1), []);
		assert.deepEqual(extraRowPages(1, 2), [2]);
		assert.deepEqual(extraRowPages(1, 3), [3, 2]);
		assert.deepEqual(extraRowPages(5, 3), [2, 1]);
		assert.deepEqual(extraRowPages(4, 3), [1, 5]);
	});
});
