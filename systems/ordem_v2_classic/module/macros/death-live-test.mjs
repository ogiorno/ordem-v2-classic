// Testes ao vivo da morte do agente (Morrendo, Dano Massivo, estabilizar). Roda numa cena temporária com cópias
// dos agentes (ver ritual-live-arena.mjs); nada do mundo é alterado.
//
//   const t = await import("/systems/ordem_v2_classic/module/macros/death-live-test.mjs");
//   await t.runDeathTests();
//
// Devolve uma tabela { id, caso, ok, detalhe }. Spec: docs/spec-morte-do-jogador.md.

import { withArena } from "./ritual-live-arena.mjs";
import { activeConditions } from "../helpers/conditions.mjs";
import { resolveStabilize } from "../helpers/death.mjs";

const SYSTEM = "ordem_v2_classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pv = (actor) => Number(actor.system.PV.value);
const dying = (actor) => activeConditions(actor, "dying").length > 0;
const unconscious = (actor) => activeConditions(actor, "unconscious").length > 0;
const stabilizeCards = (actor) => game.messages.contents.filter((m) => m.getFlag(SYSTEM, "stabilizePending")?.actorId === actor.id);

/** Volta o agente ao normal: sem efeitos, sem marcas de cena, PV cheios. */
async function reset(actor) {
	if (actor.statuses.has("dead")) await actor.toggleStatusEffect("dead", { active: false });
	await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.map((effect) => effect.id));
	for (const flag of ["dyingTurns", "stabilizations"]) if (actor.getFlag(SYSTEM, flag) !== undefined) await actor.unsetFlag(SYSTEM, flag);
	await actor.update({ "system.PV.value": Number(actor.system.PV.max), "system.PV.nonLethal": 0 });
	await pause(500);
}

async function withCombat(arena, tokens, fn) {
	const combat = await Combat.create({ scene: arena.scene.id, active: true });
	await combat.createEmbeddedDocuments("Combatant", tokens.map((token, i) => ({ tokenId: token.id, sceneId: arena.scene.id, actorId: token.actor.id, initiative: 100 - i * 10 })));
	await pause(300);
	try {
		await combat.startCombat();
		await pause(700);
		return await fn(combat);
	} finally {
		await combat.delete().catch(() => {});
	}
}

async function advanceTo(combat, tokenId, limit = 8) {
	for (let i = 0; i < limit; i++) {
		if (combat.combatant?.tokenId === tokenId) return true;
		await combat.nextTurn();
		await pause(1700);
	}
	return combat.combatant?.tokenId === tokenId;
}

