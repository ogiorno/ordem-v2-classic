// C03 — fichas 1418–1466 (Livro v1.3). Atenção: a extração do Espreitador (1466) traz também habilidades do Estrangeiro.
import { RANGE, ability, attackPointer, damage, dmg, effects, emanation, exec, fx, grants, heal, line, mental, req, requirements, save, self, sphereAt, tokens } from "./dsl.mjs";

export default [
	// --- Marionete 1418 ---
	ability("1418-H01", { state: "manual", gaps: ["detectar um ser ficando adjacente", "ataque de foice óssea (armament)", "uma vez por rodada"], why: "Reação que resulta em ataque armament." }),
	ability("1418-H02", { state: "manual", gaps: ["dois ataques com a foice óssea", "agarrar com a arma e deslocar 6 m", "dividir o dano sofrido com o ser agarrado"], why: "Sequência de ataques, agarrar e divisão de dano." }),

	// --- Múmia Xipófaga 1424 ---
	attackPointer("1424-H01", "Vomitar Lodo"),
	ability("1424-H02", { state: "manual", gaps: ["acerto da garra enfaixada e agarrar (teste 4d20+30)", "dano de Morte e cura da múmia no início de cada turno da vítima", "vítima a 0 PV vira esqueleto de Lodo"], why: "Agarrar com dano e cura recorrentes e transformação." }),
	ability("1424-H03", {
		state: "assisted",
		execution: exec([self(), damage(heal("200")), requirements(req.narrative("a múmia está com 0 PV e há um ser morto ou criatura de Morte adjacente para amalgamar"))]),
		gaps: ["passa a atacar três vezes com garras enfaixadas e +5 de dano por ataque", "segunda amalgamação: mais 200 PV, quatro ataques e +10 de dano"],
		why: "Cura de 200 PV da própria múmia; ataques extras e bônus de dano ficam com o Mestre."
	}),

	// --- Nidere 1431 ---
	ability("1431-H01", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), effects(fx("enjoado", "turns", 1, { onSave: "always" })), requirements(req.narrative("o ser sofreu dano das garras invertidas"))]),
		why: "Enjoado até o fim do próximo turno do alvo, após dano das garras invertidas confirmado pelo Mestre."
	}),
	ability("1431-H02", { state: "manual", gaps: ["+6d6 de dano em ataque contra seres desprevenidos"], why: "Bônus que se soma ao dano de um ataque armament." }),

	// --- Sempiternal 1436 ---
	ability("1436-H01", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("fortitude", 40, "half"), damage(dmg("20d6", "morte"))]),
		gaps: ["quem fica machucado pelo dano é infectado e recebe vulnerabilidade a Morte até o fim da cena", "quem chega a 0 PV vira um enraizado (p. 214)"],
		why: "Dano de Morte em área com Fortitude reduzindo à metade; infecção e transformação dependem dos PV restantes."
	}),

	// --- Succ 1439 ---
	ability("1439-H01", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("fortitude", 17), effects(fx("inconsciente", "unspecified")), requirements(req.narrative("a mordida do succ acertou o personagem"))]),
		gaps: ["no início do próximo turno do succ a vítima vai a 0 PV e fica morrendo", "o succ não age (só reações) e seu deslocamento cai a 3 m enquanto prende", "solta a vítima se sofrer 10 de dano ou mais na rodada"],
		why: "Fortitude e Inconsciente configurados; o desfecho no turno seguinte e as restrições do succ ficam com o Mestre."
	}),

	// --- O Deus da Morte 1444 ---
	ability("1444-H01", { state: "manual", gaps: ["acerto do soco espiral em ser Médio ou menor", "agarrar (teste 6d20+47)"], why: "Agarrar depende do acerto." }),
	ability("1444-H02", { state: "manual", gaps: ["encerrar até duas condições que afetam a própria criatura no início do turno"], why: "Remoção de condições da própria criatura." }),
	ability("1444-H03", { state: "manual", gaps: ["controlar criaturas de Morte em alcance longo", "fazê-las percorrer o deslocamento e atacar"], why: "Controle de outras criaturas." }),
	ability("1444-H04", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), damage(mental("3d20")), effects(fx("paralisado", "unspecified", null, { onSave: "always" })), requirements(req.narrative("o ser está agarrado pelo Deus da Morte"))]),
		gaps: ["o ser envelhece 3d20 anos (1 de dano mental por ano)"],
		why: "Dano mental igual aos anos envelhecidos (3d20) e Paralisado; o envelhecimento é narrativo."
	}),
	ability("1444-H05", {
		state: "automatic",
		execution: exec([sphereAt(12, RANGE.longo), save("fortitude", 45, "half"), damage(dmg("10d10+50", "morte"))]),
		why: "Espiral de 12 m de raio em alcance longo, dano de Morte e Fortitude reduzindo à metade."
	}),

	// --- Anjo 1454 ---
	ability("1454-H01", { state: "manual", gaps: ["acerto das asas do Conhecimento em ser Médio ou menor", "agarrar com as faixas (teste 5d20+45) e fascinar", "um ser agarrado por vez"], why: "Agarrar depende do acerto e acompanha condição." }),
	ability("1454-H02", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 43, "half"), damage(dmg("10d8", "conhecimento")), effects(fx("auréola reveladora", "scene", null, { onSave: "always" }))]),
		gaps: ["o anjo sabe onde estão os seres com auréola e ignora furtividade, invisibilidade e ilusões"],
		why: "Dano de Conhecimento em área; a auréola vira marcador até o fim da cena."
	}),
	ability("1454-H03", {
		state: "assisted",
		execution: exec([line(RANGE.longo, 3), save("reflexos", 43, "half"), damage(dmg("15d8+50", "conhecimento")), requirements(req.perScene(1))]),
		gaps: ["texto diz linha de 3 m em alcance longo: configurado 36 m de comprimento por 3 m de largura (conferir no livro)"],
		why: "Dano em linha com Reflexos reduzindo à metade, uma vez por cena; o tamanho da linha precisa de conferência."
	}),

	// --- Bicho-Papão 1461 ---
	ability("1461-H01", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("vontade", 30, "half"), damage(mental("3d8"))]),
		gaps: ["+3d8 de dano mental se o bicho-papão estiver escondido do alvo (ajustar o valor no painel)"],
		why: "Dano mental com Vontade reduzindo à metade; o bônus por esconderijo é aplicado pelo Mestre."
	}),
	ability("1461-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("vontade", 35, "half"), damage(mental("10d8")), requirements(req.narrative("o bicho-papão está escondido do ser"))]),
		gaps: ["sair do esconderijo, aproximar-se do ser e assumir a forma assustadora"],
		why: "Dano mental com Vontade reduzindo à metade; esconderijo e aproximação são do Mestre."
	}),

	// --- Espreitador 1466 (a extração inclui habilidades do Estrangeiro) ---
	ability("1466-H01", { state: "manual", gaps: ["teletransporte em alcance longo por uma fresta"], why: "Teleporte condicionado a frestas no cenário." }),
	ability("1466-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("vontade", 30, "half"), damage(mental("10d6")), requirements(req.perScene(1), req.narrative("o ser adjacente está dormindo"))]),
		gaps: ["se a vítima ficar enlouquecendo, o espreitador pode criar uma cópia observada"],
		why: "Dano mental com Vontade reduzindo à metade, uma vez por cena; o sono da vítima é confirmado pelo Mestre."
	}),
	ability("1466-H03", { state: "manual", gaps: ["manifestar a cópia de um ser enlouquecendo", "a cópia usa a ficha do ser, causa dano de Conhecimento e dura até o fim da cena"], why: "Criação de cópia de ficha." }),
	attackPointer("1466-H04", "Rajada Psíquica"),
	ability("1466-H05", {
		state: "assisted",
		execution: exec([tokens(null, 1), save("vontade", 35), effects(fx("ordem do Estrangeiro", "turns", 1)), requirements(req.narrative("o Estrangeiro causou dano ao ser com a rajada psíquica; seres com Intelecto 5 ou mais são imunes"))]),
		gaps: ["escolher a ordem: atacar um aliado, render-se ou fugir", "o ser obedece no próximo turno"],
		why: "Vontade e condição de obedecer à ordem; a ordem escolhida e a imunidade por Intelecto ficam com o Mestre."
	}),
	ability("1466-H06", { state: "manual", gaps: ["escolher entre controlar a vítima insana ou apagar a memória e devolver 1d4 de Sanidade"], why: "Escolha narrativa entre dois desfechos." }),
	ability("1466-H07", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("vontade", 30, "none", true), effects(fx("esquece o Estrangeiro", "untilSaved")), requirements(req.narrative("o ser sofreu dano do Toque Sutil"))]),
		gaps: ["ao passar no teste repetido o ser sofre 6d6 de dano mental", "quem incuba uma larva não repete o teste"],
		why: "Esquecimento até passar em Vontade (repetido no fim do turno); o dano ao passar e o caso da larva ficam com o Mestre."
	}),
	ability("1466-H08", { state: "manual", gaps: ["tocar ser adjacente alheio à presença", "larva: leitura da mente, 1d6 de dano mental no início de cada cena e eclosão a 0 de Sanidade"], why: "Efeito persistente por cena com acesso à mente." })
];
