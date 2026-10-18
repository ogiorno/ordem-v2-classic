// Rodar: npm test. Regras do "Para mim" do Grimório (GR-30/31/32/52/53): círculo por NEX, leitura dos requisitos dos poderes
// (com os 136 textos reais dos compêndios) e os estados Você já tem / Disponível / Confira / Ainda não.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CIRCLE_NEX, STATE, availabilityFor, checkPrerequisite, circleUnlockedByNex, emptyReason, forMeOnly, parsePrerequisite, powerAvailability, ritualAvailability, sealFor } from "../../module/helpers/grimoire-rules.mjs";
import { normalizeText } from "../../module/helpers/grimoire-text.mjs";

const SKILLS = ["Acrobacia", "Adestramento", "Artes", "Atletismo", "Atualidades", "Ciências", "Crime", "Diplomacia", "Enganação", "Fortitude", "Furtividade", "Iniciativa", "Intimidação", "Intuição", "Investigação", "Luta", "Medicina", "Ocultismo", "Percepção", "Pilotagem", "Pontaria", "Profissão", "Reflexos", "Religião", "Sobrevivência", "Tática", "Tecnologia", "Vontade"];
const skillNames = new Set(SKILLS.map(normalizeText));

const SRC = path.resolve(import.meta.dirname, "../../packs/_source");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".json") ? [path.join(dir, e.name)] : []));
const POWER_PACKS = ["fighterPowers", "specialistPowers", "occultistPowers", "survivalPowers", "originPowers", "generalPowers", "paranormalPowers", "pathFighter", "pathSpecialist", "pathOccultist"];
const powerDocs = POWER_PACKS.flatMap((pack) => walk(path.join(SRC, pack)).map((f) => JSON.parse(fs.readFileSync(f, "utf8"))).filter((d) => d._key?.startsWith("!items!")).map((d) => ({ pack, d })));
const powerNames = new Set(powerDocs.map(({ d }) => normalizeText(d.name)));
const ctx = { skillNames, powerNames };

const facts = (o = {}) => ({ nex: 30, stage: 1, className: "Ocultista", hasRitualAccess: true, attributes: { str: 1, dex: 2, int: 3, pre: 2, vit: 2 }, trainedSkills: new Set(["ocultismo", "luta"]), pathNames: new Set(), powerNames: new Set(), ritualNames: new Set(), ...o });
const rit = (name, circle) => ({ kind: "ritual", name, circle });
const pow = (name, abilityType, o = {}) => ({ kind: "power", name, abilityType, className: null, prerequisite: "", ...o });

describe("círculo liberado pelo NEX (GR-31)", () => {
	it("1º desde o início; 2º NEX 25%; 3º NEX 55%; 4º NEX 85%", () => {
		assert.deepEqual([0, 5, 24].map(circleUnlockedByNex), [1, 1, 1]);
		assert.deepEqual([25, 54].map(circleUnlockedByNex), [2, 2]);
		assert.deepEqual([55, 84].map(circleUnlockedByNex), [3, 3]);
		assert.deepEqual([85, 99].map(circleUnlockedByNex), [4, 4]);
		assert.deepEqual(CIRCLE_NEX, { 1: 0, 2: 25, 3: 55, 4: 85 });
	});
});

