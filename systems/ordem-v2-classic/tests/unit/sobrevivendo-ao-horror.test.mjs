// Rodar: npm test. Confere o conteúdo do suplemento Sobrevivendo ao Horror v1.3 nos compêndios (_source):
// origens, poderes, trilhas, classe Sobrevivente, pré-requisitos das tabelas do livro e efeitos passivos.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { calculateStatusMaxima } from "../../module/helpers/actor-calculations.mjs";
import {
	abilityUnlockLevel,
	findOriginPower,
	folderMatchesPath,
	normalizeName,
	survivorClassStage,
} from "../../module/helpers/level-progression-rules.mjs";

const SRC = path.resolve(import.meta.dirname, "../../packs/_source");
const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		return e.isDirectory() ? walk(full) : full.endsWith(".json") ? [full] : [];
	});
const load = (pack) => walk(path.join(SRC, pack)).map((file) => ({ file, json: JSON.parse(fs.readFileSync(file, "utf8")) }));
const itemsOf = (pack) => load(pack).filter((d) => d.json._key?.startsWith("!items!"));
const foldersOf = (pack) => load(pack).filter((d) => d.json._key?.startsWith("!folders!"));
const findItem = (pack, name) => itemsOf(pack).find((d) => normalizeName(d.json.name) === normalizeName(name))?.json;
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const STUB = /Você pode encontrar esse conteúdo/;

// ---------------------------------------------------------------- Tabela 1.1 do suplemento (p. 12)
const TABLE_1_1 = {
	"Amigo dos Animais": ["Adestramento e Percepção", "Companheiro Animal"],
	"Astronauta": ["Ciências e Fortitude", "Acostumado ao Extremo"],
	"Chef do Outro Lado": ["Ocultismo e Profissão (cozinheiro)", "Fome do Outro Lado"],
	"Colegial": ["Atualidades e Tecnologia", "Poder da Amizade"],
	"Cosplayer": ["Artes e Vontade", "Não É Fantasia, É Cosplay!"],
	"Diplomata": ["Atualidades e Diplomacia", "Conexões"],
	"Explorador": ["Fortitude e Sobrevivência", "Manual do Sobrevivente"],
	"Experimento": ["Atletismo e Fortitude", "Mutação"],
	"Fanático por Criaturas": ["Investigação e Ocultismo", "Conhecimento Oculto"],
	"Fotógrafo": ["Artes e Percepção", "Através da Lente"],
	"Inventor Paranormal": ["Profissão (engenheiro) e Vontade", "Invenção Paranormal"],
	"Jovem Místico": ["Ocultismo e Religião", "A Culpa é das Estrelas"],
	"Legista do Turno da Noite": ["Ciências e Medicina", "Luto Habitual"],
	"Mateiro": ["Percepção e Sobrevivência", "Mapa Celeste"],
	"Mergulhador": ["Atletismo e Fortitude", "Fôlego de Nadador"],
	"Motorista": ["Pilotagem e Reflexos", "Mãos no Volante"],
	"Nerd Entusiasta": ["Ciências e Tecnologia", "O Inteligentão"],
	"Profetizado": ["Vontade e mais uma", "Luta ou Fuga"],
	"Psicólogo": ["Intuição e Profissão (psicólogo)", "Terapia"],
	"Repórter Investigativo": ["Atualidades e Investigação", "Encontrar a Verdade"],
};

// ---------------------------------------------------------------- Tabela 2.3 (p. 34): pré-requisitos dos poderes gerais
const ATTR = { Agi: "Agilidade", For: "Força", Int: "Intelecto", Pre: "Presença", Vig: "Vigor" };
const TABLE_2_3 = {
	"Acrobático": "Agi 2", "Ás do Volante": "Agi 2", "Atlético": "For 2", "Atraente": "Pre 2", "Dedos Ágeis": "Agi 2",
	"Detector de Mentiras": "Pre 2", "Especialista em Emergências": "Int 2", "Estigmado": "", "Foco em Perícia": "Treinado na perícia",
	"Inventário Organizado": "Int 2", "Informado": "Int 2", "Interrogador": "For 2", "Mentiroso Nato": "Pre 2", "Observador": "Int 2",
	"Pai de Pet": "Pre 2", "Palavras de Devoção": "Pre 2", "Parceiro": "Treinado em Diplomacia, NEX 30%", "Pensamento Tático": "Int 2",
	"Personalidade Esotérica": "Int 2", "Persuasivo": "Pre 2", "Pesquisador Científico": "Int 2", "Proativo": "Agi 2",
	"Provisões de Emergência": "", "Racionalidade Inflexível": "Int 3", "Rato de Computador": "Int 2", "Resposta Rápida": "Agi 2",
	"Talentoso": "Pre 2", "Teimosia Obstinada": "Pre 2", "Tenacidade": "Vig 2", "Sentidos Aguçados": "Pre 2", "Sobrevivencialista": "Int 2",
	"Sorrateiro": "Agi 2", "Vitalidade Reforçada": "Vig 2", "Vontade Inabalável": "Pre 2",
};
const expandAttr = (text) => text.replace(/\b(Agi|For|Int|Pre|Vig)\b/g, (m) => ATTR[m]);

