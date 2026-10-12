/**
 * Perícias treinadas: orçamento, graus e travas (regras puras, sem Foundry — testável em Node).
 * Especificação: docs/arquivo/spec-pericias-treinadas.md (e docs/arquivo/pericias-treinadas/).
 *
 * O grau de cada perícia na ficha é consequência de um LIVRO-CAIXA de entradas (`entries`). Cada entrada diz de onde
 * veio um treinamento: origem, classe, poder, trilha, Treinamento em Perícia, Grau de Treinamento ou o seletor manual.
 */
import { SKILL_KEYS, passiveKey } from "./passive-effects-rules.mjs";

export const DEGREES = ["untrained", "trained", "veteran", "expert"];
export const DEGREE_POINTS = [0, 5, 10, 15];
export const DEGREE_NAMES = { untrained: "Destreinada", trained: "Treinada", veteran: "Veterana", expert: "Expert" };

/** Índice do grau (0–3); graus de ameaça (master, alfa…) contam como expert. */
export function degreeIndex(label) {
	const i = DEGREES.indexOf(label);
	if (i >= 0) return i;
	return label && label !== "untrained" ? 3 : 0;
}

/** Maior grau permitido pelo nível: Veterano a partir do NEX 35% (nível 7), Expert a partir de 70% (nível 14) — R4. */
export function maxDegreeIndex(level) {
	const n = Number(level) || 1;
	return n >= 14 ? 3 : n >= 7 ? 2 : 1;
}

/** Níveis (NEX 35% e 70%) em que a classe abre Grau de Treinamento. */
export const GRADE_LEVELS = [7, 14];

/** Perícias que cada classe dá. `free` = escolhas livres além do Intelecto; `grade` = base do Grau de Treinamento. */
export const CLASS_TRAINING = Object.freeze({
	combatente: { free: 1, grade: 2, groups: [["fighting", "aim"], ["resilience", "reflexes"]], fixed: [] },
	especialista: { free: 7, grade: 5, groups: [], fixed: [] },
	ocultista: { free: 3, grade: 3, groups: [], fixed: ["occultism", "will"] },
	sobrevivente: { free: 1, grade: 0, groups: [], fixed: [] },
});

/** Perícias livres que o Treinamento Especial dá além das fixas da classe nova (Especialista: 6 à escolha). */
export const CONVERSION_FREE = Object.freeze({ combatente: 0, especialista: 6, ocultista: 0 });

/** Chave da classe pelo nome do item (null se não for uma das quatro). */
export function trainingClassKey(name) {
	const key = String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
	return CLASS_TRAINING[key] ? key : null;
}

/** Quantas perícias fixas (grupos + nomeadas) a classe dá. */
export const classFixedCount = (classKey) => (CLASS_TRAINING[classKey] ? CLASS_TRAINING[classKey].groups.length + CLASS_TRAINING[classKey].fixed.length : 0);

