# Spec — Conexão e Afinidade com um elemento

**Fase 4 implementada (21/10/2026). A spec de afinidade está completa.** `module/helpers/affinity-powers.mjs` (puro) traz a linha "Afinidade" dos 29 poderes do compêndio (`AFFINITY_POWERS`), cada uma **automática** (efeito de ficha) ou **manual** (motivo conhecido); o teste `afinidade.test.mjs` exige que todo poder do compêndio esteja classificado e que o elemento da tabela bata com a pasta. **Automáticos (3):** Potencial Aprimorado (+1 PE por 5% de NEX adicional), Espreitar da Besta (+5 Furtividade, total +10) e Sangue de Ferro (+5 Fortitude; a imunidade a veneno/doença vale pelo texto). Os outros 26 são manuais (rerrolagens, imunidades, recursos próprios, condicionais): a linha aparece no grimório, com "Você tem a afinidade" ou "Exige afinidade". **Segunda cópia:** o mesmo poder paranormal entrando de novo na ficha vira cópia de afinidade (flag `affinityCopy`, `affinity.mjs`), não conta como poder novo (não promove conexão a afinidade) e só leva o efeito da linha "Afinidade", que liga quando a ficha tem afinidade no elemento do poder, desliga se ela sumir e liga se ela vier depois. Sem a afinidade certa a cópia entra, mas com aviso e sem benefício; o Mestre pode dar o poder mesmo assim. Os efeitos normais do compêndio e do sistema são tirados da cópia (`passive-effects.mjs` também ignora cópias). "Resistir a Elemento" se repete por elemento e não vira cópia. Correção de Fase 1: o contador de poderes por elemento no cartão usa agora o elemento da tabela (o pré-requisito do compêndio vem vazio em vários poderes). Testes: 9 novos (1321 no `npm test`) e ao vivo `docs/macros/afinidade-poderes-live-test.js` (23/23); regressão dos quatro testes de afinidade e do `passivos-live-test.js` (220/220). Limites: apagar o poder original deixa a cópia marcada; o cartão do poder na ficha ainda não mostra a linha (só o grimório).

**Fase 3 implementada (21/10/2026).** Quem tem afinidade ganha +1 dado em testes contra efeitos do próprio elemento e perde 1 dado contra o elemento opressor. O elemento do efeito chega ao teste por `effectElement` na configuração da rolagem (`actor.rollSkill({ skill, effectElement })`); `_buildSkillToolConfig` (`actor.mjs`) soma `testDiceDelta` ao `dicePenalty` (o mesmo caminho do Foco em Perícia e das condições) e guarda `options.affinity`. Preenchido sozinho nas resistências dos alvos de ritual: teste do alvo no conjurador (`ritual-caster.mjs`, elemento do ritual) e rolagem de área (`ritual-area-engine.mjs › autoRoll`). A janela de rolagem ganhou o seletor "Contra efeito de…" (só para agente com afinidade), pré-preenchido pelo ritual e editável, para o Mestre/jogador marcar o elemento em testes manuais. Fora desta fase: habilidades de ameaça e itens amaldiçoados não têm campo de elemento (use o seletor da janela); o cartão `/dt` genérico também. Ameaças não têm afinidade. Testes ao vivo: `docs/macros/afinidade-teste-live-test.js` (18/18); regressão das Fases 1 e 2 (33/33 e 20/20).

**Fase 2 implementada (21/10/2026).** `affinity.mjs › castRequirements` + `formAffinityCheck`/`componentStatus` em `affinity-rules.mjs`, ligados ao conjurador (`ritual-caster.mjs`: `getFormSelection`, `resolveCast`, `buildRitualSelection(item, form, actor)`) e ao cartão rápido (`ritual-cast-card.mjs`). Regras adotadas: (1) forma Discente/Verdadeiro que pede afinidade só pode ser conjurada por quem tem **afinidade** (conexão sem afinidade não basta); "afinidade" sem elemento vale para o elemento do ritual, "afinidade com X" compara com X; o Mestre conjura por qualquer ficha. (2) Componentes: o elemento da afinidade dispensa; sem afinidade, **só avisa** quando a ficha não tem "Componente de <Elemento>" nem o poder Improvisar Componentes (aviso na janela do conjurador e ao conjurar); Medo não tem componentes. (3) O item 8 da fase (avisar ao aprender ritual que exige afinidade) **não se aplica**: no compêndio nenhum ritual exige afinidade para ser aprendido, só as formas (35 rituais citam afinidade no texto das formas). Testes: 7 novos em `afinidade.test.mjs` (22 no total) e ao vivo `docs/macros/afinidade-ritual-live-test.js` (20/20). A caixa manual "afinidade confirmada" nunca existiu na janela (o requisito era sempre tratado como atendido), então não havia o que remover.

