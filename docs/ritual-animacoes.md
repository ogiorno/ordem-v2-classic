# Animações dos rituais

## Escopo

O mapa `systems/ordem-v2-classic/module/macros/ritual-animation-map.json` relaciona cada ritual da biblioteca do mundo a um vídeo da biblioteca JB2A Free. A versão atual contém 98 vínculos e usa 95 arquivos distintos. Os arquivos ficam no módulo `JB2A_DnD5e`, em `Library/Generic/`.

## Comportamento no jogo

- Depois que a conjuração termina sem interrupção, a macro chama o fluxo público `aa.workflow` do Automated Animations.
- A animação é reproduzida sobre o token do conjurador. A seleção de um alvo não é necessária para ver a animação.
- O efeito é visual: não cobra recursos, não faz testes, não causa dano e não aplica condições.
- A cor é aplicada como matiz pelo elemento do ritual: Sangue vermelho, Morte cinza, Conhecimento dourado, Energia azul e Medo grafite.
- O token do conjurador precisa estar presente na cena atual. Sem token, a conjuração continua normalmente e não há animação de cena.

## Registro no mundo

`module/integrations/ritual-animations.mjs` escuta `aa.initialize`, usa o modelo de registro On Token já fornecido pelo Automated Animations e adiciona os vínculos por meio de `game.settings.set`. A rotina é restrita ao Mestre, remove apenas seus próprios registros antigos, preserva as demais entradas e evita duplicar rituais que já tenham um registro manual. O registro legado de Eletrocussão (Range/Chain Lightning) é migrado para a visualização no token do conjurador.

## Atualização do mapa

Ao adicionar ou editar vínculos:

1. Use o nome exato do item no campo `name`.
2. Confira se o caminho `asset` existe em `modules/JB2A_DnD5e/Library/Generic/`.
3. Mantenha `element` compatível com o elemento do ritual; essa chave define a matiz.
4. Reabra/recarregue o mundo para que Automated Animations aplique as configurações salvas.

O mapa atual seleciona o vídeo mais relacionado à descrição e ao elemento do ritual. A apresentação final de cada arquivo deve ser revisada em cena antes de tratar a escolha artística como definitiva.
