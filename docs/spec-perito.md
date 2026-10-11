# Spec: Perito com custo de PE por faixa de NEX

Perito (Especialista, Tabela 1.4) tem a mesma progressão do Ataque Especial (Tabela 1.3): o custo e o bônus sobem em NEX 5%, 25%, 55% e 85% (níveis 1, 5, 11, 17).

| Nível | Ataque Especial | Perito |
|---|---|---|
| 1 | 2 PE, +5 | 2 PE, +1d6 |
| 5 | 3 PE, +10 | 3 PE, +1d8 |
| 11 | 4 PE, +15 | 4 PE, +1d10 |
| 17 | 5 PE, +20 | 5 PE, +1d12 |

## Comportamento
- Na janela de teste de perícia aparece a caixa "Perito: gastar N PE para somar Xd" se a ficha tem o poder **Perito** (o nome exato; "Perito em Explosivos" é outro), a perícia é treinada e não é Luta nem Pontaria.
- Marcada, soma o dado à fórmula e cobra o custo da faixa do nível. Sem marcar, não cobra. Sem saldo, o teste não sai e avisa.
- Usa PD no lugar de PE quando o mundo está na regra "sem Sanidade".
- O limite de PE por turno não bloqueia (mesma regra do Ataque Especial).
- Para restringir às duas perícias escolhidas: flag `ordem_v2_classic.peritoSkills` (lista de chaves) no item Perito. Sem a flag, vale para qualquer perícia treinada (não há seletor de perícias).

## Testes
- Unitário: `tests/unit/perito.test.mjs` (`npm test`), inclui a igualdade com o custo do Ataque Especial e com a tela de nível.
- Ao vivo (Playwright, ator temporário, apagado no fim): `docs/macros/perito-live-test.playwright.js`, rodado com `playwright-cli run-code --filename=...`.
