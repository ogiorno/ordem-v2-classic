/**
 * Conexão e afinidade no Foundry: diálogo de escolha, transição para afinidade e vista da ficha.
 * Regras puras em affinity-rules.mjs; especificação em docs/spec-afinidade.md.
 *
 * Dados em `system.paranormal`. A conexão não pode ser trocada: só o Mestre apaga (para corrigir um erro).
 */
import {
	AFFINITY_ELEMENTS, afterParanormalPower, affinityStatus, canConnect, componentElementOf, componentStatus, connect, elementLabel, emptyParanormal,
	formAffinityCheck, isComponentImproviser, oppressorOf, powersByElement,
} from "./affinity-rules.mjs";
import { AFFINITY_COPY_FLAG, AFFINITY_RULE_FLAG, affinityEffectData, affinityLineFor, canHaveAffinityCopy, copyGrantsBenefit } from "./affinity-powers.mjs";
import { passiveKey } from "./passive-effects-rules.mjs";

const SYS = "ordem_v2_classic";
const COLORS = { blood: "#b3262d", death: "#6b6f7a", knowledge: "#c98a12", energy: "#7d3fc4" };
const esc = (t) => foundry.utils.escapeHTML(String(t));

/** Progresso do agente no mesmo valor que a tela de nível usa (10 = NEX 50%). */
const progressOf = (actor) => ({ level: Number(actor.system?._progress) || Number(actor.system?.nivel?.value) || 1, byNex: false });

export const paranormalOf = (actor) => {
	const p = actor.system?.paranormal ?? {};
	return { ...emptyParanormal(), connection: p.connection ?? "", affinity: p.affinity ?? "", graceLevel: p.graceLevel ?? 0, connectedAtNex: p.connectedAtNex ?? 0 };
};

const isParanormalPower = (item) => item?.type === "ability" && item.system?.abilityType === "paranormal";

const paranormalPowers = (actor) => actor.items.filter(isParanormalPower);

/** Texto com o elemento do poder (a tabela de linhas de afinidade conhece o elemento; o pré-requisito é o plano B). */
const powerElementLabel = (item) => elementLabel(affinityLineFor(item.name)?.element) || item.system?.preRequisite || "";

/** Vista para a ficha (aba Habilidades). Fichas que não são de agente devolvem null. */
export function affinityView(actor) {
	if (actor?.type !== "agent") return null;
	const p = paranormalOf(actor);
	const progress = progressOf(actor);
	const status = affinityStatus(p, progress);
	const element = p.affinity || p.connection;
	const counts = powersByElement(paranormalPowers(actor).map(powerElementLabel));
	return {
		...status,
		elementLabel: elementLabel(element),
		oppressorLabel: elementLabel(oppressorOf(element)),
		color: COLORS[element] ?? "",
		isAffinity: status.state === "affinity",
		isPending: status.state === "pending",
		isLocked: status.state === "locked",
		canChoose: canConnect(p, progress),
		canClear: game.user.isGM && Boolean(p.connection),
		isGM: game.user.isGM,
		counts: Object.entries(AFFINITY_ELEMENTS).map(([key, { label }]) => ({ key, label, count: counts[key], color: COLORS[key] })),
		hasPowers: Object.values(counts).some(Boolean),
	};
}

/** Janela de escolha. Devolve o elemento escolhido ou null (decidir depois). */
export async function askConnection(actor) {
	const buttons = Object.entries(AFFINITY_ELEMENTS).map(([key, { label }]) => ({ action: key, label, callback: () => key }));
	buttons.push({ action: "later", label: "Decidir depois", callback: () => null });
	const result = await foundry.applications.api.DialogV2.wait({
		window: { title: "Conectar-se a um elemento" },
		classes: ["op-skill-choice", "op-affinity-choice"],
		content: `<p><strong>${esc(actor.name)}</strong> chegou a NEX 50%: existe tanto do Outro Lado quanto da Realidade nele. Escolha o elemento com que ele se conecta.</p><p>A escolha <strong>não pode ser alterada</strong>. A conexão não tem efeito imediato; na próxima vez que receber um poder paranormal, ela vira afinidade.</p>`,
		buttons,
		rejectClose: false,
	}).catch(() => null);
	return AFFINITY_ELEMENTS[result] ? result : null;
}

