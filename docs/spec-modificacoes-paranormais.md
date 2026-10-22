# Spec — Modificações paranormais (maldições de armas, proteções e acessórios)

Status (21/10/2026): **implementado** (fases 0 a 3 e preço da maldição por botão). Decisões tomadas por falta de resposta do Geh: D1 = maldições do livro + Lente de Revelação; D2 = elementos opressores só **avisam**; D3 = sem Sanidade o preço tira PD; D4 = efeitos ligam ao **equipar** (`using.state`); D5 = tipo novo `curse`. Onde está: `module/helpers/curse-rules.mjs` (regras puras), `curses.mjs` (Foundry), compêndio `curses` (gerado por `tools/maldicoes/gerar-fonte-maldicoes.mjs`), teste `tests/unit/maldicoes.test.mjs` e ao vivo `docs/macros/maldicoes-live-test.js`. **Fica para depois:** chip de elemento no inventário da ficha, selo de patente (M2), oferta do preço direto no cartão de teste falho, ícones (`spec-icones-maldicoes.md`).

**Interpretação do pedido.** Entendi "modificações paranormais" como o que o livro chama de **maldições**: "Maldições funcionam como modificações — fornecem um benefício ao item ao custo de aumentar sua categoria" (`06-o-outro-lado/1007`). Entra também a única modificação paranormal do Sobrevivendo ao Horror, a **Lente de Revelação** (câmera de aura). Se o Geh quis dizer outra coisa, corrigir antes de implementar (D1).

Fonte (Livro de Regras v1.3, livro p. 144–147, em `regras/06-o-outro-lado/1007` a `1055`) e Sobrevivendo ao Horror (`11-sobrevivendo-ao-horror/04-equipamentos.md`, `07-itens-amaldicoados.md`). O código segue o livro.

---

## 1. Regras gerais das maldições

| # | Regra | Fonte |
|---|---|---|
| M1 | Armas, proteções e acessórios amaldiçoados têm **uma ou mais maldições**. | 1007 |
| M2 | Escolhe-se como item modificado, para a missão. Liberados só para **agente especial, oficial de operações e agente de elite**, qualquer que seja a categoria. | 1010 |
| M3 | Um item pode ter várias maldições, mas **não** de **elementos opressores** entre si, e **maldições iguais não se acumulam**. | 1010 |
| M4 | A **primeira** maldição soma **+II** à categoria; as seguintes **+I**. Modificações comuns (+I cada) somam por cima. | 1010 |
| M5 | Maldições de arma/proteção funcionam **sozinhas** ao empunhar/vestir. Acessório: alguns automáticos, outros precisam ser **ativados**; item que precisa ser ativado precisa antes ser **identificado** (Ocultismo). | 1012 |
| M6 | DT de teste de resistência do alvo = DT de habilidade com **Presença**. | 1012 |
| M7 | Rituais a partir de item: sem gestos nem componentes; versões avançadas custam o adicional e exigem pré-requisitos. | 1012 |
| M8 | Mesmo espaço do item comum; seguem os limites de uso. **Bônus de itens amaldiçoados não acumulam** (utensílio do Carisma + vestuário do Carisma = +1 Presença, não +2). | 1014 |
| M9 | **Preço da maldição** (cumulativo, até o fim da missão, ver §5): falhar em teste do atributo do elemento custa **2 de Sanidade por maldição** daquele elemento em todos os seus itens. | 1015 |
| M10 | Resistência do próprio item: **+10 PV e +10 RD por maldição** (ex.: revólver PV 5/RD 10 com 2 maldições = PV 25/RD 30); item não usado faz resistência com +10 por maldição. | 1017 |

**Elementos opressores** (para M3): Sangue–Conhecimento, Conhecimento–Energia, Energia–Morte, Morte–Sangue. A leitura mais direta de M3 é: **não pode ter duas maldições cujos elementos sejam opressores um do outro** (ou seja, pares adjacentes no ciclo). Combinam: Conhecimento+Morte e Energia+Sangue. (Confirmar — D2.)

