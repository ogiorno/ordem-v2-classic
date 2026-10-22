import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MANUAL_RITUALS, MODIFIER, PROFILE, classifyRitual, ritualModifiers } from "../../module/macros/ritual-profiles.mjs";
import { AREA_RULES } from "../../module/macros/ritual-area-rules.mjs";

// Os 98 rituais da "Biblioteca de Rituais" do mundo (exportados com name e system, sem a descrição).
const LIBRARY = JSON.parse(readFileSync(new URL("./fixtures/ritual-library.json", import.meta.url), "utf8"));
const byName = (name) => {
	const found = LIBRARY.find((ritual) => ritual.name === name);
	assert.ok(found, `ritual ${name} não está na fixture`);
	return found;
};
const profileOf = (name, options) => classifyRitual(byName(name), options).profile;
const has = (name, modifier) => classifyRitual(byName(name)).modifiers.includes(modifier);

test("FC-U1: todo ritual da Biblioteca tem perfil principal válido", () => {
	assert.ok(LIBRARY.length >= 98);
	const valid = new Set(Object.values(PROFILE));
	for (const ritual of LIBRARY) {
		for (const formId of ["basic", "student", "true"]) {
			const result = classifyRitual(ritual, { formId });
			assert.ok(valid.has(result.profile), `${ritual.name} (${formId}) sem perfil: ${result.profile}`);
			assert.ok(result.reason, `${ritual.name} sem motivo da classificação`);
		}
	}
});

test("FC-U1: as tabelas de exceção e de regra de área só citam rituais que existem na Biblioteca", () => {
	const names = new Set(LIBRARY.map((ritual) => ritual.name));
	for (const name of MANUAL_RITUALS) assert.ok(names.has(name), `exceção manual cita ritual inexistente: ${name}`);
	for (const name of Object.keys(AREA_RULES)) assert.ok(names.has(name), `regra de área cita ritual inexistente: ${name}`);
});

test("FC-U2: perfil Pessoal — rituais de alvo 'você' e alcance pessoal", () => {
	for (const name of ["Armadura de Sangue", "Embaralhar", "Forma Monstruosa", "Terceiro Olho", "Medo Tangível", "Consumir Manancial", "Tela de Ruído", "Overclock", "Alterar Destino"]) {
		assert.equal(profileOf(name), PROFILE.PERSONAL, name);
	}
	assert.equal(classifyRitual(byName("Terceiro Olho")).intent, "self");
});

test("FC-U2: perfil Buff em ser — sem resistência, alvo é um ser, arma ou acessório", () => {
	for (const name of ["Aprimorar Físico", "Aprimorar Mente", "Cicatrização", "Transfusão Vital", "Corpo Adaptado", "Proteção contra Rituais", "Arma Atroz", "Amaldiçoar Arma", "Amaldiçoar Tecnologia", "Teletransporte"]) {
		assert.equal(profileOf(name), PROFILE.ALLY, name);
	}
	const teleport = classifyRitual(byName("Teletransporte"));
	assert.equal(teleport.multi, true);
	assert.equal(teleport.maxTargets, 5);
});

test("FC-U2: perfil Alvo hostil — ser com resistência e rituais de dano num alvo", () => {
	for (const name of ["Decadência", "Descarnar", "Eletrocussão", "Definhar", "Hemofagia", "Lâmina do Medo", "Âncora Temporal", "Enfeitiçar", "Perturbação", "Alterar Memória", "Controle Mental", "Esfolar"]) {
		assert.equal(profileOf(name), PROFILE.HOSTILE, name);
	}
	assert.equal(classifyRitual(byName("Decadência")).intent, "enemy");
});

test("FC-U2: perfil Área — rituais com regra de área e o que fica centrado no conjurador", () => {
	for (const name of ["Paradoxo", "Miasma Entrópico", "Poeira da Podridão", "Purgatório", "Tentáculos de Lodo", "Aurora da Verdade", "Cinerária", "Transfigurar Água", "Transfigurar Terra", "Presença do Medo", "Deflagração de Energia"]) {
		assert.equal(profileOf(name), PROFILE.AREA, name);
	}
	assert.equal(classifyRitual(byName("Presença do Medo")).centered, true);
	assert.equal(classifyRitual(byName("Detecção de Ameaças")).centered, true, "alcance pessoal centra a área");
	assert.equal(classifyRitual(byName("Paradoxo")).centered, false);
});

test("FC-U2: a forma pode mudar o perfil (Esfolar, Decadência, Eletrocussão)", () => {
	assert.equal(profileOf("Esfolar", { formId: "basic" }), PROFILE.HOSTILE);
	assert.equal(profileOf("Esfolar", { formId: "student" }), PROFILE.AREA);
	assert.equal(profileOf("Decadência", { formId: "student" }), PROFILE.HOSTILE);
	assert.equal(profileOf("Decadência", { formId: "true" }), PROFILE.AREA);
	assert.equal(classifyRitual(byName("Decadência"), { formId: "true" }).centered, true);
	assert.equal(profileOf("Eletrocussão", { formId: "student" }), PROFILE.AREA, "linha de 30 m é área");
	const truth = classifyRitual(byName("Eletrocussão"), { formId: "true" });
	assert.equal(truth.profile, PROFILE.HOSTILE);
	assert.equal(truth.multi, true, "alvos escolhidos");
	assert.equal(profileOf("Consumir Manancial", { formId: "true" }), PROFILE.AREA);
	assert.equal(profileOf("Consumir Manancial", { formId: "basic" }), PROFILE.PERSONAL);
});

