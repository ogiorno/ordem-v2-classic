# Mapeamento do Agente e dos Testes de Rituais

Documento de referência para criar a macro de execução de rituais no sistema `ordem-v2-classic`.

## Escopo e versão verificada

- Sistema: **Ordem Paranormal (v2 Classic)**.
- Manifesto verificado: versão `8.0.2`.
- Foundry indicado pelo manifesto: mínimo `13`, verificado `14.365`.
- Código analisado: `module/documents/actor.mjs`, `module/documents/item.mjs`, `module/data/actors/agent-data.mjs`, `module/data/items/ritual-data.mjs`, `module/helpers/actor-calculations.mjs`, `module/helpers/config.mjs` e os templates de ficha/chat.

## O que é um Agente no sistema

O Agente é um `Actor` do tipo `agent`. A ficha possui os seguintes grupos relevantes:

| Grupo | Caminho no ator | Uso para ritual |
|---|---|---|
| Atributos | `actor.system.attributes` | Presença influencia a DT de ritual; Intelecto é o atributo padrão de Ocultismo |
| Perícias | `actor.system.skills` | `actor.system.skills.occultism` contém atributo, grau, valor e modificadores |
| Recursos | `actor.system.PE`, `actor.system.PD`, `actor.system.SAN` | O custo normal usa PE; com a regra sem Sanidade a ficha usa PD como recurso de esforço |
| Progressão | `actor.system.NEX`, `actor.system.nivel`, `actor.system.stage`, `actor.system._progress` | A progressão entra no cálculo da DT para não-Sobreviventes |
| Classe | `actor.itemTypes.class[0]` | Define a progressão/status derivados e se a classe é Sobrevivente |
| Rituais | `actor.itemTypes.ritual` ou `actor.items.filter(i => i.type === "ritual")` | Itens que serão escolhidos pela macro |
| DT própria | `actor.system.ritual.DT` | DT calculada para efeitos que usam a DT de ritual do agente |

Os cinco atributos são identificados no código por `str`, `dex`, `int`, `pre` e `vit`. A perícia usada para conjuração é a chave `occultism`, localizada em `CONFIG.op.skills.occultism` e normalmente associada a `int`.

## Cálculos já feitos pelo sistema

### Progressão

O sistema calcula `actor.system._progress` a partir da regra global:

- Agente não-Sobrevivente com regra NEX: `floor(NEX / 5)`, exceto NEX 99, que vale 20.
- Agente não-Sobrevivente com regra de nível: usa `nivel`.
- Sobrevivente: usa `stage`.

### DT de ritual do agente

O cálculo implementado em `calculateRitualDT` é:

```text
Sobrevivente:       DT = 10 + Presença
Outras classes:     DT = 10 + progressão + Presença
```

O resultado fica em `actor.system.ritual.DT`. Exemplos cobertos pelos testes do sistema:

- Não-Sobrevivente, progressão 2 e Presença 2: DT 14.
- Sobrevivente, Presença 3: DT 13, independentemente da progressão usada para outras classes.

Essa DT é a DT do próprio agente para efeitos que pedem a DT de ritual. Ela não deve ser confundida automaticamente com uma DT de resistência do alvo.

## Estrutura de um Item do tipo Ritual

O `RitualData` possui estes campos:

| Campo | Caminho | Significado |
|---|---|---|
| Círculo | `item.system.circle` | 1 a 4; valor 5 é reservado para “Outro” e a ficha o coloca em inválidos |
| Elemento | `item.system.element` | `blood`, `death`, `knowledge`, `energy`, `fear` |
| Execução | `item.system.execution` | `passive`, `free`, `movement`, `default`, `complete`, `reaction` |
| Alcance | `item.system.range` | pessoal, toque, curto, médio, longo, extremo ou ilimitado |
| Alvo | `item.system.target` | pessoas, criaturas, animais, armas, equipamento ou área |
| Quantidade | `item.system.targetQtd` | Quantidade quando aplicável |
| Área | `item.system.area` | Tipo, tamanho e unidade da área |
| Duração | `item.system.duration` | instantânea, cena, sustentada, duração definida ou permanente |
| Resistência | `item.system.skillResis` | `resilience`, `reflexes` ou `will` |
| Resultado da resistência | `item.system.resistance` | `nullifies`, `discredits`, `partial` ou `reducesByHalf` |
| Descrição | `item.system.description` / `chatDescription` | Texto do ritual e texto opcional para o chat |
| Formas | `item.system.studentForm` / `trueForm` | Indica versões Discente e Verdadeira |

O custo em PE/PD **não está definido no `RitualData`**. Portanto, a macro não deve procurar `item.system.cost` como se fosse um poder. Ela precisará aplicar a regra de custo por círculo/formulação ou pedir o custo no diálogo, conforme a decisão de implementação.

## O que acontece hoje ao usar um ritual

O caminho atual é:

1. A ficha chama `item.use()`.
2. `OrdemItem.use()` chama `item.roll()`.
3. `item.roll()` renderiza `templates/chat/item-card.hbs` e cria uma mensagem no chat.
4. Para rituais, o card mostra círculo, elemento, execução, alcance, alvo, duração e resistência.

O card atual não possui botão de “Conjurar”, não chama `actor.rollSkill`, não desconta PE/PD e não faz um teste de resistência. Isso é a principal parte que a macro terá de acrescentar.

## Teste de Ocultismo para conjurar

O método disponível para a macro é:

```js
await actor.rollSkill({ skill: "occultism" });
```

