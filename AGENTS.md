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