Status anterior (21/10/2026): **Fase 1 implementada** (conexão, transição para afinidade, cartão na aba Habilidades, nota no grimório). Fases 2 a 4 seguem só como spec. Código: `module/helpers/affinity-rules.mjs` (puro) e `affinity.mjs` (diálogo, ganchos, vista); campo `system.paranormal` em `agent-data.mjs`. Testes: `tests/unit/afinidade.test.mjs` (15) e ao vivo `docs/macros/afinidade-live-test.js` (33/33, sessão `QA GM`). Fora da Fase 1 continuam: dispensar componentes, checar `requiredAffinity` ao conjurar (`ritual-caster.mjs:196` ainda usa a caixa manual), dados do teste, linhas "Afinidade" dos poderes. As funções `skipsComponents`, `affinityMeets` e `testDiceDelta` já existem e têm teste de unidade, para as fases seguintes.

**Decisões tomadas para a Fase 1:** D1 = o poder recebido no mesmo nível da subida para NEX 50% não conta (campo `graceLevel`); conexão escolhida pelo botão não tem esse período. D2 = ficha que já passou de NEX 50% não abre diálogo sozinha, mostra o cartão com o botão "Escolher elemento". D3 = fica para a Fase 3. D4 = cartão no topo da aba Habilidades. O "NEX 50%" é lido de `system._progress >= 10` (o mesmo valor da tela de nível), qualquer que seja a regra de progressão do mundo.

Antes da Fase 1: a ficha não guardava conexão nem afinidade; o único vestígio era o texto "Requer afinidade" que o grimório lê da descrição do ritual (`ritual-caster-logic.mjs:67`) e uma caixa manual "afinidade confirmada" ao conjurar a forma Verdadeira (`ritual-caster.mjs:196`).

Fonte das regras (Livro de Regras v1.3, conferida em `regras/`):
- Afinidade — `06-o-outro-lado/0819-afinidade.md` (livro p. 110) e `0826-afinidade-elemental.md` (p. 114)
- Poderes paranormais e a linha "Afinidade" de cada um — `0825` a `0850`; Resistir a Elemento em `0829`
- Elemento opressor — `0808` a `0813`
- Poderes paranormais novos do Sobrevivendo ao Horror — `11-sobrevivendo-ao-horror/05-poderes-paranormais.md`

O código segue o livro. Onde o texto extraído estiver duvidoso, conferir no PDF (`regras/_referencia-por-pagina/`).

---

## 1. O que a regra diz

| # | Regra | Fonte |
|---|---|---|
| A1 | Em **NEX 50%** o agente se **conecta** com um elemento: Conhecimento, Energia, Morte ou Sangue (Medo não entra). A escolha **não pode ser alterada**. A conexão não tem efeito imediato. | p. 110 / 114 |
| A2 | Na **primeira vez que transcende depois disso** (próximo poder paranormal recebido), a conexão vira **afinidade**. | p. 110 / 114 |
| A3 | **Sem componentes ritualísticos** para conjurar rituais do elemento da afinidade. | p. 114 |
| A4 | **Rituais que exigem afinidade** com o elemento só podem ser aprendidos por quem a tem. | p. 110 / 114 |
| A5 | **+1d20** (dado adicional) em testes **contra efeitos do seu elemento**. | p. 114 |
| A6 | **–1d20** em testes contra efeitos do **elemento opressor ao seu**. | p. 114 |
| A7 | Poderes paranormais **do seu elemento** podem ser escolhidos **uma segunda vez**, e a cópia dá o benefício da linha "Afinidade" do poder. | p. 114 |
| A8 | Afinidade muda personalidade e aparência (texto de ambientação; **sem mecânica**). | p. 110 |

**Elemento opressor** (`0808`–`0813`): Morte oprime Sangue; Sangue oprime Conhecimento; Conhecimento oprime Energia; Energia oprime Morte. Para A6 o "opressor ao seu" é quem oprime o seu:

| Afinidade do agente | Teste com –1d20 contra efeitos de |
|---|---|
| Sangue | Morte |
| Conhecimento | Sangue |
| Energia | Conhecimento |
| Morte | Energia |

Os elementos só resistem a si mesmos (`0808`): ter vantagem contra um elemento não dá resistência a ele.

### 1.1 Bordas

