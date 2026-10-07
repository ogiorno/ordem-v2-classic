# Spec — Recursos inspirados no Tormenta20

Referência lida: `gitlab.com/vizael/Tormenta20` (`module/apps/active-effect-wizard.mjs`, `module/applications/ux/enrichers/apply-effect.mjs`,
`module/apps/resistance-config.mjs`, `module/apps/character-progression.mjs`). A tela de ataque (feita antes) está em `spec-tela-de-ataque.md`.

O que o T20 faz de fato (e o que não faz):

- **Assistente de efeitos**: janela que monta um Efeito Ativo a partir de listas prontas (perícias, atributos, resistências por tipo de dano,
  deslocamentos, PV/PM por nível, modificadores globais como "dano corpo a corpo" ou "testes de ataque"), sem digitar chave nenhuma.
- **Aplicar condição por link**: `@STATUS[id]` vira um link com a descrição em dica e um botão que aplica a condição nos tokens selecionados.
- **Resistências**: janela por tipo de dano com valor, exceção, imunidade e vulnerabilidade.
- **Progressão**: no T20 é só um esqueleto (tabela vazia). Não há o que copiar; a nossa já concede origem e trilha.

## 1. Resistência a dano no agente (fazer primeiro)

**Achado**: `applyDamage` já lê `system.resistances` de qualquer ator, mas o agente não tem esse campo, então nenhuma RD de agente funciona hoje.
Isso deixa só em texto: Mutação (RD 2), Fome do Outro Lado (RD 10 do elemento), Monstruoso (RD 5/10/15/20 por elemento),
Traje de Mergulho e Traje Espacial (químico 5/20), Palavras de Devoção (mental 5), Luto Habitual (metade do dano mental) e as vulnerabilidades.

- Dados: `system.resistances.<tipo>` (valor, vulnerável, imune) igual à ameaça, mais `system.genericRd` (RD geral) no agente.
- Efeitos: chaves `system.resistances.<tipo>.value`, `...vulnerable`, `...immune` e `system.genericRd` valem em Efeito Ativo (assistente e janela de efeito).
- Ficha: bloco "Resistências" compacto (só mostra tipos com valor), editável.
- Conteúdo: preencher os efeitos dos itens acima; Monstruoso liga/desliga junto com a etapa ritualística.
- Testes: soma de RD de várias fontes, imunidade, vulnerabilidade, RD geral com exceção, aplicação do dano no cartão.

## 2. Aplicar condição por link

- Texto de ritual, habilidade ou item aceita `@Condicao[atordoado]`; vira o nome com dica da regra e um botão "aplicar".
- O botão aplica nos tokens **selecionados** (ou, sem seleção, nos **alvos marcados**); só o mestre aplica em fichas que não são dele.
- Usa o catálogo `CONDITIONS` que já existe (efeito mecânico real, defesa, dados a menos, sem ações).
- Conteúdo: trocar nos rituais e itens os nomes de condição soltos pelo link onde a regra manda aplicar (Sangrando, Atordoado, Vulnerável, Enjoado...).
- Testes: enricher gera o link; clicar aplica uma vez; clicar de novo não duplica; sem seleção avisa.

## 3. Assistente de efeitos

Botão "Assistente" no topo da aba Efeitos da ficha e do item. A janela escolhe **o que o efeito muda** por listas, não por chave:

| Grupo | Exemplos |
| --- | --- |
| Perícia | +N em uma perícia ou em todas |
| Atributo | +N em um atributo |
| Recursos | PV, PE, PD, SAN: bônus fixo ou por nível |
| Defesa e deslocamento | +N Defesa, +N metros, +N espaços |
| Resistência | RD, vulnerabilidade, imunidade por tipo de dano |
| Opção de ataque | liga a seção "Opção de ataque" (tela de ataque) com os campos já preenchidos |

Também define duração (cena, rodada, missão) e o tipo "desligado até ligar" (usado na etapa ritualística do Monstruoso).
Testes: cada grupo gera a chave certa (conferida contra o esquema da ficha); efeito criado aplica na ficha.

## 4. Assistente de subida de nível (a decidir)

O T20 não ajuda aqui, mas é a lacuna que sobrou: hoje a subida de nível só concede origem e trilha. Proposta:
ao mudar o nível, uma janela lista o que o livro dá naquele nível (Tabelas 1.3 a 1.5: poder de classe, aumento de atributo,
grau de treinamento, versatilidade, trilha) e deixa escolher o poder da lista da classe, com pré-requisitos checados.
Perguntas em aberto: concede automático o que não tem escolha (Ataque Especial, Aumento de atributo)? A janela aparece para o jogador ou só para o mestre?

## Ordem e esforço

1. Resistências (pequeno, desbloqueia 10+ habilidades).
2. Aplicar condição por link (pequeno).
3. Assistente de efeitos (médio; depende de 1 para listar resistências).
4. Subida de nível (médio; precisa das decisões acima).