describe("leitura do requisito (GR-32)", () => {
	const types = (t) => parsePrerequisite(t, ctx).map((c) => c.type);
	it("atributo, NEX, perícia treinada, trilha e poder", () => {
		assert.deepEqual(parsePrerequisite("Força 2", ctx), [{ type: "attr", attr: "str", min: 2, text: "Força 2" }]);
		assert.equal(parsePrerequisite("Intelecto 1", ctx)[0].attr, "int");
		assert.equal(parsePrerequisite("Inteligência 2", ctx)[0].attr, "int");
		assert.equal(parsePrerequisite("NEX 30%", ctx)[0].min, 30);
		assert.deepEqual(types("Treinado em Luta ou Pontaria"), ["skill"]);
		assert.deepEqual(parsePrerequisite("Treinado em Luta ou Pontaria", ctx)[0].names, ["luta", "pontaria"]);
		assert.deepEqual(types("Pontaria"), ["skill"]);
		assert.equal(parsePrerequisite("Trilha: Durão", ctx)[0].name, "durao");
		assert.equal(parsePrerequisite("Trilha: Monstruoso (Conhecimento)", ctx)[0].name, "monstruoso conhecimento");
		assert.deepEqual(types("Proteção Pesada"), ["power"]);
	});
	it("várias exigências: & e vírgula separam, \"e\" entre perícias exige as duas", () => {
		assert.deepEqual(types("Agilidade 3 & Luta ou Pontaria"), ["attr", "skill"]);
		assert.deepEqual(types("Treinado em Diplomacia, NEX 30%"), ["skill", "nex"]);
		assert.deepEqual(types("Presença 2, treinado em Enganação"), ["attr", "skill"]);
		assert.deepEqual(types("Inteligência 2 & Percepção e Tática"), ["attr", "skill", "skill"]);
	});
	it("o que o sistema não sabe avaliar vira 'unknown' (nunca bloqueia por engano)", () => {
		assert.deepEqual(types("Treinado na perícia"), ["unknown"]);
		assert.deepEqual(types("Especialista em <Elemento> & NEX 45%"), ["unknown", "nex"]);
		assert.deepEqual(types("Conhecimento 1"), ["unknown"]);
		assert.deepEqual(types(""), []);
	});
	it("avalia: passa, falha com a razão em texto, ou pede para conferir", () => {
		assert.deepEqual(checkPrerequisite("Intelecto 3", facts(), ctx), { ok: true });
		assert.deepEqual(checkPrerequisite("Agilidade 3", facts(), ctx), { ok: false, reason: "Falta Agilidade 3" });
		assert.deepEqual(checkPrerequisite("NEX 60%", facts(), ctx), { ok: false, reason: "Falta NEX 60%" });
		assert.deepEqual(checkPrerequisite("Treinado em Pontaria", facts(), ctx), { ok: false, reason: "Falta treinar Pontaria" });
		assert.deepEqual(checkPrerequisite("Treinado em Luta ou Pontaria", facts(), ctx), { ok: true });
		assert.deepEqual(checkPrerequisite("Trilha: Durão", facts(), ctx), { ok: false, reason: "Falta a trilha Durão" });
		assert.deepEqual(checkPrerequisite("Trilha: Durão", facts({ pathNames: new Set(["durao"]) }), ctx), { ok: true });
		assert.equal(checkPrerequisite("Treinado na perícia", facts(), ctx).ok, null);
		// a primeira falha manda, mesmo com uma exigência que não dá para avaliar
		assert.equal(checkPrerequisite("Treinado na perícia, NEX 90%", facts(), ctx).ok, false);
	});
	it("os 136 requisitos reais: todos leem sem erro e a grande maioria é avaliada", () => {
		const com = powerDocs.filter(({ d }) => d.system.preRequisite);
		assert.equal(com.length, 136);
		let semUnknown = 0;
		for (const { d } of com) {
			const clauses = parsePrerequisite(d.system.preRequisite, ctx);
			assert.ok(clauses.length > 0, `${d.name}: sem cláusula`);
			if (clauses.every((c) => c.type !== "unknown")) semUnknown++;
		}
		assert.ok(semUnknown / com.length >= 0.85, `só ${semUnknown} de ${com.length} requisitos são avaliados`);
	});
});

