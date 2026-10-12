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
			fighting: { attr: ["str"], degree: { label: "untrained", override: 10 } },
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

			describe("buff nos testes e perícias adicionáveis", () => {
				let actor;
				before(async () => {
					actor = await Actor.create(aberracao());
				});
				after(async () => {
					await actor?.sheet?.close();
					await actor?.delete();
				});

				it("buff (skills.X.value) soma ao bônus base: Fortitude 3O+10 → 3O+15", async () => {
					await actor.update({ "system.skills.resilience.value": 5 });
					assert.equal(actor.system.skills.resilience.testLabel, "3O+15");
					assert.equal(actor.system.skills.resilience.formula, "3d20kh + 15");
					assert.equal(actor.system.skills.resilience.base, 10);
					assert.equal(actor.system.skills.resilience.buff, 5);
				});

				it("buff negativo vira penalidade", async () => {
					await actor.update({ "system.skills.resilience.value": -4 });
					assert.equal(actor.system.skills.resilience.testLabel, "3O+6");
				});

				it("o buff entra na rolagem real", async () => {
					await actor.update({ "system.skills.resilience.value": 5 });
					const roll = await actor.rollThreatTest("resilience");
					try {
						assert.equal(roll.formula.replace(/\s+/g, ""), "3d20kh+15");
					} finally {
						await game.messages.contents.at(-1)?.delete();
					}
				});

				it("perícia extra: bônus + buff", async () => {
					await actor.update({ "system.extraSkills": [{ key: "athleticism", attr: "str", bonus: 10, buff: 5 }] });
					assert.equal(actor.system.extraSkills[0].total, 15);
					assert.equal(actor.system.extraSkills[0].testLabel, "3O+15"); // FOR 3
				});

				it("ficha: seletor lista Atletismo até ser adicionado; depois some da lista", async () => {
					await actor.update({ "system.extraSkills": [] });
					let ctx = await actor.sheet._prepareContext({ parts: ["threat"] });
					assert.ok(ctx.skillPicker.some((s) => s.key === "athleticism"), "Atletismo deveria estar no seletor");
					await actor.sheet.addExtraSkill("athleticism");
					assert.equal(actor.system.extraSkills.length, 1);
					assert.equal(actor.system.extraSkills[0].key, "athleticism");
					assert.equal(actor.system.extraSkills[0].attr, "str", "Atletismo usa FOR por padrão");
					ctx = await actor.sheet._prepareContext({ parts: ["threat"] });
					assert.equal(ctx.skillPicker.some((s) => s.key === "athleticism"), false);
					assert.equal(ctx.skillRows.at(-1).isCustom, false);
				});

				it("ficha: campo de buff existe para cada teste e perícia extra", async () => {
					await actor.sheet.render({ force: true });
					await new Promise((r) => setTimeout(r, 500));
					const el = actor.sheet.element;
					for (const key of ["perception", "initiative", "resilience", "reflexes", "will"]) {
						assert.ok(el.querySelector(`input[name="system.skills.${key}.value"]`), `buff de ${key} ausente`);
					}
					assert.ok(el.querySelector('input[name="system.extraSkills.0.buff"]'), "buff da perícia extra ausente");
					assert.ok(el.querySelector("[data-skill-picker]"), "seletor de perícia ausente");
				});

				it("ficha: editar o buff pelo formulário atualiza o teste", async () => {
					const input = actor.sheet.element.querySelector('input[name="system.skills.will.value"]');
					input.value = "7";
					input.dispatchEvent(new Event("change", { bubbles: true }));
					await new Promise((r) => setTimeout(r, 700));
					assert.equal(actor.system.skills.will.value, 7);
					assert.equal(actor.system.skills.will.buff, 7);
				});

				it("ficha: editar a perícia extra pelo formulário mantém os outros campos", async () => {
					const input = actor.sheet.element.querySelector('input[name="system.extraSkills.0.buff"]');
					input.value = "4";
					input.dispatchEvent(new Event("change", { bubbles: true }));
					await new Promise((r) => setTimeout(r, 700));
					const e = actor.system.extraSkills[0];
					assert.equal(e.buff, 4);
					assert.equal(e.key, "athleticism", "a chave não pode se perder ao editar");
					assert.equal(e.attr, "str");
				});

				const shiftClick = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
				const menuOf = () => actor.sheet.element.querySelector(".sb-buff-menu");
				const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

				it("Shift+clique no teste abre o menu de buff e NÃO rola", async () => {
					await actor.update({ "system.skills.resilience.value": 0 });
					await actor.sheet.render({ force: true });
					await settle();
					const before = game.messages.size;
					shiftClick(actor.sheet.element.querySelector("[data-action='rollThreatTest'][data-key='resilience']"));
					await settle(300);
					assert.ok(menuOf(), "menu de buff não abriu");
					assert.equal(game.messages.size, before, "Shift+clique não deve rolar o teste");
					assert.equal(menuOf().querySelector("input").value, "0");
					actor.sheet.closeBuffMenu();
					assert.equal(menuOf(), null);
				});

				it("menu: +/− e a prévia mostram o teste com o buff; Aplicar grava", async () => {
					shiftClick(actor.sheet.element.querySelector("[data-action='rollThreatTest'][data-key='resilience']"));
					await settle(300);
					const [minus, plus] = menuOf().querySelectorAll(".sb-bm-row button");
					plus.click();
					plus.click();
					plus.click();
					assert.equal(menuOf().querySelector("input").value, "3");
					assert.ok(menuOf().querySelector(".sb-bm-preview").textContent.includes("+10"), "prévia deveria mostrar a base +10");
					minus.click();
					assert.equal(menuOf().querySelector("input").value, "2");
					menuOf().querySelector(".sb-bm-apply").click();
					await settle(700);
					assert.equal(menuOf(), null, "menu deveria fechar ao aplicar");
					assert.equal(actor.system.skills.resilience.value, 2);
					assert.equal(actor.system.skills.resilience.testLabel, "3O+12");
				});

				it("menu: Enter aplica o valor digitado, Esc cancela, Zerar limpa", async () => {
					const chip = () => actor.sheet.element.querySelector("[data-action='rollThreatTest'][data-key='resilience']");
					shiftClick(chip());
					await settle(300);
					let input = menuOf().querySelector("input");
					input.value = "-4";
					input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
					await settle(700);
					assert.equal(actor.system.skills.resilience.value, -4);

					shiftClick(chip());
					await settle(300);
					input = menuOf().querySelector("input");
					input.value = "99";
					input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
					await settle(300);
					assert.equal(menuOf(), null);
					assert.equal(actor.system.skills.resilience.value, -4, "Esc não pode gravar");

					shiftClick(chip());
					await settle(300);
					menuOf().querySelectorAll(".sb-bm-actions button")[0].click();
					await settle(700);
					assert.equal(actor.system.skills.resilience.value, 0);
				});

				it("menu também funciona na perícia extra e guarda no buff dela", async () => {
					await actor.update({ "system.extraSkills": [{ key: "athleticism", attr: "str", bonus: 10, buff: 0 }] });
					await actor.sheet.render({ force: true });
					await settle();
					shiftClick(actor.sheet.element.querySelector("[data-action='rollThreatExtra'][data-index='0']"));
					await settle(300);
					const input = menuOf().querySelector("input");
					input.value = "5";
					input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
					await settle(700);
					assert.equal(actor.system.extraSkills[0].buff, 5);
					assert.equal(actor.system.extraSkills[0].bonus, 10, "o bônus base não pode mudar");
					assert.equal(actor.system.extraSkills[0].testLabel, "3O+15");
				});

				it("clique normal (sem Shift) continua rolando e não abre menu", async () => {
					const before = game.messages.size;
					actor.sheet.element.querySelector("[data-action='rollThreatTest'][data-key='resilience']").click();
					await settle(900);
					try {
						assert.equal(menuOf(), null);
						assert.equal(game.messages.size, before + 1);
					} finally {
						await game.messages.contents.at(-1)?.delete();
					}
				});
			});

			describe("buff e perícias: casos de borda", () => {
				let actor;
				const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));
				const shiftClick = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
				const menuOf = () => actor.sheet.element.querySelector(".sb-buff-menu");
				const chip = (key) => actor.sheet.element.querySelector(`[data-action='rollThreatTest'][data-key='${key}']`);
				const testOf = async (key) => {
					const ctx = await actor.sheet._prepareContext({ parts: ["threat"] });
					return [...ctx.defenseTests, ...ctx.senseTests].find((t) => t.key === key);
				};
				before(async () => {
					actor = await Actor.create(aberracao());
					await actor.sheet.render({ force: true });
					await settle();
				});
				after(async () => {
					await actor?.sheet?.close();
					await actor?.delete();
				});

				it("contexto: buff positivo é 'pos', negativo é 'neg', zero não mostra etiqueta", async () => {
					assert.equal((await testOf("will")).hasBuff, false);
					await actor.update({ "system.skills.will.value": 3 });
					let t = await testOf("will");
					assert.equal(t.hasBuff, true);
					assert.equal(t.buffClass, "pos");
					assert.equal(t.buffText, "+3");
					await actor.update({ "system.skills.will.value": -2 });
					t = await testOf("will");
					assert.equal(t.buffClass, "neg");
					await actor.update({ "system.skills.will.value": 0 });
				});

				it("tooltip do teste mostra fórmula, base, buff e a dica de Shift+clique", async () => {
					await actor.update({ "system.skills.resilience.value": 5 });
					const t = await testOf("resilience");
					assert.ok(t.tooltip.includes("3d20kh + 15"), t.tooltip);
					assert.ok(t.tooltip.includes("+10") && t.tooltip.includes("+5"), t.tooltip);
					assert.ok(t.tooltip.includes(game.i18n.localize("op.threat.shiftHint")), "dica do Shift ausente");
					await actor.update({ "system.skills.resilience.value": 0 });
				});

				it("remover uma perícia extra mantém as outras intactas", async () => {
					await actor.update({
						"system.extraSkills": [
							{ key: "athleticism", attr: "str", bonus: 10, buff: 2 },
							{ key: "", name: "Fofoca", attr: "pre", bonus: 4, buff: 1 },
							{ key: "occultism", attr: "int", bonus: 6, buff: 0 },
						],
					});
					await actor.sheet.render({ force: true });
					await settle();
					actor.sheet.element.querySelector("[data-action='removeExtraSkill'][data-index='1']").click();
					await settle(700);
					const list = actor.system.extraSkills;
					assert.equal(list.length, 2);
					assert.deepEqual(list.map((e) => e.key), ["athleticism", "occultism"]);
					assert.equal(list[0].buff, 2);
					assert.equal(list[1].bonus, 6);
				});

				it("menu: valor vazio vale 0 e decimal é truncado", async () => {
					await actor.sheet.render({ force: true });
					await settle();
					shiftClick(chip("reflexes"));
					await settle(300);
					const input = menuOf().querySelector("input");
					input.value = "";
					input.dispatchEvent(new Event("input", { bubbles: true }));
					assert.ok(menuOf().querySelector(".sb-bm-preview").textContent.includes("+0"), "prévia com buff vazio deveria usar 0");
					input.value = "3.9";
					input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
					await settle(700);
					assert.equal(actor.system.skills.reflexes.value, 3);
					await actor.update({ "system.skills.reflexes.value": 0 });
				});

				it("menu: abrir outro fecha o anterior (só existe um)", async () => {
					await actor.sheet.render({ force: true });
					await settle();
					shiftClick(chip("reflexes"));
					await settle(300);
					shiftClick(chip("will"));
					await settle(300);
					assert.equal(actor.sheet.element.querySelectorAll(".sb-buff-menu").length, 1);
					actor.sheet.closeBuffMenu();
				});

				it("menu: clicar fora fecha sem gravar", async () => {
					shiftClick(chip("will"));
					await settle(300);
					menuOf().querySelector("input").value = "9";
					document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
					await settle(100);
					assert.equal(menuOf(), null);
					assert.equal(actor.system.skills.will.value, 0);
				});

				it("menu: clicar dentro do próprio menu não fecha", async () => {
					shiftClick(chip("will"));
					await settle(300);
					menuOf().querySelector(".sb-bm-title").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
					await settle(100);
					assert.ok(menuOf(), "menu fechou ao clicar nele mesmo");
					actor.sheet.closeBuffMenu();
				});

				it("menu: chave ou índice inexistente não abre nada", () => {
					actor.sheet.openBuffMenu(chip("will"), { type: "extra", index: 99 });
					assert.equal(menuOf(), null);
					actor.sheet.openBuffMenu(chip("will"), { type: "skill", key: "naoExiste" });
					assert.equal(menuOf(), null);
				});

				it("formulário: dados fixos vazios voltam a ser derivados do atributo (null)", async () => {
					await actor.update({ "system.extraSkills": [{ key: "athleticism", attr: "str", diceOverride: 1, bonus: 10, buff: 0 }] });
					await actor.sheet.render({ force: true });
					await settle();
					assert.equal(actor.system.extraSkills[0].testLabel, "O+10");
					const input = actor.sheet.element.querySelector('input[name="system.extraSkills.0.diceOverride"]');
					assert.ok(input, "campo de dados fixos ausente");
					input.value = "";
					input.dispatchEvent(new Event("change", { bubbles: true }));
					await settle(700);
					assert.equal(actor.system.extraSkills[0].diceOverride, null);
					assert.equal(actor.system.extraSkills[0].testLabel, "3O+10");
				});

				it("menu: fechar a ficha também remove o menu e o listener", async () => {
					shiftClick(chip("will"));
					await settle(300);
					assert.ok(menuOf());
					await actor.sheet.close();
					assert.equal(actor.sheet._buffMenu, null);
					assert.equal(actor.sheet._buffMenuOutside, null);
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
					const fort = el.querySelector("[data-action='rollThreatTest'][data-key='resilience'] b");
					assert.ok(fort, "teste de Fortitude ausente");
					assert.ok(fort.querySelector("i.fa-dice-d20"), "ícone de d20 ausente no teste");
					assert.equal(fort.textContent.trim(), "3+10", "Fortitude deveria mostrar 3 [d20] +10");
					assert.ok(el.textContent.includes("9m | 6"), "deslocamento não aparece");
					assert.equal(el.querySelectorAll(".sb-actions .sb-item .sb-die").length, 3);
				});

				it("render: presença perturbadora visível para criatura", () => {
					assert.ok(actor.sheet.element.querySelector(".sb-presence"));
				});

				it("abas: Resumo, Ações, Efeitos e Descrição separam o conteúdo", async () => {
					const el = actor.sheet.element;
					const settle = (ms = 200) => new Promise((r) => setTimeout(r, ms));
					const visible = (sel) => {
						const n = el.querySelector(sel);
						return !!n && !n.hidden && !n.closest("[hidden], [data-sb-hidden]");
					};
					assert.deepEqual([...el.querySelectorAll(".sb-tab-link")].map((a) => a.dataset.tab), ["stats", "actions", "effects", "description"]);
					// Aba inicial: Ficha
					assert.ok(visible(".sb-presence"), "presença deveria aparecer na aba Resumo");
					assert.equal(visible(".sb-actions"), false, "ações não aparecem na aba Resumo");
					assert.equal(visible("[data-application-part='enigmas']"), false);
					el.querySelector(".sb-tab-link[data-tab='actions']").click();
					await settle();
					assert.ok(visible(".sb-actions"));
					assert.equal(visible(".sb-presence"), false);
					el.querySelector(".sb-tab-link[data-tab='description']").click();
					await settle();
					assert.ok(visible("[data-application-part='enigmas']"));
					assert.equal(visible(".sb-actions"), false);
					el.querySelector(".sb-tab-link[data-tab='effects']").click();
					await settle();
					assert.ok(visible("[data-application-part='effects']"));
					assert.equal(visible("[data-application-part='enigmas']"), false);
					assert.ok(el.querySelector(".sb-tab-link[data-tab='effects']").classList.contains("active"));
				});

				it("abas: a aba escolhida sobrevive a um novo render", async () => {
					actor.sheet.activeTab = "actions";
					await actor.sheet.render({ force: true });
					await new Promise((r) => setTimeout(r, 400));
					const el = actor.sheet.element;
					assert.equal(el.querySelector(".sb-actions").closest("[hidden]"), null);
					assert.ok(el.querySelector(".sb-presence").closest("[hidden]"));
					actor.sheet.activeTab = "stats";
					await actor.sheet.render({ force: true });
					await new Promise((r) => setTimeout(r, 400));
				});

				it("elementos: botão + acrescenta um elemento secundário; × remove", async () => {
					const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));
					const picker = () => actor.sheet.element.querySelector("[data-element-picker]");
					assert.ok(picker(), "seletor + Elemento ausente");
					assert.equal(actor.system.elements.others, "");
					assert.equal([...picker().options].some((o) => o.value === "blood"), false, "o elemento principal não deve ser oferecido");
					picker().value = "death";
					picker().dispatchEvent(new Event("change", { bubbles: true }));
					await settle();
					assert.equal(actor.system.elements.others, "death");
					picker().value = "energy";
					picker().dispatchEvent(new Event("change", { bubbles: true }));
					await settle();
					assert.equal(actor.system.elements.others, "death,energy");
					assert.equal([...picker().options].some((o) => o.value === "death"), false, "repetido não deve ser oferecido");
					await actor.sheet.addElement("death");
					await actor.sheet.addElement("blood");
					await actor.sheet.addElement("inexistente");
					assert.equal(actor.system.elements.others, "death,energy", "duplicado, principal e inválido são ignorados");
					const chips = [...actor.sheet.element.querySelectorAll(".sb-tags .sb-chip[class*='element-']")];
					assert.equal(chips.length, 3, "principal + 2 secundários");
					actor.sheet.element.querySelector("[data-action='removeElement'][data-key='death']").click();
					await settle();
					assert.equal(actor.system.elements.others, "energy");
					await actor.sheet.removeElement("energy");
					assert.equal(actor.system.elements.others, "");
				});

				it("dado do ataque posta o card e já rola o teste de ataque (2 ataques, x2)", async () => {
					const before = new Set(game.messages.map((m) => m.id));
					actor.sheet.element.querySelector(".sb-item-attack .sb-die").click();
					await new Promise((r) => setTimeout(r, 2500));
					const created = game.messages.filter((m) => !before.has(m.id));
					try {
						assert.ok(created.length >= 3, `esperava card + 2 ataques, vieram ${created.length}`);
						const attackRolls = created.filter((m) => m.rolls?.length);
						assert.equal(attackRolls.length, 2, "numberOfAttacks 2 deveria gerar 2 rolagens de ataque");
						assert.ok(
							attackRolls.every((m) => /^3d20kh\s*\+\s*10(\s*\+\s*0)?$/.test(m.rolls[0].formula)),
							`fórmula inesperada: ${attackRolls.map((m) => m.rolls[0].formula)}`
						);
					} finally {
						for (const m of created) await m.delete();
					}
				});

				it("dado de habilidade só posta o card (sem rolagem)", async () => {
					const before = new Set(game.messages.map((m) => m.id));
					actor.sheet.element.querySelector(".sb-item-ability .sb-die").click();
					await new Promise((r) => setTimeout(r, 1500));
					const created = game.messages.filter((m) => !before.has(m.id));
					try {
						assert.equal(created.length, 1);
						assert.equal(created[0].rolls?.length ?? 0, 0);
					} finally {
						for (const m of created) await m.delete();
					}
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
					const picker = el.querySelector("[data-skill-picker]");
					picker.value = "__custom";
					picker.dispatchEvent(new Event("change", { bubbles: true }));
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
