// C05 — fichas 1526–1575 (Livro v1.3). A ficha 1537 tem comportamento aleatório por tabela (manual).
import { RANGE, ability, attackPointer, damage, dmg, effects, emanation, exec, fx, grants, heal, mental, req, requirements, save, self, tokens, triggerPart } from "./dsl.mjs";

export default [
	// --- Anárquico Descontrolado 1526 ---
	ability("1526-H01", { state: "manual", gaps: ["estado de aceleração após dano da pancada energética", "4d12 de dano de Energia se, no próximo turno, o personagem fizer movimento + padrão ou ação completa"], why: "Efeito atrasado que depende das ações escolhidas pelo personagem no turno seguinte." }),
	ability("1526-H02", {
		state: "assisted",
		execution: exec([emanation(RANGE.curto), save("reflexos", 25, "half"), damage(dmg("8d12", "energia"))]),
		gaps: ["personagens adjacentes sofrem -d20d20 neste teste de resistência", "o anárquico descontrolado morre após usar esta habilidade"],
		why: "Dano de Energia em área com Reflexos reduzindo à metade; o redutor dos adjacentes e a morte da criatura ficam com o Mestre."
	}),

	// --- Anomalia 1531 ---
	ability("1531-H01", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("vontade", 41, "half"), damage(mental("10d6")), triggerPart("turnStart", "self"), requirements(req.narrative("o ser sorteado está na linha de visão da anomalia"))], { mode: "triggered" }),
		gaps: ["sortear um ser na linha de visão no início do turno", "se a vítima ficar insana, é absorvida pela anomalia"],
		why: "Dano mental com Vontade reduzindo à metade no início do turno da anomalia; o sorteio e a absorção ficam com o Mestre."
	}),
	ability("1531-H02", { state: "manual", gaps: ["ativar, desativar ou operar até seis objetos tecnológicos em alcance médio", "alternativa: sobrecarregar objetos causando 2d12 de Energia por objeto na área (Reflexos DT 30 reduz à metade)"], why: "Efeito alternativo com número de objetos e área variáveis no cenário." }),
	ability("1531-H03", { state: "manual", gaps: ["invocar criaturas de Energia com VD total até 240 em alcance curto"], why: "Invocação de criaturas." }),

	// --- Anomiático 1537 ---
	ability("1537-H01", { state: "manual", gaps: ["rolar 1d6 três vezes na tabela de comportamentos", "executar as ações sorteadas (salto, facho de Energia, explosão por distância etc.)", "resistências +10 por ação perdida"], why: "Comportamento aleatório por tabela, com ações de movimento, ataque e explosão por distância." }),

	// --- Ciborgue 1541 ---
	ability("1541-H01", { state: "manual", gaps: ["avançar até 24 m e atacar com o punho energizado (+d20)", "+2d8 de dano e derrubar o alvo (Fortitude DT 20 evita a queda)"], why: "Movimento seguido de ataque armament com efeito condicionado ao acerto." }),
	attackPointer("1541-H02", "Canhão"),
	attackPointer("1541-H03", "Raio Energético"),
	ability("1541-H04", {
		state: "assisted",
		execution: exec([self(), effects(fx("barreira paranormal", "turns", 1, { onSave: "always", target: "self" }))]),
		gaps: ["+5 de Defesa até o início do próximo turno (aplicar na Defesa manualmente)"],
		why: "Marcador de barreira até o próximo turno; o bônus de Defesa não é um efeito mecânico do sistema."
	}),
	ability("1541-H05", { state: "manual", gaps: ["encerrar uma condição que afete o ciborgue"], why: "Remoção de condição da própria criatura." }),
	ability("1541-H06", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("vontade", 20), effects(fx("alquebrado", "unspecified")), requirements(req.narrative("o ser sofreu dano do raio energético"))]),
		gaps: ["se o ser já estiver alquebrado, fica atordoado por uma rodada"],
		why: "Alquebrado com Vontade evitando; a escalada para atordoado fica com o Mestre."
	}),

	// --- Infecticídio 1552 ---
	ability("1552-H01", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("fortitude", 30), effects(fx("infectado", "unspecified")), grants({ ref: "infeccao-imune", onSave: "success" }), requirements(req.narrative("o ser sofreu dano das pancadas infectadas"))]),
		gaps: ["o vírus do infecticídio (livro, p. 292)", "quem passa fica imune a esta doença até o fim da cena"],
		why: "Infectado com Fortitude evitando; a doença e a imunidade por cena ficam com o Mestre."
	}),
	ability("1552-H02", {
		state: "assisted",
		execution: exec([self(), damage(heal("50")), requirements(req.narrative("as pancadas infectadas reduziram um ser a 0 PV"))]),
		why: "Cura fixa de 50 PV da própria criatura, depois de reduzir um ser a 0 PV."
	}),
	ability("1552-H03", { state: "manual", gaps: ["percorrer até o dobro do deslocamento passando pelo espaço de outros seres", "um ataque de pancada infectada contra cada ser no caminho"], why: "Deslocamento com ataques armament contra cada ser." }),

	// --- Perturbado de Energia 1559 ---
	ability("1559-H01", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("vontade", 15, "half"), damage(mental("2d8")), effects(fx("vulnerabilidade a dano de Energia", "scene", null, { onSave: "always" })), requirements(req.perRound(1), req.narrative("o personagem acabou de sofrer dano do toque plasmático e foi agarrado (teste 4d20+10)"))]),
		gaps: ["agarrar o personagem (teste 4d20+10)"],
		why: "Dano mental, Vontade reduzindo à metade e vulnerabilidade até o fim da cena; o agarrar é do Mestre."
	}),

	// --- Sukkalgir 1562 ---
	ability("1562-H01", { state: "manual", gaps: ["acerto da mordida em ser Médio ou menor", "agarrar (teste 3d20+15)"], why: "Agarrar depende do acerto." }),
	ability("1562-H02", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 20, "half"), damage(mental("3d12"))]),
		gaps: ["quem está sob cobertura ganha +5 nesse teste de resistência"],
		why: "Dano mental em área com Vontade reduzindo à metade; o bônus de cobertura é aplicado pelo Mestre."
	}),

	// --- Telopsia 1569 ---
	ability("1569-H01", { state: "manual", gaps: ["desmaterializar e materializar em outra tela ou visor em alcance longo", "deslocar 9 m em seguida"], why: "Teleporte entre telas do cenário." }),
	ability("1569-H02", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 30, "half"), damage(mental("6d6")), effects(fx("confuso", "scene"))]),
		gaps: ["quem já estiver confuso e falhar no teste também fica fascinado"],
		why: "Dano mental e Confuso até o fim da cena (Vontade reduz o dano e evita a condição); a escalada para fascinado fica com o Mestre."
	}),
	ability("1569-H03", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("fortitude", 30), effects(fx("paralisado", "untilSaved"))]),
		gaps: ["2d12 de dano mental no início de cada turno do ser preso", "o ser repete Fortitude cada vez que o telopsia sofre 50 ou mais de dano em um turno e, se passar, escapa para um ponto adjacente"],
		why: "Paralisado dentro da tela com Fortitude evitando; o dano por turno e a repetição do teste ficam com o Mestre."
	}),

	// --- Tempestuoso 1575 ---
	ability("1575-H01", { state: "manual", gaps: ["a extração não separou o ataque Garras Radioativas (corpo a corpo x2, 5d20+40, dano 4d20+20 de Energia, alcança alvos em alcance curto)"], why: "Ação que descreve um ataque armament ausente da extração." }),
	ability("1575-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.medio, 1), save("reflexos", 40, "half"), damage(dmg("4d20+20", "energia")), requirements(req.narrative("o tempestuoso acertou dois ataques de garras radioativas no mesmo ser"))]),
		gaps: ["o raio parte do ser atingido em direção ao alvo escolhido"],
		why: "Dano de Energia com Reflexos reduzindo à metade; o acerto duplo e a origem do raio são do Mestre."
	}),
	ability("1575-H03", {
		state: "assisted",
		execution: exec([emanation(RANGE.longo), save("reflexos", 40, "half"), damage(dmg("10d20+20", "energia"))]),
		gaps: ["o próprio tempestuoso perde 100 PV ao usar esta habilidade (aplicar na ficha dele)"],
		why: "Dano de Energia em área com Reflexos reduzindo à metade; a perda de 100 PV da criatura é aplicada pelo Mestre."
	})
];
