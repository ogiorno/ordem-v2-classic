/**
 * Perícias treinadas no Foundry: livro-caixa na ficha, escolhas guardadas nas habilidades, travas e o contador.
 * Regras puras em skill-training-rules.mjs; especificação em docs/arquivo/spec-pericias-treinadas.md.
 *
 * O grau de cada perícia na ficha (`degree.label`) é sempre o que o livro-caixa (`flags.ordem_v2_classic.skillTraining`)
 * calcula. Quem muda o seletor de grau passa por `preUpdateActor`: a mudança vira entrada `manual` ou é recusada.
 */
import {
	CLASS_TRAINING, DEGREES, NOT_FOCUSABLE, SKILL_ATTRIBUTE, buildLedger, classPicks, degreeIndex, grantFor, makeEntry, maxDegreeIndex, originPlan,
	planDegreeChange, raisableSkills, resolveTraining, skillSlot, trainedSkills, trainingClassKey, untrainedSkills, gradeBudgetPerEvent,
} from "./skill-training-rules.mjs";
import { CHOICE_FLAG, SKILL_KEYS, SKILL_NAMES } from "./passive-effects-rules.mjs";
import { budgetCard, powerReading, skillReading } from "./grimoire-training.mjs";

const SYS = "ordem_v2_classic";
export const LEDGER_FLAG = "skillTraining";
export const MANAGED_BY = "managedBy";
const CHOICE_ITEM_FLAG = "trainingChoice";

const skillLabel = (k) => (String(k).startsWith("profession:") ? `Profissão (${String(k).slice(11)})` : SKILL_NAMES[k] ?? k);
const slotOf = (skill) => skillSlot(skill);

// ----------------------------------------------------------------------------------------------------------------
// leitura

/** Livro-caixa da ficha; ficha sem livro-caixa devolve `migrated: false` e entradas montadas só em memória. */
export function ledgerOf(actor) {
	const raw = actor.getFlag(SYS, LEDGER_FLAG);
	if (raw?.migrated) return { entries: foundry.utils.deepClone(raw.entries ?? []), adjust: { train: 0, raise: 0, ...(raw.adjust ?? {}) }, migrated: true, converted: Boolean(raw.converted) };
	const origin = actor.itemTypes.origin?.[0];
	const entries = buildLedger({ degrees: sourceDegrees(actor), originSkills: originSkillsOf(actor), originLabel: origin?.name ?? "Origem" });
	for (const e of entries) if (e.source === "origin") e.sourceItem = origin?.id ?? null;
	return { entries, adjust: { train: 0, raise: 0 }, migrated: false, converted: false };
}

/** Graus gravados na ficha (sem efeitos). */
export function sourceDegrees(actor) {
	const skills = actor._source?.system?.skills ?? {};
	return Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, v?.degree?.label ?? "untrained"]));
}

/** Perícias que a origem da ficha dá (as que já estão treinadas). */
function originSkillsOf(actor) {
	const origin = actor.itemTypes?.origin?.[0];
	if (!origin) return [];
	const plan = originPlan(origin.name);
	const degrees = sourceDegrees(actor);
	return (plan?.fixed ?? []).filter((k) => degreeIndex(degrees[k]) > 0);
}

/** Intelecto que conta (R7): o valor da ficha + efeitos permanentes de poderes (sem duração, ligados, não temporários). */
export function permanentInt(actor) {
	let value = Number(actor._source?.system?.attributes?.int?.value) || 0;
	for (const item of actor.items) {
		for (const effect of item.effects) {
			if (effect.disabled || !effect.transfer || effect.getFlag(SYS, "temporary")) continue;
			// +1 de Intelecto de acessório (maldição Sagacidade) não libera perícias nem graus
			if (effect.getFlag(SYS, "curseRule")) continue;
			if (effect.duration?.value || effect.duration?.rounds || effect.duration?.turns) continue;
			for (const change of effect.system?.changes ?? []) {
				if (change.key === "system.attributes.int.value" && (change.type ?? "add") === "add") value += Number(change.value) || 0;
			}
		}
	}
	return Math.max(0, value);
}

export function contextOf(actor, ledger = ledgerOf(actor)) {
	const cls = actor.itemTypes?.class?.[0];
	return {
		int: permanentInt(actor),
		level: Number(actor.system?._progress ?? actor.system?.nivel?.value) || 1,
		classKey: trainingClassKey(cls?.name),
		hasOrigin: Boolean(actor.itemTypes?.origin?.length),
		adjust: ledger.adjust,
		// Treinamento Especial: era Sobrevivente e virou outra classe
		converted: Boolean(ledger.converted),
	};
}

export const resolveActor = (actor, ledger = ledgerOf(actor)) => resolveTraining({ entries: ledger.entries, ...contextOf(actor, ledger) });

// ----------------------------------------------------------------------------------------------------------------
// escrita

/** Grava livro-caixa + graus derivados (e tira/põe os efeitos de +2). */
export async function commitLedger(actor, entries, { adjust, extra = {}, converted } = {}) {
	const current = ledgerOf(actor);
	const next = { entries, adjust: adjust ?? current.adjust, migrated: true, converted: converted ?? current.converted };
	const ctx = { ...contextOf(actor, current), adjust: next.adjust, converted: next.converted && contextOf(actor, current).classKey !== "sobrevivente" };
	const { degrees } = resolveTraining({ entries, ...ctx });
	const update = { ...extra, [`flags.${SYS}.${LEDGER_FLAG}`]: next };
	const src = actor._source.system.skills ?? {};
	for (const key of [...SKILL_KEYS, "freeSkill"]) {
		const want = DEGREES[degrees[key] ?? 0];
		const have = src[key]?.degree?.label;
		if (src[key] && degreeIndex(have) !== (degrees[key] ?? 0)) update[`system.skills.${key}.degree.label`] = want;
	}
	await actor.update(update, { opSkillTraining: true });
	await syncTrainingEffects(actor);
}

