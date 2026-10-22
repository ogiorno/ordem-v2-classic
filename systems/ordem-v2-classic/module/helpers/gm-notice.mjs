/**
 * Aviso do mestre: uma linha amarela, só texto, visível apenas para o GM
 * (spec-aviso-mestre-e-defesa-oculta, seção 1).
 */

const SYSTEM = "ordem-v2-classic";

/** Texto do aviso (puro): "Mestre · frase". O texto entra escapado no HTML. */
export function gmNoticeHtml(text, label = "Mestre") {
	const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	return `<p class="gm-notice-line"><strong>${esc(label)}</strong> · ${esc(text)}</p>`;
}

/**
 * Cria um aviso só para os GMs.
 * @param {string} text   frase simples (sem HTML)
 * @param {{kind?: string}} [options]
 */
export async function gmNotice(text, { kind = "info" } = {}) {
	const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
	if (!gmIds.length) return null;
	return ChatMessage.create({
		content: gmNoticeHtml(text, game.i18n.localize("op.gmNotice.label")),
		whisper: gmIds,
		speaker: { alias: game.i18n.localize("op.gmNotice.label") },
		flags: { [SYSTEM]: { gmNotice: { kind } } },
	});
}
