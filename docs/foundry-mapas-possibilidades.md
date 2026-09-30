# Foundry VTT: tudo que dá para fazer em um mapa (Cena)

Referência para o "Mapa Maker". No Foundry, um mapa é uma **Cena** (`Scene`). Escrito para o Foundry v14 (build 369).
Itens marcados com (v14?) mudaram ou são novos nas últimas versões; confira na interface antes de depender deles.

## 1. A Cena em si

| Recurso | O que faz |
|---|---|
| Imagem de fundo | Imagem (png, jpg, webp) ou **vídeo** (webm, mp4) animado como mapa. |
| Imagem de primeiro plano | Camada acima dos tokens (copas de árvore, tetos). Pode ter elevação própria. |
| Tamanho e preenchimento | Largura e altura, mais **padding** (margem em volta do mapa). |
| Cor de fundo | Cor atrás do mapa e do padding. |
| Offset e escala da imagem | Ajusta o mapa à grade sem recortar. |
| Posição inicial da câmera | Foco e zoom iniciais ao abrir a cena. |
| Navegação | A cena aparece na barra de cenas (nome, ordem, pasta). |
| Pastas, ordem, anotações | Organização na barra lateral; notas só do GM. |
| Ativar, ver, desativar | **Ativar** (todos veem), **Ver** (só o GM edita), **Configurar**. |
| Ambiente | Ver seção 7 (luz global, escuridão, clima). |

## 2. Grade

- **Tipo:** sem grade, quadrada, hexagonal (4 orientações: linhas/colunas, pares/ímpares) e, em versões novas, isométrica (v14?).
- **Tamanho** em pixels, **distância** (ex.: 1,5) e **unidade** (m, ft, quadrados).
- **Cor, opacidade, espessura** das linhas.
- **Alinhar o mapa à grade** (ferramenta de ajuste visual).
- **Medição de distância** (régua): linha, cone, círculo, retângulo e raio, seguindo a regra do sistema (diagonal 1/1, 5/10/5 etc.).
- **Snap** de tokens, desenhos e paredes à grade.

## 3. Camadas e ferramentas

Cada camada tem a sua barra de ferramentas (menu à esquerda):

1. **Tokens** (criaturas e objetos que se movem)
2. **Ladrilhos** (Tiles)
3. **Desenhos** (Drawings)
4. **Paredes**
5. **Luzes**
6. **Sons ambientes**
7. **Regiões** (Regions)
8. **Notas** (Notes)
9. **Réguas e modelos de área** (Measured Templates)
10. **Controles da cena** (reiniciar fog, etc.)

## 4. Paredes, portas e janelas

- **Tipos de parede:**
  - **normal**: bloqueia movimento, visão e luz;
  - **invisível**: bloqueia só a visão;
  - **terreno** (parede de terreno): bloqueia visão à distância;
  - **janela**: deixa luz e visão passarem por uma direção;
  - **etérea**: bloqueia visão mas não movimento.
- **Portas:** porta normal e secreta (só o GM vê), com estado **fechada, aberta ou trancada**. Som de abrir/fechar configurável.
- **Direção:** a parede pode bloquear só de um lado.
- **Limite de luz, visão, som e movimento** configuráveis por parede (os "tipos de bloqueio").
- **Altura** da parede (v14?): ver o item de elevação mais abaixo.
- **Ferramentas de desenho:** linha, cadeia (várias paredes ligadas), retângulo, círculo, poligonal.
- **Clonar, copiar e colar** conjuntos de paredes entre cenas.
- Importar paredes automaticamente: módulos como **Universal Battlemap Importer** (aceita `.dd2vtt`) e **Dungeon Alchemist**.

## 5. Tokens

