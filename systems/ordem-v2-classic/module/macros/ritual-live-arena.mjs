// Arena de teste: uma cena temporária com cópias dos agentes, para os testes ao vivo não tocarem em nada do mundo.
// `withArena` cria a cena e as cópias, roda a função e, no fim, apaga a cena, as cópias e as mensagens de chat criadas
// e volta para a cena que o Mestre estava vendo. `openArena` faz o mesmo sem fechar: quem abre chama `arena.close()`
// (usado pelo teste dirigido por navegador, que conduz o combate em vários passos).

const SYSTEM = "ordem-v2-classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ARENA_NAME = "ZZ arena (teste automático)";

/** Agentes de NEX variados do mundo (cópias são usadas no teste). */
export const DEFAULT_AGENTS = [
	"Agente NEX 05 — Recruta",
	"Agente NEX 25 — Analista",
	"Agente NEX 50 — Ocultista",
	"Agente NEX 75 — Vanguarda",
	"Agente NEX 99 — Comandante",
];

async function waitForCanvas(scene) {
	for (let i = 0; i < 60; i++) {
		if (canvas.scene?.id === scene.id && canvas.ready) return;
		await pause(250);
	}
	throw new Error("A arena não carregou.");
}

/**
 * Cria a arena e devolve `{ scene, agents, mkThreat, origin, close }`.
 * @param {{agents?: string[], pd?: number}} [options]
 */
export async function openArena({ agents = ["Agente NEX 50 — Ocultista"], pd = 200, areaApply = "automatic" } = {}) {
	if (!game.user.isGM) throw new Error("Rode como Mestre.");
	// Os testes de área antigos esperam o dano aplicado na hora; o painel manual tem testes próprios (FC-L7). O padrão do mundo
	// não é alterado: só este navegador, enquanto a arena existe.
	globalThis.__opAreaApplyOverride = areaApply;
	const previous = game.scenes.active ?? canvas.scene;
	const knownMessages = new Set(game.messages.contents.map((message) => message.id));
	const scene = await Scene.create({
		name: ARENA_NAME, width: 3200, height: 2200, padding: 0, grid: { size: 100, distance: 1.5, units: "m" }, tokenVision: false,
	});
	const actorIds = [];
	const close = async () => {
		delete globalThis.__opAreaApplyOverride;
		try {
			for (const combat of game.combats.filter((entry) => entry.scene?.id === scene.id)) await combat.delete();
		} catch { /* ignora */ }
		const fresh = game.messages.contents
			// só as mensagens da arena: do jogo real ninguém é apagado
			.filter((message) => !knownMessages.has(message.id) && (message.speaker?.scene === scene.id || actorIds.includes(message.speaker?.actor)))
			.map((message) => message.id);
		for (let i = 0; i < fresh.length; i += 100) await ChatMessage.deleteDocuments(fresh.slice(i, i + 100)).catch(() => {});
		try {
			if (previous && previous.id !== scene.id) await previous.view();
			await pause(800);
		} catch { /* ignora */ }
		await scene.delete().catch(() => {});
		for (const id of actorIds) await game.actors.get(id)?.delete().catch(() => {});
	};
	try {
		await scene.view();
		await waitForCanvas(scene);
		const arenaAgents = [];
		let col = 3;
		for (const name of agents) {
			const source = game.actors.getName(name);
			if (!source) throw new Error(`Agente "${name}" não existe no mundo.`);
			const data = source.toObject();
			delete data._id;
			data.name = `ZZ ${source.name}`;
			data.flags = { ...data.flags, [SYSTEM]: { ...(data.flags?.[SYSTEM] ?? {}), liveTestCopy: true } };
			const actor = await Actor.create(data);
			actorIds.push(actor.id);
			await actor.update({ "system.PD.value": pd, "system.PD.max": Math.max(pd, actor.system.PD.max) });
			const tokenData = (await actor.getTokenDocument({ x: col * 100, y: 300 })).toObject();
			tokenData.actorLink = true;
			const [tokenDoc] = await scene.createEmbeddedDocuments("Token", [tokenData]);
			arenaAgents.push({ actor, token: tokenDoc.object, doc: tokenDoc });
			col += 2;
		}
		await pause(400);
		const origin = { x: 1600, y: 1100 };
		const mkThreat = async (name, x, y, { baseName = "Aberração de Carne", hp = 9999 } = {}) => {
			const base = game.actors.getName(baseName) ?? game.actors.find((a) => a.type === "threat");
			const data = (await base.getTokenDocument({ x: x - (base.prototypeToken.width * 100) / 2, y: y - (base.prototypeToken.height * 100) / 2 })).toObject();
			data.name = name;
			data.actorLink = false;
			const [doc] = await scene.createEmbeddedDocuments("Token", [data]);
			await doc.actor.update({ "system.attributes.hp.value": hp, "system.attributes.hp.max": hp, "system.genericRd": { value: 0, except: [] } });
			return doc.object;
		};
		return { scene, agents: arenaAgents, mkThreat, origin, close };
	} catch (error) {
		await close();
		throw error;
	}
}

/** Abre a arena, roda `fn(arena)` e fecha (apaga tudo) mesmo se der erro. */
export async function withArena(fn, options = {}) {
	const arena = await openArena(options);
	try {
		return await fn(arena);
	} finally {
		await arena.close();
	}
}
