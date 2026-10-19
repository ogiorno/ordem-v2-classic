# Spec — Ficha da Origem: o que ela concede (UI/UX)

Pedido do Geh (21/10/2026), a partir da ficha "Origem: Segurança Ex-Panacea" (abas só **Descrição** e **Efeitos**, ambas vazias de informação útil).

> **Status (21/10/2026): Todas as fases entregues (1 a 5).** A confirmação de troca (Fase 3) lista o que se perde e o que se ganha (`originLoss`, `originSwapHtml`; teste ao vivo `origens-troca-live-test.js`, 10/10). D4: o jogador escolhe também no Amnésico. Testes: `origens-concessoes.test.mjs` (183), `origens-live-test.js` (459/459, 57 origens), `npm test` 1530/1530. Dados de Arquivos Secretos: `tools/origens/build-as.mjs` (gera `packs/_source`) e `make-apply.mjs` (aplica nos compêndios vivos).

## 1. Problema

A ficha do item de origem mostra só a descrição do livro. Quem abre não vê **quais perícias** a origem treina, **qual habilidade** ela dá nem **que buff** vem junto. Na origem "Segurança Ex-Panacea" a descrição é só "página 66 do Arquivos Secretos 6": não há nada para ler.

## 2. O que já funciona (não refazer)

| Comportamento | Onde | Cobertura |
|---|---|---|
| Perícias da origem entram no livro-caixa, travadas 🔒 | `skill-training.mjs` `applyOrigin`, tabela `ORIGIN_TRAINING` | `pericias-treinadas*.test.mjs`, live 52/52 |
| Poder da origem entra na ficha, marcado `granted.source = id da origem` | `level-progression.mjs` `grantOriginPower` | `sobrevivendo-ao-horror.test.mjs` |
| Buff do poder (PV, PE, Defesa, perícia…) é Efeito Ativo no próprio poder | `passive-effects.mjs` | `passive-effects.test.mjs`, live 220/220 |
| Apagar a origem apaga o poder e as entradas de perícia | hooks `deleteItem` nos dois módulos | novo: `origens-concessoes.test.mjs` + `origens-live-test.js` |
| Trocar a origem arrastando outra (confirma e apaga a antiga) | `actor-sheet.mjs` `_onDropItem` | novo: live (troca em cadeia de 46 origens) |

## 3. Requisitos

**OR-1 — Seção "O que esta origem concede"** na aba Descrição (acima do texto do livro), calculada por `originGrantsView` (`module/helpers/origin-grants.mjs`, pura):
- **Perícias treinadas** (nomes das duas; Profissão nomeada ou "você escolhe qual"; "1 à sua escolha" no Profetizado; "O Mestre escolhe 2" no Amnésico).
- **Habilidade**: nome e resumo de uma frase do poder da origem.
- **Buff automático**: uma linha por efeito de ficha (ex.: "+5 PV", "+2 em Defesa").
- Habilidade sem buff de ficha: uma linha explicando o motivo ("Sem buff automático: …", texto de `MANUAL_REASONS`).
- Origem sem dados (Arquivos Secretos pendentes, ver OR-6): aviso "perícias ainda não cadastradas".

**OR-2 — Links para o Grimório.** Cada perícia e a habilidade da seção são `<a class="op-gr-link">` (`grimoireLinkHtml({kind:"skill"|"power", name})`), abrindo o Grimório na descrição da perícia/poder. A descrição da perícia **não** é copiada para a ficha da origem: a origem aponta e o Grimório explica.

**OR-3 — Ao pôr a origem na ficha** (já ocorre; a tela só passa a anunciar): as perícias são treinadas, o poder é criado e o buff liga. A seção do item usa as mesmas linhas, então o que está escrito é o que acontece.

**OR-4 — Trocar a origem remove tudo o que ela deu.** Ao apagar ou substituir a origem, saem da ficha:
1. o poder com `granted.source` = origem antiga (e com ele os Efeitos Ativos de buff);
2. as entradas do livro-caixa com `sourceItem` = origem antiga (perícias deixam de estar treinadas, salvo se outra fonte as treina);
3. o nome da Profissão livre escolhida na origem antiga.
O que veio de classe, trilha, poderes manuais ou escolha do jogador **fica**. Função pura `originRemovalPlan` descreve o que sai; o confirmar da troca lista isso ("Você perde: Pontaria, Tática, Para Bellum").

