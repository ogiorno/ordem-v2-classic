# Spec — Macro de Conjuração de Rituais

**Status:** especificação e plano de validação; a macro ainda não foi implementada.  
**Sistema-alvo:** Ordem Paranormal v2 Classic no Foundry VTT.  
**Referências de regras:** extração do Livro de Regras v1.3 em `D:\FTT\odem regas\06-o-outro-lado`; mapeamento técnico do sistema em [mapeamento-rituais-agente.md](mapeamento-rituais-agente.md).

## Objetivo

Criar uma macro que conduza o jogador da escolha de um ritual conhecido até a publicação do resultado no chat. Ela deve mostrar os rituais do agente ativo, permitir filtrar por círculo, escolher forma e alvo, exibir custo e consequências antes da confirmação, consumir o recurso de esforço configurado como PD no jogo do usuário e executar os testes exigidos pelas regras. A macro não deve simular que o teste de Ocultismo de “O Custo do Paranormal” decide se o efeito acontece: esse teste mede a consequência de conjurar o ritual.

## Sequência de trabalho exigida

1. **Validar antes de implementar:** fazer um protótipo de prova de conceito sem alterar recursos, confirmar as APIs e os campos no Foundry/system Classic, e percorrer os casos da seção “Testes de validação”. A prova de conceito deve exercitar a seleção, cálculo de custo, chamadas de rolagem e condições de bloqueio. Não deve descontar PD nem publicar resultados como se fossem conjurações reais.
2. **Implementar depois da validação:** só então escrever a macro de uso, reaproveitando os componentes e chamadas que passaram na prova. A implementação deve manter o resumo e os controles definidos nesta spec; se algum teste revelar divergência entre regra extraída e dados do sistema, atualizar esta spec antes de codificar esse comportamento.
3. **Testar a macro implementada:** repetir os casos com um agente de teste no Foundry, confirmar os valores antes/depois no recurso e conferir mensagens, cancelamento e falhas. Não declarar pronta sem esse teste de ponta a ponta.

## Regras que definem o fluxo

As regras abaixo foram conferidas nos arquivos extraídos; os caminhos são relativos a `D:\FTT\odem regas`.

| Regra | Comportamento requerido | Fonte extraída |
|---|---|---|
| Custo básico | 1º círculo = 1 PE; 2º = 3 PE; 3º = 6 PE; 4º = 10 PE. | `06-o-outro-lado/0867-rituais.md` e `0868-toque.md` |
| Forma avançada | Usar no máximo uma forma: básica, Discente ou Verdadeira. Somar o adicional escrito no próprio ritual. Conferir requisitos de círculo e afinidade antes de habilitar a opção. | `06-o-outro-lado/0894-formas-avancadas.md` |
| Limite de gasto | Bloquear a conjuração se o custo superar o limite de PE por uso/turno do agente, além de verificar saldo suficiente. | `05-regras/0675-gasto-de-pe.md`; `06-o-outro-lado/0894-formas-avancadas.md` |
| Recurso no jogo do usuário | Cobrar **PD**, conforme o pedido. Na prova, confirmar qual campo e configuração do Classic representam PD para este agente. Se a mesa estiver configurada apenas para PE, interromper com uma mensagem de incompatibilidade em vez de cobrar PE silenciosamente. Mostrar saldo, custo e saldo restante identificados como PD. | Pedido do usuário; `mapeamento-rituais-agente.md`; `module/documents/actor.mjs` |
| Custo do Paranormal | Em ritual que não seja de Medo, fazer teste de Ocultismo contra DT 20 + custo final. A falha reduz Sanidade igual ao custo; falhar por 5 ou mais também reduz 1 SAN permanentemente. A falha **não cancela por si só** o ritual. | `06-o-outro-lado/0895-o-custo-do-paranormal.md` |
| Medo | Não pedir componente ritualístico; exigir personagem Marcado conforme regra de mesa. Ao conjurar, aplicar a perda de SAN igual ao custo e perda permanente de SAN: 1 na forma básica, 2 na Discente, 3 na Verdadeira. Não rolar o teste de Ocultismo de “O Custo do Paranormal”. | `06-o-outro-lado/0896-invocando-o-medo.md` |
| Ação e componentes | Exibir tipo de execução do ritual e alertar sobre mão livre/componentes. A macro não consegue confirmar ficcionalmente essas condições; deixar a confirmação ao jogador/Mestre. | `06-o-outro-lado/0859-acao-e-custo.md`, `0860-gestos-e-componentes.md` |
| Concentração | Se o jogador indicar condição ruim ou terrível, ou dano durante a execução, solicitar teste de Vontade com DT prevista na regra. Falha impede o efeito e o custo já gasto é perdido. | `06-o-outro-lado/0861-concentracao.md` |
| Testes do ritual | Um teste de resistência do alvo ou outro teste especificado no texto do ritual é um passo separado. A macro deve usar os campos estruturados quando representarem a regra; exceções e efeitos narrativos ficam para resolução manual do Mestre. | `06-o-outro-lado/0874-efeito.md`, `0888-resistencia.md`, descrição do ritual |

