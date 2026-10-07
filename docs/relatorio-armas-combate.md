# Relatório: combate com armas (18/10/2026)

Testes: `scripts/ui-armas.js` (condições, modificações, poderes de classe) e `scripts/combate-multi.mjs` (combate real com 4 jogadores, 1 mestre de teste e o Gamemaster; relatório bruto em `work/combate-multi.json`). Usuários de teste criados no mundo: QA3, QA4 (jogadores) e QA GM (mestre).

## Resultado
- Armas sob condições, modificações e poderes: 17 de 18.
- Combate real com vários clientes: 11 de 15.

## O que funcionou
- Agarrado tira 1 d20 do ataque (também no combate real, jogador 1, rodada 2); com 0 dados rola 2d20 e fica com o pior.
- A tela de ataque lista a condição, o botão remover tira o efeito, e o cartão guarda a condição.
- Alvo Vulnerável: Defesa −2 na ficha e no confronto.
- Bônus de ataque da arma, efeito "ao usar" ativo na arma (mira laser) e efeito de ficha na perícia entram na tela, no ataque e no dano.
- Classe Combatente e os 29 poderes aparecem na ficha; remover o poder tira a opção.
- Iniciativa rolada por cada jogador na própria sessão, monitor ordenado, 2 rodadas na mesma ordem, carrossel avançou todos os 22 turnos, tela de ataque abriu para os 4 jogadores, ameaças atacam sem tela.

## Problemas encontrados
1. **Regressão grave**: `onUseOf` (attack-options.mjs) passou a ignorar efeitos desativados, mas todos os poderes iniciais (Ataque Especial, Mão Pesada, Para Bellum, Pancada Forte) vêm desativados no compêndio e a spec manda que sejam. Resultado: nenhum deles aparece mais na tela de ataque (nem os +2 automáticos no dano). Decidir: reativar a leitura de efeitos desativados ou ativar esses efeitos no compêndio.
2. Atordoado ("sem ações") não impede o ataque com arma.
3. Não existe regra de distância para armas: Machete atacou a 6 m sem aviso (alcance da arma não é lido).
4. Não existe animação de ataque: nenhum efeito do Sequencer disparou em 10 ataques (as animações cobrem só rituais).
5. O teste AR-17 do `ui-armas.js` aceitava a palavra "Ataque" em qualquer lugar da tela e deu falso positivo; precisa checar o nome completo.

## Habilidades que mexem em ataque e não estão ligadas à tela de ataque
Citam ataque ou dano no texto e não têm opção "ao usar":
- Combatente: Ataque de Oportunidade, Combate Defensivo, Combater com Duas Armas, Golpe Demolidor, Golpe Pesado, Saque Rápido, Segurar o Gatilho, Tanque de Guerra, Tiro Certeiro, Tiro de Cobertura, Artista Marcial.
- Gerais e especialista: Balística Avançada, Ninja Urbano, Sentidos Aguçados.
- Trilhas de combatente: Técnica Letal, Técnica Secreta, Técnica Sublime, Brecha na Guarda, Revidar, Força Opressora, Ataque Extra, Atacar das Sombras, Estudar a Presa, entre outras.
Só 4 de 160 poderes de combate têm integração. Os mais diretos de ligar: Golpe Pesado, Golpe Demolidor, Tiro Certeiro, Segurar o Gatilho, Combate Defensivo.

## UX sugerida
- Mostrar, na tela de ataque, poderes que "poderiam valer" mas não têm opção (aviso "este poder não está integrado") para o mestre ver a lacuna.
- Marcar o motivo quando uma opção some (arma errada, condição) em vez de simplesmente não aparecer.
- Avisar distância fora do alcance direto na tela (ex.: "alvo a 6 m, arma corpo a corpo").