**OR-5 — Cobrir todas as origens.** Testes iteram o compêndio inteiro (55 origens), não uma amostra.

**OR-6 — Origens de Arquivos Secretos sem dados** (9 do compêndio + 2 que nem estão nele). O texto do livro existe em `regras/rascunhos/arquivos-secretos/origens/`:

| Origem | Perícias | Poder |
|---|---|---|
| Cientista Ex-Panacea | Atualidades, Ciências | Existe uma Explicação |
| Cobaia Sobrevivente | Fortitude, Vontade | Forças para Enfrentar |
| Segurança Ex-Panacea | Luta, Pontaria | Técnicas de Contenção |
| Caçador de Recompensas | Crime, Investigação | Quem Não Arrisca, Não Petisca |
| Influencer Paranormal | Enganação, Tecnologia | Registrar o Paranormal |
| Ufólogo | Ciências, Ocultismo | Minha Teoria Absurda |
| Funcionário de Beira de Estrada | Fortitude, Intuição | Turno Invertido |
| Transtornado Arrependido | Luta, Ocultismo | Sofrimento de Sangue |
| Ferido por Ritual | Ocultismo + 1 pelo elemento (Fortitude/Sangue; Vontade/Morte e Conhecimento; Reflexos/Energia) | Mácula Ritualística |
| Exorcizado (fora do compêndio) | Fortitude, Ocultismo | O Que Restou |
| Sensitivo Rebelde (fora do compêndio) | Intuição, Vontade | Sussurros e Vultos |

Entrega: (a) cadastrar as perícias em `ORIGIN_TRAINING` e tirar o nome de `ORIGIN_PENDING`; (b) criar os poderes em `originPowers/arquivos-secretos` e preencher a descrição da origem com "Perícias treinadas. X e Y." (hoje só diz "página 66"); (c) criar as 2 origens ausentes. Poderes condicionais ficam sem buff, com motivo (`condicional`/`acao`/`narrativa`); só Caçador de Recompensas (+2 em resistência a medo/mental) e Turno Invertido (+2 contra inconsciência) são candidatos a buff futuro.
Ferido por Ritual pede a escolha do elemento ao pôr na ficha (a perícia extra depende dele): usar o diálogo `.op-skill-choice` existente.

**OR-7 — Estado vazio e acessibilidade.** Sem poder: "Esta origem não concede habilidade própria." (só se há perícias). Links com `role="button"` e `tabindex` (já no helper). Sem cor como única informação: ícone + texto.

**OR-8 — Diálogo de escolha de perícias** (print "Cobaia Sobrevivente: Escolha do Mestre… Perícia 1 (Mestre) / Perícia 2 (Mestre)").
Hoje o diálogo aparece para as 9 origens de Arquivos Secretos só porque `ORIGIN_PENDING` não tem as perícias, e pede que o **Mestre** escolha. Isso está errado: o livro já fixa as perícias dessas origens (Cobaia Sobrevivente = Fortitude e Vontade).
- **Origem que já diz as perícias nunca abre diálogo.** Com OR-6 feito, `ORIGIN_PENDING` fica vazio e nenhuma origem fixa pergunta nada; o jogador só vê o aviso "Você recebeu: Fortitude, Vontade" (toast ou linha no contador), sem clique.
- **Quem escolhe é o próprio jogador**, nunca o Mestre. `chooser: "gm"`, o texto "Escolha do Mestre" e o rótulo "(Mestre)" saem do fluxo; `mayChoose` deixa de exigir `game.user.isGM`. Enquanto OR-6 não chega, o diálogo das origens pendentes vira escolha do jogador, e o Mestre só pode editar depois pelo contador.
- **O diálogo só existe quando a regra pede escolha:** Profetizado (1 livre), Ferido por Ritual (perícia do elemento), Engenheiro/Executivo/Operário (nome da Profissão) e, se mantida (D4), Amnésico.
- **Melhorias de UI do diálogo** (`.op-skill-choice`):
  1. título "Escolha suas perícias" e linha de contexto "Origem: X — você treina {N} perícia(s) à sua escolha";
  2. perícias já fixas da origem aparecem como chips travados 🔒 acima dos seletores ("Já treinadas: Luta, Pontaria"), para o jogador ver o que veio de graça;
  3. rótulos "Perícia 1", "Perícia 2" sem "(Mestre)"; o seletor mostra só perícias ainda destreinadas, agrupadas por atributo, com o nome do atributo ao lado;
  4. o segundo seletor remove a opção escolhida no primeiro; "Confirmar" fica desabilitado até todas as vagas estarem preenchidas;
  5. cada opção tem link 📖 para o Grimório (descrição da perícia) ao lado do seletor;
  6. "Decidir depois" continua, deixando a vaga pendente no contador com o botão **Escolher**.
