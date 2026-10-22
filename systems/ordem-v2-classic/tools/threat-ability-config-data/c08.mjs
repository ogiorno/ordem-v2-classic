// C08 — fichas 1620–1622 (Livro v1.3).
import { RANGE, ability, damage, dmg, exec, req, requirements, tokens, triggerPart } from "./dsl.mjs";

export default [
	// --- Javaporco VD 20 1620 ---
	ability("1620-H01", { state: "manual", gaps: ["após sofrer dano: +d20 em testes de ataque e um dado de dano adicional até o fim da cena"], why: "Passiva que ativa bônus acumulados a partir do dano sofrido." }),
	ability("1620-H02", { state: "manual", gaps: ["ao chegar a 0 PV, ataque de mordida contra oponente aleatório em alcance antes de morrer"], why: "Reação ao chegar a 0 PV com ataque armament." }),

	// --- Onça-Pintada VD 40 1621 ---
	ability("1621-H01", { state: "manual", gaps: ["acerto da mordida em ser Médio ou menor", "agarrar (teste 3d20+7)"], why: "Agarrar depende do acerto." }),
	ability("1621-H02", { state: "manual", gaps: ["investida com mordida e garras (três ataques com +d20 da investida contra o mesmo alvo)"], why: "Investida com ataques armament." }),

	// --- Sucuri VD 40 1622 ---
	ability("1622-H01", { state: "manual", gaps: ["acerto da mordida em ser Médio ou menor", "agarrar (teste 3d20+12)"], why: "Agarrar depende do acerto." }),
	ability("1622-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 20), damage(dmg("2d6+8", "impacto")), triggerPart("turnStart", "self"), requirements(req.narrative("os seres estão agarrados pela sucuri"))], { mode: "triggered" }),
		gaps: ["quantidade de agarrados não limitada no texto: o Mestre indica quem está agarrado"],
		why: "Dano de impacto no início de cada turno da sucuri aos agarrados; o Mestre indica os agarrados."
	})
];
