// Teste ao vivo do Amaldiçoar Arma: conjura de verdade pela macro, rola o dano pela arma, aplica pelas cartas
// e confere vulnerabilidade e Resistência à Fraqueza. Roda na arena temporária (ritual-live-arena.mjs).
//
//   const t = await import("/systems/ordem_v2_classic/module/macros/weapon-curse-live-test.mjs");
//   await t.runWeaponCurseTests();
//
// Devolve uma tabela { id, caso, ok, detalhe }. Especificação: docs/arquivo/spec-amaldicoar-arma.md

import { castRitual } from "./ritual-battle-live-test.mjs";
import { withArena } from "./ritual-live-arena.mjs";
import { applyDamageFromMessage } from "../helpers/card-damage.mjs";
import { createWeaknessResist, removeCurses } from "../helpers/weapon-curse-runtime.mjs";
import { curseOf } from "../helpers/weapon-curse.mjs";

const SYSTEM = "ordem_v2_classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hp = (token) => Number(token.actor.system.attributes.hp.value);
const ALL_TYPES = ["cuttingDamage", "impactDamage", "piercingDamage", "ballisticDamage", "bloodDamage", "deathDamage", "knowledgeDamage", "energyDamage", "fearDamage", "fireDamage", "coldDamage", "eletricDamage", "chemicalDamage", "mentalDamage", "damageDamage"];

