# Spec — Teste de Sangrando pedido ao jogador

Origem: `relatorio-efeitos-por-turno.md` (hoje o Mestre rola o Vigor sozinho, sem consultar o dono da ficha).

## Regra
- No início do turno de quem está Sangrando: Vigor DT 20; passou = estanca (remove o efeito); falhou = perde 1d6 PV (ignora RD) e continua.

## Comportamento
- Opção do mundo **"Teste de efeitos no início do turno"**: `Perguntar ao jogador` (padrão) ou `Automático`.
- **Perguntar**, só quando a ficha é de **agente** e há um **dono jogador conectado**: o Mestre posta um cartão no chat com o botão **Rolar Vigor**.
  - Só o dono da ficha ou o Mestre resolvem; o clique do jogador vai por socket ao Mestre, que rola em nome do agente.
  - O cartão vale uma vez (segundo clique não faz nada) e vira o resultado ("estancou" / "continua sangrando").
  - Um cartão aberto por efeito: se o jogador não clicou, o próximo turno não posta outro.
- **Automático**, ameaça, ou agente sem dono conectado: rola na hora, como antes.

## Código
- Regras puras: `module/helpers/turn-effects-rules.mjs` (`bleedMode`, `bleedOutcome`, `canRollBleed`, `bleedCardOpen`).
- Motor: `module/macros/ritual-area-engine.mjs` (`resolveBleed`, `postBleedCard`, `resolvePendingBleed`).
- Clique e socket (`bleedTest`): `module/ordemparanormal.mjs`. Opção: `module/helpers/player-onboarding.mjs`.

## Verificação
- `npm test` (`tests/unit/turn-effects.test.mjs`).
- No mundo, com dois jogadores reais em navegadores separados: ver seção de resultado abaixo.

## Resultado (18/10/2026)
Mundo `nova-ordem`, cena temporária, dois jogadores novos em navegadores separados (apagados no fim). `npm test` 266/266; `lang-check` ok.

| Caso | Resultado |
| --- | --- |
| Ameaça sangrando, opção "Perguntar" | Rola sozinha, sem cartão (perdeu PV) |
| Agente com dono conectado | Cartão com botão; PV intocado até o clique |
| Jogador 2 (não dono) pede a rolagem pelo socket | Ignorado, cartão continua aberto |
| Jogador 1 clica o botão (falhou) | Perdeu 6 PV, efeito continua, cartão vira "continua sangrando", botão some |
| Opção "Automático" | Sem cartão, perdeu PV na hora |
| Turno seguinte sem clicar | Não cria segundo cartão |
| Jogador 1 clica com Vigor alto (passou) | Efeito removido, cartão "estancou"; segundo clique não faz nada |

Não coberto: agente sem dono conectado (cai no automático por `bleedMode`, testado só na regra pura).
