// C07 — fichas 1609–1619 (Livro v1.3). A ficha 1612 não tem habilidade separada na extração.
import { RANGE, ability, attackPointer, damage, dmg, effects, exec, fx, req, requirements, save, sphereAt, tokens, triggerPart } from "./dsl.mjs";

export default [
	// --- Investido VD 40 1609 / Líder de Culto VD 140 1610 ---
	ability("1609-H01", { state: "manual", gaps: ["conjurar dois rituais de 1º e dois de 2º círculo sem custo de PE (até 5 PE), DT 17"], why: "Ritual conjurado por ameaça tem fluxo próprio (fora desta spec)." }),
	ability("1610-H01", { state: "manual", gaps: ["a extração do texto está truncada (Escolha dois rituais de...)"], why: "Texto extraído incompleto; conferir na fonte. Ritual conjurado por ameaça tem fluxo próprio." }),
	ability("1610-H02", { state: "manual", gaps: ["a extração trata o ataque Faca (corpo a corpo, 2d20+10, crítico 19, dano 1d4+1 de corte) como habilidade"], why: "Descrição de ataque armament classificada como habilidade na extração." }),

	// --- Policial de Elite VD 60 1613 ---
	ability("1613-H01", { state: "manual", gaps: ["50% de chance de ignorar o dano adicional de crítico ou ataque furtivo"], why: "Passiva probabilística que altera dano de outros ataques." }),
	ability("1613-H02", {
		state: "automatic",
		execution: exec([sphereAt(6, RANGE.medio), save("reflexos", 19, "half"), damage(dmg("8d6", "impacto")), requirements(req.perScene(1))]),
		why: "Granada em alcance médio, 6 m de raio, dano de impacto, Reflexos reduzindo à metade, uma vez por cena."
	}),
	ability("1613-H03", { state: "manual", gaps: ["empurrar o personagem adjacente 3 m (Fortitude DT 19 evita)", "tiro de fuzil de assalto com +d20 e +2d8 de dano se empurrou"], why: "Empurrão seguido de ataque armament com bônus condicionado." }),

	// --- Chefe de Polícia VD 100 1614 ---
	ability("1614-H01", { state: "manual", gaps: ["uma vez por cena ignorar um efeito que exija teste de resistência ou reduzir um dano recém sofrido à metade", "o nome da habilidade extraído traz o texto da regra"], why: "Reação defensiva sobre efeitos e danos de outras habilidades." }),

	// --- Cão de Guarda VD 10 1616 ---
	ability("1616-H01", { state: "manual", gaps: ["acerto da mordida", "manobra derrubar (bônus d20d20+5)"], why: "Manobra que depende do acerto." }),

	// --- Enxame de Abelhas VD 10 1617 ---
	ability("1617-H01", { state: "manual", gaps: ["entrar no espaço de um ser", "2d6 de dano de perfuração no fim do turno a qualquer ser no espaço do enxame", "imune a manobras e efeitos de um só ser; metade do dano de armas e +50% de efeitos de área"], why: "Regras de enxame: dano automático por posição e modificadores de dano sofrido." }),
	ability("1617-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("fortitude", 15), effects(fx("enjoado", "rounds", 1)), triggerPart("manual", "any"), requirements(req.narrative("o ser sofreu dano do enxame de abelhas"))], { mode: "triggered" }),
		why: "Passiva acionada pelo Mestre depois do dano do enxame: Enjoado por 1 rodada, Fortitude evita."
	}),

	// --- Enxame de Ratos VD 10 1618 ---
	ability("1618-H01", { state: "manual", gaps: ["entrar no espaço de um ser", "2d6 de dano de perfuração no fim do turno a qualquer ser no espaço do enxame, automaticamente", "imune a manobras e efeitos de um só ser; metade do dano de armas e +50% de efeitos de área"], why: "Regras de enxame: dano automático por posição e modificadores de dano sofrido." }),
	ability("1618-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("fortitude", 15), effects(fx("febre hemorrágica", "unspecified")), triggerPart("manual", "any"), requirements(req.narrative("o ser sofreu dano do enxame de ratos"))], { mode: "triggered" }),
		gaps: ["as regras da doença febre hemorrágica ficam com o Mestre"],
		why: "Passiva acionada pelo Mestre depois do dano do enxame: doença como marcador, Fortitude evita."
	}),

	// --- Jacaré VD 40 1619 ---
	ability("1619-H01", { state: "manual", gaps: ["jacaré agarrando um ser dentro da água e repetindo a manobra agarrar", "+2d8 de dano"], why: "Bônus de dano condicionado a manobra e ambiente." }),
	ability("1619-H02", { state: "manual", gaps: ["a extração trata o ataque Cauda (corpo a corpo, 3d20+5, dano 1d12 de impacto) como passiva"], why: "Descrição de ataque armament classificada como habilidade na extração." }),
	ability("1619-H03", { state: "manual", gaps: ["acerto da mordida em ser Médio ou menor", "agarrar (teste 3d20+7)"], why: "Agarrar depende do acerto." })
];
