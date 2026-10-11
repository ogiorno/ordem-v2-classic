# Relatório: trilhas em combate simulado (19/10/2026)

Nenhum arquivo do sistema foi alterado. Tudo (simulador, dados, CSV) está em `work/sim/`; a planilha completa é `work/sim/out/trilhas-por-nivel.csv`.

## 1. Resumo

- **Só uma trilha ajuda de forma consistente em todos os níveis: Médico de Campo** (+7 a +15 pontos de vitória do grupo do NEX 15% ao 99%). Conduíte e Flagelador vêm depois (a partir de 40–50%).
- **A maioria das trilhas é quase invisível de 10% a 95% e só "acorda" em 99%** (Guerreiro +11, Comandante +10, Tropa +10, Possuído +16, Lâmina +14, Conduíte +13, Caçador +9). O poder de trilha é "concentrado no fim".
- **Sem função de combate nenhuma, em nenhum nível:** Técnico, Bibliotecário, Muambeiro, Parapsicólogo e Agente Secreto (até 99%). Negociador e Exorcista quase.
- **Atirador de Elite e Infiltrador são os dois casos estruturais**: somam dano fixo a um personagem que não consegue acertar ameaças de VD 180+ (Defesa 36+) em nenhum NEX, porque Especialista não tem Ataque Especial. Isso não é só da trilha: é um teto de acerto da classe.
- **Lâmina Paranormal é pior que um Ocultista comum de NEX 15% a 60%** (−2 a −11 pontos) e só compensa em 99% (Lâmina do Medo).
- As sugestões da seção 6 elevam as trilhas fracas para +3 a +8 pontos nos níveis médios; as que chegam perto do teto em 99% (Infiltrador, Aniquilador, Tropa) estão sinalizadas, e nenhuma passa de +15 (teto atual das melhores: +14 a +16).
- Achado de sistema: pelo código, **só Técnica Letal (Guerreiro 10%) está automatizada na tela de ataque**; as outras habilidades de trilha são texto (seção 5).

## 2. Como foi testado

**Importante: não é uma partida jogada no Foundry.** Criei um simulador de combate em Node (`work/sim`) com as regras do Livro v1.3 e do Sobrevivendo ao Horror, alimentado pelos **dados reais do seu mundo**: 57 ameaças do compêndio (PV, Defesa, ataques, número de ataques "x2/x3", RD, vulnerabilidades), tabela de armas e de proteções, e os textos das habilidades das trilhas. Escolhi simular porque rodar 27 trilhas × 20 níveis × milhares de combates no Foundry levaria dias.

- **27 trilhas** (15 do Livro, 12 do Sobrevivendo ao Horror: Agente Secreto, Caçador, Monstruoso ×4 elementos, Bibliotecário, Muambeiro, Perseverante, Exorcista, Parapsicólogo, Possuído) × **20 níveis** (NEX 5% a 99%). As 3 trilhas do Sobrevivente foram testadas à parte (seção 4). As 3 de Arquivos Secretos não têm texto no compêndio ("veja o livro") e ficaram de fora.
- **Cenário A:** grupo de 4 (a trilha testada + um Combatente, um Especialista e um Ocultista "sem trilha") contra um encontro **equilibrado pela regra do livro** (VD total ≈ soma dos NEX). **Cenário B:** dois desses combates seguidos sem descanso (o livro diz que o grupo aguenta 1–2).
- Cada célula = 2.000 combates (250 encontros variados × 8 repetições), com encontros e sementes iguais para a trilha e para o **mesmo personagem sem trilha** (comparação pareada). O número da tabela é a diferença de taxa de vitória do grupo, em pontos percentuais, média de A e B. Ruído típico: cerca de ±1 ponto; abaixo de +2 trate como "nada".
- **Calibração ao vivo:** na arena temporária do Foundry rolei 150 ataques reais pelo sistema com 2d20kh+15 contra Defesa 27: acertou 107 (previsto pelo simulador: 105); e com 1d20kh+15: 72 (previsto: 68). A mecânica de dados/Defesa bate com a do sistema. Também conferi: as 24 pastas de trilha do compêndio têm habilidades em 10, 40, 65 e 99%.
- **Sensibilidade:** se as ameaças fizessem só 1 ataque por rodada (ignorando o "x2/x3" das fichas), todos os efeitos encolhem uns 30–50%, mas a ordem das trilhas e as conclusões não mudam.