describe("estado dos rituais (GR-30/53)", () => {
	it("Ocultista NEX 30%: 1º e 2º círculo disponíveis; 3º e 4º 'Ainda não' com o motivo", () => {
		const f = facts({ nex: 30 });
		assert.equal(ritualAvailability(rit("A", 1), f).state, STATE.AVAILABLE);
		assert.equal(ritualAvailability(rit("B", 2), f).state, STATE.AVAILABLE);
		assert.deepEqual(ritualAvailability(rit("C", 3), f), { state: STATE.LATER, reason: "Falta NEX 55%" });
		assert.deepEqual(ritualAvailability(rit("D", 4), f), { state: STATE.LATER, reason: "Falta NEX 85%" });
	});
	it("o NEX sobe e o círculo abre", () => {
		assert.equal(ritualAvailability(rit("C", 3), facts({ nex: 55 })).state, STATE.AVAILABLE);
		assert.equal(ritualAvailability(rit("D", 4), facts({ nex: 84 })).state, STATE.LATER);
		assert.equal(ritualAvailability(rit("D", 4), facts({ nex: 85 })).state, STATE.AVAILABLE);
	});
	it("ritual que o agente já tem vira 'Você já tem', mesmo de círculo alto", () => {
		const f = facts({ nex: 5, ritualNames: new Set(["paradoxo"]) });
		assert.equal(ritualAvailability(rit("Paradoxo", 4), f).state, STATE.HAVE);
	});
	it("classe sem acesso a rituais: 'no-access' com a mensagem; com acesso mas sem ser Ocultista: confira", () => {
		const semAcesso = ritualAvailability(rit("A", 1), facts({ className: "Combatente", hasRitualAccess: false }));
		assert.deepEqual(semAcesso, { state: STATE.NO_ACCESS, reason: "Sua classe não aprende rituais por padrão" });
		assert.equal(ritualAvailability(rit("A", 1), facts({ className: "Combatente", hasRitualAccess: true })).state, STATE.CHECK);
	});
});

describe("estado dos poderes", () => {
	it("poder de outra classe e poder de origem ficam fora do 'Para mim'", () => {
		assert.deepEqual(powerAvailability(pow("Golpe", "class", { className: "Combatente" }), facts(), ctx), { state: STATE.OTHER, reason: "Poder de Combatente" });
		assert.equal(powerAvailability(pow("Saber é Poder", "origin"), facts(), ctx).state, STATE.OTHER);
		assert.equal(powerAvailability(pow("Mestre", "class", { className: "Ocultista" }), facts(), ctx).state, STATE.AVAILABLE);
	});
	it("poder de trilha: NEX no nome e trilha; requisito com atributo", () => {
		const t = pow("NEX 40% - O Sorriso", "path", { className: "Combatente", prerequisite: "Trilha: Agente Secreto" });
		assert.deepEqual(powerAvailability(t, facts({ className: "Combatente", nex: 30 }), ctx), { state: STATE.LATER, reason: "Falta NEX 40%" });
		assert.deepEqual(powerAvailability(t, facts({ className: "Combatente", nex: 45 }), ctx), { state: STATE.LATER, reason: "Falta a trilha Agente Secreto" });
		assert.equal(powerAvailability(t, facts({ className: "Combatente", nex: 45, pathNames: new Set(["agente secreto"]) }), ctx).state, STATE.AVAILABLE);
		const g = pow("Acrobático", "general", { prerequisite: "Agilidade 2" });
		assert.equal(powerAvailability(g, facts(), ctx).state, STATE.AVAILABLE);
		assert.deepEqual(powerAvailability(g, facts({ attributes: { dex: 1 } }), ctx), { state: STATE.LATER, reason: "Falta Agilidade 2" });
	});
	it("poder de trilha só aparece para quem tem a trilha (e é da sua classe)", () => {
		const aniq = pow("NEX 10% - Ataque Especial", "path", { className: "Combatente", pathName: "Aniquilador" });
		assert.deepEqual(powerAvailability(aniq, facts({ className: "Combatente", nex: 30 }), ctx), { state: STATE.LATER, reason: "Falta a trilha Aniquilador" });
		assert.equal(powerAvailability(aniq, facts({ className: "Combatente", nex: 30, pathNames: new Set(["aniquilador"]) }), ctx).state, STATE.AVAILABLE);
		assert.equal(powerAvailability(aniq, facts({ className: "Ocultista", nex: 30, pathNames: new Set(["aniquilador"]) }), ctx).state, STATE.OTHER);
		const mons = pow("NEX 10% - Ser Amaldiçoado (Conhecimento)", "path", { className: "Combatente", pathName: "Conhecimento", prerequisite: "Trilha: Monstruoso (Conhecimento)" });
		assert.equal(powerAvailability(mons, facts({ className: "Combatente", nex: 30, pathNames: new Set(["monstruoso conhecimento"]) }), ctx).state, STATE.AVAILABLE);
	});
	it("poder do Sobrevivente pelo estágio no nome", () => {
		const e = pow("Estágio 4 - Entendido", "class", { className: "Sobrevivente", prerequisite: "Trilha: Esperto" });
		assert.deepEqual(powerAvailability(e, facts({ className: "Sobrevivente", stage: 2 }), ctx), { state: STATE.LATER, reason: "Falta o estágio 4" });
	});
	it("requisito que não dá para avaliar e poder paranormal pedem conferência", () => {
		assert.equal(powerAvailability(pow("Foco em Perícia", "general", { prerequisite: "Treinado na perícia" }), facts(), ctx).state, STATE.CHECK);
		assert.equal(powerAvailability(pow("Sangue Vivo", "paranormal", { prerequisite: "Sangue 1" }), facts(), ctx).state, STATE.CHECK);
	});
	it("já tem o poder: 'Você já tem' antes de qualquer requisito", () => {
		const f = facts({ powerNames: new Set(["acrobatico"]), attributes: { dex: 0 } });
		assert.equal(powerAvailability(pow("Acrobático", "general", { prerequisite: "Agilidade 2" }), f, ctx).state, STATE.HAVE);
	});
});

