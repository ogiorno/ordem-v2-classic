import { normalizeExecution } from "../helpers/threat-ability-execution.mjs";
import { FLOW, ROUTE, activationKey, checkCost, delegateRequest, reduce, routeUse, summaryLines } from "../helpers/threat-ability-flow.mjs";
import { pickTargets, placeAbilityArea } from "./threat-ability-targeting-ui.mjs";
import { authorizeUse, createPanelMessage, planPanel } from "./threat-ability-panel-runner.mjs";
import { ThreatAbilityPanel } from "../applications/threat-ability-panel.mjs";
import { contextFor, fireTrigger } from "./threat-ability-triggers-runner.mjs";

// Fluxo do botão "Usar" (T11): validar → cartão → alvo/área → confirmar → custo → painel. Só o Mestre ativo resolve.
// Cancelar em qualquer passo antes de confirmar não cobra, não rola e não cria nada.

const SYSTEM = "ordem-v2-classic";
const inFlight = new Set();
const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const { DialogV2 } = foundry.applications.api;

/** Pergunta Sim/Não ao Mestre; fechar a janela conta como não. */
const ask = async ({ title, content, yes, no }) => {
	const answer = await DialogV2.confirm({ window: { title }, content, yes: { label: yes }, no: { label: no }, rejectClose: false, modal: false }).catch(() => false);
	return answer === true;
};

function summaryHtml({ item, actor, execution }) {
	const lines = summaryLines({ execution, activation: activationLabel(item) });
	const rows = lines.map((l) => `<li class="${l.missing ? "is-missing" : ""}"><strong>${escapeHtml(L(`op.threatUse.line.${l.key}`))}:</strong> ${escapeHtml(l.missing ? L("op.threatExec.defineManually") : l.text)}</li>`).join("");
	return `<div class="threat-use-summary"><p>${escapeHtml(L("op.threatUse.origin", { actor: actor.name, item: item.name }))}</p><ul>${rows}</ul></div>`;
}

function requirementsHtml(execution) {
	const narrative = (execution.requirements ?? []).filter((r) => r.kind === "narrative");
	if (!narrative.length) return "";
	return `<p>${escapeHtml(L("op.threatUse.confirmNarrative"))}</p><ul>${narrative.map((r) => `<li>${escapeHtml(r.text || r.ref)}</li>`).join("")}</ul>`;
}

function targetsHtml(names, cost) {
	const charge = cost?.declared ? `<p>${escapeHtml(L("op.threatUse.willCharge", { amount: cost.amount, type: cost.type }))}</p>` : "";
	const list = names.length ? names.map((n) => `<li>${escapeHtml(n)}</li>`).join("") : `<li><em>${escapeHtml(L("op.threatUse.noTargets"))}</em></li>`;
	return `<p>${escapeHtml(L("op.threatUse.confirmTargets"))}</p><ul>${list}</ul>${charge}`;
}

const activationLabel = (item) => (item.system.activation ? L(`op.executionChoices.${activationKey(item.system.activation)}`) : "");

const sourceToken = (actor) => actor.getActiveTokens().find((t) => t.document.parent?.id === canvas.scene?.id) ?? null;

/** Fallback "Mostrar no chat": o cartão descritivo de sempre. */
const showInChat = (item, reason = null) => {
	if (reason) ui.notifications.warn(reason);
	return item.roll();
};

/**
 * Usa a habilidade pela ficha. Devolve `{ status }`: manual | cancelled | refused | delegated | busy | done | passive | attack.
 * `status: "done"` traz `panelMessageId`.
 */
