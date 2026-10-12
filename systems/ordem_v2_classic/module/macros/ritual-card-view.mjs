// Visão da carta de ritual no chat: tudo o que a carta mostra, calculado dos dados da conjuração.
// Funções puras (sem Foundry), testáveis em Node. Spec: docs/arquivo/spec-carta-de-ritual-no-chat.md.

/** Texto curto, sem acento e em minúsculas: chave para achar um ritual pelo nome. */
export const nameKey = (name) => String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Entrada do índice do Grimório com o nome do ritual (sem acento nem caixa); null se não houver. */
export function findRitualEntry(index, name) {
	const key = nameKey(name);
	if (!key) return null;
	return (index ?? []).find((entry) => entry.kind === "ritual" && nameKey(entry.name) === key) ?? null;
}

/**
 * Pastilhas de uma lista de dados: o maior valor da face fica "max" (verde), o 1 fica "min" (vermelho)
 * e o que foi descartado fica "off" (apagado).
 * @param {{result:number, active?:boolean, discarded?:boolean}[]} results
 * @param {number} faces
 * @returns {{value:number, state:""|"max"|"min"|"off"}[]}
 */
export function diceChips(results, faces) {
	return (results ?? []).filter((entry) => Number.isFinite(Number(entry.result))).map((entry) => {
		const value = Number(entry.result);
		const off = entry.active === false || entry.discarded === true;
		return { value, state: off ? "off" : value === Number(faces) ? "max" : value === 1 ? "min" : "" };
	});
}

/**
 * Dados de uma rolagem como dados simples (serializáveis na mensagem): cada termo de dados com as faces e os resultados.
 * @param {{dice?: {faces?:number, results?: {result:number, active?:boolean, discarded?:boolean}[]}[], total?:number}|null} roll
 * @returns {{faces:number, results:{result:number, active:boolean}[]}[]}
 */
export function extractDice(roll) {
	return (roll?.dice ?? []).map((term) => ({
		faces: Number(term.faces) || 0,
		results: (term.results ?? []).filter((entry) => Number.isFinite(Number(entry.result))).map((entry) => ({ result: Number(entry.result), active: entry.active !== false && !entry.discarded })),
	})).filter((term) => term.results.length);
}

/** Soma dos dados que valeram: o resto do total é bônus fixo. */
export const activeSum = (dice) => (dice ?? []).reduce((total, term) => total + term.results.filter((entry) => entry.active).reduce((sum, entry) => sum + entry.result, 0), 0);

/**
 * Dado e bônus de um teste, a partir da rolagem: o d20 que valeu (o maior, se rolou mais de um), o que se somou a ele
 * e todos os dados rolados (para a lista aberta ao tocar no dado).
 * @returns {{die:number, bonus:number, others:number[], crit:"crit"|"fumble"|null, dice:{value:number, state:string}[]}|null}
 */
export function rollBreakdown(roll) {
	const die = roll?.dice?.find((term) => Number(term.faces) === 20) ?? roll?.dice?.[0];
	const results = (die?.results ?? []).filter((entry) => Number.isFinite(Number(entry.result)));
	if (!results.length) return null;
	const kept = results.filter((entry) => entry.active !== false && !entry.discarded);
	const chosen = (kept.length ? kept : results).reduce((best, entry) => (Number(entry.result) > Number(best.result) ? entry : best));
	const value = Number(chosen.result);
	const total = Number(roll.total);
	return {
		die: value,
		bonus: Number.isFinite(total) ? total - value : 0,
		others: results.filter((entry) => entry !== chosen).map((entry) => Number(entry.result)),
		crit: value === 20 ? "crit" : value === 1 ? "fumble" : null,
		// o que valeu é o escolhido; os demais ficam apagados mesmo que o sistema não os tenha marcado como descartados
		dice: results.map((entry) => ({ value: Number(entry.result), state: entry === chosen ? (value === Number(die.faces) ? "max" : value === 1 ? "min" : "") : "off" })),
	};
}

