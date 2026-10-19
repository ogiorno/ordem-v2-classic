# Arquitetura do projeto — referência viva

Estado observado em 21/10/2026 no checkout local, incluindo arquivos ainda não commitados. Alvo: Foundry VTT 14.369, sistema `ordem_v2_classic`, mundo de desenvolvimento `nova-ordem`. Este documento descreve o que existe; a organização desejada está na [spec](spec-melhorias-arquitetura-e-testes.md).

## Mapa

| Parte | Responsabilidade atual | Entrada e saída |
| --- | --- | --- |
| `systems/ordem_v2_classic/system.json` | Manifesto do sistema, estilos e compêndios | Foundry carrega `module/ordemparanormal.mjs` |
| `module/ordemparanormal.mjs` | Bootstrap `init`, `setup`, `ready`, sockets, migrações e registros | `CONFIG`, hooks, documentos e serviços do Foundry |
| `module/data/` | `TypeDataModel` de agentes, ameaças e itens | Dados persistidos em `system` |
| `module/documents/` | Classes `Actor`, `Item`, `Combat`, `ChatMessage` | Ciclo de vida Foundry, rolagens, PV e mensagens |
| `module/sheets/`, `applications/`, `templates/`, `css/` | Fichas, diálogos e apresentação | Eventos de usuário → chamada de ações; estado → HTML |
| `module/helpers/*-rules.mjs` | Cálculos e decisões sem Foundry | Dados simples → resultado; testáveis em Node |
| `module/helpers/` demais | Orquestração e integração com documentos | Estado do mundo → atualização, efeitos, chat |
| `module/macros/` | Fluxos de ritual, área, habilidade de ameaça e ações de carta | Escolha → validação → custo → efeitos → registro |
| `module/integrations/` | Pontes com animações e outros módulos | Efeitos visuais, sem alterar resultado da regra |
| `packs/_source/` e `packs/` | JSON fonte e compêndios compilados | `npm run packs:pack` gera LevelDB |
| `tests/unit/` e `module/tests/suites/` | Testes Node e testes no Foundry | Regras puras e integração real |
| `scripts/`, `modules/`, `tools/` | Desenvolvimento, módulos auxiliares e conversores | Link, sync, packs, validações |
| `regras/` | Acervo extraído dos livros, com índice e páginas | Fonte de consulta, não fonte executável |

## Fluxos principais

1. **Inicialização:** o manifesto carrega a entrada; `init` registra modelos/classes/fichas/configurações; `ready` registra hooks, sockets e verifica migrações.
2. **Ataque:** item e ficha coletam opções; `attack-options-rules.mjs` decide modificadores; `OrdemItem` rola e publica cartões; aplicação de dano chega a `OrdemActor.applyDamage`, diretamente ou pelo cartão com processamento do Mestre.
3. **Ritual:** ficha ou macro seleciona forma/alvo/área; `ritual-caster-logic.mjs` calcula custo; `ritual-caster.mjs` valida, cobra PD, publica carta e pede ao Mestre para resolver efeitos; `ritual-area-engine.mjs` cuida das áreas.
4. **Ameaça:** ficha e item leem `execution`; `threat-ability-use.mjs` conduz confirmação, alvo, custo e painel; runners de dano, resistência, condições e gatilhos executam resultados.
5. **Progressão e perícias:** dados de agente e helpers de nível, treinamento e afinidade calculam estado; hooks e telas aplicam escolhas e concessões como itens/flags.
6. **Efeitos temporários:** hooks de combate, morte, ritual e habilidade observam turnos/cenas; o primeiro Mestre ativo executa alterações autoritativas quando aplicável.

## Pontos de acoplamento

- `ordemparanormal.mjs` conhece quase todos os domínios e concentra o roteamento de socket.
- `OrdemItem`, `OrdemActor` e `actor-sheet.mjs` conhecem regras de combate, documentos, UI e mensagens.
- `ritual-caster.mjs` reúne HTML, escolha de usuário, pagamento, teste, dano, efeito, animação, socket e estado da carta.
- Flags de `ChatMessage`, `Actor` e `Item` funcionam como estado persistido de fluxos; seus esquemas e transições ainda não estão reunidos em um contrato único.
- O estado do mundo vive no Foundry, não em um servidor próprio. Um teste Node de regra não comprova hooks, permissões, concorrência ou persistência em cena.

## Regras de arquitetura para mudanças futuras

1. **Caracterizar antes de editar:** para todo código de funcionalidade alterado, criar primeiro testes que registrem o comportamento atual, inclusive cancelamento, permissão, erro e persistência. Executá-los antes da mudança; manter o resultado como base de comparação.
2. **Separar decisão de efeito:** cálculos e autorização recebem dados explícitos e retornam plano/decisão. Atualização de documento, socket, chat e animação ficam na borda do Foundry.
3. **Uma entrada por regra de negócio:** manter uma implementação para cálculo de RD/dano, custo de ritual, treinamento, alcance e duração. Chamadas de diferentes telas e macros usam a mesma regra.
4. **Escrever com autoridade:** ações que afetam ficha alheia são validadas no cliente autoritativo a partir de documentos persistidos; nunca aceitar dano, custo, posse ou `userId` do payload como prova por si só.
5. **Persistência recuperável:** operações com várias gravações têm ID, estados explícitos e política de reenvio. Uma falha parcial não pode cobrar duas vezes, repetir dano ou apagar o estado anterior sem recuperação.
6. **UI não decide regra:** fichas e cartas coletam opções e exibem resultados. Não devem duplicar cálculos escondidos em handlers de clique ou templates.
7. **Integrações são opcionais:** Sequencer/JB2A/Automated Animations e módulos visuais não mudam custo, resultado ou dano. Falha visual não invalida a regra já resolvida.
8. **Sem camadas vazias:** extrair módulo quando ele concentra uma responsabilidade real, não para reduzir apenas o tamanho de um arquivo. Preferir função simples a interface ou factory com uma implementação.
9. **Fontes separadas:** regras publicadas em `regras/` e dados em `packs/_source/`; `regras/rascunhos/` continua sem importação automática. Conferir PDF quando a extração for ambígua.
10. **Validação por nível:** teste Node para regras puras; teste de integração no Foundry para documentos, hooks, permissões, socket e cenas; verificação humana para fluxo visual e decisões do Mestre.

## Como manter esta referência

Em toda mudança de domínio, atualizar este mapa se a responsabilidade ou caminho mudar e atualizar [regras de negócio](regras-de-negocio-projeto.md) quando o comportamento confirmado mudar. `AGENTS.md` e `CLAUDE.md` têm orientações de ambiente; specs de domínio em `docs/` detalham decisões existentes. O README do sistema contém comandos obsoletos; use `package.json` até a tarefa de documentação da spec ser concluída.
