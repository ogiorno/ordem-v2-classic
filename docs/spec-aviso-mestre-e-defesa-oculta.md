# Spec: aviso compacto do mestre e Defesa oculta aos jogadores

Sistema `ordem_v2_classic` · Foundry VTT 14 · continuação de [spec-experiencia-jogador.md](spec-experiencia-jogador.md).

Dois problemas vistos pelo usuário ao revisar as mudanças:

1. **Mensagens que são "para o mestre" não se destacam.** Elas chegam como mensagens comuns, com retrato, cabeçalho e "WHISPER", misturadas com as da mesa.
2. **A Defesa do alvo não pode aparecer para os jogadores.** Quando um jogador ataca uma criatura ou um agente, ele só deve ver **Acertou** ou **Errou**, nunca "contra Defesa X".

O mockup acima mostra o resultado esperado dos dois.

---

## 1. Aviso do mestre (compacto, amarelo)

### 1.1 Problema

O sistema manda ao GM várias informações por mensagem comum com `whisper`. Exemplos reais do código:

| Mensagem hoje | Onde nasce | Quem vê hoje |
| --- | --- | --- |
| "8 de dano aplicado a QA Agente 2" | `helpers/card-damage.mjs` (e o caminho antigo em `documents/item.mjs`, `case "applyDamage"`) | GM e, se o alvo for agente, o dono dele |
| "{ator} recupera {n} PV (Cura Acelerada)" | `hooks.mjs`, `op.threat.fastHealingChat` | **todos** (público) |
| "{ator} esquivou (+4 Reflexos): nova Defesa 15 → FALHA" | `helpers/reactions.mjs`, `op.reaction.dodgeApplied` | **todos** (público) |
| "Aguardando o Mestre aplicar resistência e efeitos nos alvos" | `macros/ritual-caster.mjs`, dentro do cartão do ritual | todos |
| "O efeito {x} de {ator} expirou" | `hooks.mjs`, `op.effectExpired` | todos |

Todas ocupam o espaço de uma mensagem completa (retrato 36 px, nome, hora, "WHISPER") e nada indica "isto é para você, mestre". O GM perde o que importa no meio do chat.

### 1.2 Solução de UX

Um novo tipo de mensagem: **aviso do mestre**.

- **Uma linha**, só texto, sem retrato, sem cabeçalho e sem cartão.
- **Amarelo**: fundo amarelo claro, barra amarela de 3 px na esquerda, texto escuro (no tema escuro, fundo amarelo translúcido e texto amarelo claro).
- Começa sempre com a palavra **Mestre ·** em negrito. A palavra existe para não depender só da cor (acessibilidade e daltonismo).
- Frase curta no passado, dizendo **o que aconteceu**, com os números que o mestre precisa.
- Hora e botão de apagar aparecem **só ao passar o mouse** (a hora vai no `title`).
- Altura alvo: uma linha de 13 px com 3 px de respiro em cima e embaixo.
- Só o GM recebe. Jogador nunca vê, nem o dono do alvo.

Redação (modelos; todos em `lang/pt-BR.json`, sem ponto final, sem "foi" desnecessário):

| Situação | Texto |
| --- | --- |
| Dano aplicado | `Mestre · QA1 aplicou 8 de dano em QA Agente 2 (PV 22 → 14)` |
| Dano desfeito | `Mestre · dano em QA Agente 2 desfeito (PV 14 → 22)` |
| Esquiva | `Mestre · QA Agente 2 esquivou: Defesa 15, o ataque 14 errou` |
| Bloqueio | `Mestre · QA Agente 2 bloqueou: +3 de RD contra o ataque` |
| Cura Acelerada | `Mestre · Aberração de Carne recuperou 5 PV (Cura Acelerada)` |
| Ritual esperando o mestre | `Mestre · QA2 conjurou Decadência: aplique a resistência e o efeito` |
| Efeito expirou | `Mestre · efeito Sangrando de QA Agente 2 expirou` |

**Mensagens que os jogadores precisam ver continuam públicas**, mas sem o dado secreto. Por exemplo, a esquiva pública passa a ser `QA Agente 2 esquivou: o ataque errou` (ver seção 2).

### 1.3 Mensagens de jogador endereçadas ao mestre (opcional, ligado por padrão)

Rolagens `/gmroll`, `/blindroll` e sussurros de jogador para o GM **não viram aviso**: o conteúdo deles importa por inteiro. Mas ganham um destaque mais leve só na visão do GM: barra amarela de 3 px na esquerda e o rótulo **Para o mestre** no lugar de "WHISPER". Configuração de cliente `gmWhisperHighlight` (padrão ligado).

