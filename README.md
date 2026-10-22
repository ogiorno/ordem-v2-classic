<div align="center">

<img src="docs/img/banner.png" alt="Ordem Paranormal (v2 Classic) para Foundry VTT" width="100%">

# Ordem Paranormal (v2 Classic)

**Sistema não oficial de Ordem Paranormal para o Foundry VTT, com combate, progressão, rituais e ameaças automatizados.**

**Português** · [English](README.en.md)

[![Versão](https://img.shields.io/github/v/release/ogiorno/ordem-v2-classic?label=vers%C3%A3o&color=7b1e2b)](https://github.com/ogiorno/ordem-v2-classic/releases/latest)
[![Foundry](https://img.shields.io/badge/Foundry%20VTT-v13%2B%20%C2%B7%20testado%20na%20v14-orange)](https://foundryvtt.com)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-CC%20BY--NC--SA%204.0-blue)](LICENSE.txt)
[![Downloads](https://img.shields.io/github/downloads/ogiorno/ordem-v2-classic/total?label=downloads)](https://github.com/ogiorno/ordem-v2-classic/releases)
[![Issues](https://img.shields.io/github/issues/ogiorno/ordem-v2-classic)](https://github.com/ogiorno/ordem-v2-classic/issues)

[Instalação](#instalação) · [Novidades](#o-que-este-fork-acrescenta) · [Capturas de tela](#capturas-de-tela) · [Desenvolvimento](#desenvolvimento) · [Créditos](#créditos-e-licença)

</div>

---

## Sobre

Este é um fork do sistema [ordemparanormal_fvtt](https://github.com/SouOWendel/ordemparanormal_fvtt), de Wendel Henrique (Mark57449). Ele mantém as fichas e as regras do original e acrescenta o que uma mesa costuma fazer à mão: tela de ataque, morte e ferimentos, subida de nível, perícias treinadas, afinidade, grimório de rituais, maldições, ameaças jogáveis e animações.

A ideia central é **a ficha faz a conta e o Mestre decide**. O sistema aplica bônus, custos e condições sozinho, mas avisa o que depende de escolha ou de interpretação, em vez de resolver em silêncio.

> Sistema **gratuito e sem fins comerciais**. Ordem Paranormal pertence a Rafael Lange (Cellbit) e à Jambô Editora; este projeto não é afiliado a eles e **não substitui os livros**. Veja o [aviso legal](#aviso-legal).

## Instalação

1. No Foundry, abra **Sistemas → Instalar Sistema**.
2. Em **URL do Manifesto**, cole:

   ```
   https://github.com/ogiorno/ordem-v2-classic/releases/latest/download/system.json
   ```

3. Clique em **Instalar** e crie um mundo com o sistema **Ordem Paranormal (v2 Classic)**.

**Instalação manual:** baixe o `system.zip` na [última release](https://github.com/ogiorno/ordem-v2-classic/releases/latest) e extraia em `Data/systems/ordem_v2_classic`.

| Requisito | Detalhe |
| --- | --- |
| Foundry VTT | v13 ou mais novo. Verificado na v14. |
| Módulo obrigatório | **Brawl Bar** (`barbrawl`), para a terceira barra do token (PV, SAN e PE). |
| Opcional | **Automated Animations** + **JB2A_DnD5e** (animações dos rituais). |

> **Atenção, mesmo `id` do sistema original.** O `id` continua `ordem_v2_classic`, então instalar este fork sobre o sistema do Wendel substitui um pelo outro. Faça backup do mundo antes de trocar.

## O que este fork acrescenta

### Combate

- **Tela de ataque.** Ao atacar, abre uma janela com as opções ativas "ao usar" (da arma, dos itens e da ficha), campos de bônus no ataque e no dano e o custo somado. **Shift+clique** ataca direto.
- **Acertou ou Errou.** O resultado aparece no cartão e o jogador pode aplicar o dano. A **Defesa do alvo fica oculta** aos jogadores: eles veem só se acertou.
- **Aviso do Mestre.** Mensagens que são só para o Mestre aparecem compactas, em amarelo, separadas das da mesa.
- **Armas com regra própria.** Corrente (+2 para desarmar e derrubar), recarga obrigatória de Balestra, Besta e Bazuca, área de Bazuca e Lança-chamas, Cajado e a condição Em Chamas.
- **Efeitos a cada turno.** Sangrando pede o teste de Vigor ao **jogador** (cartão com botão *Rolar Vigor*). A opção do mundo *Teste de efeitos no início do turno* troca entre **Perguntar ao jogador** e **Automático**.
- **Morte do jogador.** 0 PV deixa o agente **Inconsciente** e **Morrendo**; no terceiro turno morrendo ele morre. **Dano Massivo** pede Fortitude. O botão **Estabilizar** exige um médico adjacente. Vale só para agentes; ameaças seguem como antes.
- **Animação de dano.** O token da criatura reage ao dano com um efeito curto que depende do **elemento primário**, e marca Machucado e morte.

### Barra de macros

- **Barra automática.** Armas, rituais e habilidades ativas entram na barra, com linhas extras além da primeira. O botão fica no cabeçalho da ficha (comando `/barra`).
- **Macro por arma.** Arma nova no inventário de um agente ganha a macro sozinha; arma removida, apagada.

### Progressão

- **Tela de nível.** Ao subir, o jogador vê os ganhos de PV, PE, PD e SAN (antes → depois), os limites por turno, as novas habilidades e os benefícios da classe com "escolha pendente".
- **Perícias treinadas.** A ficha mantém um **livro-caixa** de treinamento com contador de vagas. Origem, classe e poderes concedem perícias; as escolhas ficam **travadas na habilidade**. Cobre "treinamento ou +2", Eclético, Foco em Perícia e Treinamento Especial.
- **Origens.** A ficha da origem mostra **o que ela concede**, e o *jogador* (não o Mestre) escolhe as perícias. Cobre as **57 origens**, incluindo as de Arquivos Secretos, com confirmação ao trocar.
- **Poderes passivos.** Colocar o poder na ficha aplica o bônus; remover, tira. São **52 poderes automáticos**; os 111 que dependem de escolha, condição ou narrativa ficam manuais e marcados com o motivo.
- **Perito.** O custo em PE sobe com o NEX (2, 3, 4 e 5 PE; +1d6, +1d8, +1d10 e +1d12).
- **Categoria dos itens.** A aba Inventário mostra `usados/limite` por categoria, e cada **modificação** de arma ou proteção sobe a categoria do item. A ficha só informa; o Mestre decide o que fazer quando passa do limite.

### Paranormal

- **Grimório do jogador.** Janela de leitura dos rituais, condições e maldições, com busca, filtros, links entre termos, cartão da condição e "Veja também". Abre por um botão na barra lateral e na ficha.
- **Conjuração rápida.** Conjure um ritual que já está na ficha em poucos cliques, com alvo, alcance e custo conferidos. **Rituais de área** pedem que você posicione a área no mapa **antes** de pagar; cancelar não gasta nada. A área vira uma **Região** do Foundry e só **ameaças** dentro dela são afetadas.
- **Carta de ritual curta.** O chat mostra o resultado e o custo, com link para o Grimório.
- **Animações de ritual.** Os **98 rituais** da biblioteca têm um vídeo JB2A Free, colorido pelo elemento (Sangue vermelho, Morte cinza, Conhecimento dourado, Energia azul, Medo grafite). É só visual: não cobra, não rola e não causa dano.
- **Conexão e afinidade.** Em NEX 50% o agente se conecta ao paranormal e escolhe a afinidade. Um cartão na ficha mostra o estado. Rituais de uma forma que exige afinidade são recusados sem ela; testes contra um efeito do elemento ganham **+1d20 ou –1d20**. **29 poderes** têm a linha *Afinidade*.
- **Maldições de itens.** Compêndio com **36 maldições**, um tipo de item novo `curse` e um seletor para **amaldiçoar** arma, proteção ou equipamento. O efeito, o dano extra e o **preço** a pagar são aplicados pelo sistema.

### Ameaças

- **Ficha de ameaça no formato do livro.** VD, descritores e tamanho, Presença Perturbadora, Defesa, PV com *machucado*, resistências, atributos, perícias e ações. Rolagem na própria janela, perícias adicionáveis e **buff por teste** (Shift+clique abre o mini-menu).
- **Habilidades de ameaça jogáveis.** Mais de 160 habilidades com gatilho, alvo, resistência, dano e efeitos configurados, e um **painel do Mestre** para executá-las. O que é segredo (DT, totais) não vai para o chat dos jogadores.

### Conteúdo e qualidade

- Compêndios: armamentos, proteções, classes, trilhas, poderes, origens, rituais, maldições, ameaças e habilidades de ameaça, além do conteúdo do suplemento *Sobrevivendo ao Horror*.
- Suporte à variante **Jogando sem Sanidade**, que funde PE e SAN em Pontos de Determinação.
- Textos em **português e inglês**, com verificação de chaves.
- **1.536 testes unitários**, mais testes de interface rodando dentro do Foundry.

## Capturas de tela

<table>
  <tr>
    <td><img src="docs/img/tela-ataque.png" alt="Tela de ataque" width="100%"><br><sub><b>Tela de ataque</b>: opções ativas e custo somado.</sub></td>
    <td><img src="docs/img/grimorio.png" alt="Grimório do jogador" width="100%"><br><sub><b>Grimório</b>: rituais, condições e maldições.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/img/tela-nivel.png" alt="Tela de subida de nível" width="100%"><br><sub><b>Subida de nível</b>: o que mudou, antes → depois.</sub></td>
    <td><img src="docs/img/ficha-ameaca.png" alt="Ficha de ameaça" width="100%"><br><sub><b>Ficha de ameaça</b> no formato do livro.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/img/ritual-area.png" alt="Ritual de área no mapa" width="100%"><br><sub><b>Ritual de área</b>: posicione antes de pagar.</sub></td>
    <td><img src="docs/img/maldicao-item.png" alt="Item amaldiçoado" width="100%"><br><sub><b>Maldição</b> anexada a uma arma.</sub></td>
  </tr>
</table>

## Para o Mestre: primeiros passos

1. Crie o mundo e ative o módulo **Brawl Bar**.
2. Em **Configurações do Jogo → Configurar Opções → Ordem Paranormal**, ajuste a opção *Teste de efeitos no início do turno* ao seu estilo de mesa.
3. Cada jogador cria o agente. Origem e classe pedem as escolhas na hora, e o livro-caixa de perícias acompanha.
4. Para ativar as animações de ritual, instale **Automated Animations** e **JB2A_DnD5e**.
5. Quando algo depender de interpretação, o sistema avisa em vez de decidir. O Mestre tem a palavra final.

## Em andamento

Ainda não prontos: Profissão múltipla, a opção Conhecimento do Monstruoso, chip de elemento no inventário, selo de patente nos itens e preço oferecido no cartão do teste falho. Sugestões e bugs vão para as [issues](https://github.com/ogiorno/ordem-v2-classic/issues).

## Desenvolvimento

O repositório é o workspace de desenvolvimento; o sistema fica em `systems/ordem_v2_classic`.

```bash
npm install
npm run packs:pack    # compila os compêndios (packs/_source -> LevelDB)
npm test              # testes unitários
npm run lang-check    # confere as chaves de tradução
npm run render-check  # confere os templates
npm run dev           # servidor local do Foundry na porta 30000
```

**Publicar uma versão:** atualize `version` em `systems/ordem_v2_classic/system.json` e o `CHANGELOG.md`, crie a tag (`git tag -a v1.0.0 -m "..."`) e envie (`git push origin master v1.0.0`). O workflow *Release* roda os testes, compila os compêndios e publica `system.json` e `system.zip`. As regras para quem usa agentes de IA no repositório estão em [`AGENTS.md`](AGENTS.md).

## Créditos e licença

Baseado em [ordemparanormal_fvtt](https://github.com/SouOWendel/ordemparanormal_fvtt), de **Wendel Henrique (Mark57449)** e colaboradores, modificado por [ogiorno](https://github.com/ogiorno). A lista de colaboradores do projeto original está em [`systems/ordem_v2_classic/README.md`](systems/ordem_v2_classic/README.md).

Distribuído sob [CC BY-NC-SA 4.0](LICENSE.txt): você pode usar, copiar e modificar, desde que **dê crédito**, **não use comercialmente** e **mantenha a mesma licença**.

### Aviso legal

Ordem Paranormal é criação de Rafael Lange (Cellbit), publicada pela Jambô Editora. Este sistema é um trabalho de fã, **não oficial**, sem afiliação com os detentores dos direitos. Os direitos sobre o universo, os livros e as ilustrações são dos respectivos donos. É preciso ter os livros para jogar.
