import { test, before } from "node:test";
import assert from "node:assert/strict";

let isOpostoSenderAuthorized;

before(async () => {
	// utils.mjs lê o KeyboardManager do Foundry ao carregar; um dublê basta para a função pura.
	globalThis.foundry ??= { helpers: { interaction: { KeyboardManager: { MODIFIER_CODES: { Alt: [], Control: [], Shift: [] }, MODIFIER_KEYS: {} } } } };
	({ isOpostoSenderAuthorized } = await import("../../module/utils.mjs"));
});

const mapa = (obj) => ({ get: (id) => obj[id] });
const deps = ({ users = {}, actors = {} } = {}) => ({ users: mapa(users), actors: mapa(actors) });
const ator = (donos = []) => ({ testUserPermission: (u) => donos.includes(u.id) });

test("oposto: mestre pode rolar por qualquer ator", () => {
	const d = deps({ users: { gm: { id: "gm", isGM: true } }, actors: { a1: ator() } });
	assert.equal(isOpostoSenderAuthorized({ userId: "gm", actorId: "a1" }, d, "gm"), true);
});

test("oposto: jogador só rola pelo ator do qual é dono", () => {
	const d = deps({ users: { u1: { id: "u1", isGM: false }, u2: { id: "u2", isGM: false } }, actors: { a1: ator(["u1"]) } });
	assert.equal(isOpostoSenderAuthorized({ userId: "u1", actorId: "a1" }, d, "u1"), true);
	assert.equal(isOpostoSenderAuthorized({ userId: "u2", actorId: "a1" }, d, "u2"), false);
});

test("oposto: pacote forjado (campos ausentes, usuário ou ator inexistente) é recusado", () => {
	const d = deps({ users: { gm: { id: "gm", isGM: true } }, actors: { a1: ator() } });
	assert.equal(isOpostoSenderAuthorized({ userId: "gm" }, d, "gm"), false);
	assert.equal(isOpostoSenderAuthorized({ actorId: "a1" }, d, null), false);
	assert.equal(isOpostoSenderAuthorized({ userId: "fantasma", actorId: "a1" }, d, "fantasma"), false);
	assert.equal(isOpostoSenderAuthorized({ userId: "gm", actorId: "fantasma" }, d, "gm"), false);
	assert.equal(isOpostoSenderAuthorized(null, d, "gm"), false);
	assert.equal(isOpostoSenderAuthorized(undefined, d, "gm"), false);
});

test("oposto: ator sem checagem de permissão não autoriza jogador", () => {
	const d = deps({ users: { u1: { id: "u1", isGM: false } }, actors: { a1: {} } });
	assert.equal(isOpostoSenderAuthorized({ userId: "u1", actorId: "a1" }, d, "u1"), false);
});

test("oposto: ID declarado como GM não substitui remetente autenticado pelo socket", () => {
	const d = deps({ users: { gm: { id: "gm", isGM: true }, u2: { id: "u2", isGM: false } }, actors: { a1: ator() } });
	assert.equal(isOpostoSenderAuthorized({ userId: "gm", actorId: "a1" }, d, "u2"), false);
});
