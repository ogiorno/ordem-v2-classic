// X01 — Desalento (compêndio local, packs/_source/threats/desalento.json): o primeiro caso integrado da spec.
// Valores do pacote local; não afirmam que constem do livro básico (spec §6).
import { RANGE, ability, damage, effects, emanation, exec, fx, grants, line, mental, req, requirements, save, tokens, triggerPart, dmg } from "./dsl.mjs";

export default [
	ability("X-desalento-H01", {
		state: "assisted",
		execution: exec([emanation(RANGE.curto), save("vontade", 20, "half", true), damage(mental("2d6")), effects(fx("frustrado", "scene"), fx("lento", "scene")), grants({ ref: "falsa-nostalgia", onSave: "always" }), triggerPart("manual", "any")], { mode: "triggered" }),
		gaps: ["o evento que dispara a passiva não está definido no texto: o Mestre aciona", "novo teste de Vontade a cada rodada para retirar as condições (registrado como nova tentativa; o Mestre remove as condições)"],
		notes: ["Quem sofre o efeito fica vinculado à habilidade (Absorver Memórias e Fascínio pelo Lazer dependem disso)."],
		why: "Perda de SAN em área, Vontade DT 20 (metade do dano e anula as condições), Frustrado e Lento como marcadores; disparo acionado pelo Mestre."
	}),
	ability("X-desalento-H02", {
		state: "manual",
		gaps: ["recuperar PV iguais à metade do dano de SAN realmente causado (precisa registrar o dano real, não inferir pela fórmula)", "vínculo com o alvo afetado por Falsa Nostalgia", "arredondamento conforme a fonte"],
		why: "A cura depende do dano real registrado em outra execução; o motor ainda não calcula cura proporcional ao dano causado (tarefa técnica própria)."
	}),
	ability("X-desalento-H03", {
		state: "assisted",
		execution: exec([tokens(null, 20), effects(fx("fascinado", "unspecified", null, { onSave: "always" })), requirements(req.affectedBy("falsa-nostalgia"))]),
		gaps: ["duração e resistência do Fascinado não estão no texto: manter manual até existirem", "comportamento mecânico da condição Fascinado"],
		why: "Só os alvos vinculados a Falsa Nostalgia recebem o marcador de Fascinado; duração e comportamento ficam com o Mestre."
	}),
	ability("X-desalento-H04", {
		state: "manual",
		execution: exec([line(9, 3), save("reflexos", 18, "half"), damage(dmg("2d8+2", "energia")), effects(fx("surdo", "rounds", "1d4"))]),
		testActivation: "default",
		why: "Configuração completa (linha 9 m × 3 m, 2d8+2 Energia, Reflexos DT 18 metade, Surdo 1d4 rodadas na falha), mas o tipo de ação está vazio no compêndio e a spec exige revisão antes de automatizar."
	})
];