/** Pergunta e grava a conexão. `viaLevelUp`: nasceu da subida para NEX 50%. */
export async function promptConnection(actor, { viaLevelUp = false } = {}) {
	if (!canConnect(paranormalOf(actor), progressOf(actor))) return null;
	const element = await askConnection(actor);
	if (!element) return null;
	// pode ter mudado enquanto a janela estava aberta
	if (!canConnect(paranormalOf(actor), progressOf(actor))) return null;
	const next = connect(paranormalOf(actor), element, { level: progressOf(actor).level, nex: Number(actor.system?.NEX?.value) || 0, viaLevelUp });
	await actor.update({ "system.paranormal": next }, { opParanormal: true });
	ui.notifications.info(`${actor.name} agora está conectado a ${elementLabel(element)}.`);
	return element;
}

/** O Mestre apaga a conexão e a afinidade (correção de erro). */
export async function clearConnection(actor) {
	if (!game.user.isGM) return false;
	const ok = await foundry.applications.api.DialogV2.confirm({
		window: { title: "Apagar conexão" },
		content: `<p>Apagar a conexão e a afinidade de <strong>${esc(actor.name)}</strong>? A escolha poderá ser feita de novo.</p>`,
		rejectClose: false,
	}).catch(() => false);
	if (!ok) return false;
	await actor.update({ "system.paranormal": emptyParanormal() }, { opParanormal: true });
	return true;
}

// ----------------------------------------------------------------------------------------------------------------
// ganchos

// Guarda se o agente já estava em NEX 50% antes da mudança e recusa trocar a conexão fora dos fluxos do sistema.
Hooks.on("preUpdateActor", (actor, changes, options) => {
	if (actor.type !== "agent") return;
	if (changes.system?.nivel !== undefined || changes.system?.stage !== undefined) {
		options.opAffinityReached = progressOf(actor).level >= 10;
	}
	const p = changes.system?.paranormal;
	if (p && !options.opParanormal && !game.user.isGM) {
		const current = paranormalOf(actor);
		if (p.connection !== undefined && p.connection !== current.connection) { delete p.connection; ui.notifications.warn("A conexão com um elemento não pode ser alterada."); }
		if (p.affinity !== undefined && p.affinity !== current.affinity) delete p.affinity;
	}
});

// Subiu para NEX 50% e ainda não tem conexão: pergunta (só para quem fez a mudança e dono da ficha).
Hooks.on("updateActor", (actor, changes, options, userId) => {
	if (actor.type !== "agent" || userId !== game.user.id || options?.opAffinityReached !== false) return;
	if (!actor.isOwner || !canConnect(paranormalOf(actor), progressOf(actor))) return;
	promptConnection(actor, { viaLevelUp: true }).catch((err) => console.warn("Ordem Paranormal | conexão:", err));
});

// Poder paranormal novo: a conexão vira afinidade.
Hooks.on("createItem", (item, _options, userId) => {
	const actor = item.parent;
	if (userId !== game.user.id || actor?.type !== "agent" || !isParanormalPower(item)) return;
	// O mesmo poder pela segunda vez é a cópia de afinidade: dá só a linha "Afinidade" e não conta como poder novo
	if (isAffinityCopy(actor, item)) {
		registerCopy(actor, item).catch((err) => console.warn("Ordem Paranormal | cópia de afinidade:", err));
		return;
	}
	const before = paranormalOf(actor);
	const after = afterParanormalPower(before, { level: progressOf(actor).level });
	if (after.affinity === before.affinity) return;
	actor.update({ "system.paranormal": after }, { opParanormal: true })
		.then(() => ui.notifications.info(`${actor.name} desenvolveu afinidade com ${elementLabel(after.affinity)}.`))
		.catch((err) => console.warn("Ordem Paranormal | afinidade:", err));
});

/**
 * Exigências da conjuração: afinidade da forma e componentes ritualísticos do elemento.
 * Afinidade ausente impede a forma (o Mestre conjura por qualquer ficha); componente ausente só avisa.
 * `required`: texto de afinidade da forma ("afinidade", "Morte") ou null.
 */
