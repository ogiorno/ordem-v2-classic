import {
	inspectRitualResource,
	ritualBaseCost,
	ritualDescriptionText,
	ritualFinalCost,
	ritualFormOptions,
	ritualLimitFromNex,
	ritualResistanceTarget,
	RITUAL_ELEMENTS,
	validateRitualCast,
} from "./ritual-caster-logic.mjs";

const ICON_SHEET = "/systems/ordem_v2_classic/assets/ritual-elementos.png";
const MACRO_IMG = "icons/svg/book.svg";
const spendingActorIds = new Set();
const LOCALIZED = (key, fallback) => {
	const label = game.i18n.localize(key);
	return label === key ? fallback : label;
};

function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (character) => {
		const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
		return entities[character];
	});
}

function uniqueAgents(actors) {
	return [...new Map(actors.filter((actor) => actor?.type === "agent").map((actor) => [actor.id, actor])).values()];
}

function macroCandidates() {
	const candidates = [];
	for (const token of canvas?.tokens?.controlled ?? []) candidates.push(token.actor);

	const speaker = ChatMessage.getSpeaker();
	if (speaker.token) candidates.push(canvas?.tokens?.get(speaker.token)?.actor);
	if (speaker.actor) candidates.push(game.actors.get(speaker.actor));
	if (game.user.character) candidates.push(game.user.character);

	const controlledAgents = uniqueAgents(candidates).filter((actor) => game.user.isGM || actor.isOwner);
	if (controlledAgents.length) return controlledAgents;
	return [...game.actors].filter((actor) => actor.type === "agent" && (game.user.isGM || actor.isOwner));
}

