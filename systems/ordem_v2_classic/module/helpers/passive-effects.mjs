/**
 * Poderes passivos que dão o bônus só de entrarem na ficha (regras em passive-effects-rules.mjs).
 *
 * O bônus vira um Efeito Ativo `transfer` guardado no próprio poder: o Foundry aplica na ficha enquanto o poder
 * existir e tira o bônus sozinho quando o poder é apagado. Poder novo ganha o efeito ao entrar na ficha e, ao abrir
 * o mundo, o Mestre completa as fichas que já tinham o poder antes desta regra.
 */
import { CHOICE_FLAG, MANAGED_FLAG, passiveEffectData, passiveRuleFor, validChoice } from "./passive-effects-rules.mjs";
import { AFFINITY_COPY_FLAG } from "./affinity-powers.mjs";

const SYSTEM = "ordem_v2_classic";

export const isPassiveAbility = (item) => item?.type === "ability" && item.system?.activation === "passive";

const sameChanges = (effect, data) =>
	JSON.stringify((effect.system?.changes ?? []).map((c) => [c.key, c.type, String(c.value)])) ===
	JSON.stringify(data.system.changes.map((c) => [c.key, c.type, String(c.value)]));

const inFlight = new Map();

/** Uma sincronização por vez por poder (duas chamadas juntas criariam o efeito em dobro). */
export function syncPassiveItem(item) {
	const key = item?.uuid ?? item?.id;
	const run = (inFlight.get(key) ?? Promise.resolve()).catch(() => null).then(() => syncPassiveItemNow(item));
	inFlight.set(key, run);
	run.finally(() => { if (inFlight.get(key) === run) inFlight.delete(key); }).catch(() => null);
	return run;
}

/** Cria, atualiza ou completa o efeito do poder; devolve o que fez ("created", "updated" ou null). */
async function syncPassiveItemNow(item) {
	if (item?.type !== "ability") return null;
	const managed = item.effects.filter((e) => e.getFlag(SYSTEM, MANAGED_FLAG));
	// a segunda cópia de um poder do elemento só dá a linha "Afinidade" (affinity.mjs), nunca o bônus normal de novo
	if (item.getFlag(SYSTEM, AFFINITY_COPY_FLAG)) {
		if (managed.length) await item.deleteEmbeddedDocuments("ActiveEffect", managed.map((e) => e.id));
		return null;
	}
	if (!isPassiveAbility(item) || !passiveRuleFor(item.name)) {
		// o poder deixou de ser passivo (ou mudou de nome): o bônus que o sistema criou sai junto
		if (managed.length) await item.deleteEmbeddedDocuments("ActiveEffect", managed.map((e) => e.id));
		return null;
	}
	// uma ficha pode ter criado o efeito duas vezes (dois clientes ao mesmo tempo): fica um só
	if (managed.length > 1) await item.deleteEmbeddedDocuments("ActiveEffect", managed.slice(1).map((e) => e.id));
	const choice = item.getFlag(SYSTEM, CHOICE_FLAG) ?? null;
	const data = passiveEffectData(item.name, { existing: item.effects.map((e) => ({ ...e.toObject(), id: e.id })), choice });
	const own = managed[0];
	if (!data) {
		// o compêndio passou a trazer o efeito: o nosso sai para não somar duas vezes
		if (own) await item.deleteEmbeddedDocuments("ActiveEffect", [own.id]);
		return null;
	}
	if (!own) {
		await item.createEmbeddedDocuments("ActiveEffect", [data]);
		// o mesmo usuário em dois navegadores cria o efeito nos dois: fica o de menor id, os outros saem
		await new Promise((resolve) => setTimeout(resolve, 500));
		const all = item.effects.filter((e) => e.getFlag(SYSTEM, MANAGED_FLAG)).sort((a, b) => a.id.localeCompare(b.id));
		if (all.length > 1) await item.deleteEmbeddedDocuments("ActiveEffect", all.slice(1).map((e) => e.id)).catch(() => null);
		return "created";
	}
	if (!sameChanges(own, data) || own.disabled !== data.disabled) {
		await own.update({ "system.changes": data.system.changes, description: data.description, disabled: false });
		return "updated";
	}
	return null;
}