/** "d20 12 + 7", "d20 12 − 2" ou "d20 12" (com os outros dados em parênteses). */
export function breakdownText(breakdown) {
	if (!breakdown) return "";
	const sign = breakdown.bonus < 0 ? "−" : "+";
	const bonus = breakdown.bonus ? ` ${sign} ${Math.abs(breakdown.bonus)}` : "";
	const others = breakdown.others.length ? ` (${breakdown.others.join(", ")})` : "";
	return `d20 ${breakdown.die}${others}${bonus}`;
}

const TEST_LABELS = { concentration: "Concentração", occultism: "Ocultismo" };

/** Blocos de teste da carta: só os do conjurador (concentração e Ocultismo). A resistência das criaturas vai para a mensagem do Mestre. */
export function testBlocks(outcome = {}) {
	const blocks = [];
	for (const key of ["concentration", "occultism"]) {
		const test = outcome[key];
		if (!test) continue;
		blocks.push({
			kind: key, label: TEST_LABELS[key], total: test.total ?? null, dt: test.dt ?? null,
			success: test.success ?? null, breakdown: test.breakdown ?? null, text: test.text ?? "",
		});
	}
	return blocks;
}

/**
 * O dano (ou cura) rolado na carta: total, e por tipo as pastilhas de cada dado.
 * @param {{kind?:string, total?:number, parts?: {type:string, formula?:string, total:number, dice?:{faces:number, results:{result:number, active?:boolean}[]}[], flat?:number}[]}|null} damageRoll
 * @returns {{kind:"damage"|"healing", total:number, groups:{type:string, formula:string, subtotal:number, flat:number, dice:{faces:number, chips:{value:number, state:string}[]}[]}[]}|null}
 */
export function damageView(damageRoll) {
	if (!damageRoll || !Number.isFinite(Number(damageRoll.total))) return null;
	const groups = (damageRoll.parts ?? []).map((part) => ({
		type: part.type ?? "", formula: part.formula ?? "", subtotal: Number(part.total) || 0, flat: Number(part.flat) || 0,
		dice: (part.dice ?? []).map((term) => ({ faces: term.faces, chips: diceChips(term.results, term.faces) })),
	}));
	return { kind: damageRoll.kind === "healing" ? "healing" : "damage", total: Number(damageRoll.total), groups };
}

/**
 * Faixa de estado (seção 4.2 da spec): só para estados sem teste para mostrar. Sucesso e falha do Ocultismo não têm faixa:
 * o ritual funcionou nos dois casos e o veredito é o ✔/✖ embaixo do resultado. Devolve null quando não há faixa.
 */
export function resultBanner(outcome = {}) {
	if (outcome.awaitingCurse) return { state: "waiting", icon: "hourglass-half", label: "Falta um passo", text: "Escolha em quem fica a maldição." };
	if (outcome.awaitingArea) return { state: "waiting", icon: "hourglass-half", label: "Falta um passo", text: "Posicione a área no mapa." };
	if (outcome.awaitingTargets) return { state: "waiting", icon: "hourglass-half", label: "Falta um passo", text: "Marque o alvo no mapa (tecla T) e role o dano." };
	if (outcome.pending) return { state: "ready", icon: "dice-d20", label: "Pronto para rolar", text: "O custo já foi pago. Role o teste." };
	if (outcome.interrupted) return { state: "failure", icon: "circle-xmark", label: "Concentração perdida", text: "O efeito não acontece. O custo foi pago." };
	if (outcome.effectsPending) return { state: "gm", icon: "crown", label: "Com o Mestre", text: "O Mestre resolve as criaturas." };
	if (outcome.areaManual) return { state: "gm", icon: "crown", label: "Com o Mestre", text: "A área foi resolvida; o Mestre aplica o dano." };
	return null;
}

/**
 * Fichas de custo, DT e alvo. `+N` em vermelho quando a falha cobrou PD a mais; a DT só existe quando houve teste
 * (Custo do Paranormal ligado); mais de 2 alvos viram "N alvos".
 */
const hasNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

