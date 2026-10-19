# Relatório de teste — Barra de macros automática

**Data:** 21/10/2026 · **Sistema:** Ordem Paranormal v2 Classic 8.0.2 no Foundry VTT 14 · **Spec:** `docs/arquivo/spec-hotbar-automatica.md`
**Prints:** `docs/relatorio-hotbar/` · **Roteiros:** `docs/macros/hotbar-automatica-live-*.js`

## Resumo

| Camada | Resultado |
|---|---|
| Testes unitários (`npm test`) | **1056 de 1056 passam** (inclui `tests/unit/hotbar-macros.test.mjs`) |
| `lang-check` e `render-check` | passam |
| Roteiros ao vivo por script (3 arquivos, 32 verificações) | **32 de 32 passam** |
| Passada pela interface, com dois navegadores (Mestre e jogador) e cliques reais | **passou**, com 1 defeito achado e corrigido (comando `/barra`) |

## Como foi testado

- **Dois navegadores ao mesmo tempo** (`playwright-cli`, sessões próprias): um **Mestre temporário** ("ZZ HB GM"), que vira o Mestre ativo e roda o código novo, e o jogador **QA1**, que vê a barra dele e clica nela.
- **Agente de teste** "ZZ HB relatório" (NEX 30, 20 PD) com arma, ritual, duas habilidades ativas, uma passiva e um equipamento. O jogador QA1 recebeu o agente como personagem durante o teste.
- Ações com **clique real** no navegador do jogador (menu da ficha, espaços da barra, botões −/+ do componente, arrastar e soltar, digitar no chat). Para criar e apagar itens usei a API, como o Mestre faria.
- Nada da mesa foi tocado: agentes, cena ativa, PD e macros do Geh ficaram como estavam.

## Resultados pela interface

| # | O que foi feito | Resultado |
|---|---|---|
| 1 | Com o preenchimento automático **desligado**, 6 itens na ficha | Barra do jogador **vazia** ([print 01](relatorio-hotbar/01-barra-vazia.png)) |
| 2 | Jogador abre a ficha → menu do cabeçalho → **"Preencher barra de macros"** (clique real) | 4 itens entram nos espaços 1 a 4; aviso "4 item(ns) adicionado(s)". Equipamento e habilidade passiva ficaram de fora ([print 02](relatorio-hotbar/02-apos-preencher.png)) |
| 3 | Preenchimento **ligado**; jogador clica no espaço da **habilidade** | Carta da habilidade no chat ([print 03](relatorio-hotbar/03-clique-habilidade.png)) |
| 4 | Jogador clica no espaço do **ritual** | Abre o fluxo rápido: "Gastar 1 PD e conjurar" ([print 04](relatorio-hotbar/04-clique-ritual.png)) |
| 5 | Clica em "Conjurar (1 PD)" | PD 20 → 19, carta do ritual com o teste de Ocultismo no chat ([print 05](relatorio-hotbar/05-ritual-conjurado.png)) |
| 6 | **Jogador** (outro cliente) muda habilidade passiva → ativa | O **Mestre** cria a macro: entra no espaço 5 |
| 7 | Jogador volta a habilidade para passiva | Macro some da barra |
| 8 | Jogador apaga o ritual | Espaço 3 fica **vazio**; os outros não andam |
| 9 | Mestre cria uma habilidade nova | Vai para o **buraco do espaço 3** |
| 10 | Macros nas páginas 2 e 3, modo **Automático** | 3 linhas aparecem ([print 06](relatorio-hotbar/06-automatico-3-linhas.png)) |
| 11 | Cliques no **+** do componente | Auto → 1 → 2 → 3; a barra cresce a cada clique; **+** desabilita no 3 ([print 07](relatorio-hotbar/07-duas-linhas.png), [print 08](relatorio-hotbar/08-tres-linhas.png)) |
| 12 | Clique num espaço da **linha extra** | Usa a macro |
| 13 | Arrastar com o mouse: linha extra → outra linha extra; linha extra → linha principal | Macro muda de lugar nos dois casos |
| 14 | Digitar `/barra` no chat | Preenche o que faltava (1 item). **Falhou na primeira tentativa** (ver defeitos) |

## Roteiros por script (API)

| Arquivo | O que cobre | Resultado |
|---|---|---|
| `hotbar-automatica-live-1-macros.js` | Arma/ritual/habilidade entram em 1-2-3; passiva, vazia e equipamento não; comando por id; passiva↔ativa; renomear; buraco reaproveitado; apagar ritual e habilidade; jogador tira a macro e ela não volta; configuração desligada; "Preencher barra" sem duplicar; apagar o agente | 13 de 13 |
| `hotbar-automatica-live-2-clique-cheia.js` | Clique na habilidade e no ritual; mover item entre agentes; macro órfã limpa; barra com 50 espaços cheios (um único aviso) | 5 de 5 |
| `hotbar-automatica-live-3-linhas.js` | Automático (1 a 3 linhas), componente −/+, páginas das linhas extras (inclusive ciclo 4 → 1,5), clique, arrastar entre linhas, soltar item da ficha, barra trancada, persistência | 14 de 14 |

Todos limpam o que criam e conferem que a barra voltou ao estado inicial.

## Defeitos achados

1. **`/barra` não funcionava no chat real (corrigido).** O campo de chat do Foundry 14 entrega o texto como `<p>/barra</p>`, e o comando comparava com `/barra` puro. Passei a remover as tags antes de comparar (`chat-commands.mjs`). Depois de recarregar a página, `/barra` preencheu a barra.
2. **Efeito colateral do teste:** o Git Bash converteu `/barra` em `C:/Program Files/Git/barra` e o chat postou esse texto como mensagem do QA1. Apaguei a mensagem. Foi erro do meu comando de teste, não do sistema.

## Achados fora desta funcionalidade (não mexi)

- **Os outros comandos de barra do chat, como `/dt`, mostram "não é um comando válido" neste mundo**, pelo mesmo motivo: o texto chega dentro de `<p>`. O módulo `character-chat-selector` está no caminho do envio, e o Foundry 14 usa um campo de chat novo. Vale conferir `/dt`, `/oposto`, `/grimório` e `/limpar-defesa` na mesa. A correção, se confirmada, é a mesma: tirar as tags antes de comparar.
- Erro no console do módulo `autoanimations` ("'data.id' is not a valid UUIDv4 string"). Não tem relação com a barra.

## O que este relatório não cobre

- **Mestre ativo real:** testei com um Mestre temporário. O "Mapa Maker" do Geh só passa a criar e remover macros depois de recarregar a página (F5), porque carrega o código antigo até lá.
- **Remoção de habilidade concedida por trilha:** usa o mesmo gancho de apagar item (coberto), mas não fiz um teste com trilha.
- **Tamanhos de tela menores** (modos `md`/`sm` do Foundry, em que a barra quebra em duas linhas de 5): o código copia a largura da barra, mas só testei em 1600×900.
- **Módulo Carolingian UI:** as linhas extras foram vistas com a barra aberta pelo mouse. O modo recolhido (barra escondida no pé) não foi fotografado.
- **Jogador com o agente aberto em dois navegadores ao mesmo tempo** e **vários jogadores no mesmo agente:** não testado.

## Limpeza

Agentes, macros, mensagens de chat e o Mestre temporário foram apagados. Conferido ao final: nenhum agente ou macro "ZZ", barra do QA1 vazia como no início, personagem do QA1 restaurado ("QA Agente 1"), preenchimento automático ligado.
