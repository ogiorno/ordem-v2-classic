// C02 — fichas 1363–1413 (Livro v1.3). Fichas 1363, 1366 e 1404 não têm habilidade separada na extração.
import { RANGE, ability, attackPointer, cubeAt, damage, dmg, effects, emanation, exec, fx, grants, line, mental, req, requirements, save, tokens, triggerPart } from "./dsl.mjs";

export default [
	// --- O Diabo 1369 ---
	attackPointer("1369-H01", "Arma Sangrenta"),
	ability("1369-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), damage(dmg("10d6", "sangue")), requirements(req.perRound(2), req.narrative("causou dano com a arma sangrenta ou tocou uma ferida do personagem"))]),
		notes: ["O texto diz duas vezes por turno; o limite é contado por rodada (a criatura age uma vez por rodada)."],
		why: "Dano de sangue fixo, até duas vezes por turno; a condição de contato direto é confirmada pelo Mestre."
	}),
	ability("1369-H03", { state: "manual", gaps: ["acerto do chifre", "chifre preso e vulnerabilidade a Sangue até removê-lo", "remover custa ação padrão e causa 8d8 de Sangue"], why: "Efeito em duas etapas (prender e remover) com vulnerabilidade a um tipo de dano." }),
	ability("1369-H04", { state: "manual", gaps: ["deslocamento através do sangue"], why: "Teleporte condicionado a sangue exposto." }),
	ability("1369-H05", { state: "manual", gaps: ["invocar e controlar criaturas de Sangue (VD total até 400)", "uma vez por cena"], why: "Invocação de criaturas." }),
	ability("1369-H06", {
		state: "assisted",
		execution: exec([tokens(null, 1), damage(mental("10d6")), requirements(req.narrative("o alvo aceitou o pacto de Sangue"))]),
		gaps: ["enlouquecer vira servo obcecado do Diabo", "cumprir o que foi prometido no pacto"],
		why: "Dano mental ao aceitar o pacto; alcance não informado e consequências narrativas ficam com o Mestre."
	}),
	ability("1369-H07", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 45), effects(fx("fúria de Sangue", "unspecified")), grants({ ref: "desejos-de-sangue-imune", onSave: "success" })]),
		gaps: ["os afetados atacam outro personagem em alcance curto à escolha do Diabo", "usam a ação de maior potencial de dano e não conjuram rituais", "imunidade até o fim da cena para quem passa"],
		why: "Condição e Vontade configuradas; o comportamento forçado e a imunidade ficam com o Mestre."
	}),

	// --- Aracnasita 1381 ---
	ability("1381-H01", {
		state: "assisted",
		execution: exec([tokens(RANGE.adjacente, 1), damage(dmg("1d10", "morte")), effects(fx("agarrado", "untilSaved", null, { onSave: "always" })), requirements(req.narrative("a mordida causou dano ao alvo"))]),
		gaps: ["soltar-se: ação padrão e Atletismo DT 20 (aliados adjacentes podem soltar)"],
		why: "Dano adicional e Agarrado; o escape por Atletismo é manual."
	}),
	ability("1381-H02", { state: "manual", gaps: ["reação ao ficar machucada", "efeitos por turno (dano mental e de Morte em alcance curto, depois médio)", "aranhas viram nova aracnasita"], why: "Zona persistente por turnos com sequência de efeitos e invocação." }),
	ability("1381-H03", {
		state: "assisted",
		execution: exec([cubeAt(3, RANGE.curto), save("reflexos", 20), effects(fx("agarrado", "scene"))]),
		gaps: ["personagens que entram na teia depois", "2d8+10 de Morte a quem inicia o turno agarrado", "escapar: 15 de dano de corte na teia ou ação padrão e Atletismo DT 20"],
		why: "Área quadrada de 3 m e Agarrado até o fim da cena; o dano por turno e o escape ficam com o Mestre."
	}),

	// --- Carniçal Preto da Morte 1389 ---
	ability("1389-H01", { state: "manual", gaps: ["acerto crítico com a garra da Morte", "empurrar 6 m em qualquer direção", "4d6 de impacto ao colidir"], why: "Reação a crítico com empurrão e colisão." }),
	ability("1389-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("vontade", 29), effects(fx("comando", "unspecified"))]),
		gaps: ["o efeito é um dos efeitos básicos do ritual Perturbação (livro, p. 137)"],
		why: "Vontade configurada; o comando em si é descrito pelo Mestre."
	}),
	ability("1389-H03", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("vontade", 29, "none", true), effects(fx("hipnotizado", "untilSaved"))]),
		gaps: ["controle telepático total (o alvo fica sob o Mestre)", "até três seres hipnotizados por vez", "bônus cumulativo de +1 a cada novo teste de Vontade no fim do turno", "alvo enlouquecendo falha automaticamente e fica sob domínio permanente"],
		why: "Hipnotizado com Vontade e novas tentativas; bônus cumulativo, limite de seres e controle ficam com o Mestre."
	}),
	ability("1389-H04", { state: "manual", gaps: ["reanimar até 2d4+2 corpos em alcance médio", "uma vez por cena", "usar a ficha do esqueleto de Lodo"], why: "Invocação de corpos reanimados." }),

	// --- Ceifador Espiral 1398 ---
	ability("1398-H01", { state: "manual", gaps: ["teleporte dentro da área de Cinzas das Terras Desoladas", "ataque com a foice da Morte como ação livre"], why: "Movimento especial dependente de outra habilidade, seguido de ataque armament." }),
	ability("1398-H02", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 43, "half"), damage(mental("10d10+30")), grants({ ref: "contemplar-a-espiral-imune", onSave: "always" })]),
		gaps: ["só afeta seres que consigam vê-lo (linha de visão)", "quem sofreu dano fica imune até o fim da cena"],
		why: "Dano mental em área com Vontade reduzindo à metade; visão e imunidade por cena ficam com o Mestre."
	}),
	ability("1398-H03", {
		state: "assisted",
		execution: exec([emanation(RANGE.longo), save("fortitude", 43, "half"), damage(dmg("10d10+20", "morte")), effects(fx("enjoado", "unspecified"))]),
		gaps: ["a área persiste: quem termina o turno dentro sofre 20 de Morte", "duração de Enjoado não informada"],
		why: "Dano e Enjoado (Fortitude reduz o dano e evita a condição); a zona persistente é manual."
	}),

	// --- Escutado 1408 ---
	attackPointer("1408-H01", "Cabeça Arremessada"),
	ability("1408-H02", {
		state: "assisted",
		execution: exec([tokens(RANGE.curto, 1), save("reflexos", 25, "half"), damage(dmg("4d10+10", "morte")), effects(fx("lento", "scene")), requirements(req.perScene(1), req.narrative("na primeira rodada após a cópia ser manifestada"))]),
		why: "Dano, Lento até o fim da cena e limite por cena; a janela da primeira rodada após manifestar é confirmada pelo Mestre."
	}),

	// --- Esqueleto de Lodo 1413 ---
	ability("1413-H01", {
		state: "assisted",
		execution: exec([line(9, 1.5), save("reflexos", 14, "half"), damage(dmg("2d10", "morte"))]),
		gaps: ["largura da linha não informada (usa 1,5 m)", "o esqueleto se desloca até 9 m e se reforma no fim do trajeto"],
		why: "Dano em linha de 9 m com Reflexos reduzindo à metade; largura e deslocamento são do Mestre."
	})
];
