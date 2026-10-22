// Suplemento Sobrevivendo ao Horror: concessão automática (origens, trilhas, Sobrevivente) e efeitos passivos.
// Rodar no console como GM:
//   await import("/systems/ordem-v2-classic/module/tests/mini-quench.mjs");
//   await miniQuench("/systems/ordem-v2-classic/module/tests/suites/sobrevivendo-ao-horror.test.mjs")
// Cria e apaga atores "[SAH] ..." (não mexe em fichas, cenas ou combates existentes).
import { installBatchGuards, withActor } from "../helpers/fixtures.mjs";

const SYSTEM = "ordem-v2-classic";

// Tabela 1.1 do suplemento: origem → poder.
const ORIGIN_POWER = {
	"Amigo dos Animais": "Companheiro Animal",
	"Astronauta": "Acostumado ao Extremo",
	"Chef do Outro Lado": "Fome do Outro Lado",
	"Colegial": "Poder da Amizade",
	"Cosplayer": "Não É Fantasia, É Cosplay!",
	"Diplomata": "Conexões",
	"Explorador": "Manual do Sobrevivente",
	"Experimento": "Mutação",
	"Fanático por Criaturas": "Conhecimento Oculto",
	"Fotógrafo": "Através da Lente",
	"Inventor Paranormal": "Invenção Paranormal",
	"Jovem Místico": "A Culpa é das Estrelas",
	"Legista do Turno da Noite": "Luto Habitual",
	"Mateiro": "Mapa Celeste",
	"Mergulhador": "Fôlego de Nadador",
	"Motorista": "Mãos no Volante",
	"Nerd Entusiasta": "O Inteligentão",
	"Profetizado": "Luta ou Fuga",
	"Psicólogo": "Terapia",
	"Repórter Investigativo": "Encontrar a Verdade",
};

const COMBAT_PATHS = ["Agente Secreto", "Caçador", "Monstruoso - Sangue", "Monstruoso - Morte", "Monstruoso - Conhecimento", "Monstruoso - Energia"];
const SPECIALIST_PATHS = ["Bibliotecário", "Muambeiro", "Perseverante"];
const OCCULTIST_PATHS = ["Exorcista", "Parapsicólogo", "Possuído"];
const SURVIVOR_PATHS = { "Durão": ["Estágio 2 - Durão", "Estágio 4 - Pancada Forte"], "Esperto": ["Estágio 2 - Esperto", "Estágio 4 - Entendido"], "Esotérico": ["Estágio 2 - Esotérico", "Estágio 4 - Iniciado"] };

const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function fromPack(packName, itemName) {
	const pack = game.packs.get(`${SYSTEM}.${packName}`);
	const index = await pack.getIndex();
	const entry = index.find((e) => norm(e.name) === norm(itemName));
	if (!entry) throw new Error(`item "${itemName}" não existe no compêndio ${packName}`);
	const doc = await pack.getDocument(entry._id);
	const data = doc.toObject();
	delete data._id;
	return data;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, timeout = 6000) {
	const start = Date.now();
	for (;;) {
		const value = await check();
		if (value) return value;
		if (Date.now() - start > timeout) return value;
		await wait(120);
	}
}

const agentData = (name, extra = {}) => ({
	name: `[SAH] ${name}`,
	type: "agent",
	system: { attributes: { str: { value: 2 }, dex: { value: 2 }, int: { value: 3 }, vit: { value: 2 }, pre: { value: 2 } }, ...extra },
});

async function addClass(actor, name) {
	await actor.createEmbeddedDocuments("Item", [await fromPack("classes", name)]);
}
const abilityNames = (actor) => actor.items.filter((i) => i.type === "ability").map((i) => i.name);

