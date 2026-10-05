// Origens do suplemento Sobrevivendo ao Horror v1.3 (páginas impressas 7–13).
// "[d]" = símbolo de dado do livro; o gerador troca por @DisplayDice. "fx" = efeitos passivos aplicados à ficha.
// Chaves de efeito: system.PV.bonus, system.skills.<perícia>.mod, system.desloc.value, system.spaces.bonus.max ...

export const ORIGINS = [
	{
		name: "Amigo dos Animais",
		oldName: "Amigo dos Animais",
		icon: "amigo-dos-animais.webp",
		credit: "Gabriela “Louie” | Arsenal Paranormal",
		narrative:
			"Você desenvolveu uma conexão muito forte com outros seres: os animais. Seja por nunca ter se dado muito bem com humanos ou por preferir a companhia de um melhor amigo de quatro patas, você leva sua vida ao lado de um bichano e até mesmo aprende com a natureza perceptiva deles.",
		skills: "Adestramento e Percepção.",
		power: {
			name: "Companheiro Animal",
			icon: "companheiro-animal.svg",
			text: "Você consegue entender as intenções e sentimentos de animais, e pode usar Adestramento para mudar a atitude deles. Além disso, você possui um melhor amigo, um animal que cresceu com você e pelo qual tem profundo apego. Ele conta como um aliado que fornece +2 em uma perícia a sua escolha (aprovada pelo mestre). Quando você alcança NEX 35%, ele também passa a fornecer o bônus de um aliado de um tipo a sua escolha (aprovado pelo mestre). Por fim, quando você alcança NEX 70%, ele fornece a habilidade do tipo de aliado escolhido. Perder seu parceiro é muito doloroso. Se ele morrer, você perde 10 pontos de Sanidade permanentemente, além de ficar perturbado até o fim da cena. Como encontrar um novo companheiro fica a critério do mestre, mas geralmente será uma ação entre missões.",
			act: "passive",
		},
	},
	{
		name: "Astronauta",
		oldName: "Astronauta",
		icon: "astronauta.svg",
		narrative:
			"Outrora limitada a membros de algumas agências espaciais estatais, a profissão de explorador espacial se tornou mais acessível conforme mais países, e até mesmo empresas privadas, se envolveram com viagens na fronteira final. Como um astronauta, você se acostumou à pressão de ser responsável pela vida de seus colegas e por experimentos de milhões de reais. E foi na escuridão do espaço que você descobriu que não estamos sozinhos.",
		skills: "Ciências e Fortitude.",
		power: {
			name: "Acostumado ao Extremo",
			icon: "acostumado-ao-extremo.svg",
			text: "Quando sofre dano de fogo, de frio ou mental, você pode gastar 1 PE para reduzir esse dano em 5. A cada vez que usa esta habilidade novamente na mesma cena, seu custo aumenta em +1 PE.",
			act: "reaction",
			cost: 1,
		},
	},
	{
		name: "Chef do Outro Lado",
		oldName: "Chef do Outro Lado",
		icon: "chef-do-outro-lado.webp",
		credit: "Julie Sathler | Ateliê Secreto",
		narrative:
			"Você nunca foi muito bom na culinária convencional. Depois de sobreviver ao paranormal, entretanto, descobriu um talento que é considerado um grande tabu até mesmo pelos ocultistas mais experientes: cozinhar e ingerir entidades do Outro Lado. Acreditando estar realizando algum tipo de arte gastronômica esotérica, ou simplesmente por se render a impulsos incontroláveis, você elabora pratos nunca vistos antes misturando ingredientes comuns da Realidade com aquilo que não deveria existir. Você é a prova viva do ditado popular: “tem gosto pra tudo”.",
		skills: "Ocultismo e Profissão (cozinheiro).",
		power: {
			name: "Fome do Outro Lado",
			icon: "fome-do-outro-lado.svg",
			text: "Você pode usar partes de criaturas do Outro Lado como ingredientes culinários. No início de cada missão você pode solicitar essas partes como itens de Categoria I que ocupam 0,5 espaço, e pode obtê-las de criaturas derrotadas (cada criatura Pequena ou maior fornece 1 ingrediente paranormal). Você pode gastar uma ação de interlúdio e 1 ingrediente para preparar um prato especial; faça um teste de Profissão (cozinheiro) com DT 15 + [d] (o mestre oculta o resultado do teste até alguém comer o prato). Se você passar no teste, o prato fornece RD 10 contra o tipo de dano do elemento da criatura cujo ingrediente foi usado. Caso contrário, o prato causa vulnerabilidade a esse tipo de dano. Os efeitos duram até o fim da próxima cena.\n\nIndependentemente do resultado, se alimentar do paranormal, por menor que seja a porção, gera consequências brutais e permanentes em seu organismo, sendo uma das formas mais rápidas de destruir sua mente. A cada refeição consumida, você perde 1 ponto permanente de Sanidade. Além disso, se estiver usando a regra opcional Nível de Experiência e Nível de Exposição (p. 98), o NEX do personagem aumenta em 3% para cada parte de criatura diferente que ingerir (mesmo que não esteja usando essa regra, use as alterações descritas na regra para personagens que ingerem partes de criaturas dessa forma). A coragem para se beneficiar desses pratos é algo muito mais presente em grupos de cultistas e, por todas essas razões, não é uma ação apoiada pela Ordo Realitas.",
			act: "passive",
		},
	},
	{
		name: "Colegial",
		oldName: "Colegial",
		icon: "colegial.svg",
		narrative:
			"Você era um aluno do colegial e tinha uma rotina baseada nos estudos, nas amizades e nos dramas típicos de alguém da sua idade, até que um encontro com o paranormal mudou sua vida. Tendo se unido à Ordem com uma mentalidade juvenil e pouca experiência de vida, você descobriu que sua verdadeira força está nos amigos que fizer pelo caminho.",
		skills: "Atualidades e Tecnologia.",
		power: {
			name: "Poder da Amizade",
			icon: "poder-da-amizade.svg",
			text: "Escolha um personagem para ser seu melhor amigo. Se estiver em alcance médio dele e vocês puderem, pelo menos, trocar olhares, você recebe +2 em todos os testes de perícia. Entretanto, se ele morrer, seu total de PE é reduzido em –1 para cada 5% de NEX até o fim da missão. Se perder seu melhor amigo, você pode escolher outro entre os demais personagens no início da próxima missão.",
			act: "passive",
		},
	},
	{
		name: "Cosplayer",
		oldName: "Cosplayer",
		icon: "cosplayer.webp",
		credit: "Rafael “Damnu” e Victor Moda | Toca dos Monstros",
		narrative:
			"Você é apaixonado pela arte do cosplay e dedicou sua vida a criar a melhor fantasia possível. Constantemente questionado por pessoas que confundem seus gostos e preferências artísticas com acusações ignorantes, você se acostumou a seguir em frente. Confrontado com o paranormal, você colocou sua arte, e sua resiliência, a serviço da Ordem.",
		skills: "Artes e Vontade.",
		power: {
			name: "Não É Fantasia, É Cosplay!",
			icon: "nao-e-fantasia-e-cosplay.svg",
			text: "Você pode fazer testes de disfarce usando Artes em vez de Enganação. Além disso, ao fazer um teste de perícia, se estiver usando um cosplay que tem relação com ele, você recebe +2. Por exemplo, se estiver vestido de James Bones, o gato agente secreto do famoso videogame arcade dos anos 90, você recebe +2 em testes para ser furtivo, se equilibrar e outras coisas nas quais um gato seria considerado eficiente.",
			act: "passive",
		},
	},
	{
		name: "Diplomata",
		oldName: "Diplomata",
		icon: "diplomata.svg",
		narrative:
			"Você atuava em uma área onde as habilidades sociais e políticas eram ferramentas indispensáveis. Talvez fosse representante comercial de uma empresa, membro de um partido político ou embaixador do governo. Em algum momento, entretanto, você teve uma experiência paranormal que revelou entidades com as quais não se é possível negociar. Agora, você usa os contatos que adquiriu para combater o Outro Lado.",
		skills: "Atualidades e Diplomacia.",
		power: {
			name: "Conexões",
			icon: "conexoes.svg",
			text: "Você recebe +2 em Diplomacia. Além disso, se puder contatar um NPC capaz de lhe auxiliar, você pode gastar 10 minutos e 2 PE para substituir um teste de uma perícia relacionada ao conhecimento desse NPC, feito até o fim da cena, por um teste de Diplomacia.",
			act: "default",
			cost: 2,
			fx: [{ name: "Conexões (+2 Diplomacia)", key: "system.skills.diplomacy.mod", value: 2 }],
		},
	},
	{
		name: "Explorador",
		oldName: "Explorador",
		icon: "explorador.svg",
		credit: "Guilherme “Guirassol” e João Vitor “Vapor” | Arquivo do Medo",
		narrative:
			"Você é uma pessoa que se interessa muito por história ou geografia, frequentemente embarcando em trilhas e explorações para enriquecer seus estudos. Suas aventuras tornaram seu corpo mais resistente e capaz de se manter firme mesmo nas situações mais adversas. No entanto, um encontro trágico com o paranormal marcou sua jornada.",
		skills: "Fortitude e Sobrevivência.",
		power: {
			name: "Manual do Sobrevivente",
			icon: "manual-do-sobrevivente.svg",
			text: "Ao fazer um teste para resistir a armadilhas, clima, doenças, fome, sede, fumaça, sono, sufocamento ou veneno, incluindo de fontes paranormais, você pode gastar 2 PE para receber +5 nesse teste. Além disso, em cenas de interlúdio, você considera condições de sono precárias como normais.",
			act: "reaction",
			cost: 2,
		},
	},
	{
		name: "Experimento",
		oldName: "Experimento",
		icon: "experimento.svg",
		narrative:
			"Você foi uma cobaia em um experimento físico. Pode ter sido um voluntário em um procedimento experimental legítimo, ou submetido a experimentos científicos ou paranormais contra sua vontade. Qualquer que seja a natureza desse evento, causou alterações permanentes em seu corpo, como um cheiro forte de químicos, cicatrizes ou manchas estranhas, ou outra metamorfose claramente antinatural. Elas concedem capacidades extraordinárias, mas trazem um estigma que provoca reações negativas em outras pessoas.",
		skills: "Atletismo e Fortitude.",
		power: {
			name: "Mutação",
			icon: "mutacao.svg",
			text: "Você recebe resistência a dano 2 e +2 em uma perícia à sua escolha que seja originalmente baseada em Força, Agilidade ou Vigor. Entretanto, sofre −[d] em Diplomacia.",
			act: "passive",
		},
	},
	{
		name: "Fanático por Criaturas",
		oldName: "Fánatico por Criaturas",
		icon: "fanatico-por-criaturas.svg",
		credit: "Everson “Akkiel” e Yasmim Furtado | Grimório Paranormal",
		narrative:
			"Você sempre foi obcecado pelo sobrenatural. Desde que pode se lembrar, a ideia de encontrar uma criatura o fascina tanto quanto o assusta. Essa faísca fez você se tornar um “caçador de monstros”, dedicando-se a localizar as feras citadas em documentários sensacionalistas. Para você, todo rumor e crendice pode esconder um fundo de verdade. Talvez uma de suas pesquisas o tenha levado diretamente a uma criatura paranormal, ou talvez elas tenham encontrado você primeiro. Afinal, você nunca esteve se escondendo.",
		skills: "Investigação e Ocultismo.",
		power: {
			name: "Conhecimento Oculto",
			icon: "conhecimento-oculto.svg",
			text: "Você pode fazer testes de Ocultismo para identificar criatura a partir de informações como uma imagem, rastros, indícios de sua presença ou outras pistas que o mestre considere suficientes. Se passar, você descobre as características da criatura (conforme descrito na perícia), mas não sua identidade ou tipo específico. Além disso, quando passa em um teste de Ocultismo para identificar criatura, você recebe também +2 em todos os testes contra a criatura até o fim da missão.",
			act: "passive",
		},
	},
	{
		name: "Fotógrafo",
		oldName: "Fotografo",
		icon: "fotografo.svg",
		narrative:
			"Você é um artista visual que usa câmeras para capturar momentos e transmitir histórias através de imagens estáticas. Costumeiramente movido pela paixão de observar o mundo ao seu redor, buscando ângulos únicos e perspectivas singulares para documentar a vida e a sociedade, você não fazia ideia de que encontraria elementos paranormais através de sua lente.",
		skills: "Artes e Percepção.",
		power: {
			name: "Através da Lente",
			icon: "atraves-da-lente.svg",
			text: "Quando faz um teste de Investigação ou de Percepção ou para adquirir pistas olhando através de uma câmera ou analisando fotos, você pode gastar 2 PE para receber +5 nesse teste (um personagem que se move olhando através de uma lente anda à metade de seu deslocamento).",
			act: "free",
			cost: 2,
		},
	},
	{
		name: "Inventor Paranormal",
		oldName: "Inventor Paranormal",
		icon: "inventor-paranormal.webp",
		credit: "Bruno Sargi | C.R.I.S.",
		narrative:
			"A curiosidade e a criatividade fizeram de você uma pessoa que busca constantemente desafiar limites e criar soluções inovadoras, sendo mais de uma vez intitulado como um “cientista louco”. Você teve contato com o paranormal por meio de seus experimentos ou foi procurado pela Ordem porque suas pesquisas chamaram atenção demais. De qualquer forma, o Outro Lado inspira você a utilizar o desconhecido em suas invenções.",
		skills: "Profissão (engenheiro) e Vontade.",
		power: {
			name: "Invenção Paranormal",
			icon: "invencao-paranormal.svg",
			text: "Escolha um ritual de 1º círculo. Você possui um invento paranormal, um item de categoria 0 que ocupa 1 espaço e que permite que você execute o efeito do ritual escolhido. Para ativar o invento, você gasta uma ação padrão (ou a ação necessária para lançar o ritual, o que for maior) e faz um teste de Profissão (engenheiro) com DT 15 +5 para cada ativação na mesma missão. Se passar, o item faz o equivalente a conjurar o ritual em sua forma básica sem pagar seu custo em PE. Se falhar, ele enguiça. Você pode gastar uma ação de interlúdio para fazer a manutenção do seu invento; fazer isso o conserta e redefine sua DT de ativação para 15. Você pode trocar o ritual contido em seu invento no início de cada missão.",
			act: "default",
		},
	},
	{
		name: "Jovem Místico",
		oldName: "Jovem Místico",
		icon: "jovem-mistico.svg",
		credit: "Ramon “PlayRay” e João “Portill” | A Passagem",
		narrative:
			"Você possui uma profunda conexão com sua espiritualidade, suas crenças ou o próprio universo. Essa conexão faz com que você veja o mundo e viva sua vida de forma diferente e peculiar, características que o tornaram mais suscetível a um encontro com o paranormal.",
		skills: "Ocultismo e Religião.",
		power: {
			name: "A Culpa é das Estrelas",
			icon: "a-culpa-e-das-estrelas.svg",
			text: "Escolha um número da sorte entre 1 e 6. No início de cada cena, você pode gastar 1 PE e rolar 1d6. Se o resultado for seu número da sorte, você recebe +2 em testes de perícia até o fim da cena. Caso contrário, na próxima vez que usar esta habilidade, escolha mais um número como número da sorte.\n\nQuando rolar um de seus números da sorte, a quantidade de números volta a 1.",
			act: "free",
			cost: 1,
		},
	},
	{
		name: "Legista do Turno da Noite",
		oldName: "Legista do Turno da Noite",
		icon: "legista-do-turno-da-noite.svg",
		credit: "Ivo “Eddu” e Ana Beatriz “Bix” | Arquivos Confidenciais",
		narrative:
			"Em um trabalho como o seu, é de se esperar que você já tenha visto muita coisa. No entanto, quando o sol se põe, seus colegas vão embora e a luz artificial deixa cantos sombrios do necrotério, talvez você veja mais do que gostaria. Os sons que poderiam ter sido fruto de sua imaginação se revelaram mais do que um truque da sua própria mente, fazendo você descobrir que nem sempre a morte é o fim de tudo.",
		skills: "Ciências e Medicina.",
		power: {
			name: "Luto Habitual",
			icon: "luto-habitual.svg",
			text: "Você sofre apenas a metade do dano mental por presenciar uma cena que, a critério do mestre, esteja relacionada à rotina de um legista (como presenciar uma morte, ver um cadáver ou encontrar órgãos humanos). Além disso, quando faz um teste de Medicina para primeiros socorros ou necropsia, você pode gastar 2 PE para receber +5 nesse teste.",
			act: "free",
			cost: 2,
		},
	},
	{
		name: "Mateiro",
		oldName: "Mateiro",
		icon: "mateiro.svg",
		narrative:
			"Você conhece áreas rurais e selvagens. Você pode ser um guia florestal, um biólogo de campo ou simplesmente um entusiasta da vida selvagem. Qualquer que seja sua relação com a natureza, ela foi sua porta para o contato com o Outro Lado.",
		skills: "Percepção e Sobrevivência.",
		power: {
			name: "Mapa Celeste",
			icon: "mapa-celeste.svg",
			text: "Desde que possa ver o céu, você sempre sabe as direções dos pontos cardeais e consegue chegar sem se perder em qualquer lugar que já tenha visitado ao menos uma vez. Quando faz um teste de Sobrevivência, você pode gastar 2 PE para rolar o teste novamente e escolher o melhor entre os dois resultados. Além disso, em cenas de interlúdio, você considera condições de sono precárias como normais.",
			act: "free",
			cost: 2,
		},
	},
	{
		name: "Mergulhador",
		oldName: "Mergulhador",
		icon: "mergulhador.svg",
		narrative:
			"Seja por profissão ou por hobby, você é um aventureiro subaquático que explora os mistérios e maravilhas do mundo submerso. Trajando seu equipamento de mergulho, você consegue se aventurar a grandes profundidades para descobrir um mundo totalmente diferente daquele que conhecemos na superfície. Infelizmente, no dia em que você olhou para o abismo, ele encarou você de volta.",
		skills: "Atletismo e Fortitude.",
		power: {
			name: "Fôlego de Nadador",
			icon: "folego-de-nadador.svg",
			text: "Você recebe +5 PV e pode prender a respiração por um número de rodadas igual ao dobro do seu Vigor. Além disso, quando passa em um teste de Atletismo para natação, você avança seu deslocamento normal (em vez da metade).",
			act: "passive",
			fx: [{ name: "Fôlego de Nadador (+5 PV)", key: "system.PV.bonus", value: 5 }],
		},
	},
	{
		name: "Motorista",
		oldName: "Motorista",
		icon: "motorista.svg",
		narrative:
			"Você é um caminhoneiro, motorista de aplicativo, motoboy, piloto de corrida, motorista de ambulância ou qualquer outro tipo de condutor profissional. Você levava a vida transportando cargas ou passageiros, até o dia em que suas viagens cruzaram o caminho do Outro Lado.",
		skills: "Pilotagem e Reflexos.",
		power: {
			name: "Mãos no Volante",
			icon: "maos-no-volante.svg",
			text: "Você não sofre penalidades em testes de ataque por estar em um veículo em movimento e, sempre que estiver pilotando e tiver que fazer um teste de Pilotagem ou resistência, pode gastar 2 PE para receber +5 nesse teste.",
			act: "free",
			cost: 2,
		},
	},
	{
		name: "Nerd Entusiasta",
		oldName: "Nerd Entusiasta",
		icon: "nerd-entusiasta.svg",
		credit: "Daniel Dill e Lukas Castanho | Remate Paranormal",
		narrative:
			"Você dedicou muito do seu tempo aprendendo sobre videogames, RPGs de mesa, ficção científica ou qualquer outro assunto considerado “nerd”. Sua obsessão em pesquisar fundo seus assuntos de interesse e sua capacidade em lidar com os mais variados temas chamou a atenção de organizações paranormais.",
		skills: "Ciências e Tecnologia.",
		power: {
			name: "O Inteligentão",
			icon: "o-inteligentao.svg",
			text: "O bônus que você recebe ao utilizar a ação de interlúdio ler aumenta em +1 dado (de +1d6 para +2d6).",
			act: "passive",
		},
	},
	{
		name: "Profetizado",
		oldName: "Profetizado",
		icon: "profetizado.svg",
		narrative:
			"Como qualquer pessoa, você vai morrer. Entretanto, diferente delas, você sabe como isso vai acontecer. De algum jeito, seja por pesadelos, pensamentos intrusivos ou até visões inesperadas, você tem uma premonição clara — ou misteriosa e enigmática — de como serão seus últimos momentos de vida. O mestre pode determinar essa “cena de morte” em segredo e revelar apenas os detalhes que você já premuniu ou ambos podem determinar as condições para esse inevitável falecimento. A cena pode ser bem detalhada ou conter apenas alguns sinais. Por exemplo: “você se vê pendurado em um gancho de carne, sangrando até desfalecer, no subsolo de um açougue” ou “a única coisa de que se lembra é da visão de um gancho”. Será que você é capaz de mudar seu próprio destino?",
		skills: "Vontade e mais uma à sua escolha, relacionada a sua premonição.",
		power: {
			name: "Luta ou Fuga",
			icon: "luta-ou-fuga.svg",
			text: "Conhecer os sinais de sua morte o deixa mais confiante, principalmente quando eles não estão presentes. Você recebe +2 em Vontade. Quando surge uma referência a sua premonição (um objeto semelhante a um gancho, por exemplo, para alguém cuja morte está ligada a morrer em um gancho de carne), uma onda de adrenalina toma seu corpo e seus instintos de luta ou fuga se intensificam. Além do bônus em Vontade, você recebe +2 PE temporários que duram até o fim da cena.",
			act: "passive",
			fx: [{ name: "Luta ou Fuga (+2 Vontade)", key: "system.skills.will.mod", value: 2 }],
		},
	},
	{
		name: "Psicólogo",
		oldName: "Psicólogo",
		icon: "psicologo.webp",
		credit: "Luiz Giovane e Matheus Santana | Missões Ordem",
		narrative:
			"Você se especializou no estudo e tratamento das questões mentais do ser humano. Em sua prática profissional, você teve contato com o paranormal e descobriu que algumas aflições mentais possuem origens sombrias e perigosas. Agora, você emprega seus conhecimentos para enfrentar o Outro Lado.",
		skills: "Intuição e Profissão (psicólogo).",
		power: {
			name: "Terapia",
			icon: "terapia.svg",
			text: "Você pode usar Profissão (psicólogo) como Diplomacia. Além disso, uma vez por rodada, quando você ou um aliado em alcance curto falha em um teste de resistência contra um efeito que causa dano mental, você pode gastar 2 PE para fazer um teste de Profissão (psicólogo) e usar o resultado desse teste no lugar do teste de resistência falho.",
			act: "reaction",
			cost: 2,
		},
	},
	{
		name: "Repórter Investigativo",
		oldName: "Repórter Investigativo",
		icon: "reporter-investigativo.svg",
		narrative:
			"Você está sempre em busca de histórias significativas, investigando eventos, entrevistando fontes e analisando dados para descobrir a verdade por trás dos acontecimentos. Profissionais do seu ramo costumam ser curiosos, persistentes e, em muitos casos, éticos em sua busca pela verdade. Por outro lado, essa profissão leva pessoas ao encontro do indescritível, e com você não foi diferente.",
		skills: "Atualidades e Investigação.",
		power: {
			name: "Encontrar a Verdade",
			icon: "encontrar-a-verdade.svg",
			text: "Você pode usar Investigação no lugar de Diplomacia ao fazer testes para persuadir e mudar atitude e, quando faz um teste de Investigação, pode gastar 2 PE para receber +5 nesse teste.",
			act: "free",
			cost: 2,
		},
	},
];