export function castRequirements(actor, ritualElement, required = null) {
	const p = paranormalOf(actor);
	const componentElements = actor.items.filter((i) => i.type === "generalEquipment").map((i) => componentElementOf(i.name)).filter(Boolean);
	const improvises = actor.items.some((i) => i.type === "ability" && isComponentImproviser(i.name));
	return {
		affinity: formAffinityCheck(p, required, ritualElement, { bypass: game.user.isGM }),
		components: componentStatus(p, ritualElement, { componentElements, improvises }),
	};
}

// ----------------------------------------------------------------------------------------------------------------
// segunda cópia de um poder do elemento (linha "Afinidade")

/** Este poder acabou de entrar e a ficha já tinha o mesmo poder paranormal? */
function isAffinityCopy(actor, item) {
	if (!canHaveAffinityCopy(item.name)) return false;
	const key = passiveKey(item.name);
	return actor.items.some((i) => i.id !== item.id && isParanormalPower(i) && passiveKey(i.name) === key);
}

/** Marca o poder como cópia, liga o benefício (se a ficha tem a afinidade certa) e avisa. */
async function registerCopy(actor, item) {
	await item.setFlag(SYS, AFFINITY_COPY_FLAG, true);
	await syncAffinityCopy(item);
	const affinity = paranormalOf(actor).affinity;
	const line = affinityLineFor(item.name);
	if (!copyGrantsBenefit(item.name, affinity)) {
		ui.notifications.warn(`${item.name} só pode ser escolhido uma segunda vez por quem tem afinidade com ${elementLabel(line?.element)}: esta cópia não dá benefício até ${actor.name} ter essa afinidade.`);
	} else if (line?.manual) {
		ui.notifications.info(`${item.name} (Afinidade): ${line.line} Aplique pelo texto.`);
	}
}

const copyLocks = new Map();

/** Cria, atualiza ou tira o efeito da cópia de afinidade (uma sincronização por vez por poder). */
export function syncAffinityCopy(item) {
	const key = item?.uuid ?? item?.id;
	const run = (copyLocks.get(key) ?? Promise.resolve()).catch(() => null).then(() => syncAffinityCopyNow(item));
	copyLocks.set(key, run);
	run.finally(() => { if (copyLocks.get(key) === run) copyLocks.delete(key); }).catch(() => null);
	return run;
}

async function syncAffinityCopyNow(item) {
	const actor = item?.parent;
	if (!actor || !item.getFlag(SYS, AFFINITY_COPY_FLAG)) return null;
	// o bônus normal do poder (o que o sistema cria e o que o compêndio traz pronto) já vale na primeira cópia:
	// a cópia de afinidade só leva o efeito da linha "Afinidade"
	const extra = item.effects.filter((e) => !e.getFlag(SYS, AFFINITY_RULE_FLAG));
	if (extra.length) await item.deleteEmbeddedDocuments("ActiveEffect", extra.map((e) => e.id));
	const data = affinityEffectData(item.name, paranormalOf(actor).affinity);
	const managed = item.effects.filter((e) => e.getFlag(SYS, AFFINITY_RULE_FLAG));
	if (!data) {
		if (managed.length) await item.deleteEmbeddedDocuments("ActiveEffect", managed.map((e) => e.id));
		return null;
	}
	if (managed.length > 1) await item.deleteEmbeddedDocuments("ActiveEffect", managed.slice(1).map((e) => e.id));
	if (!managed.length) {
		await item.createEmbeddedDocuments("ActiveEffect", [data]);
		return "created";
	}
	const same = JSON.stringify((managed[0].system?.changes ?? []).map((c) => [c.key, String(c.value)])) === JSON.stringify(data.system.changes.map((c) => [c.key, String(c.value)]));
	if (!same) {
		await managed[0].update({ "system.changes": data.system.changes, description: data.description });
		return "updated";
	}
	return null;
}

/** Cópias de afinidade da ficha, na ordem em que a ficha as guarda. */
export const affinityCopies = (actor) => actor.items.filter((i) => isParanormalPower(i) && i.getFlag(SYS, AFFINITY_COPY_FLAG));

// A afinidade mudou (ganhou, foi apagada): as cópias ligam ou desligam o benefício.
Hooks.on("updateActor", (actor, changes, _options, userId) => {
	if (userId !== game.user.id || actor.type !== "agent" || changes.system?.paranormal === undefined) return;
	for (const item of affinityCopies(actor)) syncAffinityCopy(item).catch((err) => console.warn("Ordem Paranormal | cópia de afinidade:", err));
});
