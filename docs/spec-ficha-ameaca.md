# Spec — Ficha de Ameaça (ordem_v2_classic, Foundry v14)

Fonte das regras: Livro de Regras v1-3, Cap. 7 (pp. 176–181). Resumo em `ficha-ameaca-regras.md`.
Status: **rascunho para aprovação**. Itens marcados ⚠ são decisões que assumi e podem ser trocadas.

## 1. Objetivo
Refazer a ficha do actor `threat` para reproduzir o formato de ficha do livro (blocos, ordem e notação), com rolagens funcionando direto dos valores da ficha. Mestre digita o que está no livro; o sistema calcula só o que o livro calcula.

## 2. Correção importante: notação de teste `xO+y`
Pelo livro (exemplo da Bianca, cap. 1): um teste rola **x d20 e usa o MAIOR resultado**, e soma o bônus. Então `3O+10` = **3d20, pega o maior, +10** (não soma os dados). `O+5` = 1d20+5. ⚠ Assumo que `O` sem número = 1d20.
Fórmula Foundry: `{x}d20kh + y` (x=1 → `1d20 + y`).
Cada teste da ficha é guardado como `{ dice: x, bonus: y }`.

## 3. Modelo de dados (`ThreatData`)
```
vd: number
size: "tiny|small|medium|large|huge|colossal"          # default medium
creatureKind: "person|animal|paranormal"
elements: string[]                                     # sangue, morte, conhecimento, energia, medo
paranormal: boolean                                    # liga Presença Perturbadora, Origem Paranormal, Enigma
disturbingPresence: { dt, damage: "3d6", immuneNex }   # só se paranormal
senses: {
  perception: Test, initiative: Test,
  abilities: ("smell"|"blindsight"|"darkvision"|"lowLightVision")[]   # blindsight/darkvision com alcance opcional
}
defense: { value: number, fortitude: Test, reflexes: Test, will: Test }
hp: { value, max, bruised }        # bruised = floor(max/2) calculado; campo "bruisedOverride" opcional
damageResistances: [{ type, value, except: string[] }]   # "RD 10/Morte" => value 10, except ["death"]
vulnerabilities: string[]          # tipos de dano (dobra o dano)
immunities: string[]               # tipos de dano e condições
attributes: { agi, for, int, pre, vig }   # inteiros (ameaças usam valores fixos)
skills: [{ name, test: Test }]     # além das 5 mostradas; bloco some se vazio
movement: { meters, squares }      # squares = round(meters / 1.5) calculado, editável
passives: [{ name, description }]
traits: { acceleratedHealing: {value, except: string[]}, incorporeal: bool }
actions: [{
  id, type: "standard|move|full|free|reaction", name, description,
  attack?: { kind: "melee|ranged", range: "short|medium|long"|null, multiplier: 1,
             test: Test, damage: { formula: "2d6+6", type: "impact" },
             crit: { threshold: 20, multiplier: 2 } }     # padrão 20/x2
}]
fearRiddle: html     # só se element medo
description: html
```
`Test = { dice: int ≥1, bonus: int }`.

## 4. Valores derivados / regras automáticas
- `hp.bruised = floor(hp.max / 2)`; status "machucado" quando `hp.value <= bruised`.
- `movement.squares = movement.meters / 1.5` arredondado.
- **Tamanho** (Tab. 7.1) exibido na ficha, não aplicado às estatísticas (⚠ o livro diz que as estatísticas já incluem modificadores): Minúsculo +5/−5 e espaço 1,5m · Pequeno +2/−2, 1,5m · Médio 0, 1,5m · Grande −2/+2, 3m · Enorme −5/+5, 4,5m · Colossal −10/+10, 9m. Servem para tooltip e para o token (escala/espaço).
- **Resistência a dano**: `dano_final = max(0, dano − RD)` se o tipo não estiver em `except`.
- **Vulnerabilidade**: dano × 2 do tipo. **Imunidade**: dano 0.
- **Cura Acelerada**: no início do turno da ameaça (hook de combate), recupera `value` PV, exceto se o último dano recebido for de tipo em `except`.
- **Incorpóreo**: ataques corpo a corpo usam AGI no lugar de FOR quando houver cálculo de atributo (na ficha por teste fixo é só informativo).
- **Presença Perturbadora**: botão na ficha que rola Vontade (DT) para os alvos; falha = dano mental cheio, sucesso = metade. Ao haver várias criaturas, usa a de maior VD e adiciona +1d6 por criatura extra (⚠ fase 2: macro/diálogo do mestre).
- Ameaças não têm bloqueio/esquiva/contra-ataque: esses botões não existem nesta ficha.