// ---------------------------------------------------------------- Tabela 1.6 (p. 47): poderes paranormais
const TABLE_1_6 = {
	"Absorver Conhecimento": "", "Antecipar Vitalidade": "", "Apatia Herege": "Conhecimento 1", "Aura de Pavor": "",
	"Conexão Empática": "Energia 1", "Espreitar da Besta": "", "Instintos Sanguinários": "", "Valer-se do Caos": "",
};

const FIGHTER = ["Apego Angustiado", "Caminho para Forca", "Ciente das Cicatrizes", "Correria Desesperada", "Engolir o Choro", "Instinto de Fuga", "Mochileiro", "Paranoia Defensiva", "Sacrificar os Joelhos", "Sem Tempo, Irmão", "Valentão"];
const SPECIALIST = ["Acolher o Terror", "Contatos Oportunos", "Disfarce Sutil", "Esconderijo Desesperado", "Especialista Diletante", "Flashback", "Leitura Fria", "Mãos Firmes", "Plano de Fuga", "Remoer Memórias", "Resistir à Pressão"];
const OCCULTIST = ["Deixe os Sussurros Guiarem", "Domínio Esotérico", "Estalos Macabros", "Minha Dor me Impulsiona", "Nos Olhos do Monstro", "Olhar Sinistro", "Sentido Premonitório", "Sincronia Paranormal", "Traçado Conjuratório"];

describe("origens do suplemento (Tabela 1.1)", () => {
	const powers = itemsOf("originPowers").map((d) => d.json.name);
	for (const [origin, [skills, power]] of Object.entries(TABLE_1_1)) {
		it(`${origin}: perícias, poder e concessão automática`, () => {
			const doc = findItem("origins", origin);
			assert.ok(doc, "origem não cadastrada");
			assert.equal(doc.name, origin);
			assert.doesNotMatch(doc.system.description, STUB);
			assert.ok(plain(doc.system.description).includes(skills), `perícias treinadas "${skills}" ausentes no texto`);
			const matches = powers.filter((n) => normalizeName(plain(doc.system.description)).includes(normalizeName(n)));
			assert.deepEqual(matches, [power], "o texto da origem deve citar exatamente o próprio poder");
			assert.equal(findOriginPower(doc.name, doc.system.description, powers), power);
			const powerDoc = findItem("originPowers", power);
			assert.equal(powerDoc.system.abilityType, "origin");
			assert.ok(plain(powerDoc.system.description).length > 60);
			assert.doesNotMatch(powerDoc.system.description, STUB);
		});
	}
	it("nenhum poder de origem do livro básico é capturado por engano", () => {
		const all = itemsOf("originPowers").map((d) => d.json.name);
		for (const origin of Object.keys(TABLE_1_1)) {
			const doc = findItem("origins", origin);
			const text = normalizeName(plain(doc.system.description));
			const hits = all.filter((n) => text.includes(normalizeName(n)));
			assert.equal(hits.length, 1, `${origin} casa com ${hits.join(", ")}`);
		}
	});
});

