# Correções propostas para os 98 rituais (compêndio `world.biblioteca-de-rituais`)

Gerado em 20/10/2026 a partir da auditoria ([auditoria-rituais-vs-livro.md](auditoria-rituais-vs-livro.md)) e de uma varredura dos textos. **Nada foi aplicado:** o compêndio, o ator "Biblioteca de Rituais — Agente" e o mundo continuam como estavam. Este é o plano de correção, para o Geh revisar. O arquivo de máquina é [correcoes-rituais-compendio.json](correcoes-rituais-compendio.json) (por ritual: campo, antes, depois, tipo, motivo) e as correções saem **no pacote `rituals` do sistema** (seção 4.8 da spec).

**41 rituais, 79 alterações.** Por tipo: texto 54, fluxo 14, dado 2, exibicao 9.

- **texto:** descrição e cabeçalho do chat (sem efeito em jogo).
- **exibicao:** `area.name`, que só aparece como texto de área; não decide alvo.
- **dado:** teste e efeito de resistência (`skillResis`, `resistance`).
- **fluxo:** campo `target`, que **o sistema lê para decidir quantos alvos pedir e de que tipo** (`ritualTargets`, `ritual-targeting.mjs`). Mudou o jogo, não só o texto; a tabela abaixo mostra o antes e depois calculado pela função real.

## Alterações de `target` que mudam o fluxo de conjuração

| Ritual | target antes | target depois | Tipo/máx. de alvos antes | depois |
| --- | --- | --- | --- | --- |
| Alterar Destino | (vazio) | você | unknown / sem limite | self / 0 |
| Amaldiçoar Arma | (vazio) | 1 arma corpo a corpo ou pacote de munição | unknown / sem limite | object / 1 |
| Amaldiçoar Tecnologia | 1 acessório ou arma de | 1 acessório ou arma de fogo | object / 1 | object / 1 |
| Coincidência Forçada | Veja texto | 1 ser | unknown / sem limite | creature / 1 |
| Desacelerar Impacto | Veja texto | 1 ser ou objetos somando até 10 espaços | unknown / sem limite | creature / 1 |
| Descarnar | Veja texto | 1 ser | unknown / sem limite | creature / 1 |
| Dissonância Acústica | 1 objeto” | Veja descrição da área | object / 1 | area / sem limite |
| Forma Monstruosa | (vazio) | você | unknown / sem limite | self / 0 |
| Invadir Mente | 1 ser ou 2 pessoas | 1 ser ou 2 pessoas voluntárias | creature / 2 | creature / 2 |
| Lâmina do Medo | (vazio) | 1 ser | unknown / sem limite | creature / 1 |
| Overclock | (vazio) | você | unknown / sem limite | self / 0 |
| Terceiro Olho | (vazio) | você | unknown / sem limite | self / 0 |
| Vínculo de Sangue | 1 pessoa | 1 ser | creature / 1 | creature / 1 |
| Zerar Entropia | 1 ser | 1 pessoa | creature / 1 | creature / 1 |
| Âncora Temporal | (vazio) | 1 ser | unknown / sem limite | creature / 1 |

Linhas em que o tipo muda (`unknown`→`self`, `object`→`area`…) alteram o que o conjurador vê ao lançar o ritual; **cada uma precisa de teste** (teste unitário de `ritualTargets` e uma conjuração na arena temporária) antes de ir para o pacote.

## Todas as alterações, por ritual

### Alterar Destino

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | você | fluxo | estava em branco; o livro diz "você" (o ator Biblioteca de Rituais já tem) |

### Amaldiçoar Arma

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | 1 arma corpo a corpo ou pacote de munição | fluxo | estava em branco; o livro diz "1 arma corpo a corpo ou pacote de munição" |

