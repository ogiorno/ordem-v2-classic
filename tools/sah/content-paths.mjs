// Trilhas, habilidades de trilha corrigidas e classe Sobrevivente (suplemento Sobrevivendo ao Horror v1.3).
const D = "[d]";

// ---------------------------------------------------------------- Monstruoso (p. 17–21)
const MONSTRUOSO_COMMON_10 =
	"Em suas veias corre uma maldição paranormal que aos poucos o está transformando em um monstro. Você se torna treinado em Ocultismo (se já for treinado, em vez disso recebe +2 nessa perícia). Escolha um elemento paranormal entre Sangue, Morte, Conhecimento ou Energia. Uma vez por dia, você precisa executar uma etapa ritualística desse elemento (por exemplo, beber sangue humano para Sangue, inalar cinzas de mortos para Morte, tatuar palavras que causam medo para Conhecimento ou receber choques de cabos elétricos para Energia). Se fizer isso, até o fim do dia você recebe os efeitos descritos a seguir, conforme o elemento escolhido. Caso contrário, você sofre de fome e sede nesse dia (OPRPG, p. 292). Por fim, se adquirir afinidade com um elemento, deverá escolher aquele selecionado para esta habilidade.";
const MONSTRUOSO_COMMON_40 = `Conforme sua humanidade é substituída pela Entidade, as mudanças em seu corpo e mente se intensificam. A resistência a dano que você recebe por executar a etapa ritualística de seu elemento aumenta para 10, enquanto a penalidade em perícias aumenta para –2${D}. Por fim, quando executa sua etapa ritualística, você recebe os efeitos adicionais incluídos na descrição de seu elemento, a seguir.`;
const MONSTRUOSO_COMMON_65 =
	"Como um parasita, você sente a Entidade andar por todo o seu corpo, fazendo de você uma morada. A resistência a dano que você recebe por executar a etapa ritualística de seu elemento aumenta para 15, mas sua Presença é reduzida permanentemente em 1. Por fim, quando executa sua etapa ritualística, você recebe os seguintes efeitos adicionais associados ao seu elemento.";
const MONSTRUOSO_COMMON_99 =
	"Você foi transformado no habitat perfeito para a entidade que reside no interior de seu corpo e mente. Os efeitos por executar sua etapa ritualística se tornam permanentes (mas você ainda precisa executá-la para evitar sentir fome e sede) e você passa a ser considerado uma criatura paranormal para efeitos de habilidades e itens. Além disso, a resistência a dano que você recebe por essa trilha aumenta para 20 e você recebe os seguintes efeitos adicionais associados ao seu elemento.";

// Efeitos: "ritual" = só vale no dia em que a etapa ritualística foi executada (efeito desligado até o jogador ligar).
const R = { ritual: true };

