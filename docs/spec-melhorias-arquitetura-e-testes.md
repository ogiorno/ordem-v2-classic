# Spec — organização do código, segurança e testes

**Estado:** proposta para execução em tarefas pequenas. **Base:** auditoria do checkout de 21/10/2026. **Objetivo:** preservar o comportamento confirmado da mesa, corrigir falhas de autorização e persistência, reduzir duplicação e tornar cada domínio testável. Esta spec não autoriza alterar regras do livro por conveniência técnica.

## Processo obrigatório para toda mudança funcional

1. Registrar o estado inicial (`git status`, commit base e arquivos locais afetados); nunca sobrescrever alterações do usuário.
2. Ler `AGENTS.md`, `CLAUDE.md`, a spec do domínio, o helper/caller atual, testes existentes e a regra em `regras/`. Quando houver ambiguidade da extração, conferir PDF.
3. **Antes de editar o código funcional, escrever e executar testes de caracterização** que mostrem como a funcionalidade opera hoje: entrada normal, cancelamento, permissão, limite e persistência. Se um teste revelar bug, registrar o resultado atual e criar expectativa corrigida separada; não tratar o bug como contrato desejado.
4. Fazer a menor mudança que resolve a tarefa. Remover duplicação somente depois de demonstrar equivalência das chamadas; não criar abstração para um único uso.
5. Rodar testes focados, suíte Node, verificações de idioma/renderização e testes no Foundry quando houver documentos, socket, hooks, cena ou UI. Um teste sintético não substitui interação real de GM e jogador.
6. Atualizar `arquitetura-projeto.md`, `regras-de-negocio-projeto.md` e documentação de domínio se responsabilidades ou comportamento mudarem. Relatar testes, resultado, limites e migração de dados.

## Contratos de arquitetura

- **Dependência:** ficha, carta e macro chamam casos de uso; casos de uso chamam regras puras e um adaptador Foundry. Regras puras não importam `game`, `canvas`, `ui`, `Hooks` ou classes de documento.
- **Regra única:** custo, alcance, resistência, dano/RD, progressão e permissão têm uma função fonte e testes. Não copiar cálculos para sheet ou template.
- **Autoridade:** o Mestre que executa revalida ID de documento, relação item–ator, posse do solicitante, estado da operação e limites. Não confiar em `userId`, `amount`, `damageType`, custo ou alvo vindos somente do socket.
- **Estado persistido:** cada operação crítica tem identificador estável e estados explícitos (`planned`, `charged`, `applied`, `resolved` ou equivalentes). Reenvio idêntico devolve resultado já registrado, sem aplicar de novo. Definir recuperação para falha entre escritas.
- **Controle de efeitos:** som/animação vêm depois da decisão mecânica. Falha de integração visual fica isolada.
- **Dados:** modificar `TypeDataModel` exige migração compatível, teste com dado antigo e inspeção no Foundry. `packs/_source` é a fonte de compêndios; rascunhos não são importados.
- **Segredo:** flags visíveis a jogadores não guardam PV/RD/Defesa secretos; testar como observador, dono e GM.

## Tarefas fechadas, em ordem

### T01 — Alinhar documentação e comandos

**Arquivos:** `systems/ordem-v2-classic/README.md`, `package.json`, configuração ESLint e `CLAUDE.md` se necessário. **Antes:** checar scripts existentes e executar os comandos de validação atuais. **Mudança:** corrigir comandos inexistentes, descrever Node Test Runner e `module/tests/suites`, diferenciar build de pack e sincronização; criar configuração ESLint 9 mínima para o comando de lint. **Aceite:** todos os comandos publicados existem; `npm test`, `npm run lang-check`, `npm run render-check` e `npm run lint` executam; instrução de teste Foundry reproduzível. Sem alteração funcional.

### T02 — Fechar rota genérica de dano remoto

**Arquivos:** `module/documents/actor.mjs`, `module/ordemparanormal.mjs`, chamadores e testes. **Antes:** testar chamada legítima a alvo não possuído e payload com `userId`, valor e opções trocados, registrando o comportamento atual. **Mudança:** substituir `applyDamage` remoto por pedido que referencia ação/mensagem persistida e cujo valor seja reconstituído pelo Mestre; se não houver contexto verificável, manter resolução manual pelo Mestre. **Aceite:** nenhum pedido forjado altera PV; caso legítimo é aplicado uma vez; não há regressão em RD/dano massivo. **Teste Foundry:** GM e jogador em clientes distintos.

### T03 — Garantir aplicação única do dano de cartão

**Arquivos:** `module/helpers/card-damage.mjs`, handler `applyCardDamage`, testes. **Antes:** teste de caracterização para um clique, desfazer e segundo clique; reproduzir duas chamadas simultâneas e falha ao gravar flag. **Mudança:** serializar por mensagem no cliente autoritativo e persistir progresso recuperável. **Aceite:** dois pedidos geram uma redução de PV e uma marcação; falha intermediária não reaplica dano; desfazer continua sujeito à janela e ao PV inalterado.

### T04 — Tornar conjuração recuperável

