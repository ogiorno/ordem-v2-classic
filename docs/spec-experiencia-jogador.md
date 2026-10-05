# Spec: experiência do jogador (entrada, rolagens, combate, rituais)

Sistema `ordem_v2_classic` 8.0.2 · Foundry VTT 14.369 · origem: [relatório de QA do jogador](qa-jogador/relatorio-qa-jogador.html) (17/10/2026).

Esta spec cobre **todos os problemas** do relatório (P01–P27 abaixo). O combate (acerto e dano, seção 6) é o núcleo e tem o maior detalhamento de UX/UI. As demais seções seguem o mesmo formato: problema → solução de UX → desenho técnico → critério de pronto.

## 0. Correção ao relatório

Ao ler o código para esta spec, duas afirmações do relatório estavam imprecisas. O resto do relatório foi confirmado.

| Relatório dizia | O código mostra | Efeito na spec |
| --- | --- | --- |
| "O ataque não diz se acertou." | Existe um bloco de resultado em `module/documents/chat-message.mjs` (~linha 208): rótulos `ACERTO`, `FALHA`, `CRÍTICO` (`lang/pt-BR.json`: `op.hit`, `op.miss`, `op.criticalHit`). Ele aparece para atacante, dono do alvo e GM. | O problema real é de **clareza**: `CRÍTICO` não diz "acertou", e `FALHA` para erro de ataque se confunde com falha de teste (P19). |
| "Não há botão Aplicar dano." | O botão `Aplicar ao Alvo` existe, mas só é criado para o **GM** (`chat-message.mjs` ~linha 151, `damageTarget && game.user.isGM`). | O problema real é que o **jogador não pode aplicar** e nada avisa que o dano está esperando o GM (P20). |

## 1. Princípios de UX

1. **O jogador nunca vê código.** Nada de `3d20kh`, chave de tradução, "PE debitado de PD" ou "saldo fundido".
2. **Cada cartão responde uma pergunta.** Ataque: "acertei?". Dano: "quanto e em quem?". Aplicado: "e agora?".
3. **Um próximo passo óbvio por cartão**, com um botão primário só.
4. **Segredo do mestre fica segredo.** Defesa e PV exatos de ameaças só o GM vê (regra já existente em `helpers/visibility.mjs`).
5. **Copy em pt-BR, frases curtas, verbo no começo**, sem ponto final em rótulos, ponto final em frases de ajuda. Sem "por favor" e sem "!" em texto de sistema.
6. **Regra de sanidade manda no vocabulário.** Com "Jogando sem Sanidade" ligado, só se fala PD; sem ela, PE e SAN.
7. **Padrão seguro, desligável.** Automatismos novos têm configuração de mundo.

## 2. Mapa dos problemas

| ID | Problema (relatório, seção) | Seção desta spec |
| --- | --- | --- |
| P01 | Popup "8.0.2 Release Notes" abre para todos a cada entrada (2) | 3.1 |
| P02 | Mapa preto: token novo sem visão (2) | 3.2 |
| P03 | Mensagem de primeira vez do Dice So Nice! cobre o chat (2) | 3.3 |
| P04 | Token novo usa ícone genérico (2) | 3.4 |
| P05 | Personagem novo começa com PV/PD atuais em 5 (4) | 3.5 |
| P06 | Setas do teclado não movem o token (3) | 4.1 |
| P07 | Sem feedback de movimento; Deslocamento sem unidade (3, 4) | 4.2 |
| P08 | Abrir porta sem feedback no chat (3) | 4.3 |
| P09 | Duas caixas por perícia sem rótulo (4) | 5.1 |
| P10 | Siglas e nome cortados na ficha (4) | 5.2 |
| P11 | `3d20kh` no diálogo e no chat (5) | 6.1 |
| P12 | "Rolagem Situacional" e "Público como Usuário" (5) | 6.2 |
| P13 | Resultado sem decomposição de dados e bônus (5) | 6.3 |
| P14 | Sem sucesso/falha quando não há DT (5) | 6.4 |
| P15 | `/gmroll` não diz que o mestre também vê (5) | 6.5 |
| P16 | Chat pesado: avatar e cabeçalho grandes (5) | 6.6 |
| P17 | Chat some quando a aba Combate está aberta (5) | 6.6 |
| P18 | Dois jeitos de usar arma (balão x ícone) (6) | 7.1 |
| P19 | Resultado do ataque ambíguo (`CRÍTICO`, `FALHA`) (6) | 7.2 |
| P20 | Só o GM aplica dano; sem aviso de dano pendente (6) | 7.3 |
| P21 | Dano sem explicar crítico e sem nome do alvo (6) | 7.4 |
| P22 | Chave crua `op.targetchoices.1 ser` na aba Rituais (7) | 8.1 |
| P23 | PE, PD e SAN misturados (7) | 8.2 |
| P24 | Teste "Custo do Paranormal" sem explicação; DT 16 x 21 (7) | 8.3 |
| P25 | Texto do chat de ritual com cara de nota técnica (7) | 8.4 |
| P26 | Efeito do ritual (cura, dano) não aplicado (7) | 8.5 |
| P27 | Troca de cena derruba todos sem aviso; GM de teste sem senha (8, 10) | 9 |

