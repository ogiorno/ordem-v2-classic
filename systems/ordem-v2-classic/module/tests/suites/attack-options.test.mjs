// Tela de ataque (docs/arquivo/spec-tela-de-ataque.md). Rodar no console como GM:
//   await import("/systems/ordem-v2-classic/module/tests/mini-quench.mjs");
//   await miniQuench("/systems/ordem-v2-classic/module/tests/suites/attack-options.test.mjs")
// Cria e apaga atores "[AO] ..."; mexe só neles.
import { installBatchGuards, withActor } from "../helpers/fixtures.mjs";
import { conditionEffectData } from "../../helpers/conditions.mjs";

const SYSTEM = "ordem-v2-classic";
const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fromPack(packName, itemName) {
	const pack = game.packs.get(`${SYSTEM}.${packName}`);
	const entry = (await pack.getIndex()).find((e) => norm(e.name) === norm(itemName));
	const data = (await pack.getDocument(entry._id)).toObject();
	delete data._id;
	return data;
}

async function dialog(timeout = 4000) {
	const start = Date.now();
	for (;;) {
		const el = document.querySelector(".op-attack-dialog");
		if (el) return el;
		if (Date.now() - start > timeout) throw new Error("a tela de ataque não abriu");
		await wait(60);
	}
}
const type = (root, selector, value) => {
	const el = root.querySelector(selector);
	if (!el) throw new Error(`campo ${selector} não existe na tela`);
	el.value = value;
	el.dispatchEvent(new Event("input", { bubbles: true }));
};

async function setup(fn, { pd = 20, weapon = "Pistola Pesada" } = {}) {
	return withActor(
		{ name: "[AO] atirador", type: "agent", system: { nivel: { value: 12 }, attributes: { dex: { value: 3 }, str: { value: 2 }, vit: { value: 2 }, pre: { value: 3 }, int: { value: 2 } } } },
		async (actor) => {
			await actor.createEmbeddedDocuments("Item", [await fromPack("classes", "Combatente")]);
			const [gun] = await actor.createEmbeddedDocuments("Item", [await fromPack("armaments", weapon)]);
			await actor.createEmbeddedDocuments("Item", [await fromPack("fighterPowers", "Ataque Especial"), await fromPack("originPowers", "Para Bellum"), await fromPack("originPowers", "Mão Pesada")]);
			await actor.update({ "system.PD.max": Math.max(pd, actor.system.PD.max), "system.PD.value": pd, "system.PE.max": Math.max(pd, actor.system.PE.max), "system.PE.value": pd });
			await wait(200);
			return fn(actor, gun);
		}
	);
}
const balance = (actor) => (actor.usingWithoutSanityRule ? actor.system.PD.value : actor.system.PE.value);

