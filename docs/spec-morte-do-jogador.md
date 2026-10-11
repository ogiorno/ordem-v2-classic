# Spec — Morte do jogador (Ferimentos & Morte)

Regras: Livro v1.3 pp. 88 e 311 (`regras/05-regras/0757-morrendo.md`, `0759-dano-massivo.md`, `0760-dano-nao-letal.md`, `regras/03-pericias/0389-primeiros-socorros-dt-20.md`). Vale só para **agentes**; ameaças seguem como antes.

## Comportamento
- **0 PV** → condições **Inconsciente** (Defesa −5, não age, o combate pula o turno) e **Morrendo**; o Mestre vê uma carta no chat com o botão **Estabilizar**.
- **Morrendo**: ao iniciar o turno morrendo, conta 1/2/3 (marca `dyingTurns` na ficha); no 3º turno, o agente **morre** (status "morto"). Os turnos não precisam ser consecutivos.
- **Dano Massivo**: dano de uma só vez ≥ metade dos PV totais sem zerar os PV → Fortitude DT 15 +2 por 10 de dano; falhou, cai a 0 PV (inconsciente e morrendo). Entra em `OrdemActor.applyDamage`.
- **Cura de 1+ PV** encerra só Inconsciente; **Morrendo continua** até Medicina (ou efeito específico), como no livro.
- **Estabilizar**: botão da carta; quem clica usa o token selecionado (ou seu personagem) como médico — não pode ser o próprio caído nem estar inconsciente, e precisa estar **adjacente** (quadrados do grid encostando, inclusive na diagonal; sem tokens dos dois na cena atual, a regra não se aplica). Medicina DT 20, **+5 por vez já estabilizado na cena**; passou: sai de Morrendo e Inconsciente e fica com 1 PV (se estava a 0). Falhou: a carta continua aberta para nova tentativa.
- **Dano não letal** soma ao letal só para Inconsciente (não para Morrendo).
- **Fim do combate** zera `dyingTurns` e `stabilizations` (a "cena" acabou).

## Código
- Regras puras: `module/helpers/death-rules.mjs`. Motor e hooks: `module/helpers/death.mjs` (`registerDeathHooks`, chamado no `ready`). Condições: `unconscious`/`dying` em `helpers/conditions.mjs`. Botão e socket `stabilize`: `module/ordemparanormal.mjs`.

## Testes
- Unitário: `npm test` (`tests/unit/death-rules.test.mjs`).
- Ao vivo (arena temporária, como Mestre): `await (await import("/systems/ordem_v2_classic/module/macros/death-live-test.mjs")).runDeathTests()` — DT-01 a DT-12.

## Fora do escopo / não coberto
- Reanimação, Equipe de Trauma e outros poderes que mudam a regra não são tratados.
- Dano não letal: a regra de curar primeiro o não letal não foi implementada.
- O clique do jogador (botão e socket `stabilize`) foi testado à mão com QA1 em outro navegador, não está no teste automático.