export const MONSTRUOSO = {
	sangue: {
		label: "Sangue",
		10: {
			text: `SANGUE: Suas presas ficam protuberantes e seus olhos se tornam vermelhos. Você recebe resistência a balístico e Sangue 5 e faro e, quando faz um contra-ataque bem-sucedido, soma seu Vigor na rolagem de dano, mas sofre –${D} em Ciências e Intuição.`,
		},
		40: {
			text: "SANGUE: Você veste poucas roupas, expondo o máximo de sua pele sensível ao ambiente que puder. Seu corpo já está repleto de cicatrizes e feridas, muitas causadas por você mesmo para saborear a dor. Devorar qualquer coisa que não seja carne ou sangue não é capaz de conter sua fome. Você pode usar Força para calcular seus pontos de esforço (em vez de Presença). Além disso, pode gastar uma ação de movimento e 1 ou mais PE (limitado por sua Força) para recuperar 1d8 PV por PE gasto.",
			act: "movement",
			cost: 1,
		},
		65: {
			text: "SANGUE: Você dilacerou seus próprios órgãos sensitivos, como olhos, nariz e orelhas, para que possa sentir com total intensidade o sabor e a dor da sua existência. Arames farpados e lâminas enroladas em seu corpo permitem que você não pare de sentir. A esse ponto, a palavra “não” já parece ser um conceito inútil para suas decisões: você está disposto a aceitar tudo, provar de tudo, sofrer tudo. Você tem 50% de chance de ignorar o dano adicional de um acerto crítico ou ataque furtivo. Além disso, recebe uma arma natural de mordida (dano 1d8, crítico x2, perfuração). Uma vez por rodada, quando usa a ação agredir para atacar com outra arma, você pode gastar 1 PE para fazer um ataque corpo a corpo extra com a mordida.",
			act: "free",
			cost: 1,
		},
		99: {
			text: "SANGUE: Você se move como uma criatura bestial; não existe sensibilidade ou empatia. Apenas o instinto e a necessidade de consumir mais. Se o resultado é devorar, essa é a decisão correta. Pensamentos são esporádicos e raros, como pequenos sustos de humanidade que são engolidos pelo fluxo que banha o Outro Lado. Seu Intelecto diminui em –1 e sua Força aumenta em +1. Sempre que causa dano com sua mordida em um ser, você recupera 5 PV (esse ganho também é multiplicado em um acerto crítico). Além disso, você aprende o ritual Forma Monstruosa. Entretanto, seu desejo de assumir essa forma pode sobrepujar sua própria vontade; sempre que sofre dano, você deve fazer um teste de Vontade (DT 10 + o dano sofrido). Se falhar e não estiver sob efeito de Forma Monstruosa, sua próxima ação padrão deve ser conjurar esse ritual (se não puder, você perde a ação).",
			fx: [
				{ name: "Ser Aterrorizante (Sangue): Intelecto −1", key: "system.attributes.int.value", value: -1 },
				{ name: "Ser Aterrorizante (Sangue): Força +1", key: "system.attributes.str.value", value: 1 },
			],
		},
	},
	morte: {
		label: "Morte",
		10: {
			text: `MORTE: Você fica pálido e seu metabolismo se torna bem mais lento. Você recebe resistência a perfuração e Morte 5 e imunidade a fadiga e soma sua Força em seu total de pontos de vida, mas sofre –${D} em Diplomacia e Enganação.`,
			fx: [{ name: "Etapa ritualística (Morte): +Força em PV", key: "system.PV.bonus", value: "@attributes.str.value", ...R }],
		},
		40: {
			text: `MORTE: Roupas modernas e complexas não parecem fazer sentido pra você. Seus trajes são anacrônicos e simples, às vezes adornado de cristais, esqueletos de pequenas criaturas pendurados, pedras, raízes e plantas mortas. Você recebe +${D} em Intimidação e pode usar Vigor para calcular seus pontos de esforço (em vez de Presença). Além disso, morre se iniciar quatro turnos morrendo na mesma cena (e não apenas três) e não precisa mais comer ou beber para viver, mas ainda sofre da fome paranormal causada por essa trilha.`,
		},
		65: {
			text: "MORTE: O Lodo preto da Morte faz parte do seu consumo diário, ele se espalha pelo seu organismo apodrecendo seu sistema, mantendo-o vivo através da morte. Não é incomum você ser considerado um “acumulador de lixo”: é difícil diferenciar um animal vivo de um galho morto, pois perante a Morte todas as coisas são iguais. No início de cada turno em que estiver morrendo, você pode fazer um teste de Vigor (DT 15). Se passar, encerra a condição morrendo e acorda com 1 PV. Além disso, sempre que faz um acerto crítico em combate ou reduz um inimigo a 0 PV, você recupera 2 PE.",
		},
		99: {
			text: "MORTE: Você está morto, mas ainda é forçado a existir. Sua aparência é a de um cadáver apodrecido, todos os seus órgãos foram consumidos pela Morte e, por dedicar sua existência inteira à entidade, você se tornou imortal. Preso na eternidade de cada segundo, você ainda é arrastado pela Realidade pela percepção alheia, pois mesmo que sua mente tenha se tornado o próprio tempo, todas as coisas precisam de um fim. Sua Presença diminui em –1 e seu Vigor aumenta em +1. Você recebe imunidade a dano de Morte e se torna imortal (se morrer, você volta à vida no dia seguinte, sendo “restaurado” pelo Lodo). Entretanto, se for reduzido a 0 PV por dano de fogo ou Energia, seu Lodo é destruído e você não retorna à vida. Por fim, você aprende o ritual Fim Inevitável.",
			fx: [
				{ name: "Ser Aterrorizante (Morte): Presença −1", key: "system.attributes.pre.value", value: -1 },
				{ name: "Ser Aterrorizante (Morte): Vigor +1", key: "system.attributes.vit.value", value: 1 },
			],
		},
	},
	conhecimento: {
		label: "Conhecimento",
		10: {
			text: `CONHECIMENTO: Seus olhos são banhados em um dourado sobrenatural. Você recebe resistência a balístico e Conhecimento 5 e visão no escuro e soma seu Intelecto na Defesa, mas sofre –${D} em Atletismo e Acrobacia.`,
			fx: [{ name: "Etapa ritualística (Conhecimento): +Intelecto na Defesa", key: "system.defense.value", value: "@attributes.int.value", ...R }],
		},
		40: {
			text: "CONHECIMENTO: Você está sempre vestindo joias de ouro puro ou roupas com ouro em suas linhas. Seu corpo está quase inteiramente coberto de palavras que evocam medo, como famosas últimas frases ou pedidos de socorro. Você já sabe que é superior a todos eles. Seu Intelecto aumenta em +1. Além disso, você pode usar Intelecto como atributo-chave para Enganação e para calcular seus pontos de esforço (em vez de Presença).",
			fx: [
				{ name: "Etapa ritualística (Conhecimento): Intelecto +1", key: "system.attributes.int.value", value: 1, ...R },
			],
		},
		65: {
			text: `CONHECIMENTO: Você injeta e ingere ouro líquido esporadicamente e não há mais espaço para tatuagens. Ler, reler e escrever novos registros faz parte da sua rotina extremamente organizada e metódica. Você pode deixar de ser treinado em uma de suas perícias para receber um número de dados de bônus igual ao seu Intelecto. Até o fim da cena, sempre que fizer um teste, você pode gastar um desses dados de bônus para receber +${D} nesse teste. Você recupera todas as perícias treinadas perdidas dessa forma ao final de seu próximo interlúdio.`,
		},
		99: {
			text: "CONHECIMENTO: Sua boca desapareceu após você costurá-la com fios dourados, pois ninguém é digno do seu ensinamento. Seus olhos aumentaram e ficaram mais profundos, com escleras negras. Todos os seus membros se alongaram e ficaram mais finos. Suas tatuagens e textos se converteram em sigilos do Outro Lado. A verdade que você deve esquecer está atrás de uma porta dourada, e você consegue enxergá-la, mas sabe que ao abri-la, irá perder tudo. Sua Força diminui em –1 e seu Intelecto aumenta em +1. Além disso, você recebe Percepção às Cegas e aprende um ritual de Conhecimento de 4º círculo a sua escolha. Entretanto, sempre que conjura esse ritual, você perde a memória de tudo que vivenciou desde o início da cena.",
			fx: [
				{ name: "Ser Aterrorizante (Conhecimento): Força −1", key: "system.attributes.str.value", value: -1 },
				{ name: "Ser Aterrorizante (Conhecimento): Intelecto +1", key: "system.attributes.int.value", value: 1 },
			],
		},
	},
	energia: {
		label: "Energia",
		10: {
			text: `ENERGIA: Sua pele ganha cicatrizes de queimaduras elétricas com múltiplas cores. Você recebe resistência a corte, eletricidade, fogo e Energia 5 e soma sua Agilidade na RD recebida por um bloqueio bem-sucedido, mas sofre –${D} em Investigação e Percepção.`,
		},
		40: {
			text: "ENERGIA: Você está sempre vestindo roupas complexas e modernas, com luzes brilhantes e dispositivos conectados a baterias e à sua pele para receber pequenos choques estimulantes. Você pode usar Agilidade como atributo-chave para calcular seus pontos de esforço (em vez de Presença). Além disso, quando acerta um ataque corpo a corpo, pode gastar 1 ou mais PE (limitado por sua Agilidade). Se fizer isso, seu ataque causa +1d6 pontos de dano de Energia para cada 1 PE gasto.",
			act: "free",
			cost: 1,
		},
		65: {
			text: "ENERGIA: A intensidade dos choques aumenta, além de ter conectado em suas veias pequenos tubos para gotejamento de ácido. Respirar através de uma máscara de gás para inalar alucinógenos a todo momento deixa tudo mais divertido, colorido e caótico. Sua resistência a dano passa a se aplicar também a dano químico. Além disso, você pode extrair energia de fontes elétricas; para isso, deve gastar uma ação de movimento e tocar uma fonte de eletricidade. Você recupera uma quantidade de PE conforme o tipo de fonte: 1d4 PE para um dispositivo portátil, como um tablet ou celular, 2d4 PE para um dispositivo grande, como uma moto ou um carro elétrico, e 4d4 para uma fonte do tamanho de uma casa. Usar este efeito descarrega completamente a fonte e sobrecarrega seus circuitos, que se tornam incapazes de transmitir energia.",
			act: "movement",
		},
		99: {
			text: "ENERGIA: Tudo faz parte de você e você é tudo. Você se tornou uma metamorfose ambulante, assumindo uma forma plasmática que não pode ser descrita nem como líquida, sólida ou gasosa. Seu corpo flutua alguns centímetros acima do chão e não é mais possível segurar objetos, afinal tudo que você toca também se torna parte de você enquanto está em contato. Seus traços físicos mudam constantemente e você não pode ser mais descrito com apenas uma aparência definitiva. Decisões lógicas não fazem mais parte da sua vida, o Caos é inevitável. Sua Força diminui em –1 e sua Agilidade aumenta em +1. Você pode pairar a 1,5m do chão com deslocamento 12m (o que permite que ignore terreno difícil e o torna imune a dano por queda), pode passar por qualquer espaço por onde uma criatura Minúscula poderia passar e se torna imune a condições de paralisia de origem física (como ser agarrado ou enredado). Por fim, você aprende o ritual Deflagração de Energia. Entretanto, você não pode mais se beneficiar de itens vestidos e, por não ter corpo físico, só consegue manipular objetos com sua mente; você pode manipular um objeto dessa forma por vez, e apenas objetos que poderia manipular com suas duas mãos.",
			fx: [
				{ name: "Ser Aterrorizante (Energia): Força −1", key: "system.attributes.str.value", value: -1 },
				{ name: "Ser Aterrorizante (Energia): Agilidade +1", key: "system.attributes.dex.value", value: 1 },
			],
		},
	},
};

