/**
 * Ficha de Ameaça no formato do livro (Cap. 7): valores derivados, testes xO+y, RD com exceção,
 * vulnerabilidade/imunidade, Cura Acelerada, agrupamento de ações e render da ficha.
 * Prefixo das fixtures: "[Quench]" (limpas por installBatchGuards).
 *
 * Lógica pura (formatTest, resolveDamage...) também é testada em Node: tests/unit/threat-calc.test.mjs.
 */
import { installBatchGuards } from "../helpers/fixtures.mjs";

/** Aberração de carne (Livro, p. 182) como fixture. */
const aberracao = () => ({
	name: "[Quench] Aberração de carne",
	type: "threat",
	system: {
		attributes: {
			hp: { value: 70, max: 70 },
			dex: { value: 1 },
			str: { value: 3 },
			int: { value: 0 },
			pre: { value: 1 },
			vit: { value: 3 },
			movement: { walk: 9, unit: "m" },
			vd: { value: 40 },
		},
		size: "large",
		elements: { main: "blood" },
		details: { creatureType: "creature" },
		defense: { value: 19 },
		skills: {
			resilience: { attr: ["vit"], degree: { label: "untrained", override: 10 } },
			perception: { attr: ["pre"], degree: { label: "untrained", override: 5 } },
			initiative: { attr: ["dex"], degree: { label: "untrained", override: null } },
			reflexes: { attr: ["dex"], degree: { label: "untrained", override: null } },
			will: { attr: ["pre"], degree: { label: "untrained", override: null } },
		},
		resistances: {
			ballisticDamage: { value: 5 },
			impactDamage: { value: 5 },
			piercingDamage: { value: 5 },
			bloodDamage: { value: 10 },
			deathDamage: { vulnerable: true },
		},
	},
});

