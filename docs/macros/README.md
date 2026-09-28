# Macro Conjurar Ritual

## Instalação no Foundry

1. Confirme que o sistema **Ordem Paranormal v2 Classic** está atualizado com este repositório e ativo no mundo.
2. No Foundry, abra **Macros** e crie uma macro nova do tipo **Script**.
3. Dê o nome **Conjurar Ritual** e copie todo o conteúdo de [`conjurar-ritual.js`](conjurar-ritual.js) para o campo de comando.
4. Salve. A macro usa o agente controlado ou pede para escolher entre os agentes acessíveis.
5. Para pagar com PD, habilite nas configurações do sistema a regra global **Jogando sem Sanidade**.

O ícone de cada ritual usa a imagem do próprio item. Quando ela não existe, a macro mostra o glifo da afinidade em [`ritual-elementos.png`](../../systems/ordem_v2_classic/assets/ritual-elementos.png).

## O que a macro executa

- Lista os rituais da ficha, com busca e filtro por círculo.
- Calcula o custo básico (1, 3, 6 ou 10) e reconhece adicionais Discente/Verdadeiro no texto do ritual. Se não conseguir ler o adicional, pede um valor manual.
- Mostra requisitos avançados, alvo, execução, limite de PD por turno, concentração e confirmação dos componentes antes de conjurar.
- Cobra o custo uma vez antes das rolagens, como exige a regra de gasto mesmo em falha.
- Faz os testes estruturados de concentração, Ocultismo e resistência dos alvos e publica um cartão no chat.

A macro usa o limite estimado pela NEX (`ceil(NEX / 5)`, máximo 20) porque o campo `PD.perRound` do sistema representa recuperação, não limite de gasto. O campo pode ser ajustado para bônus da ficha. Efeitos narrativos e perda permanente de Sanidade sem campo próprio ainda exigem ajuste manual; a macro os registra no cartão.

## Validação

Os testes automatizados da lógica cobrem custos, parsing das formas, modo PD, limite, requisito de Medo, bloqueios e resistência. A validação final da janela e dos valores antes/depois precisa ser feita em um mundo Foundry ativo com agente de teste.
