# Spec — Rituais de área (dano e efeitos automáticos)

**Sistema:** Ordem Paranormal v2 Classic no Foundry VTT 14. **Código:** `systems/ordem_v2_classic/module/macros/`
(`ritual-area-rules.mjs` mapeia cada ritual; `ritual-area-engine.mjs` aplica; `ritual-area.mjs` posiciona a área;
`ritual-area-live-test.mjs` testa no jogo). Regras: Livro v1.3 (descrição de cada ritual no item da ficha).

## Como funciona

1. O jogador conjura pela macro de rituais. Em ritual de área, posiciona a área no mapa **antes** de pagar (cancelar não gasta nada).
2. Paga o custo e rola o teste de Ocultismo do custo (regra existente, `docs/spec-macro-conjuracao-rituais.md`).
3. O Mestre (cliente do Mestre) resolve a área: **só ameaças** dentro dela são afetadas (jogador contra ameaça); o conjurador e outros agentes não.
4. A área persistente é uma **Região** do Foundry (no v14 o Modelo Medido é só atalho legado e não guarda dados).

## Decisões de interpretação (confirme se algo estiver diferente na sua mesa)

- **Resistência automática:** a DT é `actor.system.ritual.DT` do conjurador. Cada ameaça rola o teste sem diálogo; a carta de perícia (com SUCESSO/FALHA) vai ao chat.
- **Dano:** rolado **uma vez** e igual para todos; quem resistiu leva a metade (cada tipo de dano arredondado para baixo), quem falhou leva tudo. Imunidades, RD e vulnerabilidades da ameaça valem (usa `applyDamage` do sistema). Ritual que diz que o sucesso anula o dano não causa nada a quem resiste.
- **"Início de cada um de seus turnos":** quando o texto fala do turno do conjurador (Poeira da Podridão, Tentáculos de Lodo, Tecer Ilusão), o efeito roda no turno **do conjurador** para todos na área. Quando fala do turno da criatura (Presença do Medo, Miasma verdadeiro, Paradoxo discente), roda no turno **de cada criatura** dentro da área.
- **Saída da área (Purgatório):** a criatura que tenta sair leva 6d6 de Sangue sempre; a resistência só decide se consegue sair. Se falhar, volta à posição anterior e perde a ação de movimento.
- **Condições que o sistema não tem** (Enjoado, Vulnerável, Compelido a dizer a verdade, Sem recuperar PV…) viram um Efeito Ativo com nome e duração em rodadas. As que o sistema tem usam o status oficial (Atordoado, Sangrando, Surdo, Silenciado, Contido).
- **Duração em rodadas** (Miasma verdadeiro, 3 rodadas): vale a partir da rodada da conjuração, só em combate.
- Os efeitos de turno e de saída só rodam na **cena que o Mestre está vendo**.

## Requisitos e cobertura

Cada linha é um requisito (AR-xx) com o ritual, a forma (B = básico, D = discente, V = verdadeiro) e o comportamento. A coluna **Teste** é o id do caso em `ritual-area-live-test.mjs`.

### Dano instantâneo com resistência (metade/inteiro)