### 1.4 Desenho técnico

**Novo helper `helpers/gm-notice.mjs`:**

```js
export async function gmNotice(text, { kind = "info" } = {}) {
  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  return ChatMessage.create({
    content: foundry.utils.escapeHTML(text),
    whisper: gmIds,
    speaker: { alias: game.i18n.localize("op.gmNotice.label") },
    flags: { ordem_v2_classic: { gmNotice: { kind } } },
  });
}
```

- Texto sempre escapado; os nomes entram já escapados pelo chamador.
- O som e a notificação do Foundry para whisper continuam como estão.
- Só o primeiro GM ativo cria os avisos que nascem de socket, para não duplicar (já é a regra do handler existente em `ordemparanormal.mjs`).

**Renderização** (`documents/chat-message.mjs`, em `getHTML`): se `this.getFlag("ordem_v2_classic","gmNotice")`, marca o elemento com a classe `op-gm-notice` e troca o conteúdo por `<strong>Mestre</strong> · texto`. O CSS esconde `.message-header`, o retrato do módulo de UI e o selo de whisper, e mostra a hora e o apagar no `:hover`.

**CSS** (`css/ordemparanormal.css`), tokens:

```css
.system-ordemparanormal .chat-message.op-gm-notice {
  padding: 3px 8px; margin: 2px 0; border-left: 3px solid var(--op-notice-border);
  background: var(--op-notice-bg); color: var(--op-notice-fg); font-size: 12.5px; line-height: 1.4;
}
:root { --op-notice-bg: #fff3b8; --op-notice-fg: #4a3a00; --op-notice-border: #e0a800; }
.theme-dark, [data-theme="dark"] { --op-notice-bg: rgba(255,200,40,.16); --op-notice-fg: #ffe8a0; --op-notice-border: #ffc400; }
.op-gm-notice .message-header { display: none; }
```

Contraste: `#4a3a00` sobre `#fff3b8` ≈ 9:1; `#ffe8a0` sobre o fundo escuro translúcido > 7:1. A UI Carolingian (`crlngn`) usa `--portrait-size` e classes próprias; o CSS novo usa `!important` só em `display` do cabeçalho e do retrato.

**Troca das mensagens atuais:**

| Arquivo | Mudança |
| --- | --- |
| `helpers/card-damage.mjs` (`applyDamageFromMessage`) | `ChatMessage.create(... whisper ...)` vira `gmNotice(format("op.gmNotice.damageApplied", {by, amount, target, pvBefore, pvAfter}))` |
| `documents/item.mjs` (`case "applyDamage"`) | mesmo helper |
| `helpers/card-damage.mjs` (`undoCardDamage`) | `gmNotice` com o texto de desfeito |
| `helpers/reactions.mjs` (`applyDodge`, `applyBlock`) | mensagem pública sem números **e** `gmNotice` com os números |
| `hooks.mjs` (Cura Acelerada) | só `gmNotice`; o jogador não precisa saber que a criatura regenerou |
| `macros/ritual-caster.mjs` | quando há efeito pendente do mestre, `gmNotice` curto; o cartão do ritual continua público |
| `hooks.mjs` (efeito expirou) | continua público para o dono do efeito; `gmNotice` só quando o efeito é de ameaça |

O dono do alvo (um agente) deixa de receber o antigo whisper "X de dano aplicado". Ele já vê a leitura qualitativa no próprio cartão de dano ("sofreu 8 de dano, sente o golpe") e o PV na ficha.

### 1.5 Critérios de pronto

- Cada situação da tabela produz **uma** linha amarela, só para o GM, de uma linha só.
- Em tela de 1600×900 com o chat aberto, a linha ocupa no máximo 22 px de altura.
- Jogador não recebe nenhuma dessas mensagens (verificado com QA1).
- Nada de texto sem escape; nome com `<` ou `&` aparece literal.

---

## 2. Defesa oculta aos jogadores

### 2.1 Regra

**O número da Defesa de qualquer criatura ou agente nunca aparece para jogadores.** Eles veem só o resultado do ataque.

| Quem vê | O que vê no cartão de ataque |
| --- | --- |
| Jogador atacante | `Acertou`, `Acertou — crítico` ou `Errou o ataque` |
| Jogador dono do alvo (agente atingido) | `Você foi atingido`, `Você foi atingido — crítico` ou `O ataque errou você` |
| Outro jogador | nada (como hoje, não participa do ataque) |
| Mestre | o mesmo texto **mais** `19 contra Defesa 15` |

Isto vale para ataque de jogador contra criatura, de jogador contra agente e de criatura contra agente. O dono do alvo também não vê o número no cartão: ele já tem a Defesa na ficha, e o cartão não precisa repeti-la.