**Arquivos:** `module/macros/ritual-caster.mjs`, helper de custo/catalisador, testes. **Antes:** caracterizar cancelamento antes do débito, saldo insuficiente, forma, alvo/área, pagamento, carta pendente e catalisador. **Mudança:** planejar antes de escrever; registrar estados de pagamento, consumo e carta; definir compensação ou recuperação por falha parcial. **Aceite:** cada conjuração cobra PD e catalisador no máximo uma vez, e sempre deixa um estado rastreável. **Teste Foundry:** falha simulada após débito e área cancelada.

### T05 — Resolver efeitos de ritual por etapa

**Arquivos:** `ritual-caster.mjs`, `ritual-area-engine.mjs`, testes. **Antes:** caracterizar resistência, dano/cura, condição, área e carta final para um e vários alvos. **Mudança:** registrar efeito concluído por alvo e operação; reenvio retoma só o que falta. **Aceite:** falha após primeiro alvo e reenvio não repetem o primeiro efeito; estado final e carta concordam. **Teste Foundry:** dois clientes e falha induzida.

### T06 — Troca segura de alvo e encerramento de ritual

**Arquivos:** `ritual-caster.mjs`, `weapon-curse-runtime.mjs`, testes. **Antes:** caracterizar troca válida, alvo fora de alcance, efeito usado, falha na criação. **Mudança:** criar e verificar o novo efeito antes de retirar o anterior; registrar transição e compensar falha de mensagem. **Aceite:** troca malsucedida preserva o efeito antigo; troca bem-sucedida deixa exatamente um alvo ativo; permissões são revalidadas no Mestre.

### T07 — Persistir custo e painel de habilidade de ameaça com recuperação

**Arquivos:** `threat-ability-use.mjs`, `threat-ability-panel-runner.mjs`, gatilhos e testes. **Antes:** caracterizar cancelamentos, custo, área, alvo, requisito, painel e execução delegada. **Mudança:** planejar painel antes do débito, identificar uso, persistir fases e recuperação. **Aceite:** falha entre débito e painel não deixa custo órfão; repetição não dispara habilidade duas vezes. **Teste Foundry:** GM e jogador, incluindo pedido duplicado.

### T08 — Extrair handlers de socket por domínio

**Arquivos:** `ordemparanormal.mjs` e módulos pequenos de `combat`, `ritual`, `death`, `threat`. **Antes:** testes de caracterização para cada `data.type`, com autorizado, negado, documento inexistente e primeiro Mestre ativo. **Mudança:** mover roteamento sem alterar payload público até T02/T03 migrar as rotas afetadas; manter bootstrap apenas como registro. **Aceite:** nenhum handler duplicado; cada pedido tem validação local e testes; ordem de `init/setup/ready` preservada.

### T09 — Consolidar apresentação e visibilidade

**Arquivos:** escapes locais, wrappers `_damageRecipients`, templates e testes. **Antes:** caracterizar HTML gerado com nomes contendo `<`, `&`, aspas e destinatários GM/dono/observador. **Mudança:** usar escape da plataforma na borda HTML, remover cópias idênticas e chamar helper de destinatários diretamente. **Aceite:** saída visual equivalente para texto normal, texto especial escapado, sem vazamento de PV/Defesa.

### T10 — Separar responsabilidades dos documentos e fichas

**Arquivos:** `documents/item.mjs`, `documents/actor.mjs`, `sheets/actor-sheet.mjs`, `sheets/threat-sheet.mjs`. **Antes:** selecionar um fluxo por vez e registrar teste que vai do clique ao documento alterado. **Mudança:** deslocar decisões e orquestração que se repetem para casos de uso de domínio; manter nas classes os métodos exigidos pelo Foundry e na ficha apenas coleta/exibição. **Aceite:** regra de ataque, dano e habilidade tem um ponto de decisão; ficha e item produzem o mesmo resultado de antes. Não dividir arquivo só pelo número de linhas.

### T11 — Corrigir qualidade da suíte e ampliar falhas reais

**Arquivos:** `tests/unit/grimoire-search.test.mjs`, testes Node e `module/tests/suites/`. **Antes:** registrar falha atual do limite de 50 ms e medir benchmark isolado. **Mudança:** retirar tempo de parede da suíte funcional; acrescentar testes de concorrência, permissão, migração, falha parcial e recuperação nas tarefas T02–T10. **Aceite:** suíte funcional confiável; benchmark separado com ambiente e critério documentados; limpeza de fixtures do Foundry entre execuções.

### T12 — Inventário de código e dependências para remoção

**Arquivos:** módulos, scripts, templates e manifestos. **Antes:** para cada candidato, pesquisar import, referência dinâmica, template, flag, compêndio, teste e configuração. **Mudança:** remover apenas código sem consumidor demonstrado e wrappers triviais com equivalência testada. **Aceite:** `npm test`, verificações de render/idioma e smoke test Foundry passam; relatar arquivos e linhas realmente removidos. Não há meta inventada de linhas.

## Gates de conclusão do programa

1. Nenhuma operação remota aceita valor mecânico ou identidade autodeclarada como única prova.
2. Dano, PD, custo de habilidade e efeitos mantêm idempotência e recuperação após falha em cada fronteira de gravação.
3. Tests de caracterização anteriores à edição estão no histórico de cada tarefa; casos corrigidos passam depois da mudança.
4. Testes Node, renderização, idioma e integração Foundry passam no escopo alterado; avaliação humana cobre o fluxo visual afetado.
5. Documentos de arquitetura e regras refletem o código entregue; divergência de regra do livro tem tarefa separada e fonte de página.