- **Retrato e imagem do token** (png, webp, vídeo; o mesmo ator pode ter vários).
- **Anel dinâmico do token (Dynamic Token Ring):** moldura com cor e efeito por disposição.
- **Tamanho** em quadrados, escala e rotação da imagem.
- **Disposição:** amigável, neutro, hostil, secreto.
- **Barras de recurso** (2) e **nomes** (visibilidade por nível de acesso).
- **Visão:** sentidos por token (visão no escuro, raio, ângulo).
- **Auras e luz emitida** pelo token (lanterna, tocha, aura mágica).
- **Detecção:** modos de visão e **detecção de sentidos** (ver invisível, sentir movimento etc.).
- **Elevação** (altura do token).
- **Efeitos de status** como ícones sobre o token.
- **Texto flutuante** (dano, cura) e **animações** de movimento.
- **Token ligado ou não ligado ao ator** (o dado do ator é compartilhado ou único por cena).
- Mover por **caminho/rota** e **medida de deslocamento** com o custo do terreno (v14?).
- **Agrupar e trancar** tokens para não mexer sem querer.

## 6. Ladrilhos (Tiles)

- Imagens ou vídeos posicionados no mapa (móveis, tapetes, tetos, efeitos animados).
- **Acima ou abaixo** dos tokens.
- **Ocultável pelo GM**, com opacidade e tonalização.
- **Ocultar em tempo real**: o ladrilho some quando o token entra (útil para tetos).
- **Rotação, escala, trava de proporção**, cantos.
- **Restrições**: o ladrilho só ao alcance da luz, ou invisível para quem não vê a região.
- Funciona como **ladrilho de oclusão** (some quando um token se aproxima) — "oclusão por rádio" ou "por fade".
- Módulo **Monk's Active Tile Triggers** e **Tagger** acrescentam gatilhos (ao pisar, abre porta, toca som).

## 7. Iluminação, visão e névoa

- **Luzes:** cor, intensidade, alcance brilhante e fraco, ângulo, **animações** (chama, pulso, tempestade, onda etc.), **coloração**, saturação, contraste e "escuridão".
- **Luz da cena** (global) e **nível de escuridão** (ciclo dia/noite): a escuridão afeta quem enxerga com luz.
- **Névoa de guerra (Fog of War):** revela por visão do token e **memoriza o que já foi explorado**.
- **Visão do jogador:** só o que o token vê; ou **modo do GM** (vê tudo).
- **Esconder no escuro** (luz fraca vs forte).
- **Efeitos de clima** (chuva, neve, neblina, folhas, estrelas) e **fundos** (v14?).
- **Camadas de iluminação** por região ou ladrilho (v14?).
- **Teletransporte**, pontos de luz que **seguem** um token, luzes com **restrição de visibilidade**.

## 8. Regiões (Regions)

Área do mapa (retângulo, círculo, polígono, elipse, ou formas combinadas) com **comportamentos** (Region Behaviors) disparados ao entrar, sair, passar ou morrer:

- **Teletransporte** de token entre cenas ou dentro da cena.
- **Alterar nível de elevação**, **terreno difícil**, **efeito de status**, **rolar tabela**, **executar macro**, **mostrar texto**, **pausar o jogo**.
- **Suprimir clima**, **mudar a escuridão** ou **a iluminação** só ali.
- **Subcenas / níveis** (v14?): andares e escadas ligam regiões de elevação diferentes.

## 9. Desenhos e modelos de área

- **Desenhos:** retângulo, círculo, elipse, polígono, linha livre e texto (com fonte, cor, preenchimento e borda). Podem ficar visíveis só para o GM.
- **Modelos de área** (Measured Templates): círculo, cone, raio, linha e retângulo, com cor, textura e dano associados. O sistema pode ligar o modelo a magias (aplica efeito a tokens dentro).
- Medição que se **alinha à grade** e conta o raio pela regra do sistema.

## 10. Sons e música

- **Som ambiente:** posição, raio, **com ou sem paredes** (ouvir através da parede), **fade** e loop.
- **Playlists:** música de fundo da cena, passa ao ativar.
- **Playlists e sons:** atalho para tocar um som ao entrar numa região.

## 11. Notas (Pins) e Journal

