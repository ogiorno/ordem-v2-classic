/**
 * Conexão e afinidade com um elemento (sem depender do Foundry, testável em Node).
 * Especificação: docs/spec-afinidade.md. Fonte: Livro de Regras v1.3, "Afinidade" (p. 110) e "Afinidade Elemental" (p. 114).
 *
 * Em NEX 50% o agente se conecta a um elemento (não pode mudar). Na primeira vez que recebe um poder paranormal depois
 * disso, a conexão vira afinidade. O poder recebido no mesmo nível da conexão, quando ela nasce da subida de nível, não conta.
 */

export const AFFINITY_ELEMENTS = Object.freeze({
	knowledge: { label: "Conhecimento" },
	energy: { label: "Energia" },
	death: { label: "Morte" },
	blood: { label: "Sangue" },
});

/** Nível que equivale a NEX 50% na progressão por nível (NEX = nível × 5%). */
export const CONNECTION_LEVEL = 10;
export const CONNECTION_NEX = 50;

/** Quem oprime quem (livro, "Entidades do Outro Lado"): chave = oprimido, valor = opressor. */
export const OPPRESSOR_OF = Object.freeze({
	blood: "death",
	knowledge: "blood",
	energy: "knowledge",
	death: "energy",
});

export const isElement = (key) => Object.hasOwn(AFFINITY_ELEMENTS, key);
export const elementLabel = (key) => AFFINITY_ELEMENTS[key]?.label ?? "";

/** Elemento que oprime o dado (null se não for um dos quatro). */
export function oppressorOf(element) {
	return isElement(element) ? OPPRESSOR_OF[element] : null;
}

/** O agente já chegou a NEX 50%? `byNex`: a ficha progride por NEX (senão, por nível). */
export function reachedConnection({ nex = 0, level = 1, byNex = true } = {}) {
	return byNex ? Number(nex) >= CONNECTION_NEX : Number(level) >= CONNECTION_LEVEL;
}

/** Estado vazio de `system.paranormal`. */
export const emptyParanormal = () => ({ connection: "", affinity: "", graceLevel: 0, connectedAtNex: 0 });

const norm = (p = {}) => ({ ...emptyParanormal(), ...p, connection: isElement(p?.connection) ? p.connection : "", affinity: isElement(p?.affinity) ? p.affinity : "" });

/** Pode escolher a conexão agora? Só uma vez, e só depois de NEX 50%. */
export function canConnect(paranormal, progress) {
	const p = norm(paranormal);
	return reachedConnection(progress) && !p.connection;
}

/**
 * Estado depois de escolher o elemento. `viaLevelUp`: a conexão nasceu da subida para NEX 50%, então um poder paranormal
 * recebido no mesmo nível não vale como "a próxima vez".
 */
export function connect(paranormal, element, { level = 1, nex = 0, viaLevelUp = false } = {}) {
	const p = norm(paranormal);
	if (!isElement(element) || p.connection) return p;
	return { ...p, connection: element, affinity: "", graceLevel: viaLevelUp ? Number(level) || 0 : 0, connectedAtNex: Number(nex) || 0 };
}

/**
 * Estado depois de receber um poder paranormal no nível `level`. Devolve o mesmo objeto (referência igual a uma cópia
 * normalizada) quando nada muda.
 */
export function afterParanormalPower(paranormal, { level = 1 } = {}) {
	const p = norm(paranormal);
	if (!p.connection || p.affinity) return p;
	if (p.graceLevel && Number(level) === p.graceLevel) return p;
	return { ...p, affinity: p.connection, graceLevel: 0 };
}

/** Elemento do poder paranormal a partir do pré-requisito ("Sangue 1" → blood). */
export function powerElement(preRequisite) {
	const text = String(preRequisite ?? "");
	for (const [key, { label }] of Object.entries(AFFINITY_ELEMENTS)) if (new RegExp(`\\b${label}\\b`, "i").test(text)) return key;
	return null;
}

/** Quantos poderes paranormais de cada elemento a ficha tem (`powers`: lista de pré-requisitos). */
export function powersByElement(preRequisites = []) {
	const counts = { knowledge: 0, energy: 0, death: 0, blood: 0 };
	for (const pre of preRequisites) {
		const key = powerElement(pre);
		if (key) counts[key] += 1;
	}
	return counts;
}

/**
 * Vista para a ficha e para o grimório.
 * @returns {{ state:"locked"|"pending"|"connected"|"affinity", connection:string, affinity:string, oppressor:string|null,
 *   label:string, summary:string }}
 */