export function chips({ cost, extra = 0, dt = null, concentrationDt = null, targetNames = [] } = {}) {
	const list = [];
	if (hasNumber(cost)) list.push({ kind: "cost", icon: "droplet", text: `${cost} PD`, extra: extra > 0 ? `+${extra}` : "" });
	if (hasNumber(dt)) list.push({ kind: "dt", icon: "shield-halved", text: `DT ${dt}`, title: "DT do teste de Ocultismo (20 + custo)" });
	if (hasNumber(concentrationDt)) list.push({ kind: "dt", icon: "shield-halved", text: `Conc. DT ${concentrationDt}`, title: "DT do teste de concentração" });
	if (targetNames.length) list.push({ kind: "target", icon: "bullseye", text: targetNames.length > 2 ? `${targetNames.length} alvos` : targetNames.join(", "), title: targetNames.join(", ") });
	return list;
}

/** Ícone (Font Awesome) de cada tipo de dano; tipo desconhecido usa o ícone genérico do dano. */
const DAMAGE_TYPE_ICONS = {
	cuttingDamage: "scissors", impactDamage: "hammer", piercingDamage: "thumbtack", ballisticDamage: "gun",
	bloodDamage: "droplet", deathDamage: "skull", knowledgeDamage: "eye", energyDamage: "bolt", fearDamage: "ghost",
	fireDamage: "fire", coldDamage: "snowflake", eletricDamage: "bolt-lightning", chemicalDamage: "flask", mentalDamage: "brain",
};
export const damageTypeIcon = (type) => DAMAGE_TYPE_ICONS[type] ?? "burst";

/** Linha dos Detalhes com o PD gasto na conjuração; `extra` é o que a falha cobrou além do custo. */
export function costNote({ cost, extra = 0 } = {}) {
	if (!hasNumber(cost)) return "";
	const paid = Number(cost) + (Number(extra) || 0);
	return extra > 0 ? `Gastou ${paid} PD (${cost} de custo + ${extra} pela falha)` : `Gastou ${paid} PD`;
}

/** Corta o texto numa frase de no máximo `limit` caracteres, sem partir palavra. */
export function firstSentence(text, limit = 140) {
	const clean = String(text ?? "").replace(/\s+/g, " ").trim();
	if (!clean) return "";
	const stop = /[.!?](?:\s|$)/.exec(clean);
	const sentence = stop ? clean.slice(0, stop.index + 1) : clean;
	if (sentence.length <= limit) return sentence;
	const cut = sentence.slice(0, limit - 1);
	return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length).trimEnd()}…`;
}

/**
 * Frase do efeito neste uso: o primeiro efeito aplicado; sem ele, a primeira frase do texto base do ritual.
 * @param {{effects?: string[], baseText?: string}} p
 */
export function effectSentence({ effects = [], baseText = "" } = {}) {
	const own = effects.find((line) => String(line).trim());
	return firstSentence(own || baseText);
}

/**
 * O ritual precisa do botão "Rolar dano" na carta? (rituais com dano ou cura rolados na conjuração)
 * @param {{ruleDamage?: boolean, effect?: {kind?:string, formula?:string}|null}} p  `ruleDamage`: a regra de área tem dano no efeito principal
 * @returns {null|"damage"|"healing"}
 */
export function damageGate({ ruleDamage = false, effect = null } = {}) {
	if (ruleDamage) return "damage";
	if (effect?.formula) return effect.kind === "healing" ? "healing" : "damage";
	return null;
}

/** Rótulo do botão de dano. */
export const damageButtonLabel = (kind) => (kind === "healing" ? "Rolar cura" : "Rolar dano");

/** Custo extra cobrado na falha: o que sai do PD é no máximo o que o agente tem. */
export function extraCostCharge(amount, balance) {
	const wanted = Math.max(0, Math.floor(Number(amount) || 0));
	const have = Math.max(0, Math.floor(Number(balance) || 0));
	const charged = Math.min(wanted, have);
	return { charged, missing: wanted - charged };
}
