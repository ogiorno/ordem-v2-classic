# Spec — Ícones das maldições paranormais

Status (21/10/2026): **41 ícones gerados** em `systems/ordem-v2-classic/assets/curse-icons/`, no formato WebP 256×256 com transparência. Os PNGs de origem estão em `work/curse-icons-generated/`. A coluna `Path` abaixo contém o caminho para usar no campo `img` da plataforma. Acompanha `spec-modificacoes-paranormais.md` (§3.1, compêndio `curses`). Segue o padrão já usado nos ícones de habilidades de ameaça (`assets/ability-icons`, `tools/build-threat-ability-icons.mjs`: pasta de origem + `icon-map.json` → cópia para `assets` + fixture de caminhos) e nos ícones de rituais (`assets/rituais`, um PNG por ritual).

## 1. Escopo

36 ícones: 12 armas, 10 proteções, 13 acessórios e a Lente de Revelação. Mais 5 ícones de reserva: um para cada elemento (Conhecimento, Energia, Morte, Sangue e Medo), usados como fallback e no chip da ficha (§5). Medo não tem maldição própria; usa o ícone de reserva "Medo".

Saída: `systems/ordem-v2-classic/assets/curse-icons/<chave>.webp`, **256×256**, fundo transparente, ≤ 40 KB cada. A chave é a de `curse-rules.mjs` (`lancinante`, `antielemento`, `lenteDeRevelacao`...). O campo `img` do item do compêndio aponta para ele.

## 2. Estilo (família única para os 41)

- Emblema centrado, silhueta clara e legível a 32 px (tamanho da barra de macros e da lista do item) e a 64 px (ficha).
- Traço grosso, sem texto, sem letras, sem números, sem marca d'água.
- **Cor pelo elemento**, igual ao resto do sistema: Sangue vermelho, Morte cinza-chumbo, Conhecimento dourado, Energia azul-elétrico. Fundo do emblema escuro translúcido, brilho na cor do elemento.
- Um único símbolo por maldição: o objeto (arma, proteção, acessório) **com** o efeito (ex.: lâmina com sangue escorrendo), não uma cena.
- Mesma moldura para todos (disco com borda fina na cor do elemento), para ficarem uma família ao lado dos ícones de ritual.

## 3. Prompt de cada ícone

Prefixo comum: "ícone de RPG de horror, emblema circular, fundo transparente, traço grosso, sem texto, estilo coerente com os ícones de ritual do sistema, cor dominante <cor do elemento>:" + descrição.

### Armas
| Chave | Elemento | Descrição | Path para a plataforma |
|---|---|---|
| antielemento | Conhecimento | lâmina cercada por quatro pequenos símbolos de elemento quebrados | `systems/ordem-v2-classic/assets/curse-icons/antielemento.webp` |
| ritualistica | Conhecimento | arma com glifo ritual brilhando na lâmina, runas em espiral | `systems/ordem-v2-classic/assets/curse-icons/ritualistica.webp` |
| senciente | Conhecimento | espada flutuando sozinha com um olho aberto no centro da guarda | `systems/ordem-v2-classic/assets/curse-icons/senciente.webp` |
| empuxo | Energia | machadinha arremessada com rastro de energia curvo voltando à mão | `systems/ordem-v2-classic/assets/curse-icons/empuxo.webp` |
| energetica | Energia | lâmina de eletricidade que atravessa uma placa de armadura | `systems/ordem-v2-classic/assets/curse-icons/energetica.webp` |
| vibrante | Energia | arma com ondas de vibração e dupla silhueta (ataque duplo) | `systems/ordem-v2-classic/assets/curse-icons/vibrante.webp` |
| consumidora | Morte | mão esquelética segurando a arma, alvo congelado em cinza | `systems/ordem-v2-classic/assets/curse-icons/consumidora.webp` |
| erosiva | Morte | lâmina corroída, pingando, com fumaça de decomposição | `systems/ordem-v2-classic/assets/curse-icons/erosiva.webp` |
| repulsora | Morte | escudo-lâmina com ondas de repulsão | `systems/ordem-v2-classic/assets/curse-icons/repulsora.webp` |
| lancinante | Sangue | lâmina fina com um corte vermelho profundo e sangue em arco | `systems/ordem-v2-classic/assets/curse-icons/lancinante.webp` |
| predadora | Sangue | garra/presa com olho de predador, alvo no cruzamento da mira | `systems/ordem-v2-classic/assets/curse-icons/predadora.webp` |
| sanguinaria | Sangue | lâmina serrilhada pingando, gotas formando espiral | `systems/ordem-v2-classic/assets/curse-icons/sanguinaria.webp` |

