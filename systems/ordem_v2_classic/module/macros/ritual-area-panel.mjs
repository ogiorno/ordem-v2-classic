// Painel de Resolução da Área (só Mestre): o motor resolve o ritual de área (acha os afetados, rola resistência e dano)
// mas não aplica nada; o Mestre aplica por alvo ou em todos. Spec: docs/arquivo/spec-fluxo-conjuracao-rapida.md (FC-45 a FC-49b, UI-20 a UI-28).
// Lógica pura em ritual-area-panel-logic.mjs; contas e efeitos no motor (ritual-area-engine.mjs).

import {
	ROW_STATE, appliedLine, applyAllPlan, canApplyRow, editPart, markApplied, markIgnored, markRestored, markUndone,
	pendingCount, publicSummary, resistMode, restorePart, rowEdited, rowStateLabel, rowTotal,
} from "./ritual-area-panel-logic.mjs";
import { applyAreaEffect, damageLabel, executeAreaRow, planAreaEffect, planTokenRow, undoAreaRow } from "./ritual-area-engine.mjs";
import { areaRuleFor } from "./ritual-area-rules.mjs";
import { FLOW_SETTING, flowSetting } from "../helpers/ritual-flow-settings.mjs";

const SYSTEM = "ordem_v2_classic";
const FLAG = "ritualAreaPanel";
const busy = new Set();

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SKILL_LABEL = { resilience: "Fortitude", reflexes: "Reflexos", will: "Vontade" };

/** O efeito tem algo para o Mestre decidir (dano, resistência, condição ou efeito especial)? */
export function isPlannableEffect(spec) {
	return Boolean(spec && (spec.damage?.length || spec.save || spec.onFail?.length || spec.onSuccess?.length || spec.special));
}

/** A configuração do mundo vale, exceto numa arena de teste ao vivo, que força o modo só neste navegador. */
export const isManualAreaMode = () => (globalThis.__opAreaApplyOverride ?? flowSetting(FLOW_SETTING.areaApply)) !== "automatic";

/* -------------------------------------------- */
/*  HTML                                        */
/* -------------------------------------------- */

function damageText(spec, rolls) {
	const parts = (rolls ?? []).map((entry) => `${entry.amount} ${damageLabel(entry.type)}`);
	const save = spec?.save ? ` · ${SKILL_LABEL[spec.save.skill] ?? spec.save.skill}${{ half: ", metade se passar", none: ", sem dano se passar", negates: ", anulado se passar" }[spec.save.success] ?? ""}` : "";
	return parts.length ? `Dano rolado: ${parts.join(" + ")}${save}` : `Sem dano${save}`;
}

function rowHtml(row, index, editable) {
	const save = row.save ? `${SKILL_LABEL[row.save.skill] ?? row.save.skill} ${row.save.total ?? "—"} contra DT ${row.save.dt}: <strong>${row.save.passed ? "✔ passou" : "✘ falhou"}</strong>` : "<em>sem resistência</em>";
	const mode = row.save ? resistMode({ success: row.saveRule }, row.save.passed) : "total";
	const parts = row.parts.map((part, partIndex) => {
		const field = editable
			? `<input type="number" min="0" step="1" value="${part.amount}" data-action="ritual-area-edit" data-row="${index}" data-part="${partIndex}" aria-label="Dano de ${escapeHtml(damageLabel(part.type))} em ${escapeHtml(row.name)}">`
			: `<strong>${part.amount}</strong>`;
		const original = part.amount !== part.original ? ` <s title="Rolado">${part.original}</s> <a data-action="ritual-area-restore-part" data-row="${index}" data-part="${partIndex}" title="Restaurar o valor rolado"><i class="fa-solid fa-rotate-left"></i></a>` : "";
		return `<span class="rap-part">${field} ${escapeHtml(damageLabel(part.type))}${editable ? original : ""}</span>`;
	}).join(" ");
	const conditions = row.conditions?.length ? `<span class="rap-cond">${row.conditions.map((cond) => escapeHtml(cond.label ?? cond.key)).join(", ")}</span>` : "";
	const notes = (row.notes ?? []).map((note) => `<small class="rap-note">${escapeHtml(note)}</small>`).join("");
	const result = row.applied?.lines?.length ? `<small class="rap-note">${escapeHtml(row.applied.lines.join(" "))}</small>` : "";
	let buttons = "";
	if (row.state === ROW_STATE.PENDING) buttons = `<button type="button" data-action="ritual-area-apply" data-row="${index}"><i class="fa-solid fa-check"></i> Aplicar</button> <button type="button" data-action="ritual-area-ignore" data-row="${index}"><i class="fa-solid fa-ban"></i> Ignorar</button>`;
	else if (row.state === ROW_STATE.APPLIED) buttons = `<button type="button" data-action="ritual-area-undo" data-row="${index}"><i class="fa-solid fa-rotate-left"></i> Desfazer</button>`;
	else if (row.state === ROW_STATE.IGNORED) buttons = `<button type="button" data-action="ritual-area-restore" data-row="${index}"><i class="fa-solid fa-rotate"></i> Reativar</button>`;
	else if (row.state === ROW_STATE.DISABLED) buttons = `<button type="button" data-action="ritual-area-restore" data-row="${index}" title="${escapeHtml(row.disabledReason ?? "")}"><i class="fa-solid fa-unlock"></i> Habilitar</button>`;
	const reason = row.state === ROW_STATE.DISABLED ? `<small class="rap-note">${escapeHtml(row.disabledReason ?? "")}</small>` : "";
	return `<li class="rap-row" data-state="${row.state}" data-row="${index}" data-token-id="${escapeHtml(row.tokenId)}">
		<img src="${escapeHtml(row.img)}" alt="" width="28" height="28">
		<div class="rap-main">
			<div class="rap-line"><span class="rap-name">${escapeHtml(row.name)}</span> <span class="rap-state" data-state="${row.state}">${rowStateLabel(row)}</span></div>
			<div class="rap-line rap-save">${save}${row.save ? ` · dano ${mode}` : ""}</div>
			${row.parts.length ? `<div class="rap-line rap-damage">${parts}${row.parts.length > 1 ? ` <small>(total ${rowTotal(row)})</small>` : ""}${rowEdited(row) ? " <em>ajustado</em>" : ""}</div>` : ""}
			${conditions ? `<div class="rap-line">${conditions}</div>` : ""}
			${notes}${result}${reason}
		</div>
		<div class="rap-buttons">${buttons}</div>
	</li>`;
}

