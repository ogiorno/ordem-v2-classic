// C06 — fichas 1581–1608 (Livro v1.3). A ficha 1597 não tem habilidade separada na extração.
import { RANGE, ability, attackPointer, cone, damage, dmg, effects, emanation, exec, fx, mental, req, requirements, save, tokens } from "./dsl.mjs";

export default [
	// --- Viajante 1581 ---
	ability("1581-H01", { state: "manual", gaps: ["acerto da pancada em ser Médio ou menor", "agarrar (teste 2d20+15)"], why: "Agarrar depende do acerto." }),
	ability("1581-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("vontade", 29, "half"), damage(mental("4d12")), effects(fx("esquece uma pessoa", "unspecified")), requirements(req.narrative("o ser está agarrado pelo viajante"))]),
		gaps: ["para cada ser perturbado, o dano de pancada do viajante aumenta em +1d12 até o fim da cena"],
		why: "Dano mental e esquecimento (Vontade reduz o dano e evita o efeito); o ser agarrado é confirmado e o aumento de dano é do Mestre."
	}),

	// --- Anfitrião 1585 ---
	ability("1585-H01", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("vontade", 45, "negate"), damage(mental("10d6"))]),
		gaps: ["alternativa de resistência do alvo: Artes DT 35 (recitar o texto com perfeição)"],
		why: "Dano mental evitado por Vontade; o alvo também pode escolher Artes DT 35, decidido pelo Mestre."
	}),
	ability("1585-H02", {
		state: "automatic",
		execution: exec([cone(RANGE.medio), save("reflexos", 45, "half"), damage(dmg("10d6+20", "energia"))]),
		why: "Cone em alcance médio com dano de Energia e Reflexos reduzindo à metade."
	}),
	ability("1585-H03", { state: "manual", gaps: ["acerto do golpe caótico", "escolher outro ser que consiga ver", "os dois seres decidem quem sofre o dano antes de ele ser definido"], why: "Redirecionamento do dano de um ataque, negociado entre os alvos." }),
	ability("1585-H04", { state: "manual", gaps: ["+4d12 de dano de Energia em ataque de lança e adaga contra ser desprevenido ou flanqueado"], why: "Bônus de dano que se soma a um ataque armament." }),
	ability("1585-H05", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("fortitude", 35, "none", true), effects(fx("asfixiado", "untilSaved")), requirements(req.narrative("o ser sofreu dano de corte de água"))]),
		why: "Asfixiado com Fortitude evitando e novos testes no fim de cada turno do alvo, após o dano de corte de água confirmado pelo Mestre."
	}),
	ability("1585-H06", { state: "manual", gaps: ["transportar-se para outro ponto em alcance médio"], why: "Teleporte para outro ponto em alcance médio, sem alvo nem resistência." }),

	// --- Bandido VD 10 1602 / Capanga VD 20 1603 / Soldado de Aluguel VD 40 1604 / Assassino VD 80 1605 ---
	ability("1602-H01", { state: "manual", gaps: ["+1d6 de dano uma vez por rodada em ataques contra alvos desprevenidos ou flanqueados"], why: "Bônus de dano que se soma a ataques armament." }),
	ability("1603-H01", { state: "manual", gaps: ["+2d6 de dano uma vez por rodada em ataques contra alvos desprevenidos ou flanqueados"], why: "Bônus de dano que se soma a ataques armament." }),
	ability("1604-H01", { state: "manual", gaps: ["percorrer o deslocamento e atacar em qualquer ponto do movimento"], why: "Movimento combinado com ataques armament." }),
	ability("1605-H01", { state: "manual", gaps: ["passar em Reflexos contra ataque que reduz o dano à metade evita todo o dano"], why: "Passiva que altera o resultado de testes de outros efeitos." }),
	ability("1605-H02", { state: "manual", gaps: ["+4d6 de dano uma vez por rodada em ataques contra alvos desprevenidos ou flanqueados"], why: "Bônus de dano que se soma a ataques armament." }),
	ability("1605-H03", { state: "manual", gaps: ["ataque corpo a corpo furtivo contra pessoa desprevenida", "agarrar (teste 2d20+15) impedindo de falar"], why: "Agarrar depende de ataque furtivo." }),
	ability("1605-H04", { state: "manual", gaps: ["analisar ser em alcance curto", "dobrar os dados extras do próximo Ataque Furtivo até o fim do próximo turno"], why: "Modifica o dano de outra habilidade em um turno futuro." }),

	// --- Comandante Mercenário VD 120 1606 ---
	ability("1606-H01", { state: "manual", gaps: ["após causar dano em um inimigo, o próximo ataque ganha +d20 e um dado de dano extra"], why: "Passiva que encadeia bônus entre ataques consecutivos." }),
	ability("1606-H02", { state: "manual", gaps: ["a extração do texto está truncada; remete a Ataque Em Movimento"], why: "Texto extraído incompleto; conferir na fonte." }),
	ability("1606-H03", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio, "threat"), effects(fx("ordens", "scene", null, { onSave: "always" }))]),
		gaps: ["os aliados recebem +d20 em testes de perícia e causam mais um dado de dano do mesmo tipo (aplicar manualmente)"],
		why: "Marcador de ordens nos aliados em alcance médio até o fim da cena; os bônus de d20 e dano são aplicados pelo Mestre."
	}),

	// --- Iniciado VD 20 1608 ---
	ability("1608-H01", { state: "manual", gaps: ["conjurar dois rituais de 1º círculo de um elemento sem custo de PE (até 3 PE), DT 15"], why: "Ritual conjurado por ameaça tem fluxo próprio (fora desta spec)." }),
	ability("1608-H02", { state: "manual", gaps: ["a extração trata o ataque Faca (corpo a corpo, d20, crítico 19, dano 1d4+1 de corte) como passiva"], why: "Descrição de ataque armament classificada como habilidade na extração." })
];
