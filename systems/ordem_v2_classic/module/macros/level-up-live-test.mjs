// Teste ao vivo da tela de recompensa de nível: para cada classe e para cada trilha dos compêndios, sobe o nível
// um a um (Sobrevivente: estágio) e confere o que a tela mostra contra o que realmente mudou na ficha e contra
// as tabelas do livro. Cria fichas temporárias "ZZ nível …" (sem donos) e apaga todas no fim; nada do mundo é alterado.
//
//   const t = await import("/systems/ordem_v2_classic/module/macros/level-up-live-test.mjs");
//   const r = await t.runLevelUpTests({ classes: ["Combatente"] });   // sem argumento: todas
//
// Roda como Mestre sem jogador dono conectado (é a regra que faz a tela aparecer para o Mestre). Spec: docs/spec-tela-de-nivel.md.

import { normalizeName } from "../helpers/level-progression-rules.mjs";
import { calculateStatusMaxima } from "../helpers/actor-calculations.mjs";

const SYSTEM = "ordem_v2_classic";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KEYS = ["PV", "PE", "PD", "SAN"];

// Tabelas 1.3–1.5 do Livro de Regras transcritas por NEX. S = habilidade fixa da classe, T = trilha,
// P = poder, A = aumento de atributo, G = grau de treinamento, V = versatilidade (P/A/G/V pedem escolha).
const BOOK = {
	combatente: { 10: "T", 15: "P", 20: "A", 25: "S", 30: "P", 35: "G", 40: "T", 45: "P", 50: "AV", 55: "S", 60: "P", 65: "T", 70: "G", 75: "P", 80: "A", 85: "S", 90: "P", 95: "A", 99: "T" },
	especialista: { 10: "T", 15: "P", 20: "A", 25: "S", 30: "P", 35: "G", 40: "ST", 45: "P", 50: "AV", 55: "S", 60: "P", 65: "T", 70: "G", 75: "SP", 80: "A", 85: "S", 90: "P", 95: "A", 99: "T" },
	ocultista: { 10: "T", 15: "P", 20: "A", 25: "S", 30: "P", 35: "G", 40: "T", 45: "P", 50: "AV", 55: "S", 60: "P", 65: "T", 70: "G", 75: "P", 80: "A", 85: "S", 90: "P", 95: "A", 99: "T" },
};
const nexOf = (level) => (level >= 20 ? 99 : level * 5);

const folderChain = (folder) => {
	const chain = [];
	for (let f = folder; f; f = f.folder) chain.unshift(f.name);
	return chain;
};

/** Trilhas do compêndio com a classe a que pertencem (pelo nome da pasta). */
async function listPaths() {
	const pack = game.packs.get(`${SYSTEM}.paths`);
	const index = await pack.getIndex({ fields: ["folder", "type"] });
	const found = [];
	for (const entry of index) {
		if (entry.type !== "path") continue;
		const folder = pack.folders.get(entry.folder);
		const cls = folderChain(folder).map(normalizeName).find((n) => ["combatente", "especialista", "ocultista", "sobrevivente"].includes(n));
		found.push({ id: entry._id, name: entry.name, cls: cls ?? null });
	}
	return found;
}

async function makeActor(className, pathId) {
	const classDoc = (await game.packs.get(`${SYSTEM}.classes`).getDocuments()).find((c) => normalizeName(c.name) === className);
	const pathDoc = await game.packs.get(`${SYSTEM}.paths`).getDocument(pathId);
	const actor = await Actor.create({ name: `ZZ nível ${className} / ${pathDoc.name}`, type: "agent", ownership: { default: 0 } });
	await actor.createEmbeddedDocuments("Item", [classDoc.toObject(), pathDoc.toObject()]);
	await pause(900);
	return actor;
}

const abilityNames = (actor) => new Set(actor.items.filter((i) => i.type === "ability").map((i) => i.name));

async function waitOverlay(level, timeout = 4000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const el = document.querySelector(`.op-levelup-overlay .op-lu-level-num[data-to="${level}"]`)?.closest(".op-levelup-overlay");
		if (el) return el;
		await pause(40);
	}
	return null;
}

