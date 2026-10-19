# Relatório: todas as armas do jogo (18/10/2026)

Teste: `scripts/ui-todas-armas.js`. Seis agentes de ficha completa e 46 armas do compêndio, uma por uma, em duas camadas. Atores "[TA]" e cartões foram apagados no fim; a cena ativa não mudou.

## Agentes usados (ficha completa)
Todos com classe, nível, os cinco atributos, PV, PE/PD e treino nas perícias de combate (Luta, Pontaria, Reflexos, Fortitude, Percepção, Iniciativa, Vontade, Tática, Atletismo, Acrobacia).

| Agente | Nível | Atributos (FOR/AGI/VIG/INT/PRE) | Treino |
|---|---|---|---|
| NEX 5 Combatente | 1 | 3/2/3/1/1 | 5 |
| NEX 25 Especialista | 5 | 1/3/2/3/2 | 5 |
| NEX 50 Ocultista | 10 | 2/2/2/2/4 | 10 |
| NEX 75 Combatente | 15 | 4/3/4/1/1 | 10 |
| NEX 99 Combatente | 20 | 5/4/5/1/1 | 15 |
| NEX 99 Especialista | 20 | 0/5/3/4/2 | 15 |

## Resultado
- **Camada A (código): 534 combinações** (cada arma × cada agente × cada modo possível), **0 falhas**. Confere o número e o modo dos d20 (inclusive 0 dados → 2d20 pior), o treino somado, os dados do dano, o atributo somado ao dano, o dado extra da rajada e o dano da coronhada.
- **Camada B (interface): 46 de 46 armas**, 89 ataques com clique de mouse: 46 normais, 26 arremessos, 14 coronhadas, 3 rajadas. Em cada uma: a tela de ataque abre, mostra alcance e crítico, oferece exatamente os modos da arma, mostra a escolha Força/Agilidade só nas ágeis, a rolagem sai com o número certo de d20 e o botão de dano do cartão rola o dano certo (ou o múltiplo, se foi crítico).
- Único aviso do navegador: "o que você carrega não pode ultrapassar o dobro do peso máximo", esperado por pôr as 46 armas na mesma ficha.

## Armas testadas
| Arma | Tipo | Ataque | Dano | Crítico | Alcance | Peculiaridades |
|---|---|---|---|---|---|---|
| Acha | corpo a corpo | fighting/str | 1d12+str | x3 | — | — |
| Arco | disparo | aim/dex | 1d6 | x3 | Médio | — |
| Arco composto | disparo | aim/dex | 1d10+str | x3 | Médio | — |
| Baioneta | corpo a corpo | fighting/str | 1d4+str | 19 | — | — |
| Balestra | disparo | aim/dex | 1d12 | 19 | Médio | — |
| Bastão | corpo a corpo | fighting/str | 1d6+str | x2 | — | adaptável |
| Bastão Policial | corpo a corpo | fighting/str | 1d6+str | x2 | Curto | ágil |
| Bazuca | fogo | aim/dex | 10d8 | x2 | Médio | coronhada |
| Besta | disparo | aim/dex | 1d8 | 19 | Médio | — |
| Cajado | corpo a corpo | fighting/str | 1d6+str | x2 | — | ágil |
| Corrente | corpo a corpo | fighting/str | 1d8+str | x2 | — | — |
| Espada | corpo a corpo | fighting/str | 1d8+str | 19 | — | adaptável |
| Espingarda | fogo | aim/dex | 4d6 | x3 | Curto | coronhada |
| Espingarda de Cano Duplo | disparo | aim/dex | 4d6 | x3 | Curto | coronhada |
| Estilingue | disparo | aim/dex | 1d4+str | x2 | Curto | — |
| Faca | corpo a corpo | fighting/str | 1d4+str | 19 | Curto | ágil, arremessável |
| Faca Tática | corpo a corpo | fighting/str | 1d6+str | 19 | Curto | ágil, arremessável |
| Florete | corpo a corpo | fighting/str | 1d6+str | 18 | — | ágil |
| Fuzil Alheio | fogo | aim/dex | 2d10 | 19/x3 | Longo | coronhada |
| Fuzil de Assalto | fogo | aim/dex | 2d10 | 19/x3 | Médio | automática, coronhada |
| Fuzil de Caça | fogo | aim/dex | 2d8 | 19/x3 | Médio | coronhada |
| Fuzil de Precisão | fogo | aim/dex | 2d10 | 19/x3 | Longo | coronhada |
| Gadanho | corpo a corpo | fighting/str | 2d4+str | x4 | — | — |
| Gancho de Carne | corpo a corpo | fighting/str | 1d4+str | x4 | — | — |
| Katana | corpo a corpo | fighting/str | 1d10+str | 19 | — | ágil |
| Lança | corpo a corpo | fighting/str | 1d6+str | x2 | Curto | arremessável |
| Lança-chamas | fogo | aim/dex | 6d6 | x2 | Curto | coronhada |
| Maça | corpo a corpo | fighting/str | 2d4+str | x2 | — | — |
| Machadinha | corpo a corpo | fighting/str | 1d6+str | x3 | Curto | arremessável |
| Machado | corpo a corpo | fighting/str | 1d8+str | x3 | — | — |
| Machete | corpo a corpo | fighting/str | 1d6+str | 19 | — | — |
| Marreta | corpo a corpo | fighting/str | 3d4+str | x2 | — | — |
| Martelo | corpo a corpo | fighting/str | 1d6+str | x2 | — | — |
| Metralhadora | fogo | aim/dex | 2d12 | 19/x3 | Médio | automática, coronhada |
| Montante | corpo a corpo | fighting/str | 2d6+str | 19 | — | — |
| Motoserra | corpo a corpo | fighting/str | 3d6+str | x2 | — | — |
| Nunchaku | corpo a corpo | fighting/str | 1d8+str | x2 | — | ágil |
| Picareta | corpo a corpo | fighting/str | 1d6+str | x4 | — | — |
| Pistola | fogo | aim/dex | 1d12 | 18 | Curto | coronhada |
| Pistola Pesada | fogo | aim/dex | 2d8 | 18 | Curto | coronhada |
| Pregador Pneumático | disparo | aim/dex | 1d4 | x4 | Curto | — |
| Punhal | corpo a corpo | fighting/str | 1d4+str | x3 | Pessoal | ágil |
| Revólver | fogo | aim/dex | 2d6 | 19/x3 | Curto | coronhada |
| Revólver Compacto | fogo | aim/dex | 2d4 | 19/x3 | Curto | coronhada |
| Shuriken | disparo | aim/str | 1d4 | x2 | Curto | arremessável |
| Submetralhadora | fogo | aim/dex | 2d6 | 19/x3 | Curto | automática, coronhada |

