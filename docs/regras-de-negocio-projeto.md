# Regras de negócio implementadas — referência de código

Estado observado em 21/10/2026. Este documento registra regras encontradas na implementação, não substitui os livros. Para afirmar ou alterar a regra oficial, consultar `regras/INDICE.md`, `regras/LEIA-ME.md`, o arquivo da regra e, em caso de dúvida na extração, a página do PDF. Decisões de mesa e opções do mundo aparecem identificadas.

| Domínio | Comportamento implementado | Fonte no projeto | Teste/revisão ao alterar |
| --- | --- | --- | --- |
| Dados de agente e ameaça | `AgentData` e `ThreatData` definem campos persistidos distintos; agente usa `system.PV`, ameaça `system.attributes.hp` | `module/data/actors/`; `module/documents/actor.mjs` | Migração e abertura de fichas antigas no Foundry |
| Dano e RD | `resolveDamage` aplica imunidade, vulnerabilidade, RD tipada ou geral com exceção e RD extra; `OrdemActor.applyDamage` atualiza PV e aciona dano massivo | `module/helpers/threat-calc.mjs:93`; `module/documents/actor.mjs:280` | Matriz de tipos, RD, imunidade, zero PV e alvo agente/ameaça |
| Cartão de dano | Modo do mundo: `manual-gm`, `attacker-click` ou `auto`; pedido do jogador passa por validação no Mestre; desfazer usa janela de 2 minutos e PV inalterado | `module/helpers/card-damage-rules.mjs`; `module/helpers/card-damage.mjs` | Autor, posse, acerto, concorrência, dano aplicado e desfazer |
| Privacidade | PV de ameaça e Defesa numérica ficam restritos ao Mestre; resultados para jogadores são qualitativos. Agente mostra PV ao dono | `module/helpers/visibility.mjs`; `module/documents/chat-message.mjs` | GM, dono e observador em clientes reais |
| Rituais e PD | A macro de conjuração exige a opção global “Jogando sem Sanidade”, valida afinidade, custo de PD, alvo e área antes de cobrar; cancelamento de área no fluxo rápido não cobra | `module/macros/ritual-caster-logic.mjs`; `module/macros/ritual-caster.mjs:745` | Formas, saldo insuficiente, cancelamento, falha após pagamento |
| Custo básico de ritual | Círculos 1–4 têm custos base 1, 3, 6 e 10 na implementação | `module/macros/ritual-caster-logic.mjs:1` | Conferir livro e formas avançadas antes de alterar |
| Áreas | `MeasuredTemplate` posiciona/mostra área; motor de área resolve alvos, dano, resistência e efeitos; zonas persistentes usam hooks/cena | `module/macros/ritual-area.mjs`; `ritual-area-engine.mjs` | Cena, alvo entrando/saindo, turno e fim de duração no Foundry |
| Habilidade de ameaça | O fluxo `Usar` valida, mostra resumo, coleta alvo/área, confirma, cobra custo e cria painel; pedidos de jogador são delegados ao Mestre | `module/macros/threat-ability-use.mjs`; `module/helpers/threat-ability-flow.mjs` | Autorização, custo, cancelamento, falha parcial e alvo ausente |
| Morte e estabilização | Estado morrendo tem limite de 3 turnos; estabilização começa em DT 20, sobe em passos de 5; PV estabilizado fica em 1 | `module/helpers/death-rules.mjs`; `module/helpers/death.mjs` | Transições de turno, cura, não letal e permissão |
| Treinamento | Graus destreinada/treinada/veterana/expert usam bônus 0/5/10/15; limites e concessões dependem de nível, classe e origem | `module/helpers/skill-training-rules.mjs` | Origem, classe, evolução, duplicação e remoção de item |
| Afinidade | Conexão ocorre em NEX 50% ou nível 10 conforme eixo de progressão; elemento opressor e bônus/penalidade são calculados por helpers | `module/helpers/affinity-rules.mjs` | NEX versus nível, conexão única, poder seguinte e pré-requisito |
| Animações | Animação de ritual/ataque representa resultado visual após a decisão da regra | `module/integrations/ritual-animations.mjs`; `attack-animations.mjs` | Falha ou ausência de módulo visual não muda efeito mecânico |

**Atualização de 21/10/2026:** dano em alvo que o jogador não possui requer cartão de dano validado pelo Mestre ou aplicação manual. Para Bazuca e Lança-chamas usados por jogador, os alvos extras da área aguardam resolução manual do Mestre; a automação direta foi desativada enquanto não houver pedido verificável para essa área.

## Decisões de mesa e configurações, não presumir como regra universal

- A Defesa numérica não aparece no cartão para jogadores, inclusive dono do alvo (`SHOW_DEFENSE_ON_CARD = false`).
- A macro rápida de rituais cobra PD e exige “Jogando sem Sanidade”; outras formas de jogo podem usar recursos diferentes.
- `damageApplication` altera quem pode solicitar a aplicação de dano.
- Classificação editorial dos rituais no Grimório e perfis em `ritual-profiles.mjs` servem à busca/fluxo; conferir o livro antes de transformar isso em regra oficial.

## Pendências de confirmação

- As tabelas e textos em `regras/` foram extraídos automaticamente. Valor ambíguo exige cotejo com PDF.
- As regras acima foram lidas no código e em documentação local; esta auditoria não validou o comportamento completo com jogadores reais no Foundry.
- Uma melhoria de arquitetura deve preservar o comportamento caracterizado antes de mudar regra. Se a regra atual estiver errada em relação ao livro, registrar a divergência e mudar a expectativa em tarefa separada.