export function buildPanelHtml(panel) {
	const pending = pendingCount(panel.rows);
	const editable = (row) => canApplyRow(row);
	const rows = panel.rows.map((row, index) => rowHtml(row, index, editable(row))).join("") || '<li class="rap-empty">Nenhuma ameaça na área.</li>';
	return `<article class="ritual-area-panel" data-pending="${pending}">
		<header><i class="fa-solid fa-burst"></i> <strong>${escapeHtml(panel.itemName)}</strong> — ${escapeHtml(panel.title)}<small> · conjurador: ${escapeHtml(panel.casterName)} · só o Mestre vê</small></header>
		<p class="rap-rule">${escapeHtml(panel.ruleText)}</p>
		<ul class="rap-rows">${rows}</ul>
		<footer>
			<button type="button" data-action="ritual-area-add"><i class="fa-solid fa-user-plus"></i> Adicionar alvo</button>
			<button type="button" data-action="ritual-area-apply-all" ${pending ? "" : "disabled"}><i class="fa-solid fa-check-double"></i> Aplicar em todos (${pending} ${pending === 1 ? "pendente" : "pendentes"})</button>
		</footer>
	</article>`;
}

/* -------------------------------------------- */
/*  Criação                                     */
/* -------------------------------------------- */

const gmWhisper = () => ChatMessage.getWhisperRecipients("GM").map((user) => user.id);

/**
 * Resolve um efeito de área conforme a configuração: manual cria o painel (nada é aplicado), automático aplica na hora.
 * @param {object} spec    efeito da regra (onCast / tick / exit)
 * @param {object} ctx     { caster, item, dt, tokens, extraTokens?, origin, counter }
 * @param {object} meta    { kind: "onCast"|"tick"|"exit", formId, choiceId, title }
 * @returns {Promise<{mode:"manual"|"auto", lines:string[], rows?:object[], messageId?:string, totalDamage?:number}>}
 */
export async function resolveAreaEffect(spec, ctx, meta) {
	// só ritual de área passa pelo painel; o que age em alvos escolhidos (Decadência, Eletrocussão...) aplica na hora (meta.auto)
	if (!isManualAreaMode() || meta.auto || !isPlannableEffect(spec)) {
		const report = await applyAreaEffect(spec, ctx);
		return { mode: "auto", lines: report.lines, totalDamage: report.totalDamage, applied: report.applied };
	}
	const { caster, item } = ctx;
	if (!ctx.tokens.length && !(ctx.extraTokens ?? []).length) return { mode: "manual", lines: ["Nenhuma ameaça dentro da área."], rows: [], messageId: null };
	const { rows, damageRolls } = await planAreaEffect(spec, ctx);
	const panel = {
		casterId: caster.id, casterName: caster.name, itemId: item.id, itemName: item.name,
		formId: meta.formId ?? "basic", choiceId: meta.choiceId ?? null, kind: meta.kind, title: meta.title ?? "resolução da área",
		dt: ctx.dt, origin: ctx.origin, damage: damageRolls.map((entry) => ({ type: entry.type, amount: entry.amount })),
		ruleText: damageText(spec, damageRolls), rows,
	};
	const message = await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: caster }),
		whisper: gmWhisper(),
		content: buildPanelHtml(panel),
		flags: { [SYSTEM]: { [FLAG]: panel } },
	});
	const summary = publicSummary({ ritualName: item.name, rows });
	return { mode: "manual", lines: [summary], rows, messageId: message.id };
}

