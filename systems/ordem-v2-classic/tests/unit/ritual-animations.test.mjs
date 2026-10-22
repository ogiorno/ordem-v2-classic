import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAutoAnimationsId } from "../../module/integrations/ritual-animations.mjs";

test("o Automated Animations só aceita ids UUID v4", () => {
	assert.equal(isAutoAnimationsId(crypto.randomUUID()), true);
	assert.equal(isAutoAnimationsId("85d2f43d-be43-47d8-ae7b-e14baf9583dd"), true);
	// id gerado por foundry.utils.randomID(): quebrava a inicialização do módulo e apagava as animações
	assert.equal(isAutoAnimationsId("7pa0CLIUqpUMLFcf"), false);
	assert.equal(isAutoAnimationsId(""), false);
	assert.equal(isAutoAnimationsId(undefined), false);
});

test("o registro dos rituais não usa randomID", () => {
	const source = readFileSync(new URL("../../module/integrations/ritual-animations.mjs", import.meta.url), "utf8");
	assert.ok(!source.includes("randomID()"));
	assert.ok(source.includes("crypto.randomUUID()"));
});

/* ---- registerRitualAnimations com um `game` simulado ---- */

const MAP = [
	{ name: "Alterar Destino", element: "energy", asset: "modules/JB2A_DnD5e/a.webm" },
	{ name: "Amaldiçoar Arma", element: "blood", asset: "modules/JB2A_DnD5e/b.webm" },
];

function installWorld({ ontoken, range = [] }) {
	const store = { "aaAutorec-ontoken": structuredClone(ontoken), "aaAutorec-range": structuredClone(range) };
	const writes = [];
	const notices = [];
	globalThis.foundry = { utils: { deepClone: (v) => structuredClone(v), randomID: () => "RANDOMID16CHARS0" } };
	globalThis.ui = { notifications: { info: (m) => notices.push(m) } };
	globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => MAP });
	globalThis.game = {
		user: { isGM: true },
		system: { id: "ordem-v2-classic" },
		modules: new Map([["autoanimations", { active: true }]]),
		settings: {
			settings: new Set(["autoanimations.aaAutorec-ontoken"]),
			get: (_m, key) => store[key],
			set: async (_m, key, value) => { writes.push(key); store[key] = structuredClone(value); },
		},
	};
	return { store, writes, notices };
}

const template = { id: "85d2f43d-be43-47d8-ae7b-e14baf9583dd", label: "Cure Wounds", menu: "ontoken", primary: { video: { animation: "x" }, options: {} } };
const { registerRitualAnimations } = await import("../../module/integrations/ritual-animations.mjs");

test("registra os vínculos com ids UUID v4 aceitos pelo Automated Animations", async () => {
	const world = installWorld({ ontoken: [template] });
	await registerRitualAnimations();
	const managed = world.store["aaAutorec-ontoken"].filter((e) => e.metaData?.ordemRitualLibrary);
	assert.equal(managed.length, MAP.length);
	assert.ok(managed.every((e) => isAutoAnimationsId(e.id)));
	assert.equal(new Set(managed.map((e) => e.id)).size, managed.length);
	assert.ok(world.store["aaAutorec-ontoken"].includes(world.store["aaAutorec-ontoken"].find((e) => e.label === "Cure Wounds")));
});

test("repara vínculos antigos gravados com id do Foundry", async () => {
	const old = MAP.map((r, i) => ({ ...structuredClone(template), id: `OLDRANDOMID0000${i}`, label: r.name, metaData: { ordemRitualLibrary: true } }));
	const world = installWorld({ ontoken: [template, ...old] });
	await registerRitualAnimations();
	const all = world.store["aaAutorec-ontoken"];
	assert.ok(all.every((e) => isAutoAnimationsId(e.id)), "nenhum id inválido pode sobrar");
	assert.equal(all.length, 1 + MAP.length, "sem duplicar vínculos");
	assert.equal(world.notices.length, 1);
});

test("não regrava a configuração quando os vínculos já estão válidos", async () => {
	const world = installWorld({ ontoken: [template] });
	await registerRitualAnimations();
	world.writes.length = 0;
	world.notices.length = 0;
	await registerRitualAnimations();
	assert.deepEqual(world.writes, []);
	assert.deepEqual(world.notices, []);
});

test("não faz nada sem o módulo ou para jogador", async () => {
	const world = installWorld({ ontoken: [template] });
	game.user.isGM = false;
	await registerRitualAnimations();
	game.user.isGM = true;
	game.modules.clear();
	await registerRitualAnimations();
	assert.deepEqual(world.writes, []);
});

test("Amaldiçoar Arma usa a entrada do mapa do elemento do ritual", async () => {
	const { ritualAnimationName } = await import("../../module/integrations/ritual-animations.mjs");
	const map = JSON.parse(readFileSync(new URL("../../module/macros/ritual-animation-map.json", import.meta.url), "utf8"));
	const names = new Set(map.map((r) => r.name));
	for (const element of ["knowledge", "energy", "death", "blood"]) {
		const name = ritualAnimationName({ name: "Amaldiçoar Arma", system: { element } });
		assert.ok(names.has(name), `${name} precisa existir no mapa`);
	}
	assert.equal(ritualAnimationName({ name: "Luz", system: { element: "energy" } }), "Luz");
	assert.equal(ritualAnimationName({ name: "Amaldiçoar Arma", system: { element: "fear" } }), "Amaldiçoar Arma");
});