/** Cria o livro-caixa de uma ficha antiga (migração): origem, treinadas à mão e as concessões dos poderes que ela já tem. */
export async function ensureLedger(actor) {
	if (!actor || actor.type !== "agent") return false;
	const ledger = ledgerOf(actor);
	if (ledger.migrated) return false;
	let entries = ledger.entries;
	await commitLedger(actor, entries);
	for (const item of actor.items) if (grantFor(item.name) && !isPick(item)) entries = await applyItem(actor, item, { prompt: false, skipEnsure: true });
	return true;
}

const isPick = (item) => item.type === "origin" || item.type === "class";

/** Remove do livro-caixa o que veio de um item (poder apagado). Se o grau subiu, a perícia fica treinada à mão. */
export async function removeItemEntries(actor, itemId) {
	const ledger = ledgerOf(actor);
	if (!ledger.migrated) return;
	const gone = ledger.entries.filter((e) => e.sourceItem === itemId);
	if (!gone.length) return;
	let entries = ledger.entries.filter((e) => e.sourceItem !== itemId);
	const before = resolveTraining({ entries: ledger.entries }).degrees;
	for (const e of gone) {
		if (!e.skill || e.kind === "plus" || e.kind === "hold") continue;
		const slot = slotOf(e.skill);
		const stillTrained = resolveTraining({ entries }).degrees[slot] ?? 0;
		if (stillTrained < 1 && (before[slot] ?? 0) > 1) {
			// já subiu de grau: o Mestre decide; até lá a perícia fica como treinada à mão
			entries.push(makeEntry({ skill: e.skill, kind: "train", source: "manual", label: "" }));
			ui.notifications.warn(`${skillLabel(e.skill)}: o poder ${e.label || ""} saiu, mas a perícia já tinha subido de grau; ela continua treinada para o Mestre decidir.`);
		}
	}
	await commitLedger(actor, entries);
}

/** Liga/desliga os Efeitos Ativos de +2/+5 nos poderes (um por entrada `plus`/`grant`). */
const effectLocks = new Map();

/** Uma sincronização por vez por ficha: o commit e o updateActor chamam juntos e criariam o efeito em dobro. */
export function syncTrainingEffects(actor) {
	const run = (effectLocks.get(actor.id) ?? Promise.resolve()).catch(() => null).then(() => syncTrainingEffectsNow(actor));
	effectLocks.set(actor.id, run);
	run.finally(() => { if (effectLocks.get(actor.id) === run) effectLocks.delete(actor.id); }).catch(() => null);
	return run;
}

async function syncTrainingEffectsNow(actor) {
	const ledger = ledgerOf(actor);
	if (!ledger.migrated) return;
	const { modes } = resolveActor(actor, ledger);
	const wanted = new Map();
	for (const e of ledger.entries) {
		if (!e.sourceItem || !e.skill || !(e.kind === "grant" || e.kind === "plus") || !e.bonus) continue;
		wanted.set(e.id, e);
	}
	for (const item of actor.items) {
		const mine = item.effects.filter((fx) => fx.getFlag(SYS, MANAGED_BY) === "training");
		// um efeito por entrada: duplicatas (duas chamadas juntas, dois navegadores) saem
		const seen = new Set();
		const duplicated = mine.filter((fx) => { const id = fx.getFlag(SYS, "entryId"); if (seen.has(id)) return true; seen.add(id); return false; });
		const stale = mine.filter((fx) => duplicated.includes(fx) || !wanted.has(fx.getFlag(SYS, "entryId")) || wanted.get(fx.getFlag(SYS, "entryId")).sourceItem !== item.id);
		if (stale.length) await item.deleteEmbeddedDocuments("ActiveEffect", stale.map((fx) => fx.id));
		for (const e of wanted.values()) {
			if (e.sourceItem !== item.id) continue;
			const enabled = modes[e.id] === "plus";
			const existing = mine.find((fx) => fx.getFlag(SYS, "entryId") === e.id && !stale.includes(fx));
			const key = `system.skills.${slotOf(e.skill)}.mod`;
			const name = `${e.label}: +${e.bonus} em ${skillLabel(e.skill)}`;
			if (!existing) {
				await item.createEmbeddedDocuments("ActiveEffect", [{
					name, img: "icons/svg/aura.svg", type: "base", transfer: true, disabled: !enabled,
					description: `Já era treinado: +${e.bonus} em ${skillLabel(e.skill)}.`,
					system: { changes: [{ key, type: "add", value: e.bonus, phase: "initial", priority: null }] },
					flags: { [SYS]: { [MANAGED_BY]: "training", entryId: e.id } },
				}]);
			} else if (existing.disabled === enabled || existing.name !== name || existing.system.changes[0]?.key !== key || Number(existing.system.changes[0]?.value) !== Number(e.bonus)) {
				await existing.update({ name, disabled: !enabled, "system.changes": [{ key, type: "add", value: e.bonus, phase: "initial", priority: null }] });
			}
		}
	}
}

// ----------------------------------------------------------------------------------------------------------------
// diálogos

const esc = (t) => foundry.utils.escapeHTML(String(t));

/**
 * Janela com um seletor por vaga. `slots`: [{ label, options: [{ value, label, disabled?, note? }] }].
 * Devolve a lista de valores (um por vaga) ou null (decidir depois).
 */