**Preço por elemento (M9):** Conhecimento → teste baseado em Intelecto; Energia → Agilidade; Morte → Presença; Sangue → Força **ou** Vigor; Medo → preço próprio de cada item, definido pelo Mestre e que pode mudar de portador.

---

## 2. Inventário das 35 maldições

### 2.1 Armas (12) — `1018` a `1030`

| Elemento | Maldição | Efeito | Custo | Tratamento proposto |
|---|---|---|---|---|
| Conhecimento | Antielemento | +4d8 de dano contra criatura de um elemento (1d4 define: 1 Conh., 2 Energia, 3 Morte, 4 Sangue) | 2 PE | auto: botão de dano extra |
| Conhecimento | Ritualística | armazena ritual de alvo/área, descarrega ao acertar (ação livre) | PE do ritual | semi: guarda o ritual, descarga manual |
| Conhecimento | Senciente | arma flutua e ataca sozinha 1×/rodada em alcance curto | ação de movimento + 2 PE, manter 1 PE/turno | manual (cartão de uso) |
| Energia | Empuxo | arremessável (curto), +1 dado de dano ao arremessar, volta ao fim; só corpo a corpo | — | semi: dado extra ao arremessar |
| Energia | Energética | +5 no ataque, ignora RD, converte dano em Energia | 2 PE por ataque | auto: opção na janela de ataque |
| Energia | Vibrante | recebe Ataque Extra (Operações Especiais); se já tem, custo –1 PE | — | auto/semi via passivos |
| Morte | Consumidora | alvo atingido fica imóvel por 1 rodada | 2 PE | semi: aplica a condição |
| Morte | Erosiva | +1d8 Morte; +2d4 Morte no início dos turnos do alvo por 2 rodadas | 2 PE (a parte dos 2d4) | auto: dado extra; contínuo manual |
| Morte | Repulsora | +2 Defesa empunhada; bloqueio com 2 PE dá +5 | 2 PE | auto: +2 Defesa; resto manual |
| Sangue | Lancinante | +1d8 Sangue, multiplicado no crítico | — | auto: dado extra com multiplicador |
| Sangue | Predadora | ignora camuflagem/cobertura leves; alcance +1 categoria à distância; margem de ameaça duplica | — | auto: ameaça; resto texto |
| Sangue | Sanguinária | sangramento cumulativo; crítico dá 2d10 PV temporários | — | semi |

### 2.2 Proteções (10) — `1031` a `1041`

| Elemento | Maldição | Efeito | Tratamento proposto |
|---|---|---|---|
| Conhecimento | Abascanta | +5 em resistência a rituais; 1×/cena reflete ritual (reação, PE = custo) | auto: +5 condicional; reflexão manual |
| Conhecimento | Profética | RD Conhecimento 10; 2 PE para rolar resistência de novo | auto: RD; releitura manual |
| Conhecimento | Sombria | +5 Furtividade, ignora penalidade de carga; 1 PE muda a aparência | auto: +5 Furtividade |
| Energia | Cinética | +2 Defesa e RD 2 (leve/escudo) ou 5 (pesada) | auto: depende da categoria da proteção |
| Energia | Lépida | +10 Atletismo, +3 m de deslocamento; 2 PE: ignora terreno difícil, escala, imune a queda ≤ 9 m | auto: perícia e deslocamento |
| Energia | Voltaica | RD Energia 10; 2 PE: 2d6 Energia em adjacentes no fim de cada turno | auto: RD; ativo manual |
| Morte | Letárgica | +2 Defesa; 25% (leve/escudo) ou 50% (pesada) de ignorar dano extra de crítico/furtivo | auto: Defesa; chance manual |
| Morte | Repulsiva | RD Morte 10; 2 PE: Lodo preto, quem ataca corpo a corpo sofre 2d8 Morte | auto: RD; ativo manual |
| Sangue | Regenerativa | RD Sangue 10; 1 PE: cura 1d12 | auto: RD; cura via botão |
| Sangue | Sádica | início do turno: +1 ataque e dano por 10 de dano sofrido desde o último turno | manual (cálculo guiado) |