### Proteções
| Chave | Elemento | Descrição | Path para a plataforma |
|---|---|---|
| abascanta | Conhecimento | escudo com espelho de runas refletindo um raio | `systems/ordem-v2-classic/assets/curse-icons/abascanta.webp` |
| profetica | Conhecimento | peitoral com olho de visão, dois dados sobrepostos | `systems/ordem-v2-classic/assets/curse-icons/profetica.webp` |
| sombria | Conhecimento | capa/colete se dissolvendo em sombra, olho semicerrado | `systems/ordem-v2-classic/assets/curse-icons/sombria.webp` |
| cinetica | Energia | colete com ondas de impacto sendo dispersadas | `systems/ordem-v2-classic/assets/curse-icons/cinetica.webp` |
| lepida | Energia | bota alada com rastros de velocidade | `systems/ordem-v2-classic/assets/curse-icons/lepida.webp` |
| voltaica | Energia | colete com arcos de eletricidade saltando | `systems/ordem-v2-classic/assets/curse-icons/voltaica.webp` |
| letargica | Morte | peitoral cinza com rachadura atravessada por escudo baixo | `systems/ordem-v2-classic/assets/curse-icons/letargica.webp` |
| repulsiva | Morte | colete escorrendo lodo preto com espinhos | `systems/ordem-v2-classic/assets/curse-icons/repulsiva.webp` |
| regenerativa | Sangue | colete com coração brilhando e gotas subindo, cura | `systems/ordem-v2-classic/assets/curse-icons/regenerativa.webp` |
| sadica | Sangue | colete com cicatrizes abertas e sorriso de dentes | `systems/ordem-v2-classic/assets/curse-icons/sadica.webp` |

### Acessórios
| Chave | Elemento | Descrição | Path para a plataforma |
|---|---|---|
| carisma | Conhecimento | medalhão com rosto sorridente e aura dourada | `systems/ordem-v2-classic/assets/curse-icons/carisma.webp` |
| conjuracao | Conhecimento | anel com pergaminho enrolado dentro | `systems/ordem-v2-classic/assets/curse-icons/conjuracao.webp` |
| escudoMental | Conhecimento | tiara/capacete com cabeça protegida por cúpula | `systems/ordem-v2-classic/assets/curse-icons/escudoMental.webp` |
| reflexao | Conhecimento | espelho de mão com ritual sendo devolvido | `systems/ordem-v2-classic/assets/curse-icons/reflexao.webp` |
| sagacidade | Conhecimento | monóculo com engrenagens de pensamento | `systems/ordem-v2-classic/assets/curse-icons/sagacidade.webp` |
| defesa | Energia | amuleto com escudo hexagonal elétrico | `systems/ordem-v2-classic/assets/curse-icons/defesa.webp` |
| destreza | Energia | luva com linhas de velocidade em cada dedo | `systems/ordem-v2-classic/assets/curse-icons/destreza.webp` |
| potencia | Energia | anel com símbolo de + e raios | `systems/ordem-v2-classic/assets/curse-icons/potencia.webp` |
| esforcoAdicional | Morte | frasco/relicário de energia escura com ampulheta | `systems/ordem-v2-classic/assets/curse-icons/esforcoAdicional.webp` |
| disposicao | Sangue | pulseira de couro com coração robusto | `systems/ordem-v2-classic/assets/curse-icons/disposicao.webp` |
| pujanca | Sangue | punho cerrado com veias saltando | `systems/ordem-v2-classic/assets/curse-icons/pujanca.webp` |
| vitalidade | Sangue | cantil/relicário com cruz e batimento | `systems/ordem-v2-classic/assets/curse-icons/vitalidade.webp` |
| protecaoElemental | (vários) | amuleto circular dividido em quatro quadrantes de elemento | `systems/ordem-v2-classic/assets/curse-icons/protecaoElemental.webp` |

