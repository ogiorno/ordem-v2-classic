/**
 * Animação de dano nas criaturas (docs/spec-animacao-dano-criaturas.md): reação do token, bloqueio, morte, restauração.
 * Roda no mundo, como GM, numa cena temporária própria ("ZZ DF arena (teste dano)") com ameaças "[Quench] ..." criadas aqui:
 * tudo é apagado no fim, a cena ativa do mundo não é tocada. Lógica pura: tests/unit/damage-fx.test.mjs.
 *   await import("/systems/ordem_v2_classic/module/tests/mini-quench.mjs");
 *   await miniQuench("/systems/ordem_v2_classic/module/tests/suites/damage-fx.test.mjs")
 */
import { installBatchGuards } from "../helpers/fixtures.mjs";

const SYSTEM = "ordem_v2_classic";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SCENE_NAME = "ZZ DF arena (teste dano)";

Hooks.once("quenchReady", (quench) => {
	quench.registerBatch(
		"ordemparanormal.damage-fx",
		(context) => {
			const { describe, it, assert, before, after } = context;
			installBatchGuards(context, { prefix: "[Quench]" });

			describe("reação do token ao dano", () => {
				let previous, scene;
				const actors = {};
				const tokens = {};
				const hist = () => CONFIG.opDamageFx.history;
				const hp = (key) => tokens[key].actor.system.attributes.hp.value;
				const hit = async (key, amount, { type, crit = false, source = true, wait = 1800 } = {}) => {
					await tokens[key].actor.applyDamage(amount, { damageType: type, fx: { sourceUuid: source ? tokens.attacker.uuid : null, crit } });
					await sleep(wait);
					return hist().at(-1);
				};
				const reset = async () => {
					for (const key of ["blood", "death", "knowledge", "energy", "fear", "neutral"]) {
						await tokens[key].actor.update({ "system.attributes.hp.value": 100, "system.attributes.hp.max": 100, "system.genericRd": { value: 0, except: [] } });
					}
					await sleep(900);
				};

				before(async () => {
					previous = canvas.scene;
					scene = await Scene.create({ name: SCENE_NAME, width: 3200, height: 2200, padding: 0, grid: { size: 100, distance: 1.5, units: "m" }, tokenVision: false });
					await scene.view();
					for (let i = 0; i < 40 && !(canvas.scene?.id === scene.id && canvas.ready); i++) await sleep(250);
					const level = scene.levels.contents[0].id;
					const specs = [["blood", "blood"], ["death", "death"], ["knowledge", "knowledge"], ["energy", "energy"], ["fear", "fear"], ["neutral", ""]];
					const docs = [];
					for (const [i, [key, element]] of specs.entries()) {
						actors[key] = await Actor.create({ name: `[Quench] DF ${key}`, type: "threat", system: { attributes: { hp: { value: 100, max: 100 } }, elements: { main: element } }, prototypeToken: { actorLink: i % 2 === 0 } });
						const data = (await actors[key].getTokenDocument({ x: 500 + i * 300, y: 800 })).toObject();
						data.level = level;
						docs.push(data);
					}
					actors.attacker = await Actor.create({ name: "[Quench] DF atacante", type: "agent" });
					const atk = (await actors.attacker.getTokenDocument({ x: 500, y: 1400 })).toObject();
					atk.level = level;
					docs.push(atk);
					await scene.createEmbeddedDocuments("Token", docs);
					for (const doc of scene.tokens) {
						const key = Object.keys(actors).find((k) => actors[k].id === doc.actorId);
						if (key) tokens[key] = doc;
					}
					await canvas.draw(scene);
					await sleep(500);
				});

				after(async () => {
					await previous?.view().catch(() => {});
					await sleep(500);
					await scene?.delete().catch(() => {});
					for (const actor of Object.values(actors)) await actor?.delete().catch(() => {});
				});

				it("DF-01: queda de PV anima; cura não", async () => {
					const n = hist().length;
					await tokens.blood.actor.update({ "system.attributes.hp.value": 60 });
					await sleep(1800);
					assert.equal(hist().length, n + 1);
					await tokens.blood.actor.update({ "system.attributes.hp.value": 100 });
					await sleep(1000);
					assert.equal(hist().length, n + 1);
				});

				it("DF-02/DF-08: cada elemento resolve um perfil próprio e o token volta ao original (DF-13)", async () => {
					const seen = new Set();
					for (const key of ["blood", "death", "knowledge", "energy", "fear", "neutral"]) {
						await reset();
						const r = await hit(key, 30, { type: "fireDamage", wait: 1500 });
						assert.equal(r.kind, "damage");
						assert.equal(r.element, key === "neutral" ? "neutral" : key);
						assert.equal(r.restored, true, `${key} não voltou ao original`);
						seen.add(r.element);
					}
					assert.equal(seen.size, 6);
				});

				it("DF-05: RD que zera o dano ainda dispara o bloqueio, sem mudar o PV", async () => {
					await reset();
					await tokens.blood.actor.update({ "system.genericRd": { value: 50, except: [] } });
					const n = hist().length;
					const r = await hit("blood", 10, { type: "cuttingDamage", wait: 1200 });
					assert.equal(r.kind, "block");
					assert.equal(hist().length, n + 1);
					assert.equal(hp("blood"), 100);
				});

				it("DF-06: cruzar Machucado marca crossedHurt uma vez só", async () => {
					await reset();
					await tokens.energy.actor.update({ "system.attributes.hp.value": 60 });
					await sleep(2000);
					assert.equal((await hit("energy", 15)).crossedHurt, true);
					assert.equal((await hit("energy", 5, { wait: 1500 })).crossedHurt, false);
				});

				it("DF-04: crítico sobe uma faixa", async () => {
					await reset();
					assert.equal((await hit("blood", 5, { crit: true, wait: 1500 })).tier, "media");
				});

				it("DF-14: 'Reduzir movimento' vira só flash e o token volta ao original", async () => {
					await game.settings.set(SYSTEM, "damageFxReduceMotion", true);
					try {
						await reset();
						const r = await hit("knowledge", 30, { wait: 1500 });
						assert.equal(r.motion, "flat");
						assert.equal(r.restored, true);
					} finally {
						await game.settings.set(SYSTEM, "damageFxReduceMotion", false);
					}
				});

				it("DF-15: sem efeito no banco do Sequencer a reação roda só com o movimento nativo", async () => {
					await reset();
					const database = globalThis.Sequencer?.Database;
					const original = database?.entryExists;
					if (database) database.entryExists = () => false;
					try {
						const r = await hit("blood", 30, { wait: 1500 });
						assert.equal(r.kind, "damage");
						assert.equal(r.restored, true);
					} finally {
						if (database) database.entryExists = original;
					}
				});

				it("DF-16: animação desligada não reage", async () => {
					await game.settings.set(SYSTEM, "damageFx", false);
					try {
						await reset();
						const n = hist().length;
						await hit("fear", 30, { wait: 1200 });
						assert.equal(hist().length, n);
					} finally {
						await game.settings.set(SYSTEM, "damageFx", true);
					}
				});

				it("DF-21: recua para longe do atacante, no máximo 0,25 casa; sem origem não recua", async () => {
					await reset();
					const r = await hit("blood", 30, { wait: 1500 });
					assert.isBelow(r.recoil.y, 0);
					assert.isAtMost(Math.hypot(r.recoil.x, r.recoil.y), 25.001);
					const none = await hit("blood", 10, { source: false, wait: 1500 });
					assert.deepEqual(none.recoil, { x: 0, y: 0 });
				});

				it("DF-11: duas reações no mesmo token — a mais forte vence e nada fica ativo", async () => {
					await reset();
					tokens.fear.actor.applyDamage(5, { fx: {} });
					await sleep(120);
					await tokens.fear.actor.applyDamage(60, { fx: {} });
					await sleep(2400);
					const r = hist().at(-1);
					assert.equal(r.tier, "critica");
					assert.equal(r.restored, true);
					assert.equal(CONFIG.opDamageFx.active, 0);
				});

				it("DF-27: se o token anda de verdade durante a reação, fica na posição nova", async () => {
					await reset();
					const doc = tokens.energy;
					const x = doc.x;
					doc.actor.applyDamage(60, { fx: {} });
					await sleep(500);
					await doc.update({ x: x + 100 });
					await sleep(2400);
					assert.equal(doc.x, x + 100);
					assert.equal(CONFIG.opDamageFx.active, 0);
					await doc.update({ x });
					await sleep(1200);
				});

				it("DF-07: 0 PV toca o final e o ícone de morto só aparece depois; DF-18: posições intactas", async () => {
					await reset();
					const before = JSON.stringify(scene.tokens.map((t) => [t.id, t.x, t.y]));
					const reaction = hit("death", 100, { wait: 2800 });
					await sleep(900);
					// durante o final o ícone de morto fica escondido, mesmo que outro cliente já tenha marcado o status
					assert.equal(tokens.death.object.effects.visible, false);
					const r = await reaction;
					assert.equal(r.kill, true);
					assert.equal(r.effectsHidden, true);
					assert.equal(r.restored, true);
					assert.equal(tokens.death.object.effects.visible, true);
					assert.equal(JSON.stringify(scene.tokens.map((t) => [t.id, t.x, t.y])), before);
				});
			});
		},
		{ displayName: "Ordem Paranormal: Animação de dano nas criaturas" }
	);
});