### 2.3 Acessórios (13) — `1042` a `1055`

| Elemento | Maldição | Efeito | Tratamento proposto |
|---|---|---|---|
| Conhecimento | Carisma | +1 Presença (sem PE adicional) | auto: passivo |
| Conhecimento | Conjuração | guarda um ritual de 1º círculo; pode conjurar como se conhecesse, –1 PE se já conhece | semi: aparece no conjurador |
| Conhecimento | Escudo Mental | resistência mental 10 | auto |
| Conhecimento | Reflexão | 1×/rodada reflete ritual (PE = custo) | manual |
| Conhecimento | Sagacidade | +1 Intelecto (**sem** perícias nem graus de treinamento) | auto, e **não** conta no orçamento de perícias (ver `skill-training-rules.mjs`) |
| Energia | Defesa | +5 Defesa | auto |
| Energia | Destreza | +1 Agilidade | auto |
| Energia | Potência | +1 DT de habilidades, poderes e rituais | auto: campo de DT, se existir |
| Morte | Esforço Adicional | +5 PE, só após **um dia de uso** | auto com trava de tempo |
| Sangue | Disposição | +1 Vigor | auto |
| Sangue | Pujança | +1 Força | auto |
| Sangue | Vitalidade | +15 PV, só após **um dia de uso** | auto com trava de tempo |
| (varia) | Proteção Elemental | resistência 10 a um elemento; conta como item do elemento | auto: escolha do elemento |

**Regra de ouro dos atributos (R7 da spec de perícias treinadas):** +1 em Intelecto de acessório **não** libera perícia nem grau. Já os outros atributos (Agilidade, Presença, Vigor, Força) mexem em Defesa, PV, PE etc. pelo cálculo normal da ficha, mas só como bônus de item (M8: não acumulam entre si).

### 2.4 Modificação paranormal do Sobrevivendo ao Horror

- **Lente de Revelação** — modificação para **câmera de aura paranormal**: permite ver seres invisíveis e incorpóreos e ignorar a camuflagem deles; ação padrão + 1 PE para fotografar criatura em alcance curto, que perde camuflagem até o fim da cena. Categoria da modificação: ler no PDF (a extração de `04-equipamentos.md` está embaralhada).

---

## 3. Modelo de dados

Campo novo nos itens `armament`, `protection` e `generalEquipment` (acessório), ao lado de `system.modifications`:

```
system.curses = [ { key: "lancinante", element: "blood", chosen: null } ]   // chosen: elemento escolhido (Proteção Elemental, Antielemento fixo)
```

- Compêndio ou tabela de código `curse-rules.mjs` (puro, testável em Node): para cada chave → `{ label, element, kind: "weapon"|"protection"|"accessory", rules }`. As `rules` descrevem os efeitos auto como mudanças de efeito ativo (mesmo formato do `passive-effects-rules.mjs`) e, no que for ativo, um `use: { action, cost }`.
- **Categoria**: `effectiveCategory`/`itemCategoryInfo` passam a somar: 0 maldições = 0; ≥1 = **2 + (n–1)** (M4), além de `modificationCount`. Hoje `modificationCount` conta `Set(modifications)` com +1 cada; maldição vira função separada `curseCategoryBonus(n)`.
- **Validação (M3):** ao adicionar maldição, rejeitar igual (já está) e **avisar** (não travar) quando for de elemento opressor de outra já presente. Bloqueio duro só para repetida.
- **Liberação por patente (M2):** a ficha só **informa** (selo vermelho) se a patente não é Agente Especial+, no mesmo padrão do limite de categoria.
- **Efeitos:** ao equipar item com maldição "auto", cria um Efeito Ativo `transfer` marcado `flags.ordem-v2-classic.curseRule`, igual ao `passive-effects`. Desequipar/apagar a maldição remove o efeito. Mudanças de atributo respeitam M8 (usar chave de "não acumula por tipo" — um único bônus de item por atributo).
- **PV/RD do item (M10):** só aparece na ficha do item (`Quebrando Objetos`); sem automação de combate.

