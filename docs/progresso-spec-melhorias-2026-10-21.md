# Execução da spec — 21/10/2026

Base: `C:\Users\Geh\VTT\foundry-dev`, checkout `deeccdd` com alterações locais pré-existentes preservadas. Este registro distingue implementação, teste Node e verificação no Foundry.

| Tarefa | Estado | Feito e evidência | Falta |
| --- | --- | --- | --- |
| T01 Documentação e comandos | Implementada | README usa scripts reais; configuração mínima de ESLint 9; `npm run lint`, `lang-check` e `render-check` passam. Teste tautológico de treinamento passou a exigir `6` de verdade. | Revisar README completo em tarefa editorial separada. |
| T02 Rota genérica de dano | Implementada com resolução manual para áreas de jogador | Removido `applyDamage` remoto que aceitava valor do payload. `OrdemActor.applyDamage` não altera alvo sem posse; cartão de dano continua pelo fluxo validado. Handlers de socket usam o ID autenticado fornecido pelo Foundry, inclusive rituais, teste oposto, habilidade de ameaça e hotbar. Teste em dois navegadores mostrou ID real diferente do `userId` forjado; teste unitário de autorização primeiro falhou e depois passou. | Teste de integração com GM e jogador em ação real. Armas de área usadas por jogador deixam alvos extras para o Mestre resolver manualmente até existir fluxo automático com prova persistida. |
| T03 Dano de cartão único | Implementada no cliente autoritativo | Dois pedidos simultâneos e reenvio após falha da flag foram reproduzidos em testes antes da mudança. Agora há controle por mensagem e flag `damagePending`; falha incerta bloqueia nova aplicação automática. O botão legado do item usa o mesmo helper. Quatro testes focados passam. | Exercitar clique real de GM/jogador no Foundry e falhas entre gravações com documentos reais. O controle em memória pressupõe um GM autoritativo, como definido na auditoria. |
| T11 Teste de busca instável | Implementada para o teste de tempo | A asserção de 50 ms falhou na auditoria; a suíte agora verifica a resposta em 600 entradas. Medição isolada em `scripts/benchmark-grimoire-search.mjs` mostrou mediana de 34,3 ms em 15 amostras no Node 22.23.2, sem tornar tempo de parede critério de aprovação. A busca foi verificada também no navegador. | Definir ambiente fixo e limite de desempenho somente se houver requisito real de produto. |
| T04–T10, T12 | Pendentes | Nenhuma alteração funcional nesses domínios foi iniciada. | Seguir a ordem da spec: testes de caracterização antes de modificar cada fluxo; depois Playwright e validação real conforme domínio. |

## Validação desta rodada

- `npm test`: 1.342 testes passaram, 0 falhas após T11.
- `npm run lint`, `npm run lang-check` e `npm run render-check`: passaram.
- `playwright-cli`: mundo `nova-ordem` abriu como QA1/QA2 no Foundry 14.369; verificados sistema carregado, API do socket entre dois clientes, rejeição de ID forjado pelo helper, carregamento do código novo, ausência de envio genérico de dano e resultado da busca em 600 entradas. Nenhum PV ou recurso de personagem real foi alterado nesses testes.
- O Playwright desta rodada **não validou cliques mecânicos com um GM**: Gamemaster e QA GM já estavam conectados em outras sessões. Não tomar controle dessas sessões preservou o trabalho em andamento no mundo.

## Próximo bloco

T04: caracterizar cobrança de PD, catalisador, carta pendente e falhas de gravação; implementar recuperação sem duplicar pagamento. Em seguida T05 (efeitos por alvo) e T06 (troca segura de alvo), com teste Node antes de cada mudança e teste no Foundry via `playwright-cli` após cada etapa.

### Diagnóstico inicial de T04 (sem mudança funcional nesta rodada)

Em `resolveCast`, as escolhas de forma, alvo e área são feitas antes do débito. Depois, a ordem atual é: `spendPd`, `consumeCatalyst` (quando aplicável), testes do conjurador e criação da carta. Não há identificador persistido da conjuração entre essas escritas. Se o consumo, a rolagem ou a criação da carta falhar após o débito, o código não tem como distinguir uma nova tentativa de uma continuação; repetir a ação pode cobrar novamente. Os testes de T04 devem injetar falha em cada uma dessas fronteiras e provar a recuperação antes de modificar a sequência.
