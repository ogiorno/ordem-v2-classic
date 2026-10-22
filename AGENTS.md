# Orientações para agentes — Ordem Paranormal no Foundry

Este projeto usa Foundry VTT 14.369, o sistema `ordem_v2_classic` e o mundo `nova-ordem`. Leia também `CLAUDE.md` e as specs em `docs/` antes de alterar o sistema. Preserve alterações locais do usuário.

## Preferência por módulos instalados

Antes de criar código próprio para uma função coberta abaixo, confira se o módulo está ativo no mundo e se a API dele atende ao caso. Prefira a função do módulo, adaptando apenas a integração com Ordem Paranormal. Não substitua regras do sistema, valores da ficha, custo em PD ou escolhas do jogador por conveniências do módulo. Teste no Foundry 14 e evite efeitos duplicados entre módulos.

| Necessidade | Módulo ativo (ID) | Uso preferencial neste projeto |
| --- | --- | --- |
| Buscar fichas, itens e documentos | Quick Insert – Search Widget (`quick-insert`) | Busca global antes de implementar outro buscador. |
| Abrir cenas e handouts rapidamente | Quick Scenes & Handouts (`quick-scenes`) | Atalhos para cenas e diários existentes. |
| Sorteio de tokens | Wheel Of Destiny (`wheel-of-destiny`) | Seleção aleatória visível em cena. |
| Dados tridimensionais | Dice So Nice! (`dice-so-nice`) | Visual das rolagens; não alterar resultados. |
| Digitação rápida de dados | Dice Tray (`dice-calculator`) | Bandeja de dados no chat. |
| Aparência personalizada dos dados | Lordu's Custom Dice (`lordudice`) | Temas do Dice So Nice. |
| Melhorias gerais de combate e UI | Monk's Little Details (`monks-little-details`) | Utilitários de combate sem recriar as mesmas ações. |
| Identificar personagem na conversa | Character Chat Selector (`character-chat-selector`) | Escolha de personagem para mensagens. |
| Texto narrado | Narrator Tools (`narrator-tools`) | Apresentação de narração no chat. |
| Interface do Foundry | Carolingian UI (`crlngn-ui`) | Estilo geral; preservar legibilidade das fichas e da macro. |
| Ajustes visuais próprios | Custom CSS (`custom-css`) | CSS do mundo apenas quando não couber no CSS do sistema. |
| Sequências de vídeo e som | Sequencer (`sequencer`) | Motor principal de efeitos temporizados. |
| Biblioteca gratuita de efeitos | JB2A Free (`JB2A_DnD5e`) | Assets de animação, inclusive rituais. |
| Animações por item/ritual | Automated Animations (`autoanimations`) | Reconhecimento por nome e execução; integrar à macro quando o sistema não disparar o módulo sozinho. |
| Editor de animações gratuito | BLFX Assets & Animation Editor Free (`boss-loot-assets-free`) | Montagem visual de VFX reutilizáveis. |
| Filtros visuais de token | Token Magic FX (`tokenmagic`) | Estados visuais quando apropriados. |
| Criação de imagens de token | Tokenizer (`vtta-tokenizer`) | Enquadramento e edição de tokens. |
| Clima e partículas de cena | Gambit's FXMaster (`fxmaster`) | Efeitos ambientais; não ligar efeitos globais sem necessidade da cena. |
| Companheiros e invocações | Automated Evocations – Companion Manager (`automated-evocations`) | Fluxo de invocação onde houver ficha correspondente. |
| Luz portátil | Torch (`torch`) | Ações de iluminação de tokens. |
| Variações de fundo | Scenery (`scenery`) | Troca de imagem de fundo da cena. |
| Andares e elevação | Levels (`levels`) | Compatibilidade de cenas existentes; em V14 priorizar Scene Levels nativo para cenas novas. |
| Edição de paredes | Monk's Wall Enhancement (`monks-wall-enhancement`) | Ferramentas de construção de paredes e portas. |
| Áudio ampliado | Enhanced Audio Resources (`ear`) | Recursos de som de cenas e playlists. |
| Importação de compêndios | Mana's Compendium Importer (`mkah-compendium-importer`) | Importação quando o formato for compatível; conferir dados após importar. |
| Arrastar conteúdo | DFreds Droppables (`dfreds-droppables`) | Aplicar conteúdo por soltar em cena/ficha, após verificar efeitos. |
| Inspecionar permissões | Ownership Viewer (`permission_viewer`) | Verificar visibilidade para jogadores. |

Dependências ativas: `socketlib` e `lib-wrapper`; `portal-lib` é a dependência `Portal` do Automated Evocations. Não desative uma dependência enquanto o módulo consumidor estiver ativo.

Instalação e ativação conferidas em 17/10/2026. Os módulos sem ajuste específico usam as configurações iniciais do autor; configure valores de cena, personagem ou usuário quando houver uma necessidade concreta. O manifesto do Tokenizer 5.0.3 indica verificação até Foundry 13, embora ele tenha carregado no mundo v14: valide o fluxo de criação de token antes de depender dele. Levels 7.0.3 avisa que seus recursos migraram para Scene Levels nativo do Foundry 14; mantenha o módulo para compatibilidade de cenas antigas.

## Configuração de animação dos rituais

