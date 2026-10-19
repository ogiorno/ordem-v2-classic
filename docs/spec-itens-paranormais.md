# Spec — Itens paranormais (equipamento paranormal e itens amaldiçoados especiais)

Status (21/10/2026): **Fases 1 a 4 implementadas** (ver "Estado da implementação" no fim); Fase 5 (itens amaldiçoados especiais) **não começou**. Texto original da spec: só spec, nada implementado. Os itens existem nos compêndios como `generalEquipment` com **texto e categoria, sem mecânica**: não gastam PE/PD, não têm ação de uso, não se consomem e não ligam em nenhum fluxo (ritual, teste, combate). Alguns ainda têm descrição de modelo ("A descrição do seu item aqui." no Scanner de Manifestação Paranormal).

Fonte (Livro de Regras v1.3, `regras/04-equipamento/0609` a `0623` e `06-o-outro-lado/1056` a `1084`; Sobrevivendo ao Horror, `11-sobrevivendo-ao-horror/04-equipamentos.md` e `07-itens-amaldicoados.md`). O código segue o livro; texto extraído embaralhado (SAH, duas colunas) deve ser conferido no PDF antes de virar regra.

**Escopo.** Três grupos:
- **A.** Itens paranormais fabricados pela Ordem (livro, Tabela 3.10) e **catalisadores ritualísticos** (SAH).
- **B.** **Itens amaldiçoados especiais** (livro, 27 itens + Selos Paranormais; SAH, 18 itens): "mecânicas próprias, que variam conforme o item" (`1007`).
- **C.** Interações: afinidade (`spec-afinidade.md`), maldições (`spec-modificacoes-paranormais.md`) e perícias treinadas (Tábula do Saber Custoso).

---

## 1. Inventário e estado atual

### 1.1 Grupo A — Tabela 3.10 (livro, compêndio `general/livro-de-regras/itens-paranormais`, 13 itens)

| Item | Cat. | Esp. | Regra | Estado |
|---|---|---|---|---|
| Amarras de (elemento) ×4 | II | 1 | Duas formas de uso: **Armadilha** (gasta as amarras, ação completa, 2 PE; área 3×3 m; Reflexos DT Int ou **imóvel** até o fim da cena; terreno difícil mesmo se passar) e **Laçar** (ação padrão, 1 PE, alvo em alcance curto; Vontade DT Agi ou **paralisado** até o início do próximo turno, repete o teste; manter custa 1 PE/rodada). Eficazes contra criaturas vulneráveis ao elemento. | só texto |
| Câmera de aura paranormal | II | 1 | Foto: ação padrão + 1 PE; revela auras de pessoas e objetos, na cor do elemento. | só texto |
| Componentes ritualísticos de (elemento) ×4 | 0 | 1 | Necessários para conjurar ritual do elemento (dispensados por **afinidade**). | só texto |
| Emissor de pulsos paranormais | II | 1 | Ação completa + 1 PE; pulso de um elemento escolhido atrai criaturas desse elemento e afasta as do oposto; Vontade DT Pre evita. | só texto |
| Escuta de ruídos paranormais | II | 1 | Ação completa + 2 PE; grava até 24 h; ouvir dá **+5 em Ocultismo** para identificar criatura. | só texto |
| Medidor de estabilidade da Membrana | II | 1 | Agente treinado em Ocultismo avalia a Membrana de uma área (indicativo, sem resposta definitiva). | só texto |
| Scanner de manifestação paranormal de (elemento) | II | 1 | Ação padrão para ativar; consome 1 PE/rodada; o usuário sabe a direção de todas as manifestações ativas do elemento em alcance longo (inclui criaturas com o elemento como complemento). | descrição **vazia** no compêndio |

Observações: a pasta tem 4 Amarras e 4 Componentes (um por elemento); só 1 Scanner (genérico).

### 1.2 Grupo A — Catalisadores ritualísticos (SAH, `general/sobrevivendo-ao-horror/itens-paranormais`, 16 itens: 4 tipos × 4 elementos)

Regras comuns (conferidas na descrição do compêndio): componentes já alterados pela exposição paranormal; **consumidos ao serem usados**; precisa **empunhar** o catalisador; **só um catalisador por ritual**; **não podem ser improvisados** (Improvisar Componentes não vale) mas podem ser fabricados em campo (livro p. 94). Categoria I, 0,5 espaço.

