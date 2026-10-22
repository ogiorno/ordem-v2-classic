import { getReactionEligibility } from "../helpers/reaction-helpers.mjs";
import { dispatchReaction, pickCounterAttackWeapon } from "../helpers/reactions.mjs";
import { damageRecipients, gmDefenseValue, isAttackParticipant, shouldShowDefenseValue } from "../helpers/visibility.mjs";
import { UNDO_WINDOW_MS, canApplyDamage, damageTypeColor } from "../helpers/card-damage-rules.mjs";
import { damageApplicationMode, requestCardDamage, undoCardDamage } from "../helpers/card-damage.mjs";
import { describeD20Pool } from "../helpers/dice-labels.mjs";

const CRIT_SEEN_KEY = "op.critDamageSeen";

/** O jogador já clicou no dano deste crítico neste navegador? */
function critDamageSeen(messageId) {
	try {
		return JSON.parse(localStorage.getItem(CRIT_SEEN_KEY) ?? "[]").includes(messageId);
	} catch {
		return false;
	}
}

function markCritDamageSeen(messageId) {
	try {
		const seen = JSON.parse(localStorage.getItem(CRIT_SEEN_KEY) ?? "[]");
		localStorage.setItem(CRIT_SEEN_KEY, JSON.stringify([...seen.filter((id) => id !== messageId), messageId].slice(-200)));
	} catch {
		/* sem armazenamento: o brilho some só nesta renderização */
	}
}

