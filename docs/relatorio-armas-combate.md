# Relatório: combate com armas (18/10/2026) — segunda rodada, com correções

Testes: `scripts/ui-armas.js` (43 casos), `scripts/combate-multi.mjs` (combate real com 4 jogadores QA1..QA4, mestre de teste QA GM e o Gamemaster; relatório bruto em `work/combate-multi.json`), `scripts/ui-ataque.js` (13) e `npm test` (266). Spec atualizada em `docs/arquivo/spec-tela-de-ataque.md`.

## Resultado
- Armas sob condições, modificações, poderes de classe, peculiaridades, alcance: **43 de 43**, em 6 execuções seguidas.
- Combate real com vários clientes: **14 de 14**.
- Regras puras: 266 de 266. Fluxo básico da tela: 13 de 13.

## Pontos do relatório anterior, e o que foi feito
1. **Poderes iniciais sumiam da tela** (Ataque Especial, Mão Pesada, Para Bellum, Pancada Forte): o efeito desligado era ignorado. Agora o efeito "ao usar" vale mesmo desligado, como a spec manda. Corrigido.
2. **Atordoado não impedia o ataque**: agora a tela abre com o motivo e o botão Atacar desabilitado; Shift+clique e macros avisam e não rolam. Corrigido.
3. **Sem regra de distância**: agora corpo a corpo só alcança adjacente; à distância vale o alcance da arma (curto 6, médio 12, longo 24, extremo 60 quadrados), até o dobro com −1d20, além disso barrado. A tela mostra a distância ao alvo. Corrigido (no combate real, Machete a 6 m foi barrado até o agente se aproximar).
4. **Sem animação de ataque**: agora cada ataque com alvo toca golpe, tiro, rajada ou arremesso (Sequencer + JB2A), com opção por navegador. Corrigido (10 de 10 ataques no combate real dispararam o efeito).
5. **Falso positivo do AR-17**: o teste agora confere o nome exato, a repetição e as armas que não devem ver o poder.
6. **Habilidades que mexem em ataque**: integrados Golpe Pesado, Tiro Certeiro, Técnica Letal, Golpe Demolidor e Combate Defensivo. Ao entrar na ficha o poder ganha sozinho a opção, e a ficha marca com um selo de mira os poderes que aparecem na tela.

## Peculiaridades da arma na tela (pedido novo)
Bloco "A arma" no topo da tela de ataque, com etiquetas e escolhas conforme o Livro de Regras:
- **Arma ágil** (Faca, Katana, Florete...): atacar com Força ou Agilidade, vem marcado o maior.
- **Automática** (Fuzil, Submetralhadora): modo Rajada, −1d20 no ataque e +1 dado de dano.
- **Arremessável** (e arma corpo a corpo sem alcance): modo Arremessar, Pontaria com Agilidade, soma Força no dano, alcance curto; arma que não é de arremesso paga −1d20.
- **Coronhada** (armas de fogo): vira corpo a corpo, 1d4 (leve/uma mão) ou 1d6 (duas mãos), impacto.
- **Empunhadura adaptável** (Katana): duas mãos ou uma, registrada no cartão.
- Mostra também empunhadura, alcance, crítico e penalidade da arma.

## O que continua sem integração
Ataque Extra, Segurar o Gatilho, Combater com Duas Armas, Tiro de Cobertura, Ataque de Oportunidade, Saque Rápido e as demais técnicas de trilha: criam ataque extra, manobra ou ação, e precisam de um fluxo próprio. Combate Defensivo tira o d20, mas a Defesa +5 ainda é aplicada à mão.

## Decisões que ficam com você
- Katana só vira "uma mão" pela lista de nomes no código e pelo marcador "Empunhadura Adaptável"; a exigência de ser veterano em Luta aparece só como regra, não é verificada.
- Arma sem alcance, que não é de arremesso, pode ser arremessada com −1d20 (regra do livro); desligue se não quiser.

## Observações
- Para o teste com jogadores reais criei no mundo os usuários QA3, QA4 e QA GM (mestre).
- Os templates (.hbs) novos exigem reiniciar o servidor; reiniciei duas vezes pelo watcher do `dev.mjs`.
- O compêndio não foi reconstruído: os poderes novos ganham a opção pelo registro em `attack-power-effects.mjs` ao entrar na ficha.
