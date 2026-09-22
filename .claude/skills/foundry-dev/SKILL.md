---
name: foundry-dev
description: Desenvolver módulos, sistemas, macros e packs para Foundry VTT v14 — manifesto, hooks, ApplicationV2, DataModels, packs LevelDB. Use ao criar ou editar qualquer coisa do Foundry.
---

# Foundry VTT v14 — guia de desenvolvimento

## Fonte da verdade
O código instalado em `C:\Users\Geh\VTT\Foundry Virtual Tabletop\resources\app\client` e `\common`. Use Grep nele antes de assumir uma API. Docs: https://foundryvtt.com/api/v14/

## Manifesto (`module.json` / `system.json`)
Campos essenciais: `id`, `title`, `version`, `compatibility {minimum, verified}`, `esmodules`, `styles`, `languages [{lang,name,path}]`, `packs`, `relationships`. Sistemas também: `documentTypes` / `grid`. `id` == nome da pasta.

## Padrões
- Ciclo de vida: `Hooks.once("init")` (registrar settings, sheets, data models) → `"i18nInit"` → `"setup"` → `"ready"` (UI/jogo pronto).
- Settings: `game.settings.register(MODULE_ID, key, {...})`; `scope: "world"|"client"|"user"`.
- UI: classes que estendem `foundry.applications.api.ApplicationV2` com `HandlebarsApplicationMixin`; `static DEFAULT_OPTIONS`, `static PARTS`, `_prepareContext`.
- Sheets: registrar com `foundry.applications.apps.DocumentSheetConfig.registerSheet(...)` (ou `Actors.registerSheet` equivalente na v14 — confira no código).
- Dados: `foundry.abstract.TypeDataModel` com `static defineSchema()` usando `foundry.data.fields.*`.
- Localização: chaves em `lang/*.json`, uso `game.i18n.localize()/format()`.
- Rolagens: `new Roll("1d20 + @mod", data).evaluate()` e `roll.toMessage()`.
- Sockets: `"module.<id>"` em `game.socket`; declare `"socket": true` no manifesto.
- Flags: `doc.setFlag(MODULE_ID, key, value)` para dados extras em documentos.

## Packs (compêndios)
LevelDB não se edita à mão. Fonte em `packs/_source/` (JSON/YAML), compilar com `@foundryvtt/foundryvtt-cli`:
`npx fvtt package workon <id> --type Module` e `npx fvtt package pack <pack>` / `unpack`. Ver scripts do `package.json`.

## Depuração
F5 recarrega; console do navegador (F12 / ctrl+shift+i no app) mostra erros. `CONFIG.debug.hooks = true` loga todos os hooks. Macros de teste rápido: crie macro Script no Foundry.

## Checklist ao entregar
- `compatibility.verified` = "14"
- Sem globais deprecated (olhar avisos "deprecated" no console)
- Strings em `lang/`, não hardcoded
- Testado em mundo limpo