Hooks.once("quenchReady", (quench) => {
	quench.registerBatch("ordem.attack-options", (context) => {
		const { describe, it, assert } = context;
		installBatchGuards(context, { prefix: "[AO]" });

		describe("tela de ataque", () => {
			it("Shift+clique ataca direto e aplica só o automático (Para Bellum em arma de fogo, não Mão Pesada)", () =>
				setup(async (actor, gun) => {
					const before = balance(actor);
					const r = await gun.rollAttack({ event: { shiftKey: true } });
					assert.equal(r.attackOptions.cost, 0);
					assert.equal(r.attackOptions.damageFlat, 2);
					assert.equal(balance(actor), before);
					assert.equal(document.querySelector(".op-attack-dialog"), null);
				}));

			it("a tela lista o aplicado, o Ataque Especial e o saldo", () =>
				setup(async (actor, gun) => {
					const pending = gun.rollAttack({ event: { shiftKey: false } });
					const root = await dialog();
					const text = root.innerText;
					assert.match(text, /Para Bellum/);
					assert.match(text, /Ataque Especial/);
					assert.notMatch?.(text, /Mão Pesada/) ?? assert.ok(!/Mão Pesada/.test(text), "Mão Pesada é só corpo a corpo");
					assert.ok(root.querySelector('input[name^="pool."]'), "contadores do Ataque Especial");
					root.querySelector(".window-header [data-action=close]").click();
					assert.equal(await pending, null);
				}));

			it("escolhas viram bônus no ataque, no dano e custo pago; o dano do cartão usa as mesmas opções", () =>
				setup(async (actor, gun) => {
					const before = balance(actor);
					const pending = gun.rollAttack({ event: { shiftKey: false } });
					const root = await dialog();
					type(root, 'input[name^="pool."][name$=".attack"]', 1);
					type(root, 'input[name^="pool."][name$=".damage"]', 2);
					type(root, 'input[name="freeAttack"]', "+1");
					type(root, 'input[name="freeDamage"]', "+1d4");
					assert.match(root.querySelector("[data-total]").textContent, /^4 P[DE]/, "3 acúmulos = 2+1+1");
					root.querySelector("button[data-action=attack]").click();
					const r = await pending;
					assert.equal(r.attackOptions.cost, 4);
					assert.equal(balance(actor), before - 4);
					assert.match(r.roll.formula, /\+ 6$/, "+5 do Ataque Especial e +1 livre");
					const dmg = await gun.rollDamage({ attackOptions: r.attackOptions });
					assert.match(dmg.formula, /2d8 \+ 12 \+ 1d4/, "Para Bellum +2, Ataque Especial +10 e +1d4");
				}));

			it("cancelar não rola nem gasta", () =>
				setup(async (actor, gun) => {
					const before = balance(actor);
					const count = game.messages.size;
					const pending = gun.rollAttack({ event: { shiftKey: false } });
					const root = await dialog();
					type(root, 'input[name^="pool."][name$=".attack"]', 2);
					root.querySelector(".window-header [data-action=close]").click();
					assert.equal(await pending, null);
					assert.equal(balance(actor), before);
					assert.equal(game.messages.size, count);
				}));

			it("sem saldo suficiente a tela avisa e não ataca", () =>
				setup(
					async (actor, gun) => {
						const count = game.messages.size;
						const pending = gun.rollAttack({ event: { shiftKey: false } });
						const root = await dialog();
						type(root, 'input[name^="pool."][name$=".attack"]', 3);
						root.querySelector("button[data-action=attack]").click();
						assert.equal(await pending, null);
						assert.equal(balance(actor), 1);
						assert.equal(game.messages.size, count);
					},
					{ pd: 1 }
				));

			it("remover o item que dá a opção tira a opção da tela", () =>
				setup(async (actor, gun) => {
					await actor.items.find((i) => i.name === "Ataque Especial").delete();
					await wait(200);
					const pending = gun.rollAttack({ event: { shiftKey: false } });
					const root = await dialog();
					assert.equal(root.querySelector('input[name^="pool."]'), null);
					root.querySelector(".window-header [data-action=close]").click();
					await pending;
				}));

			it("habilidade de trilha e modificação presa à arma entram nos bônus", () =>
				setup(async (actor, gun) => {
					const [trailPower] = await actor.createEmbeddedDocuments("Item", [await fromPack("pathSpecialist", "NEX 10% - Ataque Furtivo")]);
					await trailPower.createEmbeddedDocuments("ActiveEffect", [{
						name: "Ataque Furtivo",
						changes: [],
						disabled: false,
						flags: { [SYSTEM]: { onUse: { enabled: true, applies: "melee", cost: 1, damageBonus: "1d6" } } },
					}]);
					await gun.createEmbeddedDocuments("ActiveEffect", [{
						name: "Modificação Certeira",
						changes: [],
						disabled: false,
						flags: { [SYSTEM]: { onUse: { enabled: true, applies: "melee", auto: true, attackBonus: 2 } } },
					}]);
					const pending = gun.rollAttack({ event: { shiftKey: false } });
					const root = await dialog();
					assert.match(root.innerText, /Ataque Furtivo/);
					assert.match(root.innerText, /Modificação Certeira/);
					const option = [...root.querySelectorAll("label.op-ad-row")].find((row) => row.innerText.includes("Ataque Furtivo"));
					assert.ok(option?.querySelector('input[type="checkbox"]'), "habilidade de trilha aparece como opção ativável");
					option.querySelector('input[type="checkbox"]').click();
					root.querySelector("button[data-action=attack]").click();
					const result = await pending;
					assert.equal(result.attackOptions.cost, 1);
					assert.ok(result.attackOptions.lines.some((line) => line.includes("Ataque Furtivo")));
					assert.ok(result.attackOptions.lines.some((line) => line.includes("Modificação Certeira")));
					assert.equal(result.attackOptions.attackFlat, 2, "a modificação da arma soma +2 no ataque");
					assert.deepEqual(result.attackOptions.damageTerms, ["+1d6"], "a habilidade de trilha soma +1d6 no dano");
					const damage = await gun.rollDamage({ attackOptions: result.attackOptions });
					assert.match(damage.formula, /1d6.*1d6/, "o dano da habilidade de trilha chega à rolagem de dano");
				}, { weapon: "Machete" }));

			it("condições ativas aparecem no cartão e aplicam a penalidade ao ataque", () =>
				setup(async (actor, gun) => {
					await actor.createEmbeddedDocuments("ActiveEffect", [conditionEffectData("grabbed")]);
					const result = await gun.rollAttack({});
					assert.match(result.roll.formula, /^1d20kh/, "Agarrado tira um dado do ataque do agente");
					assert.deepEqual(result.attackOptions.conditions.map((condition) => condition.name), ["Agarrado"]);
					const message = game.messages.get(gun.lastAttackMessageId);
					assert.match(message.flavor, /Agarrado/);
					assert.match(message.flavor, /−1 dado no ataque/);
					assert.deepEqual(message.getFlag(SYSTEM, "attackOptions").conditions.map((condition) => condition.name), ["Agarrado"]);
				}));

			it("remover a condição na tela apaga o efeito do agente e restaura o dado", () =>
				setup(async (actor, gun) => {
					const [condition] = await actor.createEmbeddedDocuments("ActiveEffect", [conditionEffectData("grabbed")]);
					const pending = gun.rollAttack({ event: { shiftKey: false } });
					const root = await dialog();
					const row = [...root.querySelectorAll(".op-ad-condition")].find((entry) => entry.innerText.includes("Agarrado"));
					assert.ok(row, "condição aparece com a penalidade no diálogo");
					row.querySelector('button[data-action="remove-condition"]').click();
					await wait(200);
					assert.equal(actor.effects.get(condition.id), undefined, "remover na tela remove o efeito ativo do agente");
					assert.equal(root.querySelector(".op-ad-condition"), null);
					root.querySelector("button[data-action=attack]").click();
					const result = await pending;
					assert.match(result.roll.formula, /^2d20kh/, "o agente volta a rolar os dados sem a condição");
					assert.deepEqual(result.attackOptions.conditions, []);
				}));
		});
	});
});