## 3. Primeira entrada

### 3.1 P01 — Notas de versão

**Problema.** O jogador (e o GM, a cada recarga) vê um modal com texto sobre backup do Foundry, assunto do GM.

**Causa no código.** `module/components/message-system.mjs`, função `isCurrent`: `const isDisplayable = !msg.display === "once" || !settings;`. `!msg.display === "once"` é sempre falso, então o resultado depende só da opção de cliente `patchNotes`, que por padrão é `false`. Resultado: aparece em toda entrada. A checagem "já exibida" está comentada (`hasDisplayed`).

**UX.** O popup aparece **uma vez por versão do sistema e por usuário**, e só para o GM. O jogador não recebe o popup. Opcional: uma linha discreta no chat do GM, "Novidades da 8.0.2" com link para as notas.

**Técnico.**
- Corrigir `isCurrent`: `display === "once"` consulta um registro por usuário (`game.user.setFlag(SYSTEM, "seenMessages", [...])` ou setting `client` com a lista de títulos vistos).
- Mensagens recebem `audience: "gm" | "all"` em `media/messages/messages.jsonc`; as atuais viram `gm`.
- Manter a opção `patchNotes` como "desligar todas as notas" (hoje o nome sugere o contrário; rótulo novo: "Não mostrar notas de atualização").

**Pronto quando:** jogador novo não vê modal; GM vê uma vez por versão; recarregar não reabre.

### 3.2 P02 — Mapa preto

**Problema.** Com visão de token ligada na cena, um agente novo sem `sight.enabled` vê tudo preto.

**UX.** Agente criado já enxerga. Se um token de jogador não enxerga nada, o GM é avisado em vez de descobrir pelo jogador.

**Técnico.**
- Em `hooks.mjs`, no `preCreateActor` de agente (já existe o bloco que define disposição amistosa e `actorLink: true`), incluir `prototypeToken.sight = { enabled: true }`.
- Em `createToken` (GM ativo): se a cena tem `tokenVision` ligada, o token tem dono jogador e `sight.enabled === false`, enviar ao GM `ui.notifications.warn("O token de {nome} não tem visão ligada. Jogadores verão a cena preta.")`, com ação "Ligar visão".
- **Nota de ferramenta (QA).** Tokens criados a partir do `prototypeToken` herdaram um `level` obsoleto e não eram desenhados no canvas. Ao colocar token em cena, garantir `level` do nível da cena (`canvas.level.id`).

**Pronto quando:** agente criado e solto numa cena com visão enxerga a própria vizinhança.

### 3.3 P03 — Mensagem do Dice So Nice!

**Problema.** Na primeira entrada o jogador recebe um cartão longo de configuração de dados 3D, que empurra o chat.

**UX.** Nada de cartão de primeira vez para jogadores. Configuração de dados fica em Configurações.

**Técnico.** É do módulo Dice So Nice!, fora do sistema. Entrega: no mundo, ativar a opção do módulo que desliga a mensagem de boas-vindas, e registrar isso em `AGENTS.md` como configuração recomendada do mundo.

### 3.4 P04 — Ícone do token

**UX.** O token usa a imagem do personagem. Sem imagem, usa o retrato da classe (Combatente, Especialista, Ocultista) em vez do encapuzado genérico.

**Técnico.** No `preCreateActor` de agente: `prototypeToken.texture.src = actor.img`. Em `updateActor` (quando `img` muda e o token ainda usa a imagem antiga ou o padrão), sincronizar. Ícones de classe em `media/icons/classes/`.

### 3.5 P05 — Recursos atuais no máximo

