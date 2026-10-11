# Spec: categoria dos itens, modificações e limite da patente

Regra (Livro, "Limite de Itens" e "Modificações"): cada modificação de arma ou proteção aumenta a categoria do item em I, e a patente limita quantos itens de cada categoria o agente escolhe por missão (Tabela 3.1). A ficha **só informa**: passar do limite deixa o número vermelho, nada é bloqueado.

## O que a ficha mostra
- **Limites por categoria** (aba Inventário): cada categoria mostra `usados/limite`. O número usado fica vermelho quando passa do limite. Limite vazio na patente vale 0. Itens acima da categoria IV aparecem em uma caixa "V+" sempre vermelha.
- **Etiqueta na arma e na proteção**: categoria final (base + modificações), vermelha se aquela categoria estourou. Dica: "Categoria I + 2 modificações = III".
- **Equipamentos gerais**: o número da categoria fica vermelho quando estoura.
- Conta cada exemplar (quantidade). Categoria 0 não conta. Só armas, proteções e equipamentos entram.

## Modificações
- Campo `system.modifications` (conjunto) em armas e proteções, escolhido na ficha do item (aba de especificações da arma, atributos da proteção).
- Armas: as 15 da Tabela 3.5, incluindo as de munição (Dum dum e Explosiva). Proteções: Antibombas, Blindada, Discreta, Reforçada (Tabela 3.7).
- Modificação repetida não soma ("modificações iguais não se acumulam").
- A modificação só sobe a categoria; os efeitos dela (+2 de ataque etc.) continuam manuais.

## Testes
- Unitário: `tests/unit/item-categories.test.mjs` (`npm test`).
- Ao vivo (Playwright, ator temporário apagado no fim): `docs/macros/categoria-itens-live-test-1.playwright.js` e `-2`.
- Código: `module/helpers/item-categories.mjs`, `module/sheets/actor-sheet.mjs`, `module/sheets/item-sheet.mjs`, `templates/actor/parts/actor-inventory.hbs`, CSS no fim de `css/ordemparanormal.css`.

## Habilidades que reduzem a categoria (atualização)

O item ganhou o campo **Item favorito** (`system.favorite`, na ficha do item). Só o item marcado recebe a redução:

| Habilidade | Efeito |
|---|---|
| NEX 10% A Favorita (Aniquilador) | arma favorita −I |
| NEX 40% Técnica Secreta | arma favorita −II (substitui, não soma) |
| NEX 99% Máquina de Matar | arma favorita −III (substitui, não soma) |
| Ferramentas Favoritas (origem) | um item favorito que não seja arma −I |
| NEX 40% Remendão (Técnico) | todo equipamento geral −I (sem marcar) |

A categoria final é `base + modificações − redução`, nunca abaixo de 0, e o limite da patente usa esse valor: a redução abre espaço para mais modificações.

Fora do escopo: Ferramentas Paranormais (não há marcador de item paranormal), modificações de acessórios (Tabela 3.9) e a opcional do Sobrevivendo ao Horror.
Testes: `tests/unit/item-categories.test.mjs` e `docs/macros/categoria-itens-live-test-3/4.playwright.js`.
