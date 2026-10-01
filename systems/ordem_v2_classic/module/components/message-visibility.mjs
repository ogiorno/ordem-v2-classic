/**
 * Regra pura: uma nota de atualização aparece para este usuário agora?
 * - `audience` ("gm" por padrão): jogadores não recebem notas de atualização.
 * - `display: "once"`: mostra uma vez por usuário (lista de títulos já vistos).
 * - `patchNotesDisabled`: o usuário desligou todas as notas.
 * @param {{display?: string, title?: string, audience?: string}} msg
 * @param {{isGM: boolean, patchNotesDisabled: boolean, seenTitles: string[]}} ctx
 * @returns {boolean}
 */
export function shouldDisplayMessage(msg, { isGM, patchNotesDisabled, seenTitles = [] }) {
	if (patchNotesDisabled) return false;
	const audience = msg.audience ?? "gm";
	if (audience === "gm" && !isGM) return false;
	if (msg.display === "once" && seenTitles.includes(msg.title)) return false;
	return true;
}
