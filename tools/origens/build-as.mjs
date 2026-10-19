// Gera as origens e os poderes de origem de Arquivos Secretos em packs/_source (texto: regras/rascunhos/arquivos-secretos/origens).
// Rodar: node tools/origens/build-as.mjs  → também escreve tools/origens/out/as-ops.json (aplicado nos compêndios vivos pelo mundo).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SRC = "systems/ordem_v2_classic/packs/_source";
const OUT = "tools/origens/out";
const SYS = "ordem_v2_classic";
const ORIGINS_FOLDER = "tzknJ6T3P1rXJYwo";
const POWERS_FOLDER = "AsOrigPowers0001";
const stats = { coreVersion: "14.365", systemId: SYS, systemVersion: "7.3.3", createdTime: 1784950000000, modifiedTime: 1784950000000, lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null };
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const id = (seed) => crypto.createHash("sha1").update(seed).digest("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
const p = (t) => `<p>${t}</p>`;
const skills = (t) => p(`<strong><em>Perícias Treinadas.</em></strong> ${t}`);
const power = (name, t) => p(`<strong><em>${name}.</em></strong> ${t}`);

const ORIGINS = [
	{
		name: "Cientista Ex-Panacea", pdf: "AS #06, p. 66", pack: "Existe uma Explicação", skills: "Atualidades e Ciências.",
		flavor: "Ingênuo, você passou anos trabalhando para a Panacea Industries até descobrir que prestava serviços para uma grande organização responsável por aprisionar e utilizar criaturas paranormais que pesquisam para enfrentarem umas às outras. Quando soube do uso de cobaias humanas nesses experimentos, decidiu parar de apoiar as pesquisas e se voltou contra a multinacional.",
		power: "Acostumado a ver o paranormal como um assunto científico, você prefere lidar com o sobrenatural através de teorias, cálculos e testes experimentais. Quando faz um teste de Ocultismo, você pode gastar 2 PE para usar Ciências no lugar dessa perícia.",
	},
	{
		name: "Cobaia Sobrevivente", pdf: "AS #06, p. 66", pack: "Forças para Enfrentar", skills: "Fortitude e Vontade.",
		flavor: "Você foi pego pelas Indústrias Panacea (ou outra organização semelhante) ainda pequeno, mas, após anos como cobaia, conseguiu sobreviver aos experimentos com o mínimo de sequelas mentais e/ou físicas. Após escapar das garras da multinacional, passou a dedicar a sua vida a encontrar meios de salvar outras pessoas do destino trágico que você evitou.",
		power: "Ser uma cobaia por anos marcou você com experiências horríveis, mas que, às vezes, podem ser usadas como força para continuar sobrevivendo. Descreva para o mestre a parte mais traumática da sua história como cobaia. Quando estiver em uma cena em que há algo relacionado a esse trauma, à critério do mestre, você fica abalado. Entretanto, quando isso acontecer, você pode gastar 2 PE para, até o fim da cena, receber imunidade a efeitos de medo (se aplica também ao abalado desta habilidade).",
	},
	{
		name: "Segurança Ex-Panacea", pdf: "AS #06, p. 66", pack: "Técnicas de Contenção", skills: "Luta e Pontaria.",
		flavor: "Acreditando que trabalhava em uma multinacional dedicada à saúde e bem-estar da população, você quase enlouqueceu quando descobriu que fazia a segurança para cientistas dispostos a usar cobaias humanas em seus experimentos com o paranormal. Assim que soube a verdade, abandonou as Indústrias Panacea para acabar com a existência dela.",
		power: "Você domina técnicas de luta para conter pessoas que podem causar problemas. Quando faz uma manobra de combate, você pode gastar 2 PE para receber +5 no teste de manobra.",
	},
	{
		name: "Caçador de Recompensas", pdf: "AS #04, p. 64", pack: "Quem Não Arrisca, Não Petisca", skills: "Crime e Investigação.",
		flavor: "Sua sede pelo dinheiro fácil sempre te guiou na exploração dos locais mais obscuros. Você sabe muito bem que as situações mais insalubres guardam as melhores recompensas.",
		power: "Você recebe +2 em testes para resistir à condições mentais e de medo. Além disso, caso falhe em algum desses testes, você recebe +1d20 no próximo teste que realizar até o fim da cena (não cumulativo com ele mesmo).",
	},
	{
		name: "Influencer Paranormal", pdf: "AS #04, p. 64", pack: "Registrar o Paranormal", skills: "Enganação e Tecnologia.",
		flavor: "De início, você nunca acreditou nas lendas urbanas e vídeos de fantasmas, então resolveu se aproveitar daqueles que acreditam. Foi produzindo conteúdos falsos e duvidosos para a internet que você descobriu a dura verdade por trás da Membrana.",
		power: "Uma vez por cena, você pode gastar uma ação padrão e 2 PE para criar um registro de uma criatura paranormal ou ritual que tenha sido conjurado na mesma cena. A ação padrão deve ser gasta para tirar uma foto, fazer um vídeo ou algum tipo de registro desse tipo. Uma vez por cena, você pode gastar uma ação de interlúdio e um dos registros de criatura para receber +5 em testes de identificar criatura e presença perturbadora envolvendo a criatura fotografada até o início da próxima cena de interlúdio. Alternativamente, uma vez por cena, você pode gastar uma ação de interlúdio e um dos registros de ritual para memorizar o ritual presente no registro, podendo conjurá-lo como se o conhecesse até o início de sua próxima cena de interlúdio, desde que tenha o NEX necessário (1º círculo a partir do NEX 5%, 2º círculo a partir do NEX 45% e 3º círculo a partir do NEX 75%); você também recebe +5 em testes para identificar o ritual. Esse ritual não conta no seu limite de rituais conhecidos.",
	},
	{
		name: "Ufólogo", pdf: "AS #05, p. 54", pack: "Minha Teoria Absurda", skills: "Ciências e Ocultismo.",
		flavor: "Você sempre soube que não estávamos sozinhos no universo. Muitos já te consideraram um lunático, mas algo dizia que suas teorias sempre estavam no caminho certo. As intermináveis pesquisas sobre o espaço, sinais no céu e seres de outros planetas eventualmente te fizeram perceber que o oculto não mede distâncias. Onde há medo, há algo incompreensível para espreitar.",
		power: "Uma vez por cena de interlúdio, você pode gastar uma ação para apresentar ao seu grupo sua tese sobre as prováveis respostas para a investigação com a qual estão lidando. Obviamente, isso deve ser feito antes de terem todas as respostas. A critério do mestre, se suas teorias forem boas (não necessariamente corretas), você recebe 1d4+1 PE temporários que duram até serem gastos. Se, quando a missão acabar, uma de suas teorias se provar correta, você recebe +1 PE máximo e atual.",
	},
	{
		name: "Funcionário de Beira de Estrada", pdf: "AS #05, p. 54", pack: "Turno Invertido", skills: "Fortitude e Intuição.",
		flavor: "Longe das grandes concentrações urbanas, você dava o seu melhor para atender os viajantes cansados. Entre madrugadas adentro e caminhões barulhentos, as lendas urbanas e relatos horripilantes eventualmente chegaram aos seus ouvidos e atiçaram a sua curiosidade.",
		power: "Uma vez por missão, durante uma cena de interlúdio, você pode receber os benefícios da ação dormir sem precisar realizá-la. Além disso, recebe +2 em testes contra qualquer efeito que tente te deixar inconsciente.",
	},
	{
		name: "Transtornado Arrependido", pdf: "AS #01, p. 43", pack: "Sofrimento de Sangue", skills: "Luta e Ocultismo.",
		flavor: "Você já caminhou entre os Transtornados. Talvez tenha sido um seguidor cego, seduzido pelas promessas de transcendência por meio da carne e da dor. Talvez tenha conhecido a natureza visceral do culto desde o início e ainda assim escolheu mergulhar no delírio. Seja como for, em algum momento algo rompeu o ciclo. Você se libertou, mas ainda sente o eco dos rituais e a presença do Sangue sussurrando na própria carne.",
		power: "Eles podem tentar… mas já não dói mais. Você recebe RD 2/mental. Para cada dois rituais de Sangue ou poderes paranormais de Sangue que possua, a RD aumenta em +1. Contudo, a lembrança das desgraças que você viveu causa pesadelos horríveis, que o impedem de repousar tranquilamente. Sua condição de descanso é sempre uma categoria pior (luxuosa se torna confortável, confortável se torna normal e normal se torna precária).",
	},
	{
		name: "Ferido por Ritual", pdf: "AS #01, p. 43", pack: "Mácula Ritualística",
		skills: "Ocultismo e 1 perícia definida pelo elemento do ritual (Fortitude para Sangue, Vontade para Morte e Conhecimento ou Reflexos para Energia).",
		flavor: "Você tinha uma vida ordinária, até sofrer os efeitos paranormais de um ritual (escolha entre Sangue, Morte, Conhecimento ou Energia). A partir de então, sua existência mundana foi deturpada pelo Outro Lado.",
		power: "A entidade marcou você com um ritual de 1º círculo a sua escolha do elemento correspondente. Você aprende a conjurar o ritual. Além disso, uma vez por cena, pode conjurá-lo sem gastar PE (mas ainda precisa gastar PE para qualquer efeito adicional, como formas avançadas). Esse ritual não conta no seu limite de rituais conhecidos. Em contrapartida, sofre –O em testes de resistência contra efeitos (como rituais ou poderes paranormais) desse elemento.",
	},
	{
		name: "Exorcizado", pdf: "AS #07, p. 80", pack: "O Que Restou", skills: "Fortitude e Ocultismo.", icon: "origem-as07-exorcizado.svg", isNew: true,
		flavor: "Você já esteve sob influência de uma grande força sobrenatural opressora, que dominou seu corpo para realizar façanhas incompreensíveis.",
		power: "Uma parte da criatura paranormal que o possuiu continua dentro de você. Escolha um elemento (exceto Medo). Você recebe RD 10 contra o tipo do elemento escolhido. Entretanto, sempre que entrar em contato com esse elemento pela primeira vez em uma cena (seja ao presenciar rituais, itens amaldiçoados, criaturas ou poderes paranormais), você perde 3 SAN.",
	},
	{
		name: "Sensitivo Rebelde", pdf: "AS #07, p. 80", pack: "Sussurros e Vultos", skills: "Intuição e Vontade.", icon: "origem-as07-sensitivo-rebelde.svg", isNew: true,
		flavor: "Apesar de lutar contra sua sensitividade paranormal, ela nunca te abandonou. Não importa o quanto você tentou negar, as visões continuavam voltando. Para você, nunca foi uma questão de fé. O sobrenatural sempre foi sua realidade.",
		power: "Ao lidar com outras pessoas, inesperadamente surgem vozes e vultos na sua cabeça que, por mais assustadoras que sejam, ajudam a compreendê-las. Quando faz um teste de Diplomacia, Enganação, Intimidação ou Intuição, você pode escolher perder 2 SAN para receber +5 nesse teste.",
	},
];

const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`); };
const ops = { powers: [], origins: [] };

write(`${SRC}/originPowers/arquivos-secretos/_folder.json`, {
	type: "Item", folder: null, name: "Arquivos Secretos", color: "#232220", sorting: "a", _id: POWERS_FOLDER, description: "", sort: 2000000, flags: {}, _stats: stats, _key: `!folders!${POWERS_FOLDER}`,
});

let n = 0;
for (const o of ORIGINS) {
	const powerId = id(`power:${o.pack}`);
	const powerDoc = {
		name: o.pack, type: "ability", _id: powerId, img: "icons/svg/book.svg",
		system: { id: 0, chatDescription: "", abilityType: "origin", preRequisite: "", description: p(o.power), activation: "passive", cost: 0, costType: "PE" },
		effects: [], folder: POWERS_FOLDER, sort: (n + 1) * 1000, ownership: { default: 0 }, flags: {}, _stats: stats, _key: `!items!${powerId}`,
	};
	write(`${SRC}/originPowers/arquivos-secretos/${slug(o.pack)}.json`, powerDoc);
	ops.powers.push(powerDoc);

	const description = `${p(o.flavor)}${skills(o.skills)}${power(o.pack, o.power)}${p(`<em>Fonte: ${o.pdf}.</em>`)}`;
	const file = `${SRC}/origins/arquivos-secretos/${fs.readdirSync(`${SRC}/origins/arquivos-secretos`).find((f) => !o.isNew && JSON.parse(fs.readFileSync(`${SRC}/origins/arquivos-secretos/${f}`, "utf8")).name === o.name) ?? `${slug(o.name)}.json`}`;
	let doc;
	if (o.isNew) {
		const originId = id(`origin:${o.name}`);
		const iconSrc = `regras/rascunhos/arquivos-secretos/icones/${o.icon}`;
		const iconDest = `systems/${SYS}/assets/origens/${o.icon}`;
		if (fs.existsSync(iconSrc)) { fs.mkdirSync(path.dirname(iconDest), { recursive: true }); fs.copyFileSync(iconSrc, iconDest); }
		doc = {
			folder: ORIGINS_FOLDER, name: o.name, type: "origin", _id: originId, img: `systems/${SYS}/assets/origens/${o.icon}`,
			system: { id: 0, description, chatDescription: "" }, effects: [], sort: 0, ownership: { default: 0 }, flags: {}, _stats: stats, _key: `!items!${originId}`,
		};
	} else {
		doc = JSON.parse(fs.readFileSync(file, "utf8"));
		doc.system.description = description;
	}
	write(file, doc);
	ops.origins.push({ name: o.name, isNew: !!o.isNew, doc });
	n++;
}
write(`${OUT}/as-ops.json`, ops);
console.log(`ok: ${ORIGINS.length} origens, ${ORIGINS.length} poderes`);