export async function askSkills({ title, prompt, slots, okLabel = "Confirmar", deferLabel = "Decidir depois", allowEmpty = false, fixed = [], heading = "" }) {
	const optionHtml = (o) => `<option value="${esc(o.value)}"${o.disabled ? " disabled" : ""}>${esc(o.label)}${o.note ? ` — ${esc(o.note)}` : ""}</option>`;
	const body = slots.map((slot, i) => {
		const groups = new Map();
		for (const o of slot.options) groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);
		const options = [...groups].map(([group, list]) => (group ? `<optgroup label="${esc(group)}">${list.map(optionHtml).join("")}</optgroup>` : list.map(optionHtml).join(""))).join("");
		return `<div class="form-group"><label>${esc(slot.label)}</label><div class="form-fields"><select name="slot${i}"><option value="">Escolha…</option>${options}</select></div></div>`;
	}).join("");
	const chips = fixed.length ? `<p class="op-skill-fixed"><span>Já treinadas pela origem:</span> ${fixed.map((l) => `<b class="op-skill-chip"><i class="fa-solid fa-lock" aria-hidden="true"></i> ${esc(l)}</b>`).join(" ")}</p>` : "";
	const result = await foundry.applications.api.DialogV2.wait({
		window: { title: heading || title },
		classes: ["op-skill-choice"],
		content: `<p class="op-skill-prompt">${esc(prompt)}</p>${chips}${body}`,
		buttons: [
			{ action: "ok", label: okLabel, default: true, callback: (_e, button) => slots.map((_s, i) => button.form.elements[`slot${i}`].value) },
			{ action: "later", label: deferLabel, callback: () => null },
		],
		// o que já foi escolhido em um seletor some dos outros
		render: (_event, dialog) => {
			const selects = [...dialog.element.querySelectorAll("select[name^=slot]")];
			const sync = () => {
				const taken = new Set(selects.map((s) => s.value).filter(Boolean));
				for (const s of selects) for (const o of s.options) if (o.value && !o.dataset.locked) o.hidden = taken.has(o.value) && s.value !== o.value;
			};
			selects.forEach((s) => s.addEventListener("change", sync));
		},
		rejectClose: false,
	}).catch(() => null);
	if (!Array.isArray(result)) return null;
	// vagas em branco: só valem quando o saldo pode ficar para depois (Grau de Treinamento, vagas livres)
	const picked = allowEmpty ? result.filter(Boolean) : result;
	if ((allowEmpty && !picked.length) || picked.some((v) => !v)) {
		ui.notifications.warn("Escolha uma perícia em cada seletor (ou decida depois).");
		return askSkills({ title, prompt, slots, okLabel, deferLabel, allowEmpty, fixed, heading });
	}
	if (new Set(picked).size !== picked.length) {
		ui.notifications.warn("Escolha perícias diferentes.");
		return askSkills({ title, prompt, slots, okLabel, deferLabel, allowEmpty, fixed, heading });
	}
	return picked;
}

/** Janela de texto curto (nome da Profissão). */
async function askText({ title, prompt, suggestions = [] }) {
	const result = await foundry.applications.api.DialogV2.wait({
		window: { title }, classes: ["op-skill-choice"],
		content: `<p>${esc(prompt)}</p><div class="form-group"><input type="text" name="name" list="op-prof-list" placeholder="${esc(suggestions.join(", "))}"/><datalist id="op-prof-list">${suggestions.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>`,
		buttons: [
			{ action: "ok", label: "Confirmar", default: true, callback: (_e, b) => b.form.elements.name.value.trim() },
			{ action: "later", label: "Decidir depois", callback: () => null },
		],
		rejectClose: false,
	}).catch(() => null);
	return result || null;
}

const optionsFor = (keys, { trained = new Set(), only = null } = {}) =>
	keys.filter((k) => !only || only.includes(k)).map((k) => ({ value: k, label: skillLabel(k), group: SKILL_ATTRIBUTE[slotOf(k)] ?? "", disabled: trained.has(k), note: trained.has(k) ? "já treinada" : "" }));

const degreesNow = (actor) => resolveActor(actor).degrees;

// ----------------------------------------------------------------------------------------------------------------
// concessões das habilidades

const rankSource = (item) => (item.system?.abilityType === "path" ? "path" : "power");
const sourceOf = (item, g) => g.source ?? rankSource(item);

