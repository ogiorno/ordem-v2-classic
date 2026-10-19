> **Fork não oficial.** Este sistema é baseado em [ordemparanormal_fvtt](https://github.com/SouOWendel/ordemparanormal_fvtt), de Wendel Henrique (Mark57449), e foi modificado por [ogiorno](https://github.com/ogiorno). Distribuído gratuitamente, sem fins comerciais, sob CC BY-NC-SA 4.0.

**Instalação no Foundry:** Sistemas → Instalar Sistema → cole em *URL do Manifesto*:

`https://github.com/ogiorno/ordem-v2-classic/releases/latest/download/system.json`

# Sobre o Ordem Paranormal.

Ordem Paranormal é um sistema e/ou universo de investigação paranormal criado por Rafael Lange, mais conhecido pelo seu pseudônimo Cellbit. Com base nisso, este é um **sistema não-oficial** adaptado para o FoundryVTT, que utiliza dos conteúdos considerados <i>Open Game License¹</i>, conforme a licença incluída juntamente ao livro de regras.

> No universo de Ordem Paranormal, o paranormal existe, mas está separado da nossa realidade por uma membrana. Essa membrana pode ser enfraquecida pelo medo, e alguns grupos de ocultistas estão dispostos a fazer isso para invocar entidades do Outro Lado.
> Para combater essa ameaça, foi criada a Ordo Realitas, uma organização de detetives paranormais que vivem vidas duplas. Os agentes da Ordem secretamente investigam e combatem o paranormal, protegendo a Realidade e lutando contra aqueles que querem mergulhar o mundo em caos.

## Começando o Desenvolvimento.

1. Clone o repositório com `git clone https://github.com/ogiorno/ordem-v2-classic.git ordem-v2-classic`
2. Instale as dependências de desenvolvimento com `npm install`
3. Compile os compêndios com `npm run packs:pack` (converte os JSONs de `packs/_source/` para LevelDB)
4. Use `npm run link` para ligar os módulos ao diretório de dados do Foundry, quando necessário
5. Inicie `npm run dev` para abrir o Foundry local na porta 30000; o script sincroniza o sistema e recarrega arquivos alterados

## Testes

### Tier 1 — Testes unitários (Node.js)

Rodam fora do Foundry, via `node --test`. Cobrem regras puras, cálculos e validações que não exigem a aplicação aberta.

```bash
npm test
npm run lang-check
npm run render-check
npm run lint
```

Os testes de Node não substituem a validação de documentos, permissões e cliques no Foundry.

### Tier 2 — Testes dentro do Foundry

As suítes em `module/tests/suites/` exercitam documentos, efeitos, fichas e hooks no mundo. Use o módulo Quench quando estiver ativo, ou o executor local `mini-quench.mjs` pelo console do navegador.

```bash
npm run dev         # inicia o servidor local do Foundry na porta 30000
```

1. Acesse `http://localhost:30000` e abra um mundo de teste com `ordem_v2_classic` como Mestre.
2. Com Quench ativo, rode as suítes pela interface do módulo. Sem Quench, execute no console:

```js
await import("/systems/ordem_v2_classic/module/tests/mini-quench.mjs");
await miniQuench("/systems/ordem_v2_classic/module/tests/suites/threat-sheet-book.test.mjs");
```

3. Para mudanças em permissões, socket ou UI, valide também com um segundo cliente de jogador.

As suites disponíveis:

- **OP | Agent Actor: prepareDerivedData** — classes, progressão, PV/PE/SAN, defesa, rituais, patentes
- **OP | Actor: Active Effects** — resolução de `@variáveis`, stacking, item-transferred AEs
- **OP | Item: isCritical & getRollData** — parsing de fórmulas críticas, dados de rolagem
- **OP | Sheets: registration & dataModels** — registro de sheets e TypeDataModels no CONFIG

## Modulos Obrigatórios.

- **Brawl Bar**: módulo utilizado para adicionar uma terceira barra nos tokens, complementando os principais status de personagem do Ordem Paranormal: Pontos de Vida (PV), Sanidade (San), Pontos de Esforço (PE);

## Contribuidores

- Agradecimento ao <a href="https>//twitter.com/ciconiaborns">@jojo</a> pelas traduções do sistema para o Inglês.
- Agradacimento ao <strong>Dzeta (de discord: arcojin): </strong>
	tradução e adaptação do sistema para o Inglês;
- Agradacimento ao <strong>Marcos Miranda (de discord: .nyazi): </strong>
	vetorização e criação de ícones para compêndio.
- Agradacimento ao <strong>Gyoko (de discord: fuckpatyo): </strong>
	grandes contribuições no desenvolvimento da ficha de ameaças.
- Agradacimento a <strong>Fresko (de discord: jojoexperiencia): </strong>
	contribuiu enormemente na criação dos compêndios.
- Agradacimento ao <strong>Fabrício (de discord: fabricio): </strong>
	automatização do sistema de combate, melhrorias gerais e correções de bugs.
- Agradacimento ao <strong>Mercy (de discord: notnanomercy): </strong>
	melhorias gerais no sistema e correções de bugs. Criador do módulo Paranormal Toolkit, com automatizações e melhorias no sistema.


## Demonstração do Sistema

https://github.com/user-attachments/assets/ae649c77-42df-4e1d-ae8f-e8989f570f05

## Licenças e Observações.

<sub>
Este repositório utiliza <a href="https://semver.org/lang/pt-BR/">Versionamento Semântico 2.0</a>, <a href="https://www.conventionalcommits.org/en/v1.0.0/">Conventional Commits</a> e o guia de estilo para <a href="https://google.github.io/styleguide/jsguide.html">ESLint do Google</a>, além disso, desenvolvido com muita dedicação e código. Para dúvidas e bugs deste fork, abra uma <a href="https://github.com/ogiorno/ordem-v2-classic/issues">issue</a>. O sistema original é de Wendel Henrique (<a href="https://github.com/SouOWendel/ordemparanormal_fvtt">SouOWendel/ordemparanormal_fvtt</a>)<br><br>
</sub>
<sub>
This work is permitted under the <a href="https://github.com/SouOWendel/ordemparanormal_fvtt/blob/main/media/OGLlicense.txt">Open Gaming License</a>, the software component of this module/system is distributed under the <a href="https://github.com/SouOWendel/ordemparanormal_fvtt/blob/main/LICENSE.txt">CC BY-NC-SA 4.0 license</a>. Sistema Ordem Paranormal para FoundryVTT © 2026 by Wendel Henrique is licensed under <a href="https://github.com/SouOWendel/ordemparanormal_fvtt/blob/main/LICENSE.txt">CC BY-NC-SA 4.0</a><br><br>
</sub>
<sub>
¹: LANGE, R. Ordem Paranormal RPG. 1a EDIÇÃO ed. Rua Coronel Genuíno, 209 • Porto Alegre, rs: Jambô Editora, 2022. v. 1p. 2, 318. "O material a seguir é Identidade do Produto: os capítulos 5, 7 e 8, todos os termos referentes ao cenário de Ordem Paranormal, incluindo a Membrana, o Outro Lado, nomes e descrições de personagens, criaturas, entidades, lugares e organizações, todas as ilustrações e todas as regras de rituais, poderes paranormais, Sanidade e dano mental. O material a seguir é Conteúdo Open Game: todo o texto de regras do livro, exceto por material previamente declarado Identidade do Produto."<br><br>
</sub>
<sub>
Observação: A marca Ordem Paranormal não é de minha autoria, todos os direitos são reservados aos seus respectivos donos.
</sub>

<!-- Links Uteis -->
<!-- https://foundryvtt.wiki/en/development/guides/SD-tutorial -->
<!-- https://foundryvtt.com/article/dice-advanced/ -->
<!-- https://foundryvtt.wiki/en/development/guides/System-Development-for-Beginners/System-Development-Part-5-Wandering-in-000000 -->
<!-- https://foundryvtt.wiki/en/development/guides/vite -->
<!-- https://foundryvtt.wiki/en/development/guides/builtin-css -->