| Id | Ritual (forma) | Área | Dano · resistência | Efeito extra | Teste |
|---|---|---|---|---|---|
| AR-01 | Paradoxo (B) | esfera 6 m | 6d6 Morte · Fort. metade | — | AR-01a |
| AR-01 | Paradoxo (V) | esfera 6 m | 13d6 Morte · Fort. metade | a 0 PV: Fort., falhou = cinzas (morre) | AR-01b, AR-01c |
| AR-02 | Miasma Entrópico (B / D / V) | esfera 6 m | 4d8 químico / 6d8 Morte · Fort. metade | falhou: Enjoado 1 rodada | AR-02a–c |
| AR-03 | Deflagração de Energia (B / V) | esfera 15 m (V: só alvos escolhidos) | 3d10×10 Energia · Fort. metade | falhou: itens quebrados; passou: inoperantes 1d4 rodadas | AR-03a–b |
| AR-04 | Esfolar (B / D / V) | B: alvo; D e V: explosão 6 m | 3d4+3 / 5d4+5 / 10d4+10 corte · Reflexos metade | falhou: Sangrando; V: sangra também quem resistiu | AR-04a–c |
| AR-05 | Eletrocussão (B / D / V) | B: alvo; D: linha 30 m; V: alvos escolhidos | 3d6 elétrico / 6d6 / 8d6 Energia · Fort. metade | B: falhou fica Vulnerável 1 rodada | AR-05a–c |
| AR-06 | Decadência (B / D / V) | B e D: alvo; V: explosão 6 m no conjurador | 2d8+2 / 3d8+3 (sem resistência) / 8d8+8 Morte · Fort. metade | — | AR-06a–c |
| AR-07 | Consumir Manancial (V) | esfera 6 m no conjurador | 3d6 Morte · Fort. metade | conjurador ganha PV temporários = dano total (avisado no chat) | AR-07 |
| AR-08 | Transfigurar Água · Evaporar (B / V) | esfera 30 m | 5d8 / 10d8 Energia · Fort. metade | demais escolhas: só aviso | AR-08a–c |
| AR-09 | Transfigurar Terra · Amolecer (B / D) | 9 / 15 cubos de 1,5 m | 10d6 impacto · Reflexos metade | Solidificar: Contido; Modelar: aviso | AR-09a–d |

### Zonas que repetem no início do turno

| Id | Ritual (forma) | Quando repete | Efeito | Teste |
|---|---|---|---|---|
| AR-10 | Poeira da Podridão (B / V) | turno do conjurador (e ao conjurar) | 4d8 (V: 4d8+16) Morte · Fort. metade; falhou: sem recuperar PV 1 rodada | AR-10a–b, AR-20c |
| AR-11 | Presença do Medo (B) | turno de cada criatura (e ao conjurar); acompanha o conjurador | 5d8 mental + 5d8 Medo · Vontade metade nos dois; falhou: Atordoado 1 rodada (1×/cena) | AR-11, AR-20e |
| AR-12 | Tentáculos de Lodo (B / V) | turno do conjurador (e ao conjurar) | Ocultismo contra Luta: vence = Agarrado; já agarrado = esmagado 4d6 (V: 6d6; metade impacto, metade Morte) | AR-12a–c, AR-20d |
| AR-20a | Paradoxo (D) | turno de cada criatura na esfera de 1,5 m | 4d6 Morte, sem resistência (a esfera é arrastada pelo Mestre) | AR-20a |
| AR-20b | Miasma Entrópico (V) | turno de cada criatura, por 3 rodadas | 6d8 Morte · Fort. metade; falhou: Enjoado | AR-20b, AR-20g |
| AR-16 | Tecer Ilusão (V) | turno do conjurador (e ao conjurar) | 6d6 Conhecimento · Vontade; só dano em quem falha; 2 sucessos seguidos anulam | AR-16a, AR-20f |

### Gatilho de saída e condições de área

| Id | Ritual (forma) | Comportamento | Teste |
|---|---|---|---|
| AR-13 | Purgatório | ao conjurar: inimigos na área ficam vulneráveis a balístico, corte, impacto e perfuração (dano ×2 enquanto na área) | AR-13 |
| AR-21 | Purgatório | ao tentar sair: 6d6 Sangue sempre + Fort.; passou = sai; falhou = volta e perde a ação de movimento | AR-21 |
| AR-14 | Aurora da Verdade (B / D / V) | Vontade; falhou: Compelido a dizer a verdade; passou: nada | AR-14a–c |
| AR-15 | Dissonância Acústica (B) | sem resistência: todos na esfera de 6 m ficam Surdos e Silenciados | AR-15 |

### Só marcam a área e avisam (sem automação)

AR-17: Cinerária, Rejeitar Névoa, Nuvem de Cinzas, Detecção de Ameaças, Localização, Tecer Ilusão (B/D), demais escolhas de Transfigurar Água/Terra. Testes AR-17a–e e AR-16b: a área aparece no mapa, o chat explica o efeito e nenhuma ameaça é alterada.