describe("poderes de classe, gerais e paranormais", () => {
	for (const [pack, names] of [["fighterPowers", FIGHTER], ["specialistPowers", SPECIALIST], ["occultistPowers", OCCULTIST]]) {
		it(`${pack}: ${names.length} poderes com texto completo`, () => {
			for (const name of names) {
				const doc = findItem(pack, name);
				assert.ok(doc, `${name} ausente`);
				assert.doesNotMatch(doc.system.description, STUB, name);
				assert.equal(doc.system.abilityType, "class");
				assert.ok(plain(doc.system.description).length > 80, `${name} sem texto`);
			}
		});
	}
	it("poderes gerais: pré-requisitos iguais à Tabela 2.3", () => {
		for (const [name, pre] of Object.entries(TABLE_2_3)) {
			const doc = findItem("generalPowers", name);
			assert.ok(doc, `${name} ausente`);
			assert.doesNotMatch(doc.system.description, STUB, name);
			assert.equal(doc.system.abilityType, "general");
			assert.equal(doc.system.preRequisite, expandAttr(pre), `${name}: pré-requisito`);
			if (pre) assert.ok(plain(doc.system.description).includes("Pré-requisito"), `${name}: texto sem a linha de pré-requisito`);
		}
	});
	it("poderes paranormais: pré-requisitos iguais à Tabela 1.6 e Afinidade no texto", () => {
		for (const [name, pre] of Object.entries(TABLE_1_6)) {
			const doc = findItem("paranormalPowers", name);
			assert.ok(doc, `${name} ausente`);
			assert.equal(doc.system.preRequisite, pre, `${name}: pré-requisito`);
			assert.match(plain(doc.system.description), /Afinidade:/, `${name} sem Afinidade`);
			assert.doesNotMatch(doc.system.description, STUB);
		}
	});
	it("custos em PE batem com o texto do livro", () => {
		const cost = (pack, name) => findItem(pack, name).system.cost;
		assert.equal(cost("fighterPowers", "Paranoia Defensiva"), 3);
		assert.equal(cost("fighterPowers", "Sacrificar os Joelhos"), 2);
		assert.equal(cost("fighterPowers", "Valentão"), 1);
		assert.equal(cost("specialistPowers", "Mãos Firmes"), 2);
		assert.equal(cost("specialistPowers", "Resistir à Pressão"), 5);
		assert.equal(cost("occultistPowers", "Nos Olhos do Monstro"), 3);
		assert.equal(cost("occultistPowers", "Sentido Premonitório"), 3);
		assert.equal(cost("generalPowers", "Palavras de Devoção"), 3);
		assert.equal(cost("generalPowers", "Resposta Rápida"), 2);
		assert.equal(cost("paranormalPowers", "Aura de Pavor"), 2);
	});
});