### O que o teste NÃO cobre (leia antes de decidir)
- Habilidades das ameaças que não são "Agredir" (presença perturbadora, agarrar, áreas, efeitos de condição): usei 57 das 70 fichas do mundo (as demais não têm arma de Agredir ou são placeholders). Combates reais são mais perigosos que o simulado.
- Sem mapa nem posição: flanco (+1d20) e "atirar em combate corpo a corpo" (−1d20) entram como probabilidade (50% e 60%).
- Sem investigação, furtividade, perseguição, Sanidade, condições mentais. As trilhas de investigação (Técnico, Bibliotecário, Muambeiro, Parapsicólogo, Agente Secreto, Exorcista) podem ter valor enorme fora de combate; aqui só foi medido o combate.
- Itens modificados, munições especiais e consumíveis não entram (todos os agentes usam arma do compêndio, sem modificações). Isso reduz o acerto em alto NEX, mas afeta todas as trilhas igual.
- Builds padronizados por arquétipo (atributos, poderes gerais). Um jogador otimizando pode fazer melhor ou pior.
- Poderes que dependem de aliados específicos (Estrategista, Truque de Mestre) foram modelados com o grupo padrão do teste. Truque de Mestre, Eloquência, Anular Ritual e Equipe de Trauma não têm efeito simulável nesse cenário.

## 3. Panorama: efeito de cada trilha por NEX

Pontos percentuais de vitória do grupo a mais (ou a menos) do que com o mesmo personagem sem trilha. Negrito = efeito grande. ᴴ = Sobrevivendo ao Horror.

| Trilha | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95 | 99 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Aniquilador | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +3 | +2 | +2 | +2 | +1 | +1 | +1 | +1 | 0 | +1 | +1 | +2 | +4 |
| Comandante de Campo | 0 | 0 | +1 | +1 | +1 | +1 | +1 | +1 | +1 | +1 | +1 | +2 | 0 | +3 | +3 | +2 | +2 | +2 | +2 | **+10** |
| Guerreiro | 0 | 0 | +2 | +1 | +1 | +1 | +1 | +2 | +1 | +2 | +2 | +1 | +1 | +3 | +3 | +3 | +1 | +2 | +3 | **+11** |
| Operações Especiais | 0 | 0 | 0 | 0 | +1 | +1 | +1 | +3 | +2 | +2 | +2 | 0 | +1 | +1 | +1 | -1 | +1 | +1 | +2 | +2 |
| Tropa de Choque | 0 | 0 | +2 | +1 | +2 | +1 | +1 | +1 | +1 | +1 | +2 | +2 | +3 | +3 | +4 | +5 | +5 | +6 | **+8** | **+10** |
| Atirador de Elite | 0 | 0 | 0 | 0 | -1 | 0 | 0 | +2 | +1 | +2 | +2 | +2 | +1 | 0 | +1 | +1 | +1 | +1 | +1 | -1 |
| Infiltrador | 0 | 0 | +1 | +1 | +1 | +1 | 0 | +1 | +1 | +1 | +1 | +1 | +2 | +2 | +2 | +3 | +2 | +2 | +3 | +2 |
| Médico de Campo | 0 | +3 | +7 | **+10** | **+10** | **+11** | **+8** | **+13** | **+12** | **+12** | **+10** | **+11** | **+13** | **+13** | **+15** | **+14** | **+11** | **+11** | **+12** | **+14** |
| Negociador | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +2 | +2 | +1 | +1 | +1 | +1 | +1 | +2 | +1 | -1 | +1 | +1 | +2 |
| Técnico | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Conduíte | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +2 | +5 | +4 | +1 | +3 | +4 | +4 | +6 | +6 | +6 | +7 | **+10** | **+13** |
| Flagelador | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +5 | +5 | +5 | +4 | +5 | +6 | +5 | +4 | +3 | +4 | +4 | +4 | +5 |
| Graduado | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +5 | +3 | +3 | +3 | +3 | +2 | +3 | +2 |
| Intuitivo | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +1 | +2 | +2 | +2 | +1 | +2 | +4 | +4 |
| Lâmina Paranormal | 0 | 0 | -2 | -2 | **-7** | **-8** | **-4** | **-7** | **-6** | **-7** | **-9** | **-11** | **-3** | -1 | 0 | -1 | -1 | 0 | -1 | **+14** |
| Agente Secreto ᴴ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +1 |
| Caçador ᴴ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +1 | +1 | +2 | +1 | +2 | +1 | +1 | +1 | +3 | **+9** |
| Monstruoso (Sangue) ᴴ | 0 | 0 | 0 | +1 | +1 | 0 | 0 | +3 | +3 | +4 | +3 | +3 | +4 | +4 | +4 | +4 | +3 | +4 | +3 | +5 |
| Monstruoso (Morte) ᴴ | 0 | 0 | +1 | +2 | +2 | +1 | +1 | +1 | +1 | +1 | +1 | +2 | +3 | +2 | +3 | +3 | +2 | +2 | +2 | +5 |
| Monstruoso (Energia) ᴴ | 0 | 0 | +1 | +2 | +2 | +1 | +1 | +3 | +1 | +3 | +2 | +3 | +1 | +2 | +3 | +4 | +3 | +3 | +2 | +4 |
| Monstruoso (Conhecimento) ᴴ | 0 | 0 | 0 | +1 | +1 | 0 | 0 | +3 | +4 | +3 | +4 | +2 | +2 | +1 | +2 | +2 | +1 | +1 | +1 | +2 |
| Bibliotecário ᴴ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Muambeiro ᴴ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Perseverante ᴴ | 0 | +1 | +2 | +1 | +2 | +1 | +1 | +2 | +1 | +2 | +2 | +1 | -1 | +1 | +1 | 0 | -1 | +1 | 0 | +2 |
| Exorcista ᴴ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | +2 | +2 | +1 | +1 | +1 | +1 | +1 | +2 |
| Parapsicólogo ᴴ | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Possuído ᴴ | 0 | +1 | +2 | +2 | +2 | +2 | +2 | +2 | +3 | +3 | +2 | +3 | +4 | +3 | +3 | +3 | +4 | +5 | +5 | **+16** |