| Tipo | Efeito |
|---|---|
| Ampliador | alcance do ritual +1 passo (curto→médio→longo→extremo) **ou** área dobra. |
| Perturbador | DT para resistir ao ritual **+2**. |
| Potencializador | dano do ritual **+1 dado do mesmo tipo**. |
| Prolongador | duração dobra; **não** funciona em ritual instantâneo ou sustentado. |

(O compêndio grafa "Pertubador"; o livro diz **Perturbador**. Corrigir o nome na importação.)

### 1.3 Grupo B — Itens amaldiçoados especiais

- **Livro**: 27 itens (arquivos `1057` a `1083`) mais "Selos Paranormais" (`1084`): Coração Pulsante, Coroa de Espinhos, Frasco de Vitalidade, Pérola de Sangue, Punhos Enraivecidos, Seringa de Transfiguração, Amarras Mortais, Casaco de Lodo, Coletora, Crânio Espiral, Frasco de Lodo, Vislumbre do Fim, Anéis do Elo Mental, Lanterna Reveladora, Máscara das Pessoas nas Sombras, Munição Jurada, Pergaminho da Pertinácia, Arcabuz dos Moretti, Bateria Reversa, Peitoral da Segunda Chance, Relógio de Arnaldo, Talismã da Sorte, Teclado de Conexão Neural, Tela do Pesadelo, Veículo Energizado, Jaqueta de Veríssimo, Dedo Decepado. **Não há compêndio deles** (só os do SAH existem).
- **SAH** (compêndio `itens-amaldi-oados`, 18 itens): Conhecimento — Câmera Obscura, Enxame Fantasmagórico, Repositório do Fracasso, Tábula do Saber Custoso; Energia — Arreio Neural, Centrifugador Existencial, Espelho Refletor; Medo — A Primeira Adaga; Morte — Ampulheta do Tempo Sofrido, Injeção de Lodo, Instantâneo Mortal, Projétil de Lodo (curto e longo), Rádio Chiador; Sangue — Conector de Membros, Dose d'A Praga, Mandíbula Agonizante, Retalho Tenebroso.
- Regras de uso: especiais podem ser escolhidos como equipamento mundano (apenas a categoria conta no limite); são liberados só para agente especial+; **precisam ser ativados** conforme a descrição, e antes **identificados** com Ocultismo (`1010`, `1012`). Testes do alvo usam DT com **Presença** (M6).
- Cada um tem **preço da maldição** pelo elemento (§5 da spec de modificações) e a resistência de objeto (+10 PV e +10 RD por maldição; item especial: ler no item).

---

## 2. Modelo de dados

Hoje `generalEquipment` guarda `description`, `weight`, `category`, `using`, `quantity`, `type`. Proposta, sem quebrar nada: um bloco opcional

```
system.paranormal = {
  element: null | "knowledge" | "energy" | "death" | "blood" | "fear",
  kind: "tool" | "component" | "catalyst" | "cursedSpecial",
  consumable: boolean,                        // catalisador, amarras ao armar a armadilha
  identified: boolean,                        // só para amaldiçoado (Ocultismo)
  uses: [ { id, label, action, cost: {type:"PE", value}, perRound?, save?, effect? } ],
  catalyst: null | "amplifier"|"disturber"|"empowerer"|"prolonger"
}
```

- `uses[]` cobre "um item, várias formas de uso" (Amarras: Armadilha e Laçar). O custo em **PE** do livro é cobrado como **PD** no mundo "Jogando sem Sanidade", pelo mesmo caminho que o conjurador de rituais usa.
- Um módulo puro `module/helpers/paranormal-item-rules.mjs`: tabela nome → `{ element, kind, uses }`, mais a classificação automação (**auto / semi / manual**, com motivo). Teste de unidade: todo item paranormal do compêndio está classificado.

---

## 3. Fases

