# Relatório — efeitos que agem a cada turno (condições, rituais, criaturas)

Data: 18/10/2026. Teste feito no mundo `nova-ordem`, numa cena temporária ("ZZ turnos (teste)") com 2 usuários jogadores novos
(DT Jogador 1 e 2, cada um dono de um agente), 2 ameaças e um combate real. Tudo foi apagado no fim. Nenhuma ficha do Geh foi tocada.

## 1. O que o jogo faz hoje

| Caso testado | Resultado | Observação |
| --- | --- | --- |
| Agente **Sangrando**, turno dele começa | Rola Vigor sozinho (tirou 8, DT 20), falhou, perdeu 1d6 PV (5) | **O jogador não foi consultado.** O teste roda no navegador do Mestre e só aparece no chat. |
| Ameaça **Sangrando**, turno dela começa | Rolou sozinho, perdeu 1 PV | Correto para criatura: o Mestre rola. |
| Ameaça com **Cura Acelerada 5** | Recuperou 5 PV no início do turno, com aviso ao Mestre | Funciona. |
| Agente com 10 status ligados (Em chamas, Envenenado, Doente, Degeneração, Amedrontado, Amaldiçoado, Congelado, Eletrizado, Corroendo, Regenerando) | **Nada acontece.** PV igual, nenhuma mensagem | Os ícones existem na lista de status, mas não têm regra. |
| Agente a **0 PV (morrendo)** quando o turno chega | Nada acontece, nenhum efeito, nenhum contador | O sistema só devolve a palavra "morrendo" no resultado do dano. |
| Jogador rodando Vigor e mexendo no próprio PV no navegador dele | Funciona (dono da ficha pode) | Prova que o pedido de teste ao jogador é possível sem passar pelo Mestre. |
| Ritual de área com efeito no turno (Miasma, Deflagração, Presença do Medo...) | Só afeta **ameaças** (`isEnemy`); agentes dentro da área são ignorados | Vale quando o agente conjura; não existe o caminho inverso (criatura conjurando contra agente). |

Condição mecânica pronta no código: só as 8 de `conditions.mjs` (Vulnerável, Atordoado, Agarrado, Surdo, Silenciado, **Sangrando**, Enjoado, Sem recuperar PV).
Só o Sangrando tem efeito por turno.

## 2. Por que o jogador não é consultado

`processConditionsAtTurnStart` (em `ritual-area-engine.mjs`) roda só no Mestre ativo e chama `autoRoll(actor, "resilience", 20)`: a rolagem
sai sem diálogo, em nome do agente. O sistema já tem canal de socket, mas só no sentido **jogador → Mestre** (reações, teste de ritual).
Falta o sentido **Mestre → jogador**.

## 3. Proposta de fluxo (jogador e criatura)

**Um único motor de "efeito de turno"**, em vez de um código por condição. Cada efeito é um dado com: quando dispara (início/fim do turno),
o teste (perícia e DT), o dano ou cura (fórmula, tipo, se ignora RD), o que acontece se passar (encerra, reduz, nada) e se falhar.

1. **Agente (jogador)**: no início do turno o Mestre posta um **cartão de teste** no chat, visível a todos, com o efeito, a DT e o botão
   **"Rolar Vigor"**. Só o dono da ficha (ou o Mestre) vê o botão ativo. Ao clicar, a rolagem sai com a carta normal da perícia e o resultado
   dispara o dano ou o fim do efeito automaticamente. O turno não é bloqueado, o cartão fica pendente.
2. **Plano B**: se o dono não estiver conectado, ou o Mestre clicar "rolar pelo jogador", o motor rola sozinho (comportamento de hoje).
   Uma opção do mundo escolhe o padrão: *Perguntar ao jogador* (novo padrão) ou *Rolar automático*.
3. **Criatura**: continua automático no Mestre, sempre. Uma linha só no chat para o Mestre (sussurro), sem cartão.
4. **Sem teste (dano fixo, ex.: Em chamas)**: aplica sozinho para todos e avisa no chat. O jogador só é consultado quando a regra pede um teste
   ou uma escolha (apagar o fogo gastando ação).
5. **Fim do efeito**: o cartão mostra "estancou" ou "continua". Ao passar, o efeito ativo é removido; contador de turnos/rodadas diminui sozinho.
6. **Ordem**: efeitos de turno rodam em sequência no início do turno, com um único cartão resumindo, para não inundar o chat.
7. **Teste de aceitação**: o mesmo cenário usado aqui (dois jogadores + ameaça + combate) vira roteiro fixo.

Esforço estimado: cartão com botão + socket Mestre→dono (pequeno, o padrão de botão em cartão já existe nos rituais), tabela de efeitos de turno (médio),
conteúdo dos efeitos abaixo (médio).

## 4. Proposta por efeito de status

"Regra" = o que o Livro de Regras (v1.3) diz; itens marcados com (?) precisam de conferência no livro antes de implementar.