Níveis em que cada trilha ganha habilidade: 10%, 40%, 65% e 99%. Marcos que explicam a tabela:

- **O limite de acerto.** Um Especialista de NEX 99% (4 dados, +15) acerta 91% das vezes uma ameaça de VD 60 (Defesa 27), mas **0%** de VD 180 (Defesa 36) em diante. Um Combatente com Ataque Especial no máximo chega a 98% em VD 320 (Defesa 45) e **0%** em VD 380 (Defesa 58). Bônus de dano, margem de ameaça e "dados extras" não adiantam se o ataque não acerta.
- **O limite de PE por turno** (= nível) trava habilidades que gastam PE em cima de Ataque Especial e rituais: ataque extra, surto e acelerar competem pelo mesmo orçamento.
- **PV de ameaças escalam muito mais do que dano fixo de trilha** (VD 20: 15–45 PV; VD 380: 1000+). +1d6 de dano furtivo não é nada contra 1.100 PV.

## 4. Trilha por trilha: limitações em cada faixa de NEX

"Efeito" = pontos de vitória do grupo (tabela acima).

### Combatente

**Aniquilador** — efeito: +3 em 40%, depois +1 a +2 de 55% a 95%, +4 em 99%.
- 10% A Favorita: reduz categoria da arma. Só importa se a categoria do equipamento limita o agente; as armas de corpo a corpo do compêndio já são de categoria I ou menos, então para quem usa faca/katana/machado não muda nada. Vale para armas de fogo pesadas.
- 40% Técnica Secreta: Amplo e Destruidor a 2 PE cada. Funciona (+3), mas compete com o Ataque Especial pelo limite de PE.
- 65% Técnica Sublime: Letal e Perfurante. Efeito +1: Perfurante (RD 5) quase nunca é usado porque poucas ameaças têm RD; Letal ajuda pouco sem acerto.
- 99% Máquina de Matar: +1 dado e +2 de margem. Melhor momento (+4), mas ainda abaixo do Guerreiro.
- **Perde relevância de 55% a 95%.**