/** Entradas novas de um item (poder, trilha). Devolve a lista de entradas já gravada. */
export async function applyItem(actor, item, { prompt = true, skipEnsure = false } = {}) {
	const g = grantFor(item.name);
	if (!g) return ledgerOf(actor).entries;
	if (!skipEnsure) await ensureLedger(actor);
	let { entries } = ledgerOf(actor);
	entries = entries.filter((e) => e.sourceItem !== item.id);
	const base = { sourceItem: item.id, label: item.name, locked: true };
	const stored = item.getFlag(SYS, CHOICE_ITEM_FLAG) ?? item.getFlag(SYS, CHOICE_FLAG) ?? null;
	const pendingEntry = (kind) => makeEntry({ ...base, skill: null, kind, source: sourceOf(item, g) });
	const degrees = resolveTraining({ entries }).degrees;
	const trained = new Set(Object.keys(degrees).filter((k) => degrees[k] > 0));

	if (g.mode === "grantOrPlus") {
		let skill = g.skill ?? null;
		if (!skill) {
			skill = g.options.includes(stored) ? stored : null;
			if (!skill && prompt) {
				const pick = await askSkills({ title: item.name, prompt: g.prompt, slots: [{ label: "Perícia", options: g.options.map((k) => ({ value: k, label: skillLabel(k) })) }] });
				skill = pick?.[0] ?? null;
			}
			if (!skill) entries.push(pendingEntry("grant"));
		}
		if (skill) {
			if (skill.startsWith("profession:")) {
				// a ficha só tem uma linha de Profissão: a segunda precisa do Mestre
				const free = actor._source.system.skills?.freeSkill;
				const named = (free?.name ?? "").trim().toLowerCase();
				const wanted = skill.slice(11);
				if (named && named !== wanted && degreeIndex(free?.degree?.label) > 0 && !entries.some((e) => e.skill === skill)) {
					ui.notifications.warn("Sua ficha só tem uma Profissão — peça ao Mestre.");
					entries.push(pendingEntry("grant"));
					await commitLedger(actor, entries);
					return entries;
				}
				if (!named) await actor.update({ "system.skills.freeSkill.name": wanted[0].toUpperCase() + wanted.slice(1) }, { opSkillTraining: true });
			}
			entries.push(makeEntry({ ...base, skill, kind: "grant", source: sourceOf(item, g), bonus: g.bonus ?? 2 }));
			if (g.options && skill !== stored) await item.setFlag(SYS, CHOICE_ITEM_FLAG, skill);
		}
	} else if (g.mode === "chooseFree") {
		let skill = stored && untrainedSkills(entries).includes(stored) ? stored : null;
		if (!skill && prompt) {
			const pick = await askSkills({ title: item.name, prompt: g.prompt, slots: [{ label: "Perícia", options: optionsFor(SKILL_KEYS, { trained }) }] });
			skill = pick?.[0] ?? null;
		}
		entries.push(skill ? makeEntry({ ...base, skill, kind: "train", source: "stage" }) : pendingEntry("train"));
		if (skill && skill !== stored) await item.setFlag(SYS, CHOICE_ITEM_FLAG, skill);
	} else if (g.mode === "chooseBonus") {
		let skill = stored && g.options.includes(stored) ? stored : null;
		if (!skill && prompt) {
			const pick = await askSkills({ title: item.name, prompt: g.prompt, slots: [{ label: "Perícia", options: g.options.map((k) => ({ value: k, label: skillLabel(k) })) }] });
			skill = pick?.[0] ?? null;
		}
		entries.push(skill ? makeEntry({ ...base, skill, kind: "plus", source: sourceOf(item, g), bonus: g.bonus }) : pendingEntry("plus"));
		if (skill && skill !== stored) await item.setFlag(SYS, CHOICE_ITEM_FLAG, skill);
	} else if (g.mode === "chooseTrained") {
		const taken = new Set(actor.items.filter((i) => i.id !== item.id && grantFor(i.name)?.flag === g.flag).flatMap((i) => [].concat(i.getFlag(SYS, g.flag) ?? [])));
		const eligible = trainedSkills(entries, { exclude: NOT_FOCUSABLE }).filter((k) => g.count > 1 || !taken.has(k));
		let chosen = [].concat(item.getFlag(SYS, g.flag) ?? []).filter((k) => eligible.includes(k));
		if (chosen.length < g.count && prompt) {
			if (eligible.length < g.count) ui.notifications.warn(`${item.name}: você ainda não tem ${g.count} perícia(s) treinada(s) para escolher; escolha depois.`);
			else {
				const slots = Array.from({ length: g.count }, (_, i) => ({ label: g.count > 1 ? `Perícia ${i + 1}` : "Perícia", options: optionsFor(eligible) }));
				chosen = (await askSkills({ title: item.name, prompt: g.prompt, slots })) ?? [];
			}
		}
		if (chosen.length >= g.count) {
			await item.setFlag(SYS, g.flag, g.count > 1 ? chosen : chosen[0]);
			for (const skill of chosen) entries.push(makeEntry({ ...base, skill, kind: "hold", source: "power" }));
		} else entries.push(pendingEntry("hold"));
	} else if (g.mode === "trainingPower") {
		entries = await pickTrainingPower(actor, item, entries, { prompt });
	}
	await commitLedger(actor, entries);
	return entries;
}

/** Treinamento em Perícia: duas escolhas, cada uma treina uma destreinada ou sobe uma treinada (NEX 35%/70%). */
async function pickTrainingPower(actor, item, entries, { prompt }) {
	const ctx = contextOf(actor);
	const made = [];
	const stored = item.getFlag(SYS, "trainingPicks");
	if (Array.isArray(stored) && stored.length === 2) {
		for (const p of stored) made.push(makeEntry({ skill: p.skill, kind: p.kind, source: "trainingPower", sourceItem: item.id, label: item.name, locked: true }));
		return [...entries, ...made];
	}
	if (!prompt) return [...entries, makeEntry({ skill: null, kind: "train", source: "trainingPower", sourceItem: item.id, label: item.name, locked: true })];
	const picks = [];
	let working = entries.slice();
	for (let i = 0; i < 2; i++) {
		const degrees = resolveTraining({ entries: working }).degrees;
		const options = SKILL_KEYS.map((k) => {
			const d = degrees[k] ?? 0;
			if (d === 0) return { value: `train:${k}`, label: `${skillLabel(k)} — Destreinada → Treinada` };
			if (d >= maxDegreeIndex(ctx.level)) return { value: `x:${k}`, label: `${skillLabel(k)} — ${d >= 3 ? "já é Expert" : "NEX insuficiente"}`, disabled: true };
			return { value: `raise:${k}`, label: `${skillLabel(k)} — ${["", "Treinada → Veterana", "Veterana → Expert"][d]}` };
		});
		const pick = await askSkills({ title: item.name, prompt: `Escolha ${i + 1} de 2: treine uma perícia ou suba o grau de uma treinada.`, slots: [{ label: "Perícia", options }] });
		if (!pick) break;
		const [kind, skill] = pick[0].split(":");
		picks.push({ kind, skill });
		working = [...working, makeEntry({ skill, kind, source: "trainingPower", sourceItem: item.id, label: item.name, locked: true })];
	}
	if (picks.length === 2) {
		await item.setFlag(SYS, "trainingPicks", picks);
		return working;
	}
	return [...entries, makeEntry({ skill: null, kind: "train", source: "trainingPower", sourceItem: item.id, label: item.name, locked: true })];
}

