# Relatório de teste dos mapas de Santa Aurora

Teste feito no Foundry (v14) como Mestre, nas 30 cenas de interior (21 mapas; 9 cenas são cópias da pasta duplicada e deram o mesmo resultado das originais). O mapa da cidade ficou fora.

## O que foi testado

1. **Alinhamento com a imagem**: cada parede sólida foi comparada com a imagem, por dois métodos (faixa escura e contraste local).
2. **Portas** no motor do Foundry: fechada bloqueia movimento e visão, aberta deixa passar.
3. **Visão de um agente**: polígono de visão a partir de pontos dentro dos cômodos, desenhado sobre o mapa e conferido a olho.
4. **Movimento**: alcance entre cômodos passando pelas portas (janelas, paredes e grades bloqueiam).
5. **Escadas**: destino, retorno, posição do pino, da área azul e da chegada.

## Resultado por mapa

| Cena | Paredes | Portas | Janelas | Alinhamento (faixa escura / contraste) | Porta fechada bloqueia | Cômodos fora de alcance |
|---|---|---|---|---|---|---|
| Arquivo Municipal â€” Primeiro andar | 31 | 12 | 0 | 99% / 95% | 12/12 | 0 de 14 |
| Arquivo Municipal â€” SÃ³tÃ£o | 21 | 6 | 0 | 97% / 96% | 6/6 | 0 de 21 |
| Arquivo Municipal â€” TÃ©rreo | 33 | 9 | 1 | 98% / 100% | 9/9 | 5 de 19 |
| Casa 17 do Canal â€” Primeiro andar | 19 | 2 | 5 | 100% / 72% | 2/2 | 0 de 5 |
| Casa 17 do Canal â€” TÃ©rreo | 19 | 5 | 1 | 93% / 69% | 5/5 | 0 de 9 |
| Casa Augusto â€” Primeiro andar | 28 | 6 | 1 | 100% / 80% | 6/6 | 1 de 14 |
| Casa Augusto â€” Subsolo | 53 | 12 | 0 | 92% / 88% | 12/12 | 4 de 22 |
| Casa Augusto â€” TÃ©rreo | 35 | 7 | 5 | 100% / 100% | 7/7 | 2 de 8 |
| Casa Dona Nair â€” Primeiro andar | 21 | 3 | 3 | 100% / 64% | 3/3 | 0 de 14 |
| Casa Dona Nair â€” TÃ©rreo | 19 | 3 | 4 | 100% / 100% | 3/3 | 0 de 8 |
| Casa Helena â€” Primeiro andar | 33 | 5 | 7 | 93% / 56% | 5/5 | 0 de 15 |
| Casa Helena â€” TÃ©rreo | 23 | 6 | 4 | 100% / 50% | 6/6 | 0 de 10 |
| FrigorÃ­fico Aurora â€” Mezanino | 14 | 2 | 1 | 92% / 100% | 2/2 | 6 de 22 |
| FrigorÃ­fico Aurora â€” Subsolo | 57 | 10 | 0 | 90% / 95% | 10/10 | 8 de 20 |
| FrigorÃ­fico Aurora â€” TÃ©rreo | 55 | 20 | 0 | 92% / 96% | 20/20 | 5 de 25 |
| Garagem de AmbulÃ¢ncias â€” Primeiro andar | 47 | 5 | 0 | 68% / 97% | 5/5 | 5 de 13 |
| Garagem de AmbulÃ¢ncias â€” TÃ©rreo | 28 | 6 | 0 | 57% / 100% | 6/6 | 5 de 21 |
| Posto Sete Vidas â€” Primeiro andar | 24 | 4 | 9 | 21% / 96% | 4/4 | 0 de 13 |
| Posto Sete Vidas â€” TÃ©rreo | 34 | 9 | 0 | 72% / 99% | 9/9 | 1 de 14 |
| RÃ¡dio Aurora FM â€” Primeiro andar | 15 | 5 | 0 | 69% / 100% | 5/5 | 0 de 7 |
| RÃ¡dio Aurora FM â€” TÃ©rreo | 26 | 4 | 0 | 96% / 88% | 4/4 | 0 de 14 |