Hooks.once("quenchReady", (quench) => {
	quench.registerBatch(
		"ordemparanormal.actor.threat-book",
		(context) => {
			const { describe, it, assert, before, after } = context;
			installBatchGuards(context, { prefix: "[Quench]" });

			describe("derivados no formato do livro", () => {
				let actor;
				before(async () => {
					actor = await Actor.create(aberracao());
				});
				after(async () => {
					await actor?.delete();
				});

				it("PV 70 → machucado 35", () => {
					assert.equal(actor.system.attributes.hp.bruised, 35);
					assert.equal(actor.system.attributes.hp.isBruised, false);
				});

				it("machucado vira true com PV <= 35", async () => {
					await actor.update({ "system.attributes.hp.value": 35 });
					assert.equal(actor.system.attributes.hp.isBruised, true);
					await actor.update({ "system.attributes.hp.value": 70 });
				});

				it("deslocamento 9m → 6 quadrados e rótulo '9m | 6'", () => {
					assert.equal(actor.system.attributes.movement.squaresCalc, 6);
					assert.equal(actor.system.attributes.movement.label, "9m | 6");
				});

				it("tamanho Grande: Furtividade −2, Manobras +2, espaço 3m", () => {
					assert.deepEqual({ ...actor.system.sizeData }, { stealth: -2, maneuvers: 2, space: 3 });
				});

				it("Fortitude = 3O+10 (VIG 3, bônus 10)", () => {
					assert.equal(actor.system.skills.resilience.testLabel, "3O+10");
					assert.equal(actor.system.skills.resilience.formula, "3d20kh + 10");
				});

				it("Percepção = O+5, Iniciativa = O, Reflexos = O, Vontade = O", () => {
					assert.equal(actor.system.skills.perception.testLabel, "O+5");
					assert.equal(actor.system.skills.initiative.testLabel, "O");
					assert.equal(actor.system.skills.reflexes.testLabel, "O");
					assert.equal(actor.system.skills.will.testLabel, "O");
				});

				it("campos novos têm padrão seguro em ameaças antigas", async () => {
					const legacy = await Actor.create({ name: "[Quench] Legacy", type: "threat" });
					try {
						assert.deepEqual(legacy.system.extraSkills, []);
						assert.equal(legacy.system.genericRd.value, 0);
						assert.deepEqual(legacy.system.genericRd.except, []);
						assert.equal(legacy.system.fastHealing.value, 0);
					} finally {
						await legacy.delete();
					}
				});
			});

			describe("perícias extras (xO+y)", () => {
				let actor;
				before(async () => {
					actor = await Actor.create({
						...aberracao(),
						name: "[Quench] Bandido",
						system: {
							attributes: { dex: { value: 2 }, int: { value: 3 } },
							extraSkills: [
								{ name: "Crime", attr: "dex", bonus: 5 },
								{ name: "Ocultismo", attr: "int", bonus: 15 },
								{ name: "Fixa", attr: "dex", diceOverride: 1, bonus: 5 },
							],
						},
					});
				});
				after(async () => {
					await actor?.delete();
				});

				it("dados vêm do atributo", () => {
					assert.equal(actor.system.extraSkills[0].testLabel, "2O+5");
					assert.equal(actor.system.extraSkills[1].testLabel, "3O+15");
				});

				it("diceOverride tem prioridade sobre o atributo", () => {
					assert.equal(actor.system.extraSkills[2].testLabel, "O+5");
					assert.equal(actor.system.extraSkills[2].formula, "1d20kh + 5");
				});

				it("rollThreatExtraSkill rola a fórmula e devolve Roll", async () => {
					const roll = await actor.rollThreatExtraSkill(0);
					try {
						assert.equal(roll.formula.replace(/\s+/g, ""), "2d20kh+5");
						assert.ok(roll.total >= 6 && roll.total <= 25, `total fora do intervalo: ${roll.total}`);
					} finally {
						await game.messages.contents.at(-1)?.delete();
					}
				});

				it("índice inválido não rola nada", async () => {
					assert.equal(await actor.rollThreatExtraSkill(99), null);
				});
			});

			describe("rollThreatTest", () => {
				let actor;
				before(async () => {
					actor = await Actor.create(aberracao());
				});
				after(async () => {
					await actor?.delete();
				});

				it("Fortitude rola 3d20kh + 10 (maior dado + 10)", async () => {
					const roll = await actor.rollThreatTest("resilience");
					try {
						assert.equal(roll.formula.replace(/\s+/g, ""), "3d20kh+10");
						const dice = roll.dice[0].results.map((r) => r.result);
						assert.equal(dice.length, 3);
						assert.equal(roll.total, Math.max(...dice) + 10);
					} finally {
						await game.messages.contents.at(-1)?.delete();
					}
				});

				it("perícia inexistente devolve null", async () => {
					assert.equal(await actor.rollThreatTest("naoexiste"), null);
				});
			});

			describe("applyDamage — RD, vulnerabilidade, imunidade", () => {
				let actor;
				before(async () => {
					actor = await Actor.create({
						...aberracao(),
						name: "[Quench] RD",
						system: {
							...aberracao().system,
							genericRd: { value: 4, except: ["deathDamage"] },
							resistances: {
								impactDamage: { value: 7 },
								deathDamage: { vulnerable: true },
								fireDamage: { immune: true },
							},
						},
					});
				});
				after(async () => {
					await actor?.delete();
				});

				const reset = () => actor.update({ "system.attributes.hp.value": 70 });

				it("RD tipada vence a RD geral menor (7 > 4)", async () => {
					await reset();
					const r = await actor.applyDamage(10, { damageType: "impactDamage" });
					assert.equal(r.finalDamage, 3);
					assert.equal(r.newPV, 67);
				});

				it("RD geral vale para tipos sem RD própria", async () => {
					await reset();
					const r = await actor.applyDamage(10, { damageType: "cuttingDamage" });
					assert.equal(r.finalDamage, 6);
				});

				it("RD geral não vale para o tipo da exceção; vulnerabilidade dobra", async () => {
					await reset();
					const r = await actor.applyDamage(15, { damageType: "deathDamage" });
					assert.equal(r.finalDamage, 30);
					assert.equal(r.newPV, 40);
				});

				it("imunidade zera o dano", async () => {
					await reset();
					const r = await actor.applyDamage(50, { damageType: "fireDamage" });
					assert.equal(r.finalDamage, 0);
					assert.equal(actor.system.attributes.hp.value, 70);
				});

				it("ignoreRD ignora a RD", async () => {
					await reset();
					const r = await actor.applyDamage(10, { damageType: "impactDamage", ignoreRD: true });
					assert.equal(r.finalDamage, 10);
				});

				it("PV não ficam negativos e 'morrendo' é sinalizado", async () => {
					await reset();
					const r = await actor.applyDamage(500, { damageType: "cuttingDamage" });
					assert.equal(r.newPV, 0);
					assert.ok(r.conditions.includes("morrendo"));
				});

				it("guarda o tipo do último dano", async () => {
					await reset();
					await actor.applyDamage(5, { damageType: "bloodDamage" });
					assert.equal(actor.getFlag("ordem_v2_classic", "lastDamageType"), "bloodDamage");
				});
			});

			describe("Cura Acelerada", () => {
				let actor;
				before(async () => {
					actor = await Actor.create({
						...aberracao(),
						name: "[Quench] Cura",
						system: {
							...aberracao().system,
							attributes: { ...aberracao().system.attributes, hp: { value: 20, max: 70 } },
							fastHealing: { value: 10, except: ["chemicalDamage"] },
						},
					});
				});
				after(async () => {
					await actor?.delete();
				});

				it("recupera o valor no turno", async () => {
					await actor.update({ "flags.ordem_v2_classic.-=lastDamageType": null });
					assert.equal(await actor.applyThreatFastHealing(), 10);
					assert.equal(actor.system.attributes.hp.value, 30);
				});

				it("não recupera após dano do tipo da exceção", async () => {
					await actor.setFlag("ordem_v2_classic", "lastDamageType", "chemicalDamage");
					assert.equal(await actor.applyThreatFastHealing(), 0);
					assert.equal(actor.system.attributes.hp.value, 30);
				});

				it("não passa do máximo", async () => {
					await actor.update({ "system.attributes.hp.value": 66 });
					await actor.setFlag("ordem_v2_classic", "lastDamageType", "impactDamage");
					assert.equal(await actor.applyThreatFastHealing(), 4);
					assert.equal(actor.system.attributes.hp.value, 70);
				});

				it("sem Cura Acelerada devolve 0", async () => {
					await actor.update({ "system.fastHealing.value": 0, "system.attributes.hp.value": 10 });
					assert.equal(await actor.applyThreatFastHealing(), 0);
				});
			});

			describe("ficha: agrupamento de ações e render", () => {
				let actor;
				before(async () => {
					actor = await Actor.create(aberracao());
					await actor.createEmbeddedDocuments("Item", [
						{
							name: "Pancada",
							type: "armament",
							system: {
								formulas: {
									attack: { attr: "str", skill: "fighting", bonus: 0 },
									damage: { formula: "2d6+6", type: "impactDamage" },
								},
								critical: "20",
								actionType: "standard",
								numberOfAttacks: 2,
								types: { rangeType: { name: "melee" } },
							},
						},
						{ name: "Agarrão", type: "ability", system: { activation: "reaction" } },
						{ name: "Abocanhar", type: "ability", system: { activation: "movement" } },
						{ name: "Origem", type: "ability", system: { activation: "passive" } },
					]);
				});
				after(async () => {
					await actor?.sheet?.close();
					await actor?.delete();
				});

				it("contexto: grupos na ordem do livro e passivas separadas", async () => {
					const ctx = await actor.sheet._prepareContext({ parts: ["threat"] });
					assert.deepEqual(
						ctx.actionGroups.map((g) => g.key),
						["default", "movement", "reaction"]
					);
					assert.deepEqual(
						ctx.passives.map((i) => i.name),
						["Origem"]
					);
				});

				it("ataque: teste no formato do livro e meta com multiplicador", async () => {
					const ctx = await actor.sheet._prepareContext({ parts: ["threat"] });
					const pancada = ctx.attacks.find((i) => i.name === "Pancada");
					assert.match(pancada.testLabel, /^3O/, `esperava 3O..., veio ${pancada.testLabel}`);
					assert.ok(pancada.rowMeta.includes("x2"), `meta sem x2: ${pancada.rowMeta}`);
					assert.ok(pancada.damageLabel.startsWith("2d6+6"));
				});

				it("contexto: tags de resistência e vulnerabilidade", async () => {
					const ctx = await actor.sheet._prepareContext({ parts: ["threat"] });
					assert.ok(ctx.rdTags.length >= 4, `rdTags: ${ctx.rdTags.length}`);
					assert.equal(ctx.vulnerableTags.length, 1);
					assert.equal(ctx.hasSkills, false);
				});

				it("render: bloco, VD, Fortitude e um dado por ação", async () => {
					await actor.sheet.render({ force: true });
					await new Promise((r) => setTimeout(r, 400));
					const el = actor.sheet.element;
					assert.ok(el.querySelector(".sb"), "bloco .sb ausente");
					assert.equal(el.querySelector(".sb-vd-input").value, "40");
					assert.ok(el.textContent.includes("3O+10"), "Fortitude 3O+10 não aparece");
					assert.ok(el.textContent.includes("9m | 6"), "deslocamento não aparece");
					assert.equal(el.querySelectorAll(".sb-actions .sb-item .sb-die").length, 3);
				});

				it("render: sem abas e presença perturbadora visível para criatura", () => {
					const el = actor.sheet.element;
					assert.equal(el.querySelectorAll("nav.tabs, .sheet-tabs").length, 0);
					assert.ok(el.querySelector(".sb-presence"));
				});

				it("modo de edição alterna a classe sb-editing", () => {
					const el = actor.sheet.element;
					const root = el.querySelector(".sb");
					assert.equal(root.classList.contains("sb-editing"), false);
					el.querySelector("[data-action='toggleEdit']").click();
					assert.equal(root.classList.contains("sb-editing"), true);
					el.querySelector("[data-action='toggleEdit']").click();
					assert.equal(root.classList.contains("sb-editing"), false);
				});

				it("adicionar e remover perícia extra pela ficha", async () => {
					const el = actor.sheet.element;
					el.querySelector("[data-action='addExtraSkill']").click();
					await new Promise((r) => setTimeout(r, 400));
					assert.equal(actor.system.extraSkills.length, 1);
					await actor.update({ "system.extraSkills": [{ name: "Crime", attr: "dex", bonus: 5 }] });
					await new Promise((r) => setTimeout(r, 400));
					actor.sheet.element.querySelector("[data-action='removeExtraSkill']").click();
					await new Promise((r) => setTimeout(r, 400));
					assert.equal(actor.system.extraSkills.length, 0);
				});

				it("sem criatura, a presença perturbadora some", async () => {
					await actor.update({ "system.details.creatureType": "person" });
					await new Promise((r) => setTimeout(r, 400));
					assert.equal(actor.sheet.element.querySelector(".sb-presence"), null);
				});
			});
		},
		{ displayName: "Ordem Paranormal: Ficha de Ameaça (livro)" }
	);
});
