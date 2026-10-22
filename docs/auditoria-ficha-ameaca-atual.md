# Auditoria — ficha de ameaça atual (ordem-v2-classic 8.0.2, Foundry v14)

Arquivos: `module/data/actors/threat-data.mjs`, `module/sheets/threat-sheet.mjs`, `templates/threat/*.hbs`, `module/helpers/config.mjs`, `module/documents/{actor,item}.mjs`, `module/applications/{resistance,traits}-config.mjs`.

## Estrutura
- Actor type `threat` (`ThreatData`) + `OrdemThreatSheet` (ActorSheetV2 + Handlebars), 600x820, abas: Ataques, Habilidades, Enigmas, Efeitos.
- **Ataques são Items `armament` embutidos** (criados por diálogo; flag `flags.ordem-v2-classic.createdByThreatDialog`). Já têm: `actionType` (standard/free/movement/reaction/full), `numberOfAttacks`, `rangeCategory` (short/medium/long/extreme), `critical`, `formulas.attack {attr, skill, bonus}`, `formulas.damage {formula, type}`, `types.rangeType` (melee/ranged).
- O campo `system.attacks` (ObjectField) e `system.actions` (Array) do schema **não são usados pela ficha**.

## Campo a campo
| Livro | Hoje no sistema | Situação |
|---|---|---|
| Nome | `actor.name` | ok |
| VD | `attributes.vd.value` | ok |
| Tipo | `details.creatureType` (creature/person/animal) | ok |
| Elemento | `elements.main` (blood/death/knowledge/energy/fear) + `elements.others` string | ok; sem multi-elemento estruturado |
| Tamanho | `size` (tiny…colossal) | ok; sem modificadores (Furtividade/Manobras/espaço) |
| Presença Perturbadora | `disturbingPresence {dt, mentalDamage, immuneNex}` | ok; botão rola dano; `immuneNex` sem campo na ficha; sem regra de grupo |
| Sentidos | `senses` (array de strings, não usado) + `traits` booleanos (smell, blindsight, lowLightVision, darkvision) + perícias perception/initiative | parcial |
| Percepção/Iniciativa | `skills.perception/initiative` = atributo + grau de treino (+5…+35) ou `degree.override` | modelo diferente do livro (`xO+y`) |
| Defesa | `defense.value` | ok |
| Fortitude/Reflexos/Vontade | `skills.resilience/reflexes/will` (mesmo modelo atributo+grau) | modelo diferente |
| PV | `attributes.hp {value,max}` | sem "machucado" |
| Resistências | `resistances.<tipo> {value, vulnerable, immune}` para 15 tipos de dano, configuradas por diálogo; `defense.damageResistances` string (não usada) | sem exceção (RD/Morte), vulnerabilidade só marca (não calcula) |
| Atributos | `attributes.dex/str/int/pre/vit` (AGI/FOR/INT/PRE/VIG) | ok (chaves em inglês) |
| Perícias extras | só `freeSkill` (uma, nomeável) | falta lista livre |
| Deslocamento | `movement {walk, unit, squares}`; ficha só mostra `walk` | squares não calculado |
| Habilidades passivas | `temporary.abilities` (HTML livre) | texto livre |
| Ações | Items armament (ataques); habilidades não-ataque (Agarrão, Abocanhar) vão como texto livre | sem item de "ação" não-ataque |
| Enigma de Medo | `details.fearRiddle` (HTML) | ok |
| Cura Acelerada / Incorpóreo | `traits.acceleratedHealing` / `incorporeal` booleanos | sem valor; sem automação |

## Mecânica de teste atual
Rolagem: `Xd20kh + bônus`, onde X = valor do atributo; se 0, `2d20kl` (pior de 2). Isso difere do livro para ameaças, onde o número de dados e o bônus vêm direto da ficha (`3O+10`, `O` = 1d20).
Conversão sugerida para a migração: dados = atributo da perícia (0 → 1), bônus = `degree.value`.

## Opções de config já existentes
`CONFIG.op`: `dropdownDamageType` (15 tipos), `dropdownElement`, `dropdownThreatType`, `dropdownThreatSize`, `dropdownDegreeThreat` (untrained…delta), `traits`, `attackSkills`.

## Testes existentes
`module/tests/suites/`: `actor-threat`, `actor-threat-extended`, `threat-attacks`, `threat-persistence`, `sheets` (runner interno do sistema, `module/tests/README.md`).