---

## 3.1 Compêndio separado: `curses` (Maldições)

As 35 maldições + Lente de Revelação ficam num **compêndio próprio** (`packs/curses`, tipo `Item`, rótulo "Maldições Paranormais"), fora de Armamentos/Proteções/Equipamentos Gerais. Fonte em `packs/_source/curses/*.json`, gerada por `tools/gerar-fonte-maldicoes.mjs` a partir da tabela `curse-rules.mjs` (uma só fonte de verdade; o texto vem do livro).

- **Tipo do item:** novo `curse` (ou, se preferir não criar tipo, `generalEquipment` com `flags.ordem-v2-classic.curse`; decidir em D5 — recomendo tipo novo, só dados, sem ficha própria pesada).
- **Campos:** `system.curseKey`, `system.element` (knowledge/energy/death/blood/fear), `system.applies` (`weapon`|`protection`|`accessory`), `system.description` (texto do livro), `system.use` (`{ action, cost }` ou null), `system.mode` (`auto`|`semi`|`manual`), `system.rules` (mudanças de efeito ativo), `system.price` (texto livre, só Medo), `system.iconKey`.
- **Uso:** arrastar do compêndio para um item `armament`/`protection`/`generalEquipment` **anexa** a maldição em `system.curses` (não vira item solto na mochila). Soltar na ficha de ator pergunta em qual item aplicar. A validação (M3, repetida, tipo errado de item) roda no arrasto.
- **Nome do item no compêndio:** "Maldição: Lancinante" etc.; ícone em `assets/curse-icons/<chave>.webp` (ver `spec-icones-maldicoes.md`).
- Pasta por tipo no compêndio: Armas / Proteções / Acessórios / Sobrevivendo ao Horror.
- `system.json`: nova entrada em `packs`, `ownership.PLAYER = OBSERVER` como os demais.

## 3.2 O que cada maldição vai fazer (contrato de implementação)

Legenda: **auto** = efeito ativo/campo calculado pela ficha, sem clique; **semi** = botão no cartão ou na ficha que aplica o efeito/condição, o jogador/Mestre confirma; **manual** = só texto + cartão de uso (gasta PE/PD, o resto é mesa). Condição para tudo: item **equipado** (D4). Custos de PE saem de PD no modo Sem Sanidade, via o mesmo caminho dos rituais.