/* -------------------------------------------- */
/*  Ações do Mestre                             */
/* -------------------------------------------- */

function context(panel) {
	const caster = game.actors.get(panel.casterId);
	const item = caster?.items.get(panel.itemId);
	const rule = item ? areaRuleFor(item, panel.formId, panel.choiceId) : null;
	const spec = rule?.[panel.kind] ?? null;
	if (!caster || !item || !spec) return null;
	return { caster, item, spec, ctx: { caster, item, dt: panel.dt, origin: panel.origin, counter: new Map(), tokens: [] } };
}

async function save(message, panel) {
	await message.update({ content: buildPanelHtml(panel), [`flags.${SYSTEM}.${FLAG}`]: panel });
}

async function applyIndex(panel, index, ctx) {
	const row = panel.rows[index];
	if (!canApplyRow(row)) return false;
	const result = await executeAreaRow(ctx.spec, ctx.ctx, row);
	if (!result.ok) {
		ui.notifications.warn(result.lines.join(" "));
		return false;
	}
	panel.rows[index] = markApplied(row, { dealt: result.dealt, hpBefore: result.hpBefore, effectIds: result.effectIds, lines: result.lines });
	return true;
}

async function addTarget(panel, ctx) {
	const taken = new Set(panel.rows.map((row) => row.tokenId));
	const scene = game.scenes.get(panel.rows[0]?.sceneId) ?? canvas.scene;
	const options = [...(scene?.tokens ?? [])].filter((token) => token.actor && !taken.has(token.id));
	if (!options.length) return ui.notifications.info("Não há outro token na cena para adicionar.");
	const select = options.map((token) => `<option value="${escapeHtml(token.id)}">${escapeHtml(token.name)}</option>`).join("");
	const answer = await foundry.applications.api.DialogV2.input({
		window: { title: "Adicionar alvo" },
		content: `<div class="standard-form"><p>Quem mais entra na resolução? A resistência dele é rolada agora.</p><div class="form-group"><label>Token</label><select name="tokenId">${select}</select></div></div>`,
		ok: { label: "Adicionar" },
		rejectClose: false,
	}).catch(() => null);
	const token = answer?.tokenId ? scene.tokens.get(answer.tokenId) : null;
	if (!token) return;
	const row = await planTokenRow(ctx.spec, ctx.ctx, token, panel.damage);
	panel.rows.push(row);
}

/**
 * Trata o clique/alteração do Mestre no painel. Idempotente por mensagem: cliques repetidos enquanto uma ação roda são ignorados.
 * @param {string} messageId
 * @param {string} action  ritual-area-apply | -apply-all | -ignore | -restore | -undo | -add | -edit | -restore-part
 * @param {{row?:string|number, part?:string|number, value?:string|number}} data
 */
export async function handleAreaPanelAction(messageId, action, data = {}) {
	if (!game.user.isGM) return ui.notifications.warn("Só o Mestre aplica o resultado de um ritual de área.");
	const message = game.messages.get(messageId);
	const panel = foundry.utils.deepClone(message?.getFlag(SYSTEM, FLAG));
	if (!panel) return ui.notifications.warn("Não encontrei o painel do ritual de área.");
	if (busy.has(messageId)) return;
	busy.add(messageId);
	try {
		const ctx = context(panel);
		if (!ctx) return ui.notifications.error("O conjurador, o ritual ou a regra deste painel não existem mais.");
		const index = Number(data.row);
		switch (action) {
			case "ritual-area-apply":
				if (!(await applyIndex(panel, index, ctx))) return;
				break;
			case "ritual-area-apply-all": {
				const plan = applyAllPlan(panel.rows);
				if (!plan.count) return ui.notifications.info("Não há linhas pendentes.");
				if (plan.needsConfirm) {
					const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Aplicar em todos" }, content: "<p>Há linhas com dano ajustado. Aplicar com os valores atuais?</p>", rejectClose: false });
					if (!ok) return;
				}
				for (const i of plan.indexes) await applyIndex(panel, i, ctx);
				break;
			}
			case "ritual-area-ignore":
				panel.rows[index] = markIgnored(panel.rows[index]);
				break;
			case "ritual-area-restore":
				panel.rows[index] = markRestored(panel.rows[index]);
				break;
			case "ritual-area-undo": {
				const row = panel.rows[index];
				if (row?.state !== ROW_STATE.APPLIED) return;
				const result = await undoAreaRow(row);
				if (!result.ok) return ui.notifications.warn(`${row.name}: o alvo não está mais na cena.`);
				panel.rows[index] = markUndone(row);
				break;
			}
			case "ritual-area-add":
				await addTarget(panel, ctx);
				break;
			case "ritual-area-edit":
				panel.rows[index] = editPart(panel.rows[index], Number(data.part), data.value);
				break;
			case "ritual-area-restore-part":
				panel.rows[index] = restorePart(panel.rows[index], Number(data.part));
				break;
			default:
				return;
		}
		await save(message, panel);
	} finally {
		busy.delete(messageId);
	}
}
