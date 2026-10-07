# Spec — Tela de ataque (opções antes de atacar)

Inspirada na tela de uso do sistema Tormenta20 (`module/apps/ability-use-dialog.mjs` e `templates/apps/ability-use.hbs`, repositório `gitlab.com/vizael/Tormenta20`).
No T20 o clique em atacar abre uma janela que lista os **efeitos ativos "ao usar"** aplicáveis (da arma, dos outros itens e da ficha), com caixa de marcar
(ou contador, se acumulam), custo de PM por efeito, campos livres de bônus no ataque e no dano, custo total somado ao vivo e as opções de rolagem.

## Decisões

- Abre **sempre** ao clicar em atacar (botão "Atacar" da ficha e botão do cartão da arma). **Shift+clique** ataca direto.
- As opções ativáveis são **Efeitos Ativos** com um marcador "ao usar", como no T20 (não há campo novo na habilidade).
- Só para agentes. Ameaças, reações, macros e testes continuam atacando direto (a tela só abre quando a chamada traz um evento de clique).

## Tela

1. **Já aplicados**: bônus que valem sem escolha. Treinamento e bônus da perícia, efeitos de ficha que mexem na perícia do ataque, penalidade de condição em dados, e os efeitos "ao usar" marcados como automáticos (ex.: Mão Pesada +2 de dano em corpo a corpo; Para Bellum +2 de dano com arma de fogo).
2. **Ativáveis**: um por linha. Caixa de marcar, ou contador quando acumula. Mostra o texto do efeito e o custo em PE (PD na regra sem Sanidade).
3. **Ataque Especial** (combatente): um bloco próprio com dois contadores, "+5 no ataque" e "+5 no dano", que dividem o limite de acúmulos do nível (1 → 2 → 3 → 4 em 5, 25, 55 e 85% de NEX). Custo: 2 PE no primeiro, +1 PE em cada seguinte.
4. **Bônus livres**: no ataque (ex. `+2`, `−1d`) e no dano (ex. `+1d6`).
5. **Rodapé**: custo total, saldo ("você tem 6") e botão Atacar. Cancelar (ou fechar) não rola nada e não gasta PE.

## Efeito "ao usar" (dados)

Efeito ativo **desligado** (não altera a ficha) com `flags.ordem_v2_classic.onUse`:

| Campo | Significado |
| --- | --- |
| `enabled` | marca o efeito como opção de ataque |
| `applies` | `all`, `melee`, `ranged`, `fire` (arma de fogo) ou `throw` |
| `auto` | já aplicado, sem escolha e sem custo |
| `cost` / `stepCost` | custo em PE do primeiro uso e de cada uso adicional (padrão: igual ao primeiro) |
| `max` | acúmulos permitidos; `maxMode: "special"` calcula pelo nível (Ataque Especial) |
| `attackDice` | dados extras de d20 no ataque |
| `attackBonus` | bônus fixo no teste de ataque |
| `damageBonus` | bônus no dano (número ou fórmula, ex. `1d6`) |
| `damageDice` | dados extras do dano da arma (dobram no crítico) |
| `pool` | `true` no Ataque Especial: cada acúmulo vale `unit` (5) e vai para ataque **ou** dano |

O efeito vem de: efeitos da própria arma, de qualquer outro item da ficha (habilidades, equipamentos) e dos efeitos da ficha. A janela de configuração do efeito ganha uma seção "Opção de ataque" para preencher isso.

## Aplicação

- Ataque: dados extras entram na reserva de d20, bônus entram como termo da fórmula; o custo em PE é pago ao confirmar.
- Dano: as opções escolhidas ficam guardadas no cartão da arma; o botão de dano do mesmo cartão aplica bônus de dano e dados extras (dobram no crítico).
- O cartão do ataque mostra uma linha com o que foi usado e o custo.
- PE insuficiente: a tela avisa e não rola. Ataque Especial no limite de PE por turno: permitido (regra: sempre dá para usar uma habilidade pelo custo mínimo).

## Conteúdo inicial

Ataque Especial (combatente), Mão Pesada, Para Bellum, Pancada Forte (sobrevivente). Mais opções entram só preenchendo efeitos.

## Verificação

- `npm test`: regras puras (filtro por arma, custo, acúmulos, soma de bônus, fórmula de dano).
- No mundo: tela abre com Shift pulando; aplicado no ataque e no dano; PE gasto; cancelar não gasta; efeito de outro item aparece; remoção do item tira a opção.

## Resultado da verificação (18/10/2026)

| Camada | Como rodar | Resultado |
| --- | --- | --- |
| Regras puras | `npm test` (`tests/unit/attack-options.test.mjs`) | 14/14 |
| No mundo, por código | `miniQuench("/systems/ordem_v2_classic/module/tests/suites/attack-options.test.mjs")` | 6/6 |
| Pela interface, com cliques de verdade | `playwright-cli -s=ao run-code --filename=scripts/ui-ataque.js` (entrar como Mestre antes) | 13/13 |

Casos da interface (`scripts/ui-ataque.js`, atores e mensagens "[AO] ui…", apagados no fim):