/** Sobe um nível e confere a tela. @returns {string[]} problemas encontrados */
async function checkStep(actor, className, level, { survivor, possessed }) {
	const problems = [];
	document.querySelectorAll(".op-levelup-overlay").forEach((el) => el.remove());
	// Ganho esperado pela fórmula do livro (nível novo menos o anterior); os efeitos das habilidades da trilha
	// (ex.: Monstruoso) mexem nos máximos depois e não fazem parte do ganho de nível.
	const classStats = actor.itemTypes.class[0].system;
	const attrs = actor.system.attributes;
	const noSan = actor.usingWithoutSanityRule || false;
	const maxima = (lv) => calculateStatusMaxima(attrs.vit.value || 0, attrs.pre.value || 0, lv, noSan, classStats);
	const mapKey = { PV: "PV_max", PE: "PE_max", PD: "PD_max", SAN: "SAN_max" };
	const expectGain = Object.fromEntries(KEYS.map((k) => [k, maxima(level)[mapKey[k]] - maxima(level - 1)[mapKey[k]]]));
	if (noSan) expectGain.SAN = 0; // sem Sanidade a tela não mostra SAN
	const before = Object.fromEntries(KEYS.map((k) => [k, actor.system[k].max]));
	const namesBefore = abilityNames(actor);
	const field = survivor ? "system.stage.value" : "system.nivel.value";
	await actor.update({ [field]: level });
	const el = await waitOverlay(level);
	if (!el) return [`tela não apareceu ao chegar em ${level}`];
	el.querySelector(".op-levelup-card")?.click(); // termina a animação: valores finais
	await pause(120);
	await pause(700); // deixa as habilidades da trilha serem concedidas na ficha

	const num = el.querySelector(".op-lu-level-num");
	if (num.textContent.trim() !== String(level)) problems.push(`número do nível mostra ${num.textContent}`);
	if (num.dataset.from !== String(level - 1)) problems.push(`"de" = ${num.dataset.from}`);

	// Ganhos de status: iguais à mudança real dos máximos da ficha.
	const shown = Object.fromEntries([...el.querySelectorAll(".op-lu-stat")].map((s) => [[...s.classList].find((c) => /^op-lu-(PV|PE|PD|SAN|PP)$/.test(c)).slice(6), s]));
	for (const k of KEYS) {
		const gain = expectGain[k];
		const card = shown[k];
		// Habilidades de trilha com efeito por nível (ex.: Casca Grossa, +1 PV por nível) somam ao ganho real:
		// a tela pode mostrar o ganho da fórmula ou o ganho real da ficha.
		const realGain = actor.system[k].max - before[k];
		const shownGain = card ? Number(card.querySelector(".op-lu-stat-gain").textContent.replace("+", "")) : 0;
		if (gain > 0 && !card) problems.push(`${k}: ganhou ${gain} e a tela não mostra`);
		else if (gain > 0 && shownGain !== gain && shownGain !== realGain) problems.push(`${k}: tela ${card.querySelector(".op-lu-stat-gain").textContent} ≠ esperado ${gain} (real ${realGain})`);
		else if (gain > 0 && !card.querySelector(".op-lu-stat-total").textContent.replace(/\s/g, "").startsWith(`${before[k]}→`)) problems.push(`${k}: "antes" errado (${card.querySelector(".op-lu-stat-total").textContent}, ficha tinha ${before[k]})`);
		else if (gain <= 0 && card) problems.push(`${k}: tela mostra ganho que não houve`);
	}
	if (shown.PP && !possessed) problems.push("PP apareceu fora do Possuído");
	if (possessed && level === 2 && !shown.PP) problems.push("Possuído nível 2 sem PP");

	// Benefícios do livro (só classes do livro; Sobrevivente não mostra).
	const lis = [...el.querySelectorAll(".op-lu-features li")];
	if (survivor) {
		if (lis.length) problems.push("Sobrevivente mostra benefícios de classe do livro");
	} else {
		const token = BOOK[className][nexOf(level)] ?? "";
		const levelLines = lis.filter((li) => li.querySelector("b")?.textContent.trim() === `Nível ${level}`);
		if (levelLines.length !== token.length) problems.push(`benefícios do nível ${level}: ${levelLines.length} na tela, livro tem ${token.length} (${token})`);
		const choices = levelLines.filter((li) => li.classList.contains("is-choice")).length;
		const wantChoices = [...token].filter((c) => "PAGV".includes(c)).length;
		if (choices !== wantChoices) problems.push(`escolhas pendentes: ${choices} na tela, livro pede ${wantChoices}`);
		if (possessed && token.includes("P") && !levelLines.some((li) => /Transcender/.test(li.textContent))) problems.push("Possuído: poder não virou Transcender");
		if (!possessed && /Transcender/.test(el.textContent)) problems.push("Transcender fora do Possuído");
	}

	// Habilidades de trilha: o que a tela lista deve ser exatamente o que a ficha ganhou neste nível.
	const listed = [...el.querySelectorAll(".op-lu-ability b")].map((b) => b.textContent.trim()).sort();
	const gained = actor.items
		.filter((i) => i.type === "ability" && !namesBefore.has(i.name) && i.getFlag(SYSTEM, "granted")?.level === level)
		.map((i) => i.name)
		.sort();
	if (JSON.stringify(listed) !== JSON.stringify(gained)) problems.push(`habilidades: tela [${listed}] ≠ ficha [${gained}]`);
	for (const li of el.querySelectorAll(".op-lu-ability")) {
		if (!li.querySelector("p")?.textContent.trim()) problems.push(`habilidade sem descrição: ${li.querySelector("b")?.textContent}`);
		if (!li.querySelector("img")?.getAttribute("src")) problems.push("habilidade sem ícone");
	}
	if (!el.querySelector(".op-lu-close")) problems.push("sem botão Continuar");
	el.remove();
	return problems;
}