describe("trilhas do suplemento: habilidades por nível", () => {
	const abilityFolders = [];
	for (const pack of ["pathFighter", "pathSpecialist", "pathOccultist", "survivalPowers"]) {
		const docs = load(pack);
		const byId = new Map(docs.filter((d) => d.json._key?.startsWith("!folders!")).map((d) => [d.json._id, d.json]));
		const chain = (id) => {
			const names = [];
			for (let f = byId.get(id); f; f = byId.get(f.folder)) names.unshift(f.name);
			return names;
		};
		for (const d of docs.filter((x) => x.json.type === "ability")) {
			abilityFolders.push({ pack, name: d.json.name, chain: d.json.folder ? chain(d.json.folder) : [], json: d.json });
		}
	}
	const sahPaths = load("paths").filter((d) => d.json.type === "path" && d.file.includes("sobrevivendo-ao-horror")).map((d) => d.json);
	it("existem as 3 + 4 + 3 trilhas e as 3 trilhas de Sobrevivente", () => {
		const names = sahPaths.map((p) => p.name).sort();
		for (const n of ["Agente Secreto", "Caçador", "Monstruoso - Sangue", "Monstruoso - Morte", "Monstruoso - Conhecimento", "Monstruoso - Energia", "Bibliotecário", "Muambeiro", "Perseverante", "Exorcista", "Parapsicólogo", "Possuído", "Durão", "Esperto", "Esotérico"]) {
			assert.ok(names.includes(n), `trilha ${n} ausente`);
		}
	});
	for (const trilha of ["Agente Secreto", "Caçador", "Monstruoso - Sangue", "Monstruoso - Morte", "Monstruoso - Conhecimento", "Monstruoso - Energia", "Bibliotecário", "Muambeiro", "Perseverante", "Exorcista", "Parapsicólogo", "Possuído"]) {
		it(`${trilha}: habilidades de NEX 10%, 40%, 65% e 99% (níveis 2, 8, 13, 20)`, () => {
			const found = abilityFolders.filter((a) => folderMatchesPath(a.chain, trilha));
			const levels = found.map((a) => abilityUnlockLevel(a.name));
			for (const nivel of [2, 8, 13, 20]) assert.ok(levels.includes(nivel), `${trilha}: falta habilidade do nível ${nivel}`);
			for (const a of found) {
				assert.doesNotMatch(a.json.system.description, STUB, a.name);
				assert.ok(plain(a.json.system.description).length > 60, `${a.name} sem texto`);
				assert.equal(a.json.system.abilityType, "path");
			}
		});
	}
	for (const [trilha, [a, b]] of Object.entries({ "Durão": ["Estágio 2 - Durão", "Estágio 4 - Pancada Forte"], "Esperto": ["Estágio 2 - Esperto", "Estágio 4 - Entendido"], "Esotérico": ["Estágio 2 - Esotérico", "Estágio 4 - Iniciado"] })) {
		it(`Sobrevivente ${trilha}: poder no estágio 2 e no estágio 4`, () => {
			const found = abilityFolders.filter((x) => x.pack === "survivalPowers" && folderMatchesPath(x.chain, trilha));
			assert.deepEqual(found.map((x) => x.name).sort(), [a, b].sort());
			assert.deepEqual(found.map((x) => abilityUnlockLevel(x.name)).sort(), [2, 4]);
		});
	}
	it("a trilha Monstruoso não depende de pasta com o nome completo", () => {
		assert.ok(folderMatchesPath(["Sobrevivendo ao Horror", "Monstruoso", "Sangue"], "Monstruoso - Sangue"));
		assert.ok(!folderMatchesPath(["Sobrevivendo ao Horror", "Monstruoso", "Sangue"], "Monstruoso - Morte"));
		assert.ok(folderMatchesPath(["Sobrevivendo ao Horror", "Caçador"], "Caçador"));
		assert.ok(!folderMatchesPath(["Sobrevivendo ao Horror", "Monstruoso", "Sangue"], "Sangue Vivo"));
	});
	it("Monstruoso: resistência a dano 5 → 10 → 15 → 20 e texto sem '1d20'", () => {
		for (const elem of ["Sangue", "Morte", "Conhecimento", "Energia"]) {
			const get = (nex, nome) => abilityFolders.find((a) => a.name === `NEX ${nex}% - ${nome} (${elem})`);
			const macabro = plain(get(40, "Ser Macabro").json.system.description);
			assert.match(macabro, /aumenta para 10,/);
			assert.doesNotMatch(macabro, /1d20/);
			assert.match(plain(get(65, "Ser Assustador").json.system.description), /aumenta para 15,/);
			assert.match(plain(get(99, "Ser Aterrorizante").json.system.description), /aumenta para 20 /);
			assert.match(plain(get(10, "Ser Amaldiçoado").json.system.description), new RegExp(`${elem.toUpperCase()}:`));
		}
	});
});