**Problema.** A ficha nasce com PV 5/37 e PD 5/15 (valor atual vem do `initial: 5` do schema em `agent-data.mjs`).

**UX.** Ao escolher a classe (ou mudar o nível), o valor atual sobe junto com o máximo, como já ocorre na subida de nível (`helpers/level-progression.mjs`). Personagem novo começa cheio.

**Técnico.**
- Em `createItem` (tipo `class`, pai agente): depois do cálculo, `actor.update({ PV.value: max, PE.value/PD.value: max, SAN.value: max })`, **somente** se o valor atual ainda for o inicial do schema (5) e a ficha nunca foi editada (flag `resourcesInitialized`).
- Reaproveitar `MAX_KEYS` e a lógica de ganho de `level-progression.mjs`.

**Pronto quando:** criar agente, soltar classe → PV, PE/PD e SAN cheios; soltar classe de novo não recarrega recursos gastos.

## 4. Movimento e portas

### 4.1 P06 — Setas do teclado

**Problema.** WASD anda; setas não movem.

**Técnico.** Investigar se a atribuição de teclas do Foundry 14 (`Configurações → Controles → Mover token`) já vincula as setas e o `passos.mjs` do `meu-modulo` só intercepta `_getShiftedPosition` (passo reduzido em cena sem grade). O teste automático pode ter falhado por foco no canvas, não por falta de suporte. Passos: (1) repetir com `keydown`/`keyup` e foco no canvas; (2) se confirmado, registrar as setas no keybinding de movimento de `registerSystemKeybindings` (`settings/settings.mjs`).
**Pronto quando:** setas e WASD movem o mesmo passo.

### 4.2 P07 — Feedback de movimento

**UX.** Ao mover, aparece ao lado do token a distância percorrida e a restante no turno ("3 de 9 m"). A ficha mostra "9 m" no Deslocamento.

**Técnico.**
- Template da ficha: sufixo "m" (chave `op.unitMeters`), lido de `canvas.scene.grid.units` quando houver cena.
- Distância em combate: usar o histórico de movimento nativo do Foundry 14 (`TokenDocument#movementHistory`) para somar o gasto no turno; exibir via régua do Foundry (já mostra distância), só garantindo `Ruler` ativo no arrasto.

### 4.3 P08 — Porta sem feedback

**UX.** Opcional por configuração de mundo (`doorChatLog`, padrão desligado): linha curta e discreta no chat, "QA1 abriu a porta". Porta trancada ao clicar: aviso "A porta está trancada" (o Foundry já toca som; a mensagem de texto ajuda quem joga sem som).

**Técnico.** Hook `updateWall` com `changes.ds`; mensagem sem avatar, cor suave, apenas para quem vê a porta.

## 5. Ficha do agente

### 5.1 P09 — Colunas sem rótulo

**UX.** Cabeçalho acima das colunas de perícias: **Treino · Bônus · Total** (com dica ao passar o mouse: "Total = atributo + treino + bônus"). A caixa "+0" é o bônus manual; a "0" é o total.

**Técnico.** Linha de cabeçalho em `templates/actor/parts/actor-skills.hbs`; chaves `op.skillColumns.*`. Atenção ao largo da coluna (ficha com 600 px).

### 5.2 P10 — Siglas e nome cortados

**UX.** O seletor de treinamento mostra a sigla com largura suficiente ("Des", "Trein", "Vet", "Exp") com `title` completo; o nome do personagem quebra em duas linhas ou reduz a fonte em vez de cortar.

**Técnico.** CSS: `select` com `min-width`, `.charname input` com `text-overflow` e `font-size: clamp(...)`; título da janela já mostra o nome completo.

## 6. Rolagens e chat

### 6.1 P11 — Notação `kh`

**UX.** O jogador lê **"3 dados, vale o maior"**; com penalidade, **"2 dados, vale o menor"**; com 1 dado, só "1 dado".

**Técnico.** Função pura `describeD20Pool(formula)` em `helpers/` (testável em Node), usada pelo diálogo (`applications/roll-configuration-dialog.mjs`, onde hoje aparece "Fórmula") e pelo cartão (`dice/d20-roll.mjs`, modificador `kh` na linha 153). A fórmula crua continua disponível numa dica (`title`) para quem quiser.

### 6.2 P12 — Textos do diálogo

