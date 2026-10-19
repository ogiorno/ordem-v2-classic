# Ordem Paranormal (v2 Classic) — fork

Sistema **não oficial** de Ordem Paranormal para o Foundry VTT (v13+), gratuito e sem fins comerciais.

## Instalação

No Foundry: **Sistemas → Instalar Sistema → URL do Manifesto**, e cole:

```
https://github.com/ogiorno/ordem-v2-classic/releases/latest/download/system.json
```

## Créditos e licença

Este projeto é baseado em [ordemparanormal_fvtt](https://github.com/SouOWendel/ordemparanormal_fvtt), de Wendel Henrique (Mark57449) e colaboradores, e foi modificado por [ogiorno](https://github.com/ogiorno). A lista de colaboradores do projeto original está em [`systems/ordem_v2_classic/README.md`](systems/ordem_v2_classic/README.md).

Distribuído sob [CC BY-NC-SA 4.0](LICENSE.txt): pode usar, copiar e modificar, desde que dê crédito, **não use comercialmente** e mantenha a mesma licença.

Ordem Paranormal pertence a Rafael Lange (Cellbit) e à Jambô Editora; esta obra não é afiliada a eles. Os direitos do universo e dos livros são dos respectivos donos.

## Desenvolvimento

O repositório é o workspace de desenvolvimento; o sistema fica em `systems/ordem_v2_classic`.

```bash
npm install
npm run packs:pack   # compila os compêndios (packs/_source -> LevelDB)
npm test             # testes unitários
npm run lang-check
npm run render-check
```

## Publicar uma versão

1. Atualize `version` em `systems/ordem_v2_classic/system.json` e o `CHANGELOG.md`.
2. Crie e envie a tag: `git tag v8.1.0 && git push origin v8.1.0`.
3. O workflow *Release* roda os testes, compila os compêndios e publica `system.json` e `system.zip` na release.