O sistema mantém um mapa específico para os 98 rituais da biblioteca em `systems/ordem_v2_classic/module/macros/ritual-animation-map.json`. Cada ritual tem um arquivo JB2A Free em `modules/JB2A_DnD5e/Library/Generic/`, com matiz definida pela afinidade. Em `aa.initialize`, `module/integrations/ritual-animations.mjs` mescla esses registros no reconhecimento **On Token** do Automated Animations, preserva outras animações e migra o registro legado de Eletrocussão.

A macro `module/macros/ritual-caster.mjs` dispara `aa.workflow` depois de resolver uma conjuração não interrompida. A animação é uma representação visual da conjuração sobre o token do conjurador; não cobra PD, não rola dados e não aplica dano/condições novamente. O token do conjurador precisa estar na cena; escolher um alvo é opcional. Ao atualizar o mapa, confirme que todos os caminhos JB2A existem e mantenha cada animação coerente com o elemento e o texto do ritual.

## Regras do jogo (fonte de consulta)

As regras de Ordem Paranormal RPG v1.3 estão extraídas em `regras/`. Consulte essa pasta antes de afirmar, implementar ou alterar qualquer regra; não responda de memória.

- Comece por `regras/INDICE.md` e `regras/LEIA-ME.md`. Capítulos: `01-introducao` a `10-apendice` (livro básico, um arquivo por regra, com a página do PDF) e `11-sobrevivendo-ao-horror/` (suplemento: origens, habilidades, poderes, equipamentos, itens amaldiçoados, rituais; índice próprio em `11-sobrevivendo-ao-horror/INDICE.md`).
- A ficha mais recente é `regras/02-criacao-de-personagem/FICHA-DE-AGENTE-ATUALIZADA.md` (Sobrevivendo ao Horror v1.3).
- Os arquivos de contexto linkam seus subitens; ao aplicar uma regra isolada, leia também o contexto indicado. Tabelas ficam em blocos de código; o símbolo do dado aparece como `d20` (`+d20` = um dado adicional).
- A extração é automática e não foi revisada à mão: em dúvida sobre tabela, coluna ou texto sobre ilustração, confira no PDF (`_referencia-por-pagina/`, `VERIFICACAO.md`, `MANIFESTO.json`).
- PDFs originais: `D:\[LIVROS]\[RPG]\[ORDEM-PARANORMAL]\` (Livro de Regras v1-3 e Sobrevivendo ao Horror v1-3). São grandes demais para leitura direta; use PyMuPDF (`tools/sah/pdf_extract.py` lê na ordem certa das colunas e marca o dado como `[d]`).
- Não edite `regras/` para "corrigir" regra por conveniência do código; o código segue o livro, não o contrário.
- `regras/` não vai para o GitHub (direitos de terceiros): `npm test` e o CI não podem depender dela. Testes que conferem o código contra o texto do livro ficam em `systems/ordem_v2_classic/tests/livro/` (`*.livro.mjs`) e rodam com `npm run test:livro`; rode-os antes de mudar regras.

## Publicação no GitHub (push e tags de versão)

Repositório: `https://github.com/ogiorno/ordem-v2-classic` (remoto `origin`, branch `master`). O workflow `.github/workflows/release.yml` publica uma release (`system.json` + `system.zip`) quando uma tag `v*` é enviada; é essa release que o Foundry usa para instalar e atualizar o sistema. A numeração é semântica e começa na `v1.0.0`.

Só dê push quando o usuário pedir. Sempre que for dar push, antes disso:

1. Rode `npm test`, `npm run lang-check` e `npm run render-check`; não envie com falha.
2. Veja a última tag (`git describe --tags --abbrev=0`; se não houver, a primeira é `v1.0.0`) e analise o que mudou desde ela (`git log <tag>..HEAD` e `git diff --stat <tag>..HEAD`), olhando só o que vai no zip do sistema (`systems/ordem_v2_classic`, exceto `tests/`, `tools/` e `packs/_source/`).
3. Escolha a tag pelo impacto:
   - **major** (`v2.0.0`): quebra de compatibilidade, mudança de `id` do sistema, migração obrigatória de dados de mundos ou remoção de funcionalidade;
   - **minor** (`v1.1.0`): funcionalidade ou conteúdo novo (regras, fichas, compêndios, telas) que não quebra o que existia;
   - **patch** (`v1.0.1`): correção de bug ou ajuste pequeno, sem funcionalidade nova;
   - **sem tag**: só mudou documentação, specs, testes, `tools/`, `scripts/` ou `docs/`; faça o push da `master` e não crie release.
4. Se for criar tag: atualize `version` em `systems/ordem_v2_classic/system.json` (e o `download` com a nova tag) e acrescente a entrada no `CHANGELOG.md`; faça o commit; confirme que a versão do `system.json` é igual à tag sem o `v`; crie a tag anotada (`git tag -a vX.Y.Z -m "..."`).
5. Diga ao usuário qual tag escolheu e por quê (uma frase), e envie `master` e a tag juntas (`git push origin master vX.Y.Z`). Nunca reutilize, mova ou apague uma tag já publicada: corrija com uma nova versão patch.
6. Depois do push, confira se o workflow *Release* terminou com sucesso e se a release tem `system.json` e `system.zip`.

Antes do primeiro push público, conferir `regras/` e `docs/arquivo` (texto dos livros, com direitos de terceiros) e o e-mail dos commits.