**Comandante de Campo** — +1 a +3 de 15% a 95%; **+10 em 99%**.
- 10% Inspirar Confiança: repetir o teste de um aliado custa 2 PE e uma reação, rende ~4 de dano por combate. Irrelevante.
- 40% Estrategista: dá uma ação de **movimento** extra. Sem mapa, ninguém tem o que fazer com ela (só ajuda quem tem ação de movimento própria, como Mirar). Efeito ≈ 0.
- 65% Brecha na Guarda: 1 ataque extra por rodada para 2 PE, mas só quando um aliado já causou dano. +1.
- 99% Oficial Comandante: todos os aliados ganham uma ação padrão adicional por 5 PE e uma ação do comandante, **a cada rodada**. Aí sim (+10), mas o comandante deixa de atacar.
- **Útil só em 99%.**

**Guerreiro** — +1 a +3 até 95%; **+11 em 99%**.
- 10% Técnica Letal: +2 de margem corpo a corpo = ~10% mais dano. Pouco, e é a única habilidade de trilha automatizada no sistema.
- 40% Revidar: precisa bloquear antes (uma reação defensiva por rodada) e gastar 2 PE; rende ~7 de dano por combate.
- 65% Força Opressora: derrubar com ataque extra, +20 a +30 de dano por combate. Já se nota, mas o efeito no grupo é pequeno.
- 99% Potência Máxima: dobra o Ataque Especial. É o pico da trilha.
- **Fraco de 10% a 95%.**

**Operações Especiais** — +3 em 40–45%, +1 a +2 de 50% a 95%, +2 em 99%.
- 10% Iniciativa Aprimorada: +5 e ação de movimento na rodada 1. Sem mapa, praticamente nulo.
- 40% Ataque Extra: o melhor momento da trilha (+3 e +4% de PV do grupo). Um ataque a mais por 2 PE.
- 65% Surto de Adrenalina e 99% Sempre Alerta: o limite de PE por turno (= nível) engole o benefício. Em 99% a trilha rende +2 (Sempre Alerta só dá 1 ação extra na 1ª rodada).
- **Útil de 40% a 50%; a partir de 65% perde relevância.**

**Tropa de Choque** — +1 a +3 até 60%; **cresce até +10 em 99%**.
- 10% Casca Grossa: +1 PV por 5% de NEX (no máximo +20 PV) contra ataques que fazem 60–100 de dano. Imperceptível.
- 40% Cai Dentro: exige teste de Vontade do inimigo e só vale uma vez por rodada; funciona (~40 de dano evitado por combate em 65%).
- 65% Duro de Matar: reduz dano à metade por 2 PE (só dano não paranormal até 85%). As ameaças de VD alto causam dano paranormal, o que limita bastante.
- 99% Inquebrável. A trilha só vira tanque de fato de 65% em diante.
- **Fraca até 60%.**

### Combatente (Sobrevivendo ao Horror)

**Agente Secreto** — 0 de 5% a 95%; +1 em 99%. Carteirada, Sorriso e Método Investigativo não têm uso em combate. Multifacetado (99%) copia habilidades de outra trilha até 65%, mas custa 5 de Sanidade e só 1 vez por cena. **Sem função de combate.**

**Caçador** — 0 até 55%, +1 a +2 de 60% a 95%, **+9 em 99%**. Rastrear e Atacar das Sombras são de furtividade/investigação; Estudar Fraquezas dá só +1 em testes. Em 99%, Estudar a Presa (+1d20, +1 margem e multiplicador, RD 5 contra **um** tipo de ser) é forte, **mas só depois de uma ação de interlúdio de estudo**. **Útil só em 99% e só contra o tipo estudado.**

**Monstruoso (Sangue / Morte / Energia / Conhecimento)** — +3 a +5 de 40% a 99% (Sangue e Energia melhores; Conhecimento e Morte ficam em +2 a +3). A RD de 5/10/15/20 só vale contra um tipo de dano (balístico e Sangue, perfuração e Morte etc.), e as ameaças de VD alto causam sobretudo dano paranormal de outros elementos. Custo: Presença −1 duas vezes e perda de apoio da Ordem. **Marginal em todos os níveis**: cobra muito (perturbado, banido) para o que entrega.