## Fora de escopo (decisões a tomar com a mesa)

- Rituais que dependem de um objeto, caminho ou ficção (Luz, Sopro do Caos, Dissipar Ritual, Chamas do Caos, Esconder dos Olhos, Tela de Ruído): continuam manuais.
- Pontos de vida temporários (Consumir Manancial) e a perda permanente de Sanidade: o agente não tem campo para isso; o chat avisa.
- "Perde a ação de movimento" e "Enjoado" são Efeitos Ativos informativos: o sistema não os aplica sozinho.
- Rituais lançados por uma ameaça contra um agente: não suportado (o motor só afeta ameaças).

## Como testar

No console do navegador, como Mestre, com uma cena aberta que tenha o token de um agente:

```js
const t = await import("/systems/ordem_v2_classic/module/macros/ritual-area-live-test.mjs");
await t.runAreaRitualTests();                // todos
await t.runAreaRitualTests({ only: "AR-12" }); // por prefixo
```

O teste cria ameaças temporárias (passa sempre / falha sempre / imune / fora da área), copia o ritual da "Biblioteca de Rituais" para o agente, e remove tudo no fim.

## Alvos, alcance e seleção pelo chat

Os campos `alcance` e `alvo` do ritual (e o texto da forma Discente/Verdadeira) valem de verdade. Código: `ritual-targeting.mjs`; testes: `tests/unit/ritual-targeting.test.mjs` e TG-01 a TG-09.

| Id | Requisito |
|---|---|
| AL-01 | **Sem informação de alcance vale curto (9 m).** Médio 18 m, longo 36 m, extremo 90 m, ilimitado sem limite. |
| AL-02 | **Toque** exige o alvo no espaço ao lado (inclusive na diagonal), não 9 m. **Pessoal** não usa alvos. |
| AL-03 | A forma pode mudar o alcance ("muda o alcance para “pessoal”", "alcance longo"): vale o da forma. |
| AL-04 | **Quantidade de alvos** vem do texto ("1 ser", "até 5 seres voluntários", "alvos escolhidos" = sem limite) e também da forma ("até 5 seres escolhidos"). |
| AL-05 | Alvos marcados **antes de conjurar** que não cumpram quantidade e alcance bloqueiam a conjuração com aviso e **nada é gasto**. |
| AL-06 | Sem alvo marcado, o ritual é conjurado (custo e Ocultismo) e a carta do chat traz o botão **Selecionar alvos e rolar dano**: o jogador marca os alvos (tecla T) e clica; os mesmos limites valem. Sem alvo marcado ao clicar, só avisa. |
| AL-07 | Ritual de área: o jogador posiciona a área no mapa (a área já vem com o tamanho certo do ritual; a roda gira). **Clique fora do alcance é recusado** com aviso. |
| AL-08 | Se a área não for posicionada (Esc ou botão direito), o ritual é conjurado e a carta traz **Selecionar área**; o botão abre a mesma prévia e resolve ao clicar. |
| AL-09 | Área centrada no conjurador (Presença do Medo, Decadência/Consumir Manancial verdadeiros): sem clique. |

## Condições com efeito mecânico (Livro v1.3)

Código: `module/helpers/conditions.mjs` (catálogo) e o motor de área. O sistema só tinha ícones; agora cada condição dos rituais age de verdade.

| Id | Condição | Efeito | Teste |
|---|---|---|---|
| CD-01 | Vulnerável | Defesa −2 (volta ao normal ao sair) | CD-01 |
| CD-02 | Atordoado | Defesa −5 (desprevenido) e −1d20 em Reflexos | CD-02 |
| CD-03 | Surdo | −2d20 em Iniciativa; conjurar conta como condição ruim (teste de Vontade) | CD-03, CD-07 |
| CD-04 | Agarrado | −1d20 em testes de ataque (e desprevenido) | CD-04 |
| CD-05 | Sem recuperar PV | a cura é bloqueada enquanto durar | CD-05 |
| CD-06 | Silenciado | não pode conjurar rituais | CD-06 |
| CD-08/09 | Sangrando | início do turno: Vigor DT 20; passou = estanca; falhou = perde 1d6 PV e continua | CD-08, CD-09 |
| CD-10 | Atordoado | não pode agir: o turno é pulado | CD-10 |
| CD-11 | duração em rodadas | a condição vence sozinha | CD-11 |

