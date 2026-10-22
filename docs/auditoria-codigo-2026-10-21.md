# Auditoria de código — 21/10/2026

**What this repo does:** Este repositório desenvolve o sistema `ordem-v2-classic` para Foundry VTT, módulos auxiliares, compêndios e ferramentas de sincronização. O fluxo principal transforma dados de ficha e itens em rolagens, chat, efeitos e atualizações persistidas no mundo. Assumi uma mesa com um Mestre e vários jogadores conectados, que podem clicar quase ao mesmo tempo. O código auditado inclui alterações locais ainda não commitadas; elas foram preservadas.

## Must fix

1. **Pedido de dano aceita valor declarado pelo cliente** (`systems/ordem-v2-classic/module/ordemparanormal.mjs:273-280`, `module/documents/actor.mjs:295-310`).
   - **O que é:** Um jogador sem posse do alvo pede ao Mestre para aplicar dano por socket.
   - **Problema:** O pedido traz `amount`, `options` e `userId`; o Mestre confere posse usando esse `userId` declarado, mas não vincula o valor a uma rolagem ou ação autorizada. Um cliente alterado pode declarar o ID de outro usuário com posse e pedir dano arbitrário.
   - **Correção:** Remover a rota genérica de dano remoto para ações de jogador, ou aceitar apenas `messageId` e reconstituir valor, alvo e permissões de um documento confiável no cliente do Mestre. Cobrir pedido forjado, ID de outro usuário, valor alterado e clique legítimo em teste de integração.
   - **Se ignorar:** Um jogador conectado pode afetar PV fora das regras da ação; a checagem atual não protege a origem dos dados.

2. **Dano do cartão pode ser aplicado duas vezes** (`module/helpers/card-damage.mjs:27-71`).
   - **O que é:** O Mestre aplica o dano e marca a mensagem como aplicada.
   - **Problema:** Dois pedidos rápidos podem ler `damageApplied` vazio antes de qualquer um gravar a flag; ambos alteram PV. Se a escrita da flag falhar depois do dano, um novo clique também repete o dano.
   - **Correção:** Serializar por ID da mensagem no cliente autoritativo, reler o estado dentro da seção protegida e registrar uma fase de operação antes de alterar PV; definir recuperação explícita se alguma escrita falhar. Testar duas chamadas concorrentes e falha entre alteração de PV e marcação.
   - **Se ignorar:** Um clique duplo ou atraso de rede pode causar perda extra de PV.

3. **Ritual pode cobrar PD antes de falhar em etapa posterior** (`module/macros/ritual-caster.mjs:849-919`).
   - **O que é:** A conjuração desconta PD e depois consome catalisador, faz testes e cria a carta.
   - **Problema:** Se consumir o catalisador, testar ou criar a mensagem lançar erro, o PD já foi descontado e não há compensação. A área já pode ter sido colocada antes do pagamento.
   - **Correção:** Definir um plano da conjuração com estados persistidos; registrar pagamento e conclusão, e compensar apenas as etapas reversíveis quando a próxima etapa falhar. Cobrir falha de `consumeCatalyst`, `runCasterTests` e `ChatMessage.create` sem mudar a regra de cancelamento já praticada.
   - **Se ignorar:** O jogador perde recurso ou fica com área sem carta correspondente.

4. **Resolução de ritual pode repetir efeitos após falha** (`module/macros/ritual-caster.mjs:1171-1282`).
   - **O que é:** O Mestre muda o estado da carta para `rolling`, aplica efeitos em alvos e termina com `resolved`.
   - **Problema:** Se um efeito já foi aplicado e uma etapa posterior falha, o `catch` volta ao estado anterior. Um novo pedido percorre novamente os alvos e pode repetir dano, cura ou efeito.
   - **Correção:** Persistir progresso por alvo/efeito ou registrar um identificador de operação aplicado antes de permitir repetição; recuperar etapas incompletas sem reaplicar as concluídas. Testar falha depois do primeiro alvo e reenvio da mesma mensagem.
   - **Se ignorar:** Um erro parcial pode alterar a mesma ficha duas vezes.