- Teste: unitário (`originPlan` de nenhuma origem retorna `pending` nem `gm` para jogador; origem com perícias fixas não gera vaga de escolha) e ao vivo (por origem fixa: nenhum `.op-skill-choice` aparece ao pôr na ficha; Profetizado: aparece com 1 seletor e sem a palavra "Mestre").

## 4. Layout (aba Descrição)

```
┌ Origem: Militar ───────────────────────────┐
│ [ícone]  Militar                            │
│  Descrição | Efeitos                        │
│ ▌O QUE ESTA ORIGEM CONCEDE                  │
│   Perícias treinadas: 📖 Pontaria · 📖 Tática│
│   Habilidade: 📖 Para Bellum                │
│     +2 em dano com armas de fogo…           │
│   Sem buff automático: (motivo)             │
│ ▸ DESCRIÇÃO DO ITEM        (recolhida)      │
│ ▸ DESCRIÇÃO PARA CHAT                       │
└─────────────────────────────────────────────┘
```
Seção fixa, aberta por padrão; descrições do livro ficam recolhíveis como hoje. Mesmo estilo dos cartões de `item-description.hbs`; novo parcial `templates/item/parts/item-origin-grants.hbs` e parte `originGrants` em `item-sheet.mjs` (`case "origin"`).

## 5. Testes

- **Unitário** `tests/unit/origens-concessoes.test.mjs` (`npm test`): para cada uma das 55 origens — regra de perícias cadastrada, bate com o texto "Perícias treinadas" da descrição, tela mostra perícias/poder/links; toda origem do livro e do Sobrevivendo ao Horror acha seu poder; nenhum poder órfão; buffs aparecem; `originRemovalPlan`. Resultado atual: 150 passam, 0 falham, **27 `todo`** = as 9 origens de Arquivos Secretos × 3 verificações (viram teste de verdade quando OR-6 for feito).
- **Ao vivo** `docs/macros/origens-live-test.js`: agente temporário, põe cada uma das 46 origens com dados em sequência (cada troca apaga a anterior), confere perícias treinadas, poder concedido e marcado, ausência de resíduo da origem anterior, um único poder de origem; no fim apaga a origem e confere ficha limpa. Resultado: **277/277**, agente apagado.
- Falta testar ao vivo (depende de implementar): a seção na ficha do item (render, links abrindo o Grimório) — verificar com `npm run render-check` + captura da ficha.

## 6. Fases

1. **Fase 1 (feita)**: `origin-grants.mjs` + testes unitário e ao vivo (cobertura de todas as origens e da troca).
2. **Fase 2**: seção na ficha do item (OR-1, OR-2, OR-7), lang pt-BR/en, CSS, `render-check`.
3. **Fase 3**: confirmação de troca listando o que se perde (OR-4, texto).
4. **Fase 4**: dados de Arquivos Secretos (OR-6); remover os `todo`.
5. **Fase 5**: diálogo de escolha feito pelo jogador e redesenhado (OR-8). Pode vir antes da Fase 4 se a escolha do Mestre incomodar já.

## 7. Decisões em aberto

- **D1** Ferido por Ritual: perícia do elemento escolhida na hora ou deixada pendente no contador?
- **D2** Mostrar na seção o limite de "1 poder de origem" ou só a lista?
- **D4** Amnésico: o livro diz que o Mestre escolhe as duas perícias. Seguir o pedido (o jogador escolhe) ou manter o Mestre só nessa origem?
- **D3** Origens exclusivas do suplemento (Exorcizado, Sensitivo Rebelde): entram no compêndio `origins` já na Fase 4?