export async function useAbility({ actor, item }) {
	const key = item?.uuid;
	if (!actor || !item) return { status: "refused" };
	if (inFlight.has(key)) return { status: "busy" };
	inFlight.add(key);
	let state = FLOW.IDLE;
	const step = (event) => { state = reduce(state, event).state; return state; };
	try {
		const route = routeUse(item);
		if (route.route === ROUTE.ATTACK) return { status: "attack" };
		if (route.route === ROUTE.PASSIVE) return { status: "passive" };
		const auth = authorizeUse({ actor });
		if (!auth.allowed) { ui.notifications.warn(L(`op.threatUse.denied.${auth.reason}`)); return { status: "refused", reason: auth.reason }; }
		if (auth.mode === "delegate") {
			game.socket.emit(`system.${SYSTEM}`, delegateRequest({ actorUuid: actor.uuid, itemUuid: item.uuid, userId: game.user.id }));
			ui.notifications.info(L("op.threatUse.delegated"));
			return { status: "delegated" };
		}

		step("use");
		if (route.route === ROUTE.MANUAL) { step("manual"); await showInChat(item); return { status: "manual" }; }
		if (route.route === ROUTE.INCOMPLETE) {
			step("invalid");
			const fallback = await ask({ title: item.name, content: `<p>${escapeHtml(L("op.threatUse.incomplete"))}</p><ul>${route.missing.map((m) => `<li><code>${escapeHtml(m)}</code></li>`).join("")}</ul>`, yes: L("op.threatUse.showInChat"), no: L("op.threatUse.cancel") });
			if (!fallback) { step("cancel"); return { status: "cancelled" }; }
			step("fallback"); await showInChat(item); return { status: "manual" };
		}
		step("valid");
		const execution = normalizeExecution(item.system.execution);

		// 1) cartão com origem, custo, alcance, alvo, teste, dano e condições
		const go = await ask({ title: L("op.threatUse.title", { item: item.name }), content: summaryHtml({ item, actor, execution }), yes: L("op.threatUse.proceed"), no: L("op.threatUse.cancel") });
		if (!go) { step("cancel"); return { status: "cancelled" }; }
		step("proceed");

		// custo declarado: confere antes de pedir alvo (nada é cobrado ainda)
		let cost = checkCost({ execution, actor });
		if (cost.declared && !cost.ok) {
			const text = cost.unsupported ? L("op.threatUse.costUnsupported", { type: cost.type }) : L("op.threatUse.costInsufficient", { type: cost.type, amount: cost.amount });
			if (cost.policy === "block" && !cost.unsupported) { ui.notifications.warn(text); step("cancel"); return { status: "refused", reason: "cost" }; }
			if (!(await ask({ title: item.name, content: `<p>${escapeHtml(text)}</p>`, yes: L("op.threatUse.proceedAnyway"), no: L("op.threatUse.cancel") }))) { step("cancel"); return { status: "cancelled" }; }
		}

		// 2) alvo ou área
		const token = sourceToken(actor);
		if (!canvas.scene || (!token && execution.targeting?.kind !== "self")) {
			step("noScene");
			await showInChat(item, L("op.threatUse.noToken"));
			return { status: "manual", reason: "no-token" };
		}
		let tokens = [];
		const kind = execution.targeting?.kind ?? (execution.area ? "area" : "self");
		if (kind === "self") tokens = token ? [token.document] : [];
		else if (kind === "area") {
			const plan = await placeAbilityArea({ actor, execution });
			if (plan.cancelled) { step("cancel"); return { status: "cancelled" }; }
			if (plan.manual) { step("noScene"); await showInChat(item, L("op.threatUse.noToken")); return { status: "manual" }; }
			tokens = plan.hits.map((h) => canvas.scene.tokens.get(h.id)).filter(Boolean);
		} else {
			for (;;) {
				const picked = pickTargets({ actor, execution });
				if (picked.manual) { step("noScene"); await showInChat(item, L("op.threatUse.noToken")); return { status: "manual" }; }
				if (picked.ok) { tokens = picked.valid.map((id) => canvas.scene.tokens.get(id)).filter(Boolean); break; }
				const retry = await ask({ title: item.name, content: `<p>${escapeHtml(L("op.threatUse.pickTargets"))}</p><ul>${picked.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`, yes: L("op.threatUse.tryAgain"), no: L("op.threatUse.cancel") });
				if (!retry) { step("cancel"); return { status: "cancelled" }; }
				step("invalid");
			}
		}
		step("selected");

		// 3) confirmação
		cost = checkCost({ execution, actor });
		const confirmed = await ask({ title: L("op.threatUse.confirmTitle", { item: item.name }), content: targetsHtml(tokens.map((t) => t.name), cost) + requirementsHtml(execution), yes: L("op.threatUse.confirm"), no: L("op.threatUse.cancel") });
		if (!confirmed) { step("cancel"); return { status: "cancelled" }; }
		const executing = reduce(state, "confirm");
		if (executing.ignored || !executing.firstExecution) return { status: "busy" };
		state = executing.state;
		if (!tokens.length) { step("error"); ui.notifications.info(L("op.threatUse.noTargets")); return { status: "cancelled", reason: "no-targets" }; }

		// pré-requisitos e limites declarados (por cena/rodada, vínculo, combate): validados e registrados antes de cobrar ou rolar
		const gated = (execution.requirements ?? []).length > 0 || execution.mode === "triggered";
		if (gated) {
			const needsLink = (execution.requirements ?? []).some((r) => r.kind === "affectedBy");
			// o Mestre aciona manualmente: o evento e o dono valem como configurados (turno, reação...), com chave única por clique
			const ctx = { ...contextFor(execution.trigger?.event ?? "manual", { actor, at: { round: game.combat?.round ?? null, turn: Date.now() } }), ownerRelation: execution.trigger?.owner ?? "self" }; // cada clique é um uso distinto; o limite por rodada/cena vem dos pré-requisitos
			const claim = await fireTrigger({ actor, item, ctx, targetIds: needsLink || tokens.length ? tokens.map((t) => t.id) : null, confirmedNarrative: true });
			if (!claim.claimed) { step("error"); ui.notifications.warn(L(`op.threatUse.gate.${claim.reason ?? "unknown"}`)); return { status: "refused", reason: claim.reason }; }
			if (claim.targets) tokens = tokens.filter((t) => claim.targets.includes(t.id));
		}

		// 4) custo declarado (só agora), planejamento e painel do Mestre
		if (cost.declared && cost.charge) await actor.update({ [cost.charge.path]: cost.charge.to });
		const panel = await planPanel({ item, actor, tokens });
		panel.cost = cost.declared ? { type: cost.charge?.type ?? cost.type, amount: cost.amount, from: cost.charge?.from ?? null, to: cost.charge?.to ?? null, path: cost.charge?.path ?? null } : null;
		const message = await createPanelMessage(panel);
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p class="threat-ability-use">${escapeHtml(L("op.threatUse.usedLine", { actor: actor.name, item: item.name, action: activationLabel(item) || "—" }))}</p>`, flags: { [SYSTEM]: { threatAbilityUse: { itemUuid: item.uuid } } } });
		step("done");
		await ThreatAbilityPanel.show(message.id);
		return { status: "done", panelMessageId: message.id, targets: tokens.map((t) => t.id) };
	} catch (error) {
		console.error("Habilidade de ameaça: falha no fluxo Usar", error);
		ui.notifications.error(L("op.threatUse.error", { message: error.message }));
		return { status: "refused", reason: "error" };
	} finally {
		inFlight.delete(key);
	}
}

/** Pedido delegado: só o Mestre ativo atende, e só se o remetente for autorizado a controlar a ameaça. */
export function registerUseSocket() {
	game.socket.on(`system.${SYSTEM}`, async (data, senderId) => {
		if (data?.type !== "threatAbilityUse" || !game.user.isActiveGM) return;
		const sender = game.users.get(senderId);
		const actor = await fromUuid(data.actorUuid);
		const item = await fromUuid(data.itemUuid);
		if (!sender || !actor || !item || item.parent?.id !== actor.id) return;
		const auth = authorizeUse({ actor, user: sender });
		if (!auth.allowed) return;
		ui.notifications.info(L("op.threatUse.requested", { user: sender.name, item: item.name }));
		await useAbility({ actor, item });
	});
}