/** Poder que pede uma escolha e ainda não tem a escolha válida guardada. */
export const needsChoice = (item) => {
	const rule = isPassiveAbility(item) ? passiveRuleFor(item.name) : null;
	return Boolean(rule?.choice) && !validChoice(item.name, item.getFlag(SYSTEM, CHOICE_FLAG));
};

/**
 * Pergunta ao jogador a perícia/atributo do poder, guarda a escolha no poder (o efeito é refeito por updateItem)
 * e devolve o valor, ou null se cancelou. Também serve para trocar a escolha depois.
 */
export async function promptPassiveChoice(item) {
	const choice = passiveRuleFor(item?.name)?.choice;
	if (!choice) return null;
	const current = item.getFlag(SYSTEM, CHOICE_FLAG);
	const esc = (t) => foundry.utils.escapeHTML(String(t));
	const options = choice.options.map((o) => `<option value="${esc(o.value)}"${o.value === current ? " selected" : ""}>${esc(o.label)}</option>`).join("");
	const value = await foundry.applications.api.DialogV2.prompt({
		window: { title: item.name },
		classes: ["op-passive-choice"],
		content: `<p>${esc(choice.prompt)}</p><div class="form-group"><select name="choice">${options}</select></div>`,
		ok: { label: "Confirmar", callback: (_event, button) => button.form.elements.choice.value },
		rejectClose: false,
	}).catch(() => null);
	if (!validChoice(item.name, value)) return null;
	await item.setFlag(SYSTEM, CHOICE_FLAG, value);
	return value;
}

const locks = new Map();

/** Completa os poderes passivos da ficha (uma sincronização por vez por ficha). */
export function syncPassiveEffects(actor) {
	if (!actor?.isOwner) return Promise.resolve([]);
	const run = async () => {
		const done = [];
		for (const item of actor.items) {
			const result = await syncPassiveItem(item);
			if (result) done.push({ name: item.name, result });
		}
		return done;
	};
	const next = (locks.get(actor.id) ?? Promise.resolve()).then(run).catch((err) => {
		console.warn("Ordem Paranormal | sincronização dos poderes passivos:", err);
		return [];
	});
	locks.set(actor.id, next);
	return next;
}

// Poder novo na ficha: quem o criou já cria o efeito (os outros clientes não repetem).
Hooks.on("createItem", (item, _options, userId) => {
	if (userId !== game.user.id || item.parent?.type !== "agent" || !isPassiveAbility(item)) return;
	// um instante depois da criação, quando a ficha já terminou de gravar o poder
	setTimeout(async () => {
		try {
			await syncPassiveItem(item);
			// poder de escolha (Mutação, Carteirada...): pergunta na hora; a escolha refaz o efeito
			if (needsChoice(item)) await promptPassiveChoice(item);
		} catch (err) {
			console.warn("Ordem Paranormal | poder passivo:", err);
		}
	}, 300);
});

// Trocar a execução para "passivo" (ou o nome) também liga o bônus.
Hooks.on("updateItem", (item, changes, _options, userId) => {
	if (userId !== game.user.id || item.parent?.type !== "agent") return;
	if (changes.name === undefined && changes.system?.activation === undefined && changes.flags?.[SYSTEM]?.[CHOICE_FLAG] === undefined) return;
	setTimeout(() => syncPassiveItem(item).catch((err) => console.warn("Ordem Paranormal | poder passivo:", err)), 300);
});

// O Mestre ativo completa, ao abrir o mundo, as fichas que já tinham os poderes antes de eles darem o bônus.
Hooks.once("ready", () => {
	if (game.users.activeGM?.id !== game.user.id) return;
	(async () => {
		for (const actor of game.actors.filter((a) => a.type === "agent")) await syncPassiveEffects(actor);
	})().catch((err) => console.warn("Ordem Paranormal | Sincronização dos poderes passivos falhou:", err));
});
