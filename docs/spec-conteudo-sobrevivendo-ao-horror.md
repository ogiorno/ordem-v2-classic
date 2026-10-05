# Spec — Conteúdo do suplemento Sobrevivendo ao Horror no sistema

Fonte: `regras/11-sobrevivendo-ao-horror/` (texto extraído do PDF v1.3) e o PDF original (leitura direta para resolver colunas e símbolos de dado).
Pedido: colocar no jogo o que ainda não estava, conferir o texto do que já estava e garantir que habilidades e bônus específicos
sejam entregues ao agente quando ele recebe a origem, a trilha, o poder ou o item.

## 1. O que foi encontrado

| Área | Situação antes |
| --- | --- |
| Origens (20) | Só texto provisório ("encontre na página X"); nenhuma entregava poder. |
| Poderes de origem (20) | Não existiam no compêndio `originPowers`, então a concessão automática nunca achava o poder. |
| Poderes de combatente/especialista/ocultista (31), gerais (34), paranormais (8) | Texto provisório; pré-requisitos e execução divergentes da tabela do livro. |
| Trilhas (15 itens "path") | Texto provisório. |
| Habilidades de trilha | Texto certo, com 2 erros (`Terapia`: "da mental"; caractere de controle em `Carteirada`) e vários itens do Monstruoso errados (resistência "1d20" no lugar de 10; "+5" no lugar de "+1 dado"). Habilidades de Exorcista, Parapsicólogo e Possuído com tipo `class` (caíam na aba errada); custo/execução trocados em 5 habilidades. |
| Trilha **Monstruoso** | **Nunca concedia nada**: o item da trilha se chama "Monstruoso - Sangue" e a pasta das habilidades "Sangue". |
| Classe **Sobrevivente** | Estágios não concediam Empenho, Cicatrizado nem poderes de trilha. |
| Equipamentos (40), armas (11) | Texto provisório; 1 categoria errada (Aplicador de Medicamentos), 2 nomes com erro ("Plástivo", "Pertubador"). |
| Catalisadores (16), itens amaldiçoados (19), modificações (3) | Catalisadores com texto provisório; itens amaldiçoados e modificações **não existiam**. |
| Rituais (16) | Já estavam na Biblioteca de Rituais do mundo e batem com o livro (círculo, execução, alcance, alvo, duração, resistência, dano, Discente/Verdadeiro). Nada a alterar. |

## 2. O que mudou

**Conteúdo** (compêndios, gerado por `tools/sah/build.mjs`; texto fiel ao PDF, símbolo de dado como `@DisplayDice`):
origens com perícias e poder; 20 poderes de origem; poderes de classe, gerais e paranormais com pré-requisito, execução e custo do livro;
15 trilhas; habilidades de trilha corrigidas; Possuído NEX 99% virou **uma** habilidade com as quatro opções de afinidade
(antes entregava as quatro de uma vez); classe Sobrevivente com 3 trilhas, 9 habilidades e texto de treinamento especial;
armas e equipamentos conferidos com as Tabelas 1.4 e 1.5; catalisadores; 19 itens amaldiçoados (pasta por elemento, Fuzil Alheio como arma);
Bateria Potente, Carregador Rápido e Lente de Revelação (pasta "Modificações").
"Medidor de Estabilidade da Membrana" era texto provisório mal classificado: agora é o item do Livro (p. 67), e o "Medidor de Condição Vertebral" ficou no suplemento.

**Concessão automática** (`level-progression.mjs` / `level-progression-rules.mjs`):
- a pasta de habilidades casa com trilha composta ("Monstruoso" + "Sangue" = "Monstruoso - Sangue");
- Sobrevivente: habilidades de trilha por **estágio** ("Estágio 2 - …") e de classe (Empenho 1, Aumento de Atributo 3, Cicatrizado 5); descer de estágio remove o que passou do limite;
- o gasto de PV/PE/SAN ganho vale também para estágio;
- migração única (`autoGrantsMigrated`): concede o que já era devido e faltava nas fichas existentes. Só adiciona; rodou uma vez e concedeu `Conhecimento Prático` a 2 fichas (Analista e a cópia de teste).

**Efeitos passivos** (ActiveEffect `transfer`, somem junto com o item): ver seção 3. Também trocados de NEX para Nível os efeitos `+1 PV/5% NEX` de `Calejado` e `Casca Grossa` do Livro.