5. **Troca de alvo apaga o efeito antigo antes de confirmar o novo** (`module/macros/ritual-caster.mjs:1143-1158`).
   - **O que é:** A ação de Amaldiçoar Arma troca o alvo de um efeito ativo.
   - **Problema:** Os efeitos antigos são excluídos antes de `applyWeaponCurse` criar o novo. Se a criação falhar, o efeito anterior se perde e a carta continua apontando para o estado antigo.
   - **Correção:** Criar e validar o novo efeito primeiro, atualizar a carta e só então remover o antigo; adicionar compensação se a atualização falhar. Testar falha na criação e na atualização da mensagem.
   - **Se ignorar:** O ritual pode desaparecer durante uma troca malsucedida.

6. **Habilidade de ameaça cobra custo antes de criar seu painel** (`module/macros/threat-ability-use.mjs:143-156`).
   - **O que é:** O uso da habilidade atualiza o recurso do ator, cria o painel e posta mensagens.
   - **Problema:** Se `planPanel` ou `createPanelMessage` falhar após `actor.update`, o fluxo retorna erro e o recurso continua gasto, sem painel para resolver a habilidade.
   - **Correção:** Preparar o painel antes de cobrar, registrar a operação e recuperar/compensar falhas posteriores. Testar a falha imediatamente após o débito.
   - **Se ignorar:** O Mestre vê erro, mas a ameaça perde recurso.

## Should fix

7. **Comandos do README não correspondem ao projeto atual** (`systems/ordem-v2-classic/README.md:29-55`, `package.json:5-13`).
   - **O que é:** O README orienta build e testes para quem mantém o sistema.
   - **Problema:** Ele anuncia `build:db`, `test:watch`, `test:coverage` e `dev:down`, além de Vitest/Quench, enquanto o `package.json` atual usa Node Test Runner e `packs:pack`; esses comandos não existem.
   - **Correção:** Atualizar o README para os scripts reais e separar testes Node, renderização e suítes executadas dentro do Foundry.
   - **Se ignorar:** Uma pessoa nova não consegue seguir o fluxo documentado.

8. **Teste de desempenho torna a suíte instável** (`systems/ordem-v2-classic/tests/unit/grimoire-search.test.mjs:129-138`).
   - **O que é:** O teste exige que a busca em 600 entradas termine em menos de 50 ms.
   - **Problema:** Nesta auditoria, `npm test` passou 1.336 testes e falhou nesse único teste com 52,9 ms; o resultado depende da carga da máquina e não demonstra erro funcional.
   - **Correção:** Deixar a suíte principal testar correção e limites de saída; medir tempo em benchmark separado, no mesmo ambiente e com amostras estáveis.
   - **Se ignorar:** A suíte falha ocasionalmente e reduz a confiança nos testes.

9. **Regra de aplicação de dano está dividida entre vários fluxos** (`module/documents/actor.mjs:280-330`, `module/helpers/card-damage.mjs:27-71`, `module/macros/ritual-caster.mjs:1240-1266`, `module/macros/threat-ability-damage-runner.mjs:43`).
   - **O que é:** Arma, ritual, habilidade e cartão chegam ao PV por caminhos diferentes.
   - **Problema:** O ritual genérico calcula valor e atualiza cura diretamente, enquanto dano passa por `applyDamage`; cartões guardam estado de desfazer separado. Uma correção de RD, visibilidade ou histórico exige verificar vários caminhos.
   - **Correção:** Manter `OrdemActor.applyDamage` como entrada do dano e extrair somente o planejamento/registro comum de aplicação. Não misturar cura com dano; cobrir uma mesma matriz de alvo e permissão em cada fluxo.
   - **Se ignorar:** Comportamentos da mesma ação divergem conforme a origem.

