/**
 * Linha "Afinidade" de cada poder paranormal (sem depender do Foundry, testável em Node).
 * Especificação: docs/spec-afinidade.md, Fase 4. Fonte: Livro de Regras v1.3 (p. 114 a 118) e Sobrevivendo ao Horror (p. 46 e 47).
 *
 * Quem tem afinidade com o elemento do poder pode escolher o poder uma segunda vez; a cópia dá o benefício da linha
 * "Afinidade" e nada mais. Cada poder do compêndio cai em um destes casos (o teste afinidade.test.mjs confere que
 * nenhum ficou de fora):
 *  - `changes`: o sistema cria um Efeito Ativo `transfer` na cópia com a diferença que a afinidade traz.
 *  - `manual`: a linha vale, mas não há campo de ficha para somar; o texto aparece no grimório.
 */
import { passiveKey } from "./passive-effects-rules.mjs";

export const AFFINITY_COPY_FLAG = "affinityCopy";
/** Marca do Efeito Ativo criado pelo sistema na cópia de afinidade. */
export const AFFINITY_RULE_FLAG = "affinityRule";

const add = (key, value, label) => ({ key, value, label });
const skill = (key, value, label) => add(`system.skills.${key}.mod`, value, label);
const pe = (value, label) => add("system.PE.bonus", value, label);

/** Por que a linha não vira número de ficha. */
export const AFFINITY_MANUAL_REASONS = Object.freeze({
	escolha: "Depende de uma escolha do jogador (poder de outra classe, elemento): feita na hora de usar.",
	condicional: "Só vale numa situação (cena de ação, ao usar o poder, ao ficar machucado): efeito de ficha ficaria ligado fora dela.",
	acao: "Muda como o poder é usado (DT, alvos, rerrolagem, ordem das ações); não há número de ficha.",
	imunidade: "Dá imunidade ou ignora uma regra; a ficha de agente não tem campo para isso.",
	recurso: "Muda um recurso próprio do poder (cargas, cura acelerada) que a ficha não guarda.",
	rituais: "Altera o custo de rituais: fica com o fluxo de rituais.",
	dano: "Muda o dano de uma arma ou ataque específico.",
});

const MANUAL = (reason, line, element) => ({ element, line, manual: reason });
const AUTO = (changes, line, element, note = "") => ({ element, line, changes, note });

/** Nome comparável do poder → linha de afinidade. Os textos resumem as linhas "Afinidade:" do livro. */
export const AFFINITY_POWERS = Object.freeze({
	// --- elemento à escolha ---
	"resistir a elemento": MANUAL("escolha", "A resistência ao elemento escolhido aumenta de 10 para 20.", null),

	// --- Conhecimento ---
	"absorver conhecimento": MANUAL("rituais", "Ao usar um ritual de Conhecimento que tenha como alvo 1 pessoa (exceto você), se puder tocá-la, o custo do ritual cai em –1 PE.", "knowledge"),
	"apatia herege": MANUAL("acao", "Você pode usar o poder depois de saber se passou no teste e escolhe a melhor das duas rolagens.", "knowledge"),
	"expansao de conhecimento": MANUAL("escolha", "Você aprende um segundo poder de classe que não pertença à sua classe.", "knowledge"),
	"percepcao paranormal": MANUAL("acao", "Você pode rolar de novo até dois dados com resultado menor que 10.", "knowledge"),
	"precognicao": MANUAL("imunidade", "Você fica imune à condição desprevenido.", "knowledge"),
	"sensitivo": MANUAL("acao", "Em teste oposto com uma dessas perícias, o oponente sofre –1d20.", "knowledge"),
	"visao do oculto": MANUAL("imunidade", "Você ignora camuflagem.", "knowledge"),

	// --- Energia ---
	"afortunado": MANUAL("acao", "Uma vez por teste, você pode rolar de novo um resultado 1 em d20.", "energy"),
	"campo protetor": MANUAL("condicional", "Ao usar o poder, +5 em Reflexos e, até o início do próximo turno, passar num Reflexos que reduziria o dano à metade faz você não sofrer dano.", "energy"),
	"causalidade fortuita": MANUAL("acao", "A DT para procurar pistas sempre diminui em –5 para você.", "energy"),
	"conexao empatica": MANUAL("condicional", "+5 em testes de perícias baseadas em Intelecto ou Presença com o objeto.", "energy"),
	"golpe de sorte": MANUAL("dano", "Seus ataques recebem +1 no multiplicador de crítico.", "energy"),
	"manipular entropia": MANUAL("acao", "O alvo rola de novo todos os dados que você escolher.", "energy"),
	"valer se do caos": MANUAL("acao", "Você perde Sanidade se o teste for uma falha ou se o resultado do dado extra for 1 ou 2.", "energy"),

	// --- Morte ---
	"antecipar vitalidade": MANUAL("recurso", "O limite de cargas de antecipação aumenta em +2 e você passa a perder 2 cargas por ação dormir.", "death"),
	"aura de pavor": MANUAL("acao", "A DT para resistir ao poder aumenta em +5 e o alvo passa a ser quaisquer pessoas ou animais escolhidos no alcance.", "death"),
	"encarar a morte": MANUAL("condicional", "Em cenas de ação, seu limite de gasto de PE por turno aumenta em +2 (total de +3).", "death"),
	"escapar da morte": MANUAL("acao", "Em vez do normal, você evita completamente o dano; em dano massivo, fica com 1 PV.", "death"),
	"potencial aprimorado": AUTO([pe("@nivel.value", "+1 PE adicional por 5% de NEX (total de +2 por 5%)")], "Você recebe +1 PE adicional por NEX (total de +2 PE por NEX).", "death"),
	"potencial reaproveitado": MANUAL("recurso", "Você ganha 3 PE temporários, em vez de 2.", "death"),
	"surto temporal": MANUAL("acao", "Em vez de uma vez por cena, você pode usar o poder uma vez por turno.", "death"),

	// --- Sangue ---
	"anatomia insana": MANUAL("imunidade", "Você é imune aos efeitos de acertos críticos e ataques furtivos.", "blood"),
	"arma de sangue": MANUAL("dano", "A arma se torna parte permanente de você e causa 1d10 pontos de dano de Sangue.", "blood"),
	"espreitar da besta": AUTO([skill("stealth", 5, "+5 em Furtividade adicional (total de +10)")], "O bônus em Furtividade aumenta para +10.", "blood"),
	"instintos sanguinarios": MANUAL("imunidade", "Você não pode mais ser flanqueado, não fica desprevenido e recebe +5 em testes de resistência contra armadilhas.", "blood"),
	"sangue de ferro": AUTO([skill("resilience", 5, "+5 em Fortitude")], "Você recebe +5 em Fortitude e se torna imune a venenos e doenças.", "blood", "A imunidade a venenos e doenças não tem campo na ficha: vale pelo texto."),
	"sangue fervente": MANUAL("condicional", "O bônus em Agilidade ou Força ao ficar machucado aumenta para +2.", "blood"),
	"sangue vivo": MANUAL("recurso", "A cura acelerada aumenta para 5.", "blood"),
});