### Especialista

**Atirador de Elite** — −1 a +2 em todos os níveis (+2 em 40–60%, ~+1 depois, −1 em 99%).
- 10% Mira de Elite: +Int no dano com balas longas. Int 3–4 de dano num fuzil de 2d10 é pequeno.
- 40% Disparo Letal: +2 de margem ao mirar. Sem acertar, a margem não importa.
- 65% Disparo Impactante: manobra em vez de dano. Controle não medido, mas depende de acertar.
- 99% Atirar para Matar: crítico = dano máximo. Raríssimo de acontecer (precisa acertar antes).
- **Nunca relevante; inútil a partir de 70% (0 a +1, e −1 em 99%).** Causa raiz: sem Ataque Especial, o Especialista não acerta Defesa 36+ (seção 3).

**Infiltrador** — +1 até 60%, +2 a +3 de 65% a 95%.
- 10% Ataque Furtivo: +1d6 (depois 2d6/3d6/4d6) 1 vez por rodada, só contra desprevenido/flanqueado (≈50% das rodadas). Mesmo problema do Atirador: dano plano contra PV enormes.
- 40% Gatuno, 99% Sombra Fugaz: furtividade. 65% Assassinar: forte em tese (alvo inconsciente se falhar Fortitude), mas a DT 10+nível+Agi perde para o Fortitude de ameaças de VD alto.
- **Marginal em todos os níveis.**

**Médico de Campo** — **+3 em 10%, +7 em 15%, +10 de 20% em diante, até +15.** A referência de utilidade: Paramédico (2d10 a 5d10 de cura por 2 a 5 PE) mantém o grupo de pé. Equipe de Trauma/Reanimação raramente entram no teste. Limites: exige kit de medicina e é uma ação padrão (o médico quase não ataca: dano pessoal 5–15 por combate); em 99% a cura de ~27 PV pesa pouco contra ameaças que causam 150+ por rodada.

**Negociador** — 0 a +2. Eloquência (fascinar) é interrompida por qualquer dano e hostis têm +5; Discurso Motivador (+1/+2 dados em testes por 4/8 PE) só traz +1 a +2 porque acertar não é o limitador em níveis médios. Eu Conheço um Cara e Truque de Mestre são de fora do combate. **Sem função de combate relevante.**

**Técnico** — 0 em todos os níveis. Inventário, Remendão, Improvisar e Preparado para Tudo são todos logísticos. **Sem função de combate.**

### Especialista (Sobrevivendo ao Horror)

**Bibliotecário** — 0 sempre. Conhecimento Prático/Leitor Contumaz/Rato de Biblioteca/Força do Saber só tocam perícias de investigação (e Luta/Pontaria são explicitamente excluídas). **Sem função de combate.**

**Muambeiro** — 0 sempre. Fabricação e Laboratório de Campo são de interlúdio; Achado Conveniente (99%) cria item de categoria até III, mas não muda o resultado. **Sem função de combate.**

**Perseverante** — +1 a +2 até 80%, +2 em 99%. Soluções Improvisadas (refazer 1 dado) ajuda pouco; Só Mais Um Passo mantém o personagem em 1 PV (5 PE/rodada), o que só adia a queda (mais dano sofrido, quase nada de vitória). Marginal.

### Ocultista

**Conduíte** — 0 até 35%, +2 a +6 de 40% a 90%, **+13 em 99%**. Ampliar (10%) é de alcance/área; Acelerar (40%) é o que importa (segundo ritual por rodada, +4 PE); Anular (65%) não aparece porque as ameaças do compêndio não conjuram rituais. Útil a partir de 40%.

**Flagelador** — +5 de 40% a 80%, +3 a +5 depois. Poder do Flagelo (PV por PE) e Abraçar a Dor (dano à metade, 2 PE) são trocas sólidas; Absorver Agonia dá poucos PE. Consistente, nunca explosivo.

**Graduado** — **0 até 60%**, +5 em 65% (DT +5), +2 a +3 depois. Saber Ampliado/Grimório dão mais rituais, o que não aparece num teste que já deixa o ocultista usar todos os rituais de dano; só o +5 de DT importa. Inútil até 60%; marginal depois.

