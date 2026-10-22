// Teste ao vivo, em combate, do Amaldiçoar Arma: o agente se bufa (e bufa um aliado), o efeito aparece na aba Efeitos,
// a arma causa o dano do elemento, criaturas com a fraqueza levam o dobro (e as sem fraqueza não), e ao encerrar o
// combate o efeito some. Roda na arena temporária.
//
//   const t = await import("/systems/ordem-v2-classic/module/macros/weapon-curse-combat-live-test.mjs");
//   await t.runWeaponCurseCombatTests();
//
// Devolve { results, sheetRows } (sheetRows = linhas lidas da aba Efeitos). Especificação: docs/arquivo/spec-amaldicoar-arma.md

import { castCurse } from "./weapon-curse-live-test.mjs";
import { withArena } from "./ritual-live-arena.mjs";
import { applyDamageFromMessage } from "../helpers/card-damage.mjs";

const SYSTEM = "ordem-v2-classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hp = (token) => Number(token.actor.system.attributes.hp.value);
const ALL_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];

async function giveFaca(actor) {
	const old = actor.items.filter((entry) => entry.type === "armament").map((entry) => entry.id);
	if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
	const pack = game.packs.get("ordem-v2-classic.armaments");
	const doc = await pack.getDocument(pack.index.find((entry) => entry.name === "Faca")._id);
	const [item] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	return item;
}

async function tuneThreat(token, vulnerable = []) {
	const update = { "system.genericRd": { value: 0, except: [] } };
	for (const type of ALL_TYPES) {
		update[`system.resistances.${type}.value`] = 0;
		update[`system.resistances.${type}.vulnerable`] = vulnerable.includes(type);
		update[`system.resistances.${type}.immune`] = false;
	}
	await token.actor.update(update);
}

const cursesOn = (actor) => [...actor.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse);

/** Rola o dano da arma contra a criatura, aplica a carta do elemento e devolve { roll, lost }. */
async function hitWith(item, target) {
	const known = new Set(game.messages.contents.map((message) => message.id));
	await item.rollDamage({ hitResult: { actorUuid: target.actor.uuid, hit: false, isCritical: false }, critical: false, lastId: true });
	await pause(600);
	const card = game.messages.contents.find((message) => !known.has(message.id) && message.getFlag(SYSTEM, "weaponCurseDamage"));
	if (!card) return { roll: null, lost: 0, card: null };
	const before = hp(target);
	await applyDamageFromMessage(card);
	await pause(400);
	return { roll: card.rolls[0].total, lost: before - hp(target), card };
}

/** Abre a aba Efeitos da ficha e devolve o texto das linhas da tabela (o que o jogador vê). */
async function effectsTabRows(actor) {
	await actor.sheet.render(true);
	await pause(1500);
	const root = actor.sheet.element;
	(root.querySelector('a[data-tab="effects"], button[data-tab="effects"]') ?? root.querySelector('[data-action="tab"][data-tab="effects"]'))?.click();
	await pause(600);
	const rows = [...root.querySelectorAll(".effect-item")].map((row) => row.querySelector(".effect-name")?.innerText?.trim());
	return rows;
}