**UX.** "Rolagem Situacional" vira o campo **"Bônus ou penalidade da situação"** (placeholder "ex.: +2 ou −1d20"). "Público como Usuário" vira **"Rolagem pública"** (opções: pública, só mestre, privada, às cegas).

**Técnico.** Chaves `op.RollSituationalBonus` e as de modo de rolagem em `lang/pt-BR.json`. O placeholder reproduz a regra do livro (`+d20`, `−d20`).

### 6.3 P13 — Origem do resultado

**UX.** Sob o total, uma linha miúda: **"Luta (treinado +5) · Força 3 → 3 dados"**. Dados individuais ficam num detalhe expansível (já é a lista "19 · 18 · 9").

**Técnico.** `D20Roll` guarda `options.breakdown = { skillLabel, degreeLabel, bonus, attrLabel, attrValue, poolSize }`, preenchido em `actor.mjs` (`rollSkill`) e exibido no template `templates/dice/`.

### 6.4 P14 — Sucesso e falha sem DT

**UX.** Sem DT, o cartão mostra só o total e a legenda **"Mestre decide o resultado"** em cinza (sem verde/vermelho). Com DT, mostra **Sucesso** ou **Falha** com a DT ao lado, como já ocorre. No diálogo, o campo "Dificuldade (DT)" ganha a dica "Deixe vazio se o mestre vai decidir".

### 6.5 P15 — `/gmroll`

**UX.** O cartão do jogador diz **"Só você e o mestre veem esta rolagem"**, com ícone de cadeado, em vez do selo "WHISPER" (termo em inglês). Sussurro (`/w`) diz **"Para: QA2"** (já faz isso) e mantém "Sussurro" em pt-BR.

**Técnico.** `lang` do core (`CHAT.RollPrivate`...) não é do sistema; a classe de mensagem `chat-message.mjs` troca o selo quando `rollMode === "gmroll"`.

### 6.6 P16 e P17 — Chat pesado e invisível

**P16 UX.** Modo compacto (configuração de cliente, padrão ligado em telas estreitas): mensagens consecutivas do mesmo personagem se juntam sob um só cabeçalho; avatar de 24 px; menos espaçamento. Cartões de ataque, dano e ritual mantêm o cabeçalho completo.
**P17 UX.** Durante o combate o jogador **vê o chat e o rastreador juntos**: o rastreador vira faixa horizontal fixa no topo (já existe a faixa de iniciativa) e a lateral continua no chat. Quando a aba Combate estiver aberta e chegar mensagem, a aba Chat pisca e um aviso mostra a primeira linha ("QA1: Acertou — crítico").

**Técnico.** CSS em `css/ordemparanormal.css` sob `.system-ordemparanormal #chat`; hook `createChatMessage` para o aviso quando `ui.sidebar.activeTab !== "chat"`.

## 7. Combate: acerto e dano (núcleo)

### 7.1 P18 — Atacar sem adivinhar

**Problema.** Na linha da arma, o balão posta só a descrição e o ícone posta o cartão com os botões de ataque.

**UX.** Na linha da arma ficam três ações claras:

| Controle | Rótulo (dica) | Faz |
| --- | --- | --- |
| botão primário `Atacar` | "Atacar com Faca" | posta o cartão de ataque **e** abre a rolagem |
| ícone de olho | "Ver descrição" | expande a descrição na própria ficha (já existe o clique no nome) |
| estrela, lápis, lixeira | como hoje | favorito, editar, apagar |

O balão sai. O clique no ícone da arma também ataca (mantém o hábito de quem já usa).

### 7.2 P19 — Resultado do ataque claro

**Problema.** `CRÍTICO` sozinho não diz que acertou; `FALHA` parece falha de teste.

**UX.** Faixa de resultado no cartão, três estados, sempre com ícone, texto e cor (não depender só de cor):

| Estado | Texto | Cor | Ícone |
| --- | --- | --- | --- |
| Acerto | **Acertou** | verde | check |
| Crítico | **Acertou — crítico, dano dobrado** | verde forte | check duplo |
| Erro | **Errou o ataque** | vermelho | x |

Perspectiva já existente é mantida: para o dono do **alvo**, as cores se invertem (acerto contra mim é vermelho). Texto para o defensor: **"Você foi atingido"** e **"O ataque errou você"**.
Segunda linha pequena: GM e dono do alvo veem **"19 contra Defesa 15"**; os demais veem **"A Defesa do alvo é segredo do mestre"** ou nada.

