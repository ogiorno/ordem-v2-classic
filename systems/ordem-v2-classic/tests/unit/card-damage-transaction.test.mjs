import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDamageFromMessage } from "../../module/helpers/card-damage.mjs";

function fixture({ delayDamage = false, failMessageFlagOnce = false, failActorFlagOnce = false } = {}) {
	let applied = null;
	let pending = null;
	let lastDamage = null;
	let hp = 20;
	let calls = 0;
	let warnings = 0;
	let release;
	const waiting = new Promise((resolve) => { release = resolve; });
	const target = {
		type: "threat", name: "Alvo", system: { attributes: { hp: { value: hp, max: 20 } } },
		async applyDamage(amount) {
			calls++;
			if (delayDamage) await waiting;
			hp -= amount;
			target.system.attributes.hp.value = hp;
			return { finalDamage: amount, blocked: 0, newPV: hp };
		},
		getFlag(_system, key) { return key === "lastDamage" ? lastDamage : null; },
		async setFlag(_system, key, value) {
			if (key !== "lastDamage") return;
			if (failActorFlagOnce) { failActorFlagOnce = false; throw new Error("falha ao gravar ator"); }
			lastDamage = value;
		},
	};
	const message = {
		id: "dano-1", rolls: [{ total: 5 }],
		getFlag(_system, key) {
			if (key === "damageTarget") return { actorUuid: "Actor.alvo", damageType: "cuttingDamage" };
			if (key === "damageApplied") return applied;
			if (key === "damagePending") return pending;
			return null;
		},
		async setFlag(_system, key, value) {
			if (key === "damagePending") { pending = value; return; }
			if (key !== "damageApplied") return;
			if (failMessageFlagOnce) { failMessageFlagOnce = false; throw new Error("falha ao gravar mensagem"); }
			applied = value;
		},
		async unsetFlag(_system, key) { if (key === "damagePending") pending = null; },
	};
	globalThis.fromUuid = async () => target;
	globalThis.foundry = { utils: { getProperty: (obj, path) => path.split(".").reduce((value, part) => value?.[part], obj) } };
	globalThis.game = {
		user: { id: "gm", isGM: true }, users: Object.assign([{ id: "gm", isGM: true }], { get: () => ({ name: "Mestre" }) }),
		messages: { get: () => null }, i18n: { format: (key) => key, localize: (key) => key },
	};
	globalThis.ChatMessage = { create: async () => ({}) };
	globalThis.ui = { notifications: { warn: () => { warnings++; } } };
	return { message, release, result: () => ({ hp, calls, applied, warnings }) };
}

test("cartão aplicado uma vez: segundo clique sequencial não desconta PV", async () => {
	const { message, result } = fixture();
	await applyDamageFromMessage(message);
	await applyDamageFromMessage(message);
	assert.equal(result().calls, 1);
	assert.equal(result().hp, 15);
	assert.ok(result().applied);
});

test("dois pedidos simultâneos do mesmo cartão aplicam dano uma vez", async () => {
	const { message, release, result } = fixture({ delayDamage: true });
	const first = applyDamageFromMessage(message);
	const second = applyDamageFromMessage(message);
	release();
	await Promise.all([first, second]);
	assert.equal(result().calls, 1);
	assert.equal(result().hp, 15);
});

test("falha ao gravar carta após reduzir PV não reaplica dano no reenvio", async () => {
	const { message, result } = fixture({ failMessageFlagOnce: true });
	await assert.rejects(applyDamageFromMessage(message), /falha ao gravar mensagem/);
	await applyDamageFromMessage(message);
	assert.equal(result().calls, 1);
	assert.equal(result().hp, 15);
	assert.ok(result().applied);
});

test("falha em estado incerto bloqueia reenvio automático para revisão do Mestre", async () => {
	const { message, result } = fixture({ failActorFlagOnce: true });
	await assert.rejects(applyDamageFromMessage(message), /falha ao gravar ator/);
	await applyDamageFromMessage(message);
	assert.equal(result().calls, 1);
	assert.equal(result().hp, 15);
	assert.equal(result().applied, null);
	assert.equal(result().warnings, 1);
});