## O que o teste NÃO pega: regras próprias de cada arma
**Atualização:** os itens 6 e 7 (área, Corrente, recarga, Cajado) foram tratados em `docs/arquivo/spec-armas-area-recarga.md`; os itens 1 a 5 e o item 8 (exceto Bastão Policial e Punhal) foram implementados/corrigidos; ver "Regras próprias de cada arma" em `docs/arquivo/spec-tela-de-ataque.md`. Abaixo, o texto original da auditoria.
O teste confere o que está implementado. Lendo o texto de cada arma no livro, ficam sem efeito:
1. **Empunhadura muda o dano** (o ponto que você citou): Bastão é 1d6 com uma mão e 1d8 com duas; Espada 1d8 com uma e 1d10 com duas. A tela deixa escolher a empunhadura da Espada/Bastão (marcados como adaptáveis) e da Katana, mas só registra no cartão: **o dano não muda**. Katana não está marcada como adaptável nos dados (só pelo nome no código) e a exigência de veterano em Luta não é verificada.
2. **Motosserra**: −1d20 em todos os ataques e um dado extra a cada 6 no dano. Nada disso é aplicado.
3. **Metralhadora**: −5 no ataque sem Força 4 ou sem apoiar no tripé. Não aplicado.
4. **Espingarda e Espingarda de Cano Duplo**: metade do dano no alcance médio ou maior. Não aplicado.
5. **Fuzil de Precisão**: +5 na margem de ameaça para veterano em Pontaria que mirou. Não aplicado.
6. **Bazuca e Lança-chamas**: dano em área (raio de 3 m; linha de 1,5 m) com Reflexos e Em Chamas. Não existe fluxo de área para armas; só o ataque único.
7. **Corrente**: +2 em desarmar e derrubar. **Balestra/Besta**: recarga por ação de movimento. **Cajado**: conta como arma de uma mão com Combater com Duas Armas.
8. Dados das armas a revisar: **Shuriken** ataca com Pontaria usando FOR (as outras de disparo usam AGI); **Bastão Policial** tem alcance "Curto" mas não é arremessável; **Punhal** tem alcance "Pessoal", que o sistema não conhece (tratado como corpo a corpo); **Espingarda de Cano Duplo** e **Pregador Pneumático** estão como "disparo", embora sejam armas de fogo.

## Não coberto
Munição e recarga; ataques contra alvo com Defesa (o confronto foi testado antes); dois ou mais alvos; efeitos de crítico além do múltiplo de dano; modificações de arma (o jogo não tem itens de modificação).