**Intuitivo** — **0 até 60%**, +1 a +4 depois. Mente Sã e Inabalável protegem contra dano mental/paranormal (cada ameaça só causa um tipo); Presença Poderosa (+Presença no limite de PE por turno em rituais) é o que rende, em 99% (+4). Marginal.

**Lâmina Paranormal** — **−2 a −11 de 15% a 60%**, ~0 de 65% a 95%, **+14 em 99%**. Ocultismo no lugar de Luta usa Int (1–3 dados) contra Defesa, e o dano de corpo a corpo + 1d6/2d6 fica abaixo de um ritual de dano; Conjuração Marcial (65%) quase empata; só Lâmina do Medo (99%, Fortitude ou 0 PV por 10 PE) faz a trilha valer. **É pior que um ocultista comum durante uns 45 pontos de NEX.**

### Ocultista (Sobrevivendo ao Horror)

**Exorcista** — 0 até 60%, +1 a +2 depois. Todo o texto é de perícia e Sanidade; Parareligiosidade (65%) é só +2 DT no teste.

**Parapsicólogo** — 0 sempre (cura mental/Sanidade, fora do escopo do teste).

**Possuído** — +1 a +4 até 95%, **+16 em 99%**. Pontos de Possessão (10 PV ou 2 PE cada) são uma bateria útil mas pequena; o salto é o Presente do Tempo (turno adicional por rodada, 6 PE). **O maior salto de 99% entre todas as trilhas.**

### Sobrevivente (estágios 1 a 5; ameaças de VD 20/40/80 contra 4 sobreviventes)

| Trilha | Efeito medido |
|---|---|
| Durão | +0 em VD 20/40; +3 a +6 pontos de vitória em VD 80 (estágios 2 a 5: +4 PV e +2 PV). Útil só contra ameaças fortes. |
| Esperto | 0 em todos os estágios (uma perícia treinada; Entendido é de perícia). |
| Esotérico | 0 até o estágio 3; no 4 (Iniciado: 1 ritual de 1º círculo) o **dano dobra** (ex.: 11→21 por combate em VD 80), mas a vitória sobe só +2. |

## 5. Cobertura no sistema Foundry (o que é automático hoje)

Pelo código do sistema (`attack-power-effects.mjs`, `attack-options.mjs`): estão integrados na tela de ataque o Ataque Especial, Golpe Pesado, Tiro Certeiro, **Técnica Letal (Guerreiro 10%)**, Golpe Demolidor, Combate Defensivo, Mão Pesada, Para Bellum e Pancada Forte. **Nenhuma outra habilidade de trilha** (Técnica Secreta, Ataque Extra, Surto, Cai Dentro, Revidar, Ataque Furtivo, Paramédico, Discurso Motivador, Possessão etc.) tem automação em combate, segundo o que encontrei. O relatório anterior (`relatorio-armas-combate.md`) já listava isso como pendência. Ou seja: hoje a maior parte do "valor de trilha" depende de o jogador/mestre aplicar a regra à mão.

## 6. Sugestões e resultado simulado

Cada sugestão foi rodada com os mesmos encontros e sementes. A tabela mostra **efeito atual → efeito com a sugestão**, em pontos de vitória do grupo. O teto atual das melhores trilhas em NEX 99% é +14 a +16 (Médico, Conduíte, Possuído, Lâmina); uma sugestão que passasse muito disso desequilibraria.