10. **A classe de entrada concentra registro e ações de jogo** (`module/ordemparanormal.mjs:72-379`, `module/ordemparanormal.mjs:640-902`).
    - **O que é:** O arquivo principal registra documentos, telas, hooks, migração, atalhos e muitas mensagens de socket.
    - **Problema:** Uma mudança em uma função de jogo pode alterar a inicialização inteira; o handler de socket mistura dano, ritual, sangramento, estabilização, testes opostos e reação em uma sequência extensa.
    - **Correção:** Extrair registro por domínio (`combat`, `ritual`, `progression`, `threat`) e manter a entrada só na ordem de inicialização. Cada handler recebe dependências e valida sua própria requisição.
    - **Se ignorar:** Revisões e testes de regressão ficam caros, e permissões de operações distintas se confundem.

11. **Escape de HTML e visibilidade são repetidos** (`module/macros/ritual-caster.mjs:56`, `module/macros/threat-ability-use.mjs:14`, `module/applications/grimoire-app.mjs:45`, `module/documents/item.mjs:25-27`, `module/documents/chat-message.mjs:46-48`).
    - **O que é:** Várias telas montam HTML ou selecionam destinatários de mensagens.
    - **Problema:** Há mais de dez implementações locais de `escapeHtml` e dois wrappers idênticos de `damageRecipients`. Um novo campo pode escapar em um lugar e ficar sem escape em outro.
    - **Correção:** Usar `foundry.utils.escapeHTML` nas bordas de HTML dinâmico quando disponível e chamar `damageRecipients(targetActor, game.users)` diretamente. Testar um nome contendo `<`, `&` e aspas no caminho que renderiza HTML.
    - **Se ignorar:** O tratamento de texto vindo de fichas continua inconsistente.

12. **Testes de integração de falha parcial não acompanham os fluxos críticos** (`module/tests/suites/`, `tests/unit/`).
    - **O que é:** Há 72 arquivos unitários e 23 suítes para Foundry, com boa cobertura de regras puras e cenários felizes.
    - **Problema:** A busca nos testes não mostrou casos que injetem falha entre débito e gravação de carta, nem dois pedidos simultâneos de dano do mesmo cartão. Esses casos expõem os achados 2, 3, 4 e 6.
    - **Correção:** Antes de refatorar cada fluxo, criar testes de caracterização com documentos reais ou dublês que falham no ponto crítico; depois adicionar os casos de concorrência e recuperação.
    - **Se ignorar:** Refatorações podem manter os exemplos simples e ainda quebrar recursos persistidos.

13. **Lint não executa** (`package.json:13`).
    - **O que é:** `npm run lint` deveria analisar `modules` e `systems` com ESLint 9.
    - **Problema:** A versão instalada exige `eslint.config.js/mjs/cjs`, mas não há arquivo de configuração; o comando para antes de analisar qualquer código.
    - **Correção:** Criar uma configuração mínima compatível com ESLint 9 para os arquivos reais, ou fixar versão e configuração anterior de forma explícita; testar `npm run lint` no repositório.
    - **Se ignorar:** Erros que a análise estática poderia achar passam sem verificação.

**Verdict:** Corrigir primeiro a rota genérica de dano e as operações que podem repetir ou perder alterações persistidas.

**Lean:** Há redução possível com remoção de wrappers e escapes duplicados; não estimei linhas nem dependências sem uma refatoração validada.

**Not checked:** Não executei o Foundry com jogadores reais, nem auditei manualmente cada um dos milhares de arquivos de regras e compêndios, assets, módulos de terceiros ou todos os scripts em `tools/` e `docs/macros/`. A revisão aprofundou entrada, combate/dano, rituais, habilidade de ameaça, arquitetura, documentação e testes. `npm run lang-check` e `npm run render-check` passaram; `npm test` ficou em 1.336/1.337. `npm run lint` foi tentado, mas não chegou a analisar código por falta de configuração.