- **Pino** no mapa ligado a uma **entrada de Journal** (texto, imagem, pdf).
- Ícone, tamanho, cor, mostrar sempre ou só em zoom, visível só ao GM, **ao clicar abre a página**.
- Dá para organizar um **mapa de regiões** (cidade → bairros) por pinos.

## 12. Efeitos, partículas e animação (core)

- **Clima**, partículas e **filtros de cor** (via Pixi, módulos).
- **Vídeo** como fundo e ladrilho animado.
- **Transições** entre cenas, **destaque de pontos** (ping) e **movimento de câmera** pelo GM.
- **Pan e zoom** da câmera forçados para todos.

## 13. Interação dos jogadores

- **Ping** (mostrar um ponto), **ping de atenção** e **desenhar** em tempo real.
- **Medir** distância, **selecionar vários tokens**, **ver a cena mesmo sem token**.
- **Visão compartilhada** entre tokens do mesmo jogador, **controle de cada token pelo dono**.

## 14. Permissões e visibilidade

- Cada token, ladrilho, nota e desenho tem **nível de visibilidade** (todos, só GM, dono).
- **Cena ativa** (a que todos veem) vs. cenas só do GM.
- **Níveis de acesso** por jogador para editar tokens, desenhos etc. (configurável pelo mundo).

## 15. Importação e criação de mapas

- **Importar a imagem** (arrastar para a cena) e escolher a grade.
- **Importadores**: `.dd2vtt` (Dungeondraft), `.uvtt`, Dungeon Alchemist, Foundry Map Importer.
- Criar mapas **em programas externos** (Dungeondraft, Wonderdraft, Inkarnate, DungeonFog, Dungeon Scrawl, Dungeon Alchemist, Tiled) e subir.
- **Gerador procedural** via módulo (ex.: Dungeon Generator, Mappa).
- Cena **duplicada** (modelo) para variações (dia/noite, aberto/fechado).

## 16. Automação e scripts

- **Macros** em JavaScript: criar cena, tokens, paredes, luzes, regiões por código (`Scene.create`, `canvas.scene.createEmbeddedDocuments("Wall", [...])`).
- **Hooks**: `canvasReady`, `updateToken`, `lightingRefresh` etc.
- **Módulos próprios** (como o `dev-reload` e `meu-modulo` deste workspace) para ferramentas de mapa.
- Atualizar via API: `canvas.scene.update({ ... })` para grade, iluminação, fundo, nível de escuridão.

## 17. Módulos populares que estendem mapas

| Módulo | Para que serve |
|---|---|
| **Dungeon Alchemist importer / UVTT** | Importar mapas já com paredes e luzes |
| **Tagger / Monk's Active Tile Triggers** | Gatilhos de armadilha, porta, cena |
| **Token Magic FX** | Efeitos visuais nos tokens e modelos |
| **Levels / Wall Height** | Múltiplos andares e altura de parede |
| **Ambient Doors** | Portas animadas |
| **Simple Weather / Weather Blocker** | Clima por região |
| **Foundry Map Reveal / Fog** | Revelar por regiões |
| **Scene Packer / Scenery** | Empacotar e compartilhar cenas |
| **Torch** | Tocha com luz que o jogador pode acender |

## 18. Para o fluxo do Mapa Maker

1. Escolher o tamanho e o estilo (mundo, cidade, masmorra, interior).
2. Criar a cena, importar a imagem e **ajustar a grade**.
3. Desenhar **paredes e portas**.
4. Colocar **luzes e sons**.
5. Criar **regiões** (teletransporte entre andares, armadilhas, terreno difícil).
6. Colocar **notas** ligadas ao Journal.
7. Testar com um token jogador (visão, névoa, medição).
8. Salvar como pasta/modelo e **empacotar** a cena.

> Fonte: conhecimento do Foundry VTT e da API (documentos Scene, Wall, AmbientLight, AmbientSound, Tile, Drawing, Region, Note, MeasuredTemplate). Não foi conferido linha a linha com o código do build 369; itens com (v14?) devem ser confirmados na interface.