**Técnico.** `chat-message.mjs` (bloco de `hitResult`, ~linhas 208–262): trocar as chaves `op.hit`, `op.miss`, `op.criticalHit` por `op.attackResult.hit`, `op.attackResult.miss`, `op.attackResult.crit`, `op.attackResult.hitDefender`, `op.attackResult.missDefender`. CSS `.hit-result` ganha ícone. Nenhuma mudança no cálculo (`_compareWithDefense`, `item.mjs` ~linha 567).

### 7.3 P20 — Aplicar dano

**Problema.** Só o GM tem o botão `Aplicar ao Alvo`. O jogador rola o dano e nada acontece até o mestre agir, sem aviso.

**Fluxo proposto** (mockup acima):

1. **Cartão de ataque** (jogador): resultado (7.2) e botão primário `Rolar dano`, desabilitado em erro com a explicação "Sem dano: o ataque errou".
2. **Cartão de dano**: total grande ("14 de dano de corte"), explicação do cálculo (7.4), chip do alvo e botão primário **`Aplicar 14 de dano`**. Visível a quem atacou e ao GM.
3. **Cartão aplicado**: substitui o botão por "Aberração de Carne sofreu 14 de dano". O GM vê o detalhe ("PV 70 → 56 · RD 0") e um link **Desfazer** por 2 minutos. O jogador vê uma leitura qualitativa: "sente o golpe" (menos de 25% do PV máx.), "está ferido" (até metade), "está muito ferido" (abaixo da metade) ou "caiu" (0). Nunca o número.

**Configuração de mundo `damageApplication`:**

| Valor | Comportamento | Padrão |
| --- | --- | --- |
| `manual-gm` | como hoje: só o GM aplica | |
| `attacker-click` | atacante ou GM clicam `Aplicar` | **sim** |
| `auto` | aplica sozinho quando o ataque acerta e não há reação pendente | |

**Técnico.**
- **Botão.** Em `chat-message.mjs`, trocar a condição `damageTarget && game.user.isGM` por `canApplyDamage(user, message)` (função pura em `helpers/visibility.mjs`, testada em `tests/unit`): verdadeiro para GM, ou para o autor da mensagem de dano quando `damageApplication !== "manual-gm"`.
- **Autoridade no GM.** O jogador não altera PV da ameaça diretamente (ele não é dono). Novo tipo de socket `applyCardDamage` em `ordemparanormal.mjs` (ao lado de `applyDamage`), com **apenas** `{ messageId, userId }`; o valor, o alvo e o tipo de dano vêm das flags da mensagem (`damageTarget`, rolls), nunca do cliente.
- **Validações no GM:** (a) mensagem existe e `damageTarget` existe; (b) `damageApplied` ausente (idempotência já existente); (c) remetente é o autor da mensagem ou GM; (d) o ataque associado está revelado e `hit === true` (a flag `hitResult.revealed` da reação pendente deve estar `true`); (e) o autor ainda é dono do ator que atacou.
- **Sem GM.** Se nenhum GM está ativo, o botão fica habilitado mas o clique mostra "Sem mestre conectado, o dano fica na fila" e o cartão grava `damagePending`; ao entrar um GM (`ready` ou `userConnected`), o dano pendente é aplicado em ordem. (Alternativa mais simples: manter o aviso atual `op.applyDamageNeedsGM` e não enfileirar; decidir na revisão.)
- **Modo `auto`.** Logo após `rollDamage`, se `hitResult.hit` e sem `reactionPending`, o GM client aplica e marca `damageApplied.by = "auto"`. Em volley (`rollVolleyDamage`), uma aplicação por golpe.
- **Desfazer (GM).** Gravar em `damageApplied` o PV anterior; ação restaura se o PV atual ainda é o resultante.
- **Dano misto** (tipos diferentes na mesma rolagem): continua sem botão automático (`hasMixedTypes` em `item.mjs` ~linha 680); o cartão mostra "Dano com tipos mistos: o mestre aplica" para o jogador.
- **Reações.** Enquanto `reactionPending` está ativo, o botão `Rolar dano` e `Aplicar` ficam desabilitados com a dica "Esperando a reação do alvo" (comportamento já existente no botão de dano; estender ao novo botão).

### 7.4 P21 — Dano explicado

**UX.** Três linhas no cartão de dano:
- Título: "Dano da Faca" e o chip do alvo ("Aberração de Carne").
- Total em destaque com o tipo ("14 de dano de corte").
- Explicação: **"2d4 + 3, dados dobrados pelo crítico (Faca 19)"** ou "1d4 + 3, dano normal". Se houver RD no alvo, o GM vê "− 2 de RD".