O método `rollSkill` usa o atributo associado à perícia, grau de treinamento, valor da perícia e modificadores do agente. Ele também pode receber uma DT no processo de rolagem:

```js
await actor.rollSkill({
  skill: "occultism",
  rolls: [{ options: { target: dt } }],
});
```

O resultado retornado é uma lista de rolagens. Para ler a primeira rolagem:

```js
const rolls = await actor.rollSkill({
  skill: "occultism",
  rolls: [{ options: { target: dt } }],
});
const roll = Array.isArray(rolls) ? rolls[0] : rolls;
const total = roll?.total;
```

O diálogo padrão pode ser desativado quando a macro já tiver coletado todas as opções:

```js
const rolls = await actor.rollSkill(
  { skill: "occultism", rolls: [{ options: { target: dt } }] },
  { configure: false },
);
```

Para a primeira versão da macro, o fluxo mais seguro é manter o diálogo de configuração aberto. Assim o jogador pode alterar atributo escolhido, vantagem/desvantagem e demais opções que o sistema oferecer.

## Teste de resistência do alvo

O próprio Item Ritual identifica a resistência com:

```js
item.system.skillResis // resilience, reflexes ou will
item.system.resistance // resultado em caso de sucesso
```

Os alvos são os tokens selecionados em `game.user.targets`. A macro deverá:

1. exigir um ou mais alvos quando o ritual não for pessoal;
2. obter o `target.actor` de cada token;
3. rolar a perícia indicada por `item.system.skillResis` para cada alvo;
4. comparar o resultado contra a DT do ritual definida pelo sistema ou pelo texto do item;
5. aplicar o resultado configurado: anula, desacredita, parcial ou reduz à metade.

O método genérico disponível para a resistência é o mesmo `targetActor.rollSkill({ skill: item.system.skillResis })`. O sistema não possui, no caminho atual, uma rotina de “conjuração + resistência” já integrada para rituais.

## Recursos e custo

O recurso normal de esforço é:

```js
actor.system.PE.value
actor.system.PE.max
```

Quando a configuração global `globalPlayingWithoutSanity` está ativa, a ficha troca o rótulo para PD e a progressão de recurso usa:

```js
actor.system.PD.value
actor.system.PD.max
```

A macro deve escolher o recurso com a mesma regra:

```js
const resourceKey = actor.usingWithoutSanityRule ? "PD" : "PE";
const resource = actor.system[resourceKey];
```

Antes de conjurar, ela precisa validar se `resource.value >= custo`. Depois da confirmação, deve descontar o custo com:

```js
await actor.update({ [`system.${resourceKey}.value`]: resource.value - custo });
```

O desconto deve ocorrer uma única vez, depois da escolha do ritual e antes ou imediatamente após o teste de conjuração, conforme a regra que será adotada para falha. O sistema atual não define esse comportamento sozinho.

## Fluxo recomendado para a macro

1. Resolver o agente pelo token controlado, pelo token do speaker ou por um ator atribuído.
2. Filtrar os itens do ator com `type === "ritual"`.
3. Mostrar uma seleção de ritual e as opções Discente/Verdadeiro quando o item tiver essas formas.
4. Ler círculo, elemento, custo, alcance, alvo, duração e resistência do ritual.
5. Escolher PE ou PD conforme a regra global.
6. Validar recurso suficiente.
7. Determinar a DT de conjuração. Por padrão, usar `actor.system.ritual.DT` quando o texto do ritual não informar outra DT.
8. Rolar Ocultismo usando `actor.rollSkill`.
9. Se a conjuração for bem-sucedida, descontar o recurso e publicar o resultado.
10. Se houver resistência, rolar a perícia do alvo e aplicar o resultado do campo `item.system.resistance`.
11. Usar `item.use()` ou renderizar o card para preservar a descrição completa do ritual no chat.

## Limites confirmados

- O sistema fornece as classes de Actor, Item, dados derivados, rolagens de perícia e recursos necessários.
- O sistema fornece os metadados de ritual e os rótulos de elemento, círculo, execução, alcance e resistência.
- O sistema **não** fornece ainda uma rotina pronta para conjurar ritual.
- O sistema **não** armazena um custo de ritual no `RitualData`.
- O sistema **não** define automaticamente a DT textual específica de cada ritual.
- O sistema **não** executa automaticamente a resistência nem aplica efeitos arbitrários descritos em HTML.

## Decisões necessárias antes da implementação

Para a macro final, é preciso definir no código:

1. se o custo será calculado pelo círculo ou lido de um campo novo;
2. se a falha no teste ainda consome o custo;
3. se a DT padrão será sempre `actor.system.ritual.DT` ou editável por diálogo;
4. se a macro apenas rolará e publicará o ritual ou também aplicará dano/condições/efeitos;
5. como tratar rituais com texto especial que não cabe em `skillResis` e `resistance`.

## Fontes no repositório

- `systems/ordem-v2-classic/system.json`
- `systems/ordem-v2-classic/module/data/actors/agent-data.mjs`
- `systems/ordem-v2-classic/module/data/items/ritual-data.mjs`
- `systems/ordem-v2-classic/module/documents/actor.mjs`
- `systems/ordem-v2-classic/module/documents/item.mjs`
- `systems/ordem-v2-classic/module/helpers/actor-calculations.mjs`
- `systems/ordem-v2-classic/module/helpers/config.mjs`
- `systems/ordem-v2-classic/templates/chat/item-card.hbs`
- `systems/ordem-v2-classic/module/tests/suites/actor-agent.test.mjs`