## 5. Layout da ficha (ApplicationV2 + HandlebarsApplicationMixin)
Uma única coluna estilo "stat block", na ordem do livro:
1. Cabeçalho: imagem, **Nome**, **VD**.
2. Linha de descritores: elementos · tipo · **Tamanho** (select).
3. Presença Perturbadora (colapsa se `paranormal` falso).
4. Sentidos: Percepção `xO+y`, Iniciativa `xO+y`, habilidades de sentido (chips).
5. Defesa: Defesa, Fortitude, Reflexos, Vontade (cada teste clicável para rolar).
6. PV `70 | 35 machucado` (+/- rápido), Resistências, Vulnerabilidades, Imunidades.
7. Atributos AGI FOR INT PRE VIG.
8. Perícias (lista dinâmica, oculta se vazia).
9. Deslocamento `9m | 6`.
10. Habilidades passivas (lista; adicionar/remover).
11. Ações agrupadas pelo tipo; ataque mostra `Corpo a corpo x2 · Teste 3O+10 · Dano 2d6+6 impacto` e botões **Testar** e **Dano** (e **Crítico**).
12. Enigma de Medo (aba/seção, só se elemento medo) + Descrição.
Modo edição/leitura alternável (leitura = parece o livro).

## 6. Rolagens (chat)
- Teste: `new Roll("{x}d20kh + y")`, mensagem com lista dos dados e o maior destacado. Crítico se o dado mantido ≥ `threshold`.
- Ataque com multiplicador N: uma rolagem de teste e uma de dano por ataque (N cartas agrupadas em uma mensagem).
- Dano: `Roll(formula)`, dobra os dados no crítico (×multiplier no total, ⚠ confirmar a regra de crítico do livro: multiplicar ou somar dados).

## 7. Migração do modelo antigo (⚠ decisão pendente)
O modelo atual (`attributes.dex/str/vit`, `skills.*` com `degree`, `attacks`, `actions` livres, `resistances.*Damage`) é lido por `migrateData` em `ThreatData` e convertido:
- `dex→agi, str→for, vit→vig`; `skills.fighting/aim/resilience/reflexes/will/initiative/perception` → `Test` (dice = atributo, bonus = degree.value); resistências por tipo → `damageResistances/vulnerabilities/immunities`; `actions[]` antigas viram `actions` com `type: "standard"`.
Dados antigos ficam preservados num flag `flags.ordem_v2_classic.legacyThreat` por segurança.

## 8. Testes
Reaproveitar/atualizar `module/tests/suites/actor-threat*.test.mjs`: modelo + migração, parser/rolagem `xO+y`, RD com exceção, bruised, cura acelerada, render da ficha.

## 9. Fases
1. Copiar sistema para `systems/` (git) e ligar por junction.
2. `ThreatData` novo + migração + testes.
3. Template/ficha + CSS (modo leitura/edição).
4. Rolagens e botões de chat.
5. Cura acelerada, presença perturbadora em grupo, polimento.
6. (Opcional) importador de fichas do livro (colar texto → ficha).

## 10. Perguntas abertas
1. Migrar monstros existentes (padrão do spec) ou modelo novo sem compatibilidade?
2. `O` sem número = 1d20 — confirmado?
3. Crítico: multiplicar o dano total ou só os dados?
4. Importador de fichas do livro (fase 6) interessa?