export const MONSTRUOSO_COMMON = { 10: MONSTRUOSO_COMMON_10, 40: MONSTRUOSO_COMMON_40, 65: MONSTRUOSO_COMMON_65, 99: MONSTRUOSO_COMMON_99 };

// Presença −1 permanente a partir do NEX 65% (vale para os quatro elementos).
export const MONSTRUOSO_PRESENCE_FX = { name: "Ser Assustador: Presença −1", key: "system.attributes.pre.value", value: -1 };

// ---------------------------------------------------------------- Descrições das trilhas (item "path")
export const PATH_TEXT = {
	"Agente Secreto":
		"Às vezes, um governo precisa lidar com um problema de forma discreta — por precisar operar fora de sua jurisdição, para não assustar a população ou por vários outros motivos. Quando esse é o caso, usam-se agentes secretos, indivíduos treinados para trabalhar sozinhos ou em pequenos grupos, que contam apenas com suas próprias habilidades, determinação e sorrisos carismáticos. Você se tornou um desses agentes e, por suas capacidades, foi escolhido para a missão mais confidencial de todas — trabalhar com a Ordo Realitas para proteger a humanidade contra o Outro Lado.",
	"Caçador":
		"Em um mundo cheio de predadores sobrenaturais, você decidiu não ser mais uma presa. Valendo-se de relatos de segunda mão, notícias de jornais e relatórios de incidentes inexplicáveis, você reúne informações sobre como caçar as coisas que espreitam na escuridão.",
	"Monstruoso":
		"Muito se fala sobre os ocultistas escolherem o caminho de tornarem sua mente uma porta para o paranormal, na tentativa de usá-lo contra ele mesmo, mas de vez em quando, um combatente é corajoso ou insano o bastante para fazer o mesmo com seu corpo. Você propositalmente desfigura e altera seu corpo para que as Entidades o invadam com maior intensidade; contudo, para sua infelicidade, os métodos para isso costumam ser brutais. Combatentes dessa trilha que chegam aos níveis mais altos de exposição inevitavelmente perdem o controle e se tornam inimigos da Ordem.\n\nEspecial: esta trilha usa a “Progressão de NEX” apresentada na regra opcional Nível de Experiência e Nível de Exposição (p. 98), mesmo que esta regra em si não esteja sendo usada. O personagem recebe todas as alterações apropriadas ao seu NEX descritas na progressão e, se a regra de Nível de Experiência estiver em uso, recebe o dobro de NEX sempre que se expõe ao paranormal.\n\nMonstruosa transformação. Apesar dos alertas e resultados anteriores desastrosos, a tentação de usar o paranormal contra si mesmo é muito grande. Alguns agentes, movidos por orgulho, ingenuidade ou desespero, acabam seguindo esse caminho, acreditando que com eles “será diferente”, e que eles serão aqueles que conseguirão fitar as Entidades e usar seu poder para o bem. Eles sempre estão errados.\n\nA trilha monstruoso representa uma busca por poder contra o Outro Lado que fatalmente se volta contra o personagem, e cobra o maior dos preços: a perda gradual da humanidade. Quando o personagem atinge NEX 75%, se torna permanentemente perturbado. Suas ações já não são mais aceitas pela Ordem, que vai banir e potencialmente caçar o ex-agente. Um personagem nessa situação ainda pode auxiliar seus antigos colegas, mas perde todo o suporte da Ordem, incluindo acesso a equipamentos (considere que ele começa cada missão com equipamento equivalente a uma patente um nível inferior à sua, conseguido por conta própria).\n\nQuando o personagem atinge NEX 99%, entretanto, sua situação se torna ainda mais severa: sua mente e seu corpo estão no limiar de serem completamente consumidos pelo Outro Lado. Nesse ponto, sua Sanidade é reduzida a 1. Por fim, sempre que ficar enlouquecendo, em vez de sofrer um efeito de insanidade (veja OPRPG, p. 111), o personagem fica confuso (a condição se encerra normalmente ou quando o personagem não está mais enlouquecendo). Se um personagem Monstruoso enlouquecer com 99% de NEX, se torna permanentemente uma criatura do Outro Lado.\n\nSe estiver usando a regra opcional Jogando sem Sanidade (p. 104), em vez disso considere que o personagem está sempre perturbado e fica enlouquecendo (e confuso) sempre que perde 1 ponto de determinação por qualquer efeito (exceto por pagar custos de habilidades e itens).",
	"Bibliotecário":
		"Poucas pessoas lêem tanto quanto você, mas diferente do que imaginam, passar a vida cercado de conhecimento não o torna menos apto. Na verdade, seu vasto conhecimento é muitas vezes a única solução para situações desesperadoras. Alguém precisa ser a chave dos segredos. Alguém precisa saber, mesmo que isso signifique perder.",
	"Muambeiro":
		"Você sempre foi bom em lidar com equipamentos, e aprendeu como produzir ou encontrar, os itens certos em qualquer ocasião. Esse talento pode ser fundamental para manter todos em sua equipe vivos.",
	"Perseverante":
		"Você sabe que é um sobrevivente. Talvez tenha sido o único a escapar com vida de uma grande tragédia, ou simplesmente possua o espírito necessário para perseverar onde todos os outros caíram. Em filmes de terror, os monstros e assassinos costumam pegar suas vítimas isoladas uma a uma com facilidade, até se depararem com uma protagonista resiliente e que parece nunca desistir. Seja por experiência ou instinto, você tem certeza que se estivesse em um desses filmes, seria o último sobrevivente a sair vivo no final.",
	"Exorcista":
		"Da escuridão da noite, quando as sombras se tornam mais densas, emerge um chamado desesperado. Um grito sufocado pela presença maligna que assola uma alma atormentada. É então que o exorcista se ergue para enfrentar o paranormal. Com sua fé como escudo e suas palavras como espada, independente de sua religião ou crença, você mergulha na escuridão, onde a Realidade e o Outro Lado travam uma batalha pelo medo humano.",
	"Possuído":
		"Você nunca quis contato com o Outro Lado, mas ele parece ter especialmente escolhido você para perseguir. Desde que consegue lembrar, você estava predestinado a essa maldição, como se o paranormal estivesse crescendo em seu interior antes mesmo de seu nascimento… E assim, você foi empurrado para uma batalha sem fim… Sem opção, só lhe resta lutar, enquanto o paranormal dentro de você aflora cada vez mais.",
	"Parapsicólogo":
		"Você esteve em um meio de pessoas dedicadas a cuidar da mente humana… Mas, quando descobriu a maior ameaça para a nossa psique, descobriu também que seus colegas não passavam de tolos céticos. Quando você falou sobre o paranormal, eles apenas riram. Desprezado pela academia, você decidiu perseguir a verdade sozinho. Afinal, a diferença entre o remédio e o veneno é a dosagem. Se o paranormal pode ser usado para perturbar, também pode ser usado para sanar. Ele só precisa ser estudado, analisado e aplicado por alguém competente como você, mesmo que isso custe sua vida.\n\nEspecial: para escolher esta trilha, você precisa ser treinado em Profissão (psicólogo).",
};