**Técnico.** `rollDamage` já recebe `critical`; incluir no `flavor` e na flag `damageBlock` do cartão `{ formula, crit, multiplier }`; `op.rollDamageChat` ganha o nome do alvo (`hitResult.actorUuid` → nome do token, respeitando visibilidade).

## 8. Rituais

### 8.1 P22 — Chave crua `op.targetchoices.1 ser`

**Causa.** `templates/actor/parts/actor-rituals.hbs` (linha 83) faz `localize (concat "op.targetChoices." item.system.target)`. Os rituais da `biblioteca-de-rituais` do mundo trazem `system.target` em texto livre ("1 ser"), que não é um valor do enum (`people`, `creatures`, `animals`, `weapons`, `equipment`, `area`). O Foundry devolve a própria chave.

**UX.** Mostrar "1 ser". Valor do enum aparece traduzido; texto livre aparece como está.

**Técnico.** Helper Handlebars `targetLabel`: se `game.i18n.has("op.targetChoices." + v)`, localiza; senão devolve `v`. Aplicar a todas as chaves montadas por concatenação (`op.executionChoices.`, `op.rangeChoices.`, `op.durationChoices.`, `op.resistanceChoices.`, `op.elementChoices.` em `item-card.hbs` e fichas). Teste de `lang-check` (`npm run lang-check`) passa a falhar quando `{{localize (concat ...)}}` não tem fallback. Em paralelo, normalizar os rituais do compêndio do mundo para o enum.

### 8.2 P23 — PE, PD e SAN

**UX.** Um único vocabulário por mesa. Com "Jogando sem Sanidade" ligado: custo em **PD** em todo lugar (janela de conjurar, ficha, chat). Desligado: **PE**, e a perda por falha em **SAN**.

**Técnico.** Função `costLabel(system)` já existe na ficha (`costLabel` em `actor-sheet.mjs`); expor em `helpers/` e usar em `macros/ritual-caster.mjs` (janela "Conjurar Ritual" e texto do chat) no lugar das strings fixas "PE" e "SAN". Revisar `templates/item/parts/item-ritual-attributes.hbs`.

### 8.3 P24 — Teste "Custo do Paranormal"

**UX.** Antes da rolagem, a janela diz o porquê: **"Custo do Paranormal: teste de Ocultismo contra DT 21. Se falhar, você perde mais 1 PD."** A DT vem explicada: "DT = 20 + custo do círculo" (fórmula conferida em `ritual-caster.mjs`). A ficha deixa claro que "DT de ritual 16" é a dificuldade **dos alvos** resistirem, e a DT 21 é do **teste do conjurador**, com dois rótulos diferentes ("DT dos seus rituais" e "DT do Custo do Paranormal").

**Técnico.** Título e texto na janela de rolagem aberta por `ritual-caster.mjs` (opção `flavor` e linha de ajuda em `roll-configuration-dialog.mjs`). Chaves `op.ritual.costTestTitle`, `op.ritual.costTestHelp`.

### 8.4 P25 — Texto do chat de ritual

**UX.** Substituir os textos por frases de jogador. Modelo:

> **Cicatrização** · 1º círculo · Morte
> Custo: **1 PD**. Teste de Ocultismo: 20 contra DT 21 — **falhou**, você perde mais **1 PD** (27 de 29 restantes).
> Alvo: Aberração de Carne · Alcance: toque
> ▸ Descrição do ritual

Regras de redação: sem "Resolva efeitos narrativos/manual do Mestre", sem "consequência de SAN no saldo fundido", sem "Defina o alvo em cena". Se não há alvo, a linha "Alvo" some. Se o efeito precisa do mestre, uma frase: "O mestre aplica o efeito".

**Técnico.** `macros/ritual-caster.mjs` linhas ~489–498 (strings montadas em HTML). Mover para template `templates/chat/ritual-card.hbs` com chaves de `lang`. Manter os testes de `ritual-caster-logic.test.mjs`.

### 8.5 P26 — Efeito do ritual

**UX.** Rituais de **cura** e **dano** com rolagem definida ganham o mesmo fluxo do combate: o cartão rola o efeito e oferece `Aplicar` (7.3). Ex.: Cicatrização: "Cura 3d8+3 PV" com botão `Curar Aberração de Carne`; Decadência: dano e resistência de Fortitude com "metade". Rituais narrativos continuam sem botão, com a frase "O mestre aplica o efeito".

