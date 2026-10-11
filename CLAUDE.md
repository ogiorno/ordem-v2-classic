# Foundry VTT — workspace de desenvolvimento

## Ambiente
- Foundry VTT **v14 (build 369)**, app desktop Windows. Node 22.
- Código-fonte do Foundry (somente leitura, referência da API):
  `C:\Users\Geh\VTT\Foundry Virtual Tabletop\resources\app` → `client/`, `common/`, `templates/`
- Dados do usuário: `C:\Users\Geh\AppData\Local\FoundryVTT\Data` (`modules/`, `systems/`, `worlds/`)
- Sistemas instalados para referência: `ordemparanormal`, `ordem_v2_classic` (em `Data/systems`)
- Docs da API: https://foundryvtt.com/api/v14/ · Wiki: https://foundryvtt.com/article/ · Comunidade: https://foundryvtt.wiki/

## Estrutura
- `modules/<id>/` — cada módulo em desenvolvimento (ligado ao Foundry por junction: `npm run link`)
- `systems/<id>/` — sistemas de jogo (mesmo esquema)
- `scripts/` — utilitários (link, packs)

## Fluxo
1. `npm install`
2. `npm run link` — cria junctions em `Data/modules` e `Data/systems` (Foundry precisa estar fechado ou recarregue o setup)
3. Edite os arquivos, recarregue o mundo com **F5** (JS/CSS/HTML/lang recarregam sem reiniciar; mudanças em `module.json` exigem voltar ao menu e reabrir o mundo)
4. Packs (compêndios, LevelDB): editar em `packs/_source/*.json` e rodar `npm run packs:pack`; para extrair: `npm run packs:unpack`

## Convenções
- ES modules (`esmodules` no manifesto), sem bundler a menos que necessário.
- v14: use `ApplicationV2` + `HandlebarsApplicationMixin`, `foundry.abstract.TypeDataModel` para dados, namespaces `foundry.*` (evite globais deprecated).
- Nunca edite arquivos em `Foundry Virtual Tabletop\resources\app` — são sobrescritos em updates.
- Antes de usar uma API, confira o código em `resources/app/client` (a fonte da verdade da versão instalada).
- Ids de módulo: kebab-case, igual ao nome da pasta.

## Dev rápido (sem reiniciar o app)
`npm run dev` roda o Foundry como servidor local (Node embutido do app, v24) e abre http://localhost:30000.
Feche o app desktop antes. Editou JS/CSS/HTML/lang → **F5** no navegador. Só muda manifesto (`module.json`) → volte ao menu de setup e reabra o mundo.

## Hot reload
`npm run dev` agora usa `scripts/dev.mjs`: observa `modules/` e `systems/`. Salvou arquivo → navegador recarrega sozinho (módulo `dev-reload`, ative-o no mundo). Mudou `module.json`/`system.json`/`template.json` → reinicia o servidor. Packs (`packs/`) são ignorados.

## Sistema ordem_v2_classic (workspace)
- Código em `systems/ordem_v2_classic/` (git). O `npm run dev` espelha cada arquivo salvo para `Data/systems/ordem_v2_classic` (sem packs compilados); `npm run sync` faz isso uma vez. Mudou `system.json`/`module.json` → o servidor reinicia sozinho.
- Original intacto no commit `bd4aaee` (baseline).
- Testes:
  - `npm test` — lógica pura (Node, `tests/unit/`), sem Foundry.
  - `npm run render-check` — compila/renderiza os templates da ficha de ameaça com o Handlebars do Foundry.
  - `npm run lang-check` — confere chaves de tradução usadas pela ficha.
  - Dentro do mundo (sem precisar do módulo Quench), no console do navegador como GM:
    `await import("/systems/ordem_v2_classic/module/tests/mini-quench.mjs"); await miniQuench("/systems/ordem_v2_classic/module/tests/suites/threat-sheet-book.test.mjs")`
- Spec e decisões: `docs/spec-ficha-ameaca.md` (seção 11), regras do livro: `docs/ficha-ameaca-regras.md`, auditoria: `docs/auditoria-ficha-ameaca-atual.md`.
- CSS do sistema usa a classe raiz `.system-ordemparanormal`, que NÃO existe neste id (`system-ordem_v2_classic`): o CSS antigo não casa. A ficha nova (`css/threat-sheet.css`) não depende dela.

## Regras do jogo
Texto das regras (livro básico + Sobrevivendo ao Horror) em `regras/`; veja a seção "Regras do jogo" em `AGENTS.md`. Consulte antes de implementar ou afirmar qualquer regra.