export function affinityStatus(paranormal, progress) {
	const p = norm(paranormal);
	const element = p.affinity || p.connection;
	if (!element) {
		const ready = reachedConnection(progress);
		return { state: ready ? "pending" : "locked", connection: "", affinity: "", oppressor: null, label: ready ? "Conexão pendente" : "Sem conexão", summary: ready ? "Escolha o elemento com que se conecta." : "A conexão acontece em NEX 50%." };
	}
	const oppressor = oppressorOf(element);
	if (p.affinity) return { state: "affinity", connection: p.connection, affinity: p.affinity, oppressor, label: `Afinidade com ${elementLabel(element)}`, summary: `Sem componentes em rituais de ${elementLabel(element)}. +1d20 contra efeitos de ${elementLabel(element)}; –1d20 contra efeitos de ${elementLabel(oppressor)}.` };
	return { state: "connected", connection: p.connection, affinity: "", oppressor, label: `Conectado a ${elementLabel(element)}`, summary: "A conexão vira afinidade na próxima vez que você receber um poder paranormal." };
}

/** O ritual (ou forma) que exige afinidade é satisfeito por esta ficha? `required`: texto do requisito ("afinidade" ou nome do elemento). */
export function affinityMeets(paranormal, required, ritualElement = "") {
	const p = norm(paranormal);
	if (!p.affinity) return false;
	if (!required || required === "afinidade") return !ritualElement || ritualElement === p.affinity;
	const key = powerElement(required);
	return key ? key === p.affinity : p.affinity === ritualElement;
}

/** Rituais do elemento da afinidade dispensam componentes ritualísticos. */
export function skipsComponents(paranormal, ritualElement) {
	const p = norm(paranormal);
	return Boolean(p.affinity) && p.affinity === ritualElement;
}

/** Dados adicionais num teste contra efeito de `effectElement`: +1 (próprio elemento), –1 (opressor), 0 (resto). */
export function testDiceDelta(paranormal, effectElement) {
	const p = norm(paranormal);
	if (!p.affinity || !isElement(effectElement)) return 0;
	if (effectElement === p.affinity) return 1;
	if (effectElement === oppressorOf(p.affinity)) return -1;
	return 0;
}

// ----------------------------------------------------------------------------------------------------------------
// conjuração de rituais (Fase 2)

/**
 * A forma do ritual exige afinidade? `required`: texto lido da descrição ("afinidade" ou "Morte"). O requisito genérico
 * vale para o elemento do próprio ritual. Quem não é jogador (Mestre) conjura sem a exigência: `bypass`.
 * @returns {{ needed:boolean, ok:boolean, element:string, label:string }}
 */
export function formAffinityCheck(paranormal, required, ritualElement = "", { bypass = false } = {}) {
	if (!required) return { needed: false, ok: true, element: "", label: "" };
	const element = required === "afinidade" ? ritualElement : powerElement(required) ?? "";
	const label = elementLabel(element) || "o elemento do ritual";
	return { needed: true, ok: bypass || affinityMeets(paranormal, required, ritualElement), element, label };
}

/** "Componente de Sangue" / "Componentes de Morte" → elemento (null se não for componente ritualístico). */
export function componentElementOf(name) {
	const m = /^\s*componentes?\s+(?:ritual[ií]sticos?\s+)?de\s+(\p{L}+)/iu.exec(String(name ?? ""));
	return m ? powerElement(m[1]) : null;
}

const plain = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** O poder "Improvisar Componentes" permite usar objetos comuns no lugar do componente. */
export const isComponentImproviser = (name) => plain(name) === "improvisar componentes";

/**
 * Situação dos componentes ritualísticos para conjurar um ritual do elemento.
 * Medo não tem componentes. Afinidade dispensa. Sem eles, só avisa (nunca trava).
 * @returns {{ state:"none"|"dispensed"|"ok"|"improvised"|"missing", note:string }}
 */
export function componentStatus(paranormal, ritualElement, { componentElements = [], improvises = false } = {}) {
	if (!isElement(ritualElement)) return { state: "none", note: "" };
	if (skipsComponents(paranormal, ritualElement)) return { state: "dispensed", note: `Afinidade: sem componentes de ${elementLabel(ritualElement)}.` };
	if (componentElements.includes(ritualElement)) return { state: "ok", note: "" };
	if (improvises) return { state: "improvised", note: "Componentes improvisados." };
	return { state: "missing", note: `Sem Componente de ${elementLabel(ritualElement)} na ficha.` };
}