**Técnico.** Já existe o motor de área (`ritual-area-engine.mjs`, resistência, dano e condições para rituais de área). Escopo desta spec: **alvo único e toque**. Campo opcional `system.effect = { type: "heal"|"damage", formula, damageType, resistance }` no item de ritual; o cartão usa o mesmo `damageTarget` e `applyCardDamage` (cura = dano negativo, limitado ao PV máximo). Fase 2.

## 9. Mestre e operação

**P27a — Troca de cena.** Ao ativar uma cena, o GM vê confirmação: "Isto move todos os jogadores para {cena}. Há um combate em andamento em {outra cena}." (só quando há combate ativo na cena atual). **Técnico:** `preUpdateScene` com `active: true`, bloqueando para confirmação via `Dialog.confirm`.

**P27b — Usuários de teste.** Usuário de QA com função GM e sem senha é risco com UPnP ligado. A spec de QA passa a exigir: usuários de teste criados por script marcados com flag `qaUser`, **sem papel de GM** (usar "Assistente" quando precisar de visão de mestre), removíveis com um comando (`/qa-limpar`) que também apaga mensagens, combates e tokens de teste.

## 10. Chaves de tradução novas (resumo)

`op.attackResult.hit`, `op.attackResult.miss`, `op.attackResult.crit`, `op.attackResult.hitDefender`, `op.attackResult.missDefender`, `op.attackResult.noDamage`, `op.attackResult.pending`, `op.dmgCard.explainCrit`, `op.dmgCard.explainNormal`, `op.dmgCard.apply`, `op.dmgCard.applied`, `op.dmgCard.undo`, `op.dmgCard.noGM`, `op.dmgCard.mixed`, `op.dmgCard.state.*` (leve, ferido, muito ferido, caído), `op.dicePool.*`, `op.roll.situational`, `op.roll.visibility.*`, `op.roll.noDC`, `op.roll.gmroll`, `op.skillColumns.*`, `op.unitMeters`, `op.ritual.costTestTitle`, `op.ritual.costTestHelp`, `op.ritual.cardLine.*`, `op.doorOpened`, `op.doorLocked`. Todas em `lang/pt-BR.json` e `lang/en.json`; `npm run lang-check` valida.

## 11. Testes

**Unitários (`npm test`, Node puro):**
- `canApplyDamage` (GM, autor, outro jogador, modo `manual-gm`, modo `attacker-click`).
- `describeD20Pool("3d20kh")`, `("2d20kl")`, `("1d20")`.
- `damageStateLabel(pvAntes, pvDepois, pvMax)` (faixas de 25%, 50%, 0).
- `targetLabel` com valor do enum e com texto livre.
- Validações do socket `applyCardDamage` extraídas para função pura (`validateCardDamageRequest`).
- Textos do ritual: gerador do resumo com e sem alvo, com e sem falha, com PD e com PE/SAN.

**No mundo (miniQuench, QA como jogador):**
1. QA1 ataca com alvo e erra: botão `Rolar dano` desabilitado, texto "Errou o ataque".
2. QA1 acerta com crítico: cartão de dano com explicação e `Aplicar`; clique aplica; PV do monstro cai; segundo clique não repete.
3. Dois jogadores clicam `Aplicar` ao mesmo tempo: uma só aplicação (flag `damageApplied`).
4. Sem GM conectado: aviso e (se escolhido) fila.
5. Ritual de cura em alvo único: cartão com `Curar` e limite no PV máximo.
6. Aba Rituais com ritual de alvo em texto livre: mostra "1 ser".
7. Primeira entrada de jogador novo: sem popup, token com visão, PV cheio.

**Roteiro Playwright do relatório** (o mesmo de `docs/qa-jogador`) vira regressão manual guiada antes de cada versão.

## 12. Fases de entrega

| Fase | Conteúdo | Risco |
| --- | --- | --- |
| 1 (rápida, só texto e config) | P01, P03, P09–P12, P14, P15, P22, P23, P25, 7.2 (rótulos) | baixo |
| 2 (combate) | P18, P19, P20 (`attacker-click` + socket), P21, P17 | médio: segurança do socket |
| 3 (ficha e entrada) | P02, P04, P05, P06, P07, P08 | baixo |
| 4 (rituais e mestre) | P24, P26, `auto` do P20, desfazer, P27 | médio |