describe("classe Sobrevivente (p. 30–33)", () => {
	const cls = findItem("classes", "Sobrevivente");
	it("valores da classe: PV 8 (+2), PE 2 (+1), SAN 8 (+2), sobrevivente", () => {
		assert.equal(cls.system.hpInitial, 8);
		assert.equal(cls.system.hpPerLevel, 2);
		assert.equal(cls.system.peInitial, 2);
		assert.equal(cls.system.pePerLevel, 1);
		assert.equal(cls.system.sanInitial, 8);
		assert.equal(cls.system.sanPerLevel, 2);
		assert.equal(cls.system.isSurvivor, true);
		assert.doesNotMatch(cls.system.description, STUB);
	});
	it("máximos por estágio: PV 8+Vig+2/estágio, PE 2+Pre+1/estágio, SAN 8+2/estágio (sem somar atributo por estágio)", () => {
		const [VIG, PRE] = [2, 3];
		for (let stage = 1; stage <= 5; stage++) {
			const max = calculateStatusMaxima(VIG, PRE, stage, false, cls.system);
			assert.equal(max.PV_max, 8 + VIG + 2 * (stage - 1), `PV estágio ${stage}`);
			assert.equal(max.PE_max, 2 + PRE + (stage - 1), `PE estágio ${stage}`);
			assert.equal(max.SAN_max, 8 + 2 * (stage - 1), `SAN estágio ${stage}`);
		}
	});
	it("Empenho (1), Aumento de Atributo (3) e Cicatrizado (5) chegam nos estágios da Tabela 1.2", () => {
		assert.equal(survivorClassStage("Empenho"), 1);
		assert.equal(survivorClassStage("Aumento de Atributo"), 3);
		assert.equal(survivorClassStage("Cicatrizado"), 5);
		assert.equal(survivorClassStage("Durão"), null);
		for (const name of ["Empenho", "Aumento de Atributo", "Cicatrizado"]) {
			const doc = findItem("survivalPowers", name);
			assert.ok(doc, `${name} ausente`);
			assert.equal(doc.folder, null, "habilidade de classe fica na raiz do compêndio");
			assert.doesNotMatch(doc.system.description, STUB);
		}
		assert.equal(findItem("survivalPowers", "Empenho").system.cost, 1);
	});
	it("o nome 'Estágio N' define o estágio da habilidade de trilha", () => {
		assert.equal(abilityUnlockLevel("Estágio 2 - Durão"), 2);
		assert.equal(abilityUnlockLevel("Estágio 4 - Pancada Forte"), 4);
		assert.equal(abilityUnlockLevel("NEX 65% - Qualquer"), 13);
		assert.equal(abilityUnlockLevel("Qualquer"), null);
	});
});

describe("efeitos passivos que alteram a ficha", () => {
	const changes = (pack, name) => (findItem(pack, name)?.effects ?? []).flatMap((e) => e.system.changes.map((c) => ({ key: c.key, value: c.value, disabled: e.disabled, transfer: e.transfer })));
	const expectChange = (pack, name, key, value) => {
		const found = changes(pack, name).find((c) => c.key === key);
		assert.ok(found, `${name}: efeito em ${key} ausente`);
		assert.equal(found.value, value, `${name}: valor em ${key}`);
		assert.equal(found.transfer, true);
		return found;
	};
	it("origens", () => {
		expectChange("originPowers", "Fôlego de Nadador", "system.PV.bonus", 5);
		expectChange("originPowers", "Luta ou Fuga", "system.skills.will.mod", 2);
		expectChange("originPowers", "Conexões", "system.skills.diplomacy.mod", 2);
	});
	it("poderes de classe e gerais", () => {
		expectChange("fighterPowers", "Correria Desesperada", "system.desloc.value", 3);
		expectChange("fighterPowers", "Mochileiro", "system.spaces.bonus.max", 5);
		expectChange("generalPowers", "Atlético", "system.desloc.value", 3);
		expectChange("generalPowers", "Inventário Organizado", "system.spaces.bonus.max", "@attributes.int.value");
		expectChange("generalPowers", "Observador", "system.skills.intuition.mod", "@attributes.int.value");
		expectChange("generalPowers", "Personalidade Esotérica", "system.PE.bonus", 3);
		expectChange("generalPowers", "Vitalidade Reforçada", "system.PV.bonus", "@nivel.value");
		expectChange("generalPowers", "Vitalidade Reforçada", "system.skills.resilience.mod", 2);
		expectChange("generalPowers", "Vontade Inabalável", "system.PE.bonus", "floor(@nivel.value / 2)");
		expectChange("generalPowers", "Vontade Inabalável", "system.skills.will.mod", 2);
	});
	it("trilhas", () => {
		expectChange("pathFighter", "NEX 40% - O Sorriso", "system.skills.diplomacy.mod", 2);
		expectChange("pathFighter", "NEX 40% - O Sorriso", "system.skills.deception.mod", 2);
		expectChange("pathSpecialist", "NEX 10% - Mascate", "system.spaces.bonus.max", 5);
		expectChange("pathSpecialist", "NEX 99% - A Força do Saber", "system.attributes.int.value", 1);
		expectChange("survivalPowers", "Estágio 2 - Durão", "system.PV.bonus", "4 + (@stage.value >= 3 ? 2 : 0)");
	});
	it("Monstruoso: efeitos da etapa ritualística começam desligados; Ser Aterrorizante e Presença −1 são permanentes", () => {
		for (const elem of ["Sangue", "Morte", "Conhecimento", "Energia"]) {
			const presence = changes("pathFighter", `NEX 65% - Ser Assustador (${elem})`).find((c) => c.key === "system.attributes.pre.value");
			assert.equal(presence.value, -1);
			assert.equal(presence.disabled, false);
		}
		assert.equal(changes("pathFighter", "NEX 10% - Ser Amaldiçoado (Morte)")[0].disabled, true);
		assert.equal(changes("pathFighter", "NEX 10% - Ser Amaldiçoado (Conhecimento)")[0].disabled, true);
		assert.deepEqual(changes("pathFighter", "NEX 99% - Ser Aterrorizante (Sangue)").map((c) => [c.key, c.value, c.disabled]), [
			["system.attributes.int.value", -1, false],
			["system.attributes.str.value", 1, false],
		]);
		assert.deepEqual(changes("pathFighter", "NEX 99% - Ser Aterrorizante (Energia)").map((c) => [c.key, c.value]), [
			["system.attributes.str.value", -1],
			["system.attributes.dex.value", 1],
		]);
	});
	it("todo efeito usa só chaves que a ficha entende", () => {
		const allowed = /^system\.(PV|PE|PD|SAN)\.bonus$|^system\.skills\.[a-zA-Z]+\.mod$|^system\.(desloc|defense)\.value$|^system\.spaces\.bonus\.max$|^system\.attributes\.(str|dex|int|vit|pre)\.value$/;
		for (const pack of ["originPowers", "fighterPowers", "specialistPowers", "occultistPowers", "generalPowers", "pathFighter", "pathSpecialist", "pathOccultist", "survivalPowers", "paranormalPowers"]) {
			for (const d of itemsOf(pack)) {
				if (!d.file.includes("sobrevivendo") && pack !== "survivalPowers" && pack !== "originPowers" && pack !== "generalPowers") continue;
				for (const e of d.json.effects ?? []) {
					for (const c of e.system.changes) assert.match(c.key, allowed, `${d.json.name}: chave ${c.key}`);
				}
			}
		}
	});
});