### Fase 1 — Dados e uso básico (Grupo A, ferramentas)
1. Corrigir as descrições vazias/modelo e o nome "Perturbador"; preencher `system.paranormal` nos 13 + 16 itens.
2. Botão "Usar" no item (ficha e hotbar automática) por `uses[]`: debita PE/PD, gera cartão no chat com a ação, o alcance e o teste do alvo (DT = 10 + atributo, mesma conta de DT que a ficha já faz). Itens `consumable` descontam 1 da quantidade.
3. Câmera de aura, Escuta, Medidor: cartão informativo + o bônus **+5 em Ocultismo** da Escuta como efeito temporário no teste de identificar criatura (opção marcada na janela de teste).
4. Scanner: ação padrão, custo 1 PE/rodada mantido por turno; cartão com o elemento e o alcance (longo); sem mapa (a direção é narrativa).

### Fase 2 — Amarras e Emissor (condições)
5. Armadilha: ação completa + 2 PE, consome as amarras, cartão com a área 3×3 m e o teste de Reflexos (DT Int) para cada criatura que entre; aplica condição **imóvel** até o fim da cena e terreno difícil.
6. Laçar: ação padrão + 1 PE, alvo em alcance curto, teste de Vontade (DT Agi); falha → **paralisado** até o início do próximo turno, repete o teste; manter 1 PE/rodada. Reaproveita o fluxo de condições que já existe.
7. Emissor: cartão com o teste de Vontade (DT Pre) do alvo; efeito de atração/afastamento é narrativo.

### Fase 3 — Catalisadores ligados ao conjurador de rituais
8. No `ritual-caster.mjs`, campo "Catalisador" (só aparece se a ficha tem catalisador **do elemento do ritual**). Regras: um por ritual; precisa estar equipado; não vale improvisado; consome 1 unidade ao conjurar.
9. Efeitos nas contas do ritual:
   - Perturbador → DT do ritual +2.
   - Potencializador → +1 dado de dano do mesmo tipo (usa o `damageDt`/dados que o conjurador já calcula).
   - Ampliador → alcance +1 passo (curto→médio→longo→extremo) ou área ×2 (o jogador escolhe).
   - Prolongador → duração ×2; recusado em ritual instantâneo ou sustentado.
10. Cartão do ritual mostra "Catalisador: Potencializador de Sangue" e a unidade consumida. Rituais cuja duração/alcance não permitem o efeito mostram "sem efeito" e **não consomem** (o jogador confirma).

### Fase 4 — Componentes ritualísticos e afinidade
11. O item "Componente de <Elemento>" passa a ser reconhecido pelo conjurador (ligação com a Fase 2 da spec de afinidade): sem afinidade e sem componente → aviso ("sem componente do elemento"), nunca bloqueio. Improvisar Componentes (poder de ocultista) vale para componentes, **não** para catalisadores.

### Fase 5 — Itens amaldiçoados especiais (Grupo B)
12. Importar os 27 do livro para um compêndio novo (`general/livro-de-regras/itens-amaldicoados`), somando os 18 do SAH já existentes; ler cada texto do PDF.
13. Classificar cada um como **auto / semi / manual** e implementar por ondas, começando pelos que são só números (Peitoral da Segunda Chance, Talismã da Sorte, Frasco de Vitalidade...) e deixando para o fim os de efeito narrativo (Tela do Pesadelo, Dedo Decepado, Veículo Energizado).
14. Fluxo comum: **identificar** (teste de Ocultismo, DT do item; marca `identified`), **ativar** (`uses[]`) e **preço da maldição** (pela mesma função de M9).
15. Tábula do Saber Custoso: libera o **treinamento de um teste** (não ocupa vaga, ver §1.4 de `docs/arquivo/spec-pericias-treinadas.md`): opção "Tábula do Saber Custoso" na janela de teste, que trata a perícia como treinada naquele teste e cobra a Sanidade/PD descrita no item. Encerra um dos pendentes de perícias treinadas.

---

## 4. Interações

- **Afinidade**: dispensa Componente; não dispensa Catalisador (catalisador é consumível extra).
- **Maldições (itens)**: um item amaldiçoado especial também conta no "preço da maldição" do elemento.
- **Hotbar automática**: itens com `uses[]` entram como macro de uso (mesmo padrão de armas/rituais/habilidades).
- **Categoria**: itens paranormais são de categoria 0, I ou II; já contam no limite da patente (`item-categories.mjs`).

## 5. Testes