## 12.1 Status de implementação (Fases 1 e 2)

Feito e verificado: P01, P09 (legenda), P10 (largura), P11, P12, P14, P15 (aviso de rolagem privada), P17, P18, P19, P20 (modo `attacker-click` por padrão; `auto` e `manual-gm` também implementados), P21, P22, P23, P24 (aviso antes do teste), P25. Testes: `npm test` (86 passando), `npm run lang-check`, `npm run render-check` e uma passada ao vivo como jogador (ataque → dano → pedido de aplicação → aplicado). A passada ao vivo achou um defeito que os testes não pegam: chave de tradução que também é prefixo de outra (`op.attack` e `op.damage` já existiam) derruba o idioma inteiro; por isso as chaves novas são `op.attackResult.*` e `op.dmgCard.*`, e há um teste que barra esse tipo de colisão.
**Fase 3 (feita e verificada ao vivo):** P02 (agente já nasce com visão ligada; o GM recebe aviso se um token de jogador está sem visão), P04 (token usa o retrato e acompanha troca de imagem), P05 (classe nova enche PV, PD/PE e SAN), P08 (opção de mundo "Avisar no chat ao abrir ou fechar portas", desligada por padrão), P07 parcial (a ficha mostra a unidade em "Deslocamento (m)").
**Correção do P06:** no Foundry 14 as **setas movem a câmera** e **WASD move o token**, por padrão do núcleo (`client-keybindings.mjs`). Não é defeito; religar as setas tiraria o controle da câmera. A solução virou uma dica única na primeira entrada do jogador ("use W A S D para andar; as setas movem a câmera"). Quem preferir setas pode trocar em Configurações → Controles.
Ainda pendente do P07: distância gasta no turno ao andar pelo teclado.
**Fase 4 (feita e verificada ao vivo):**
- Desfazer dano (GM): botão no cartão por 2 minutos, só se o PV do alvo não mudou; os PVs antes/depois ficam em flag do **ator** (não na mensagem), então jogadores não os leem. Testado: PV 22 → 18 → 22, cartão volta ao estado "Aplicar".
- P27a: ativar outra cena com combate em andamento na cena atual pede confirmação ("leva todos os jogadores para lá…"). Testado chamando o hook direto (retorna `false`, abre o diálogo, cena ativa não muda).
- P16: opção de cliente "Chat compacto" (retrato 22 px, menos espaço). **Desvio da spec:** vem desligada, porque o mundo usa a UI Carolingian (`crlngn`) com retratos próprios; ligue em Configurações do sistema.
- P26: o conjurador já aplica cura e dano em alvos marcados (tecla T) via `ritual-caster.mjs` (`selection.effect.kind`); no QA o alvo não estava marcado. O texto do cartão agora diz que o mestre aplica o efeito quando não há alvo. Sem mudança de modelo de dados.
- Fila de dano sem GM: mantido o aviso "Nenhum mestre conectado" (alternativa simples da spec); sem fila.
- P27b (usuários de teste): procedimento, não código. Regra para próximos QAs: usuários de teste com papel Assistente (não GM), apagados no fim.
Pendente: distância gasta no turno ao andar (P07), agrupar mensagens consecutivas no chat compacto. P03 é configuração do módulo Dice So Nice!, fora do sistema.
Limite da verificação: o pedido de aplicação do jogador vai ao primeiro GM conectado; nos testes esse era o cliente do mestre real, que ainda não tinha recarregado o código novo. A aplicação em si e a validação foram testadas diretamente (unitário e no cliente do QA Mestra).

## 13. Perguntas abertas

1. ~~Modo padrão de dano~~ Decidido: `attacker-click`. Ainda dá para mudar por mundo em Configurações do sistema.
2. O jogador deve ver a leitura qualitativa do estado do inimigo ("está ferido") ou nada?
3. Dano pendente sem GM: fila automática ou só aviso?
4. ~~DT do Custo do Paranormal~~ Resolvido: o código usa DT = 20 + custo do círculo (`ritual-caster.mjs`), o texto de ajuda já usa isso.
5. Aviso de visão desligada (3.2): só no GM ou também no jogador?

## 14. Fora de escopo

Condições (morrendo, sangrando), reações de defesa e esquiva, áudio e dados 3D: não foram testados no QA e ficam para uma segunda rodada.