/** Nome comparável de origem/poder. */
export function trainingKey(name) {
	return String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const P = (name) => ({ profession: name }); // Profissão com nome fixo (null = o jogador escreve o nome)
/** Perícias treinadas de cada origem (Livro de Regras Tabela 1.1 e Sobrevivendo ao Horror). `gm`/`choose` = escolha. */
export const ORIGIN_TRAINING = Object.freeze({
	"academico": { skills: ["sciences", "investigation"] },
	"agente de saude": { skills: ["intuition", "medicine"] },
	"artista": { skills: ["arts", "deception"] },
	"atleta": { skills: ["acrobatics", "athleticism"] },
	"chef": { skills: ["resilience", P("cozinheiro")] },
	"criminoso": { skills: ["crime", "stealth"] },
	"cultista arrependido": { skills: ["occultism", "religion"] },
	"desgarrado": { skills: ["resilience", "survival"] },
	"engenheiro": { skills: [P(null), "technology"] },
	"executivo": { skills: ["diplomacy", P(null)] },
	"investigador": { skills: ["investigation", "perception"] },
	"lutador": { skills: ["fighting", "reflexes"] },
	"magnata": { skills: ["diplomacy", "driving"] },
	"mercenario": { skills: ["initiative", "intimidation"] },
	"militar": { skills: ["aim", "tactics"] },
	"operario": { skills: ["resilience", P(null)] },
	"policial": { skills: ["perception", "aim"] },
	"religioso": { skills: ["religion", "will"] },
	"servidor publico": { skills: ["intuition", "will"] },
	"teorico da conspiracao": { skills: ["investigation", "occultism"] },
	"t i": { skills: ["investigation", "technology"] },
	"trabalhador rural": { skills: ["animal", "survival"] },
	"trambiqueiro": { skills: ["crime", "deception"] },
	"universitario": { skills: ["relevance", "investigation"] },
	"vitima": { skills: ["reflexes", "will"] },
	// o livro deixa o Mestre escolher; a mesa decidiu que o próprio jogador escolhe as duas
	"amnesico": { choose: 2 },
	// Sobrevivendo ao Horror
	"amigo dos animais": { skills: ["animal", "perception"] },
	"astronauta": { skills: ["sciences", "resilience"] },
	"chef do outro lado": { skills: ["occultism", P("cozinheiro")] },
	"colegial": { skills: ["relevance", "technology"] },
	"cosplayer": { skills: ["arts", "will"] },
	"diplomata": { skills: ["relevance", "diplomacy"] },
	"experimento": { skills: ["athleticism", "resilience"] },
	"explorador": { skills: ["resilience", "survival"] },
	"fanatico por criaturas": { skills: ["investigation", "occultism"] },
	"fotografo": { skills: ["arts", "perception"] },
	"inventor paranormal": { skills: [P("engenheiro"), "will"] },
	"jovem mistico": { skills: ["occultism", "religion"] },
	"legista do turno da noite": { skills: ["sciences", "medicine"] },
	"mateiro": { skills: ["perception", "survival"] },
	"mergulhador": { skills: ["athleticism", "resilience"] },
	"motorista": { skills: ["driving", "reflexes"] },
	"nerd entusiasta": { skills: ["sciences", "technology"] },
	"profetizado": { skills: ["will"], choose: 1 },
	// Arquivos Secretos (texto do livro em regras/rascunhos/arquivos-secretos/origens)
	"cientista ex panacea": { skills: ["relevance", "sciences"] },
	"cobaia sobrevivente": { skills: ["resilience", "will"] },
	"seguranca ex panacea": { skills: ["fighting", "aim"] },
	"cacador de recompensas": { skills: ["crime", "investigation"] },
	"influencer paranormal": { skills: ["deception", "technology"] },
	"ufologo": { skills: ["sciences", "occultism"] },
	"funcionario de beira de estrada": { skills: ["resilience", "intuition"] },
	"transtornado arrependido": { skills: ["fighting", "occultism"] },
	// a perícia extra depende do elemento do ritual: Sangue = Fortitude, Morte/Conhecimento = Vontade, Energia = Reflexos
	"ferido por ritual": { skills: ["occultism"], choose: 1, options: ["resilience", "will", "reflexes"] },
	"exorcizado": { skills: ["resilience", "occultism"] },
	"sensitivo rebelde": { skills: ["intuition", "will"] },
	"psicologo": { skills: ["intuition", P("psicólogo")] },
	"reporter investigativo": { skills: ["relevance", "investigation"] },
});

/** Atributo-base de cada perícia (livro), para agrupar as opções nas janelas de escolha. */
export const SKILL_ATTRIBUTE = Object.freeze({
	acrobatics: "Agilidade", crime: "Agilidade", stealth: "Agilidade", initiative: "Agilidade", driving: "Agilidade", aim: "Agilidade", reflexes: "Agilidade",
	athleticism: "Força", fighting: "Força",
	relevance: "Intelecto", sciences: "Intelecto", investigation: "Intelecto", medicine: "Intelecto", occultism: "Intelecto", survival: "Intelecto", tactics: "Intelecto", technology: "Intelecto",
	animal: "Presença", arts: "Presença", diplomacy: "Presença", deception: "Presença", intimidation: "Presença", intuition: "Presença", perception: "Presença", religion: "Presença", will: "Presença",
	resilience: "Vigor",
});

/** Perícias da origem (chaves) e vagas de escolha. `profession` = Profissão a ser nomeada. */
export function originPlan(name) {
	const key = trainingKey(name);
	const rule = ORIGIN_TRAINING[key];
	if (!rule) return null;
	const fixed = (rule.skills ?? []).filter((s) => typeof s === "string");
	const professions = (rule.skills ?? []).filter((s) => typeof s !== "string").map((s) => s.profession);
	return { fixed, professions, choose: rule.choose ?? 0, chooseOptions: rule.options ?? null, gm: 0, pending: false };
}

/**
 * Concessões de habilidade ("treinamento ou +2" e escolhas), por nome do poder/trilha.
 *  - `grantOrPlus`: concede treinamento ou, se já é treinada, `bonus` (padrão 2) na perícia;
 *  - `options` + `grantOrPlus`: o jogador escolhe a perícia entre as opções;
 *  - `chooseFree`: escolhe 1 perícia destreinada e fica treinada (Esperto);
 *  - `chooseTrained`: escolhe `count` perícias que já são treinadas (Perito, Entendido, Foco em Perícia);
 *  - `chooseBonus`: escolhe a perícia que recebe +`bonus` (Mutação), só entre `options`.
 */
const G = (skill, extra = {}) => ({ mode: "grantOrPlus", skill, bonus: 2, ...extra });
export const TRAINING_GRANTS = Object.freeze({
	// poderes gerais (SaH)
	"acrobatico": G("acrobatics"), "atletico": G("athleticism"), "dedos ageis": G("crime"), "detector de mentiras": G("intuition"),
	"especialista em emergencias": G("medicine"), "informado": G("relevance"), "interrogador": G("intimidation"),
	"mentiroso nato": G("deception"), "observador": G("investigation"), "pai de pet": G("animal"), "pensamento tatico": G("tactics"),
	"personalidade esoterica": G("occultism"), "persuasivo": G("diplomacy"), "pesquisador cientifico": G("sciences"),
	"proativo": G("initiative"), "rato de computador": G("technology"), "sentidos agucados": G("perception"),
	"sobrevivencialista": G("survival"), "sorrateiro": G("stealth"), "talentoso": G("arts"),
	// os 5 poderes que não eram passivos e ficavam sem efeito
	"as do volante": G("driving"), "palavras de devocao": G("religion"), "resposta rapida": G("reflexes"),
	"teimosia obstinada": G("will"), "tenacidade": G("resilience"),
	// trilhas
	"rastrear o paranormal": G("survival"), "revelacao do mal": G("religion"),
	"ser amaldicoado conhecimento": G("occultism"), "ser amaldicoado energia": G("occultism"),
	"ser amaldicoado morte": G("occultism"), "ser amaldicoado sangue": G("occultism"),
	"laboratorio de campo": { mode: "grantOrPlus", options: ["profession:armeiro", "profession:engenheiro", "profession:quimico"], bonus: 5, prompt: "Profissão em que você recebe treinamento (ou +5)" },
	"carteirada": { mode: "grantOrPlus", options: ["diplomacy", "deception"], bonus: 2, prompt: "Perícia em que você recebe treinamento (ou +2)" },
	// escolhas
	"esperto": { mode: "chooseFree", source: "stage", prompt: "Perícia adicional em que você se torna treinado" },
	"mutacao": { mode: "chooseBonus", bonus: 2, options: ["fighting", "athleticism", "aim", "reflexes", "initiative", "acrobatics", "crime", "stealth", "driving", "resilience"], prompt: "Perícia que recebe +2 (baseada em Força, Agilidade ou Vigor)" },
	"perito": { mode: "chooseTrained", count: 2, flag: "peritoSkills", prompt: "Perícias treinadas para o Perito (exceto Luta e Pontaria)" },
	"entendido": { mode: "chooseTrained", count: 2, flag: "peritoSkills", prompt: "Perícias treinadas para o Entendido (exceto Luta e Pontaria)" },
	"foco em pericia": { mode: "chooseTrained", count: 1, flag: "focusSkill", prompt: "Perícia treinada que recebe o foco (exceto Luta e Pontaria)" },
	"treinamento em pericia": { mode: "trainingPower", count: 2, prompt: "Escolha duas perícias" },
});

/** Perícias que Perito/Entendido/Foco não aceitam. */
export const NOT_FOCUSABLE = Object.freeze(["fighting", "aim"]);

/** Perícias baseadas em Força, Agilidade ou Vigor (atributo original do modelo) — para a Mutação. */
export const PHYSICAL_SKILLS = Object.freeze(["fighting", "athleticism", "aim", "reflexes", "initiative", "acrobatics", "crime", "stealth", "driving", "resilience"]);

export function grantFor(name) {
	return TRAINING_GRANTS[passiveKey(name)] ?? null;
}

// ----------------------------------------------------------------------------------------------------------------
// livro-caixa

/** Prioridade de avaliação: origem → classe → seletor manual/Treinamento em Perícia → Grau de Treinamento → habilidades. */
export const SOURCE_RANK = Object.freeze({ origin: 0, class: 1, manual: 3, trainingPower: 3, classGrade: 4, power: 5, path: 5, stage: 5 });

let counter = 0;
export const newEntryId = () => `e${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Entrada do livro-caixa. */
export function makeEntry({ skill = null, kind = "train", source = "manual", sourceItem = null, label = "", locked = false, bonus = 0, profession = null, step = null } = {}) {
	return { id: newEntryId(), skill, kind, source, sourceItem, label, locked, bonus, profession, step };
}

const stableSort = (entries) => entries.map((e, i) => [e, i]).sort((a, b) => (SOURCE_RANK[a[0].source] ?? 3) - (SOURCE_RANK[b[0].source] ?? 3) || a[1] - b[1]).map(([e]) => e);

/** Perícia com nome de Profissão é guardada como "freeSkill"; o token `profession:<nome>` aponta para ela. */
export const skillSlot = (skill) => (String(skill).startsWith("profession:") ? "freeSkill" : skill);

/**
 * Resolve o livro-caixa: grau de cada perícia, travas, bônus ligados e orçamento.
 * @returns {{degrees: Record<string, number>, skills: object, modes: Record<string,string>, budget: object}}
 */
export function resolveTraining({ entries = [], int = 0, level = 1, classKey = null, hasOrigin = false, adjust = {}, converted = false } = {}) {
	const ordered = stableSort(entries);
	const degrees = {};
	const modes = {};
	const skills = {};
	const info = (k) => (skills[k] ??= { degree: 0, locked: 0, lockedBy: [], plus: [], grantedBy: [] });
	// aumentos de grau valem depois de todo o treinamento (um poder pode ser o que treina a perícia a ser aumentada)
	const sequence = [...ordered.filter((e) => e.kind !== "raise"), ...ordered.filter((e) => e.kind === "raise")];
	for (const e of sequence) {
		if (!e.skill) continue;
		const slot = skillSlot(e.skill);
		const d = degrees[slot] ?? 0;
		const s = info(slot);
		if (e.kind === "hold") {
			// Perito, Entendido, Foco em Perícia: não treinam, mas a perícia escolhida não pode ser destreinada
			modes[e.id] = "hold";
			s.locked = Math.max(s.locked, 1);
			s.lockedBy.push(e.label);
			continue;
		}
		if (e.kind === "plus") {
			modes[e.id] = "plus";
			s.plus.push({ entry: e.id, value: e.bonus, label: e.label });
			if (e.locked) s.lockedBy.push(e.label);
			continue;
		}
		if (e.kind === "raise") {
			modes[e.id] = d >= 1 && d < 3 ? "raise" : "void";
			if (d >= 1 && d < 3) degrees[slot] = d + 1;
			continue;
		}
		// train | grant
		if (e.kind === "grant" && d >= 1) {
			modes[e.id] = "plus";
			s.plus.push({ entry: e.id, value: e.bonus || 2, label: e.label });
			s.lockedBy.push(e.label);
			continue;
		}
		modes[e.id] = e.kind === "grant" ? "grant" : "train";
		if (d < 1) degrees[slot] = 1;
		if (e.locked) {
			s.locked = Math.max(s.locked, 1);
			s.lockedBy.push(e.label);
		}
		if (e.kind === "grant") s.grantedBy.push(e.label);
	}
	for (const k of Object.keys(degrees)) info(k).degree = degrees[k];

	// orçamento
	const cls = CLASS_TRAINING[classKey] ?? null;
	const intValue = Math.max(0, Math.trunc(Number(int)) || 0);
	const own = (src, kind) => entries.filter((e) => e.source === src && e.kind === kind && modes[e.id] !== "void").length;
	const selfTrain = own("trainingPower", "train") + own("stage", "train");
	const selfRaise = own("trainingPower", "raise");
	// Treinamento Especial (Sobrevivente que vira outra classe): soma as perícias da classe nova às do Sobrevivente, sem "base + Int" da nova
	const classFree = cls ? (converted && classKey !== "sobrevivente" ? CLASS_TRAINING.sobrevivente.free + CONVERSION_FREE[classKey] : cls.free) : 0;
	const allowedTrain = (hasOrigin ? 2 : 0) + (cls ? classFixedCount(classKey) + classFree + intValue : 0) + selfTrain + (Number(adjust.train) || 0);
	const events = GRADE_LEVELS.filter((l) => Number(level) >= l).length;
	const allowedRaise = (cls?.grade ? events * (cls.grade + intValue) : 0) + selfRaise + (Number(adjust.raise) || 0);
	const usedTrain = entries.filter((e) => e.kind === "train" && e.skill).length;
	const usedRaise = entries.filter((e) => e.kind === "raise" && e.skill).length;
	const budget = {
		train: { allowed: allowedTrain, used: usedTrain },
		raise: { allowed: allowedRaise, used: usedRaise },
		points: { allowed: allowedTrain + allowedRaise, used: usedTrain + usedRaise },
		grants: entries.filter((e) => e.kind === "grant" || e.kind === "plus"),
		pending: entries.filter((e) => !e.skill),
		over: usedTrain > allowedTrain || usedRaise > allowedRaise,
		freeTrain: allowedTrain - usedTrain,
		freeRaise: allowedRaise - usedRaise,
	};
	return { degrees, skills, modes, budget };
}

/** Menor grau (índice) em que a perícia pode ficar: o maior exigido pelas entradas travadas. */
export function lockedMinIndex(entries, skill) {
	return resolveTraining({ entries }).skills[skillSlot(skill)]?.locked ?? 0;
}

/** Quem trava a perícia (nomes das habilidades). */
export function lockedBy(entries, skill) {
	return resolveTraining({ entries }).skills[skillSlot(skill)]?.lockedBy ?? [];
}

/**
 * Plano para o jogador/Mestre mudar o grau de uma perícia no seletor.
 * @returns {{ok:boolean, entries?:object[], reason?:string, message?:string}}
 */
export function planDegreeChange({ entries = [], skill, newLabel, level = 1, int = 0, classKey = null, hasOrigin = false, adjust = {}, isGM = false, converted = false }) {
	const base = resolveTraining({ entries, int, level, classKey, hasOrigin, adjust, converted });
	const slot = skillSlot(skill);
	const current = base.degrees[slot] ?? 0;
	const target = degreeIndex(newLabel);
	if (target === current) return { ok: true, entries };
	let next = entries.map((e) => ({ ...e }));
	if (target > current) {
		if (target > maxDegreeIndex(level) && !isGM) return { ok: false, reason: "nex", message: target === 3 ? "Expert só a partir do NEX 70%." : "Veterano só a partir do NEX 35%." };
		for (let i = current + 1; i <= target; i++) next.push(makeEntry({ skill, kind: i === 1 ? "train" : "raise", source: "manual", step: DEGREES[i] }));
		const after = resolveTraining({ entries: next, int, level, classKey, hasOrigin, adjust, converted });
		if (after.budget.over && !isGM) {
			return { ok: false, reason: "budget", message: target <= 1 ? "Sem vagas de perícia treinada sobrando." : "Sem aumentos de grau sobrando." };
		}
		return { ok: true, entries: next };
	}
	const hold = next.find((e) => e.kind === "hold" && skillSlot(e.skill ?? "") === slot);
	if (hold && target < 1 && !isGM) return { ok: false, reason: "locked", message: `Travada${hold.label ? ` por ${hold.label}` : ""}.` };
	if (hold && target < 1) next = next.filter((e) => e.id !== hold.id);
	// baixar: tira entradas da perícia, da mais prioritária para a menos, enquanto o grau estiver acima do alvo
	let guard = 0;
	while ((resolveTraining({ entries: next }).degrees[slot] ?? 0) > target && guard++ < 20) {
		const mine = stableSort(next.filter((e) => skillSlot(e.skill ?? "") === slot && e.kind !== "plus" && e.kind !== "hold")).reverse();
		const pick = mine.find((e) => !e.locked || isGM);
		if (!pick) {
			const who = mine.find((e) => e.locked)?.label;
			return { ok: false, reason: "locked", message: `Travada${who ? ` por ${who}` : ""}.` };
		}
		next = next.filter((e) => e.id !== pick.id);
	}
	return { ok: true, entries: next };
}

/**
 * Entradas de uma ficha que ainda não tem livro-caixa (migração): origem, treinadas à mão e aumentos.
 * @param {{degrees: Record<string,string>, originSkills?: string[], level?: number}} param0
 */
export function buildLedger({ degrees = {}, originSkills = [], originLabel = "Origem" } = {}) {
	const entries = [];
	const origin = new Set(originSkills);
	for (const key of SKILL_KEYS.concat("freeSkill")) {
		const idx = degreeIndex(degrees[key]);
		if (idx < 1) continue;
		const fromOrigin = origin.has(key);
		entries.push(makeEntry({ skill: key, kind: "train", source: fromOrigin ? "origin" : "manual", label: fromOrigin ? originLabel : "", locked: fromOrigin, step: "trained" }));
		for (let i = 2; i <= idx; i++) entries.push(makeEntry({ skill: key, kind: "raise", source: "manual", step: DEGREES[i] }));
	}
	return entries;
}

/** Perícias que ainda podem ser escolhidas para treinar (destreinadas no livro-caixa). */
export function untrainedSkills(entries = []) {
	const degrees = resolveTraining({ entries }).degrees;
	return SKILL_KEYS.filter((k) => !(degrees[k] > 0));
}

/** Perícias treinadas (grau ≥ 1), para Perito/Entendido/Foco. */
export function trainedSkills(entries = [], { exclude = [] } = {}) {
	const degrees = resolveTraining({ entries }).degrees;
	return SKILL_KEYS.filter((k) => degrees[k] > 0 && !exclude.includes(k));
}

/**
 * Perícias fixas da classe que ainda precisam de escolha, dado o que a origem já treinou (R3).
 * `groups`: um grupo já atendido por uma das opções vira escolha livre.
 * @returns {{groups: string[][], named: string[], extraFree: number}}
 */
export function classPicks(classKey, trainedByOrigin = []) {
	const cls = CLASS_TRAINING[classKey];
	if (!cls) return { groups: [], named: [], extraFree: 0 };
	const have = new Set(trainedByOrigin);
	const groups = [];
	let extraFree = 0;
	for (const group of cls.groups) {
		if (group.some((k) => have.has(k))) extraFree++;
		else groups.push(group);
	}
	const named = [];
	for (const k of cls.fixed) {
		if (have.has(k)) extraFree++;
		else named.push(k);
	}
	return { groups, named, extraFree };
}

/** Saldo de Grau de Treinamento por evento (para o diálogo): quantas perícias podem subir em cada NEX. */
export function gradeBudgetPerEvent(classKey, int = 0) {
	const cls = CLASS_TRAINING[classKey];
	return cls?.grade ? cls.grade + Math.max(0, Math.trunc(Number(int)) || 0) : 0;
}

/** Opções de subir de grau: perícias treinadas/veteranas que o nível permite subir um degrau. */
export function raisableSkills(entries = [], level = 1, { picked = [] } = {}) {
	const degrees = resolveTraining({ entries }).degrees;
	const max = maxDegreeIndex(level);
	return SKILL_KEYS.filter((k) => !picked.includes(k) && (degrees[k] ?? 0) >= 1 && (degrees[k] ?? 0) < max);
}

// ----------------------------------------------------------------------------------------------------------------
// rolagens

/** Foco em Perícia: cada cópia do poder, com a perícia escolhida, dá +1 dado no teste dessa perícia. */
export function focusDice(items = [], skill) {
	if (!skill || NOT_FOCUSABLE.includes(skill)) return 0;
	return items.filter((i) => grantFor(i.name)?.flag === "focusSkill" && i.focusSkill === skill).length;
}

/**
 * Eclético (Especialista) e Engenhosidade: opções de "testar como treinado/veterano/expert" para uma perícia.
 * Treinado custa 2 PE; Engenhosidade soma 2 PE para veterano (NEX 40%, nível 8) e 4 PE para expert (NEX 75%, nível 15).
 * Só oferece graus acima do atual. `bonus` = diferença para o grau atual em pontos.
 */
export function eclecticOptions({ classKey, level = 1, degreeIndex: current = 0 } = {}) {
	if (classKey !== "especialista") return [];
	const options = [{ degree: "trained", index: 1, pe: 2 }];
	if (Number(level) >= 8) options.push({ degree: "veteran", index: 2, pe: 4 });
	if (Number(level) >= 15) options.push({ degree: "expert", index: 3, pe: 6 });
	return options.filter((o) => o.index > current).map((o) => ({ ...o, bonus: DEGREE_POINTS[o.index] - DEGREE_POINTS[current], label: DEGREE_NAMES[o.degree] }));
}