// ----------------------------------------------------------------------------------------------------------------
// origem e classe

export async function applyOrigin(actor, item, { prompt = true, asGM = false } = {}) {
	await ensureLedger(actor);
	let { entries } = ledgerOf(actor);
	entries = entries.filter((e) => e.sourceItem !== item.id && e.source !== "origin");
	const plan = originPlan(item.name);
	if (!plan) return;
	const base = { source: "origin", sourceItem: item.id, label: item.name, locked: true, kind: "train" };
	for (const skill of plan.fixed) entries.push(makeEntry({ ...base, skill }));
	const names = [];
	for (const profession of plan.professions) {
		let name = profession;
		if (!name && prompt) name = await askText({ title: item.name, prompt: "Qual é a sua Profissão? (nome da Profissão da origem)", suggestions: ["armeiro", "cozinheiro", "engenheiro", "químico", "advogado", "médico"] });
		if (name) names.push(name);
		entries.push(makeEntry({ ...base, skill: name ? `profession:${name.toLowerCase()}` : null }));
	}
	const degrees = resolveTraining({ entries }).degrees;
	const trained = new Set(Object.keys(degrees).filter((k) => degrees[k] > 0));
	const picks = plan.choose;
	if (picks) {
		let chosen = null;
		if (prompt) {
			const options = optionsFor(SKILL_KEYS, { trained, only: plan.chooseOptions });
			// Ferido por Ritual: a perícia depende do elemento do ritual
			const byElement = { resilience: "Sangue", will: "Morte ou Conhecimento", reflexes: "Energia" };
			if (plan.chooseOptions) for (const o of options) o.note = o.disabled ? o.note : `se o ritual for de ${byElement[o.value] ?? "?"}`;
			const slots = Array.from({ length: picks }, (_, i) => ({ label: picks > 1 ? `Perícia ${i + 1}` : "Sua perícia", options }));
			const fixedLabels = entries.filter((e) => e.skill).map((e) => skillLabel(e.skill));
			chosen = await askSkills({
				title: item.name,
				heading: "Escolha suas perícias",
				prompt: `Origem ${item.name}: você treina ${picks === 1 ? "1 perícia" : `${picks} perícias`} à sua escolha.`,
				fixed: fixedLabels, slots,
			});
		}
		for (let i = 0; i < picks; i++) entries.push(makeEntry({ ...base, skill: chosen?.[i] ?? null, chooser: "player" }));
	}
	if (names[0]) await actor.update({ "system.skills.freeSkill.name": names[0][0].toUpperCase() + names[0].slice(1) }, { opSkillTraining: true });
	// R3: a origem vem antes; escolha de classe que repete perícia da origem volta a ser pendente para escolher outra
	const originSkills = new Set(entries.filter((e) => e.source === "origin" && e.skill).map((e) => slotOf(e.skill)));
	entries = entries.map((e) => (e.source === "class" && e.skill && e.kind === "train" && originSkills.has(slotOf(e.skill)) ? { ...e, skill: null } : e));
	await commitLedger(actor, entries);
}

/** Classe: perícias fixas (nomeadas), escolhas de grupo e vagas livres (livres ficam no contador, "Escolher"). */
export async function applyClass(actor, item, { prompt = true } = {}) {
	await ensureLedger(actor);
	const classKey = trainingClassKey(item.name);
	if (!classKey) return;
	let { entries } = ledgerOf(actor);
	entries = entries.filter((e) => e.sourceItem !== item.id);
	// virar Sobrevivente de novo desfaz a conversão; qualquer outra classe depois de ser Sobrevivente é o Treinamento Especial
	const converted = classKey === "sobrevivente" ? false : ledgerOf(actor).converted;
	const base = { source: "class", sourceItem: item.id, label: item.name, locked: true, kind: "train" };
	const degrees = resolveTraining({ entries }).degrees;
	const byOrigin = Object.keys(degrees).filter((k) => degrees[k] > 0);
	const { groups, named } = classPicks(classKey, byOrigin);
	for (const skill of named) entries.push(makeEntry({ ...base, skill }));
	const trained = new Set(byOrigin);
	const slots = groups.map((group, i) => ({ label: `Grupo ${i + 1}: ${group.map(skillLabel).join(" ou ")}`, options: optionsFor(group, { trained }) }));
	let chosen = null;
	if (slots.length && prompt) chosen = await askSkills({ title: item.name, prompt: "Escolha uma perícia de cada grupo da classe.", slots });
	groups.forEach((_g, i) => entries.push(makeEntry({ ...base, skill: chosen?.[i] ?? null })));
	await commitLedger(actor, entries, { converted });
	if (prompt) await chooseOpenSlots(actor);
}

// ----------------------------------------------------------------------------------------------------------------
// vagas abertas (livres da classe/Int) e Grau de Treinamento

/** Vagas de perícia treinada que ainda não foram usadas (classe, Intelecto, Esperto…). */
export function openTrainSlots(actor) {
	const r = resolveActor(actor);
	return Math.max(0, r.budget.train.allowed - r.budget.train.used - r.budget.pending.filter((e) => e.kind === "train").length);
}