- **B1.** O Poder de Ocultista (ou Transcender) é quem entrega o poder paranormal. O poder recebido **no mesmo nível em que a conexão nasce não conta** como "a próxima vez": a conexão só vira afinidade no poder paranormal seguinte. (Confirmar com o Geh — ver D1.)
- **B2.** Quem já passou do NEX 50% (fichas existentes) tem conexão pendente: o sistema **pergunta**, não escolhe por ninguém.
- **B3.** A afinidade é **uma só**. Trocar a conexão é proibido; só o Mestre apaga (correção de erro).
- **B4.** O poder "Resistir a Elemento" (`0829`) não é afinidade: dá resistência 10 ao elemento escolhido, 20 com afinidade, e conta como poder do elemento escolhido.
- **B5.** Medo não é elemento de conexão (a regra lista só Conhecimento, Energia, Morte e Sangue): não há afinidade com Medo.
- **B6.** Mundo "Jogando sem Sanidade": nada na afinidade mexe em Sanidade/PD, mas o custo de PE dos benefícios é cobrado em PD pelo mesmo caminho do conjurador de rituais.

---

## 2. Modelo de dados

Campo novo no agente (`agent-data.mjs`), um objeto só:

```
system.paranormal = {
  connection: null | "knowledge" | "energy" | "death" | "blood",   // A1, travado
  affinity:   null | "knowledge" | "energy" | "death" | "blood",   // A2, sempre == connection quando existe
  connectedAtNex: number,                                        // para B1
  affinityPending: boolean                                       // conexão feita, aguardando o próximo poder
}
```

- Chaves de elemento: as mesmas de `RITUAL_ELEMENTS` (`ritual-caster-logic.mjs:3`) e `CURSE_ELEMENTS` (`weapon-curse.mjs`).
- Os poderes paranormais do compêndio (`paranormalPowers`, 29 itens) têm `preRequisite: "Sangue 1"` e o texto da descrição é **só um aviso de licença**, não a regra. Portanto a regra de cada poder (incluindo a linha "Afinidade") mora numa **tabela de código**, como já é feito em `passive-effects-rules.mjs`. O elemento do poder vem da pasta de origem; no import, gravar `flags.ordem-v2-classic.element` (ou ler de `preRequisite`).
- Cópia de afinidade: o segundo exemplar do poder leva `flags.ordem-v2-classic.affinityCopy = true`. A trava de "só uma vez" passa a permitir 2 cópias **se** a ficha tem afinidade com o elemento do poder.

---

## 3. Fases

### Fase 1 — Conexão e afinidade na ficha (base)
1. Módulo puro `module/helpers/affinity-rules.mjs`: elementos, mapa de opressor, `canConnect(nex, paranormal)`, `afterParanormalPower(paranormal, nexAtReceive)` (aplica A2/B1), `penalizedElement(affinity)`.
2. Diálogo "Conectar-se a um elemento" (4 botões, mesmo estilo do `.op-skill-choice`) ao chegar a NEX 50% **e** como botão em fichas já acima disso (B2). Escolha grava `connection` + `connectedAtNex` + `affinityPending: true`.
3. Hook `createItem` de poder paranormal: se `affinityPending` e o poder foi recebido em NEX > `connectedAtNex` (ou nível maior), vira `affinity`. Avisa no chat/toast.
4. Cartão "Conexão e afinidade" na aba de rituais/habilidades (conexão, afinidade, elemento opressor, quantos poderes de cada elemento). Só o Mestre apaga.
5. Grimório: mostra a afinidade do jogador e marca em verde/vermelho rituais "requer afinidade".

### Fase 2 — Rituais
6. **A3**: no `ritual-caster.mjs`, rituais do elemento da afinidade dispensam a confirmação "gestos e componentes" (`preparacao-nao-confirmada`); sem afinidade, a ficha só **avisa** se não há item "Componente de <Elemento>" (nunca trava, igual ao resto do sistema).
7. **A4 / forma Verdadeira**: trocar a caixa manual `affinityConfirmed` pela checagem real (`requiredAffinity` do texto do ritual × `system.paranormal.affinity`). Ritual cujo requisito for só "afinidade" exige afinidade com o elemento do próprio ritual.
8. Ao **aprender** ritual que exige afinidade (adicionar à ficha), avisar se a ficha não tem. Não bloquear drag-and-drop (o Mestre pode dar o ritual de propósito).

### Fase 3 — Testes contra o elemento (A5/A6)
9. A rolagem de teste de resistência precisa saber o **elemento do efeito**. Fontes: carta de ritual (já tem `item.system.element`), habilidade de ameaça com elemento, maldição de item (ver `spec-modificacoes-paranormais.md`). Quando a carta aplica um teste, a janela de rolagem vem com o campo "elemento do efeito" preenchido; em teste manual o campo existe vazio.
10. Regra aplicada na janela: elemento == afinidade → **+1 dado**; elemento == opressor da afinidade → **–1 dado** (o sistema já tem soma/diferença de dados na janela de teste; reaproveitar o mesmo campo que o "Foco em Perícia" usa em `_buildSkillToolConfig`). Aparece como linha explicada no cartão ("Afinidade com Sangue: +1d20").
11. Itens amaldiçoados contam como efeito do elemento da maldição.