// ---------------------------------------------------------------- Ajustes em habilidades de trilha já cadastradas
// text = texto integral do livro; fx = efeitos passivos. Só as habilidades com diferença/efeito entram aqui.
export const PATH_ABILITY_PATCH = {
	"NEX 40% - O Sorriso": {
		fx: [
			{ name: "O Sorriso (+2 Diplomacia)", key: "system.skills.diplomacy.mod", value: 2 },
			{ name: "O Sorriso (+2 Enganação)", key: "system.skills.deception.mod", value: 2 },
		],
	},
	"NEX 10% - Mascate": { fx: [{ name: "Mascate (+5 espaços de carga)", key: "system.spaces.bonus.max", value: 5 }] },
	"NEX 99% - A Força do Saber": {
		fx: [
			{ name: "A Força do Saber (Intelecto +1)", key: "system.attributes.int.value", value: 1 },
			{ name: "A Força do Saber (+Intelecto em PE)", key: "system.PE.bonus", value: "@attributes.int.value + 1" },
		],
	},
};

// ---------------------------------------------------------------- Classe Sobrevivente (p. 30–33)
export const SURVIVOR_CLASS_TEXT = `<p>Sobrevivendo ao Horror traz uma nova classe específica para histórias de terror: o sobrevivente. Esta classe representa pessoas comuns que se veem em meio a ameaças terríveis, como assassinos psicopatas, mansões amaldiçoadas, cultos macabros ou mesmo criaturas do Outro Lado.</p><p>Como indivíduos normais, sobreviventes são muito mais fracos que combatentes, especialistas ou ocultistas, que possuem treinamento especial. Em outras palavras, esta nova classe não é equilibrada com as três classes originais! Isso é de propósito, para oferecer uma experiência de jogo diferente.</p><p><strong>Pontos de vida:</strong> 8 + Vig (+2 a cada novo estágio). <strong>Pontos de esforço:</strong> 2 + Pre (+1 a cada novo estágio). <strong>Sanidade:</strong> 8 (+2 a cada novo estágio). <strong>Perícias treinadas:</strong> escolha 1 + Intelecto perícias. <strong>Proficiências:</strong> armas simples.</p><p><strong>Estágios:</strong> 1 Empenho · 2 Trilha (1º poder) · 3 Aumento de atributo · 4 Trilha (2º poder) · 5 Cicatrizado. O limite de PE é sempre 1, em qualquer estágio, mas você sempre pode usar pelo menos uma habilidade em seu custo mínimo por turno.</p><p><strong>Atributos:</strong> você começa com cada atributo em 1 e recebe apenas 3 pontos para distribuir (pode reduzir um único atributo para 0 para receber 1 ponto adicional). <strong>Equipamento:</strong> sem patentes; escolha um item de categoria I e quantos itens de categoria 0 quiser, desde que sejam itens que você pudesse ter por sua origem.</p><p>Personagens sobreviventes possuem NEX 0% e sua evolução é medida em estágios: um sobrevivente começa no estágio 1 e, no fim de cada missão, sobe um estágio.</p><p><strong>Treinamento especial.</strong> É possível mudar de sobrevivente para outra classe, dependendo da história. Na próxima vez que ele subir de estágio, em vez de subir como sobrevivente, se torna um personagem de NEX 5% da classe escolhida e recebe: <em>Combatente:</em> +8 PV; perícias: Fortitude ou Reflexos e Luta ou Pontaria; proficiências: Armas Táticas e Proteções Leves; habilidades: Ataque Especial. <em>Especialista:</em> +4 PV, +1 PE, +4 SAN; perícias: 6 a sua escolha; proficiências: Proteções Leves; habilidades: Eclético e Perito. <em>Ocultista:</em> +2 PE, +8 SAN; perícias: Ocultismo e Vontade mais 2 a sua escolha; proficiências: nenhuma; habilidades: Escolhido pelo Outro Lado. A partir disso, o personagem não sobe mais estágios como sobrevivente (mas mantém todas as habilidades já recebidas) e passa a subir de NEX como combatente, especialista ou ocultista.</p>`;