Armas
- **Antielemento (auto):** na janela de ataque aparece "Antielemento"; rola 1d4 só se o alvo não tiver elemento conhecido, senão usa o elemento do alvo (ficha de ameaça). Cobra 2 PE e soma +4d8 em carta de dano separada (tipo do elemento).
- **Ritualística (semi):** campo no item "ritual armazenado" (arrasta ritual de alvo/área). Ao acertar, botão "Descarregar" conjura sem gestos/componentes e cobra o PE do ritual; esvazia o campo.
- **Senciente (manual):** cartão de uso: ação de movimento + 2 PE; lembrete de 1 PE/turno enquanto mantida. Cria marcador de duração.
- **Empuxo (semi):** ataque arremessado (alcance curto) soma +1 dado do dano da arma; só em arma corpo a corpo; bloqueado em arma de disparo/fogo.
- **Energética (auto):** opção "Energética (2 PE)" na janela de ataque: +5 no teste, ignora RD, dano convertido em Energia. Cobra 2 PE por ataque.
- **Vibrante (auto):** concede o poder passivo Ataque Extra (passivo da ficha); se o agente já tem, o custo desse poder cai 1 PE.
- **Consumidora (semi):** opção "Consumidora (2 PE)"; ao acertar, botão aplica a condição Imóvel por 1 rodada no alvo.
- **Erosiva (auto/semi):** opção "Erosiva (2 PE)": +1d8 Morte no dano e, no mesmo cartão, botão que registra 2d4 Morte no início dos turnos do alvo por 2 rodadas (usa o fluxo de efeitos por turno).
- **Repulsora (auto/manual):** +2 Defesa enquanto empunhada (efeito ativo); bloqueio com 2 PE dá +5 (botão no bloqueio).
- **Lancinante (auto):** +1d8 Sangue em carta própria; no crítico multiplica pelo multiplicador (única que multiplica).
- **Predadora (auto/texto):** margem de ameaça da arma duplica (campo calculado); alcance +1 categoria à distância; camuflagem/cobertura leves ignoradas (nota no cartão).
- **Sanguinária (semi):** botão "Sangramento" cumulativo; crítico oferece 2d10 PV temporários ao portador.

Proteções
- **Abascanta (auto/manual):** +5 em resistência a rituais (condicional na rolagem de resistência); botão "Refletir" 1×/cena cobra PE do ritual.
- **Profética (auto/manual):** RD Conhecimento 10; botão "Rolar de novo" (2 PE) na resistência.
- **Sombria (auto):** +5 Furtividade, ignora penalidade de carga da proteção; botão de 1 PE troca aparência (nota).
- **Cinética (auto):** +2 Defesa e RD 2 em proteção leve/escudo, RD 5 em pesada (lê a categoria da proteção).
- **Lépida (auto/manual):** +10 Atletismo, +3 m de deslocamento; botão 2 PE para terreno difícil/escalada/queda.
- **Voltaica (auto/manual):** RD Energia 10; botão 2 PE aplica 2d6 Energia em adjacentes no fim de cada turno.
- **Letárgica (auto/manual):** +2 Defesa; 25% (leve/escudo) ou 50% (pesada) de ignorar o dano extra de crítico/furtivo (botão "Rolar chance").
- **Repulsiva (auto/manual):** RD Morte 10; botão 2 PE ativa Lodo (2d8 Morte em quem ataca corpo a corpo).
- **Regenerativa (auto/semi):** RD Sangue 10; botão 1 PE cura 1d12.
- **Sádica (manual guiado):** no início do turno, diálogo calcula +1 ataque/dano por 10 de dano sofrido desde o último turno.

Acessórios
- **Carisma, Destreza, Disposição, Pujança (auto):** +1 em Presença, Agilidade, Vigor, Força (bônus de item, M8).
- **Sagacidade (auto):** +1 Intelecto sem perícias/graus (não entra no orçamento de perícias).
- **Escudo Mental (auto):** resistência mental 10. **Proteção Elemental (auto):** escolhe elemento no item; resistência 10 a ele; conta como item daquele elemento no preço (M9).
- **Defesa (auto):** +5 Defesa. **Potência (auto):** +1 DT de habilidades, poderes e rituais.
- **Esforço Adicional (auto c/ trava):** +5 PE (+5 PD), só após 1 dia de uso (`using.since`). **Vitalidade (auto c/ trava):** +15 PV, idem.
- **Conjuração (semi):** guarda ritual de 1º círculo; aparece no grimório do portador como conhecido, –1 PE se já conhece.
- **Reflexão (manual):** botão "Refletir" 1×/rodada, cobra PE do ritual.
- **Lente de Revelação (manual):** ação padrão + 1 PE; cartão de foto; alvo perde camuflagem até o fim da cena.

## 4. Fases