Hooks.once("quenchReady", (quench) => {
	quench.registerBatch("ordem.sobrevivendo-ao-horror", (context) => {
		const { describe, it, assert } = context;
		installBatchGuards(context, { prefix: "[SAH]" });

		describe("poder de origem concedido ao receber a origem", () => {
			for (const [origin, power] of Object.entries(ORIGIN_POWER)) {
				it(`${origin} → ${power}`, async () => {
					await withActor(agentData(origin), async (actor) => {
						await addClass(actor, "Combatente");
						await actor.createEmbeddedDocuments("Item", [await fromPack("origins", origin)]);
						const got = await until(() => abilityNames(actor).find((n) => norm(n) === norm(power)));
						assert.ok(got, `${origin} deveria conceder ${power}; a ficha ficou com: ${abilityNames(actor).join(", ") || "nada"}`);
						const granted = actor.items.find((i) => norm(i.name) === norm(power));
						assert.equal(granted.getFlag(SYSTEM, "granted")?.kind, "origin");
						assert.ok(granted.system.description.length > 40, "poder sem texto");
					});
				});
			}
			it("remover a origem remove o poder concedido", async () => {
				await withActor(agentData("remove origem"), async (actor) => {
					await addClass(actor, "Combatente");
					const [origin] = await actor.createEmbeddedDocuments("Item", [await fromPack("origins", "Mergulhador")]);
					await until(() => abilityNames(actor).includes("Fôlego de Nadador"));
					await origin.delete();
					const gone = await until(() => !abilityNames(actor).includes("Fôlego de Nadador"));
					assert.ok(gone, "o poder devia sair junto com a origem");
				});
			});
		});

		describe("habilidades de trilha por nível (2, 8, 13, 20)", () => {
			const all = [...COMBAT_PATHS.map((p) => [p, "Combatente"]), ...SPECIALIST_PATHS.map((p) => [p, "Especialista"]), ...OCCULTIST_PATHS.map((p) => [p, "Ocultista"])];
			for (const [pathName, cls] of all) {
				it(`${pathName}: 1 habilidade no nível 2, 2 no nível 8, 3 no 13, 4 no 20`, async () => {
					await withActor(agentData(pathName, { nivel: { value: 1 } }), async (actor) => {
						await addClass(actor, cls);
						await actor.createEmbeddedDocuments("Item", [await fromPack("paths", pathName)]);
						const granted = () => actor.items.filter((i) => i.getFlag(SYSTEM, "granted")?.kind === "path");
						assert.equal(granted().length, 0, "nível 1 não libera habilidade de trilha");
						for (const [nivel, expected] of [[2, 1], [7, 1], [8, 2], [13, 3], [19, 3], [20, 4], [8, 2], [1, 0]]) {
							await actor.update({ "system.nivel.value": nivel });
							const ok = await until(() => granted().length === expected);
							assert.ok(ok, `${pathName} no nível ${nivel}: esperava ${expected} habilidade(s), veio ${granted().map((i) => i.name).join(" | ") || "nenhuma"}`);
						}
					});
				});
			}
		});

		describe("Sobrevivente: estágios", () => {
			it("Empenho no estágio 1; Aumento de Atributo no 3; Cicatrizado no 5; sai ao descer", async () => {
				await withActor(agentData("Sobrevivente", { stage: { value: 1 } }), async (actor) => {
					await addClass(actor, "Sobrevivente");
					assert.ok(await until(() => abilityNames(actor).includes("Empenho")), "Empenho no estágio 1");
					assert.ok(!abilityNames(actor).includes("Cicatrizado"));
					await actor.update({ "system.stage.value": 3 });
					assert.ok(await until(() => abilityNames(actor).includes("Aumento de Atributo")), "Aumento de Atributo no estágio 3");
					await actor.update({ "system.stage.value": 5 });
					assert.ok(await until(() => abilityNames(actor).includes("Cicatrizado")), "Cicatrizado no estágio 5");
					await actor.update({ "system.stage.value": 2 });
					assert.ok(await until(() => !abilityNames(actor).includes("Cicatrizado") && !abilityNames(actor).includes("Aumento de Atributo")), "habilidades de estágio alto saem ao descer");
					assert.ok(abilityNames(actor).includes("Empenho"));
				});
			});
			for (const [trail, [first, second]] of Object.entries(SURVIVOR_PATHS)) {
				it(`trilha ${trail}: ${first} no estágio 2 e ${second} no estágio 4`, async () => {
					await withActor(agentData(`Sobrevivente ${trail}`, { stage: { value: 1 } }), async (actor) => {
						await addClass(actor, "Sobrevivente");
						await actor.createEmbeddedDocuments("Item", [await fromPack("paths", trail)]);
						assert.ok(!abilityNames(actor).includes(first), "nada antes do estágio 2");
						await actor.update({ "system.stage.value": 2 });
						assert.ok(await until(() => abilityNames(actor).includes(first)), `${first} no estágio 2`);
						assert.ok(!abilityNames(actor).includes(second));
						await actor.update({ "system.stage.value": 4 });
						assert.ok(await until(() => abilityNames(actor).includes(second)), `${second} no estágio 4`);
					});
				});
			}
			it("Durão: +4 PV no estágio 2 e +2 PV ao subir para o 3º", async () => {
				await withActor(agentData("Durão PV", { stage: { value: 2 } }), async (actor) => {
					await addClass(actor, "Sobrevivente");
					const before = actor.system.PV.max;
					await actor.createEmbeddedDocuments("Item", [await fromPack("paths", "Durão")]);
					assert.ok(await until(() => abilityNames(actor).includes("Estágio 2 - Durão")));
					await until(() => actor.system.PV.max === before + 4 + 0);
					assert.equal(actor.system.PV.max - before, 4, "Durão dá +4 PV");
					const pv2 = actor.system.PV.max;
					await actor.update({ "system.stage.value": 3 });
					await until(() => actor.system.PV.max > pv2);
					// estágio 3: +2 PV de classe por estágio (sobrevivente não soma Vigor) e +2 do Durão
					assert.equal(actor.system.PV.max - pv2, 2 + 2, "estágio 3: +2 PV de classe e +2 do Durão");
				});
			});
		});

		describe("efeitos passivos aplicados à ficha", () => {
			const withPower = async (packName, powerName, extra, fn) =>
				withActor(agentData(powerName, extra), async (actor) => {
					await addClass(actor, "Combatente");
					const before = {
						PV: actor.system.PV.max,
						PE: actor.system.PE.max,
						desloc: actor.system.desloc.value,
						spaces: actor.system.spaces.max,
						def: actor.system.defense.value,
					};
					await actor.createEmbeddedDocuments("Item", [await fromPack(packName, powerName)]);
					await until(() => actor.items.some((i) => norm(i.name) === norm(powerName)));
					await wait(250);
					return fn(actor, before);
				});

			it("Fôlego de Nadador: +5 PV", () =>
				withPower("originPowers", "Fôlego de Nadador", {}, (actor, before) => assert.equal(actor.system.PV.max - before.PV, 5)));
			it("Luta ou Fuga: +2 em Vontade", () =>
				withPower("originPowers", "Luta ou Fuga", {}, (actor) => assert.equal(actor.system.skills.will.mod, 2)));
			it("Conexões: +2 em Diplomacia", () =>
				withPower("originPowers", "Conexões", {}, (actor) => assert.equal(actor.system.skills.diplomacy.mod, 2)));
			it("Atlético: +3 m de deslocamento", () =>
				withPower("generalPowers", "Atlético", {}, (actor, before) => assert.equal(actor.system.desloc.value - before.desloc, 3)));
			it("Correria Desesperada: +3 m de deslocamento", () =>
				withPower("fighterPowers", "Correria Desesperada", {}, (actor, before) => assert.equal(actor.system.desloc.value - before.desloc, 3)));
			it("Mochileiro: +5 espaços", () =>
				withPower("fighterPowers", "Mochileiro", {}, (actor, before) => assert.equal(actor.system.spaces.max - before.spaces, 5)));
			it("Inventário Organizado: + Intelecto em espaços", () =>
				withPower("generalPowers", "Inventário Organizado", {}, (actor, before) => assert.equal(actor.system.spaces.max - before.spaces, actor.system.attributes.int.value)));
			it("Observador: + Intelecto em Intuição", () =>
				withPower("generalPowers", "Observador", {}, (actor) => assert.equal(actor.system.skills.intuition.mod, actor.system.attributes.int.value)));
			it("Personalidade Esotérica: +3 PE", () =>
				withPower("generalPowers", "Personalidade Esotérica", {}, (actor, before) => assert.equal(actor.system.PE.max - before.PE, 3)));
			it("Vitalidade Reforçada: +1 PV por nível e +2 em Fortitude", () =>
				withPower("generalPowers", "Vitalidade Reforçada", { nivel: { value: 6 } }, (actor, before) => {
					assert.equal(actor.system.PV.max - before.PV, 6);
					assert.equal(actor.system.skills.resilience.mod, 2);
				}));
			it("Vontade Inabalável: +1 PE a cada 2 níveis e +2 em Vontade", () =>
				withPower("generalPowers", "Vontade Inabalável", { nivel: { value: 9 } }, (actor, before) => {
					assert.equal(actor.system.PE.max - before.PE, 4);
					assert.equal(actor.system.skills.will.mod, 2);
				}));
			it("O Sorriso (Agente Secreto): +2 em Diplomacia e Enganação", async () => {
				await withActor(agentData("Agente Secreto efeitos", { nivel: { value: 8 } }), async (actor) => {
					await addClass(actor, "Combatente");
					await actor.createEmbeddedDocuments("Item", [await fromPack("paths", "Agente Secreto")]);
					await until(() => abilityNames(actor).includes("NEX 40% - O Sorriso"));
					await wait(250);
					assert.equal(actor.system.skills.diplomacy.mod, 2);
					assert.equal(actor.system.skills.deception.mod, 2);
				});
			});
			it("Mascate (Muambeiro): +5 espaços de carga", async () => {
				await withActor(agentData("Muambeiro efeitos", { nivel: { value: 2 } }), async (actor) => {
					await addClass(actor, "Especialista");
					const before = actor.system.spaces.max;
					await actor.createEmbeddedDocuments("Item", [await fromPack("paths", "Muambeiro")]);
					await until(() => abilityNames(actor).includes("NEX 10% - Mascate"));
					await wait(250);
					assert.equal(actor.system.spaces.max - before, 5);
				});
			});
			it("A Força do Saber (Bibliotecário, nível 20): Intelecto +1 e + Intelecto em PE", async () => {
				await withActor(agentData("Bibliotecário efeitos", { nivel: { value: 19 } }), async (actor) => {
					await addClass(actor, "Especialista");
					await actor.createEmbeddedDocuments("Item", [await fromPack("paths", "Bibliotecário")]);
					await wait(300);
					const int = actor.system.attributes.int.value;
					const pe = actor.system.PE.max;
					await actor.update({ "system.nivel.value": 20 });
					await until(() => abilityNames(actor).includes("NEX 99% - A Força do Saber"));
					await wait(300);
					assert.equal(actor.system.attributes.int.value, int + 1);
					assert.ok(actor.system.PE.max >= pe + int + 1, `PE deveria subir ao menos ${int + 1}; foi ${actor.system.PE.max - pe}`);
				});
			});
			it("Monstruoso (Sangue): efeitos de etapa ritualística vêm desligados; Ser Aterrorizante é permanente", async () => {
				await withActor(agentData("Monstruoso efeitos", { nivel: { value: 20 } }), async (actor) => {
					await addClass(actor, "Combatente");
					const base = { int: actor.system.attributes.int.value, str: actor.system.attributes.str.value };
					await actor.createEmbeddedDocuments("Item", [await fromPack("paths", "Monstruoso - Sangue")]);
					await until(() => abilityNames(actor).some((n) => /Ser Aterrorizante \(Sangue\)/.test(n)));
					await wait(300);
					assert.equal(actor.system.attributes.int.value, base.int - 1, "Intelecto −1 permanente");
					assert.equal(actor.system.attributes.str.value, base.str + 1, "Força +1 permanente");
					assert.equal(actor.system.attributes.pre.value, 2 - 1, "Presença −1 permanente (Ser Assustador)");
				});
			});
			it("Monstruoso (Morte) nível 8: efeito da etapa ritualística (+Força em PV) vem desligado e liga manualmente", async () => {
				await withActor(agentData("Monstruoso Morte", { nivel: { value: 2 } }), async (actor) => {
					await addClass(actor, "Combatente");
					const before = actor.system.PV.max;
					await actor.createEmbeddedDocuments("Item", [await fromPack("paths", "Monstruoso - Morte")]);
					await until(() => abilityNames(actor).some((n) => /Ser Amaldiçoado \(Morte\)/.test(n)));
					await wait(300);
					assert.equal(actor.system.PV.max, before, "desligado: sem bônus de PV");
					const item = actor.items.find((i) => /Ser Amaldiçoado \(Morte\)/.test(i.name));
					const effect = item.effects.contents[0];
					assert.ok(effect?.disabled, "o efeito ritualístico deve começar desligado");
					await effect.update({ disabled: false });
					await wait(300);
					assert.equal(actor.system.PV.max - before, actor.system.attributes.str.value, "ligado: +Força em PV");
				});
			});
		});
	});
});