**Importante sobre a extração:** `RitualData` do Classic tem círculo, elemento e flags de formas, mas não tem um campo estruturado de custo/adicional. O custo básico pode vir do círculo. Para Discente/Verdadeira, a prova deve confirmar se o texto do item está disponível e legível; o custo adicional deve ser extraído do texto com validação visível. Se não houver uma correspondência segura, pedir confirmação/valor manual no diálogo e nunca cobrar um custo presumido. Não automatizar requisitos ou efeitos arbitrários só pela descrição livre.

O Classic descreve a configuração “Jogando sem Sanidade” como a fusão de PE e SAN em PD. Como esta macro precisa pagar o custo em PD, a prova deve também confirmar como as perdas de SAN de conjuração se refletem nesse modo. O comportamento esperado é não ignorar essas consequências nem descontá-las duas vezes; se o sistema não oferecer um mapeamento seguro para perda permanente de SAN, manter essa consequência visível para resolução manual e documentar o limite antes da implementação.

**Correção de interpretação do mapeamento anterior:** o texto de regra v1.3 torna o teste de Ocultismo em “O Custo do Paranormal” um teste de consequência de Sanidade, não um teste geral que determina sucesso do ritual. A implementação deve preservar essa diferença. Um ritual só deixa de funcionar por falha de concentração ou por uma condição/regra específica descrita nele.

## Experiência do jogador

### 1. Abrir e identificar o agente

- Ao clicar na macro, resolver primeiro o agente do token controlado; se não houver, usar o ator/token do contexto de chat apenas quando não houver ambiguidade.
- Se nenhum agente único puder ser resolvido, mostrar uma escolha de agente ou uma instrução clara para selecionar/controlar um token. Não abrir uma lista vazia silenciosamente.
- Listar somente rituais conhecidos daquele agente. Exibir estado vazio explicando que a ficha não contém rituais.

### 2. Escolher o ritual

- Abrir uma janela em português, com busca por nome e filtros de círculo: **Todos**, **1º**, **2º**, **3º**, **4º**. O círculo vem do item; o jogador não pode alterar o círculo cadastrado como se fosse uma melhoria.
- Organizar os resultados por círculo. Cada cartão compacto mostra ícone, nome, círculo, afinidade, execução, alcance e custo básico. Selecionar o ritual abre o detalhe sem fechar a janela.
- Usar `item.img` quando existir um retrato apropriado. Caso contrário, usar o glifo da afinidade do protótipo visual desta spec, com o nome do ritual legível; aplicar a cor da afinidade também a um filete/etiqueta para que a cor nunca seja a única distinção.
- O jogador pode voltar à lista sem perder escolhas já válidas.

### 3. Escolher forma e conferir custo

- Mostrar Básica, Discente e Verdadeira somente quando disponíveis no item. Cada opção indica custo final e o resumo do efeito alterado. Mostrar requisito de círculo/afinidade junto da forma; forma indisponível deve ficar desabilitada com o motivo.
- Somar custo-base do círculo ao adicional específico escrito no ritual. Permitir revisão manual quando a extração falhar, identificando o valor como confirmado pelo jogador. Não inferir adicional genérico para formas avançadas.
- Mostrar saldo do recurso utilizado, custo final, saldo após pagamento e limite de gasto por uso/turno. Bloquear “Conjurar” quando faltar recurso ou o custo ultrapassar o limite.
- Exibir uma caixa de confirmação curta: ritual/forma, alvo, execução, custo pago, teste de Ocultismo/SAN aplicável, e requisitos ficcionais de componentes/concentração. Nada é debitado enquanto o diálogo não for confirmado.

### 4. Alvo, área e opções do Mestre

- Preselecionar tokens que o jogador marcou como alvo quando compatíveis com o ritual. Permitir escolher um ou mais alvos se o texto/metadados pedirem isso.
- Para ritual pessoal/sem alvo, não exigir token-alvo. Para área, permitir informar o ponto/área na cena ou deixar a definição narrativa para o Mestre quando a macro não tiver integração espacial segura.
- Mostrar a resistência definida no item. A rolagem do alvo deve ser disparada como etapa própria, nunca confundida com o teste de Ocultismo do conjurador.
- Se o ritual tiver DT, teste ou regra especial apenas no texto livre, exibir a instrução do ritual no resumo e deixar o Mestre resolver manualmente; não inventar DT padrão nem aplicação automática do efeito.

### 5. Confirmar, pagar e resolver