test("FC-U2: perfil Manual — texto livre, objeto, destino no mapa", () => {
	for (const name of MANUAL_RITUALS) assert.equal(profileOf(name), PROFILE.MANUAL, name);
	// objetos que não são fichas no mapa também caem em manual, e Tecer Ilusão básico só tem texto
	assert.equal(profileOf("Luz"), PROFILE.MANUAL);
	assert.equal(profileOf("Tecer Ilusão", { formId: "basic" }), PROFILE.MANUAL);
	assert.equal(profileOf("Tecer Ilusão", { formId: "true" }), PROFILE.AREA);
});

test("FC-U2: modificadores — variante, rápido, sustentado, Medo, forma avançada", () => {
	assert.ok(has("Transfigurar Água", MODIFIER.VARIANT));
	assert.ok(has("Transfigurar Terra", MODIFIER.VARIANT));
	assert.ok(!has("Paradoxo", MODIFIER.VARIANT));
	assert.ok(has("Alterar Destino", MODIFIER.QUICK), "reação");
	assert.ok(has("Esconder dos Olhos", MODIFIER.QUICK), "livre");
	assert.ok(has("Overclock", MODIFIER.QUICK));
	assert.ok(!has("Armadura de Sangue", MODIFIER.QUICK));
	assert.ok(has("Poeira da Podridão", MODIFIER.SUSTAINED));
	assert.ok(has("Arma Atroz", MODIFIER.SUSTAINED));
	assert.ok(has("Medo Tangível", MODIFIER.FEAR));
	assert.ok(has("Lâmina do Medo", MODIFIER.FEAR));
	assert.ok(has("Paradoxo", MODIFIER.ADVANCED));
	assert.ok(!has("Medo Tangível", MODIFIER.ADVANCED));
	assert.deepEqual(ritualModifiers({ name: "Teste", system: {} }), []);
});

test("FC-U2: combinações do spec (Amaldiçoar Arma, Poeira da Podridão, Alterar Destino)", () => {
	const curse = classifyRitual(byName("Amaldiçoar Arma"));
	assert.equal(curse.profile, PROFILE.ALLY);
	assert.ok(curse.modifiers.includes(MODIFIER.ADVANCED));
	const dust = classifyRitual(byName("Poeira da Podridão"));
	assert.equal(dust.profile, PROFILE.AREA);
	assert.deepEqual([...dust.modifiers].sort(), [MODIFIER.ADVANCED, MODIFIER.SUSTAINED].sort());
	const fate = classifyRitual(byName("Alterar Destino"));
	assert.equal(fate.profile, PROFILE.PERSONAL);
	assert.ok(fate.modifiers.includes(MODIFIER.QUICK));
});

test("FC-U3: ritual sem campos suficientes cai em Manual e Medo sempre soma o modificador", () => {
	assert.equal(classifyRitual({ name: "Ritual Novo", system: {} }).profile, PROFILE.MANUAL);
	assert.equal(classifyRitual({ name: "Ritual Novo", system: { range: "touch", target: "veja texto" } }).profile, PROFILE.MANUAL);
	assert.equal(classifyRitual({ name: "Ritual Novo", system: { range: "touch", target: "veja texto", skillResis: "will" } }).profile, PROFILE.HOSTILE);
	const fear = classifyRitual({ name: "Ritual do Medo", system: { element: "fear", range: "touch", target: "1 ser" } });
	assert.ok(fear.modifiers.includes(MODIFIER.FEAR));
	assert.equal(fear.profile, PROFILE.ALLY);
	const fearPersonal = classifyRitual({ name: "Medo Pessoal", system: { element: "fear", range: "personal", target: "você" } });
	assert.ok(fearPersonal.modifiers.includes(MODIFIER.FEAR));
	assert.equal(classifyRitual(undefined).profile, PROFILE.MANUAL);
});

test("FC-U3: o texto da forma que muda o alvo ou o alcance entra na classificação", () => {
	const touch = { name: "Ritual X", system: { range: "touch", target: "1 ser", skillResis: "" } };
	assert.equal(classifyRitual(touch).profile, PROFILE.ALLY);
	assert.equal(classifyRitual(touch, { formBody: "muda o alvo para “até 5 seres escolhidos”" }).maxTargets, 5);
	const personal = { name: "Ritual Y", system: { range: "personal", target: "você" } };
	assert.equal(classifyRitual(personal).profile, PROFILE.PERSONAL);
});