| Sugestão | NEX 25% | NEX 40% | NEX 50% | NEX 65% | NEX 80% | NEX 99% |
|---|--:|--:|--:|--:|--:|--:|
| atirador | -1 → **+2** | +2 → **+4** | +2 → **+5** | +1 → **+4** | +1 → **+5** | -1 → **+1** |
| infiltrador | +1 → **+2** | +1 → **+3** | +1 → **+4** | +2 → **+7** | +3 → **+13** | +2 → **+14** |
| aniquilador | +0 → **+1** | +3 → **+4** | +2 → **+2** | +1 → **+3** | +0 → **+4** | +4 → **+14** |
| guerreiro | +1 → **+1** | +2 → **+3** | +2 → **+3** | +1 → **+3** | +3 → **+4** | +11 → **+12** |
| comandante | +1 → **+1** | +1 → **+1** | +1 → **+1** | +0 → **+1** | +2 → **+3** | +10 → **+10** |
| opespeciais | +1 → **+1** | +4 → **+4** | +2 → **+2** | +0 → **+0** | -1 → **-1** | +2 → **+2** |
| tropa | +1 → **+2** | +1 → **+2** | +1 → **+2** | +3 → **+3** | +5 → **+5** | +10 → **+10** |
| negociador | +0 → **+3** | +2 → **+5** | +1 → **+3** | +1 → **+2** | +1 → **+2** | +2 → **+2** |
| tecnico | +0 → **+0** | +0 → **+0** | +0 → **+0** | +0 → **+4** | +0 → **+5** | +0 → **+8** |
| bibliotecario | +0 → **+0** | +0 → **+4** | +0 → **+3** | +0 → **+4** | +0 → **+6** | +0 → **+4** |
| muambeiro | +0 → **+0** | +0 → **+3** | +0 → **+3** | +0 → **+1** | +0 → **+1** | +0 → **+1** |
| agentesecreto | +0 → **+0** | +0 → **+0** | +0 → **+1** | +0 → **+0** | +0 → **+0** | +1 → **+1** |
| lamina | -7 → **-7** | -7 → **+1** | -7 → **+0** | -3 → **0** | -1 → **-1** | +14 → **+14** |
| graduado | +0 → **+0** | +0 → **+1** | +0 → **+1** | +5 → **+5** | +3 → **+3** | +2 → **+3** |
| tropa2 | +1 → **+2** | +1 → **+3** | +1 → **+4** | +3 → **+7** | +5 → **+8** | +10 → **+15** |
| comandante2 | +1 → **+1** | +1 → **-2** | +1 → **-3** | +0 → **-1** | +2 → **-1** | +10 → **+10** |
| comandante3 | +1 → **+1** | +1 → **+4** | +1 → **+2** | +0 → **+1** | +2 → **+2** | +10 → **+10** |


(Linhas `tropa2`, `comandante2` e `comandante3` são variações alternativas do mesmo tema; `tropa` e `comandante` são as primeiras tentativas.)

### O que cada sugestão propõe, e como ficou