export async function runWeaponCurseCombatTests() {
	const results = [];
	const sheetRows = {};
	const add = (id, caso, ok, detalhe = "") => results.push({ id, caso, ok: Boolean(ok), detalhe: String(detalhe) });
	const guard = async (id, fn) => {
		try {
			await fn();
		} catch (error) {
			add(id, "erro no passo", false, error.stack ?? error.message);
		}
	};

	await withArena(async (arena) => {
		const [one, two] = arena.agents;
		const facaOne = await giveFaca(one.actor);
		const facaTwo = await giveFaca(two.actor);
		for (const agent of [one, two]) {
			await agent.actor.update({ "system.PD.value": 200 });
			// a cópia traz os efeitos que o agente real tiver no momento (ex.: um buff conjurado na mesa)
			await agent.actor.deleteEmbeddedDocuments("ActiveEffect", cursesOn(agent.actor).map((effect) => effect.id));
		}
		// o aliado fica encostado (alcance de toque)
		await two.doc.update({ x: one.doc.x + 100, y: one.doc.y });
		await pause(400);
		const tBlood = await arena.mkThreat("ZZ criatura de Sangue (fraca a Sangue)", 2000, 800);
		const tDeath = await arena.mkThreat("ZZ criatura de Morte (fraca a Morte)", 2200, 800);
		const tNone = await arena.mkThreat("ZZ criatura sem fraqueza", 2400, 800);
		await tuneThreat(tBlood, ["bloodDamage"]);
		await tuneThreat(tDeath, ["deathDamage"]);
		await tuneThreat(tNone, []);

		// combate de verdade com todos dentro
		const combat = await Combat.create({ scene: arena.scene.id });
		await combat.createEmbeddedDocuments("Combatant", [one.doc, two.doc, tBlood.document, tDeath.document, tNone.document].map((doc) => ({ tokenId: doc.id, sceneId: arena.scene.id, actorId: doc.actorId })));
		await combat.startCombat();
		await pause(800);
		add("CB-00", "Combate iniciado com agentes e criaturas", game.combats.get(combat.id)?.started === true && combat.combatants.size === 5, `combatentes=${combat.combatants.size}`);

		await guard("CB-01", async () => {
			const cast = await castCurse({ agent: one, ritual: "Amaldiçoar Arma - Sangue", form: "basic" });
			const effects = cursesOn(one.actor);
			add("CB-01a", "Sem alvo marcado a carta mostra os dois botões: Aplicar em você e Selecionar alvo", cast.waitingButtons.includes("ritual-curse-self") && cast.waitingButtons.includes("ritual-curse-target"), cast.waitingButtons.join(","));
			add("CB-01", "Aplicar em você (sem alvo): efeito Sangue na própria ficha", !cast.blocked && effects.length === 1 && effects[0].name === "Arma Amaldiçoada (Sangue · Normal)", `${cast.blocked ? cast.warnings.join("|") : ""} efeitos=${effects.map((e) => e.name)}`);
		});

		await guard("CB-02", async () => {
			const cast = await castCurse({ agent: one, ritual: "Amaldiçoar Arma - Morte", form: "student", targets: [two.token] });
			const onTwo = cursesOn(two.actor);
			add("CB-02", "Agente bufa outro agente: efeito Morte vai para a ficha do aliado, não para a dele", !cast.blocked && onTwo.length === 1 && onTwo[0].name === "Arma Amaldiçoada (Morte · Discente)" && cursesOn(one.actor).length === 1, `${cast.blocked ? cast.warnings.join("|") : ""} aliado=${onTwo.map((e) => e.name)} conjurador=${cursesOn(one.actor).map((e) => e.name)}`);
		});

		await guard("CB-03", async () => {
			sheetRows.conjurador = await effectsTabRows(one.actor);
			sheetRows.aliado = await effectsTabRows(two.actor);
			add("CB-03", "Aba Efeitos mostra o buff na ficha do conjurador e do aliado", sheetRows.conjurador.some((r) => /Arma Amaldiçoada \(Sangue/.test(r)) && sheetRows.aliado.some((r) => /Arma Amaldiçoada \(Morte/.test(r)), JSON.stringify(sheetRows));
			await one.actor.sheet.close();
			await two.actor.sheet.close();
		});

		await guard("CB-04", async () => {
			const onBlood = await hitWith(facaOne, tBlood);
			add("CB-04a", "Buff de Sangue contra criatura fraca a Sangue: elemento dobra", onBlood.roll > 0 && onBlood.lost === onBlood.roll * 2, `rolou=${onBlood.roll} perdeu=${onBlood.lost}`);
			const onNone = await hitWith(facaOne, tNone);
			add("CB-04b", "Buff de Sangue contra criatura sem fraqueza: dano normal", onNone.roll > 0 && onNone.lost === onNone.roll, `rolou=${onNone.roll} perdeu=${onNone.lost}`);
			const onDeath = await hitWith(facaOne, tDeath);
			add("CB-04c", "Buff de Sangue contra criatura fraca a Morte: não dobra (elemento errado)", onDeath.roll > 0 && onDeath.lost === onDeath.roll, `rolou=${onDeath.roll} perdeu=${onDeath.lost}`);
		});

		await guard("CB-05", async () => {
			const onDeath = await hitWith(facaTwo, tDeath);
			add("CB-05a", "Aliado buffado com Morte (Discente) contra criatura fraca a Morte: dobra", onDeath.roll > 0 && onDeath.lost === onDeath.roll * 2 && onDeath.card.rolls[0].formula === "2d6", `fórmula=${onDeath.card?.rolls[0].formula} rolou=${onDeath.roll} perdeu=${onDeath.lost}`);
			const onBlood = await hitWith(facaTwo, tBlood);
			add("CB-05b", "Aliado buffado com Morte contra criatura fraca a Sangue: não dobra", onBlood.roll > 0 && onBlood.lost === onBlood.roll, `rolou=${onBlood.roll} perdeu=${onBlood.lost}`);
		});

		await guard("CB-07", async () => {
			// terceiro agente da cena não existe: usa o aliado, tirando o buff dele para provar que o botão o devolve
			await two.actor.deleteEmbeddedDocuments("ActiveEffect", cursesOn(two.actor).map((effect) => effect.id));
			const cast = await castCurse({ agent: one, ritual: "Amaldiçoar Arma - Energia", form: "basic", to: "target", mark: [two.token] });
			const onTwo = cursesOn(two.actor);
			add("CB-07", "Selecionar alvo: o buff vai para o token marcado e a carta termina resolvida", cast.waitingButtons.includes("ritual-curse-target") && onTwo.length === 1 && onTwo[0].name === "Arma Amaldiçoada (Energia · Normal)", `botões=${cast.waitingButtons} aliado=${onTwo.map((e) => e.name)}`);
		});

		await guard("CB-06", async () => {
			const before = cursesOn(one.actor).length + cursesOn(two.actor).length;
			// o botão "Encerrar combate" do rastreador abre uma confirmação; aceita como o Mestre faria
			const ending = combat.endCombat();
			for (let i = 0; i < 30; i++) {
				const dialog = [...document.querySelectorAll(".application")].find((d) => d.querySelector("button[data-action=yes]"));
				if (dialog) {
					dialog.querySelector("button[data-action=yes]").click();
					break;
				}
				await pause(200);
			}
			await ending.catch(() => {});
			for (let i = 0; i < 20 && (cursesOn(one.actor).length || cursesOn(two.actor).length); i++) await pause(500);
			const after = cursesOn(one.actor).length + cursesOn(two.actor).length;
			add("CB-06", "Ao encerrar o combate, os efeitos somem das duas fichas", before === 2 && after === 0 && !game.combats.get(combat.id), `antes=${before} depois=${after} combateExiste=${Boolean(game.combats.get(combat.id))}`);
			const gm = game.users.find((user) => user.isGM && user.active);
			results.at(-1).detalhe += ` | quem roda o hook: ${gm?.name} (eu: ${game.user.name})`;
		});
	}, { agents: ["Agente NEX 50 — Ocultista", "Agente NEX 75 — Vanguarda"] });

	const failed = results.filter((entry) => !entry.ok);
	console.log(`Amaldiçoar Arma em combate: ${results.length - failed.length}/${results.length} passaram`, failed);
	return { results, sheetRows };
}
