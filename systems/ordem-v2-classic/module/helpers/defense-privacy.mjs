/**
 * Defesa oculta aos jogadores (spec-aviso-mestre-e-defesa-oculta, seção 2).
 *
 * Flags de mensagem chegam a todos os clientes que enxergam a mensagem, então o número da Defesa
 * não pode ficar em `hitResult`. Estes hooks removem `targetDefense` e `baseDefense` antes de a
 * mensagem ser gravada; o mestre vê a Defesa lida do ator na hora de renderizar.
 */
import { hasDefenseFields, stripDefenseFields } from "./visibility.mjs";

const SYSTEM = "ordem-v2-classic";
const STRIP_KEYS = ["targetDefense", "baseDefense"];

/** Maior parte do trabalho é pura: devolve as chaves "-=" que apagam os campos secretos de um objeto de flags. */
export function deletionKeys(prefix) {
	return Object.fromEntries(STRIP_KEYS.map((key) => [`${prefix}.-=${key}`, null]));
}

/** Reescreve a mensagem pública de esquiva antiga ("nova Defesa N → ACERTO") sem o número. */
export function scrubDodgeText(content) {
	return String(content ?? "").replace(
		/esquivou \(\+\d+ Reflexos\): nova Defesa \d+ → <strong>([^<]+)<\/strong>\./,
		(_m, outcome) => `esquivou: o ataque <strong>${/acert/i.test(outcome) ? "acertou" : "errou"}</strong>.`
	);
}

/** Varre o histórico do chat (somente GM). */
export async function scrubDefenseFromHistory() {
	let cleaned = 0;
	for (const message of game.messages) {
		const flags = message.getFlag(SYSTEM, "hitResult");
		const update = {};
		if (hasDefenseFields(flags)) {
			Object.assign(update, deletionKeys(`flags.${SYSTEM}.hitResult`));
			if (Array.isArray(flags.attackResults)) {
				update[`flags.${SYSTEM}.hitResult.attackResults`] = flags.attackResults.map((r) => stripDefenseFields(r));
			}
		}
		const text = scrubDodgeText(message.content);
		if (text !== message.content) update.content = text;
		if (Object.keys(update).length) {
			await message.update(update);
			cleaned++;
		}
	}
	ui.notifications.info(game.i18n.format("op.defensePrivacy.cleaned", { count: cleaned }));
	return cleaned;
}

export function registerDefensePrivacy() {
	// Antes de gravar: nenhuma mensagem nova guarda a Defesa.
	Hooks.on("preCreateChatMessage", (message) => {
		const hitResult = message._source.flags?.[SYSTEM]?.hitResult;
		if (!hasDefenseFields(hitResult)) return;
		const update = deletionKeys(`flags.${SYSTEM}.hitResult`);
		if (Array.isArray(hitResult.attackResults)) {
			update[`flags.${SYSTEM}.hitResult.attackResults`] = hitResult.attackResults.map((r) => stripDefenseFields(r));
		}
		message.updateSource(update);
	});

	// Atualizações (reação de esquiva, volley, reveal) também não podem reintroduzir o número.
	Hooks.on("preUpdateChatMessage", (message, changes) => {
		const hitResult = changes?.flags?.[SYSTEM]?.hitResult;
		if (!hitResult || typeof hitResult !== "object") return;
		for (const key of STRIP_KEYS) {
			delete hitResult[key];
			hitResult[`-=${key}`] = null;
		}
		if (Array.isArray(hitResult.attackResults)) {
			hitResult.attackResults = hitResult.attackResults.map((r) => stripDefenseFields(r));
		}
	});

	// /limpar-defesa (GM): remove a Defesa gravada em mensagens antigas.
	Hooks.on("chatMessage", (_chatLog, content) => {
		if (content.trim() !== "/limpar-defesa") return;
		if (game.user.isGM) {
			scrubDefenseFromHistory().catch((err) => console.error("Ordem Paranormal | limpeza da Defesa falhou", err));
		} else {
			ui.notifications.warn(game.i18n.localize("op.defensePrivacy.gmOnly"));
		}
		return false;
	});
}
