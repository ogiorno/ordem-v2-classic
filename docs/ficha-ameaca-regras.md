# Ficha de Ameaça — regras do Livro de Regras v1-3 (Cap. 7, pp. 176–181)

Notação do livro: `3O+10` = 3d20 + 10 (o "O" é o ícone do d20; `O` sozinho = 1d20 +0). "Machucado" = metade dos PV.

## Campos da ficha (ordem do livro)
1. **Nome e VD** (valor de desafio).
2. **Descritores & Tamanho** — elemento(s) (Sangue, Morte, Conhecimento, Energia, Medo...) e/ou tipo (Pessoa, Animal); tamanho: Minúsculo, Pequeno, Médio, Grande, Enorme, Colossal.
3. **Presença Perturbadora** (só criaturas paranormais): DT, dano mental (ex. 3d6), NEX a partir do qual é imune.
4. **Sentidos** — Percepção, Iniciativa (bônus de teste) + habilidades de sentido (Faro, Percepção às cegas, Visão no escuro/penumbra).
5. **Defesa** — Defesa, Fortitude, Reflexos, Vontade (testes no formato `xO+y`).
6. **Pontos de Vida** — PV | machucado; **Resistências** (RD por tipo, RD com exceção "/Morte"); **Vulnerabilidades**; Imunidades.
7. **Atributos** — AGI, FOR, INT, PRE, VIG.
8. **Perícias** — só as além de Iniciativa/Percepção/Fortitude/Reflexos/Vontade; some se vazio.
9. **Deslocamento** — metros | quadrados (1 quadrado = 1,5m).
10. **Habilidades** passivas.
11. **Ações** — cada uma com tipo de ação (Padrão, Movimento, Completa, Livre, Reação), nome, descrição. Ataques: tipo (corpo a corpo / distância + alcance Curto/Médio/Longo), multiplicador `xN` (nº de ataques por ação), teste `xO+y`, dano `XdY+Z tipo`, crítico (padrão 20/x2; exceções ex. 19/x3).
12. **Enigma de Medo** (criaturas de Medo): texto narrativo; mestre define detalhes.

## Regras que a ficha precisa suportar
- Ameaças **não** bloqueiam/esquivam/contra-atacam: estatísticas defensivas já resumem tudo.
- Estatísticas da ficha já incluem modificadores (tamanho, equipamento).
- Tamanho (Tab. 7.1): Minúsculo +5 Furt/−5 manobras, espaço 1,5m · Pequeno +2/−2, 1,5m · Médio 0, 1,5m · Grande −2/+2, 3m · Enorme −5/+5, 4,5m · Colossal −10/+10, 9m.
- Habilidades comuns de ameaças: Cura Acelerada N[/tipo], Faro, Imunidade, Incorpóreo (usa AGI no lugar de FOR), Percepção às Cegas (curto), RD N[/tipo], Visão na Penumbra (curto), Visão no Escuro (médio), Vulnerabilidade (dobro de dano do tipo).
- Habilidades comuns de criaturas paranormais: Origem Paranormal (sem Sanidade; imune a dano mental, condições mentais/medo, rituais de Medo), Presença Perturbadora (teste de Vontade; falha = dano mental, sucesso = metade; várias criaturas na cena: usa a de maior VD, +1d6 por criatura adicional), Enigma de Medo.
- Balanceamento: soma dos VD ≈ soma do NEX do grupo = equilibrado; ~½ = fácil; ~1,5× = difícil.
- Perigos (armadilhas, ácido, clima...) são outra seção — não são seres.

## Lacunas observadas no sistema atual (`ordem-v2-classic`)
Ver `threat-data.mjs`: já tem VD, atributos, perícias, resistências por tipo, presença perturbadora, enigma de medo, ações. Pontos a decidir: modelo de teste `xO+y` (hoje usa atributo + grau de treino), PV machucado, multiplicador de ataques, tipo de ação (Padrão/Movimento/...), RD com exceção, Cura Acelerada com valor, tamanho com modificadores automáticos.
