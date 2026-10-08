/**
 * Regras puras dos efeitos de início de turno (sem Foundry — testável em Node). Ver docs/spec-teste-de-turno.md.
 */

export const BLEED_DT = 20;

/**
 * Como resolver o teste de Sangrando: "ask" posta um cartão com botão para o dono da ficha; "auto" o Mestre rola na hora.
 * Só pergunta quando a opção do mundo é "ask", a ficha é de agente e existe um dono jogador conectado.
 */
export function bleedMode({ setting, actorType, hasOnlineOwner }) {
	if (setting === "ask" && actorType === "agent" && hasOnlineOwner) return "ask";
	return "auto";
}

/** Resultado do teste de Vigor do Sangrando. */
export function bleedOutcome(total, dt = BLEED_DT) {
	return Number(total) >= dt ? "stanched" : "bleeds";
}

/** Quem pode clicar "Rolar Vigor": o Mestre ou um dono da ficha. */
export function canRollBleed({ isGM, isOwner }) {
	return Boolean(isGM || isOwner);
}

/** O cartão ainda aceita a rolagem? (uma vez só) */
export function bleedCardOpen(flag) {
	return Boolean(flag && !flag.resolved);
}
