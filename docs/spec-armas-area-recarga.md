# Spec — Regras de arma que faltavam: Corrente, recarga, Cajado, Bazuca, Lança-chamas e Em Chamas

Origem: itens 6 e 7 de `docs/relatorio-todas-armas.md` e as lacunas de `docs/spec-tela-de-ataque.md` ("Regras próprias de cada arma"). Texto das armas: Livro de Regras v1.3, cap. 3, "Descrição das armas". Fluxo: esta spec → testes (unitários e pela interface) → implementação.

## 1. Corrente — +2 para desarmar e derrubar
- Na tela de ataque da Corrente aparece a caixa **"Desarmar ou derrubar (+2)"**, desmarcada.
- Marcada: `+2` fixo no teste de ataque e a linha "Corrente: +2 para desarmar/derrubar" no cartão. Não vale na coronhada nem no arremesso.
- Não existe fluxo de manobra no sistema: a caixa só dá o bônus ao teste que o jogador declara.

## 2. Recarga — Balestra, Besta e Bazuca (uma ação de movimento a cada disparo)
- Depois de cada ataque com a arma, o item guarda `flags.ordem_v2_classic.reload = { pending: true }` (ato de atacar, acertando ou não).
- Com a recarga pendente, a tela mostra a caixa **"Recarreguei (ação de movimento)"**, desmarcada, e o botão Atacar fica **desabilitado** com o motivo "Recarregue a arma (ação de movimento) antes de atacar de novo." enquanto ela não for marcada.
- Ao atacar com a caixa marcada, a recarga é consumida e o novo disparo volta a deixá-la pendente.
- Shift+clique e macros também respeitam: com recarga pendente avisam o motivo e não rolam (a recarga se declara na tela).
- A coronhada e o arremesso não gastam a munição nem a recarga (não é um disparo).
- Só vale para agentes (ameaças atacam direto, como em todas as telas).
- Lacuna assumida: não há contagem de munição; só a recarga entre disparos.

## 3. Cajado — conta como arma de uma mão e leve
- O bloco "A arma" mostra a linha informativa: "Conta como arma de uma mão e uma arma leve para Combater com Duas Armas e poderes parecidos."
- Sem efeito mecânico: esses poderes ainda não estão integrados à tela (lacuna registrada na spec da tela de ataque).

## 4. Em Chamas (condição nova)
- Entra no catálogo de condições (`helpers/conditions.mjs`) como `burning`, nome "Em Chamas", sem mexer na Defesa.
- Regra: no início do turno de quem está em chamas, sofre **1d6 de dano de fogo** (ignora nada; usa a resistência a fogo); gastar uma ação padrão apaga as chamas (o jogador remove a condição pela tela de ataque ou pela ficha).
- Não acumula: aplicar de novo a quem já está em chamas não duplica o efeito.
- Texto da regra mostrado na tela de ataque (`CONDITION_RULES`).

## 5. Bazuca — dano em raio de 3 m
- Raio de 3 m = **2 quadrados**, medidos do centro do alvo marcado (ou do ponto, veja abaixo).
- **Ataque normal**: se o ataque acerta, o alvo atingido recebe o dano inteiro (fluxo normal do cartão). Todos os outros seres a até 2 quadrados do alvo (aliados também) fazem um teste de **Reflexos contra DT = 10 + Agilidade de quem atirou**; quem passa sofre metade do dano (arredondado para baixo), quem falha sofre o dano inteiro. Se o ataque erra, não há explosão (decisão: o livro só descreve o dano em quem é atingido).
- **Modo "Disparar num ponto"** (só em alcance médio; aparece para a Bazuca): não rola ataque, não pode errar e ninguém é atingido diretamente. O ponto é a posição do alvo marcado (exige exatamente um alvo marcado); **todos** os seres no raio, inclusive o do ponto, fazem Reflexos pela metade. O dano é rolado na hora, sem passar pelo botão do cartão.
- O dano é um único rolamento, o mesmo para todos. Um relatório no chat lista cada ser: teste, resultado e PV tirados.
- Quem atira nunca entra na lista. Seres sem ficha de PV (sem ator) são ignorados.