### 2.2 Onde a Defesa vaza hoje

| # | Vazamento | Quem vê | Local |
| --- | --- | --- | --- |
| 1 | `vs Defesa 11` no cartão de ataque para o **dono do alvo** | jogador defensor | `documents/chat-message.mjs` ~linha 203, `shouldShowDefenseValue({viewerIsGM, viewerOwnsTarget})` |
| 2 | Mensagem pública de esquiva: "nova Defesa {defense} → {outcome}" | **todos os jogadores** | `helpers/reactions.mjs` (`applyDodge`), `op.reaction.dodgeApplied` |
| 3 | Valores numéricos guardados nas flags da mensagem de ataque (`hitResult.targetDefense`, `baseDefense`, e cópias em `attackResults[]`) | qualquer jogador que abra o console do navegador | `documents/item.mjs` linhas ~327, 342, 449, 529, 573 |
| 4 | Texto do rótulo `op.hit` / `op.miss` antigos ("ACERTO", "FALHA") ainda existem nas traduções e são usados na mensagem de esquiva | todos | `lang/pt-BR.json`, `reactions.mjs` |

Os itens 1 e 2 aparecem na tela. O item 3 é a causa raiz: o dado secreto viaja para todos os clientes que enxergam a mensagem.

### 2.3 Solução técnica

**(a) Regra de exibição.** `helpers/visibility.mjs`: `shouldShowDefenseValue({ viewerIsGM })` passa a retornar apenas `viewerIsGM`. O parâmetro `viewerOwnsTarget` sai. Atualizar o teste unitário.

**(b) Tirar o número das flags públicas.** `_compareWithDefense` continua devolvendo `{ hit, targetDefense, actorUuid, isCritical }` para uso **em memória** no cliente de quem rolou, mas o que vai para `flags["ordem_v2_classic.hitResult"]` passa a ser:

```js
{ hit, isCritical, actorUuid, revealed, attackMessageId, dodgeBonus }   // sem targetDefense, sem baseDefense
```

- O GM mostra "19 contra Defesa 15" lendo a Defesa atual do ator (`fromUuidSync(actorUuid).system.defense.value + dodgeBonus`) no momento de renderizar. O dado do ataque já está em `message.rolls[0].total`.
- A reação de esquiva roda no cliente do GM (socket) e recalcula `recomputeHit(rollTotal, baseDefense, dodgeBonus)` com `baseDefense` lido do ator na hora, em vez da flag (`reactions.mjs` ~linhas 164–173, `reaction-helpers.mjs`).
- `attackResults[]` (volley) segue o mesmo formato enxuto.
- Há um caminho em `item.mjs` que copia `targetDefense` para o cartão do item (`syncItemCardHitResult`); passa a copiar só os campos novos.

**(c) Esquiva pública sem número, com aviso ao mestre.**

- Texto público novo (`op.reaction.dodgeApplied`): `<strong>{actor}</strong> esquivou: o ataque <strong>{outcome}</strong>.` com `outcome` = "acertou" ou "errou".
- `gmNotice` (seção 1) com `Mestre · {actor} esquivou: Defesa {defense}, o ataque {total} {outcome}`.

**(d) Rótulos.** Remover o uso de `op.hit`/`op.miss` em `reactions.mjs` e usar `op.attackResult.hit`/`miss` (lang já existe). Manter as chaves antigas só enquanto nenhum outro arquivo as usar.

**(e) Mensagens antigas.** Um comando de GM `/limpar-defesa` (ou macro em `packs`) varre `game.messages`, remove `targetDefense` e `baseDefense` das flags de `hitResult` e `attackResults`, e reescreve a mensagem pública de esquiva sem o número. Idempotente, com contagem no fim ("Limpei 14 mensagens"). Útil porque o histórico do chat do mundo já tem a Defesa gravada.

**(f) Auditoria rápida do que já existe** (feita no código, sem alteração prevista):

- Rastreador de combate: mostra PV só ao GM e ao dono (`shouldShowCombatantHP`). Não mostra Defesa.
- Painel de reação do defensor (`_renderReactionPanel`): mostra os rótulos "Esquivar (+X Reflexos)" e "Bloquear (+X Resiliência)", bônus do próprio defensor. Não mostra a Defesa do atacante nem a de ninguém.
- Ficha de ameaça (`threat-sheet`): campo Defesa existe, mas ameaça é visível só ao GM por permissão (Observador/Nenhum). Confirmar na checagem de permissão do compêndio `ameacas-v1-3` que `PLAYER` não é `OBSERVER` nos mundos que importam ameaças; se for, o jogador abre a ficha e vê a Defesa. Registrar no checklist de QA.