/** Linha de afinidade do poder (ou null se o nome não é um poder paranormal conhecido). */
export function affinityLineFor(name) {
	return AFFINITY_POWERS[passiveKey(name)] ?? null;
}

/** O poder pode ser escolhido uma segunda vez (cópia de afinidade)? "Resistir a Elemento" já se repete por elemento. */
export function canHaveAffinityCopy(name) {
	const key = passiveKey(name);
	return Boolean(AFFINITY_POWERS[key]) && key !== "resistir a elemento";
}

/**
 * A ficha ganha o benefício da linha de afinidade com esta cópia?
 * `affinity`: elemento da afinidade do agente. Só vale se o elemento do poder for o mesmo.
 */
export function copyGrantsBenefit(name, affinity) {
	const line = affinityLineFor(name);
	return Boolean(line && affinity && line.element === affinity);
}

/** Dados do Efeito Ativo da cópia (ou null se a linha é manual ou a ficha não tem a afinidade certa). */
export function affinityEffectData(name, affinity) {
	const line = affinityLineFor(name);
	if (!line?.changes || !copyGrantsBenefit(name, affinity)) return null;
	return {
		name: `${name} (Afinidade)`,
		img: "icons/svg/aura.svg",
		type: "base",
		transfer: true,
		disabled: false,
		description: line.changes.map((c) => c.label).filter(Boolean).join("; "),
		system: { changes: line.changes.map((c) => ({ key: c.key, type: "add", value: typeof c.value === "number" ? c.value : String(c.value), phase: "initial", priority: null })) },
		flags: { "ordem-v2-classic": { [AFFINITY_RULE_FLAG]: true } },
	};
}

/**
 * Trecho em HTML com a linha de afinidade, para o grimório. `hasAffinity`: o personagem em foco tem afinidade com o
 * elemento do poder (null = sem personagem em foco).
 */
export function affinityParagraph(name, { hasAffinity = null } = {}) {
	const line = affinityLineFor(name);
	if (!line) return "";
	const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
	const how = line.changes ? "o sistema aplica o bônus na cópia" : "aplique pelo texto";
	const status = hasAffinity === null ? "" : hasAffinity ? " Você tem a afinidade: pode escolher o poder uma segunda vez." : " Exige afinidade com o elemento do poder.";
	return `<p class="op-affinity-line"><strong>Afinidade:</strong> ${esc(line.line)} <em>(${esc(how)}.)</em>${esc(status)}</p>`;
}