### Amaldiçoar Tecnologia

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>fogo Você imbui o alvo com Energia, fazendo-o funcionar acima de sua capacidade. O item recebe uma modificação a sua escolha. Discente (+… | <p>Você imbui o alvo com Energia, fazendo-o funcionar acima de sua capacidade. O item recebe uma modificação a sua escolha. Discente (+2 PE)… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "fogo") |
| `system.target` | 1 acessório ou arma de | 1 acessório ou arma de fogo | texto | o alvo estava cortado na quebra de linha |
| `system.chatDescription (Alvo)` | 1 acessório ou arma de | 1 acessório ou arma de fogo | texto | idem |

### Canalizar o Medo

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>descarregada Você transfere parte de seu poder para outra pessoa. Escolha um ritual de até 3º círculo que você conheça; o alvo pode conju… | <p>Você transfere parte de seu poder para outra pessoa. Escolha um ritual de até 3º círculo que você conheça; o alvo pode conjurar este ritu… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "descarregada") |
| `system.chatDescription (Duração)` | permanente até ser | permanente até ser descarregada | texto | a duração estava cortada na quebra de linha |

### Chamas do Caos

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Você manipula o calor e o fogo. Ao conjurar o ritual, escolha um dos seguintes efeitos.</p><p>&lt;p&gt;&lt;strong&gt;Chamejar:&lt;/strong&gt;&lt;/p&gt;&lt;p&… | <p>Você manipula o calor e o fogo. Ao conjurar o ritual, escolha um dos seguintes efeitos.</p><p><strong>Chamejar:</strong></p><p>o alvo é uma arma corpo a corp… | texto | as tags da lista de efeitos estavam escapadas e apareciam como texto (&lt;p&gt;…) |

### Coincidência Forçada

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Alvos: 1 ser Você manipula os caminhos do caos para que o alvo tenha mais sorte. O alvo recebe +2 em testes de perícias. Discente (+2 PE)… | <p>Você manipula os caminhos do caos para que o alvo tenha mais sorte. O alvo recebe +2 em testes de perícias. Discente (+2 PE): muda o alvo… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Alvos: 1 ser") |
| `system.target` | Veja texto | 1 ser | fluxo | estava "Veja texto"; o livro diz "Alvos: 1 ser" |
| `system.chatDescription (Alvo)` | Veja texto | 1 ser | texto | idem |

