// Suplemento Sobrevivendo ao Horror: equipamentos, armas e itens amaldiçoados dentro de uma ficha.
// Rodar no console como GM:
//   await import("/systems/ordem_v2_classic/module/tests/mini-quench.mjs");
//   await miniQuench("/systems/ordem_v2_classic/module/tests/suites/sobrevivendo-ao-horror-itens.test.mjs")
// Cria e apaga atores "[SAH] ..." (não mexe em fichas, cenas ou combates existentes).
import { installBatchGuards, withActor } from "../helpers/fixtures.mjs";

const SYSTEM = "ordem_v2_classic";
const norm = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fromPack(packName, itemName) {
	const pack = game.packs.get(`${SYSTEM}.${packName}`);
	const index = await pack.getIndex();
	const entry = index.find((e) => norm(e.name) === norm(itemName));
	if (!entry) throw new Error(`item "${itemName}" não existe no compêndio ${packName}`);
	const data = (await pack.getDocument(entry._id)).toObject();
	delete data._id;
	return data;
}

const agentData = (name, extra = {}) => ({
	name: `[SAH] ${name}`,
	type: "agent",
	system: { attributes: { str: { value: 2 }, dex: { value: 2 }, int: { value: 3 }, vit: { value: 2 }, pre: { value: 2 } }, ...extra },
});
const withClass = async (actor, name = "Combatente") => actor.createEmbeddedDocuments("Item", [await fromPack("classes", name)]);

Hooks.once("quenchReady", (quench) => {
	quench.registerBatch("ordem.sobrevivendo-ao-horror.itens", (context) => {
		const { describe, it, assert } = context;
		installBatchGuards(context, { prefix: "[SAH]" });

		describe("itens do suplemento entram numa ficha", () => {
			it("todas as armas, equipamentos e itens amaldiçoados do suplemento podem ser adicionados", async () => {
				const wanted = [];
				for (const packName of ["armaments", "general"]) {
					const pack = game.packs.get(`${SYSTEM}.${packName}`);
					const index = await pack.getIndex({ fields: ["folder"] });
					const sahRoot = pack.folders.find((f) => f.name === "Sobrevivendo ao Horror" && !f.folder);
					const inside = (folder) => {
						for (let f = folder; f; f = f.folder) if (f.id === sahRoot.id) return true;
						return false;
					};
					for (const entry of index) {
						const folder = entry.folder ? pack.folders.get(entry.folder) : null;
						if (folder && inside(folder)) wanted.push({ packName, id: entry._id, name: entry.name });
					}
				}
				assert.isAtLeast(wanted.length, 90, `esperava ao menos 90 itens do suplemento, achei ${wanted.length}`);
				await withActor(agentData("inventário completo"), async (actor) => {
					const data = [];
					for (const w of wanted) {
						const d = (await game.packs.get(`${SYSTEM}.${w.packName}`).getDocument(w.id)).toObject();
						delete d._id;
						data.push(d);
					}
					const created = await actor.createEmbeddedDocuments("Item", data);
					assert.equal(created.length, wanted.length);
					const stubs = created.filter((i) => /Você pode encontrar esse conteúdo/.test(i.system.description));
					assert.equal(stubs.length, 0, `itens com texto provisório: ${stubs.map((i) => i.name).join(", ")}`);
				});
			});
		});

		describe("efeitos passivos de equipamentos", () => {
			const withItem = (pack, name, extra, fn) =>
				withActor(agentData(name, extra), async (actor) => {
					await withClass(actor);
					const before = { PV: actor.system.PV.max };
					await actor.createEmbeddedDocuments("Item", [await fromPack(pack, name)]);
					await wait(300);
					return fn(actor, before);
				});
			it("Pé de Morto: +5 em Furtividade", () => withItem("general", "Pé de Morto", {}, (a) => assert.equal(a.system.skills.stealth.mod, 5)));
			it("Amuleto Sagrado: +2 em Religião e Vontade", () =>
				withItem("general", "Amuleto Sagrado", {}, (a) => {
					assert.equal(a.system.skills.religion.mod, 2);
					assert.equal(a.system.skills.will.mod, 2);
				}));
			it("Medidor de Condição Vertebral: +2 em Fortitude", () =>
				withItem("general", "Medidor de Condição Vertebral", {}, (a) => assert.equal(a.system.skills.resilience.mod, 2)));
			it("Cão Adestrado: +2 em Investigação e Percepção", () =>
				withItem("general", "Cão Adestrado", {}, (a) => {
					assert.equal(a.system.skills.investigation.mod, 2);
					assert.equal(a.system.skills.perception.mod, 2);
				}));
			it("Calejado (Livro): +1 PV por nível, não por NEX", () =>
				withItem("originPowers", "Calejado", { nivel: { value: 7 }, NEX: { value: 5 } }, (a, before) => assert.equal(a.system.PV.max - before.PV, 7)));
			it("Casca Grossa (Livro): +1 PV por nível, não por NEX", () =>
				withItem("pathFighter", "NEX 10% - Casca Grossa", { nivel: { value: 9 }, NEX: { value: 5 } }, (a, before) => assert.equal(a.system.PV.max - before.PV, 9)));
		});
	});
});
