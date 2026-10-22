// C04 — fichas 1479–1522 (Livro v1.3). A ficha 1522 não tem habilidade separada na extração.
import { RANGE, ability, damage, dmg, effects, emanation, exec, fx, mental, req, requirements, save, tokens } from "./dsl.mjs";

export default [
	// --- Existido 1479 (a extração junta Brilho Enlouquecedor e Fortalecimento Paranormal) ---
	ability("1479-H01", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 14, "half"), damage(mental("1d6")), requirements(req.perRound(1))]),
		gaps: ["só afeta seres capazes de ver o existido (linha de visão)", "o texto extraído inclui também Fortalecimento Paranormal (movimento): +d20 em testes de Agilidade, Força e Vigor e +2d4 de Conhecimento nas pancadas, só depois de causar dano mental com o Brilho: separar na conferência da fonte"],
		why: "Brilho Enlouquecedor (dano mental em área, uma vez por rodada) configurado; a visão e o Fortalecimento Paranormal ficam com o Mestre."
	}),

	// --- Lembrado 1483 ---
	ability("1483-H01", {
		state: "automatic",
		execution: exec([emanation(RANGE.curto), save("vontade", 20, "half"), damage(mental("6d6"))]),
		why: "Aura em alcance curto com dano mental e Vontade reduzindo à metade."
	}),
	ability("1483-H02", { state: "manual", gaps: ["o texto extraído é o bloco de resistências (balístico, corte e impacto 10), não uma habilidade"], why: "Resistências a dano já pertencem à ficha da criatura; conferir a fonte antes de tratar como habilidade." }),

	// --- Ocioso 1486 ---
	ability("1486-H01", { state: "manual", gaps: ["detectar ser atacado ou alvo de habilidade", "teletransporte até ficar adjacente do atacante", "ataque corpo a corpo 5d20+30 (dano 4d10+20 de impacto não letal)"], why: "Reação com teleporte e ataque armament." }),
	ability("1486-H02", { state: "manual", gaps: ["teletransporte para qualquer ponto no campo de visão do alvo", "uma vez por rodada"], why: "Teleporte condicionado ao campo de visão." }),
	ability("1486-H03", {
		state: "automatic",
		execution: exec([tokens(RANGE.adjacente, 1), damage(mental("4d10+10"))]),
		why: "Dano mental fixo ao alvo adjacente, sem resistência."
	}),

	// --- Parasita de Culpa 1493 ---
	ability("1493-H01", { state: "manual", gaps: ["a extração não separou o ataque Pancada (corpo a corpo, d20, dano 1d4 de impacto)"], why: "Ação que descreve um ataque armament ausente da extração." }),
	ability("1493-H02", { state: "manual", gaps: ["teste de Percepção do alvo (penalidade por dormir) oposto à Furtividade 2d20+15 do parasita", "quem falha vira hospedeiro"], why: "Teste oposto, não uma resistência com DT." }),
	ability("1493-H03", {
		state: "assisted",
		execution: exec([tokens(null, 20), save("vontade", 20, "half"), damage(mental("2d6")), requirements(req.narrative("o parasita está fixado a um hospedeiro; os seres atingidos estão dentro do sonho"))]),
		gaps: ["escolher os seres dentro do sonho", "repetir no início de cada cena do sonho"],
		why: "Dano mental com Vontade reduzindo à metade; quem está no sonho e a repetição por cena ficam com o Mestre."
	}),
	ability("1493-H04", { state: "manual", gaps: ["manifestar até quatro cópias (20 PV, dano de Conhecimento)", "dentro do sonho usa a Presença do parasita e causa dano mental"], why: "Criação de cópias." }),

	// --- Rastejador Sombrio 1501 ---
	ability("1501-H01", { state: "manual", gaps: ["dano mental igual ao dano sofrido do toque da dor (valor variável)", "Vontade DT 25 reduz o dano mental à metade"], why: "O dano depende do valor de outro dano; o motor exige fórmula explícita." }),
	ability("1501-H02", { state: "manual", gaps: ["+10 em Furtividade e sem redução de deslocamento até o início do próximo turno, sob cobertura ou camuflagem"], why: "Bônus de perícia na própria criatura." }),
	ability("1501-H03", {
		state: "assisted",
		execution: exec([tokens(RANGE.medio, 3), save("reflexos", 28), effects(fx("agarrado", "untilSaved"))]),
		gaps: ["arrastar até três vítimas para outros pontos em alcance médio (ação de movimento)", "4d6 de dano mental no fim de cada turno do agarrado", "soltar-se como normal no turno do ser"],
		why: "Até três alvos agarrados com Reflexos evitando; arrastar e o dano mental por turno ficam com o Mestre."
	}),

	// --- Silhueta 1507 ---
	ability("1507-H01", { state: "manual", gaps: ["transformar objetos em alcance curto em outros do mesmo tamanho"], why: "Alteração de objetos do cenário." }),
	ability("1507-H02", { state: "manual", gaps: ["dano da aura tangível não informado nesta habilidade", "tocar até dois seres e/ou objetos"], why: "O dano remete à aura da criatura e não está escrito aqui." }),

	// --- Vulto 1511 ---
	ability("1511-H01", {
		state: "assisted",
		execution: exec([emanation(RANGE.medio), save("vontade", 15), effects(fx("abalado", "unspecified"))]),
		gaps: ["quem já estiver abalado fica apavorado", "-d20 no teste de Vontade se o vulto estiver escondido"],
		why: "Abalado com Vontade evitando; a escalada para apavorado e o redutor por esconderijo ficam com o Mestre."
	}),

	// --- Máscara do Desespero 1515 ---
	ability("1515-H01", { state: "manual", gaps: ["conjurar ritual de Conhecimento de qualquer círculo (execução até ação completa, custo até 20 PE, DT 45)"], why: "Ritual conjurado por ameaça tem fluxo próprio (fora desta spec)." }),
	ability("1515-H02", { state: "manual", gaps: ["deslocamento a qualquer local com sombra ou escuridão", "onisciência sobre a Realidade"], why: "Deslocamento e percepção globais." }),
	ability("1515-H03", {
		state: "assisted",
		execution: exec([tokens(RANGE.medio, 1), save("vontade", 45, "half"), damage(dmg("10d6", "conhecimento"), mental("10d6")), effects(fx("condição à escolha do Mestre", "unspecified"))]),
		gaps: ["contra objetos: mudar composição, posição e estado de objeto de até 1 tonelada (Reflexos DT 45 do portador)", "escolher a condição (exceto morrendo e enlouquecendo)"],
		why: "Contra seres: dois danos com Vontade reduzindo cada um à metade e evitando a condição; a condição escolhida e o efeito sobre objetos ficam com o Mestre."
	})
];
