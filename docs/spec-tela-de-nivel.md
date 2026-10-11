# Tela de recompensa ao subir de nível

Abre para o jogador dono do personagem quando o Nível (Sobrevivente: Estágio) sobe. O Mestre só a vê quando ele mesmo
subiu o nível e nenhum jogador dono está conectado. Descer de nível não abre nada.

## O que mostra
- Nível novo (e o anterior, se pulou vários), retrato, nome e classe.
- Ganhos de PV, PE, PD, SAN (só o que subiu, "antes → depois"), limite de PE/PD por turno.
- PP (pontos de possessão) e limite por turno (= Presença) para a trilha Possuído; o poder de ocultista vira Transcender (+2 PP).
- Novas habilidades de trilha/classe do Sobrevivente (ícone, descrição, link).
- Benefícios da classe pelas Tabelas 1.3–1.5 (ataque especial, perito, círculo, atributo, grau, versatilidade) com "escolha pendente".

## Código
- Regras puras: `module/helpers/level-up-rules.mjs` · Tela: `level-up-screen.mjs` · Animação (Motion, `lib/motion.min.js`): `level-up-motion.mjs` · CSS: `css/level-up-screen.css`.

## Testes
- Unitário: `npm test` → `tests/unit/level-up-rules.test.mjs`.
- Ao vivo, todas as classes e trilhas (33 trilhas × níveis 2–20; Sobrevivente estágios 2–5), como Mestre sem jogador dono:
  ```js
  const t = await import("/systems/ordem_v2_classic/module/macros/level-up-live-test.mjs");
  const r = await t.runLevelUpTests();            // ou { classes: ["Combatente"], paths: ["Aniquilador"] }
  ```
  Confere número do nível, ganhos de status contra a fórmula do livro (ou o ganho real da ficha quando uma habilidade de
  trilha soma por nível, ex. Casca Grossa), benefícios contra as tabelas, habilidades listadas contra as realmente
  concedidas, PP/Transcender só no Possuído, e erros de JavaScript. Cria fichas "ZZ nível …" e apaga no fim.