export async function chooseOpenSlots(actor) {
	const n = openTrainSlots(actor);
	const ctx = contextOf(actor);
	if (!n || !ctx.classKey) return false;
	const { entries } = ledgerOf(actor);
	const degrees = resolveTraining({ entries }).degrees;
	const trained = new Set(Object.keys(degrees).filter((k) => degrees[k] > 0));
	const slots = Array.from({ length: n }, (_, i) => ({ label: `Perícia ${i + 1}`, options: optionsFor(SKILL_KEYS, { trained }) }));
	const chosen = await askSkills({ title: "Perícias treinadas", prompt: `Você tem ${n} vaga(s) de perícia treinada. Perícias já treinadas ficam desabilitadas. Vagas em branco ficam guardadas.`, slots, allowEmpty: true });
	if (!chosen) return false;
	const next = entries.concat(chosen.map((skill) => makeEntry({ skill, kind: "train", source: "class", label: "Classe", locked: true })));
	await ensureLedger(actor);
	await commitLedger(actor, next);
	return true;
}

/** Grau de Treinamento: escolhe perícias treinadas para subir um degrau (NEX 35% e 70%). */
export async function chooseGradeRaises(actor) {
	const ctx = contextOf(actor);
	const r = resolveActor(actor);
	const free = r.budget.raise.allowed - r.budget.raise.used;
	if (free <= 0) {
		ui.notifications.info("Você não tem aumentos de grau sobrando.");
		return false;
	}
	const { entries } = ledgerOf(actor);
	const options = raisableSkills(entries, ctx.level).map((k) => ({ value: k, label: `${skillLabel(k)} — ${["", "Treinada → Veterana", "Veterana → Expert"][r.degrees[k]]}` }));
	if (!options.length) {
		ui.notifications.warn("Nenhuma perícia pode subir de grau agora (precisa ser treinada e o NEX permitir).");
		return false;
	}
	const count = Math.min(free, options.length);
	const slots = Array.from({ length: count }, (_, i) => ({ label: `Aumento ${i + 1}`, options }));
	const chosen = await askSkills({ title: "Grau de Treinamento", prompt: `Você pode subir até ${count} perícia(s) um degrau. Escolha só as que quiser agora; o saldo fica guardado.`, slots, deferLabel: "Guardar o saldo", allowEmpty: true });
	if (!chosen) return false;
	const next = entries.concat(chosen.map((skill) => makeEntry({ skill, kind: "raise", source: "classGrade", label: "Grau de Treinamento", event: ctx.level >= 14 ? 14 : 7 })));
	await ensureLedger(actor);
	await commitLedger(actor, next);
	return true;
}

/** Escolhas pendentes: itens cuja escolha ficou para depois. */
export async function resolvePending(actor) {
	await ensureLedger(actor);
	const pending = ledgerOf(actor).entries.filter((e) => !e.skill);
	const itemIds = [...new Set(pending.map((e) => e.sourceItem).filter(Boolean))];
	for (const id of itemIds) {
		const item = actor.items.get(id);
		if (!item) continue;
		if (item.type === "origin") await applyOrigin(actor, item);
		else if (item.type === "class") await applyClass(actor, item);
		else await applyItem(actor, item);
	}
	await chooseOpenSlots(actor);
	return pending.length;
}

// ----------------------------------------------------------------------------------------------------------------
// visão da ficha (contador)

const SOURCE_NAMES = { origin: "Origem", class: "Classe", manual: "Escolha manual", trainingPower: "Treinamento em Perícia", classGrade: "Grau de Treinamento", power: "Habilidade", path: "Habilidade de trilha", stage: "Esperto" };

export function trainingView(actor) {
	if (actor.type !== "agent") return null;
	const ledger = ledgerOf(actor);
	const ctx = contextOf(actor, ledger);
	const r = resolveTraining({ entries: ledger.entries, ...ctx });
	const b = r.budget;
	const showRaise = ctx.level >= 7 && Boolean(CLASS_TRAINING[ctx.classKey]?.grade);
	const cls = b.over ? "is-over" : b.train.used >= b.train.allowed && b.train.allowed > 0 ? "is-full" : "";
	const lines = [];
	const countBy = (pred) => ledger.entries.filter(pred).length;
	if (ctx.hasOrigin) lines.push(`Origem ${countBy((e) => e.source === "origin" && e.skill)}/2`);
	if (ctx.classKey) {
		const c = CLASS_TRAINING[ctx.classKey];
		lines.push(`Classe ${countBy((e) => e.source === "class" && e.skill)}/${c.groups.length + c.fixed.length + c.free + ctx.int} (${c.groups.length + c.fixed.length} fixas + ${c.free} + Int ${ctx.int})`);
	}
	if (countBy((e) => e.source === "trainingPower")) lines.push(`Treinamento em Perícia ×${countBy((e) => e.source === "trainingPower" && e.skill) / 2}`);
	if (countBy((e) => e.source === "stage")) lines.push("Esperto +1");
	if (showRaise) lines.push(`Grau de Treinamento ${b.raise.used}/${b.raise.allowed}`);
	const grants = b.grants.filter((e) => e.skill).map((e) => `${e.label}: ${skillLabel(e.skill)}${r.modes[e.id] === "plus" ? ` (+${e.bonus || 2})` : ""}`);
	const pendingCount = b.pending.length + openTrainSlots(actor);
	const skills = {};
	for (const [key, s] of Object.entries(r.skills)) {
		const parts = [];
		if (s.lockedBy.length) parts.push(`Travada por ${s.lockedBy.filter(Boolean).join(", ")}`);
		if (s.plus.length) parts.push(`+${s.plus.reduce((a, p) => a + p.value, 0)} ${s.plus.map((p) => p.label).join(", ")}`);
		const origin = ledger.entries.filter((e) => slotOf(e.skill ?? "") === key && e.source !== "manual" && e.kind !== "plus" && e.kind !== "hold" && r.modes[e.id] !== "plus").map((e) => `${DEGREES_LABEL[e.kind === "raise" ? "raise" : "train"]} ${e.label || SOURCE_NAMES[e.source]}`);
		if (!parts.length && !origin.length) continue;
		skills[key] = { icon: s.lockedBy.length ? "fa-lock" : "fa-circle-info", title: [...origin, ...parts].join(" · ") };
	}
	return {
		cls, showRaise, over: b.over,
		train: b.train, raise: b.raise, points: b.points,
		pending: pendingCount, hasPending: pendingCount > 0,
		lines, grants, gm: game.user.isGM, adjust: ledger.adjust, migrated: ledger.migrated,
		openSlots: openTrainSlots(actor), freeRaise: showRaise ? Math.max(0, b.raise.allowed - b.raise.used) : 0,
		skills,
	};
}
const DEGREES_LABEL = { train: "Treinada:", raise: "Aumento:" };