### 2.4 Critérios de pronto

- Como QA1 atacando um agente (QA2): o cartão mostra só "Acertou/Errou"; `chatMessage.flags.ordem_v2_classic.hitResult` não tem `targetDefense` nem `baseDefense`.
- Como QA2 (alvo): o cartão mostra "Você foi atingido" ou "O ataque errou você", sem número.
- Como GM: o cartão mostra "contra Defesa N" com o valor certo, inclusive depois de uma esquiva (Defesa base + bônus).
- A mensagem pública de esquiva não contém nenhum número de Defesa.
- Após `/limpar-defesa`, nenhuma mensagem do histórico tem `targetDefense`.

---

## 3. Testes

**Unitários (`npm test`):**
- `shouldShowDefenseValue`: só `viewerIsGM` verdadeiro.
- Função pura que monta o `hitResult` público: nunca contém `targetDefense`/`baseDefense`.
- `recomputeHit(rollTotal, baseDefense, dodgeBonus)` continua igual (a entrada muda de origem, não a conta).
- Formatador do texto de esquiva público e do aviso do mestre (com e sem Defesa).
- Teste de colisão de chaves de tradução (já existe) cobre as chaves novas `op.gmNotice.*`.

**No mundo (QA como jogador + GM):**
1. QA1 ataca QA2: cartão sem Defesa; inspeciona a flag da mensagem e confirma ausência do número.
2. QA2 (Ocultista treinado em Reflexos, para a reação aparecer) esquiva: mensagem pública sem número; GM recebe uma linha amarela com a Defesa.
3. QA1 aplica dano: GM recebe a linha amarela de dano aplicado; QA1 e QA2 não recebem whisper.
4. Cura Acelerada de uma ameaça no início do turno: só o GM vê a linha.
5. Visual: screenshot da linha amarela no tema claro e escuro do chat, e com `compactChat` ligado.

---

## 4. Fases

| Fase | Conteúdo | Risco |
| --- | --- | --- |
| 1 | `gmNotice` + CSS + troca das mensagens de dano aplicado, desfeito, cura acelerada e ritual | baixo |
| 2 | Defesa oculta: regra de exibição, mensagem pública de esquiva, aviso do mestre com os números | baixo |
| 3 | Tirar `targetDefense`/`baseDefense` das flags e recalcular no GM; `/limpar-defesa` | médio: mexe na reação de esquiva e no volley |
| 4 | Destaque leve de `/gmroll` e sussurros para o GM (`gmWhisperHighlight`) | baixo |

## 4.1 Status de implementação

Fases 1 a 4 feitas. `npm test` passa (96). Verificado ao vivo com QA1 e QA2 e o GM real (o usuário confirmou a linha amarela compacta no chat do GM):
- Flags de ataque novas guardam só `hit`, `actorUuid`, `isCritical`, `revealed` e `attackMessageId` (sem Defesa); cartão do jogador sem "vs Defesa".
- Esquiva do QA2: mensagem pública "esquivou: o ataque errou", sem número; o mestre recebeu a linha amarela com "Defesa 16, o ataque 7 errou".
- Aviso do mestre não aparece na tela dos jogadores (`message.visible` é falso para eles).
Desvios da spec: o bloqueio continua só com a mensagem pública (já não revela Defesa); a aplicação de dano não avisa mais o dono do alvo.
**Limite do Foundry:** mensagens sussurradas ficam carregadas no cliente de todos e só são escondidas na interface; um jogador que abra o console do navegador consegue ler o texto de um aviso do mestre. Por isso o número da Defesa também saiu das flags públicas, mas continua no texto dos avisos do mestre. Se isso importar, a alternativa é tirar a Defesa do texto do aviso.

## 5. Perguntas abertas

1. O **dono do alvo** (jogador atingido) pode ver o número da própria Defesa no cartão? Esta spec diz **não** (ele tem na ficha). Se preferir que veja, a regra 2.1 muda para "dono do alvo vê, outros jogadores não".
2. O destaque da seção 1.3 (rolagens e sussurros de jogador para o GM) deve ficar ligado por padrão?
3. O aviso "efeito expirou" de agente continua público? Hoje todos veem; o texto acima mantém assim.
4. Em ataques de criatura contra agente, o jogador atingido deve saber **quanto** passou na Defesa? Esta spec diz que não.

## 6. Fora de escopo

Esconder o PV de agentes dos outros jogadores no token (já controlado pelo Bar Brawl), redesenho do rastreador de combate e sons de notificação.