describe("selos e lista 'Para mim' (GR-53)", () => {
	it("só as exceções levam selo; disponível fica sem", () => {
		assert.equal(sealFor({ state: STATE.AVAILABLE }), null);
		assert.equal(sealFor(null), null);
		assert.deepEqual(sealFor({ state: STATE.HAVE }), { id: "have", label: "Você já tem", icon: "fa-check" });
		assert.deepEqual(sealFor({ state: STATE.LATER, reason: "Falta NEX 55%" }), { id: "later", label: "Ainda não", icon: "fa-lock", reason: "Falta NEX 55%" });
		assert.equal(sealFor({ state: STATE.CHECK, reason: "Intelecto 2" }).label, "Confira o requisito");
		assert.equal(sealFor({ state: STATE.OTHER, reason: "Poder de origem" }).id, "later");
	});
	it("'Para mim' deixa só o que tem, pode aprender ou pede conferência; condição sempre fica", () => {
		const f = facts({ nex: 30 });
		const entradas = [rit("A", 1), rit("B", 2), rit("C", 3), rit("D", 4), { kind: "condition", name: "Abalado" }];
		const lista = forMeOnly(entradas, (e) => availabilityFor(e, f, ctx));
		assert.deepEqual(lista.map((e) => e.name), ["A", "B", "Abalado"]);
	});
	it("sem personagem não há disponibilidade (o interruptor some)", () => {
		assert.equal(availabilityFor(rit("A", 1), null, ctx), null);
	});
	it("motivo do vazio: classe sem rituais, ou nada novo", () => {
		assert.equal(emptyReason("ritual", facts({ className: "Combatente", hasRitualAccess: false }), 98), "noAccess");
		assert.equal(emptyReason("ritual", facts(), 98), "nothingNew");
		assert.equal(emptyReason("power", facts({ hasRitualAccess: false }), 316), "nothingNew");
		assert.equal(emptyReason("ritual", null, 98), null);
	});
});