"−1d20" significa um dado a menos no teste: 3d20 vira 2d20; chegando a zero dados, joga-se 2d20 e fica o menor (regra do sistema). Aparece na fórmula da carta de perícia.

## Batalha

BT-01: cinco agentes de NEX 05, 25, 50, 75 e 99 (atributos diferentes, armas Revólver, Machete e Fuzil de Assalto) contra cinco ameaças, três rodadas de combate. Cada turno do agente: ataque com arma (dados de ataque e dano de verdade, dano aplicado) e, em rodadas escolhidas, Paradoxo (área posicionada pelo mapa) e Esfolar (alvo marcado). Confere: dano total nas ameaças, PD gasto, rituais resolvidos, nenhum erro de script.

## Resultado dos testes (18/10/2026, Foundry 14.369)

- **Unitários (`npm test`): 96 de 96** (inclui alcance, alvos, área, mapeamento dos rituais e condições).
- **Ao vivo por script (`runAllRitualSpecs()`): 72 de 72** numa cena temporária com cópias dos agentes (AR 51, CD 11, TG 9, BT 1).
- **Pela interface de verdade (Playwright, mouse e teclado reais, combate pelo botão do carrossel de combate):**
  - **Todos os 98 rituais, em todas as formas e escolhas de efeito (263 conjurações): 256 resolvidas.** Nenhum erro de script e nenhum aviso de erro; todas com o PD cobrado. Uma foi bloqueada de propósito (Vínculo de Sangue, 4º círculo, com o agente NEX 05 sem PD). Em 6 conjurações de área o clique no mapa não foi aceito dentro de 15 s; nelas a carta ficou com o botão **Selecionar área**, como projetado.
  - **Combate de 3 rodadas pelo carrossel (33 cliques no botão de avançar turno):** os cinco agentes (NEX 05 a 99) atacaram com Machete, Revólver e Fuzil de Assalto (dano aplicado nas ameaças); o Atordoado nunca teve turno nas 3 rodadas; o Sangrando tirou 1d6 PV a cada turno (4938 → 4910 → 4883 → 4872); a zona de Miasma verdadeiro atingiu as ameaças nas rodadas 24 a 26 e parou na 27; o Enjoado venceu sozinho.
- **Achados dos testes pela interface e corrigidos:** (1) toque não valia para o quadrado ao lado quando o token é menor que um quadrado (0,7); (2) clicar para posicionar a área sobre um token era engolido pelo token; (3) ritual de cura em ameaça falhava ("Alvo sem PV estruturado"); (4) o Automated Animations lançava erro em toda conjuração (agora a animação só é chamada se o módulo estiver com as configurações registradas); (5) rituais só de texto (Tecer Ilusão) ficavam esperando alvo.
- **Vários Mestres (MM-01):** os efeitos de turno, de movimento (Purgatório) e de apagar a zona rodam só no cliente do **Mestre ativo** (`game.user.isActiveGM`) e usam os documentos da cena do combate (`combat.scene`, `tokenDoc.parent`), não a cena que esse Mestre está vendo. Com dois Mestres (usuários diferentes) vendo cenas diferentes, o efeito é aplicado uma vez só. Antes disso, as zonas por turno e o Purgatório não faziam nada quando o Mestre ativo olhava outra cena (8 falhas). Testado: suíte ao vivo 72/72 com Gamemaster na arena e Mapa Maker (Mestre ativo) em outra cena.
- **Limite conhecido:** o **mesmo usuário Mestre logado em dois navegadores** conta como dois clientes e pode dobrar o dano. Para dois Mestres, use usuários diferentes.
- **Não coberto:** conjuração feita por um jogador em outro navegador; Enjoado, Compelido a dizer a verdade e "Itens tecnológicos" (só informativos).