// Habilidades de classe e de trilha do Sobrevivente (compêndio survivalPowers).
// kind "class": concedida pela classe (stage = estágio mínimo). kind "path": pasta = trilha.
export const SURVIVOR_ABILITIES = [
	{
		name: "Empenho",
		kind: "class",
		stage: 1,
		act: "free",
		cost: 1,
		text: "Você pode não ter treinamento especial, mas compensa com dedicação e esforço. Quando faz um teste de perícia, você pode gastar 1 PE para receber +2 nesse teste.",
	},
	{
		name: "Aumento de Atributo",
		iconKey: "empenho",
		kind: "class",
		stage: 3,
		act: "passive",
		text: "No 3º estágio, aumente um atributo a sua escolha em +1. Você não pode aumentar um atributo desta forma além de 3. Note que, se você aumentar Vigor, aumentará seus PV; se aumentar Presença, aumentará seus PE, e, se aumentar Intelecto, ganhará uma nova perícia treinada.",
		isNew: true,
	},
	{
		name: "Cicatrizado",
		kind: "class",
		stage: 5,
		act: "reaction",
		text: `No 5º estágio, você já viu — e sobreviveu — a sua cota de horrores. Isso deixou marcas em seu corpo e sua mente, mas também o deixou mais forte. Escolha um tipo de perigo paranormal que seu personagem já enfrentou, de um elemento específico (Sangue, Morte…). Você possui algum trauma em relação a esse perigo e sofre –${D} em testes de resistência contra ele. Contudo, uma vez por sessão de jogo você pode se esforçar ao máximo para não se deixar cair ou se abater. Como uma reação, você pode sacrificar 1 PV permanentemente para ignorar um dano mental ou gasto de PE, ou pode sacrificar permanentemente 1 PE para reduzir um dano físico à metade.`,
	},
	{
		name: "Estágio 2 - Durão",
		oldName: "Durão",
		kind: "path",
		path: "Durão",
		stage: 2,
		act: "passive",
		text: "Você recebe +4 PV. Quando subir para o 3º estágio, recebe +2 PV.",
		fx: [{ name: "Durão (+4 PV, +2 no 3º estágio)", key: "system.PV.bonus", value: "4 + (@stage.value >= 3 ? 2 : 0)" }],
	},
	{
		name: "Estágio 4 - Pancada Forte",
		oldName: "Pancada Forte",
		kind: "path",
		path: "Durão",
		stage: 4,
		act: "free",
		cost: 1,
		text: `Quando faz um ataque, você pode gastar 1 PE para receber +${D} no teste de ataque. Se você se tornar um combatente (veja “Treinamento Especial”), perde esta habilidade, mas reduz o custo de ativação de Ataque Especial em –1 PE.`,
	},
	{
		name: "Estágio 2 - Esperto",
		oldName: "Esperto",
		kind: "path",
		path: "Esperto",
		stage: 2,
		act: "passive",
		text: "Você se torna treinado em uma perícia adicional a sua escolha.",
	},
	{
		name: "Estágio 4 - Entendido",
		oldName: "Entendido",
		kind: "path",
		path: "Esperto",
		stage: 4,
		act: "free",
		cost: 1,
		text: "Escolha duas perícias nas quais você é treinado (exceto Luta e Pontaria). Quando faz um teste de uma dessas perícias, você pode gastar 1 PE para somar +1d4 no resultado do teste. Se você se tornar um especialista (veja “Treinamento Especial”), perde esta habilidade, mas reduz o custo de ativação de Perito em –1 PE.",
	},
	{
		name: "Estágio 2 - Esotérico",
		oldName: "Esotérico",
		kind: "path",
		path: "Esotérico",
		stage: 2,
		act: "default",
		cost: 1,
		text: "Você pode gastar uma ação padrão e 1 PE para sentir energias paranormais em alcance curto. Isso pode dar alguma pista em uma investigação ou alertá-lo de algum perigo iminente. O mestre dirá quais informações você consegue obter, se houver.",
	},
	{
		name: "Estágio 4 - Iniciado",
		oldName: "Iniciado",
		kind: "path",
		path: "Esotérico",
		stage: 4,
		act: "passive",
		text: "Você aprende e pode conjurar um ritual de 1º círculo a sua escolha. Se você se tornar um ocultista (veja “Treinamento Especial”), soma este ritual aos três rituais que aprende com Escolhido pelo Outro Lado.",
	},
];