/** Brilho pulsante dourado na borda do botão de dano (biblioteca Motion; sem ela ou com "reduzir movimento", só o brilho fixo do CSS). */
function startCritGlow(button) {
	const Motion = globalThis.Motion;
	if (typeof Motion?.animate !== "function" || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
	const control = Motion.animate(
		button,
		{ boxShadow: ["0 0 3px 0 rgba(249,168,37,.55), inset 0 0 2px rgba(249,168,37,.35)", "0 0 14px 3px rgba(255,214,79,.95), inset 0 0 8px rgba(255,214,79,.55)"] },
		{ duration: 0.9, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
	);
	return { stop: () => { (control.cancel ?? control.stop)?.call(control); button.style.boxShadow = ""; setTimeout(() => { button.style.boxShadow = ""; }, 50); } };
}

// Decisão da mesa: o número da Defesa não aparece no cartão de ataque (só acertou/errou).
const SHOW_DEFENSE_ON_CARD = false;

/**
 * Wrapper sobre `damageRecipients` que injeta `game.users` atual.
 */
function _damageRecipients(targetActor) {
	return damageRecipients(targetActor, game.users ?? []);
}

/** */
export default class ChatMessageOP extends ChatMessage {
	/** @inheritDoc */
	prepareData() {
		super.prepareData();
	}

	/**
	 * Handle rendering of a chat message to the log
	 * @param {ChatLog} app         The ChatLog instance
	 * @param {HTMLElement} html    Rendered chat message HTML (v13 — native DOM, no jQuery)
	 * @param {object} data         Data passed to the render context
	 */
	async getHTML(options = {}) {
		const html = await super.renderHTML(options);
		if (foundry.utils.getType(this.system?.getHTML) === "function") {
			await this.system.getHTML(html, options);
			return html;
		}

		this._displayChatActionButtons(html);
		this._highlightCriticalSuccessFailure(html);
		this._humanizeRoll(html);
		this._markGmMessage(html);
		// this._enrichChatCard(html);

		/**
		 * A hook event that fires after op-specific chat message modifications have completed.
		 * @function ordemparanormal.renderChatMessage
		 * @memberof hookEvents
		 * @param {ChatMessageOP} message  Chat message being rendered.
		 * @param {HTMLElement} html       HTML contents of the message.
		 */
		Hooks.callAll("ordemparanormal.renderChatMessage", this, html);

		return html;
	}

	/* -------------------------------------------- */

	/**
	 * Listen for shift key being pressed to show the chat message "delete" icon, or released (or focus lost) to hide it.
	 */
	static activateListeners() {}

	/* -------------------------------------------- */

	/**
	 * Optionally hide the display of chat card action buttons which cannot be performed by the user
	 * @param {ChatMessage} message  Message being prepared.
	 * @param {HTMLElement} html     Rendered contents of the message.
	 * @param {object} data          Configuration data passed to the message.
	 */
	_displayChatActionButtons(html) {
		const chatCard = html.querySelector(".ordemparanormal.chat-card");
		if (chatCard) {
			const flavor = html.querySelector(".flavor-text");
			const itemName = html.querySelector(".item-name");
			if (flavor && itemName && flavor.textContent === itemName.textContent) flavor.remove();

			const actor = game.actors.get(this.speaker.actor);
			const isCreator = resolveIsCreator(this, actor, game.user);
			for (const button of html.querySelectorAll(".card-buttons button")) {
				if (button.dataset.visibility === "all") continue;

				// GM buttons should only be visible to GMs, otherwise button should only be visible to message's creator
				if ((button.dataset.visibility === "gm" && !game.user.isGM) || !isCreator) button.hidden = true;
			}

			// Live-update .target-info from current targeting selection on every render.
			// Multi-target precisa aparecer como "N alvos: A, B, C" — antes só renderizava
			// quando exatamente 1 alvo estava selecionado, deixando o card mudo no
			// fluxo multi-alvo (ataques de criaturas com numberOfAttacks > 1, sweeps, etc.).
			const targetInfo = chatCard.querySelector(".target-info");
			if (targetInfo) {
				const currentTargets = [...(game.user?.targets ?? new Set())];
				if (currentTargets.length > 0) {
					targetInfo.replaceChildren();
					const icon = document.createElement("i");
					icon.className = "fa-solid fa-crosshairs";
					const text =
						currentTargets.length === 1
							? ` ${currentTargets[0].name}`
							: ` ${currentTargets.length} ${game.i18n.localize("op.targetsLabel")}: ${currentTargets
									.map((t) => t.name)
									.join(", ")}`;
					targetInfo.append(icon, text);
					targetInfo.style.display = "";
				} else {
					targetInfo.style.display = "none";
				}
			}

			// Disable the damage button when the last attack missed — and also while a
			// defender reaction is still pending (revealed === false). Otherwise the
			// attacker/GM could roll and apply damage before the defender's Dodge
			// flips the attack into a miss, leaving stolen PV behind.
			//
			// Multi-attack volleys gravam `attackResults` (entrada por ataque). Aqui
			// agregamos a decisão: o botão libera assim que houver ao menos um hit
			// já revelado E nenhum ataque ainda pendente de reação. Sem essa
			// agregação, um único miss subsequente bloqueava o dano de um hit
			// anterior na mesma volley.
			const cardHitResult = this.getFlag("ordem-v2-classic", "hitResult");
			if (cardHitResult) {
				const damageButton = html.querySelector('[data-action="damage"]');
				if (damageButton) {
					let disableForMiss = false;
					let pending = false;
					let hasCritical = false;
					if (cardHitResult.attackResults?.length) {
						pending = cardHitResult.attackResults.some((a) => a.revealed === false);
						const anyRevealedHit = cardHitResult.attackResults.some((a) => a.hit === true && a.revealed !== false);
						disableForMiss = !anyRevealedHit && !pending;
						hasCritical = cardHitResult.attackResults.some((a) => a.isCritical === true && a.hit === true && a.revealed !== false);
					} else {
						pending = cardHitResult.revealed === false;
						disableForMiss = cardHitResult.hit === false;
						hasCritical = cardHitResult.isCritical === true && cardHitResult.hit === true && cardHitResult.revealed !== false;
					}
					if (disableForMiss || pending) {
						damageButton.disabled = true;
						damageButton.classList.add("hit-miss");
						damageButton.title = game.i18n.localize("op.rollDmgDisabled");
					}
					if (hasCritical && !critDamageSeen(this.id)) {
						damageButton.classList.add("hit-critical");
						damageButton.dataset.critLabel = game.i18n.localize("op.attackResult.critBadge");
						const glow = startCritGlow(damageButton);
						// Ao clicar, o botão volta ao normal (e não brilha de novo nesse cartão).
						damageButton.addEventListener("click", () => {
							glow?.stop();
							damageButton.classList.remove("hit-critical");
							delete damageButton.dataset.critLabel;
							markCritDamageSeen(this.id);
						}, { once: true });
					}
				}
			}
		}

		// Inject "Aplicar ao Alvo" button on damage roll messages that have a damageTarget flag.
		//
		// Idempotência: a flag `damageApplied` na própria mensagem é a source-of-truth
		// para "este dano já foi aplicado". Sem ela, qualquer re-render
		// (`ui.chat.updateMessage` é chamado em targeting/actor updates) recriava o
		// botão habilitado e um segundo clique aplicava o dano de novo. O `disabled`
		// local é só feedback visual durante o async — não sobrevive ao re-render.
		const damageTarget = this.getFlag("ordem-v2-classic", "damageTarget");
		const damageApplied = this.getFlag("ordem-v2-classic", "damageApplied");
		if (damageTarget) this._renderDamageApplication(html, damageTarget, damageApplied);

		// Inject hit/miss result block on attack roll messages that have a hitResult flag
		const hitResult = this.getFlag("ordem-v2-classic", "hitResult");
		const reactionPending = this.getFlag("ordem-v2-classic", "reactionPending");
		const reactionApplied = this.getFlag("ordem-v2-classic", "reactionApplied");
		const attackerUserId = this.getFlag("ordem-v2-classic", "attackerUserId") ?? null;

		// Determine whether the current viewer should see the hit/miss reveal yet.
		// Two independent gates:
		//   1. Participant gate (privacy) — only attacker, target owner and GM
		//      ever see the outcome. Third-party agents stay in the dark, which
		//      preserves tactical fog requested by the reviewer.
		//   2. Defender-during-pending gate — the target owner specifically is
		//      kept blind WHILE a reaction is pending so they choose without
		//      peeking. Once revealed (or the panel resolves) they see it.
		const viewerOwnsTarget = hitResult?.actorUuid ? this._isOwnerOfUuidSync(hitResult.actorUuid) : false;
		const isParticipant = isAttackParticipant({
			viewerIsGM: game.user.isGM,
			viewerId: game.userId,
			attackerUserId,
			viewerOwnsTarget,
		});
		const isDefenderViewer =
			!!reactionPending && this._isOwnerOfUuidSync(reactionPending.defenderUuid) && !game.user.isGM;
		const shouldRevealHit = isParticipant && (!reactionPending || hitResult?.revealed === true || !isDefenderViewer);

		if (hitResult && shouldRevealHit) {
			const rollContent = html.querySelector(".dice-roll");
			if (rollContent) {
				const resultBlock = document.createElement("div");
				// Perspective-aware color: from the defender's POV the attacker
				// hitting is BAD (red), and missing is GOOD (green). Attacker, GM
				// and other observers keep the standard hit=green / miss=red
				// reading. GM is treated as neutral narrator (not a defender)
				// even if they own the target.
				const isDefenderPOV = viewerOwnsTarget && !game.user.isGM;
				const goodForViewer = isDefenderPOV ? !hitResult.hit : hitResult.hit;
				resultBlock.classList.add("hit-result", goodForViewer ? "success" : "failure");
				if (hitResult.dodged) resultBlock.classList.add("dodged");
				const suffix = isDefenderPOV ? "Defender" : "";
				// d20 natural 1 num ataque que errou: "Erro crítico"
				const attackDie = this.rolls?.[0]?.dice?.find?.((die) => die.faces === 20);
				const natural = attackDie?.results?.find((r) => r.active !== false)?.result;
				const labelKey = hitResult.hit ? (hitResult.isCritical ? "crit" : "hit") : natural === 1 ? "fumble" : "miss";
				const label = game.i18n.localize(`op.attackResult.${labelKey}${suffix}`);
				resultBlock.classList.add(hitResult.hit ? "is-hit" : "is-miss");
				// O número da Defesa é dado privado: o atacante e os colegas de mesa só
				// devem ver HIT/MISS, mas o MJ e o dono do alvo (que já conhece a
				// própria Defesa) podem ver o valor exato. Decisão pura em
				// helpers/visibility.mjs#shouldShowDefenseValue (unit-testada).
				// Decisão da mesa: nem o MJ vê o número no cartão (só acertou/errou).
				const defenseValue = SHOW_DEFENSE_ON_CARD && shouldShowDefenseValue({ viewerIsGM: game.user.isGM })
					? this._gmDefenseValue(hitResult, reactionApplied)
					: null;
				const defenseHtml =
					defenseValue !== null
						? ` <span class="vs-defense">${game.i18n.format("op.vsDefense", { defense: defenseValue })}</span>`
						: "";
				const icon = hitResult.hit ? "fa-check" : "fa-xmark";
				resultBlock.innerHTML = `<strong><i class="fa-solid ${icon}"></i> ${label}</strong>${defenseHtml}`;
				rollContent.after(resultBlock);
			}
		} else if (hitResult && !shouldRevealHit) {
			// Hide the dice total area's standard "success/failure" highlight too,
			// otherwise either the defender during a pending reaction OR a non-
			// participant (third-party agent) could infer hit/miss from the d20's
			// green/red glow. Stripping it keeps tactical fog intact.
			html.querySelectorAll(".dice-total").forEach((el) => el.classList.remove("success", "failure"));
		}

		// Reaction panel — visible to the GM and to the defender's owner while pending.
		// Idempotency: skip if a panel is already in this html tree (defends against
		// any race where multiple renders could otherwise stack panels).
		if (reactionPending && !html.querySelector(".reaction-panel")) {
			this._renderReactionPanel(html, { reactionPending, hitResult, reactionApplied });
		}
	}

	/**
	 * Cartão de dano: explicação do cálculo, botão "Aplicar" (quem atacou e o GM) e o estado "aplicado".
	 * Idempotência: a flag `damageApplied` é a fonte da verdade; o botão some quando ela existe.
	 * @param {HTMLElement} html
	 * @param {object} damageTarget
	 * @param {object|null} damageApplied
	 */
	_renderDamageApplication(html, damageTarget, damageApplied) {
		const rollContent = html.querySelector(".dice-roll");
		if (!rollContent || html.querySelector(".damage-application")) return;
		const box = document.createElement("div");
		box.classList.add("damage-application");

		// Etiqueta de tipo e origem (arma ou maldição): com dois danos seguidos, dá para ver qual é qual.
		const color = damageTypeColor(damageTarget.damageType);
		const typeKey = `op.damageTypeAbv.${damageTarget.damageType}`;
		const typeName = game.i18n.has(typeKey) ? game.i18n.localize(typeKey) : String(damageTarget.damageType ?? "");
		const source = this.getFlag("ordem-v2-classic", "weaponCurseDamage") ? "Maldição" : "Arma";
		const badge = document.createElement("p");
		badge.classList.add("damage-badge");
		badge.style.cssText = `margin:0 0 4px;padding:3px 8px;border-left:4px solid ${color};background:${color}22;color:${color};font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em`;
		badge.textContent = `${source} · ${typeName}`;
		box.append(badge);
		rollContent.closest(".message-content")?.style.setProperty("border-left", `4px solid ${color}`);
		rollContent.closest(".message-content")?.style.setProperty("padding-left", "6px");

		const info = this.getFlag("ordem-v2-classic", "damageInfo");
		if (info) {
			const explain = document.createElement("p");
			explain.classList.add("damage-explain");
			explain.textContent = info.isCritical
				? game.i18n.format("op.dmgCard.explainCrit", { formula: info.formula, weapon: info.weapon })
				: game.i18n.format("op.dmgCard.explainNormal", { formula: info.formula });
			box.append(explain);
		}

		if (damageApplied) {
			// Só o Mestre vê quanto o alvo sofreu (e o Desfazer); jogadores não recebem esse número.
			if (!game.user.isGM) {
				if (box.children.length) rollContent.after(box);
				return;
			}
			const done = document.createElement("p");
			done.classList.add("damage-done");
			const state = damageApplied.state ? game.i18n.localize(`op.dmgCard.state.${damageApplied.state}`) : "";
			const text = game.i18n.format("op.dmgCard.applied", {
				target: damageApplied.targetName ?? damageTarget.targetName ?? "",
				amount: damageApplied.amount,
			});
			const stateHtml = state && !game.user.isGM ? ` <em>${foundry.utils.escapeHTML(state)}</em>` : "";
			done.innerHTML = `<i class="fa-solid fa-heart-crack"></i> ${foundry.utils.escapeHTML(text)}${stateHtml}`;
			box.append(done);
			if (game.user.isGM && Date.now() - (damageApplied.at ?? 0) < UNDO_WINDOW_MS) {
				const undo = document.createElement("button");
				undo.type = "button";
				undo.classList.add("undo-damage");
				undo.innerHTML = `<i class="fa-solid fa-rotate-left"></i> ${foundry.utils.escapeHTML(game.i18n.localize("op.dmgCard.undo"))}`;
				undo.addEventListener("click", async (event) => {
					event.preventDefault();
					undo.disabled = true;
					const ok = await undoCardDamage(this);
					if (!ok) undo.disabled = false;
				});
				box.append(undo);
			}
			rollContent.after(box);
			return;
		}

		const allowed = canApplyDamage({
			viewerIsGM: game.user.isGM,
			viewerId: game.user.id,
			authorId: this.author?.id ?? null,
			mode: damageApplicationMode(),
		});
		if (allowed) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.classList.add("apply-damage");
			const label = game.i18n.format("op.dmgCard.apply", { amount: this.rolls?.[0]?.total ?? "" });
			btn.innerHTML = `<i class="fa-solid fa-heart-crack"></i> ${foundry.utils.escapeHTML(label)}`;
			btn.addEventListener("click", async (event) => {
				event.preventDefault();
				btn.disabled = true;
				try {
					await requestCardDamage(this);
					if (!game.user.isGM) btn.textContent = game.i18n.localize("op.dmgCard.requested");
				} catch (err) {
					console.error("Ordem Paranormal | falha ao aplicar dano", err);
					btn.disabled = false;
				}
			});
			box.append(btn);
		} else {
			const wait = document.createElement("p");
			wait.classList.add("damage-wait");
			wait.textContent = game.i18n.localize("op.dmgCard.waitingGM");
			box.append(wait);
		}
		rollContent.after(box);
	}

	/** Defesa que o MESTRE vê no cartão: valor legado da flag ou Defesa atual do alvo (+ bônus de esquiva). */
	_gmDefenseValue(hitResult, reactionApplied) {
		const actor = this._resolveActorSync(hitResult?.actorUuid);
		return gmDefenseValue({
			legacy: hitResult?.targetDefense ?? null,
			live: actor?.system?.defense?.value ?? null,
			dodgeBonus: reactionApplied?.type === "dodge" ? reactionApplied.bonus : 0,
		});
	}

	/**
	 * Aviso do mestre (linha amarela compacta) e, opcionalmente, destaque de mensagens que jogadores
	 * mandaram ao mestre (/gmroll, /blindroll, sussurros).
	 * @param {HTMLElement} html
	 */
	_markGmMessage(html) {
		if (this.getFlag("ordem-v2-classic", "gmNotice")) {
			html.classList.add("op-gm-notice");
			return;
		}
		if (!game.user.isGM || !game.settings.get("ordem-v2-classic", "gmWhisperHighlight")) return;
		const fromPlayer = this.author && !this.author.isGM;
		if (!fromPlayer || !this.whisper?.includes(game.user.id)) return;
		html.classList.add("op-gm-whisper");
		const meta = html.querySelector(".message-metadata");
		if (meta && !meta.querySelector(".gm-whisper-tag")) {
			const tag = document.createElement("span");
			tag.classList.add("gm-whisper-tag");
			tag.textContent = game.i18n.localize("op.gmNotice.whisperTag");
			meta.prepend(tag);
		}
	}

	/**
	 * Troca `3d20kh` por texto de jogador, avisa quando não há DT e quando a rolagem é privada.
	 * @param {HTMLElement} html
	 */
	_humanizeRoll(html) {
		for (const el of html.querySelectorAll(".dice-formula")) {
			const raw = el.textContent.trim();
			const label = describeD20Pool(raw);
			if (label !== raw) {
				el.textContent = label;
				el.title = raw;
			}
		}
		const isTest = this.getFlag("ordem-v2-classic", "messageType") === "roll";
		const total = html.querySelector(".dice-total");
		if (isTest && total && !html.querySelector(".dt-result") && !html.querySelector(".dt-hint")) {
			const hint = document.createElement("div");
			hint.classList.add("dt-hint");
			hint.textContent = game.i18n.localize("op.roll.noDC");
			total.after(hint);
		}
		const firstRoll = html.querySelector(".dice-roll");
		const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
		const privateToGM =
			this.whisper?.length &&
			!this.blind &&
			this.rolls?.length &&
			this.whisper.every((id) => gmIds.includes(id) || id === this.author?.id);
		if (privateToGM && firstRoll && this.author?.id === game.user.id && !html.querySelector(".roll-privacy")) {
			const note = document.createElement("div");
			note.classList.add("roll-privacy");
			note.innerHTML = `<i class="fa-solid fa-lock"></i> ${foundry.utils.escapeHTML(game.i18n.localize("op.roll.gmroll"))}`;
			firstRoll.before(note);
		}
	}

	/**
	 * Synchronous resolution of an Actor (or Token's actor) from a UUID. Uses
	 * `fromUuidSync` first, then falls back to extracting the actor id when the
	 * UUID points to a Token in a non-loaded scene (fromUuidSync needs the scene
	 * loaded to resolve Token UUIDs). Returns null if nothing matches.
	 *
	 * @param {string} uuid
	 * @returns {object|null}
	 */
	_resolveActorSync(uuid) {
		if (!uuid) return null;
		try {
			const doc = fromUuidSync(uuid);
			if (doc) return doc.actor ?? doc;
		} catch (_err) {
			/* fall through to id extraction */
		}
		// Token UUIDs in inactive scenes: parse out the actor id and look it up
		// in the world collection. Format: Scene.X.Token.Y.Actor.Z (linked) or
		// Actor.Z (world actor).
		const parts = uuid.split(".");
		const actorIdx = parts.lastIndexOf("Actor");
		if (actorIdx >= 0 && actorIdx + 1 < parts.length) {
			return game.actors?.get(parts[actorIdx + 1]) ?? null;
		}
		return null;
	}

	/**
	 * Synchronous ownership check using _resolveActorSync. Used by render paths
	 * which cannot await.
	 *
	 * @param {string} uuid
	 * @returns {boolean}
	 */
	_isOwnerOfUuidSync(uuid) {
		const actor = this._resolveActorSync(uuid);
		return Boolean(actor?.isOwner);
	}

	/**
	 * Render the defender reaction panel onto the attack chat message.
	 *
	 * Synchronous on purpose: the chat-message render pipeline does not await us,
	 * so any `await` here would race with the parent returning `html` and could
	 * stack panels on rapid re-renders. `fromUuidSync` works for world-scoped
	 * documents (Actor, Item, Token in loaded scenes) which is what we need.
	 *
	 * @param {HTMLElement} html
	 * @param {{reactionPending: object, hitResult: object|null, reactionApplied: object|null}} ctx
	 */
	_renderReactionPanel(html, { reactionPending, hitResult, reactionApplied }) {
		const isOwnerOfDefender = this._isOwnerOfUuidSync(reactionPending.defenderUuid);
		if (!game.user.isGM && !isOwnerOfDefender) return;

		const defender = this._resolveActorSync(reactionPending.defenderUuid);
		// Wrap fromUuidSync in try/catch — a stale chat card can outlive its
		// referenced item/scene, and Foundry sometimes throws on lookup of
		// orphaned UUIDs. We must never let the chat renderer crash on render.
		let attackerItem = null;
		if (reactionPending.itemUuid) {
			try {
				attackerItem = fromUuidSync(reactionPending.itemUuid);
			} catch (_err) {
				attackerItem = null;
			}
		}
		if (!defender) return;

		const currentRound = game.combat?.round ?? 0;
		const reactionUsedRound = defender.getFlag("ordem-v2-classic", "reactionUsedRound") ?? null;
		const eligibility = getReactionEligibility(defender, attackerItem, currentRound, reactionUsedRound);

		const panel = document.createElement("div");
		panel.classList.add("reaction-panel");
		if (reactionApplied) panel.classList.add("reaction-applied");

		const title = document.createElement("div");
		title.classList.add("reaction-panel-title");
		title.textContent = game.i18n.localize("op.reaction.panelTitle");
		panel.append(title);

		if (reactionApplied) {
			const status = document.createElement("div");
			status.classList.add("reaction-status");
			const typeKey =
				reactionApplied.type === "dodge"
					? "op.reaction.dodge"
					: reactionApplied.type === "block"
					? "op.reaction.block"
					: reactionApplied.type === "counterAttack"
					? "op.reaction.counterAttack"
					: "op.reaction.skip";
			const reactionLabel = game.i18n.localize(typeKey);
			status.textContent = `${defender.name} → ${reactionLabel}`;
			panel.append(status);
		} else {
			const buttons = document.createElement("div");
			buttons.classList.add("reaction-buttons");

			// Two-stage panel:
			// • Pre-reveal: defender hasn't seen the result yet — show Dodge/Block (the
			//   pre-roll reactions) plus Skip ("reveal and decide later").
			// • Post-reveal: dodge/block windows are over; show Counter-attack only when
			//   the attack actually missed and the defender is still eligible,
			//   plus Skip to lock the panel for good.
			const isRevealed = hitResult?.revealed === true;
			const attackerMissed = isRevealed && hitResult?.hit === false;

			if (!isRevealed) {
				buttons.append(
					this._buildReactionButton({
						type: "dodge",
						labelKey: "op.reaction.dodgeWithBonus",
						tooltipKey: "op.reaction.dodgeTooltip",
						eligibility: eligibility.dodge,
						reactionPending,
						defender,
					}),
					this._buildReactionButton({
						type: "block",
						labelKey: "op.reaction.blockWithBonus",
						tooltipKey: "op.reaction.blockTooltip",
						eligibility: eligibility.block,
						reactionPending,
						defender,
					})
				);
			} else if (attackerMissed && eligibility.counterAttack.eligible) {
				buttons.append(
					this._buildReactionButton({
						type: "counterAttack",
						labelKey: "op.reaction.counterAttack",
						tooltipKey: "op.reaction.counterAttackTooltip",
						eligibility: eligibility.counterAttack,
						reactionPending,
						defender,
					})
				);
			}

			buttons.append(
				this._buildReactionButton({
					type: "skip",
					labelKey: "op.reaction.skip",
					eligibility: { eligible: true },
					reactionPending,
					defender,
				})
			);

			panel.append(buttons);
		}

		const anchor = html.querySelector(".dice-roll") ?? html.querySelector(".message-content");
		anchor?.after(panel);
	}

	_buildReactionButton({ type, labelKey, tooltipKey, eligibility, reactionPending, defender }) {
		const btn = document.createElement("button");
		btn.classList.add("reaction-button", `reaction-${type}`);
		btn.dataset.reaction = type;

		const bonus = eligibility.bonus ?? 0;
		btn.innerHTML = bonus ? game.i18n.format(labelKey, { bonus }) : game.i18n.localize(labelKey);

		if (!eligibility.eligible) {
			btn.disabled = true;
			if (eligibility.reason) {
				btn.title = game.i18n.localize(`op.reaction.${eligibility.reason}`);
			}
		} else if (tooltipKey) {
			btn.title = game.i18n.format(tooltipKey, { bonus });
		}

		btn.addEventListener("click", async (event) => {
			event.preventDefault();
			btn.disabled = true;
			const buttonsContainer = btn.parentElement;
			buttonsContainer?.querySelectorAll("button").forEach((b) => (b.disabled = true));
			try {
				let weaponUuid = null;
				if (type === "counterAttack") {
					const weapon = await pickCounterAttackWeapon(defender);
					if (!weapon) {
						buttonsContainer?.querySelectorAll("button").forEach((b) => (b.disabled = false));
						return;
					}
					weaponUuid = weapon.uuid;
				}
				dispatchReaction({
					type,
					messageId: this.id,
					defenderUuid: reactionPending.defenderUuid,
					attackerUuid: reactionPending.attackerUuid,
					itemUuid: reactionPending.itemUuid,
					weaponUuid,
				});
			} catch (err) {
				console.error("ordemparanormal | reaction click failed", err);
				buttonsContainer?.querySelectorAll("button").forEach((b) => (b.disabled = false));
			}
		});
		return btn;
	}

	/**
	 * Highlight critical success or failure on d20 rolls.
	 * @param {ChatMessage} message  Message being prepared.
	 * @param {HTMLElement} html     Rendered contents of the message.
	 * @param {object} data          Configuration data passed to the message.
	 */
	_highlightCriticalSuccessFailure(html) {
		if (!this.isContentVisible || !this.rolls.length) return;

		function makeIcon(type, cls) {
			const icon = document.createElement("i");
			icon.classList.add(type, cls);
			icon.setAttribute("inert", "");
			return icon;
		}

		const totals = html.querySelectorAll(".dice-total");
		for (let [index, d20Roll] of this.rolls.entries()) {
			const d0 = d20Roll.dice[0];
			if (d0?.faces !== 20 || d0?.values.length !== 1) continue;

			d20Roll = ordemparanormal.dice.D20Roll.fromRoll(d20Roll);
			const d = d20Roll.dice[0];

			const isModifiedRoll = "success" in d.results[0] || d.options.marginSuccess || d.options.marginFailure;
			if (isModifiedRoll) continue;

			const total = totals[index];
			if (!total) continue;

			if (d.options.target && Number.isNumeric(d.options.target)) {
				if (d20Roll.isSuccess) total.classList.add("success");
				else total.classList.add("failure");
				const dtBadge = document.createElement("div");
				dtBadge.classList.add("dt-result", d20Roll.isSuccess ? "success" : "failure");
				dtBadge.textContent = d20Roll.isSuccess
					? game.i18n.format("op.rollSuccess", { dt: d.options.target })
					: game.i18n.format("op.rollFailure", { dt: d.options.target });
				total.after(dtBadge);
			}

			if (d20Roll.isCritical) total.classList.add("critical");
			if (d20Roll.isFumble) total.classList.add("fumble");

			const classification = classifyD20Roll(d20Roll);
			const icons = document.createElement("div");
			icons.classList.add("icons");
			if (classification === "critical")
				icons.append(makeIcon("fa-regular", "fa-star-of-david"), makeIcon("fa-regular", "fa-star-of-david"));
			else if (classification === "fumble")
				icons.append(makeIcon("fa-solid", "fa-car-burst"), makeIcon("fa-solid", "fa-car-burst"));
			else if (classification === "success") icons.append(makeIcon("fa-regular", "fa-thumbs-up"));
			else if (classification === "failure") icons.append(makeIcon("fa-solid", "fa-burst"));
			if (icons.children.length) total.append(icons);
		}
	}
}

/* -------------------------------------------- */
/*  Pure helpers (exported for testing)         */
/* -------------------------------------------- */

/**
 * Determine whether a user is considered the "creator" of a chat message
 * (i.e. may interact with its action buttons).
 *
 * @param {object} message        Chat message with .author.id
 * @param {object|null} actor     Actor retrieved from message.speaker (may be null)
 * @param {object} user           Current game.user with .isGM and .id
 * @returns {boolean}
 */
export function resolveIsCreator(message, actor, user) {
	return user.isGM || actor?.isOwner === true || message.author?.id === user.id;
}

/**
 * Classify a D20Roll result into a display category.
 *
 * @param {object} d20Roll  A D20Roll with isCritical, isFumble, isSuccess, isFailure
 * @returns {"critical"|"fumble"|"success"|"failure"|null}
 */
export function classifyD20Roll(d20Roll) {
	if (d20Roll.isCritical) return "critical";
	if (d20Roll.isFumble) return "fumble";
	if (d20Roll.isSuccess) return "success";
	if (d20Roll.isFailure) return "failure";
	return null;
}