- Na confirmação, validar novamente o saldo atualizado e debitar o custo uma vez. O pagamento segue a regra de gasto mesmo em falha, conforme `05-regras/0675-gasto-de-pe.md`. Evitar duplo débito caso o jogador clique mais de uma vez.
- Para elementos diferentes de Medo, rolar Ocultismo contra `20 + custo final`, com diálogo nativo de rolagem para permitir escolha de atributo e modificadores. Publicar resultado e consequências de SAN sem cancelar automaticamente o efeito em caso de falha. Se a mesa estiver no modo PD, tratar a perda de SAN conforme a fusão de recursos confirmada na prova.
- Para Medo, não fazer essa rolagem; apresentar e aplicar/registrar as perdas de SAN temporária e permanente conforme a forma. No modo PD, validar como essas perdas se refletem no recurso; se não houver mapeamento seguro para a perda permanente, deixá-la explícita para resolução manual.
- Se houve condição de concentração, resolver teste de Vontade conforme `0861-concentracao.md`. Falha bloqueia o efeito e mantém o custo pago.
- Publicar no chat uma mensagem única com ícone/colorização, agente, ritual e forma, custo/recurso, execução, alvo(s), teste(s), DT/resultado e descrição/efeito. Anexar a carta existente do item ou um resumo fiel, sem publicar custo duas vezes.
- Cancelar em qualquer diálogo antes da confirmação não rola dados, não altera recursos e não cria mensagem de conjuração.

## Direção visual

Paleta inicial compatível com os acentos encontrados no Classic: Sangue `#b3262d`, Morte `#6b6f7a`, Conhecimento `#c98a12`, Energia `#7d3fc4` e Medo `#4a4a4a`. A prancha de referência está em [ritual-elementos.png](ritual-elementos.png). Ela representa cinco glifos-base para a afinidade; não é uma ilustração exclusiva de cada ritual. Na macro, o retrato próprio do item tem prioridade, e o glifo funciona como fallback identificável. Assim cada ritual mantém identidade pelo nome/arte do item e pela afinidade sem prometer geração de imagem dinâmica dentro do Foundry.

![Prancha de glifos das cinco afinidades](ritual-elementos.png)

Os cinco glifos da imagem são, na ordem, Sangue (gota/espinho), Morte (espiral/ampulheta), Conhecimento (olho/página), Energia (raio/circuito) e Medo (eclipse/abismo). O contraste, a transparência e a leitura em miniatura devem ser verificados na janela real antes de aceitar os assets finais.

## Plano de validação antes da implementação

### Prova de conceito sem mutação

1. Abrir a macro sem token, com um token agente controlado, com ator não-agente e com mais de um agente possível; conferir seleção/erro compreensível.
2. Usar um agente com rituais de círculos diferentes; conferir busca, filtros, ordenação e metadados corretos.
3. Validar os custos-base 1, 3, 6 e 10 para círculos 1 a 4; conferir ao menos um item de teste com Discente e Verdadeira com adicionais diferentes.
4. Validar forma sem requisito, requisito de círculo não cumprido, requisito de afinidade não cumprido e item sem custo adicional legível. Nenhum caso incerto pode assumir custo silenciosamente.
5. Conferir o método nativo de `rollSkill` com Ocultismo e Vontade no Classic, presença de DT no diálogo e leitura do resultado/cancelamento. Confirmar os nomes reais das perícias do sistema (`occultism`, `will`) e campos de resistência.
6. Testar modo PE e modo PD da configuração. O diálogo deve mostrar e ler o recurso ativo corretamente. Validar saldo zero, custo exatamente igual ao saldo, custo acima do saldo e limite por uso.
7. Confirmar, sem atualizar o ator, a ordem pretendida de validação, rolagem e composição da mensagem. Cancelamentos e erros não podem gravar mensagens nem recursos.
8. Conferir os cinco ícones em tamanho pequeno, transparência, cores e distinção sem depender apenas da cor.

### Testes de aceitação após implementar

- Ritual básico de Sangue: custo de círculo, confirmação, débito único e teste de Ocultismo de consequência.
- Ritual básico de Medo: sem teste de Ocultismo do custo, aviso/perda de SAN correspondente e sem componente ritualístico.
- Forma Discente e forma Verdadeira: adicionais específicos, limite do agente e pré-requisitos respeitados.
- Falha no teste de Ocultismo: efeito permanece elegível, custo permanece pago e consequências de SAN são registradas de acordo com a diferença para a DT.
- Falha de concentração: efeito não é aplicado, custo permanece pago e chat explica a interrupção.
- Ritual com resistência estruturada: resistência do alvo acontece separadamente e usa o resultado configurado.
- Cancelar ou ficar sem saldo entre abrir e confirmar: nenhuma rolagem ou débito duplicado; erro claro.
- Sem `item.img`: fallback de afinidade correto; com `item.img`: retrato do item aparece com acento de afinidade.

## Limites de escopo da primeira versão

A primeira versão guia escolhas, paga recurso, rola testes gerais exigidos pela regra e registra resultados. Ela não interpreta linguagem natural para impor todos os efeitos, não escolhe área em grid sem validação de alcance/forma, não resolve sozinho situações narrativas, e não automatiza dano, condições ou efeitos especiais descritos apenas em texto. Isso evita que um resumo incompleto altere o efeito do ritual.

## Critério para começar a implementação

A fase de implementação começa quando a prova de conceito passar nos itens 1–8 e as ambiguidades sobre custo avançado, recurso PD e consequências de Sanidade estiverem documentadas com o comportamento real observado no sistema Classic. Se um requisito não puder ser validado, a macro deve manter confirmação manual explícita em vez de cobrar, rolar ou aplicar um resultado assumido.