### Sobrevivendo ao Horror
| Chave | Elemento | Descrição | Path para a plataforma |
|---|---|---|
| lenteDeRevelacao | Conhecimento | câmera instantânea com lente de olho aberto e flash dourado, figura translúcida | `systems/ordem-v2-classic/assets/curse-icons/lenteDeRevelacao.webp` |

### Reserva por elemento
| Chave | Símbolo | Path para a plataforma |
|---|---|---|
| `elemento-conhecimento` | Olho e livro dourados | `systems/ordem-v2-classic/assets/curse-icons/elemento-conhecimento.webp` |
| `elemento-energia` | Raio azul | `systems/ordem-v2-classic/assets/curse-icons/elemento-energia.webp` |
| `elemento-morte` | Ampulheta cinza-chumbo | `systems/ordem-v2-classic/assets/curse-icons/elemento-morte.webp` |
| `elemento-sangue` | Gota vermelha | `systems/ordem-v2-classic/assets/curse-icons/elemento-sangue.webp` |
| `elemento-medo` | Eclipse com lua crescente marfim | `systems/ordem-v2-classic/assets/curse-icons/elemento-medo.webp` |

Os caminhos são relativos à raiz do Foundry e podem ser copiados para o campo `img` do item. O símbolo visual de cada reserva segue `assets/ritual-elementos.png`.

## 4. Processo

1. **Tarefa de geração** (`tools/maldicoes/icones/tarefas.json`): uma linha por chave com `{ key, element, prompt, file }`, gerada a partir da tabela §3 (para a descrição não divergir do livro).
2. Gerar em lote com o gerador de imagens, uma imagem por vez, 1024×1024, pedindo fundo transparente (se vier com fundo, remover). Salvar numa pasta de origem fora do sistema.
3. Pós-processo: recorte quadrado, redimensionar 256×256, converter para WebP (qualidade ~85), conferir transparência. Nome = `<chave>.webp`.
4. `tools/maldicoes/construir-icones.mjs [--check] [pasta-origem]`: copia para `assets/curse-icons/`, valida que **todas as 36 chaves + 5 reservas** existem, que cada arquivo é 256×256 e ≤ 40 KB, e grava `fixtures/curse-icons.json` (chave → caminho). Chave sem arquivo gera erro, igual ao script de ameaças; `--check` só confere.
5. O gerador do compêndio (`gerar-fonte-maldicoes.mjs`) lê `fixtures/curse-icons.json` e preenche `img`. Até a imagem existir, o item usa o ícone de reserva do elemento (nunca o ícone genérico do Foundry).
6. **Revisão visual:** montar uma folha-contato (6×6) com os 36 a 64 px e a 32 px, em tema claro e escuro; reprovar o que não ler a 32 px, o que tiver texto, ou cor fora do elemento. Reprovados voltam ao passo 2 com prompt ajustado (máximo 3 tentativas por ícone; depois fica a reserva).

## 5. Onde o ícone aparece

- Imagem do item no compêndio `curses` e na lista de maldições do item (32 px).
- Chip do elemento ao lado do nome do item na ficha (usa o ícone de reserva do elemento, 16 px).
- Botões de uso automáticos na barra de macros (macro criada a partir da maldição usa o ícone dela).
- Cartão de chat do uso/dano da maldição.

## 6. Testes

- `tests/unit/icones-maldicoes.test.mjs` (`npm test`): para cada chave de `curse-rules.mjs` existe entrada em `fixtures/curse-icons.json` e arquivo em disco; nenhuma chave sobra sem maldição; reservas por elemento existem.
- `node tools/maldicoes/construir-icones.mjs --check` verifica tamanho, dimensão e peso.
- Ao vivo: abrir o compêndio, a lista do item e a barra de macros no mundo de teste e conferir que nenhum ícone quebra (404 no console).

## 7. Decisões em aberto

- **I1.** Estilo: emblema em disco (proposto) ou ilustração do item sem moldura?
- **I2.** Usar o mesmo gerador dos ícones de ritual/ameaça (qual ferramenta o Geh quer) ou outra?
- **I3.** Ícone por maldição na barra de macros: o do emblema completo ou só o do elemento?