| Status | Hoje | Proposta |
| --- | --- | --- |
| Sangrando | Automático, sem perguntar | **Cartão com botão** para jogador (Vigor DT 20, falha = 1d6 PV, passou = estancou); automático em criatura. |
| Em chamas | Sem efeito | Dano de fogo no início do turno sem teste (1d6, tipo fogo, respeitando RD); botão "apagar" (ação padrão) que remove o efeito. (?) valor exato |
| Envenenado | Sem efeito | Dano e duração vêm do veneno: o efeito guarda fórmula e tipo; teste de Fortitude se a regra do veneno pedir. |
| Doente | Sem efeito | Fica como marcador com texto da regra; teste de Vigor periódico só se a doença definir. |
| Degeneração / Regenerando | Sem efeito | Dano ou cura por turno com valor no efeito (mesmo mecanismo de Cura Acelerada da ameaça). |
| Corroendo | Sem efeito | Dano químico por turno, ignora RD (?). |
| Congelado / Eletrizado | Sem efeito | Penalidades no mesmo molde das condições com dados a menos; sem dano por turno, salvo regra. |
| Amedrontado / Fear | Sem efeito | Penalidade em testes (dado a menos), sem ação por turno. |
| Amaldiçoado | Sem efeito | Marcador com texto; efeito vem do ritual. |
| Morrendo (0 PV) | Nada | Contador de rodadas no início do turno e teste conforme o livro (?). Mesmo cartão para o jogador; para criatura, automático. |
| Atordoado, Agarrado, Surdo, Silenciado, Enjoado, Vulnerável, Sem recuperar PV | Já têm mecânica, sem dano por turno | Nada a mudar no turno. |

## 5. Proposta por ritual com efeito no turno (17 achados no texto)

Os que o jogo já automatiza (só contra ameaças): Paradoxo, Miasma Entrópico, Deflagração de Energia, Esfolar, Eletrocussão, Decadência, Poeira da Podridão,
Presença do Medo, Tentáculos de Lodo, Purgatório, Aurora da Verdade, Dissonância Acústica, Tecer Ilusão.

Os que **ficam só no texto** e precisam do motor novo (alvo único, efeito que acompanha o alvo):

| Ritual (círculo) | Efeito no turno | Proposta |
| --- | --- | --- |
| Chamas do Caos (2) | Objeto sofre 1d6 fogo por rodada e queima quem o segura | Efeito de turno no portador: dano sem teste enquanto durar. |
| Descarnar (2) | No início do turno do alvo, Fortitude; falha = 2d8 Sangue; passar 2 turnos seguidos encerra | Cartão de teste (jogador) / automático (criatura); contador de sucessos. |
| Ferver Sangue (3) | Ao conjurar e no início de cada turno, Fortitude; falha = 4d8 Sangue e fraco, passar = metade | Cartão de teste; falha aplica a condição. |
| Âncora Temporal (3) | Início do turno, Vontade; falha = não pode se deslocar | Cartão de teste; falha aplica "imóvel" por 1 turno. |
| Fedor Pútrido (3) | 1d4 Morte por rodada de sustentação, ignora RD | Dano sem teste no conjurador, enquanto sustenta. |
| Mergulho Mental (3) | Início do turno do conjurador, Vontade do alvo; falha = responde | Cartão de teste ao dono do alvo. |
| Capturar o Coração (4) | Início do turno do alvo, Vontade; falha = ajuda o conjurador | Cartão de teste; resultado é só aviso (o Mestre/jogador age). |
| Convocar o Algoz (4) | Fim do turno do conjurador, o algoz anda 12 m; perto da vítima, Vontade | Lembrete + cartão de teste quando a distância fechar. |
| Fim Inevitável (4) | 100 de dano de Morte por rodada a quem inicia o turno na área | Zona que também afeta agentes (hoje só ameaças). |
| Flagelo de Sangue (2) | Cada rodada que desobedece: 10d6 Sangue e enjoado | Botão manual do Mestre "alvo desobedeceu" no cartão do ritual. |
| Hemofagia (2) | Ação padrão por rodada: 4d6 Sangue e cura metade | Botão de uso repetido no cartão (ação do conjurador, não do alvo). |
| Forma Monstruosa (3) | Deve atacar o mais próximo a cada rodada | Lembrete de turno ao Mestre; sem automação. |
| Eco Espiral (2), Invólucro de Carne (4), Velocidade Mortal (2) | Texto de ação/concentração | Lembrete de turno apenas. |

Sobre rituais lançados **por criatura** contra agentes: hoje não existe. A zona só reconhece ameaça como alvo. Proposta: o motor aceita "quem é o alvo"
(agente ou ameaça) em vez de fixar ameaça, e o teste do agente usa o cartão de jogador da seção 3.

## 6. Ordem sugerida

1. Cartão de teste para o jogador no Sangrando (o caso que você descreveu) + opção do mundo "Perguntar / Automático".
2. Motor de efeito de turno (dano fixo e teste), ligando Em chamas, Envenenado, Degeneração, Regenerando, Corroendo, Morrendo.
3. Rituais de alvo único (Descarnar, Ferver Sangue, Âncora Temporal, Mergulho Mental, Capturar o Coração, Chamas do Caos, Fedor Pútrido).
4. Zonas valendo também para agentes e rituais lançados por criaturas.
5. Roteiro de teste de aceitação com os dois jogadores e as duas ameaças.

## 7. Como foi testado

Scripts em `work/dt/` (pasta ignorada pelo git): `setup.js` cria usuários, agentes, ameaças, cena e combate; `t1.js` a `t3.js` rodam os casos;
`scan*.js` varrem o texto dos compêndios e rituais por regras de turno. Os dois jogadores entraram em navegadores separados.
Limites: o teste não implementou nada, só mediu o comportamento atual; as regras marcadas (?) não foram conferidas no livro.