- UI-01 a UI-04: a ficha tem o botão Atacar; o clique abre a tela com "Já aplicados" (Para Bellum sim, Mão Pesada não, por ser arma de fogo), Ataque Especial com 2 contadores, bônus livres no ataque e no dano, total e saldo.
- UI-05: total ao vivo (1 acúmulo no ataque + 1 no dano = 3 PE, saldo cai).
- UI-06: fechar a tela não rola, não gasta e não deixa cartão.
- UI-07 a UI-09: Atacar paga 3 PE; a rolagem mostra "Ataque Especial ×2, dano +1d6 (−3 PE)"; as opções ficam guardadas no cartão da arma.
- UI-10: o botão de dano do cartão rola `2d8 + 7 + 1d6` (7 = 5 do Ataque Especial + 2 do Para Bellum).
- UI-11: Shift+clique ataca direto, sem tela e sem custo.
- UI-12: PE insuficiente marca o total em vermelho e não rola.
- UI-13: ameaça atacando com clique não abre a tela.

Não coberto pela interface: seção "Opção de ataque" na janela de configuração do efeito; botão de atacar do cartão da arma no chat (só o da ficha); efeito vindo de outro item que não as habilidades iniciais.

Achado na execução: o servidor servia a versão antiga do template da ficha (sem o botão Atacar), porque o Foundry guarda templates em memória e o arquivo mudou depois que o servidor subiu. Depois de atualizar o código em disco, reinicie o servidor.

## Resultado em combate (18/10/2026) — agentes contra ameaças, pelo carrossel

Script: `scripts/ui-combate-ataque.js` (arena `ZZ` com 5 agentes armados e 6 ameaças, combate real, avanço de turno só pelo botão do carrossel, 3 rodadas completas = 33 turnos). Todos os cliques são de mouse.

| Rodada | O que cada agente fez | Resultado |
| --- | --- | --- |
| 1 | Atacar → tela → confirmar sem escolher | tela abriu 5/5, custo 0, aplicados certos (Para Bellum nas armas de fogo, Mão Pesada no Machete), cartão com botão de dano |
| 2 | Ataque Especial (1 ataque + 1 dano) + dano livre `+1d6` | tela abriu 5/5; pagou 3 PE (Recruta, NEX 5, só tem 1 acúmulo: pagou 2); dano do cartão `+7 +1d6` (5 do Ataque Especial + 2 da Mão Pesada/Para Bellum) |
| 3 | Shift+clique | 5/5 sem tela e sem custo; cartão com bônus automáticos `+2` |
| 1 a 3 | Turno das 6 ameaças pelo botão de ataque da ficha | 18/18 atacaram sem abrir a tela |

Total: 52 verificações certas e 2 marcadas como falha pelo próprio script, ambas erro de expectativa do teste (a ordem dos agentes na lista; corrigido no script): o Recruta pagou 2 PE e o Analista 3 PE, que é o correto pela regra. Combate chegou à rodada 4, 0 erros de script, 0 sobras no mundo.

Observações: o botão de dano do cartão só rola o dano (não tira PV do alvo; aplicar dano é outro passo do cartão), e quando o ataque erra o botão fica desabilitado ("Dano não aplicável"). Não coberto: jogador real em outro navegador.

## Verificação de condições, trilha e modificação de arma (18/10/2026)

Na arena temporária, usei um agente com a habilidade de trilha Ataque Furtivo, uma modificação Certeira aplicada à arma e as condições Agarrado e Vulnerável.

- A tela mostrou a modificação Certeira como bônus automático de `+2 no ataque` e ofereceu Ataque Furtivo como opção ativável de trilha.
- Ao ativar Ataque Furtivo, a rolagem guardou o bônus da modificação e `+1d6` de dano; cobrou `1 PE`. O botão de dano do cartão rolou `1d6 + 2 + 1d6`.
- A tela exibiu as condições e os efeitos de Agarrado (`−1 dado no ataque`, `−5 Defesa`, imóvel) e Vulnerável. Remover Vulnerável apagou seu efeito da ficha; Agarrado permaneceu ativo.
- O cartão do ataque registrou Agarrado e sua penalidade; a fórmula usou `1d20kh`, indicando a perda de um dado.

Verificações automatizadas: `npm test` — 247/247; `npm run render-check`, `npm run lang-check`, `node --check scripts/ui-combate-ataque.js` e `git diff --check` passaram. O roteiro amplo de combate ficou incompleto após o primeiro turno e registrou uma falha na expectativa de bônus de origem; portanto, não considero concluído o cenário de 33 turnos. A validação acima foi feita diretamente na interface para os casos pedidos.

## Resultado: armas, condições, modificações e poderes de classe (18/10/2026)

Script: `scripts/ui-armas.js` (pela interface, como Mestre; cria e apaga só "[AR] ..."). 17 de 18.

- Condições (AR-01 a AR-09): Agarrado tira 1 d20 do ataque; com 0 dados rola 2d20 e fica com o pior; a tela de ataque lista a condição e o botão remover tira o efeito; o cartão guarda a condição; alvo Vulnerável tem Defesa −2 e o confronto usa esse valor.
- **Falha AR-07**: Atordoado ("sem ações") não impede o ataque com arma: o ataque rola normalmente. Hoje a condição só pula o turno no combate.
- Modificações (AR-10 a AR-14): bônus de ataque da arma, efeito "ao usar" da arma (ex.: mira laser) em "Já aplicados", no ataque e no dano, e efeito de ficha na perícia do ataque.
- Poderes de classe (AR-15 a AR-18): classe Combatente e os 29 poderes aparecem na ficha; só o Ataque Especial vira opção na tela; remover o poder tira ficha e opção.
- Divergência: o código passou a ignorar efeitos "ao usar" desativados, mas esta spec manda o efeito ficar desligado. Um dos dois precisa mudar.