- `tests/unit/itens-paranormais.test.mjs` (`npm test`): tabela de itens completa (todo item do compêndio classificado), regras do catalisador (um por ritual, só do elemento, prolongador recusado em instantâneo/sustentado, ampliador em passos), custo PE→PD, consumo.
- Ao vivo (`docs/macros/itens-paranormais-live-test.js`, `QA GM` + jogador simulado): usar Amarras (armadilha e laçar), Emissor, Escuta com +5 em Ocultismo, Scanner por 2 rodadas, conjurar ritual com cada catalisador, recusa de dois catalisadores, consumo da quantidade.
- `lang-check` e `render-check` para o botão e o campo "Catalisador".

## 6. Decisões em aberto

- **D1.** O pedido "itens paranormais" inclui os **itens amaldiçoados especiais** (Grupo B), ou só o equipamento paranormal (Grupo A)? A spec cobre ambos; Fase 5 pode ficar para depois.
- **D2.** Fabricar catalisador em campo (livro p. 94): entra? Proposta: não, só registrar o texto.
- **D3.** Itens do **Arquivos Secretos** (`regras/rascunhos/`) ficam de fora até serem oficiais no mundo.
- **D4.** Para o Scanner e o Medidor, o Mestre quer um botão "revelar" que ping no mapa? Proposta: não, só cartão.

---

## 7. Estado da implementação (21/10/2026)

Feito (D1: só o Grupo A por ora; D2 não; D3 fora; D4 só cartão):
- `helpers/paranormal-item-rules.mjs` (puro): tabela nome → `{kind, element, uses, catalyst, consumable, automation, reason}` para os 13 itens do livro e os 16 catalisadores (aceita a grafia antiga "Pertubador"); regras do catalisador (um por ritual, só do elemento, empunhado, com unidade, não improvisa; Perturbador +2 na DT, Potencializador +1 dado, Ampliador alcance +1 passo ou área ×2, Prolongador ×2 e recusado em instantâneo/sustentado).
- `helpers/paranormal-items.mjs`: `useParanormalItem` (equipado, custo em PE/PD, DT = 10 + atributo, teste de Reflexos/Vontade rolado nos alvos marcados, condição Imóvel/Paralisado a quem falha, consumo de Amarras, +5 em Ocultismo da Escuta como efeito na ficha, Scanner pergunta o elemento) e `planCatalyst`/`consumeCatalyst` para o conjurador.
- Aba **Uso** na ficha do item (`templates/item/parts/item-paranormal.hbs`) com o botão Usar; itens com `uses[]` entram na **barra de macros** (`hotbarKind` = `paranormal`) e o clique usa o item.
- Campo **Catalisador** no cartão de conjuração rápida e na janela "Conjurar Ritual" (só aparece com catalisador empunhado do elemento do ritual); o cartão do ritual mostra o catalisador e o efeito; "sem efeito" pergunta e não consome.
- Condição **Paralisado** no catálogo (`conditions.mjs`).
- Componentes de elemento (Fase 4) já eram reconhecidos pela afinidade (`componentStatus`); Improvisar Componentes não vale para catalisador.
- Descrições dos itens do livro que estavam vazias ("A descrição do seu item aqui.") preenchidas em `packs/_source/general/livro-de-regras/itens-paranormais` — **falta compilar o pacote** (servidor fora do ar).
- Testes: `tests/unit/itens-paranormais.test.mjs`, `render-check` (aba Uso), ao vivo `docs/macros/itens-paranormais-live-test.js`.

Limites conhecidos: Armadilha não detecta criaturas que atravessam depois (o cartão traz a DT; só os alvos marcados rolam na hora); manter o Laçar/Scanner por rodada é usar de novo (cobra 1 PE a cada uso); Prolongador só registra "duração ×2" no cartão (não mexe em efeito ativo); Ampliador de área ×2 vale para rituais de área com regra no motor; Potencializador em dano de zona recorrente (tick) não muda; o alcance ampliado vale para a conferência de alvos no momento de conjurar.

Falta (Fase 5): importar os 27 itens amaldiçoados do livro, classificar auto/semi/manual, identificar com Ocultismo, preço da maldição e a Tábula do Saber Custoso (ligação com perícias treinadas).
