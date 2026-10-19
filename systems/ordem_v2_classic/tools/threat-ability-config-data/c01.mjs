// C01 — fichas 1295–1358 (Livro v1.3). Cada entrada conferida contra a regra extraída (normalizedDescription).
import { RANGE, ability, attackPointer, damage, dmg, effects, emanation, exec, fx, grants, mental, req, requirements, save, tokens, triggerPart, self, heal } from "./dsl.mjs";

export default [
	// --- Aberração de Carne 1295 ---
	ability("1295-H01", { state: "manual", gaps: ["manobra agarrar (teste da criatura 3d20+12)", "limite de dois agarrados"], why: "Agarrar é manobra da criatura contra o alvo, sem resistência do alvo nem condição configurável pelo motor." }),
	ability("1295-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 2), save("fortitude", 15, "half"), damage(dmg("3d6", "perfuração")), requirements(req.narrative("os personagens estão agarrados pela aberração"))]),
		gaps: ["levar os agarrados para a boca", "repetir o dano no início de cada turno da aberração", "Atletismo DT 20 de quem tenta tirar o personagem"],
		why: "Dano e resistência configurados; o estado de agarrado e a repetição por turno ficam com o Mestre."
	}),

	// --- Aniquilação 1300 ---
	attackPointer("1300-H01", "Disparo De Espinhos"),
	ability("1300-H02", { state: "manual", gaps: ["manobra agarrar (teste 5d20+50)", "limite de quatro agarrados"], why: "Agarrar é manobra da criatura." }),
	ability("1300-H03", { state: "manual", gaps: ["detectar movimento de mais de 3 m em alcance curto", "ataque de tentáculos espinhentos (armament)"], why: "Evento de movimento não é detectável com segurança; resulta em ataque armament." }),
	ability("1300-H04", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 4), damage(dmg("40", "sangue")), triggerPart("turnStart", "self"), requirements(req.narrative("os personagens estão agarrados pelos tentáculos"))], { mode: "triggered" }),
		gaps: ["identificar quem está agarrado"],
		why: "Dano fixo no início do turno da Aniquilação; o Mestre indica os agarrados."
	}),
	ability("1300-H05", {
		state: "assisted",
		execution: exec([emanation(RANGE.longo), save("fortitude", 40, "half"), damage(mental("8d6")), effects(fx("atordoado", "rounds", 1))]),
		gaps: ["empurrar os personagens 6 m para longe da Aniquilação"],
		why: "Dano mental e Atordoado configurados (Fortitude reduz à metade e evita os efeitos); o empurrão é manual."
	}),
	ability("1300-H06", {
		state: "assisted",
		execution: exec([tokens(15, 20), save("reflexos", 30), effects(fx("agarrado", "untilSaved"), fx("asfixiado", "untilSaved"))]),
		gaps: ["deslocamento de 15 m e escolha dos personagens que ficam adjacentes no caminho", "escape: ação padrão + Reflexos DT 30"],
		why: "Condições e resistência configuradas; o deslocamento define quem é afetado e fica com o Mestre."
	}),
	ability("1300-H07", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("reflexos", 40, "half"), damage(dmg("20d6+20", "sangue")), requirements(req.perScene(1))]),
		gaps: ["a Aniquilação perde o disparo de espinhos até o fim da cena"],
		why: "Dano em área e limite por cena configurados; a perda do disparo é manual."
	}),

	// --- Carente 1311 ---
	ability("1311-H01", { state: "manual", why: "Mudança de forma e restrição narrativa de portas." }),
	ability("1311-H02", { state: "manual", gaps: ["detectar adjacência a dois ou mais seres", "ataque de tentáculo (armament)", "empurrar 6 m"], why: "Reação com ataque armament, condição Caído e empurrão." }),
	ability("1311-H03", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("fortitude", 35), effects(fx("debilitado", "scene"), fx("enjoado", "scene")), requirements(req.narrative("o alvo foi atingido pelo ferrão de sangue"))]),
		why: "Condições até o fim da cena (Fortitude evita); o acerto do ferrão é confirmado pelo Mestre."
	}),
	ability("1311-H04", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("reflexos", 25), effects(fx("paralisado", "permanent"))]),
		gaps: ["manter o abraço indefinidamente", "soltar o alvo ao sofrer dano de Energia"],
		why: "Paralisado (Reflexos evita) configurado; a duração depende de soltar o alvo."
	}),

	// --- Dama de Sangue 1318 ---
	ability("1318-H01", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("reflexos", 15, "negate"), damage(dmg("2d6", "impacto")), effects(fx("caído", "permanent"))]),
		gaps: ["escolher o ponto de destino do arremesso (alcance curto)"],
		notes: ["A flor rosa murcha com fertilizante: a dama perde esta habilidade e sofre -d20 em Luta."],
		why: "Dano, queda e resistência (evita todo o efeito) configurados; o destino do arremesso é manual."
	}),
	ability("1318-H02", {
		state: "automatic",
		execution: exec([emanation(RANGE.curto), save("fortitude", 15, "half"), damage(dmg("4d4", "químico"))]),
		notes: ["A flor vermelha murcha com agrotóxico: a dama perde a habilidade e reduz suas resistências a dano em 5."],
		why: "Dano químico em área com Fortitude reduzindo à metade: totalmente configurado."
	}),
	ability("1318-H03", {
		state: "automatic",
		execution: exec([tokens(RANGE.medio, 3), save("reflexos", 15, "half"), damage(dmg("2d8", "perfuração"))]),
		notes: ["A flor amarela murcha após 10 de dano de fogo de um único efeito: perde a habilidade e -d20 em Reflexos."],
		why: "Até três alvos em alcance médio, dano e resistência explícitos."
	}),
	ability("1318-H04", {
		state: "assisted",
		execution: exec([emanation(RANGE.curto), save("vontade", 15, "none", true), effects(fx("confuso", "untilSaved"))]),
		notes: ["A flor roxa murcha em contato com bravo purpulis: perde a habilidade e -d20 em Vontade."],
		why: "Confuso não tem mecânica no sistema (marcador); novas tentativas de Vontade no fim do turno do alvo."
	}),
	ability("1318-H05", {
		state: "automatic",
		execution: exec([emanation(RANGE.curto), save("fortitude", 15), effects(fx("enjoado", "rounds", "1d4+1", { onSave: "fail" }), fx("enjoado", "rounds", 1, { onSave: "success" }))]),
		notes: ["A flor azul murcha com dano de eletricidade ou Energia: perde a habilidade e reduz o deslocamento em 6 m."],
		why: "Enjoado por 1d4+1 rodadas; quem passa em Fortitude fica 1 rodada: dois efeitos condicionados ao resultado."
	}),
	ability("1318-H06", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), effects(fx("agarrado", "permanent", null, { onSave: "always" }))]),
		gaps: ["os tentáculos têm 20 PV, são acertados automaticamente e libertam o alvo ao serem destruídos"],
		notes: ["A flor verde murcha se molhada em água corrente: perde a habilidade e reduz a Defesa em 5."],
		why: "Agarrado sem resistência; o controle dos tentáculos fica com o Mestre."
	}),
	ability("1318-H07", {
		state: "automatic",
		execution: exec([emanation(RANGE.medio), save("vontade", 15, "half"), damage(mental("1d6"))]),
		notes: ["A flor laranja murcha após 10 de dano de corte de um único efeito: perde a habilidade e reduz os PV totais em 20."],
		why: "Dano mental (SAN) em área, Vontade reduz à metade."
	}),

	// --- Enpap-X 1329 ---
	attackPointer("1329-H01", "Correntes"),
	ability("1329-H02", { state: "manual", gaps: ["acertar correntes em personagem Médio ou menor e agarrar à distância (teste 2d20+17)", "estrangular os agarrados no início do turno (4d6 impacto)", "limite de dois agarrados"], why: "Agarrar à distância e dano recorrente dependem do acerto." }),
	ability("1329-H03", { state: "manual", gaps: ["acerto crítico de socão ou corrente", "derrubar ou empurrar 3 m"], why: "Reação a acerto crítico com movimento forçado." }),
	ability("1329-H04", { state: "manual", gaps: ["bônus cumulativo +1d6 nas próximas rolagens de dano até o fim do turno"], why: "Bônus de dano cumulativo por acerto: o motor não acumula bônus entre ataques." }),
	ability("1329-H05", {
		state: "assisted",
		execution: exec([emanation(RANGE.curto), save("vontade", 25, "half"), damage(mental("4d6")), grants({ ref: "marcas-do-terror-imune", onSave: "success" })]),
		gaps: ["quem passa no teste fica imune a esta habilidade até o fim da cena"],
		why: "Dano mental em área; a imunidade por cena é registrada como vínculo para o Mestre conferir."
	}),

	// --- Kerberos 1337 ---
	attackPointer("1337-H01", "Disparo De Espinhos"),
	ability("1337-H02", { state: "manual", gaps: ["reduzir os PV do personagem a 0 com a mordida", "recuperar PV iguais à metade dos PV totais da vítima"], why: "Cura depende dos PV totais da vítima e do resultado da mordida." }),
	ability("1337-H03", { state: "manual", gaps: ["manobra derrubar (teste 5d20+45)", "três ataques de mordida com dano 4d12+40"], why: "Manobra seguida de ataques armament." }),

	// --- Minotauro 1343 ---
	ability("1343-H01", { state: "manual", gaps: ["investida com chifres e acerto", "agarrado enquanto cravado", "4d12+20 sangue no fim de cada turno da vítima"], why: "Depende do acerto da investida e do dano recorrente por turno da vítima." }),

	// --- Mulher Afogada 1349 ---
	attackPointer("1349-H01", "Jato De Sangue"),
	ability("1349-H02", {
		state: "assisted",
		execution: exec([self(), damage(heal("40")), requirements(req.narrative("um personagem adjacente morreu nesta cena e o corpo está ao alcance"))]),
		why: "Cura fixa de 40 PV da própria criatura; o Mestre confirma o corpo adjacente."
	}),
	ability("1349-H03", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), effects(fx("asfixiado", "untilSaved", null, { onSave: "always" }))]),
		gaps: ["Fortitude DT 24 no início de cada turno do alvo encerra a condição e expele a mulher afogada"],
		why: "Asfixiado sem teste inicial; o teste recorrente de Fortitude (DT 24) é manual."
	}),
	ability("1349-H04", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), damage(dmg("6d6", "sangue")), effects(fx("fraco", "unspecified", null, { onSave: "always" })), triggerPart("manual", "any"), requirements(req.narrative("a mulher afogada foi arrancada de um corpo que ela asfixiava com Afogar Em Sangue"))], { mode: "triggered" }),
		why: "Dano de sangue e condição Fraco (duração não informada no texto); o evento de ser arrancada é do Mestre."
	}),
	ability("1349-H05", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), damage(dmg("6d6", "sangue")), effects(fx("enjoado", "unspecified", null, { onSave: "always" })), requirements(req.narrative("o personagem está sendo asfixiado por Afogar Em Sangue"))]),
		why: "Dano de sangue e Enjoado (duração não informada); o vínculo com Afogar Em Sangue é confirmado pelo Mestre."
	}),

	// --- Titã de Sangue 1358 ---
	ability("1358-H01", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), save("reflexos", 30, "half"), damage(dmg("4d12+10", "perfuração")), effects(fx("sangrando", "scene")), requirements(req.narrative("o titã acertou o alvo com a mordida"))]),
		why: "Dano e Sangrando até o fim da cena; Reflexos reduz o dano à metade e evita a condição. O acerto da mordida é confirmado pelo Mestre."
	})
];