export const SURVIVOR_PATHS = [
	{ name: "Durão", text: "Você é um indivíduo resistente, que consegue defender a si mesmo ou aos outros em situações de perigo. Pode ser um atleta, segurança, trabalhador da construção civil etc." },
	{ name: "Esperto", text: "Você é um estudante, técnico, engenheiro ou outra pessoa equipada com conhecimento, inteligência e persuasão." },
	{ name: "Esotérico", text: "Você é uma pessoa ligada a aspectos espirituais do mundo, como religiões, astrologia e cartomancia, ou apenas possui um sexto sentido em relação ao paranormal e ao Outro Lado." },
];

// Possuído, NEX 99%: o livro lista quatro poderes e o personagem recebe um (o do elemento de afinidade).
// Em vez de conceder os quatro automaticamente, a habilidade é uma só e traz as quatro opções.
export const POSSUIDO_99 = {
	name: "NEX 99% - Tornamo-nos Um",
	act: "free",
	cost: 6,
	text: "Desabrochando em seu interior, o paranormal se manifesta como uma dádiva poderosa. Baseado no elemento com que tem afinidade, você recebe um dos poderes a seguir.\n\nPresente da Obsessão (Sangue). Uma vez por rodada, você pode gastar 6 PE para recuperar 50 PV. Quando faz isso, até o início do seu próximo turno, os bônus por treinamento em suas perícias baseadas em Força e Vigor, e em Intimidação, mudam para +35. As demais perícias baseadas em Presença mudam para –10. Você pode ativar esse poder mesmo inconsciente.\n\nPresente do Tempo (Morte). Uma vez por rodada, você pode gastar 6 PE para receber um turno adicional na última contagem de iniciativa da rodada. Você pode ativar essa habilidade mesmo inconsciente.\n\nPresente do Saber (Conhecimento). Uma vez por cena, você pode gastar 6 PE para reescrever uma fração de seu próprio ser. Você recebe um poder qualquer até o fim da cena. Você deve cumprir os pré-requisitos do poder escolhido, e não pode escolher poderes de trilha de NEX 99%. A cada vez que usa este poder, você deve fazer um teste de Vontade (DT 15 + 5 para cada vez que usou este poder na mesma missão). Se falhar, perde 1d6 pontos de Sanidade para cada vez que usou esse poder nesta missão.\n\nPresente do Espaço (Energia). Uma vez por rodada, você pode gastar 6 PE para se teletransportar para outro ponto em alcance médio. Você não precisa conhecer o local para onde vai nem precisa vê-lo, mas se teletransportar-se para um espaço ocupado vai ser arremessado para o espaço disponível mais próximo.",
};

// Execução/custo corrigidos conforme o texto do livro (o cadastro antigo trazia valores trocados).
export const PATH_META = {
	"NEX 99% - Estudar a Presa": { act: "passive", cost: 0 },
	"NEX 65% - Determinação Inquestionável": { act: "default", cost: 5 },
	"NEX 99% - Só Mais um Passo...": { act: "reaction", cost: 5 },
	"NEX 99% - Chagas da Resistência": { act: "reaction", cost: 0 },
	"NEX 10% - Terapia": { act: "reaction", cost: 2 },
};

// Nomes com a grafia do livro ("Nex" → "NEX", "Palavras-Chave" → "Palavras-chave").
export const PATH_RENAME = {
	"Nex 10% - Terapia": "NEX 10% - Terapia",
	"Nex 40% - Palavras-Chave": "NEX 40% - Palavras-chave",
	"Nex 65% - Reprogramação Mental": "NEX 65% - Reprogramação Mental",
	"Nex 99% - A Sanidade Está Lá Fora": "NEX 99% - A Sanidade Está Lá Fora",
};