### Compreensão Paranormal

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>(veja texto) O ritual confere a você compreensão sobrenatural da linguagem. Se tocar um objeto contendo informação (ou livro, um disposit… | <p>O ritual confere a você compreensão sobrenatural da linguagem. Se tocar um objeto contendo informação (ou livro, um dispositivo com uma g… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "(veja texto)") |
| `system.chatDescription (Resistência)` | Vontade anula | Vontade anula (veja texto) | texto | o livro traz "(veja texto)" na resistência |

### Consumir Manancial

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.area.name` | esfera com 6m de raio centrada em você” e a resistência para “Fortitude reduz à metade” | (vazio) | exibicao | era o texto da forma Verdadeiro ("…centrada em você” e a resistência para…"); a forma básica não tem área |

### Controle Mental

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Discente (+5 PE): muda o alvo para até cinco pessoas ou animais. Verdadeiro (+10 PE): muda o alvo para até dez pessoas ou animais. Requer afinidade com Conhecimento.</… | <p>Você domina a mente do alvo, que obedece todos os seus comandos, exceto ordens suicidas. Um alvo tem direito a um teste de Vontade no final de cada um de seus turnos p… | texto | faltava o parágrafo da forma básica (livro p. 128, com a errata de 00-atualizacoes/0040) |
| `system.chatDescription (Resistência)` | Vontade parcial Você domina a mente do alvo, que obedece todos os seus comandos, exceto ordens suicidas | Vontade parcial | texto | o começo da descrição tinha ido parar no cabeçalho do chat |

### Convocar o Algoz

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.chatDescription (Resistência)` | Vontade parcial, | Vontade parcial, Fortitude parcial | texto | o livro pede dois testes; o campo skillResis guarda só um (decisão pendente) |

### Decadência

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>à metade Espirais de trevas envolvem sua mão e definham o alvo, que sofre 2d8+2 pontos de dano de Morte. Discente (+2 PE): muda a resistê… | <p>Espirais de trevas envolvem sua mão e definham o alvo, que sofre 2d8+2 pontos de dano de Morte. Discente (+2 PE): muda a resistência para… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (é o fim de "reduz à metade") (removido do começo: "à metade") |
| `system.chatDescription (Resistência)` | Fortitude reduz | Fortitude reduz à metade | texto | a resistência estava cortada |
| `system.area.name` | explosão com 6m de raio” e o dano para 8d8+8 | (vazio) | exibicao | era o texto da forma Verdadeiro ("explosão com 6m de raio” e o dano para 8d8+8"); a forma básica não tem área |

### Desacelerar Impacto

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Alvos: 1 ser ou objetos somando até 10 espaços cena, o que vier primeiro O alvo cai lentamente. A velocidade da queda é reduzida para 18m… | <p>O alvo cai lentamente. A velocidade da queda é reduzida para 18m por rodada — o suficiente para não causar dano. Como conjurar este ritua… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Alvos: 1 ser ou objetos somando até 10 espaços cena, o que vier primeiro") |
| `system.chatDescription (Duração)` | até chegar ao solo ou | até chegar ao solo ou cena, o que vier primeiro | texto | a duração estava cortada |
| `system.target` | Veja texto | 1 ser ou objetos somando até 10 espaços | fluxo | estava "Veja texto"; o livro diz "Alvos: 1 ser ou objetos somando até 10 espaços" |
| `system.chatDescription (Alvo)` | Veja texto | 1 ser ou objetos somando até 10 espaços | texto | idem |

### Descarnar

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Alvos: 1 ser Este ritual cruel faz com que lacerações se manifestem na pele e órgãos do alvo, que sofre 6d8 pontos de dano (metade corte,… | <p>Este ritual cruel faz com que lacerações se manifestem na pele e órgãos do alvo, que sofre 6d8 pontos de dano (metade corte, metade Sangu… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Alvos: 1 ser") |
| `system.target` | Veja texto | 1 ser | fluxo | estava "Veja texto"; o livro diz "Alvos: 1 ser" |
| `system.chatDescription (Alvo)` | Veja texto | 1 ser | texto | idem |

### Dissonância Acústica

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | 1 objeto” | Veja descrição da área | fluxo | o alvo era o texto da forma Discente ("1 objeto”"); a forma básica é área (esfera com 6m de raio), como no Paradoxo |
| `system.chatDescription (Alvo)` | 1 objeto” | Veja descrição da área | texto | idem |

### Eco Espiral

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>à metade Você manifesta em suas mãos uma pequena cópia do alvo feita de cinzas. No início do próximo turno após conjurar este ritual, voc… | <p>Você manifesta em suas mãos uma pequena cópia do alvo feita de cinzas. No início do próximo turno após conjurar este ritual, você precisa… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (é o fim de "reduz à metade") (removido do começo: "à metade") |
| `system.chatDescription (Resistência)` | Fortitude reduz | Fortitude reduz à metade | texto | a resistência estava cortada |

### Eletrocussão

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.area.name` | linha de 30m” | (vazio) | exibicao | era o texto da forma Discente ("linha de 30m”"); a forma básica não tem área |

### Fim Inevitável

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Efeito: buraco negro com 1,5m de diâmetro Você cria um vácuo em um espaço desocupado a sua escolha. No início de cada um de seus quatro t… | <p>Você cria um vácuo em um espaço desocupado a sua escolha. No início de cada um de seus quatro turnos seguintes, todos os seres a até 90m … | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Efeito: buraco negro com 1,5m de diâmetro") |
| `system.area.name` | (vazio) | buraco negro com 1,5m de diâmetro | exibicao | valor do "Efeito" do livro, para o Alvo/Área não ficar em "Veja texto" (o campo target não é mexido) |

### Forma Monstruosa

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | você | fluxo | estava em branco; o livro diz "você" (o ator Biblioteca de Rituais já tem) |

### Hemofagia

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>à metade Você arranca o sangue do corpo do alvo através da pele dele, causando 6d6 pontos de dano de Sangue. Você então absorve esse sang… | <p>Você arranca o sangue do corpo do alvo através da pele dele, causando 6d6 pontos de dano de Sangue. Você então absorve esse sangue, recup… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (é o fim de "reduz à metade") (removido do começo: "à metade") |
| `system.chatDescription (Resistência)` | Fortitude reduz | Fortitude reduz à metade | texto | a resistência estava cortada |

### Invadir Mente

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>voluntárias ou 1 dia nenhuma Quando conjura este ritual, você gera um dos efeitos a seguir, a sua escolha: rajada mental (usa os primeiro… | <p>Quando conjura este ritual, você gera um dos efeitos a seguir, a sua escolha: rajada mental (usa os primeiros parâmetros do cabeçalho aci… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "voluntárias ou 1 dia nenhuma") |
| `system.target` | 1 ser ou 2 pessoas | 1 ser ou 2 pessoas voluntárias | fluxo | o alvo estava cortado na quebra de linha |
| `system.chatDescription (Alvo)` | 1 ser ou 2 pessoas | 1 ser ou 2 pessoas voluntárias | texto | idem |
| `system.chatDescription (Duração)` | instantânea | instantânea ou 1 dia | texto | a duração estava cortada |
| `system.chatDescription (Resistência)` | Vontade parcial ou | Vontade parcial ou nenhuma | texto | a resistência estava cortada |

### Invólucro de Carne

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Efeito: 1 clone seu Você manifesta uma poça de sangue no chão, de onde emerge uma cópia sua. Ela é idêntica em aparência e capacidades (e… | <p>Você manifesta uma poça de sangue no chão, de onde emerge uma cópia sua. Ela é idêntica em aparência e capacidades (em termos de jogo, te… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Efeito: 1 clone seu") |
| `system.area.name` | (vazio) | 1 clone seu | exibicao | valor do "Efeito" do livro, para o Alvo/Área não ficar em "Veja texto" (o campo target não é mexido) |

### Localização

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>de raio Este ritual pode encontrar uma pessoa ou objeto a sua escolha. Você pode pensar em termos gerais (“um policial”, “algo de metal”)… | <p>Este ritual pode encontrar uma pessoa ou objeto a sua escolha. Você pode pensar em termos gerais (“um policial”, “algo de metal”) ou espe… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "de raio") |
| `system.area.name` | círculo com 90m | círculo com 90m de raio | exibicao | a área estava cortada na quebra de linha |

### Luz

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>(veja texto) O alvo emite luz de cores alternadas e brilhantes (mas não produz calor) em uma área com 9m de raio. O objeto pode ser guard… | <p>O alvo emite luz de cores alternadas e brilhantes (mas não produz calor) em uma área com 9m de raio. O objeto pode ser guardado (em um bo… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "(veja texto)") |
| `system.chatDescription (Resistência)` | Vontade anula | Vontade anula (veja texto) | texto | o livro traz "(veja texto)" na resistência |

### Lâmina do Medo

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | 1 ser | fluxo | estava em branco; o livro diz "1 ser" |

### Mergulho Mental

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>(veja texto) Você mergulha nos pensamentos do alvo para descobrir informações sobre ele. Durante o mergulho, você fica desprevenido. No i… | <p>Você mergulha nos pensamentos do alvo para descobrir informações sobre ele. Durante o mergulho, você fica desprevenido. No início de cada… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "(veja texto)") |
| `system.chatDescription (Resistência)` | Vontade parcial | Vontade parcial (veja texto) | texto | o livro traz "(veja texto)" na resistência |

### Miasma Entrópico

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>(veja texto) Cria uma explosão de emanações tóxicas. Seres na área sofrem 4d8 pontos de dano químico e ficam enjoados por 1 rodada. Se pa… | <p>Cria uma explosão de emanações tóxicas. Seres na área sofrem 4d8 pontos de dano químico e ficam enjoados por 1 rodada. Se passarem na res… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "(veja texto)") |
| `system.chatDescription (Resistência)` | Fortitude parcial | Fortitude parcial (veja texto) | texto | o livro traz "(veja texto)" na resistência |

### Nuvem de Cinzas

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Efeito: nuvem com 6m de raio e 6m de altura Uma nuvem de fuligem espessa eleva-se de um ponto a sua escolha, obscurecendo toda a visão — … | <p>Uma nuvem de fuligem espessa eleva-se de um ponto a sua escolha, obscurecendo toda a visão — seres a até 1,5m têm camuflagem leve e seres… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Efeito: nuvem com 6m de raio e 6m de altura") |
| `system.area.name` | (vazio) | nuvem com 6m de raio e 6m de altura | exibicao | valor do "Efeito" do livro, para o Alvo/Área não ficar em "Veja texto" (o campo target não é mexido) |

### Overclock

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | você | fluxo | estava em branco; o livro diz "você" (o ator Biblioteca de Rituais já tem) |

### Paradoxo

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>à metade O ritual cria uma poderosa implosão de distorção temporal contraditória, causando 6d6 pontos de dano de Morte em todos os seres … | <p>O ritual cria uma poderosa implosão de distorção temporal contraditória, causando 6d6 pontos de dano de Morte em todos os seres na área. … | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (é o fim de "reduz à metade") (removido do começo: "à metade") |
| `system.chatDescription (Resistência)` | Fortitude reduz | Fortitude reduz à metade | texto | a resistência estava cortada |

### Perturbação

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Você dá uma ordem que o alvo deve ser capaz de ouvir (mas não precisa entender). Se falhar na resistência, ele deve obedecer à ordem em seu próprio turno da … | <p>Você dá uma ordem que o alvo deve ser capaz de ouvir (mas não precisa entender). Se falhar na resistência, ele deve obedecer à ordem em seu próprio turno da … | texto | as tags da lista de efeitos estavam escapadas e apareciam como texto (&lt;p&gt;…) |

### Polarização Caótica

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Você gera uma aura magnética sobrenatural. Escolha um dos efeitos a seguir.</p><p>&lt;p&gt;&lt;strong&gt;Atrair:&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;você pode u… | <p>Você gera uma aura magnética sobrenatural. Escolha um dos efeitos a seguir.</p><p><strong>Atrair:</strong></p><p>você pode usar uma ação de movimento para pu… | texto | as tags da lista de efeitos estavam escapadas e apareciam como texto (&lt;p&gt;…) |

### Sopro do Caos

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Você altera os movimentos de massas de ar de forma caótica. Ao conjurar o ritual, escolha um dos efeitos abaixo.</p><p>&lt;p&gt;&lt;strong&gt;Ascender:&lt;/s… | <p>Você altera os movimentos de massas de ar de forma caótica. Ao conjurar o ritual, escolha um dos efeitos abaixo.</p><p><strong>Ascender:</strong></p><p>cria … | texto | as tags da lista de efeitos estavam escapadas e apareciam como texto (&lt;p&gt;…) |

### Tecer Ilusão

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Efeito: ilusão que se estende a até 4 cubos de 1,5m Este ritual cria uma ilusão visual (uma pessoa, uma parede…) ou sonora (um grito de s… | <p>Este ritual cria uma ilusão visual (uma pessoa, uma parede…) ou sonora (um grito de socorro, um uivo assustador…). O ritual cria apenas i… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Efeito: ilusão que se estende a até 4 cubos de 1,5m") |
| `system.area.name` | (vazio) | ilusão que se estende a até 4 cubos de 1,5m | exibicao | valor do "Efeito" do livro, para o Alvo/Área não ficar em "Veja texto" (o campo target não é mexido) |

### Terceiro Olho

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | você | fluxo | estava em branco; o livro diz "você" (o ator Biblioteca de Rituais já tem) |

### Transfigurar Terra

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Você imbui terra, pedra, lama, argila ou areia na área com Energia, gerando efeitos sobrenaturais e caóticos. Ao conjurar o ritual, escolha um dos seguintes … | <p>Você imbui terra, pedra, lama, argila ou areia na área com Energia, gerando efeitos sobrenaturais e caóticos. Ao conjurar o ritual, escolha um dos seguintes … | texto | as tags da lista de efeitos estavam escapadas e apareciam como texto (&lt;p&gt;…) |

### Transfigurar Água

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Você canaliza Energia sobre um corpo de água, para que ele adquira movimentos e comportamentos paranormais e caóticos. Ao conjurar o ritual, escolha um dos s… | <p>Você canaliza Energia sobre um corpo de água, para que ele adquira movimentos e comportamentos paranormais e caóticos. Ao conjurar o ritual, escolha um dos s… | texto | as tags da lista de efeitos estavam escapadas e apareciam como texto (&lt;p&gt;…) |

### Vidência

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Através de uma superfície reflexiva, como um espelho, uma bacia de água ou mesmo uma TV desligada, você pode ver e ouvir um ser escolhido e seus arredores (cerca de 6m… | <p>Através de uma superfície reflexiva, como um espelho, uma bacia de água ou mesmo uma TV desligada, você pode ver e ouvir um ser escolhido e seus arredores (cerca de 6m… | texto | o texto do Vínculo de Sangue estava colado no fim; acrescentado o quadro de bônus e penalidades da p. 143 |

### Vomitar Pestes

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Efeito: 1 enxame Grande (quadrado de 3m) à metade Você vomita um enxame de pequenas criaturas de Sangue, que surge em um ponto adjacente … | <p>Você vomita um enxame de pequenas criaturas de Sangue, que surge em um ponto adjacente a sua escolha. O enxame pode passar pelo espaço de… | texto | cabeçalho do livro que a extração do PDF deixou no começo da descrição (removido do começo: "Efeito: 1 enxame Grande (quadrado de 3m) à metade") |
| `system.chatDescription (Resistência)` | Reflexos reduz | Reflexos reduz à metade | texto | a resistência estava cortada |
| `system.area.name` | (vazio) | 1 enxame Grande (quadrado de 3m) | exibicao | valor do "Efeito" do livro, para o Alvo/Área não ficar em "Veja texto" (o campo target não é mexido) |

### Vínculo de Sangue

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.description` | <p>Alvo sofre todo dano que você sofrer.</p> | <p>Você manifesta um símbolo de Sangue no seu corpo e no corpo do alvo. Sempre que você sofrer dano, o alvo deve fazer um teste de Fortitude. Se ele falhar, você sofre ap… | texto | estava abreviada (livro p. 143) |
| `system.target` | 1 pessoa | 1 ser | fluxo | o livro diz 1 ser; "1 pessoa" é do Zerar Entropia, ao lado na mesma página |
| `system.skillResis` | will | resilience | dado | o livro diz Fortitude; "Vontade" é do Zerar Entropia |
| `system.resistance` | partial | nullifies | dado | o livro diz anula; "parcial" é do Zerar Entropia |
| `system.chatDescription (Alvo)` | 1 pessoa | 1 ser | texto | idem |
| `system.chatDescription (Resistência)` | Vontade parcial | Fortitude anula | texto | idem |

### Zerar Entropia

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | 1 ser | 1 pessoa | fluxo | o livro diz 1 pessoa; "1 ser" é do Vínculo de Sangue (e da forma Discente do próprio ritual) |
| `system.chatDescription (Alvo)` | 1 ser | 1 pessoa | texto | idem |

### Âncora Temporal

| Campo | Antes | Depois | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| `system.target` | (vazio) | 1 ser | fluxo | estava em branco; o livro diz "1 ser" (o ator Biblioteca de Rituais já tem) |

## Não corrigido (decisão do Geh)

- **Convocar o Algoz:** o livro pede dois testes (Vontade parcial e Fortitude parcial); o modelo guarda só um (`skillResis`). Só o texto do chat foi ajustado.
- **Desacelerar Impacto:** o livro dá "Alvos: 1 ser ou objetos somando até 10 espaços"; o `target` segue "Veja texto" para não mudar o fluxo, e o Alvo/Área do Grimório mostra esse texto até haver um campo próprio.
- **Alvo/Área "Veja texto":** nos cinco rituais de "Efeito", o valor do livro foi para `area.name` (só exibição).