## 3. Bônus aplicados automaticamente

| Item | Efeito |
| --- | --- |
| Fôlego de Nadador | +5 PV |
| Luta ou Fuga | +2 Vontade |
| Conexões | +2 Diplomacia |
| Atlético / Correria Desesperada | +3 m de deslocamento |
| Mochileiro / Mascate | +5 espaços |
| Inventário Organizado | + Intelecto em espaços |
| Observador | + Intelecto em Intuição |
| Personalidade Esotérica | +3 PE |
| Vitalidade Reforçada | +1 PV por nível e +2 Fortitude |
| Vontade Inabalável | +1 PE a cada 2 níveis e +2 Vontade |
| O Sorriso | +2 Diplomacia e Enganação |
| A Força do Saber | Intelecto +1 e + Intelecto em PE |
| Durão (Sobrevivente) | +4 PV, +2 PV ao chegar no estágio 3 |
| Monstruoso | Presença −1 (NEX 65%); atributos do NEX 99% por elemento; bônus da etapa ritualística como efeito **desligado** (o jogador liga no dia em que cumprir a etapa) |
| Amuleto Sagrado | +2 Religião e Vontade |
| Pé de Morto | +5 Furtividade |
| Medidor de Condição Vertebral | +2 Fortitude |
| Cão Adestrado | +2 Investigação e Percepção |

## 4. Não automatizado (fica no texto da habilidade)

Tudo que depende de escolha, situação ou rolagem: "treinamento ou +2" em perícia, bônus condicionais ("contra a criatura", "ao fugir"),
gastos de PE por uso, dados de bônus (+1d20 aparece como ícone), resistência a dano (a ficha do agente não tem esse campo),
trocar atributo-chave de perícia ou de PE, ações de interlúdio, aliados e companheiros, rituais aprendidos, armas naturais (mordida do Monstruoso).

## 5. Decisões e erratas

- **Revólver Compacto** segue a Tabela 1.4 (dano de perfuração "P"). Parece erro do livro (as demais armas de fogo são balísticas); está no teste para ser trocado em um lugar só.
- **Possuído, NEX 99%**: uma habilidade com as 4 opções, em vez de 4 itens concedidos juntos.
- **Tábula do Saber Custoso**: a tabela diz "Tablet", o texto diz "Tábula"; usei o texto.
- **Fanático por Criaturas / Fotógrafo / Explosivo Plástico / Perturbador**: nomes corrigidos.
- Origens da comunidade levam o crédito no texto.

## 6. Verificação

- `npm test`: 231 testes. Cobrem tabelas 1.1, 1.4, 1.5, 1.6 e 2.3 do livro, pré-requisitos, custos, trilhas nos níveis 2/8/13/20 (e estágios 2/4), classe Sobrevivente, efeitos, higiene do texto.
- Dentro do mundo (como GM): `sobrevivendo-ao-horror.test.mjs` (54: cada origem concede o poder certo; cada trilha concede 1/1/2/3/4 habilidades nos níveis 1/2/8/13/20 e tira ao descer; estágios do Sobrevivente; efeitos na ficha) e `sobrevivendo-ao-horror-itens.test.mjs` (7: todos os itens do suplemento entram numa ficha; efeitos dos equipamentos). Os atores de teste são criados e apagados.
- `node tools/sah/verify.mjs <texto-do-pdf>` compara cada texto com o PDF palavra a palavra; `node tools/sah/audit.mjs` lista origens sem poder e trilhas sem habilidades.
- Refazer: editar `tools/sah/content-*.mjs` e rodar `node tools/sah/build.mjs` (atualiza `packs/_source` e gera `tools/sah/out/sah-ops.json`). Para aplicar nos compêndios vivos, copie `tools/sah/apply-sah.mjs` e `sah-ops.json` para `modules/meu-modulo/scripts/`, importe o script em `main.mjs` e recarregue o mundo como GM (é idempotente; remova depois).

## 7. Fora do escopo (continuam com texto provisório)

9 origens e 4 trilhas de outros livros (Arquivos Secretos e afins): Caçador de Recompensas, Cientista Ex-Panacea, Cobaia Sobrevivente, Ferido por Ritual, Funcionário de Beira de Estrada, Influencer Paranormal, Segurança Ex-Panacea, Transtornado Arrependido, Ufólogo; trilhas Granadeiro Blaster, Criptologista do Oculto, Maledictólogo e Performático.