(Alinhamento: parte do comprimento das paredes sólidas que cai sobre a parede desenhada, a menos de 0,14 quadrado. Os dois métodos erram em lados diferentes: o da faixa escura falha em mapas de parede clara, o do contraste falha em piso de madeira. Uma parede só é suspeita quando os dois a reprovam.)

## Problemas encontrados

### 1. Cômodos sem entrada (movimento)
Cômodos que ficam fechados mesmo com todas as portas abertas. Falta porta ou passagem no traçado. Posições em unidades de 2000 px de largura do mapa (a mesma régua dos recortes).

- **Arquivo Municipal â€” TÃ©rreo**: (412,358), (668,232), (692,516), (210,560), (210,154)
- **Casa Augusto â€” Primeiro andar**: (1504,180)
- **Casa Augusto â€” Subsolo**: (1792,394), (1864,118), (1440,336), (1050,1128)
- **Casa Augusto â€” TÃ©rreo**: (1558,314), (1630,548)
- **FrigorÃ­fico Aurora â€” Mezanino**: (512,518), (1194,476), (828,458), (310,316), (1396,274), (626,256)
- **FrigorÃ­fico Aurora â€” Subsolo**: (444,628), (770,1000), (1184,1000), (194,1028), (478,996), (162,452), (162,738), (1394,922)
- **FrigorÃ­fico Aurora â€” TÃ©rreo**: (850,140), (1186,156), (1398,210), (1678,150), (1164,302)
- **Garagem de AmbulÃ¢ncias â€” Primeiro andar**: (670,980), (956,980), (1242,980), (1498,854), (1522,1138)
- **Garagem de AmbulÃ¢ncias â€” TÃ©rreo**: (744,172), (1030,172), (1316,160), (1602,150), (370,138)
- **Posto Sete Vidas â€” TÃ©rreo**: (266,316)

Parte disso é esperada: vãos de escada e áreas cercadas por grade (Frigorífico: mezanino e subsolo) não devem ser andáveis. Os casos que parecem erro de traçado, vistos no desenho: sala de leitura do Arquivo Municipal (térreo), a ala de serviço e a cozinha da Casa Augusto (térreo), os cômodos pequenos do alto à direita do Frigorífico (térreo) e a sala dos ventiladores e escada à direita do subsolo da Casa Augusto. O quintal dos fundos da Garagem (térreo) está cercado sem porta.

### 2. Portas que continuam bloqueando quando abertas
Provavelmente uma parede encostada na porta (canto). Conferir no mapa:

- Arquivo Municipal â€” TÃ©rreo: porta em (3368, 2132, 3368, 2576) (comprimento 444 px)
- Casa Augusto â€” Primeiro andar: porta em (8204, 3072, 8204, 3380) (comprimento 308 px)
- Casa Augusto â€” Primeiro andar: porta em (9332, 2580, 9332, 2980) (comprimento 400 px)
- Posto Sete Vidas â€” TÃ©rreo: porta em (1468, 1624, 1556, 1888) (comprimento 278 px)
- RÃ¡dio Aurora FM â€” Primeiro andar: porta em (3732, 2644, 4268, 2644) (comprimento 536 px)

Na cena ativa (Rádio Aurora FM — Térreo) o teste de porta aberta não foi feito, para não alterar a cena em uso.

### 3. Alinhamento
Nenhuma cena tem parede reprovada nos dois métodos acima de 4% do comprimento. Os piores casos, onde conferir primeiro:

- Casa Augusto â€” Subsolo: 1 parede(s) suspeita(s), por exemplo em [6932, 6452, 6932, 6564] (coordenadas de cena)
- Garagem de AmbulÃ¢ncias â€” Primeiro andar: 1 parede(s) suspeita(s), por exemplo em [6444, 3512, 5556, 3512] (coordenadas de cena)
- Posto Sete Vidas â€” Primeiro andar: 2 parede(s) suspeita(s), por exemplo em [732, 496, 1112, 496] (coordenadas de cena)
- Posto Sete Vidas â€” TÃ©rreo: 1 parede(s) suspeita(s), por exemplo em [4332, 2668, 4332, 2400] (coordenadas de cena)
- RÃ¡dio Aurora FM â€” TÃ©rreo: 2 parede(s) suspeita(s), por exemplo em [2044, 668, 2044, 1868] (coordenadas de cena)

### 4. Escadas

34 escadas testadas (cada ligação tem ida e volta, inclusive nas cenas duplicadas): 34 passaram em todos os testes (região, pino dentro da área azul, destino existente e dentro do mapa, chegada fora de outra escada, retorno existente).

- Arquivo Municipal — Primeiro andar: as duas escadas ficam na beira da grade do vão. A grade bloqueava o caminho entre o pino e a chegada; **abri um vão na grade** (x 915 a 1065, no recorte de 2000 px) e as duas escadas ficaram acessíveis.
- Nenhuma escada foi usada com um token de verdade; o que se testou foi a geometria e as ligações.

### 5. Visão (agente)
O polígono de visão de pontos dentro dos cômodos para nas paredes e nas portas fechadas nos 8 mapas desenhados e conferidos a olho (Casa Augusto térreo, primeiro andar e subsolo, Casa Helena primeiro andar, Garagem térreo, Posto térreo, Rádio térreo e Frigorífico mezanino). Os outros 13 mapas só passaram nos testes numéricos de porta e alinhamento. Janelas deixam a visão passar para fora, como esperado. Grades do mezanino deixam ver através. Um ponto a conferir: na Casa Helena (primeiro andar), o quarto pequeno do canto direito tem uma fresta de visão para o sudoeste, perto de (1650,1150).

### 6. Extremidades soltas
O teste achou pontas de parede sem encontro com outra parede (entre 0 e 33 por cena, a maior parte em arcos abertos e vãos sem porta, que são intencionais). A lista completa está em `work/sa/qa_geom.json`.

## Arquivos do teste
`tools/santa-aurora/qa_*.py` e os resultados em `work/sa/qa_*.json`. Os scripts que rodam dentro do Foundry (portas, visão e escadas) eram descartáveis e foram apagados na limpeza; os dados que eles geraram estão nos JSON.

## Reteste após as correções

**Causa raiz achada.** A maior parte dos "cômodos sem entrada" e das portas que bloqueavam abertas vinha de um único erro: em paredes longas e levemente inclinadas pela medida, a porta não era encostada na parede e o trecho de parede por baixo dela continuava lá. Agora a porta (e a janela) é encostada na parede mais próxima antes de cortá-la, e paredes quase retas são esticadas.

Também corrigi: três portas do Posto Sete Vidas (térreo) que estavam desenhadas na diagonal, e uma porta nova entre o salão e a cozinha da Casa Augusto (térreo). O vão de escada do Arquivo Municipal (primeiro andar) agora é acessível.

| Item | Antes | Depois |
|---|---|---|
| Portas que bloqueiam quando abertas | 8 | **0** de 196 |
| Portas fechadas que não bloqueiam | 0 | 0 |
| Escadas com problema | 2 (grade do Arquivo) | **0** de 34 |
| Mapas com cômodo fora de alcance | 17 | 7 |

**Ainda sem acesso** (7 mapas). O que sobra são vãos e vazios de propósito (mezanino e vão de escada do Frigorífico, vão de carga da Garagem) e cômodos em que **a imagem não mostra nenhuma porta**: o quintal dos fundos da Garagem (térreo), os cômodos do alto à direita do Frigorífico (térreo), a sala dos ventiladores, a sala dos canos e o depósito de baixo no subsolo da Casa Augusto, e um canto da escada na Casa Augusto (primeiro andar). Não inventei portas nesses pontos. Se você quiser entrada nesses cômodos, me diga onde.