export async function runDeathTests() {
	const results = [];
	const add = (id, caso, ok, detalhe) => results.push({ id, caso, ok: !!ok, detalhe });
	await withArena(async (arena) => {
		const [victimEntry, medicEntry] = arena.agents;
		const victim = victimEntry.actor;
		const medic = medicEntry.actor;
		const run = async (id, fn) => {
			try { await fn(); } catch (error) { add(id, "erro", false, error.stack?.split("\n").slice(0, 3).join(" ") ?? String(error)); }
		};

		await run("DT-01", async () => {
			await reset(victim);
			await victim.applyDamage(40, { ignoreRD: true });
			await pause(900);
			const card = stabilizeCards(victim)[0];
			add("DT-01", "0 PV: Inconsciente + Morrendo, Defesa −5 e carta com botão de estabilizar",
				pv(victim) === 0 && dying(victim) && unconscious(victim) && /data-action="stabilize"/.test(card?.content ?? ""),
				`PV ${pv(victim)}, morrendo ${dying(victim)}, inconsciente ${unconscious(victim)}, carta ${!!card}`);
		});

		await run("DT-02", async () => {
			await reset(victim);
			const max = Number(victim.system.PV.max);
			// dano ≥ metade dos PV totais e abaixo dos PV: pede Fortitude (DT 15 + 2 por 10 de dano); passar ou falhar são ambos válidos.
			const real = max;
			const result = await victim.applyDamage(Math.ceil(real / 2) + 1, { ignoreRD: true });
			await pause(900);
			const ran = game.messages.contents.some((m) => /Dano massivo/.test(m.content ?? "") && m.speaker?.actor === victim.id);
			add("DT-02", "Dano Massivo: dano ≥ metade dos PV sem zerar pede Fortitude e a mensagem de resultado aparece",
				ran && (pv(victim) === 0) === result.conditions.includes("danoMassivo"), `PV máx ${real} (base ${max}); PV ${pv(victim)}; condições ${result.conditions.join(",")}`);
		});

		await run("DT-03", async () => {
			await reset(victim);
			const max = Number(victim.system.PV.max);
			const dmg = Math.floor((max - 1) / 2);
			const result = await victim.applyDamage(dmg, { ignoreRD: true });
			await pause(600);
			add("DT-03", "Dano abaixo da metade dos PV: sem teste de Fortitude, só perde PV", pv(victim) === max - dmg && !dying(victim) && !result.conditions.includes("danoMassivo"), `PV ${pv(victim)} de ${max} (dano ${dmg})`);
		});

		await run("DT-04", async () => {
			await reset(victim);
			await victim.update({ "system.PV.value": 0 });
			await pause(900);
			await victim.update({ "system.PV.value": 6 });
			await pause(900);
			add("DT-04", "Cura de 1+ PV encerra Inconsciente, mas Morrendo continua", pv(victim) === 6 && !unconscious(victim) && dying(victim), `PV ${pv(victim)}, morrendo ${dying(victim)}, inconsciente ${unconscious(victim)}`);
		});

		await run("DT-05", async () => {
			await reset(victim);
			await victim.update({ "system.PV.value": 5, "system.PV.nonLethal": 5 });
			await pause(900);
			add("DT-05", "Dano não letal soma ao letal só para Inconsciente (não fica Morrendo)", unconscious(victim) && !dying(victim), `inconsciente ${unconscious(victim)}, morrendo ${dying(victim)}`);
		});

		await run("DT-06", async () => {
			const threat = await arena.mkThreat("ZZ ameaça a 0 PV", 2200, 900, { hp: 10 });
			await threat.actor.update({ "system.attributes.hp.value": 0 });
			await pause(900);
			add("DT-06", "Ameaça a 0 PV não ganha Morrendo (regra do jogador)", !dying(threat.actor) && !unconscious(threat.actor), "");
			await threat.document.delete();
		});

		await run("DT-07", async () => {
			await reset(victim);
			await victim.update({ "system.PV.value": 0 });
			await pause(900);
			const card = stabilizeCards(victim)[0];
			// longe: nem rola (nada muda); depois o médico vai para o quadrado ao lado
			const far = await resolveStabilize(card.id, medic);
			const farStill = dying(victim) && pv(victim) === 0;
			await medicEntry.doc.update({ x: victimEntry.doc.x + 100, y: victimEntry.doc.y });
			await pause(500);
			// Medicina DT 20: tenta até passar (a carta fica aberta se falhar)
			const outcomes = [];
			for (let i = 0; i < 25 && outcomes.at(-1) !== "stabilized"; i++) outcomes.push(await resolveStabilize(card.id, medic));
			await pause(600);
			add("DT-11", "Médico longe (não adjacente) não estabiliza e nada é rolado", far === "far" && farStill, `resultado ${far}`);
			add("DT-07", "Medicina estabiliza: sai de Morrendo e Inconsciente com 1 PV (falha mantém tudo)",
				outcomes.at(-1) === "stabilized" && !dying(victim) && !unconscious(victim) && pv(victim) === 1 && outcomes.slice(0, -1).every((o) => o === "failed"),
				`resultados: ${outcomes.join(",")}; PV ${pv(victim)}; estabilizações ${victim.getFlag(SYSTEM, "stabilizations")}`);
		});

		await run("DT-08", async () => {
			// logo após o DT-07 o agente tem 1 estabilização na cena: a próxima queda pede DT 25
			await victim.update({ "system.PV.value": 0 });
			await pause(900);
			const card = stabilizeCards(victim).at(-1);
			add("DT-08", "Segunda queda na mesma cena: Medicina DT 25 (+5 por estabilização)", /DT 25/.test(card?.content ?? ""), (card?.content ?? "sem carta").replace(/<[^>]+>/g, " ").slice(0, 160));
		});

		await run("DT-12", async () => {
			// Dano Massivo com Fortitude passando: o agente aguenta (fica com PV). Repete até ver um sucesso.
			const target = victim;
			const max = Number(target.system.PV.max);
			const dmg = Math.ceil(max / 2) + 1;
			let passed = false;
			let tries = 0;
			for (; tries < 25 && !passed; tries++) {
				await reset(target);
				const result = await target.applyDamage(dmg, { ignoreRD: true });
				await pause(500);
				passed = !result.conditions.includes("danoMassivo");
				if (passed) passed = pv(target) === max - dmg && !dying(target);
			}
			add("DT-12", "Dano Massivo com Fortitude passando: perde só o dano e fica de pé", passed, `tentativas ${tries}; PV ${pv(target)} de ${max}`);
			await reset(target);
		});

		await run("DT-09", async () => {
			await reset(victim);
			await reset(medic);
			await victim.update({ "system.PV.value": 0 });
			await pause(900);
			const counts = [];
			let aliveBeforeThird = true;
			await withCombat(arena, [victimEntry.token, medicEntry.token], async (combat) => {
				await pause(1500);
				const seen = () => Number(victim.getFlag(SYSTEM, "dyingTurns")) || 0;
				const note = () => {
					if (seen() && counts.at(-1) !== seen()) {
						counts.push(seen());
						if (seen() < 3 && victim.statuses.has("dead")) aliveBeforeThird = false;
					}
				};
				note();
				for (let i = 0; i < 12 && !victim.statuses.has("dead"); i++) {
					await combat.nextTurn();
					await pause(2000);
					note();
				}
			});
			await pause(800);
			const dead = victim.statuses.has("dead");
			add("DT-09", "Três turnos iniciados morrendo (não consecutivos) matam; antes disso vive",
				dead && aliveBeforeThird && counts.join(",") === "1,2,3", `contagem a cada turno: ${counts.join(",")}; morreu ${dead}`);
			add("DT-10", "Fim do combate zera a contagem de turnos morrendo e de estabilizações",
				victim.getFlag(SYSTEM, "dyingTurns") === undefined && victim.getFlag(SYSTEM, "stabilizations") === undefined, `dyingTurns ${victim.getFlag(SYSTEM, "dyingTurns")}`);
		});
	}, { agents: ["Agente NEX 25 — Analista", "Agente NEX 99 — Comandante"] });
	return results;
}
