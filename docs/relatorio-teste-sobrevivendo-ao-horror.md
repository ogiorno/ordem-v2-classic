# Relatório de teste ao vivo — Sobrevivendo ao Horror (marca "sah" e concessões)

Data: 21/10/2026. Sistema `ordem_v2_classic` 8.0.2, mundo `nova-ordem`, servidor local na porta 30000.
Como: sessão própria do `playwright-cli` (`-s=sah`), logada como "QA GM"; atores temporários "ZZ SAH teste …", todos apagados ao fim (conferido: 0 sobraram). Nada foi feito na cena ativa nem nos agentes da mesa.
Escopo: o que foi feito nesta sessão (seção 9 da spec: marca discreta, correção do Funcionário de Beira de Estrada, leitura da marca no Grimório) mais uma passada nas concessões automáticas e nos efeitos da seção 3, que dependem do mesmo conteúdo.

## Resultado

| # | O que foi testado | Resultado |
| --- | --- | --- |
| 1 | Marca `flags.ordem_v2_classic.source = "sah"` nos compêndios vivos | **Passou.** 277 itens marcados, nas quantidades esperadas por pacote (origins 20, originPowers 20, paths 15, classes 1, paranormalPowers 8, generalPowers 34, armaments 12, protections 1, survivalPowers 9, general 78, fighter/specialist/occultistPowers 11/11/9, pathFighter/Specialist/Occultist 24/12/12). |
| 2 | Itens do Livro de Regras ficam sem a marca (Calejado, Casca Grossa, Medidor de Estabilidade da Membrana) | **Passou.** Os três sem marca. |
| 3 | Aplicar o apply de novo não muda nada | **Passou.** 0 atualizados, 314 sem mudança, 0 erros. |
| 4 | Funcionário de Beira de Estrada no compêndio vivo | **Passou.** Diz "página 54 do Arquivos Secretos 5". |
| 5 | Nenhum item marcado com texto provisório | **Passou.** 0 itens do suplemento com "Você pode encontrar esse conteúdo" ou "Your text here". |
| 6 | Efeitos passivos no compêndio (Fôlego de Nadador, Luta ou Fuga, Vitalidade Reforçada, Vontade Inabalável, Durão, Monstruoso Sangue 99%, Pé de Morto) | **Passou.** Todos com os efeitos descritos na seção 3 da spec. |
| 7 | Grimório lê a marca | **Passou.** Índice de 479 entradas; poderes do suplemento: 150 (classe 40, origem 20, geral 34, paranormal 8, trilha 48); a aba Poderes mostra 316 e o filtro de fonte "Sobrevivendo ao Horror" lista 150. Os 8 paranormais do suplemento agora aparecem com a fonte do suplemento (antes apareciam como Livro). |
| 8 | A marca acompanha o item para a ficha | **Passou.** Origem, poder concedido, trilha, habilidades e classe Sobrevivente chegam na ficha com `{sah}`. |
| 9 | Origem concede o poder certo e remover a origem remove o poder | **Passou.** Mergulhador concede Fôlego de Nadador (marcado como concedido); apagar a origem tira o poder. |
| 10 | Efeitos aplicados na ficha (Combatente, NEX 30, nível 1) com Mergulhador, Vitalidade Reforçada, Vontade Inabalável, Atlético e Personalidade Esotérica | **Passou.** PV 21→27 (+5 Fôlego, +1 Vitalidade por nível), PE 0→3, deslocamento 9→12, Vontade +2, Vontade Inabalável +0 PE no nível 1 (1 a cada 2 níveis). |
| 11 | Trilha Monstruoso – Sangue por nível | **Passou.** Nível 1: nenhuma habilidade; nível 20: as 4 (Amaldiçoado, Macabro, Assustador, Aterrorizante); descer ao nível 2: fica só a de NEX 10%. Atributos no nível 20 conferem (Força +1 do Ser Aterrorizante). |
| 12 | Classe Sobrevivente por estágio | **Passou.** Estágio 1: Empenho; estágio 2: Estágio 2 – Durão; PV máx 15 no estágio 2 e 19 no 3 (+4 do Durão e +2 ao chegar no 3); voltar ao estágio 1 remove o que passou do limite. |
| 13 | Rodar sem lixo | **Passou.** 0 atores "ZZ SAH" restaram; sessão `sah` fechada; sessões de outros fluxos intocadas. |

## Achados

### A. Concessão duplicada, vista uma vez (corrigido; ver seção 10 da spec)
Na **primeira** execução do teste de concessão depois de aplicar o conteúdo, o Mergulhador concedeu **dois** "Fôlego de Nadador", e, ao subir o agente ao nível 20, cada habilidade do Monstruoso – Sangue apareceu duas vezes (Força ficou em 3 em vez de 2). Depois disso repeti:
- origem sozinha, com a página recarregada (cache frio), 2 vezes, NEX 5 e NEX 30;
- o teste completo 3 vezes, inclusive logo após recarregar a página.

Em todas essas, uma concessão só, sem duplicata. Não consegui reproduzir nem explicar a primeira (a hipótese é concorrência logo depois do apply nos compêndios, mas não está provada). O código tem fila por ficha em `syncPathAbilities`, e a concessão da origem pelo hook `createItem` não passa por ela. **Atualização:** a causa foi achada depois (concessão do poder de origem fora da fila por ficha) e corrigida; ao vivo, três origens simultâneas passaram de 3 Fôlegos para 1, e o teste novo `concessao-sem-duplicar.test.mjs` cobre o caso.

### B. Itens com texto provisório que não são do suplemento
14 itens dos compêndios ainda dizem "Você pode encontrar esse conteúdo na página X…": as 13 referências do Arquivos Secretos (seção 7 da spec) e o **Utensílio**, que é do Livro de Regras (`general/livro-de-regras/acess-rios/utens-lio`). O Utensílio não está na spec e continua provisório.

### C. Observações menores
- Ao subir o estágio de um Sobrevivente na ficha, abre a tela "Subiu de nível" no navegador de quem está logado. É o comportamento esperado do sistema, mas apareceu por cima da tela durante o teste e atrapalhou a captura de tela do Grimório; por isso este relatório não traz imagem.
- Itens que já estavam arrastados para fichas antes da marca continuam sem ela (só os novos a levam).
- Quem está com o jogo aberto precisa dar F5 para o índice do Grimório refletir a marca.

## Cobertura que continua offline
`npm test` (1041 testes) cobre as regras, tabelas do livro e a marca nos arquivos-fonte (`sobrevivendo-ao-horror*.test.mjs`, 146 testes). Este relatório é o complemento ao vivo: compêndios reais, ficha real e Grimório real.

## Não testado
- Fichas já existentes na mesa (de propósito, para não mexer no estado dos jogadores).
- Origens com "bônus condicional" e demais itens da seção 4 da spec (ficam no texto).
- Equipamentos e itens amaldiçoados arrastados para a ficha (cobertos só offline).