describe("higiene do texto", () => {
	it("sem caracteres de controle nem hífen mole em itens do suplemento", () => {
		for (const pack of ["origins", "originPowers", "fighterPowers", "specialistPowers", "occultistPowers", "generalPowers", "paranormalPowers", "pathFighter", "pathSpecialist", "pathOccultist", "survivalPowers", "paths", "classes"]) {
			for (const d of itemsOf(pack)) {
				const text = String(d.json.system?.description ?? "");
				assert.doesNotMatch(text, /[\u0000-\u0008\u000b\u000c\u000e-\u001f­]/, `${pack}/${d.json.name}`);
			}
		}
	});
	it("símbolos de dado têm o formato do enriquecedor", () => {
		for (const pack of ["originPowers", "fighterPowers", "specialistPowers", "occultistPowers", "generalPowers", "paranormalPowers", "pathFighter", "pathSpecialist", "pathOccultist", "survivalPowers"]) {
			for (const d of itemsOf(pack)) {
				for (const m of String(d.json.system?.description ?? "").matchAll(/@DisplayDice\[([^\]]*)\]/g)) assert.match(m[1], /^qtd:\d(\|sign:(plus|minus))?\|dc:d\d+$/, `${d.json.name}: ${m[0]}`);
			}
		}
	});
	it("nenhum item do suplemento ficou com o texto provisório", () => {
		const sahPacks = ["origins", "fighterPowers", "specialistPowers", "occultistPowers", "generalPowers", "pathFighter", "pathSpecialist", "pathOccultist", "paths", "survivalPowers", "originPowers"];
		for (const pack of sahPacks) {
			for (const d of itemsOf(pack).filter((x) => x.file.includes("sobrevivendo-ao-horror") || pack === "survivalPowers" || pack === "originPowers")) {
				assert.doesNotMatch(String(d.json.system?.description ?? ""), STUB, `${pack}/${d.json.name}`);
			}
		}
		for (const name of ["Absorver Conhecimento", "Apatia Herege", "Conexão Empática", "Valer-se do Caos", "Antecipar Vitalidade", "Aura de Pavor", "Espreitar da Besta", "Instintos Sanguinários"]) {
			assert.doesNotMatch(findItem("paranormalPowers", name).system.description, STUB, name);
		}
	});
});