### Fase 4 — Linhas "Afinidade" dos poderes paranormais (A7)
12. Tabela `AFFINITY_POWERS` (nome do poder → o que a cópia faz), classificada como **auto** (vira efeito passivo, usando a infra de `passive-effects`) ou **manual** (texto no cartão e no grimório). Teste de unidade exige que **todo** poder paranormal do compêndio esteja classificado (igual ao teste dos passivos).
13. Proposta de classificação, a confirmar contra o PDF na implementação:

| Poder | Linha "Afinidade" | Tratamento |
|---|---|---|
| Resistir a Elemento | RD 10 → 20 | auto (resistência do elemento escolhido) |
| Potencial Aprimorado | +1 PE por NEX (total +2) | auto (`PE.bonus`; em modo PD usar `splitEffortBonuses`) |
| Encarar a Morte | limite de PE por turno +2 (total +3) em cena de ação | auto parcial (`PE.perRoundBonus`; condicional a cena de ação) |
| Respondendo ao Outro Lado | +5 Fortitude, imune a veneno e doença | auto (+5 Fortitude) + manual (imunidades) |
| Sangue Vivo | cura acelerada 5 | auto se o agente tiver o campo de cura acelerada; senão manual |
| Sangue Fervente | bônus em Agilidade/Força vira +2 | auto parcial (depende da escolha ativa) |
| Anatomia Insana | imune a crítico e ataque furtivo | manual (sem campo de imunidade) |
| Precognição | imune a desprevenido | auto se houver imunidade a condição; senão manual |
| Arma de Sangue | arma permanente, 1d10 Sangue | manual |
| Golpe de Sorte | multiplicador de crítico +1 | manual |
| Percepção Paranormal, Sensitivo, Visão do Oculto, Afortunado, Campo Protetor, Causalidade Fortuita, Manipular Entropia, Escapar da Morte, Potencial Reaproveitado, Surto Temporal, Expansão de Conhecimento | rerrolagens, ignorar camuflagem, DT, usos por turno etc. | manual (texto da linha aparece no grimório e no cartão do poder) |

14. Poderes paranormais novos do Sobrevivendo ao Horror (`05-poderes-paranormais.md`) entram na mesma tabela; conferir se já estão entre os 29 do compêndio antes.

---

## 4. Interações com o que já existe

- `passive-effects` (efeitos que o sistema cria sozinho): a cópia de afinidade é só mais um item com marcação `affinityCopy`; o sincronizador cria/remove o efeito da linha "Afinidade" quando a cópia entra ou sai.
- `weapon-curse` (Amaldiçoar Arma): já usa os mesmos elementos; nada muda.
- Grimório (`grimoire-reading.mjs`, `grimoire-app.mjs`): hoje só exibe "Requer afinidade com X"; passa a comparar com a ficha.
- Ameaças: não têm afinidade (têm elemento próprio); fora do escopo.

---

## 5. Testes

- `tests/unit/afinidade.test.mjs` (`npm test`): mapa de opressor (4 pares), `canConnect` (NEX < 50, ≥ 50, já conectado), transição B1, serialização do modelo, tabela `AFFINITY_POWERS` cobre todos os poderes paranormais do compêndio.
- Ao vivo (`docs/macros/afinidade-live-test.js`, sessão `QA GM`, jogador simulado como em `pericias-treinadas-live-test.js`): conectar, recusar trocar, receber poder → vira afinidade, conjurar ritual do elemento sem componente, forma Verdadeira com e sem afinidade, teste contra o próprio elemento (+1d20) e contra o opressor (–1d20), segunda cópia de poder liberada só com afinidade.
- `npm run lang-check` e `render-check` para as chaves novas e o cartão.

## 6. Decisões em aberto (perguntar ao Geh antes de implementar)

- **D1.** O poder recebido no mesmo nível da conexão (NEX 50%) conta como "próxima vez"? Proposta: não (B1).
- **D2.** Em fichas já acima de NEX 50% sem conexão: perguntar na hora que o Mestre ativo abrir o mundo, ou só mostrar botão na ficha? Proposta: só botão + aviso (evita surpresa nas 17 fichas reais).
- **D3.** O que é "efeito do elemento" em ameaças sem elemento marcado nas habilidades? Proposta: usar o elemento da ameaça, se houver; senão campo vazio.
- **D4.** Dedicar uma aba "Paranormal" na ficha ou usar o cartão no grimório? Proposta: cartão na aba atual de rituais.