0. **Compêndio `curses`** (§3.1): gerador, pack, tipo/campos, arrasto que anexa em `system.curses`. Os ícones saem em paralelo pela `spec-icones-maldicoes.md`.
1. **Núcleo e categoria.** `curse-rules.mjs` com as 35 maldições, soma de categoria (M4), validações (M3), campo `curses`, UI no item (lista de maldições com seletor por tipo, mostrando elemento e custo de categoria) e na ficha (chip do elemento ao lado do nome).
2. **Efeitos automáticos.** Efeitos transfer das maldições "auto" (atributos, Defesa, RD, resistências, perícias, PV/PE com trava de um dia, deslocamento). Teste de unidade exige que **toda** maldição esteja classificada (auto/semi/manual) com motivo.
3. **Dano e ataque.** Dados extras (Antielemento, Erosiva, Lancinante, Empuxo), Energética e Predadora entram no fluxo de ataque da arma (`item.mjs`, onde hoje sai o dano do Amaldiçoar Arma) como linhas separadas no cartão (como o dano do Amaldiçoar Arma, que sai em carta própria e **não dobra no crítico** — exceto Lancinante, que o livro manda multiplicar).
4. **Preço da maldição (M9).** Ver §5.
5. **Compêndio de maldições** (35 + Lente de Revelação) para arrastar ao item, com descrição do livro (hoje os compêndios de itens vêm com descrição genérica em alguns itens; conferir).

---

## 5. Preço da maldição (M9)

- O contador de maldições por elemento = soma das `curses` de todos os itens **em uso** do agente.
- Quando o agente **falha** em teste baseado em Intelecto (Conhecimento), Agilidade (Energia), Presença (Morte) ou Força/Vigor (Sangue), perde **2 × n** de Sanidade, onde n = maldições daquele elemento. A janela de teste tem a falha; o sistema **oferece** o botão "Pagar preço da maldição" no cartão do resultado (não debita sozinho — o Mestre confirma, como nos outros efeitos de Sanidade).
- **Mundo do Geh usa "Jogando sem Sanidade"** (PD no lugar de PE; ver `regras/11-sobrevivendo-ao-horror/01-origens-e-opcoes-de-trilha.md` e o `splitEffortBonuses`). Nesse modo não existe Sanidade para perder. O livro não define substituto para o preço da maldição; **definir com o Geh** (D3) — proposta: perder 2 PD por maldição na mesma falha.
- Item de Medo: preço definido pelo Mestre, campo livre de texto no item.

---

## 6. Testes

- `tests/unit/maldicoes.test.mjs` (`npm test`): as 35 chaves; categoria 0/1/2/3 maldições (+II, +III, +IV), com modificações comuns somando; M3 (elementos opressores) e repetida; classificação completa; atributos de acessório não acumulam (M8); Sagacidade não vira perícia; trava de um dia em Esforço Adicional e Vitalidade.
- Ao vivo (`docs/macros/maldicoes-live-test.js`, `QA GM` + jogador simulado): equipar proteção com Cinética e ver Defesa/RD; acessório com Disposição + Pujança; desequipar remove o efeito; arma Lancinante soma dado extra no crítico; Energética custa PD e converte o dano; preço da maldição oferecido na falha do atributo certo.
- `npm run lang-check` e `render-check` (campos novos na ficha do item).

## 7. Decisões em aberto

- **D1.** "Modificações paranormais" = maldições do livro (+ Lente de Revelação)? Ou há outro conjunto (ex.: itens do Arquivos Secretos)?
- **D2.** Leitura de "não pode ter maldições de elementos opressores" (M3): o par proibido é o de elementos **adjacentes** no ciclo? O texto não detalha.
- **D3.** Preço da maldição sem Sanidade: perder PD? Outra coisa?
- **D5.** Tipo novo `curse` ou `generalEquipment` com flag (§3.1)?
- **D4.** Os efeitos automáticos devem ficar ativos ao **equipar** (campo `using.state` que os itens já têm) ou ao **arrastar para a ficha**? Proposta: equipar, como o resto do inventário.