/** Janela com o detalhamento (e o ajuste do Mestre). */
export async function showTrainingDetail(actor) {
	const v = trainingView(actor);
	const rows = v.lines.map((l) => `<li>${esc(l)}</li>`).join("");
	const grants = v.grants.length ? `<h4>Concedidas por habilidades (${v.grants.length})</h4><ul>${v.grants.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : "";
	const adjust = v.gm ? `<h4>Ajuste do Mestre</h4><div class="form-group"><label>Treinadas</label><input type="number" name="train" value="${v.adjust.train}"/></div><div class="form-group"><label>Aumentos de grau</label><input type="number" name="raise" value="${v.adjust.raise}"/></div>` : "";
	const rule = "<p class=\"hint\">Regras: a origem entra primeiro e a classe nunca repete perícia; Veterano só no NEX 35% e Expert no NEX 70%; o Intelecto (permanente) soma vagas e aumentos; habilidades que concedem treinamento não gastam vaga.</p>";
	return foundry.applications.api.DialogV2.wait({
		window: { title: "Quantas perícias posso ter?" }, classes: ["op-skill-choice"],
		content: `<ul>${rows}</ul>${grants}${rule}${adjust}`,
		buttons: [
			{ action: "ok", label: v.gm ? "Salvar ajuste" : "Fechar", default: true, callback: (_e, button) => (v.gm ? { train: Number(button.form.elements.train.value) || 0, raise: Number(button.form.elements.raise.value) || 0 } : null) },
		],
		rejectClose: false,
	}).then(async (result) => {
		if (result && v.gm && (result.train !== v.adjust.train || result.raise !== v.adjust.raise)) {
			await ensureLedger(actor);
			await commitLedger(actor, ledgerOf(actor).entries, { adjust: result });
		}
	}).catch(() => null);
}

// ----------------------------------------------------------------------------------------------------------------
// grimório

/** Leitura de um poder que mexe em perícia, para o personagem escolhido (ou null). */
export function trainingReadingForItem(actor, item) {
	if (!actor || !item || !grantFor(item.name)) return null;
	const ledger = ledgerOf(actor);
	const mine = ledger.entries.filter((e) => e.sourceItem === item.id);
	if (!mine.length) return null;
	const { modes } = resolveTraining({ entries: ledger.entries, ...contextOf(actor, ledger) });
	const names = [...new Set(mine.filter((e) => e.skill).map((e) => skillLabel(e.skill)))];
	const first = mine[0];
	return powerReading({ mode: modes[first.id] ?? null, skill: names.join(" e "), bonus: first.bonus, pending: mine.every((e) => !e.skill), kind: first.kind });
}

/** Leitura de uma perícia (chave do modelo) para o personagem escolhido, mais o cartão do contador. */
export function trainingReadingForSkill(actor, key) {
	if (!actor || actor.type !== "agent" || !key) return null;
	const ledger = ledgerOf(actor);
	const ctx = contextOf(actor, ledger);
	const r = resolveTraining({ entries: ledger.entries, ...ctx });
	const info = r.skills[key] ?? { degree: 0, lockedBy: [], plus: [] };
	const mine = ledger.entries.filter((e) => e.skill && slotOf(e.skill) === key && e.kind !== "plus" && e.kind !== "hold");
	const view = trainingView(actor);
	return {
		...skillReading({
			name: SKILL_NAMES[key] ?? key, degree: info.degree ?? 0,
			sources: mine.filter((e) => e.source !== "manual").map((e) => `${e.kind === "raise" ? "aumento: " : ""}${e.label || SOURCE_NAMES[e.source]}`),
			locked: info.lockedBy.filter(Boolean), plus: (info.plus ?? []).map((p) => ({ value: p.value, label: p.label })), manual: mine.some((e) => e.source === "manual"),
		}),
		card: budgetCard({ train: view.train, raise: view.raise, points: view.points, showRaise: view.showRaise, over: view.over }),
	};
}

// ----------------------------------------------------------------------------------------------------------------
// ganchos

const queues = new Map();
const QUEUE_ORDER = { origin: 0, class: 1 };
const waiting = new Map();

/** Enfileira o item: quem chega junto é atendido por ordem (origem, classe, poderes) e um diálogo de cada vez. */
export function queueFor(actor, item) {
	const list = waiting.get(actor.id) ?? [];
	list.push(item);
	waiting.set(actor.id, list);
	const run = (queues.get(actor.id) ?? Promise.resolve()).then(async () => {
		// espera os itens que chegaram juntos (origem e classe criadas na mesma ação) para atender na ordem certa
		await new Promise((resolve) => setTimeout(resolve, 250));
		const batch = (waiting.get(actor.id) ?? []).sort((a, b) => (QUEUE_ORDER[a.type] ?? 2) - (QUEUE_ORDER[b.type] ?? 2));
		waiting.set(actor.id, []);
		for (const it of batch) {
			if (!actor.items.get(it.id)) continue;
			try {
				if (it.type === "origin") await applyOrigin(actor, it);
				else if (it.type === "class") await applyClass(actor, it);
				else await applyItem(actor, it);
			} catch (err) {
				console.warn("Ordem Paranormal | perícias treinadas:", err);
			}
		}
	});
	queues.set(actor.id, run);
	return run;
}

Hooks.on("createItem", (item, _options, userId) => {
	const actor = item.parent;
	if (userId !== game.user.id || actor?.type !== "agent") return;
	const relevant = item.type === "origin" || item.type === "class" || (item.type === "ability" && grantFor(item.name));
	if (!relevant) return;
	// uma ficha por vez: origem, classe e poderes abrem os diálogos em sequência (origem primeiro, depois classe)
	setTimeout(() => queueFor(actor, item), 400);
});

Hooks.on("deleteItem", (item, _options, userId) => {
	const actor = item.parent;
	if (userId !== game.user.id || actor?.type !== "agent") return;
	// o Sobrevivente que larga a classe guarda as perícias dele: a classe seguinte conta como Treinamento Especial
	if (item.type === "class" && trainingClassKey(item.name) === "sobrevivente" && ledgerOf(actor).migrated) {
		commitLedger(actor, ledgerOf(actor).entries, { converted: true }).catch((err) => console.warn("Ordem Paranormal | perícias treinadas:", err));
	}
	removeItemEntries(actor, item.id).catch((err) => console.warn("Ordem Paranormal | perícias treinadas:", err));
});

// O seletor de grau da ficha: vira entrada manual ou é recusado (trava, NEX, vagas).
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
	if (options?.opSkillTraining || actor.type !== "agent" || userId !== game.user.id) return;
	const skills = changes.system?.skills;
	if (!skills) return;
	const keys = Object.keys(skills).filter((k) => skills[k]?.degree?.label !== undefined);
	if (!keys.length) return;
	const ledger = ledgerOf(actor);
	const ctx = contextOf(actor, ledger);
	let entries = ledger.entries;
	let touched = false;
	for (const key of keys) {
		const plan = planDegreeChange({ ...ctx, entries, skill: key, newLabel: skills[key].degree.label, isGM: game.user.isGM });
		if (!plan.ok) {
			ui.notifications.warn(`${skillLabel(key)}: ${plan.message}`);
			delete skills[key].degree.label;
			if (!Object.keys(skills[key].degree).length) delete skills[key].degree;
			if (!Object.keys(skills[key]).length) delete skills[key];
			setTimeout(() => actor.sheet?.render(), 50);
			continue;
		}
		if (plan.entries !== entries) touched = true;
		entries = plan.entries;
		// o grau gravado é sempre o do livro-caixa
		const final = resolveTraining({ entries, ...ctx }).degrees[slotOf(key)] ?? 0;
		if (skills[key]) skills[key].degree = { ...(skills[key].degree ?? {}), label: DEGREES[final] };
	}
	if (touched || !ledger.migrated) foundry.utils.setProperty(changes, `flags.${SYS}.${LEDGER_FLAG}`, { entries, adjust: ledger.adjust, migrated: true, converted: ledger.converted });
});

Hooks.on("updateActor", (actor, changes, options, userId) => {
	if (userId !== game.user.id || actor.type !== "agent" || options?.opSkillTraining) return;
	if (changes.flags?.[SYS]?.[LEDGER_FLAG] === undefined && changes.system?.skills === undefined && changes.system?.attributes?.int === undefined && changes.system?.nivel === undefined) return;
	syncTrainingEffects(actor).catch((err) => console.warn("Ordem Paranormal | perícias treinadas:", err));
});

/** "Treinamento em Perícia" não existia nos compêndios de poderes de classe: o Mestre ativo cria o item que falta (idempotente). */
const TRAINING_POWER_PACKS = { fighterPowers: "trPeriFight00001", specialistPowers: "trPeriSpec000001", occultistPowers: "trPeriOccu000001" };
const TRAINING_POWER_TEXT = "<p>Escolha duas perícias. Você se torna treinado nessas perícias. A partir de NEX 35%, você pode escolher perícias nas quais já é treinado para se tornar veterano. A partir de NEX 70%, pode escolher perícias nas quais já é veterano para se tornar expert. Você pode escolher este poder várias vezes.</p>";
export async function ensureTrainingPowerItems() {
	const made = [];
	for (const [name, id] of Object.entries(TRAINING_POWER_PACKS)) {
		const pack = game.packs.get(`${SYS}.${name}`);
		if (!pack || pack.index.has(id) || [...pack.index].some((e) => e.name === "Treinamento em Perícia")) continue;
		const folder = pack.folders.find((f) => /livro/i.test(f.name));
		const wasLocked = pack.locked;
		if (wasLocked) await pack.configure({ locked: false });
		try {
			await Item.implementation.create({
				_id: id, name: "Treinamento em Perícia", type: "ability", img: "icons/svg/book.svg", folder: folder?.id ?? null, sort: 999000,
				system: { abilityType: "class", activation: "passive", description: TRAINING_POWER_TEXT, cost: 0, costType: "PE" },
			}, { pack: pack.collection, keepId: true });
			made.push(name);
		} finally {
			if (wasLocked) await pack.configure({ locked: true });
		}
	}
	return made;
}

// O Mestre ativo cria o livro-caixa das fichas que já existem (migração única por ficha).
Hooks.once("ready", () => {
	if (game.users.activeGM?.id !== game.user.id) return;
	(async () => {
		await ensureTrainingPowerItems();
		for (const actor of game.actors.filter((a) => a.type === "agent")) await ensureLedger(actor);
	})().catch((err) => console.warn("Ordem Paranormal | migração das perícias treinadas falhou:", err));
});

export { gradeBudgetPerEvent };