## 6. Lança-chamas — linha de 1,5 m até o alcance curto
- Área: uma linha de **1 quadrado de largura** que sai do centro de quem ataca em direção ao alvo marcado e vai até **6 quadrados** (alcance curto). Não alcança além.
- **Um único teste de ataque**, comparado com a Defesa de **cada** ser que a linha cobre (o centro do ser a até meio quadrado da linha, e a partir de 0 até 6 quadrados de distância). Quem tem Defesa maior que o total não é atingido.
- Quem é atingido sofre o dano (um único rolamento para todos, crítico se o ataque foi crítico) e fica **Em Chamas**. O alvo marcado segue o fluxo normal do cartão; os demais são resolvidos pelo relatório, no mesmo clique do botão de dano.
- Quem ataca nunca entra na lista.

## Onde fica no código
- Regras puras (testadas em `npm test`): `weaponRules()` em `weapon-rules.mjs` (Corrente, recarga, Cajado), `weapon-area.mjs` (geometria e resultado da área), `conditions.mjs` (Em Chamas), `turn-effects-rules.mjs` (dano das chamas).
- Foundry: `attack-options.mjs` (tela e bloqueio), `item.mjs` (guardar a recarga, `rollDamage` chama a resolução da área), `weapon-area-resolve.mjs` (acha os seres no mapa, rola Reflexos, aplica dano e condição, posta o relatório), `ritual-area-engine.mjs` (dano das chamas no início do turno).

## Verificação
| Camada | O que cobre |
| --- | --- |
| `npm test` | Corrente +2 só marcada e só no ataque normal; recarga pendente/consumida e motivo; Cajado informativo; geometria do raio (2 quadrados) e da linha (largura, comprimento, atrás do atirador); DT 10 + AGI; metade arredondada para baixo; Defesa x total do Lança-chamas; catálogo com Em Chamas e dano 1d6 de fogo |
| Interface (`scripts/ui-armas.js`, atores "[AR]") | Corrente: caixa e +2 na fórmula; Besta: primeiro ataque livre, segundo bloqueado até marcar a recarga, depois libera; Cajado: linha informativa; Bazuca: três ameaças em posições diferentes (dentro e fora do raio) recebem o relatório certo, o modo "Disparar num ponto" não rola ataque; Lança-chamas: seres na linha são testados contra a Defesa, os atingidos ficam Em Chamas, fora da linha e atrás não; Em Chamas aparece como condição e tem o dano de fogo no início do turno |

## Lacunas conhecidas (planejadas)
- Lança-chamas: se o ataque erra o alvo marcado, o botão de dano do cartão fica desabilitado e a linha não é resolvida, mesmo que o único ataque alcançasse a Defesa de outro ser na linha.
- Bazuca: com o alvo atingido sendo o único dado do cartão, o dano no alvo vem do botão do cartão (fluxo normal); o relatório cobre só os demais.
- Combater com Duas Armas e poderes parecidos ainda não existem na tela (o Cajado só informa).
- O "ponto" da Bazuca é a posição do alvo marcado, não um clique livre no mapa.
- Munição por quantidade continua fora; só a recarga entre disparos.
- Reação de esquiva/bloqueio dos seres atingidos pela área não é perguntada (o teste de Reflexos da Bazuca é automático).

## Resultado (19/10/2026)
| Camada | Como rodar | Resultado |
| --- | --- | --- |
| Regras puras | `npm test` (`weapon-rules.test.mjs`, `weapon-area.test.mjs`) | 311/311 |
| Interface, regras novas (AR-59 a AR-70) | `scripts/ui-armas.js` como Mestre | 69/69 na última execução completa |
| Interface, todas as armas | `scripts/ui-todas-armas.js` | camada A 534/534 (agora o treino somado é conferido de verdade); camada B 42/46 na passada completa e 10/10 ao repetir só as 4 que falharam mais as armas novas (Lança, Katana, Acha, Shuriken, Bazuca, Besta, Balestra, Corrente, Cajado, Lança-chamas) |

As 4 falhas da passada completa eram rolagens de outros usuários caindo no chat do teste (fórmulas `2d20kh`/`1d20` que não eram da arma testada) e não se repetiram.
Achados na execução: o guarda de "área já resolvida" usava o cartão do ataque anterior no disparo num ponto (corrigido: o ponto não tem cartão); o dano pelo botão do cartão passa por `attackResults`, que não carregava o token e o total do ataque (agora carrega).