async function ensureWeapon(actor, name) {
	let item = actor.items.find((entry) => entry.type === "armament" && entry.name === name);
	if (item) return item;
	const pack = game.packs.get("ordem_v2_classic.armaments");
	const entry = pack.index.find((doc) => doc.name === name);
	if (!entry) throw new Error(`Arma "${name}" não existe no compêndio.`);
	const doc = await pack.getDocument(entry._id);
	[item] = await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
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

/** Os botões que a carta do ritual mostra (data-action). */
export const cardButtons = (card) => [...(card?.content.matchAll(/data-action="([^"]+)"/g) ?? [])].map((match) => match[1]);

/**
 * Conjura Amaldiçoar Arma pela macro e, se a carta pedir (sem alvo marcado), clica no botão como o jogador:
 * to = "self" (Aplicar em você) ou "target" (Selecionar alvo, com `mark` marcado no mapa). Devolve o resultado da
 * conjuração com `waitingButtons` (os botões que a carta mostrou antes do clique).
 */
export async function castCurse({ to = "self", mark = [], ...options }) {
	const result = await castRitual(options);
	const card = result.card;
	result.waitingButtons = [];
	if (card && card.getFlag(SYSTEM, "ritualCast")?.status === "needsTargets") {
		result.waitingButtons = cardButtons(card);
		if (to === "target") {
			game.user.targets.forEach((token) => token.setTarget(false, { releaseOthers: false }));
			mark.forEach((token) => token.setTarget(true, { releaseOthers: false, groupSelection: false, user: game.user }));
			await pause(300);
		}
		const node = document.querySelector(`.message[data-message-id="${card.id}"] [data-action="${to === "target" ? "ritual-curse-target" : "ritual-curse-self"}"]`);
		if (!node) throw new Error("Botão da carta não encontrado.");
		node.click();
		for (let i = 0; i < 40 && game.messages.get(card.id)?.getFlag(SYSTEM, "ritualCast")?.status !== "resolved"; i++) await pause(300);
		await pause(500);
	}
	return result;
}

const cursesOn = (actor) => [...actor.effects].filter((effect) => effect.flags?.[SYSTEM]?.weaponCurse);

/** Rola o dano da arma contra o alvo e devolve as cartas novas: { weapon, curses[] }. */
async function rollDamageCards(item, target, { critical = false } = {}) {
	const known = new Set(game.messages.contents.map((message) => message.id));
	const hitResult = { actorUuid: target.actor.uuid, hit: false, isCritical: Boolean(critical) };
	await item.rollDamage({ hitResult, critical: critical ? { isCritical: true, multiplier: 2 } : false, lastId: true });
	await pause(600);
	const fresh = game.messages.contents.filter((message) => !known.has(message.id) && message.rolls?.length);
	return {
		weapon: fresh.find((message) => message.getFlag(SYSTEM, "damageInfo") && !message.getFlag(SYSTEM, "weaponCurseDamage")) ?? null,
		curses: fresh.filter((message) => message.getFlag(SYSTEM, "weaponCurseDamage")),
	};
}

async function lostBy(token, message) {
	const before = hp(token);
	await applyDamageFromMessage(message);
	await pause(400);
	return before - hp(token);
}

export async function runWeaponCurseTests() {
	const results = [];
	const add = (id, caso, ok, detalhe = "") => results.push({ id, caso, ok: Boolean(ok), detalhe: String(detalhe) });
	const guard = async (id, caso, fn) => {
		try {
			await fn();
		} catch (error) {
			add(id, caso, false, `erro: ${error.message}`);
		}
	};

	await withArena(async (arena) => {
		const agent = arena.agents[0];
		const { actor } = agent;
		// ficha de teste: só uma arma corpo a corpo, para a conjuração não abrir a escolha
		const old = actor.items.filter((entry) => entry.type === "armament").map((entry) => entry.id);
		if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
		const faca = await ensureWeapon(actor, "Faca");
		// a cópia traz os efeitos que o agente real tiver no momento (ex.: um buff conjurado na mesa)
		await actor.deleteEmbeddedDocuments("ActiveEffect", cursesOn(actor).map((effect) => effect.id));
		await actor.update({ "system.PD.value": 200 });
		const target = await arena.mkThreat("ZZ alvo vulnerável a Sangue", 2200, 900);
		await tuneThreat(target, ["bloodDamage"]);

		await guard("AA-01", "Biblioteca tem as 4 versões", async () => {
			const library = game.actors.getName("Biblioteca de Rituais — Agente");
			const found = library.items.filter((entry) => entry.type === "ritual" && /^Amaldiçoar Arma/.test(entry.name)).map((entry) => entry.system.element).sort();
			add("AA-01", "Biblioteca tem as 4 versões de Amaldiçoar Arma (Conhecimento, Energia, Morte, Sangue)", found.join() === "blood,death,energy,knowledge", found.join());
		});

		await guard("AA-02", "Conjurar Sangue (Discente) cria o efeito", async () => {
			const cast = await castCurse({ agent, ritual: "Amaldiçoar Arma - Sangue", form: "student" });
			const effects = cursesOn(actor);
			const curse = curseOf(effects[0]);
			add("AA-02", "Conjurar Sangue (Discente) cria o efeito na ficha", !cast.blocked && effects.length === 1 && effects[0].name === "Arma Amaldiçoada (Sangue · Discente)" && curse?.formula === "2d6" && curse?.damageType === "bloodDamage", `${cast.blocked ? "bloqueado " + cast.warnings.join("|") : ""} efeitos=${effects.map((e) => e.name).join(",")}`);
			add("AA-03", "O efeito fica ligado à Faca e à cena", curse?.scope === "weapon" && curse?.weaponId === faca.id && curse?.sceneId === arena.scene.id, JSON.stringify(curse));
		});

		await guard("AA-05", "Nova conjuração na mesma arma substitui", async () => {
			await castCurse({ agent, ritual: "Amaldiçoar Arma - Morte", form: "basic" });
			const effects = cursesOn(actor);
			add("AA-05", "Nova conjuração na mesma arma substitui a anterior", effects.length === 1 && curseOf(effects[0])?.element === "death" && curseOf(effects[0])?.formula === "1d6", effects.map((e) => e.name).join(","));
			await castCurse({ agent, ritual: "Amaldiçoar Arma - Sangue", form: "student" });
		});

		await guard("AA-06", "Dano do elemento em carta própria", async () => {
			const cards = await rollDamageCards(faca, target);
			const curseCard = cards.curses[0];
			const roll = curseCard?.rolls?.[0];
			add("AA-06", "Dano da arma e dano do elemento saem em cartas separadas", Boolean(cards.weapon) && cards.curses.length === 1 && roll?.formula === "2d6", `arma=${Boolean(cards.weapon)} elemento=${cards.curses.length} fórmula=${roll?.formula}`);
			add("AA-07", "A carta do elemento diz ritual, forma e elemento", /Discente · Sangue/.test(curseCard?.flavor ?? "") && curseCard?.getFlag(SYSTEM, "damageTarget")?.damageType === "bloodDamage", curseCard?.flavor);
			const weaponType = cards.weapon?.getFlag(SYSTEM, "damageTarget")?.damageType;
			const weaponLost = await lostBy(target, cards.weapon);
			add("AA-09a", "Dano da arma segue o tipo da arma, sem dobrar", weaponType !== "bloodDamage" && weaponLost === cards.weapon.rolls[0].total, `tipo=${weaponType} perdeu=${weaponLost} rolou=${cards.weapon.rolls[0].total}`);
			const lost = await lostBy(target, curseCard);
			add("AA-09b", "Vulnerável a Sangue: o dano do elemento dobra", lost === roll.total * 2 && roll.total > 0, `rolou=${roll.total} perdeu=${lost}`);
		});

		await guard("AA-10", "Resistência à Fraqueza impede o dobro", async () => {
			const effect = await createWeaknessResist(target.actor, "bloodDamage");
			add("AA-10a", "Efeito Resistência à Fraqueza (Sangue) aparece na tabela de efeitos", effect?.name === "Resistência à Fraqueza (Sangue)" && target.actor.effects.some((e) => e.name === "Resistência à Fraqueza (Sangue)"), effect?.name);
			const cards = await rollDamageCards(faca, target);
			const roll = cards.curses[0].rolls[0];
			const lost = await lostBy(target, cards.curses[0]);
			add("AA-10b", "Com a resistência, o dano de Sangue não dobra", lost === roll.total && roll.total > 0, `rolou=${roll.total} perdeu=${lost}`);
			await target.actor.effects.find((e) => e.name === "Resistência à Fraqueza (Sangue)").update({ disabled: true });
			const cards2 = await rollDamageCards(faca, target);
			const roll2 = cards2.curses[0].rolls[0];
			const lost2 = await lostBy(target, cards2.curses[0]);
			add("AA-10c", "Resistência desligada volta a dobrar", lost2 === roll2.total * 2, `rolou=${roll2.total} perdeu=${lost2}`);
		});

		await guard("AA-08", "Crítico não dobra o dado do elemento", async () => {
			const cards = await rollDamageCards(faca, target, { critical: true });
			add("AA-08", "Crítico não dobra o dado do elemento", cards.weapon?.getFlag(SYSTEM, "damageInfo")?.isCritical === true && cards.curses[0]?.rolls[0].formula === "2d6", `arma crítica=${cards.weapon?.getFlag(SYSTEM, "damageInfo")?.isCritical} elemento=${cards.curses[0]?.rolls[0].formula}`);
		});

		await guard("AA-11", "Outra arma e efeito desligado", async () => {
			const machete = await ensureWeapon(actor, "Machete");
			const pistola = await ensureWeapon(actor, "Pistola");
			const other = await rollDamageCards(machete, target);
			const ranged = await rollDamageCards(pistola, target);
			add("AA-11a", "Outra arma corpo a corpo e arma à distância não recebem o dano extra", other.curses.length === 0 && ranged.curses.length === 0 && Boolean(other.weapon), `machete=${other.curses.length} pistola=${ranged.curses.length}`);
			const effect = cursesOn(actor)[0];
			await effect.update({ disabled: true });
			const off = await rollDamageCards(faca, target);
			add("AA-11b", "Efeito desligado não causa o dano extra", off.curses.length === 0, `cartas=${off.curses.length}`);
			await effect.update({ disabled: false });
		});

		await guard("AA-04", "Fim da cena remove o efeito", async () => {
			const effect = cursesOn(actor)[0];
			const sceneId = arena.scene.id;
			await removeCurses(actor, { keepScene: sceneId });
			add("AA-04a", "Troca de cena: efeito da mesma cena fica", cursesOn(actor).length === 1);
			await effect.update({ "flags.ordem_v2_classic.weaponCurse.sceneId": "outra-cena" });
			await removeCurses(actor, { keepScene: sceneId });
			add("AA-04b", "Troca de cena: efeito de outra cena sai", cursesOn(actor).length === 0);
			// só com uma arma corpo a corpo a conjuração não abre a escolha
			await actor.deleteEmbeddedDocuments("Item", actor.items.filter((entry) => entry.type === "armament" && entry.name !== "Faca").map((entry) => entry.id));
			await castCurse({ agent, ritual: "Amaldiçoar Arma - Sangue", form: "basic" });
			const firstGM = game.users.find((user) => user.isGM && user.active);
			if (firstGM?.id !== game.user.id) {
				add("AA-04c", "Fim do combate remove o efeito (gatilho do hook)", true, "pulado: outro Mestre ativo roda os hooks; a remoção em si foi testada em AA-04a/b");
				return;
			}
			const combat = await Combat.create({ scene: arena.scene.id });
			await combat.createEmbeddedDocuments("Combatant", [{ tokenId: agent.doc.id, sceneId: arena.scene.id, actorId: actor.id }]);
			await combat.delete();
			await pause(1500);
			add("AA-04c", "Fim do combate remove o efeito", cursesOn(actor).length === 0, `efeitos=${cursesOn(actor).length}`);
		});
	});

	const failed = results.filter((entry) => !entry.ok);
	console.log(`Amaldiçoar Arma: ${results.length - failed.length}/${results.length} passaram`, failed);
	return results;
}