1. **Atirador de Elite: Mira de Elite soma Int também no ataque; Disparo Letal ao mirar dá +1d20 e +1 por 5% de NEX no ataque.** Ataca a causa (acerto). Dano pessoal dobrou (59→72 em 40%, 46→109 em 80%), efeito +2→+4/+5 pontos. **Não resolve 99%** (+1): precisa de um bônus de acerto ainda maior ou de ataque que não dependa de Defesa. Não desequilibra.
2. **Infiltrador: furtivo 1d6/3d6/5d6/8d6; vale contra qualquer alvo engajado com um aliado; +1 no teste por 10% de NEX no ataque furtivo.** +1/+2 → +7 (65%) e **+13/+14 (80–99%)**. Dano pessoal triplicou. Fica no teto da tabela; eu começaria com 6d6 em 99% e reavaliaria.
3. **Aniquilador: A Favorita dá +1 no ataque por 20% de NEX.** +3→+4 (40%), +1→+3 (65%), **+4→+14 (99%)**. O 99% fica no limite; se achar demais, use +1 por 25%.
4. **Guerreiro: Técnica Letal soma +1 no multiplicador de crítico a partir de 40%.** +2→+3 em 40–65%. **Melhora pouco**: o problema (poucos críticos) é de probabilidade, não de multiplicador. Alternativa a testar: Técnica Letal escalando a margem (+2, +3, +4).
5. **Comandante:** três tentativas. (a) Estrategista como ação de movimento dando +1d20 aos aliados: ±0 (aliados já acertam o que precisam). (b) Estrategista dando uma ação padrão adicional com −1d20: **piorou** (−2 a −3 em 40–50%, o comandante nunca ataca). (c) **Brecha na Guarda chegando em 40%, 1 PE e várias vezes por rodada: +1→+4 em 40%**, mas some depois. Recomendação: (c), e aceitar que o 99% (+10) é o poder do Comandante.
6. **Operações Especiais: 2º Ataque Extra por rodada em 99%**: sem mudança (+2→+2). A causa é o limite de PE por turno, não a quantidade de ataques. Alternativa (não testada): em 65%, Surto de Adrenalina deixa de contar para o limite de PE por turno.
7. **Tropa de Choque: Casca Grossa +Vigor PV por 5%, Cai Dentro sem teste de Vontade, Duro de Matar contra paranormal desde 65%** (`tropa2`): +3→+7 em 65%, +5→+8 em 80%, **+10→+15 em 99%**. Só a Casca Grossa (+PV) rende pouco (+10→+10); o que faz a diferença é o Cai Dentro garantido e o Duro de Matar paranormal. O 99% encosta no teto.
8. **Negociador: Eloquência ganha uma versão de combate, "Desmoralizar" (ação de movimento, 1 PE por alvo, alvo fica com −2d20 nos ataques).** Dá +3 nos níveis baixos e +2 a +5 no meio. Valor modesto, mas passa de zero.
9. **Técnico: Improvisar produz explosivos (4 PE, 6d6 em área; 10d6 em 99%).** +4 em 65%, +5 em 80%, **+8 em 99%** (dano pessoal 19→156). Dá ao técnico um papel, sem passar de nenhuma trilha de combate.
10. **Bibliotecário: Leitura de combate (movimento + 2 PE; aliados somam 1d8, 2d8 em 65%, nos ataques contra o alvo estudado).** +3 a +6 de 40% em diante.
11. **Muambeiro: modificar a arma de um aliado em campo (+1 dado de dano até o fim da cena, 2 PE).** +3 em 40–50%, +1 depois. Pequeno e seguro.
12. **Agente Secreto: Multifacetado em escala (40%: iniciativa; 65%: Ataque Extra; 99%: Surto).** +0 a +1. **Não funciona**: copiar habilidades fracas continua dando nada. Precisa de uma habilidade própria de combate; ideia (não testada): trocar Método Investigativo (65%) por um "Plano B" (reação para um aliado refazer um ataque).
13. **Lâmina Paranormal: Conjuração Marcial desde 40% por 1 PE, e Amaldiçoar Arma já com o bônus do círculo por custo base + 1 PE.** **−7→+1 (40%), −7→0 (50%), −3→0 (65%)**: sai do negativo e fica no nível de um ocultista comum, sem mexer em 99% (+14).
14. **Graduado: DT +2/+3/+5/+7 em 10/40/65/99% (em vez de só +5 em 65%).** +0→+1 antes de 60%. O ganho verdadeiro da trilha (rituais extras) não aparece no simulador; sugiro manter e só acrescentar a DT escalonada.

### Trilhas que eu deixaria como estão
Médico de Campo (referência), Conduíte, Flagelador e Possuído (o 99% já é o maior da tabela; se quiser desequilibrar menos, limite o Presente do Tempo a 1 vez por cena; isso não foi testado).

### Trilhas em que a sugestão não resolve e precisam de decisão sua
- **Parapsicólogo, Exorcista, Intuitivo, Perseverante** (defesas mentais, Sanidade, medo): as ameaças do compêndio quase não usam dano mental/condições nas fichas, então o teste não mede. Eu manteria o papel de investigação/Sanidade e confirmaria com uma mesa de teste.
- **Monstruoso**: o custo narrativo (perturbado, banido da Ordem) é alto para +3 a +5. Ideia (não testada): aumentar o ganho em 40%.
- **Sobrevivente (Esperto e Esotérico)**: o 4º estágio do Esotérico duplica o dano, mas o ganho de vitória é +2; é coerente com a regra de que "o sobrevivente não é equilibrado".

## 7. Como repetir

```
cd work/sim
node all.mjs          # matriz completa (ENC/REPS/LVLS/OUT por variável de ambiente)
node vrun.mjs         # sugestões (variants.mjs)
node survivor.mjs     # trilhas do Sobrevivente
node live-calib.mjs   # calibração ao vivo na arena (precisa do servidor em :30000; usa o usuário "Mapa Maker")
```