async function chooseAgent(agents) {
	if (agents.length === 1) return agents[0];
	if (!agents.length) {
		ui.notifications.warn("Nenhum Agente acessível foi encontrado. Selecione um token de Agente ou confira as permissões.");
		return null;
	}

	const options = agents
		.map((actor) => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`)
		.join("");
	const result = await foundry.applications.api.DialogV2.input({
		window: { title: "Escolher Agente" },
		content: `<div class="standard-form"><p>Escolha o Agente que conjurará o ritual.</p><div class="form-group"><label>Agente</label><select name="actorId">${options}</select></div></div>`,
		ok: { label: "Continuar" },
		position: { width: 420 },
	});
	return result?.actorId ? game.actors.get(result.actorId) : null;
}

function localizeChoice(group, value, fallback = "—") {
	if (!value) return fallback;
	const key = CONFIG.op?.[group]?.[value];
	return key ? LOCALIZED(key, value) : value;
}

function elementInfo(item) {
	const key = item.system.element;
	const known = RITUAL_ELEMENTS[key];
	return known ?? { label: key || "Sem afinidade", color: "#8b8490", iconIndex: 0 };
}

function ritualImage(item, info) {
	const image = item.img && item.img !== "icons/svg/mystery-man.svg" ? item.img : null;
	if (image) return `<img alt="" src="${escapeHtml(image)}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">`;
	const offset = 20 - info.iconIndex * 60;
	return `<span aria-hidden="true" style="position:relative;display:inline-block;overflow:hidden;flex:0 0 48px;width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,.07);"><img alt="" src="${ICON_SHEET}" style="position:absolute;left:${offset}%;top:0;width:300%;height:100%;max-width:none;" /></span>`;
}

function getTokensForDialog() {
	return (canvas?.tokens?.placeables ?? [])
		.filter((token) => token.actor)
		.map((token) => ({
			id: token.document.id,
			name: token.name || token.actor.name,
			actor: token.actor,
			selected: game.user.targets?.has(token),
		}));
}

function ritualCard(item) {
	const circle = Number(item.system.circle);
	const info = elementInfo(item);
	const execution = localizeChoice("dropdownExecution", item.system.execution);
	const range = localizeChoice("dropdownRange", item.system.range);
	const cost = ritualBaseCost(circle);
	return `<button type="button" class="ritual-caster-option" data-ritual-id="${escapeHtml(item.id)}" data-circle="${escapeHtml(circle)}" data-search="${escapeHtml(`${item.name} ${info.label}`.toLocaleLowerCase())}" aria-pressed="false" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px;margin:0 0 8px;border:1px solid var(--color-border-light-2,#555);border-left:4px solid ${info.color};border-radius:8px;background:rgba(0,0,0,.12);text-align:left;color:inherit;cursor:pointer;">
		${ritualImage(item, info)}
		<span style="display:grid;gap:3px;min-width:0;flex:1"><strong>${escapeHtml(item.name)}</strong><small>${circle}º círculo · ${escapeHtml(info.label)}</small><small>${escapeHtml(execution)} · ${escapeHtml(range)} · ${cost === null ? "custo inválido" : `${cost} PD`}</small></span>
	</button>`;
}

function getSelectedTargetIds(form) {
	return [...form.querySelectorAll('input[name="targetId"]:checked')].map((input) => input.value);
}

function getFormSelection(form, actor, itemsById, withoutSanity) {
	const item = itemsById.get(form.elements.ritualId.value);
	if (!item) return { ok: false, reason: "Escolha um ritual da lista." };
	const formId = form.elements.form.value || "basic";
	const options = ritualFormOptions(item);
	const details = options[formId];
	if (!details) return { ok: false, reason: "Essa forma não está disponível neste ritual." };
	const manual = form.elements.additionalCost?.value ?? "";
	const cost = ritualFinalCost(item.system.circle, formId, details, manual);
	const requiresConfirmation = formId !== "basic" && (!details || details.needsManualConfirmation || details.requiredCircle || details.requiredAffinity);
	const confirmed = !requiresConfirmation || form.elements.requirementsConfirmed?.checked === true;
	const resourceState = inspectRitualResource(actor, withoutSanity);
	if (!resourceState.ok) return { ok: false, reason: "Ative a regra global ‘Jogando sem Sanidade’ para usar PD como recurso de conjuração nesta macro." };
	const resource = resourceState.resource;
	const turnLimit = Number(form.elements.turnLimit?.value);
	const validation = validateRitualCast({
		cost,
		balance: resource.value,
		perRoundLimit: turnLimit,
		minimumCost: ritualBaseCost(item.system.circle),
		advanced: formId !== "basic",
		requirementsConfirmed: confirmed,
		preparationConfirmed: form.elements.preparationConfirmed?.checked === true,
		specialRequirementConfirmed: item.system.element !== "fear" || form.elements.markedConfirmed?.checked === true,
		minimumCostExceptionConfirmed: form.elements.minimumCostExceptionConfirmed?.checked === true,
	});
	if (!validation.ok) {
		const reason = validation.errors.map((error) => ({
			"custo-invalido": "Informe um custo adicional válido para essa forma.",
			"limite-invalido": "Informe um limite de PD por turno entre 1 e 99.",
			"pre-requisitos-nao-confirmados": "Confirme que o Agente cumpre os pré-requisitos indicados.",
			"preparacao-nao-confirmada": "Confirme que consegue realizar os gestos e componentes exigidos.",
			"requisito-especial-nao-confirmado": "Rituais de Medo só podem ser conjurados por personagens Marcados.",
			"acima-do-limite-por-uso": `O custo ultrapassa o limite de ${turnLimit} PD por turno; confirme a exceção de custo mínimo se ela se aplicar.`,
			"pd-insuficiente": `PD insuficiente: saldo ${resource.value}, custo ${cost ?? "—"}.`,
		}[error])).join(" ");
		return { ok: false, reason, item, formId, details, cost };
	}

	const targetIds = getSelectedTargetIds(form);
	if (form.elements.concentration?.value === "damage" && !(Number(form.elements.damageDt?.value) > 0)) {
		return { ok: false, reason: "Informe o dano sofrido para calcular a DT de concentração.", item, formId, details, cost };
	}
	if (ritualResistanceTarget(item) && !targetIds.length) {
		return { ok: false, reason: "Selecione ao menos um token-alvo para rolar a resistência.", item, formId, details, cost };
	}

	return { ok: true, item, formId, details, cost, targetIds, options };
}

function createPickerContent(actor, items, tokens) {
	const itemCards = items.map(ritualCard).join("");
	return `<div class="standard-form ritual-caster-root" style="min-width:720px;">
		<p style="margin-top:0">Conjurador: <strong>${escapeHtml(actor.name)}</strong> · ${actor.system.PD.value} / ${actor.system.PD.max} PD</p>
		<div style="display:grid;grid-template-columns:minmax(260px,42%) 1fr;gap:14px;align-items:start;">
			<section style="max-height:520px;overflow:auto;padding-right:6px;">
				<div style="display:grid;grid-template-columns:1fr 110px;gap:8px;margin-bottom:9px;">
					<input type="search" name="search" placeholder="Buscar ritual…" aria-label="Buscar ritual">
					<select name="circleFilter" aria-label="Filtrar por círculo"><option value="">Todos</option><option value="1">1º círculo</option><option value="2">2º círculo</option><option value="3">3º círculo</option><option value="4">4º círculo</option></select>
				</div>
				<div class="ritual-caster-list">${itemCards || "<p>Este Agente não tem rituais cadastrados.</p>"}</div>
			</section>
			<section class="ritual-caster-details" style="min-height:300px;padding:12px;border:1px solid var(--color-border-light-2,#555);border-radius:8px;">
				<input type="hidden" name="ritualId" value="">
				<div class="ritual-caster-empty"><h3 style="margin-top:0">Escolha um ritual</h3><p>Filtre por círculo, selecione uma magia e confira forma, alvos e custo antes de conjurar.</p></div>
			</section>
		</div>
	</div>`;
}

function renderRitualDetails(section, item, actor) {
	const info = elementInfo(item);
	const forms = ritualFormOptions(item);
	const costText = (form, detail) => {
		const base = ritualBaseCost(item.system.circle);
		if (form === "basic") return `${base} PD`;
		return detail ? `${base + detail.additionalCost} PD (${base} + ${detail.additionalCost})` : `${base} PD + adicional a informar`;
	};
	const formOptions = [
		`<option value="basic">Básica · ${costText("basic")}</option>`,
		...(forms.student ? [`<option value="student">Discente · ${costText("student", forms.student)}</option>`] : []),
		...(forms.true ? [`<option value="true">Verdadeira · ${costText("true", forms.true)}</option>`] : []),
	].join("");
	const targetText = item.system.target || "Definido pelo texto do ritual";
	const areaText = [item.system.area?.name, item.system.area?.size, item.system.area?.type]
		.filter(Boolean)
		.map((value) => localizeChoice("dropdownArea", value, value))
		.join(" · ");
	const desc = escapeHtml(ritualDescriptionText(item.system.description)).slice(0, 500);
	const resistanceSkill = ritualResistanceTarget(item);
	const resistance = resistanceSkill
		? `${localizeChoice("dropdownSkillResis", resistanceSkill, resistanceSkill)} · sucesso ${escapeHtml(localizeChoice("dropdownResistance", item.system.resistance, item.system.resistance))}`
		: "Nenhuma resistência estruturada";

	section.innerHTML = `<input type="hidden" name="ritualId" value="${escapeHtml(item.id)}">
		<header style="display:flex;gap:12px;align-items:center;border-left:4px solid ${info.color};padding-left:10px;">
			${ritualImage(item, info)}
			<div><h3 style="margin:0">${escapeHtml(item.name)}</h3><small>${Number(item.system.circle)}º círculo · ${escapeHtml(info.label)}</small></div>
		</header>
		<p style="margin:10px 0 6px"><strong>Execução:</strong> ${escapeHtml(localizeChoice("dropdownExecution", item.system.execution))} · <strong>Alcance:</strong> ${escapeHtml(localizeChoice("dropdownRange", item.system.range))}</p>
		<p style="margin:0 0 6px"><strong>Alvo:</strong> ${escapeHtml(targetText)}${areaText ? ` · ${escapeHtml(areaText)}` : ""}</p>
		<p style="margin:0 0 8px"><strong>Resistência:</strong> ${resistance}</p>
		<label style="display:block;margin:8px 0;">Limite de PD por turno
			<input name="turnLimit" type="number" min="1" max="99" step="1" value="${ritualLimitFromNex(actor.system.NEX?.value) ?? 1}" style="width:100%;margin-top:4px;">
			<small>Estimativa por NEX. Confira e ajuste se a ficha tiver bônus de limite; PD.perRound é recuperação e não esse limite. Uma conjuração no custo mínimo do ritual continua permitida.</small>
		</label>
		<div class="ritual-minimum-cost-exception" style="display:none;"></div>
		<div style="display:grid;grid-template-columns:1fr 140px;gap:8px;align-items:end;">
			<label>Forma<select name="form" style="width:100%;margin-top:4px;">${formOptions}</select></label>
			<label>Adicional em PD<input name="additionalCost" type="number" min="0" step="1" value="" style="width:100%;margin-top:4px;" disabled></label>
		</div>
		<div class="ritual-form-note" style="padding:8px;margin:8px 0;background:rgba(255,255,255,.06);border-radius:6px;">Forma básica. Custo final: ${costText("basic")}.</div>
		<div class="ritual-prerequisite"></div>
		<div class="ritual-occultism-note" style="padding:8px;margin:8px 0;border-left:3px solid ${info.color};background:rgba(255,255,255,.04);">
			<strong>O Custo do Paranormal:</strong> ${item.system.element === "fear" ? "Medo não faz teste de Ocultismo: perde PD equivalente a SAN igual ao custo e tem perda permanente indicada pelo ritual." : `Ocultismo DT ${20 + ritualBaseCost(item.system.circle)} + adicional. Falha causa perda de SAN equivalente ao custo; falhar por 5 ou mais também perde 1 SAN permanentemente.`}
		</div>
		<details style="margin:8px 0;"><summary>Descrição do ritual</summary><p>${desc || "Sem descrição cadastrada."}</p></details>
		<fieldset style="margin:8px 0;padding:8px;"><legend>Alvos na cena</legend>${tokensHTML(actor)}</fieldset>
		<fieldset style="margin:8px 0;padding:8px;"><legend>Concentração (opcional)</legend>
			<label style="display:block;margin-bottom:5px;">Condição<select name="concentration" style="width:100%;"><option value="none">Sem condição especial</option><option value="bad">Condição ruim (DT 15 + custo)</option><option value="terrible">Condição terrível (DT 20 + custo)</option><option value="damage">Sofreu dano durante a execução</option></select></label>
			<label class="ritual-damage-row" style="display:none;">Dano sofrido<input name="damageDt" type="number" min="1" step="1" value="" style="width:100%;"></label>
		</fieldset>
		<label style="display:flex;align-items:flex-start;gap:8px;margin:8px 0;"><input type="checkbox" name="preparationConfirmed"><span>Confirmo que posso cumprir a execução, gestos e componentes ritualísticos${item.system.element === "fear" ? " (Medo dispensa componentes)" : ""}.</span></label>
		${item.system.element === "fear" ? '<label style="display:flex;align-items:flex-start;gap:8px;margin:8px 0;"><input type="checkbox" name="markedConfirmed"><span>Confirmo que o conjurador é um personagem Marcado.</span></label>' : ""}
		<p class="ritual-cast-summary" style="margin-bottom:0;font-weight:600"></p>`;

	const form = section.closest("form");
	form.elements.ritualId.value = item.id;
	const formSelect = section.querySelector('[name="form"]');
	const surcharge = section.querySelector('[name="additionalCost"]');
	const prereq = section.querySelector(".ritual-prerequisite");
	const note = section.querySelector(".ritual-form-note");
		const occultismNote = section.querySelector(".ritual-occultism-note");
	let lastFormId = null;

	const updateFormNote = () => {
		const formId = formSelect.value;
		const formChanged = formId !== lastFormId;
		const details = forms[formId];
		const base = ritualBaseCost(item.system.circle);
		const parsed = details?.additionalCost;
		const hasUnknownPrerequisites = formId !== "basic" && (!details || details.needsManualConfirmation);
		const requiresConfirmation = formId !== "basic" && (!details || details.needsManualConfirmation || details.requiredCircle || details.requiredAffinity);
		const reason = [];
		if (details?.requiredCircle) reason.push(`Requer acesso ao ${details.requiredCircle}º círculo`);
		if (details?.requiredAffinity) reason.push(`Requer ${details.requiredAffinity}`);
		if (hasUnknownPrerequisites) reason.push("pré-requisitos não estruturados: confira a descrição com o Mestre");
		if (parsed !== undefined) {
			surcharge.value = String(parsed);
			surcharge.disabled = true;
		} else if (formId !== "basic") {
			if (formChanged) surcharge.value = "";
			surcharge.disabled = false;
		} else {
			if (formChanged) surcharge.value = "";
			surcharge.disabled = true;
		}
		note.textContent = formId === "basic"
			? `Forma básica. Custo final: ${base} PD.`
			: `${details?.body || "Confira o aprimoramento na descrição do ritual."} Custo final: ${parsed === undefined ? `${base} PD + adicional informado` : `${base + parsed} PD (${base} + ${parsed})`}.`;
		const finalCost = ritualFinalCost(item.system.circle, formId, details, surcharge.value);
		occultismNote.textContent = item.system.element === "fear"
			? "Medo não faz teste de Ocultismo: perde PD equivalente a SAN igual ao custo e SAN permanente conforme a forma."
			: `O Custo do Paranormal: teste de Ocultismo DT ${finalCost === null ? "a confirmar (20 + custo final)" : 20 + finalCost}. Falha causa perda de SAN igual ao custo; falhar por 5 ou mais também perde 1 SAN permanentemente. A falha não cancela o ritual.`;
		if (formChanged) {
			prereq.innerHTML = requiresConfirmation
				? `<label style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;"><input type="checkbox" name="requirementsConfirmed"><span>Confirmo que o Agente cumpre: ${escapeHtml(reason.join("; "))}. Afinidade e círculo máximo não têm campo confiável na ficha, então esta confirmação é manual.</span></label>`
				: "";
			lastFormId = formId;
		}
		const selected = getFormSelection(form, actor, new Map([[item.id, item]]), game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity"));
		const summary = section.querySelector(".ritual-cast-summary");
		const button = form.querySelector('button[data-action="conjure"]');
		const targetCount = getSelectedTargetIds(form).length;
		const turnLimit = Number(form.elements.turnLimit?.value);
		const baseCost = ritualBaseCost(item.system.circle);
		const exception = section.querySelector(".ritual-minimum-cost-exception");
		const needsMinimumCostException = baseCost > turnLimit;
		exception.style.display = needsMinimumCostException ? "block" : "none";
		exception.innerHTML = needsMinimumCostException
			? `<label style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;"><input type="checkbox" name="minimumCostExceptionConfirmed" ${form.elements.minimumCostExceptionConfirmed?.checked ? "checked" : ""}><span>Confirmo que ainda não usei neste turno a exceção que permite uma habilidade em seu custo mínimo (${baseCost} PD).</span></label>`
			: "";
		const targetError = ritualResistanceTarget(item) && !targetCount ? "Selecione um token para a resistência." : "";
		summary.textContent = selected.ok ? `Custo: ${selected.cost} PD · saldo após o custo: ${actor.system.PD.value - selected.cost} PD${targetCount ? ` · alvos: ${targetCount}` : ""}` : `${selected.reason ?? "Revise as opções do ritual."}${targetError ? ` ${targetError}` : ""}`;
		button.disabled = !selected.ok || Boolean(targetError) || (formSelect.value !== "basic" && parsed === undefined && !surcharge.value) || (needsMinimumCostException && !form.elements.minimumCostExceptionConfirmed?.checked);
	};

	section._refresh = updateFormNote;
	section.querySelector('[name="concentration"]').addEventListener("change", (event) => {
		section.querySelector(".ritual-damage-row").style.display = event.currentTarget.value === "damage" ? "block" : "none";
	});
	updateFormNote();
}

let activeTokens = [];

function tokensHTML(actor) {
	const tokens = activeTokens;
	if (!tokens.length) return "<small>Nenhum token com ator está na cena. Para rolar resistência, abra a cena e selecione o alvo.</small>";
	return tokens
		.map((token) => `<label style="display:flex;align-items:center;gap:8px;padding:3px 0;"><input type="checkbox" name="targetId" value="${escapeHtml(token.id)}" ${token.selected ? "checked" : ""}><span>${escapeHtml(token.name)}${token.actor?.id === actor.id ? " (você)" : ""}</span></label>`)
		.join("");
}

function renderPicker(actor, items, tokens) {
	activeTokens = tokens;
	const itemsById = new Map(items.map((item) => [item.id, item]));
	const withoutSanity = game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity");
	const resultPromise = foundry.applications.api.DialogV2.wait({
		window: { title: "Conjurar Ritual", icon: "fa-solid fa-book-sparkles" },
		position: { width: 980, height: 760 },
		content: createPickerContent(actor, items, tokens),
		buttons: [
			{ action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark", callback: () => null },
			{
				action: "conjure",
				label: "Conjurar e pagar PD",
				icon: "fa-solid fa-wand-sparkles",
				default: true,
				disabled: true,
				callback: (_event, button) => {
					const form = button.form;
					const selection = getFormSelection(form, actor, itemsById, withoutSanity);
					if (!selection.ok) return { invalid: selection.reason };
					return {
						itemId: selection.item.id,
						formId: selection.formId,
						cost: selection.cost,
						details: selection.details,
						requirementsConfirmed: form.elements.requirementsConfirmed?.checked === true,
						preparationConfirmed: form.elements.preparationConfirmed?.checked === true,
						markedConfirmed: form.elements.markedConfirmed?.checked === true,
						minimumCostExceptionConfirmed: form.elements.minimumCostExceptionConfirmed?.checked === true,
						turnLimit: Number(form.elements.turnLimit?.value),
						targetIds: selection.targetIds,
						concentration: form.elements.concentration?.value ?? "none",
						damageDt: Number(form.elements.damageDt?.value) || null,
					};
				},
			},
		],
		render: (_event, dialog) => {
			const form = dialog.element.querySelector("form");
			const list = form.querySelector(".ritual-caster-list");
			const detailsSection = form.querySelector(".ritual-caster-details");
			const search = form.querySelector('[name="search"]');
			const circleFilter = form.querySelector('[name="circleFilter"]');

			const filterCards = () => {
				const term = search.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
				for (const card of list.querySelectorAll(".ritual-caster-option")) {
					const cardTerm = card.dataset.search.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
					card.style.display = (!term || cardTerm.includes(term)) && (!circleFilter.value || card.dataset.circle === circleFilter.value) ? "flex" : "none";
				}
			};
			search.addEventListener("input", filterCards);
			circleFilter.addEventListener("change", filterCards);
			list.addEventListener("click", (event) => {
				const card = event.target.closest("[data-ritual-id]");
				if (!card) return;
				form.elements.ritualId.value = card.dataset.ritualId;
				for (const option of list.querySelectorAll(".ritual-caster-option")) {
					option.setAttribute("aria-pressed", String(option === card));
					option.style.outline = option === card ? "2px solid var(--color-border-highlight,#e7c76a)" : "none";
				}
				renderRitualDetails(detailsSection, itemsById.get(card.dataset.ritualId), actor);
			});
			for (const eventName of ["change", "input"]) {
				detailsSection.addEventListener(eventName, (event) => {
					if (!event.target.matches('[name="form"], [name="requirementsConfirmed"], [name="preparationConfirmed"], [name="markedConfirmed"], [name="minimumCostExceptionConfirmed"], [name="targetId"], [name="damageDt"], [name="concentration"], [name="additionalCost"], [name="turnLimit"]')) return;
					if (event.target.name === "concentration") {
						detailsSection.querySelector(".ritual-damage-row").style.display = event.target.value === "damage" ? "block" : "none";
					}
					detailsSection._refresh?.();
				});
			}
			filterCards();
		},
	});

	return resultPromise.finally(() => {
		activeTokens = [];
	});
}

function getRoll(rolls) {
	return Array.isArray(rolls) ? rolls[0] : rolls;
}

async function rollSkill(actor, skill, target) {
	const rolls = await actor.rollSkill(
		{ skill, rolls: [{ options: { target } }] },
		{},
		{ create: false },
	);
	return getRoll(rolls);
}

function rollOutcome(roll, target) {
	if (!roll || !Number.isFinite(Number(roll.total))) return { status: "cancelled", total: null, margin: null };
	const total = Number(roll.total);
	return { status: total >= target ? "success" : "failure", total, margin: total - target };
}

async function spendPd(actor, amount) {
	if (spendingActorIds.has(actor.id)) return false;
	spendingActorIds.add(actor.id);
	try {
		const current = Number(actor.system.PD.value);
		if (!Number.isFinite(current) || current < amount) return false;
		await actor.update({ "system.PD.value": current - amount });
		return true;
	} finally {
		spendingActorIds.delete(actor.id);
	}
}

async function applySanityCostToPd(actor, amount) {
	if (!amount) return 0;
	const current = Math.max(0, Number(actor.system.PD.value) || 0);
	const applied = Math.min(current, amount);
	if (applied) await actor.update({ "system.PD.value": current - applied });
	return applied;
}

function getConcentrationDt(selection) {
	if (selection.concentration === "bad") return 15 + selection.cost;
	if (selection.concentration === "terrible") return 20 + selection.cost;
	if (selection.concentration === "damage") return selection.damageDt;
	return null;
}

function buildChatCard(actor, item, selection, outcome) {
	const info = elementInfo(item);
	const targetNames = selection.targetIds.map((id) => canvas.tokens.get(id)?.name ?? "Alvo removido da cena");
	const formName = selection.formId === "basic" ? "Básica" : selection.formId === "student" ? "Discente" : "Verdadeira";
	const tests = [];
	if (outcome.concentration) tests.push(`<li><strong>Concentração, Vontade DT ${outcome.concentration.dt}:</strong> ${escapeHtml(outcome.concentration.text)}</li>`);
	if (outcome.occultism) tests.push(`<li><strong>O Custo do Paranormal, Ocultismo DT ${outcome.occultism.dt}:</strong> ${escapeHtml(outcome.occultism.text)}</li>`);
	for (const target of outcome.resistances ?? []) {
		tests.push(`<li><strong>Resistência de ${escapeHtml(target.name)} (${escapeHtml(target.skill)}):</strong> ${escapeHtml(target.text)}</li>`);
	}
	const sanity = outcome.sanityNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
	const statusText = outcome.interrupted ? "Ritual interrompido: o efeito não acontece. O custo de conjuração foi pago." : "Ritual conjurado. Resolva efeitos narrativos/manual do Mestre conforme a descrição.";
	const description = foundry.utils.cleanHTML(String(item.system.chatDescription || item.system.description || ""));
	return `<article class="ritual-cast-card" style="border:1px solid ${info.color};border-radius:10px;padding:12px;background:rgba(0,0,0,.08);">
		<header style="display:flex;align-items:center;gap:10px;border-bottom:1px solid ${info.color};padding-bottom:8px;margin-bottom:8px;">
			${ritualImage(item, info)}<div><h3 style="margin:0">${escapeHtml(item.name)} · ${formName}</h3><small>${escapeHtml(actor.name)} · ${Number(item.system.circle)}º círculo · ${escapeHtml(info.label)}</small></div>
		</header>
		<p><strong>${statusText}</strong></p>
		<p><strong>Custo:</strong> ${selection.cost} PD${outcome.sanityPd ? ` · ${outcome.sanityPd} PD adicionais por perda temporária de SAN` : ""}. <strong>Execução:</strong> ${escapeHtml(localizeChoice("dropdownExecution", item.system.execution))}. <strong>Alcance:</strong> ${escapeHtml(localizeChoice("dropdownRange", item.system.range))}.</p>
		<p><strong>Alvo(s):</strong> ${escapeHtml(targetNames.join(", ") || item.system.target || "a definir com o Mestre")}</p>
		${tests.length ? `<h4>Testes</h4><ul>${tests.join("")}</ul>` : ""}
		${sanity ? `<h4>Consequências de Sanidade</h4><ul>${sanity}</ul>` : ""}
		<details><summary>Descrição do ritual</summary>${description}</details>
	</article>`;
}

async function resolveCast(actor, selection) {
	const item = actor.items.get(selection.itemId);
	if (!item || item.type !== "ritual") {
		ui.notifications.error("O ritual não está mais na ficha do Agente.");
		return;
	}
	const withoutSanity = game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity");
	const resource = inspectRitualResource(actor, withoutSanity);
	if (!resource.ok) {
		ui.notifications.error("Esta macro cobra PD. Ative ‘Jogando sem Sanidade’ e tente novamente.");
		return;
	}
	const latest = validateRitualCast({
		cost: selection.cost,
		balance: actor.system.PD.value,
		perRoundLimit: selection.turnLimit,
		minimumCost: ritualBaseCost(item.system.circle),
		advanced: selection.formId !== "basic",
		requirementsConfirmed: selection.requirementsConfirmed,
		preparationConfirmed: selection.preparationConfirmed,
		specialRequirementConfirmed: item.system.element !== "fear" || selection.markedConfirmed,
		minimumCostExceptionConfirmed: selection.minimumCostExceptionConfirmed,
	});
	if (!latest.ok) {
		ui.notifications.warn("Saldo ou limite de PD mudou. Abra a macro novamente e confira o custo.");
		return;
	}
	if (!(await spendPd(actor, selection.cost))) {
		ui.notifications.warn("Não foi possível pagar o custo em PD; o ritual não foi iniciado.");
		return;
	}

	const outcome = { interrupted: false, sanityPd: 0, sanityNotes: [], resistances: [] };
	const concentrationDt = getConcentrationDt(selection);
	if (concentrationDt !== null) {
		if (!Number.isInteger(concentrationDt) || concentrationDt < 1) {
			outcome.interrupted = true;
			outcome.concentration = { dt: "inválida", text: "Dano/DT ausente; resolva manualmente." };
		} else {
			const roll = await rollSkill(actor, "will", concentrationDt);
			const result = rollOutcome(roll, concentrationDt);
			outcome.concentration = { dt: concentrationDt, text: result.status === "cancelled" ? "rolagem cancelada; resultado manual pendente" : `${result.total} — ${result.status === "success" ? "sucesso" : "falha"}` };
			outcome.interrupted = result.status === "failure";
			if (result.status === "cancelled") outcome.sanityNotes.push("O teste de concentração foi cancelado; confirme manualmente se o ritual continua.");
		}
	}

	if (!outcome.interrupted && item.system.element !== "fear") {
		const dt = 20 + selection.cost;
		const roll = await rollSkill(actor, "occultism", dt);
		const result = rollOutcome(roll, dt);
		outcome.occultism = { dt, text: result.status === "cancelled" ? "rolagem cancelada; consequência de SAN pendente" : `${result.total} — ${result.status === "success" ? "sucesso" : "falha"}` };
		if (result.status === "failure") {
			outcome.sanityPd = await applySanityCostToPd(actor, selection.cost);
			outcome.sanityNotes.push(`Falha no teste: perda de SAN igual ao custo. Como PD representa PE e SAN nesta mesa, foram descontados ${outcome.sanityPd} PD adicionais.`);
			if (outcome.sanityPd < selection.cost) outcome.sanityNotes.push(`Faltaram ${selection.cost - outcome.sanityPd} PD para representar toda a perda temporária de SAN; resolva o restante manualmente.`);
			if (result.margin <= -5) outcome.sanityNotes.push("Também houve perda permanente de 1 SAN (não estruturada no recurso PD); ajuste esse efeito permanente manualmente.");
		}
	} else if (!outcome.interrupted && item.system.element === "fear") {
		outcome.sanityPd = await applySanityCostToPd(actor, selection.cost);
		const permanentLoss = selection.formId === "basic" ? 1 : selection.formId === "student" ? 2 : 3;
		outcome.sanityNotes.push(`Ritual de Medo: perda de SAN igual ao custo; foram descontados ${outcome.sanityPd} PD adicionais.`);
		if (outcome.sanityPd < selection.cost) outcome.sanityNotes.push(`Faltaram ${selection.cost - outcome.sanityPd} PD para representar toda a perda temporária de SAN; resolva o restante manualmente.`);
		outcome.sanityNotes.push(`Perda permanente de ${permanentLoss} SAN; ajuste manualmente, pois PD não tem campo separado para SAN permanente.`);
	}

	if (!outcome.interrupted && selection.targetIds.length && item.system.skillResis) {
		const skill = ritualResistanceTarget(item);
		if (!skill) {
			outcome.resistances.push({ name: "Alvos", skill: item.system.skillResis, text: "perícia de resistência não reconhecida; resolva manualmente" });
		} else {
			const dt = Number(actor.system.ritual?.DT);
			if (!Number.isFinite(dt)) {
				outcome.resistances.push({ name: "Alvos", skill, text: "DT do ritual indisponível; resolva manualmente" });
			} else {
				for (const id of selection.targetIds) {
					const token = canvas.tokens.get(id);
					if (!token?.actor) continue;
					const roll = await rollSkill(token.actor, skill, dt);
					const result = rollOutcome(roll, dt);
					outcome.resistances.push({
						name: token.name,
						skill: localizeChoice("dropdownSkillResis", skill, skill),
						text: result.status === "cancelled" ? "rolagem cancelada" : `${result.total} — ${result.status === "success" ? "passou" : "falhou"} (DT ${dt})`,
					});
				}
			}
		}
	}

	await ChatMessage.create({
		content: buildChatCard(actor, item, selection, outcome),
		speaker: ChatMessage.getSpeaker({ actor }),
		flags: { ordem_v2_classic: { ritualCast: { actorId: actor.id, itemId: item.id, form: selection.formId, cost: selection.cost } } },
	});
}

export async function runRitualCasterMacro() {
	if (game.system.id !== "ordem_v2_classic") {
		ui.notifications.error("Esta macro foi criada para o sistema Ordem Paranormal v2 Classic.");
		return;
	}
	const agent = await chooseAgent(macroCandidates());
	if (!agent) return;
	const withoutSanity = game.settings.get("ordem_v2_classic", "globalPlayingWithoutSanity");
	if (!withoutSanity || !inspectRitualResource(agent, withoutSanity).ok) {
		ui.notifications.error("A macro usa PD. Ative a regra global ‘Jogando sem Sanidade’ para conjurar.");
		return;
	}
	const items = agent.items
		.filter((item) => item.type === "ritual")
		.sort((a, b) => Number(a.system.circle) - Number(b.system.circle) || a.name.localeCompare(b.name, "pt-BR"));
	if (!items.length) {
		ui.notifications.info(`${agent.name} não tem rituais cadastrados na ficha.`);
		return;
	}
	const selection = await renderPicker(agent, items, getTokensForDialog());
	if (!selection) return;
	if (selection.invalid) {
		ui.notifications.warn(selection.invalid);
		return;
	}
	await resolveCast(agent, selection);
}

export const ritualCasterMacroImage = MACRO_IMG;
