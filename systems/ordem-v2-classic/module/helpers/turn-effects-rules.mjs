/**
 * Regras puras dos efeitos de início de turno (sem Foundry — testável em Node). Ver docs/arquivo/spec-teste-de-turno.md.
 */

export const BLEED_DT = 20;

/** Em Chamas: dano de fogo no início do turno (docs/arquivo/spec-armas-area-recarga.md, seção 4). */
export const BURN_DAMAGE_FORMULA = "1d6";
export const BURN_DAMAGE_TYPE = "fireDamage";

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

/** Acúmulos do Sangrando (cada nova aplicação soma 1). Efeito sem contagem vale 1. */
export function bleedStacks(data) {
	return Math.max(1, Math.floor(Number(data?.stacks) || 1));
}

/** Fórmula de dano do Sangrando: 1d6 por acúmulo. */
export function bleedDamageFormula(stacks) {
	return `${bleedStacks({ stacks })}d6`;
}

/** Quem pode clicar "Rolar Vigor": o Mestre ou um dono da ficha. */
export function canRollBleed({ isGM, isOwner }) {
	return Boolean(isGM || isOwner);
}

/** O cartão ainda aceita a rolagem? (uma vez só) */
export function bleedCardOpen(flag) {
	return Boolean(flag && !flag.resolved);
}
