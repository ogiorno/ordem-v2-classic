# Specs dos rituais de área e do combate

Duas camadas, uma para cada coisa que pode quebrar:

| Camada | O que cobre | Como rodar | Quando |
|---|---|---|---|
| **Unitária** (sem Foundry) | alvo e alcance de cada ritual, DT/dano/resistência de cada ritual mapeado, números das condições do livro | `npm test` | a cada mudança no código |
| **Ao vivo** (no Foundry) | seleção de alvos e de área pelo chat, resistência e dano de verdade, condições que tiram d20 e PV, zonas por turno, batalha com vários agentes | console do navegador, como Mestre (abaixo) | antes de cada sessão e depois de mexer em ritual, condição ou combate |

## Unitária

```bash
cd C:\Users\Geh\VTT\foundry-dev
npm test
```

Arquivos em `systems/ordem_v2_classic/tests/unit/`:
- `ritual-targeting.test.mjs`: alcance (curto 9 m, médio 18 m, longo 36 m, extremo 90 m; sem informação vale curto; toque exige o espaço ao lado; pessoal não usa alvo), quantidade de alvos ("1 ser", "até 5 seres", "alvos escolhidos"), mudanças pela forma Discente/Verdadeira, área dentro do alcance.
- `ritual-area-rules.test.mjs`: o mapeamento dos rituais de área (forma, tamanho, dano, resistência, condições) e as condições do livro.

## Ao vivo

Com o servidor rodando (`npm run dev`), entre no jogo como Mestre e, no console do navegador (F12):

```js
const t = await import("/systems/ordem_v2_classic/module/macros/ritual-live-specs.mjs");
await t.runAllRitualSpecs();                  // tudo
await t.runAllRitualSpecs({ only: ["TG"] });   // um grupo
```

Grupos:
- **AR** (`ritual-area-live-test.mjs`): cada ritual de área e cada forma, com ameaças que passam, que falham, imunes e fora da área; zonas por turno; saída do Purgatório.
- **CD** (`ritual-battle-live-test.mjs`): cada condição tem efeito de verdade: Defesa, d20 a menos em testes e ataques, Sangrando, perder o turno, sem recuperar PV, Silenciado, Surdo, duração em rodadas.
- **TG**: seleção de alvos e de área pelo chat: sem alvo marcado, alvos demais, alvo fora do alcance, toque, "até 5 seres", área dentro e fora do alcance, área adiada pelo botão da carta, explosão no conjurador.
- **BT**: batalha com cinco agentes (NEX 05 a 99) com armas e rituais contra cinco ameaças, três rodadas.

Os testes ao vivo rodam numa **cena temporária** com **cópias** dos agentes: nada do mundo é alterado, e a cena, as cópias e as mensagens de chat do teste são apagadas no fim.

Requisitos e tabelas completas: `docs/spec-rituais-area.md`.

## Pela interface de verdade (Playwright + carrossel de combate)

Os testes acima clicam na página por script. Esta camada usa um navegador de verdade (Playwright CLI), com mouse e teclado reais, e conduz o combate pelo **botão de avançar turno do carrossel de combate** (Carolingian UI).

Pré-requisitos: servidor rodando (`npm run dev`) e `playwright-cli` instalado. Passos (a partir de `C:UsersGehVTToundry-dev`):

```bash
playwright-cli open http://localhost:30000/join
# entrar como Mestre (Mapa Maker, sem senha) e abrir a arena com combate:
playwright-cli --raw eval "(async()=>{ window.__rt = await import('/systems/ordem_v2_classic/module/macros/ritual-ui-live-test.mjs'); return JSON.stringify(await window.__rt.open()) })()"
# todos os rituais, todas as formas e escolhas de efeito (cerca de 25 minutos):
playwright-cli --raw eval "(()=>{window.__rtOpts={}; window.__rtResults=null; return 'ok'})()"
playwright-cli run-code --filename=scripts/ui-rituais.js
# combate de 3 rodadas pelo carrossel, com armas, Sangrando, Atordoado e uma zona de Miasma:
playwright-cli run-code --filename=scripts/ui-combate.js
# ao terminar:
playwright-cli --raw eval "window.__rt.close()"
```

Detalhes que já derrubaram o teste: o `eval` do Playwright aceita uma expressão só (use `(()=>{...})()` para vários comandos); acentos em argumentos de linha de comando precisam de escape (`ç`); mexer em arquivos de `systems/` ou `modules/` recarrega o navegador e derruba a arena; feche a arena com `close()` antes de recarregar.