/**
 * @param {{classes?: string[], paths?: string[], maxLevel?: number}} [options]
 * @returns {Promise<{total: number, failed: number, failures: object[], perPath: object[]}>}
 */
export async function runLevelUpTests({ classes, paths, maxLevel = 20 } = {}) {
	const errors = [];
	const onError = (event) => errors.push(event.message);
	window.addEventListener("error", onError);
	const failures = [];
	const perPath = [];
	let total = 0;
	const created = [];
	try {
		const list = (await listPaths()).filter((p) => p.cls && (!classes || classes.map(normalizeName).includes(p.cls)) && (!paths || paths.map(normalizeName).includes(normalizeName(p.name))));
		for (const path of list) {
			const survivor = path.cls === "sobrevivente";
			const possessed = normalizeName(path.name).includes("possuido");
			const actor = await makeActor(path.cls, path.id);
			created.push(actor.id);
			const top = survivor ? Math.min(maxLevel, 5) : maxLevel;
			let bad = 0;
			for (let level = 2; level <= top; level++) {
				total++;
				let problems;
				try {
					problems = await checkStep(actor, path.cls, level, { survivor, possessed });
				} catch (err) {
					problems = [`exceção: ${err.message}`];
				}
				if (problems.length) {
					bad++;
					failures.push({ classe: path.cls, trilha: path.name, nivel: level, problemas: problems });
				}
			}
			perPath.push({ classe: path.cls, trilha: path.name, passos: top - 1, falhas: bad, survivor });
			await actor.delete();
			created.pop();
		}
	} finally {
		window.removeEventListener("error", onError);
		for (const id of created) await game.actors.get(id)?.delete();
		document.querySelectorAll(".op-levelup-overlay").forEach((el) => el.remove());
	}
	if (errors.length) failures.push({ classe: "-", trilha: "-", nivel: 0, problemas: [`erros de JavaScript: ${[...new Set(errors)].join(" ; ")}`] });
	return { total, failed: failures.length, failures, perPath, leftover: game.actors.filter((a) => a.name.startsWith("ZZ nível")).length };
}
