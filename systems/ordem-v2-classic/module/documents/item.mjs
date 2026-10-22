/* eslint-disable indent */
/**
 * References and Codes of DND5e system:
 * https://github.com/foundryvtt/dnd5e/blob/a7f1404c7c38afa6d7dcc4f36a5fefd274034691/templates/chat/item-card.hbs
 * https://github.com/foundryvtt/dnd5e/blob/a7f1404c7c38afa6d7dcc4f36a5fefd274034691/module/documents/item.mjs#L1639
 */

import { attackBlockReason, attackTokens, defaultSelection, promptAttackOptions, syncOnUseEffects } from "../helpers/attack-options.mjs";
import { damageFormulaParts } from "../helpers/attack-options-rules.mjs";
import { damageApplicationMode, requestCardDamage } from "../helpers/card-damage.mjs";
import { conditionDicePenalty } from "../helpers/conditions.mjs";
import { resolveWeaponArea } from "../helpers/weapon-area-resolve.mjs";
import { areaKind } from "../helpers/weapon-area.mjs";
import { getReactionEligibility } from "../helpers/reaction-helpers.mjs";
import { damageRecipients } from "../helpers/visibility.mjs";
import { rollWeaponCurseDamage } from "../helpers/weapon-curse-runtime.mjs";
import { convertedDamageType, ignoresRd, rollCurseDamage } from "../helpers/curses.mjs";

/**
 * Wrapper sobre `damageRecipients` que injeta `game.users` atual. O helper puro
 * vive em helpers/visibility.mjs e é coberto por unit test.
 */
function _damageRecipients(targetActor) {
	return damageRecipients(targetActor, game.users ?? []);
}

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class OrdemItem extends Item {
	/**
	 * Augment the basic Item data model with additional dynamic data.
	 */
	prepareData() {
		// As with the actor class, items are documents that can have their data
		// preparation methods overridden (such as prepareBaseData()).
		super.prepareData();
	}

	/**
	 * Prepare a data object which is passed to any Roll formulas which are created related to this Item
	 * @private
	 */
	getRollData() {
		if (!this.actor) return { ...super.getRollData() };
		const rollData = this.actor.getRollData();
		rollData.item = foundry.utils.deepClone(this.system);

		return rollData;
	}

	/* -------------------------------------------- */
	/*  Chat Message Helpers                        */
	/* -------------------------------------------- */

	/**
	 * Apply listeners to chat messages.
	 * @param {HTML} html  Rendered chat message.
	 */
	static chatListeners(html) {
		// Remove listener antigo se existir para evitar duplicação
		if (html._ordemListener) {
			html.removeEventListener("click", html._ordemListener);
		}

		// Cria e armazena o listener
		html._ordemListener = (event) => {
			if (!event.target.closest(".card-buttons button")) return;
			// Skip chat command cards (/dt, /oposto) — they have their own click handlers
			const card = event.target.closest(".chat-card");
			if (card?.classList.contains("dt-card") || card?.classList.contains("oposto-request")) return;
			this._onChatCardAction(event);
		};

		html.addEventListener("click", html._ordemListener);
		// html.querySelector('.card-buttons button').addEventListener('click', this._onChatCardAction.bind(this));
		// html.on('click', '.item-name', this._onChatCardToggleContent.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * Handle execution of a chat card action via a click event on one of the card buttons
	 * @param {Event} event       The originating click event
	 * @returns {Promise}         A promise which resolves once the handler workflow is complete
	 * @private
	 */
	static async _onChatCardAction(event) {
		event.preventDefault();
		// Extract card data
		const button = event.target;
		button.disabled = true;
		const card = button.closest(".chat-card");
		const messageId = card.closest(".message").dataset.messageId;
		const message = game.messages.get(messageId);
		const action = button.dataset.action;

		// Recover the actor for the chat card
		const actor = await this._getChatCardActor(card);
		if (!actor) return;

		// Get the Item from stored flag data or by the item ID on the Actor
		const storedData = message.getFlag("ordem-v2-classic", "itemData");
		const item = storedData ? new this(storedData, { parent: actor }) : actor.items.get(card.dataset.itemId);

		// Verificar se o item existe antes de tentar usar seus métodos
		if (!item) {
			console.warn("Item não encontrado para ação de chat card.", {
				storedData: !!storedData,
				itemId: card.dataset.itemId,
				actorId: actor?.id,
				hasTokenId: !!card.dataset.tokenId,
			});
			ui.notifications.warn(game.i18n.localize("WARN.itemNotFoundOnActor"));
			button.disabled = false;
			return;
		}

		switch (action) {
			case "attack": {
				const rollAttack = await item.rollAttack({
					event: event,
				});
				if (!rollAttack) break; // tela de ataque cancelada
				item.lastMessageId = messageId;
				if (rollAttack.attackOptions?.lines?.length || rollAttack.attackOptions?.conditions?.length) message.setFlag("ordem-v2-classic", "attackOptions", rollAttack.attackOptions);
				item.critical = rollAttack.criticalStatus;
				item.hitResult = rollAttack.hitResult ?? null;
				if (rollAttack.hitResult !== null) {
					game.messages.get(messageId)?.setFlag("ordem-v2-classic", "hitResult", rollAttack.hitResult);
				}
				break;
			}
			case "damage": {
				const persistedHit = message?.getFlag("ordem-v2-classic", "hitResult") ?? null;
				const attackOptions = message?.getFlag("ordem-v2-classic", "attackOptions") ?? null;
				const volleyEntries = persistedHit?.attackResults;
				if (volleyEntries?.length) {
					// Multi-attack volley -> one damage roll PER hitting attack. Each
					// roll's dice are doubled only if THAT attack rolled a critical
					// (per OP rules: a x4 creature that crits on one swing doubles only
					// that swing), and each is routed to the actor it struck. A dodged
					// attack has hit=false (synced by syncItemCardHitResult) so it
					// simply contributes no damage.
					await item.rollVolleyDamage(volleyEntries, { event, attackOptions });
				} else {
					// Single attack (or a chat reload that dropped in-memory state):
					// fall back to the persisted hitResult so apply-damage keeps working,
					// recovering the crit multiplier from the item's critical formula
					// (e.g. "19/x3" => 3) so x3/x4 weapons do not degrade to x2.
					const hitResult = item.hitResult ?? persistedHit;
					let critical = item.critical;
					if (!critical && persistedHit?.isCritical) {
						// `this` is the OrdemItem class itself (static method context).
						critical = { isCritical: true, multiplier: this._parseCriticalMultiplier(item.system.critical) };
					} else if (!critical) {
						critical = false;
					}
					await item.rollDamage({
						event: event,
						attackOptions,
						critical,
						lastId: item.lastMessageId ? item.lastMessageId === messageId : true,
						hitResult,
					});
				}
				break;
			}
			case "formula":
				await item.rollFormula({ event });
				break;
			case "applyDamage": {
				const applyMessage = game.messages.get(messageId);
				if (applyMessage) await requestCardDamage(applyMessage);
				break;
			}
			case "teste":
				break;
		}

		// Re-enable the button
		button.disabled = false;
	}

	/**
	 * Get the Actor which is the author of a chat card
	 * @param {HTMLElement} card    The chat card being used
	 * @returns {Actor|null}        The Actor document or null
	 * @private
	 */
	static async _getChatCardActor(card) {
		// Case 1 - a synthetic actor from a Token
		if (card.dataset.tokenId) {
			const token = await fromUuid(card.dataset.tokenId);
			if (!token) return null;
			return token.actor;
		}

		// Case 2 - use Actor ID directory
		const actorId = card.dataset.actorId;
		const actor = game.actors.get(actorId);

		// Case 3 - Try to get token from current scene if actor is not linked
		// This helps when tokenId wasn't stored but actor has active tokens
		if (actor && !actor.prototypeToken?.actorLink) {
			const tokens = actor.getActiveTokens();
			if (tokens.length > 0) {
				console.log("Usando token ativo para ator não vinculado:", tokens[0].name);
				return tokens[0].actor;
			}
		}

		return actor || null;
	}

	/**
	 * Prepare an object of chat data used to display a card for the Item in the chat log.
	 * @param {object} htmlOptions    Options used by the TextEditor.enrichHTML function.
	 * @returns {object}              An object of chat data to render.
	 */
	async getChatData(htmlOptions = {}) {
		const data = this.toObject().system;

		// Rich text description
		data.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(data.description, {
			relativeTo: this,
			rollData: this.getRollData(),
			...htmlOptions,
		});

		// Rich text description
		data.chatDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(data.chatDescription, {
			relativeTo: this,
			rollData: this.getRollData(),
			...htmlOptions,
		});

		return data;
	}

	/**
	 * Place an attack roll using an item (weapon, feat, spell, or equipment)
	 * Rely upon the d20Roll logic for the core implementation
	 */
	async rollAttack(options = {}) {
		if (!this.system.formulas.attack.attr || !this.system.formulas.attack.skill)
			throw new Error("This Item does not have a formula to roll!");

		// Multi-target + multi-attack scheduling unificado.
		//
		// Antes existiam dois loops separados (um para multi-alvo, outro para
		// numberOfAttacks > 1) e eles se combinavam multiplicativamente: criatura
		// com 2 ataques mirando 2 alvos disparava 4 rolagens, todas concentradas em
		// cada alvo. Pelas regras de Ordem Paranormal, a criatura pode DISTRIBUIR
		// seus ataques entre os alvos disponíveis. A solução é fazer round-robin:
		// `totalRolls = max(numAttacks, alvos)`, e cada ataque `i` vai para
		// `alvos[i % alvos.length]`.
		//
		// `_volleyId` identifica esta sequência de ataques inteira; é usado pelo
		// agregador de hitResult no item card para distinguir uma volley nova de
		// uma anterior, evitando que um miss em N+1 sobrescreva um hit em N.
		const isInnerRecursion = options._forcedTarget !== undefined || options._attackIndex !== undefined;
		// Tela de ataque (docs/arquivo/spec-tela-de-ataque.md): só para agentes e só quando a chamada veio de um clique.
		// Shift+clique ataca direto; mesmo assim valem os bônus automáticos (ex.: Mão Pesada).
		if (!isInnerRecursion && !options.attackOptions && this.parent?.type === "agent") {
			if (options.event && !options.event.shiftKey) {
				const chosen = await promptAttackOptions(this);
				if (!chosen) return null;
				options.attackOptions = chosen;
			} else {
				await syncOnUseEffects(this.parent).catch(() => {});
				options.attackOptions = defaultSelection(this);
			}
		}
		if (!isInnerRecursion && this.parent?.type === "agent") {
			const blocked = attackBlockReason(this, options.attackOptions);
			if (blocked) {
				ui.notifications.warn(blocked);
				return null;
			}
		}
		if (!isInnerRecursion) {
			const numAttacks = this.system.numberOfAttacks ?? 1;
			const targetList = [...(game.user?.targets ?? new Set())];
			// Regra: numAttacks limita o ato físico; alvos selecionados orientam a
			// distribuição. Para o caso 1-ataque + N-alvos, mantemos o comportamento
			// histórico (N rolagens — uma por alvo).
			const totalRolls = numAttacks > 1 ? numAttacks : Math.max(targetList.length, 1);
			if (totalRolls > 1) {
				const volleyId = `${this.id}-${foundry.utils.randomID(8)}`;
				const showAttackIndex = numAttacks > 1;
				const results = [];
				for (let i = 0; i < totalRolls; i++) {
					const token = targetList.length > 0 ? targetList[i % targetList.length] : null;
					results.push(
						await this.rollAttack({
							...options,
							_forcedTarget: token,
							_attackIndex: showAttackIndex ? i + 1 : undefined,
							_attackTotal: showAttackIndex ? totalRolls : undefined,
							_volleyId: volleyId,
							_volleyFirst: i === 0,
						})
					);
				}
				// Build the volley's per-attack record from the in-memory `results`
				// (the authoritative source for each attack's hit / crit / target) and
				// surface it on `results[0].hitResult`. `_onChatCardAction("attack")`
				// persists it to the card flag; `_onChatCardAction("damage")` then
				// reads `attackResults` to roll damage ONCE PER HITTING ATTACK, each
				// doubled only if THAT attack rolled a critical and each routed to the
				// actor it struck (per OP multi-attack rules). Building from `results`
				// (not a chat-message lookup) makes it correct with or without a
				// target and independent of reveal/reaction state; a no-target attack
				// counts as "landed" (no defense to miss) so its damage still rolls.
				const attackResults = results.map((r, i) => {
					const hr = r?.hitResult ?? null;
					return {
						attackIndex: showAttackIndex ? i + 1 : null,
						attackMessageId: hr?.attackMessageId ?? null,
						hit: hr ? hr.hit === true : true,
						revealed: hr ? hr.revealed !== false : true,
						isCritical: Boolean(r?.criticalStatus?.isCritical),
						targetDefense: hr?.targetDefense ?? null,
						actorUuid: hr?.actorUuid ?? null,
					};
				});
				if (results[0]) {
					const firstHit = attackResults.find((a) => a.hit === true && a.revealed !== false) ?? attackResults[0] ?? null;
					results[0].hitResult = {
						...(results[0].hitResult ?? {}),
						volleyId,
						attackResults,
						hit: attackResults.some((a) => a.hit === true || a.revealed === false),
						revealed: attackResults.every((a) => a.revealed !== false),
						isCritical: attackResults.some((a) => a.isCritical === true && a.hit === true && a.revealed !== false),
						actorUuid: firstHit?.actorUuid ?? results[0].hitResult?.actorUuid ?? null,
						attackMessageId: firstHit?.attackMessageId ?? results[0].hitResult?.attackMessageId ?? null,
						targetDefense: firstHit?.targetDefense ?? results[0].hitResult?.targetDefense ?? null,
					};
				}
				return results[0];
			}
		}

		const attack = this.system.formulas.attack;
		const weaponPick = options.attackOptions?.weapon ?? null;
		const skill = this.parent.system.skills[weaponPick?.skill || attack.skill];
		let attribute = this.parent.system.attributes[weaponPick?.attr || attack.attr];
		let rollMode = "kh";

		// Condições (Agarrado, Enredado…) tiram d20 do ataque
		const attackDice = attribute.value - conditionDicePenalty(this.parent, "attack") + (options.attackOptions?.attackDice ?? 0);
		if (attackDice < 1) {
			attribute = 2;
			rollMode = "kl";
		} else attribute = attackDice;

		const { parts: baseParts, data } = CONFIG.Dice.BasicRoll.constructParts({
			degree: skill.degree.value || null,
			bonus: skill.value || null,
			modifier: skill.mod || null,
			attackBonus: attack.bonus || null,
		});
		const parts = [...(baseParts ?? [])];
		const chosenOptions = options.attackOptions ?? null;
		if (chosenOptions?.attackFlat) parts.push(String(chosenOptions.attackFlat));
		for (const term of chosenOptions?.attackTerms ?? []) parts.push(term.replace(/^\+/, ""));

		const rollConfig = {
			parts: (parts ?? []).join(" + "),
			formula: `${attribute}d20${rollMode}`,
			data: this.getRollData(),
			chatMessage: true,
		};

		// Combina a fórmula do dado com os bônus
		rollConfig.formula = [rollConfig.formula].concat(parts ?? []).join(" + ");
		rollConfig.data = { ...(rollConfig.data ?? {}), ...data };

		// Realiza a rolagem
		const roll = await new Roll(rollConfig.formula, rollConfig.data).evaluate();

		// Verificações de Crítico
		const criticalStatus = this.isCritical(
			{
				crtalFormula: this.system.critical,
				roll,
			},
			{ marginBonus: options.attackOptions?.critMargin ?? 0 }
		);

		// Resolve target info. Quando _forcedTarget veio do scheduler (mesmo `null`),
		// respeitamos a escolha — usar `??` aqui faria um null explícito cair de volta
		// na seleção atual do usuário e quebrar a distribuição round-robin (atribuir
		// alvo errado a um ataque que deveria ficar sem alvo).
		let targetToken;
		if ("_forcedTarget" in options) {
			targetToken = options._forcedTarget;
		} else {
			const _targets = game.user?.targets ?? new Set();
			targetToken = _targets.size === 1 ? [..._targets][0] : null;
		}
		const hitResult = targetToken ? { ...this._compareWithDefense(targetToken.actor, roll.total, criticalStatus), targetTokenUuid: targetToken.document?.uuid ?? null, attackTotal: roll.total } : null;

		// Build the pending-reaction descriptor when the defender is an Agent (PCs only — Threats don't react).
		// Skip when the attacker IS the defender (counter-attacks), the attacker has no actor,
		// the defender has already spent their reaction this round, OR the defender has no
		// trained reaction that could legally apply to this attack — otherwise we'd hide the
		// result behind a panel that can never resolve to anything but Skip, needlessly
		// blocking damage application for untrained defenders.
		const defender = targetToken?.actor ?? null;
		const isAgentDefender = defender?.type === "agent";
		const currentRound = game.combat?.round ?? 0;
		const defenderReactionUsed = defender?.getFlag?.("ordem-v2-classic", "reactionUsedRound") ?? null;
		const defenderHasReaction = currentRound === 0 || defenderReactionUsed !== currentRound;
		const eligibility =
			isAgentDefender && defenderHasReaction
				? getReactionEligibility(defender, this, currentRound, defenderReactionUsed)
				: null;
		// Reaction panel gating:
		//   • Dodge/Block — pre-roll reactions; always relevant when the defender is
		//     trained and has a reaction available.
		//   • Counter-attack — post-roll, only triggers on a melee miss. Per the
		//     rules, the defender has ONE reaction per round and must commit blind
		//     (no peeking at hit/miss before choosing whether to spend it). So we
		//     surface the panel whenever counter-attack is eligible at the eligibility
		//     layer (already accounts for melee + trained + available); the panel's
		//     two-stage flow in chat-message.mjs handles "Skip → reveal → counter-attack
		//     if miss" on its own.
		//   • Ranged attacks against fighting-trained PCs get filtered out by the
		//     `!melee` guard inside getReactionEligibility, so no panel leaks there.
		const dodgeOrBlockEligible = Boolean(eligibility?.dodge.eligible || eligibility?.block.eligible);
		const fightingMatters = Boolean(eligibility?.counterAttack.eligible);
		const hasAnyEligibleReaction = dodgeOrBlockEligible || fightingMatters;
		// Capture the attacker's token at attack time so counter-attacks always target the
		// exact token that swung — for linked actors with multiple tokens on a scene
		// `getActiveTokens()[0]` would otherwise pick an arbitrary one.
		const attackerTokenUuid = this.actor?.token?.uuid ?? this.actor?.getActiveTokens?.()[0]?.document?.uuid ?? null;
		const reactionPending =
			isAgentDefender && defender.uuid !== this.actor?.uuid && defenderHasReaction && hasAnyEligibleReaction
				? {
						defenderUuid: defender.uuid,
						attackerUuid: this.actor?.uuid ?? null,
						attackerTokenUuid,
						itemUuid: this.uuid,
						isMelee: this.system.types?.rangeType?.name !== "ranged",
						round: currentRound,
				  }
				: null;

		// When a reaction is pending, the hit/miss block stays hidden for the defender until they respond.
		if (hitResult) {
			hitResult.baseDefense = hitResult.targetDefense;
			hitResult.revealed = !reactionPending;
		}

		// Envia para o chat
		if (rollConfig.chatMessage) {
			const flags = {
				"ordem-v2-classic.messageRoll": {
					type: "attack",
					itemId: this.id,
					itemUuid: this.uuid,
					isCritical: criticalStatus.isCritical,
				},
			};
			if (hitResult) flags["ordem-v2-classic.hitResult"] = hitResult;
			if (reactionPending) flags["ordem-v2-classic.reactionPending"] = reactionPending;
			// Stamp the attacker user id so the chat renderer can decide who's a
			// participant and thus allowed to see the hit/miss outcome. Without
			// this, the only "attacker" signal is `message.speaker.actor`, which
			// doesn't map 1:1 to a user (GM controlling NPC, shared actors, etc).
			flags["ordem-v2-classic.attackerUserId"] = game.userId;
			{
				const { attacker } = attackTokens(this);
				if (attacker && targetToken) flags["ordem-v2-classic.attackAnim"] = { from: attacker.document.uuid, to: targetToken.document.uuid, kind: areaKind(this.name) === "radius" ? "rocket" : areaKind(this.name) === "line" ? "flame" : weaponPick?.mode === "throw" ? "throw" : this.system.types?.rangeType?.name === "ranged" && weaponPick?.mode !== "blow" ? (weaponPick?.mode === "burst" ? "burst" : "shot") : "melee", weapon: this.name };
			}
			if (chosenOptions?.lines?.length || chosenOptions?.conditions?.length) flags["ordem-v2-classic.attackOptions"] = chosenOptions;

			const targetName = targetToken?.name ?? null;
			// Hit/miss is intentionally absent from the flavor — it would leak to
			// every viewer in chat (including third-party agents not in the fight).
			// The result lives in the perspective-gated `.hit-result` DOM block
			// (chat-message.mjs#_renderHitResult) which is restricted to
			// participants (attacker, target owner, GM) via `isAttackParticipant`.
			// We keep the `→ TargetName` arrow as a neutral hint that this attack
			// landed on a specific token.
			const flavorSuffix = targetName ? ` → ${targetName}` : "";
			const attackIndexSuffix = options._attackIndex ? ` (${options._attackIndex}/${options._attackTotal})` : "";
			const optionsSuffix = chosenOptions?.lines?.length
				? ` — ${chosenOptions.lines.join(", ")}${chosenOptions.cost ? ` (−${chosenOptions.cost} ${chosenOptions.resource})` : ""}`
				: "";
			const conditionsSuffix = chosenOptions?.conditions?.length
				? ` · ${game.i18n.localize("op.attackDialog.conditionsInline")}: ${chosenOptions.conditions
						.map((condition) => `${foundry.utils.escapeHTML(condition.name)}${condition.detail ? ` (${foundry.utils.escapeHTML(condition.detail)})` : ""}`)
						.join(", ")}`
				: "";

			// Foundry assina `Roll.toMessage(messageData, { create, rollMode })`. Passar
			// `rollMode` DENTRO de `messageData` é silenciosamente ignorado — `applyRollMode`
			// nunca dispara e a mensagem herda o whisper do MJ atual. Isso era exatamente
			// a causa do bug #10 (contra-ataque do jogador vazando para gmroll do MJ).
			const attackMsg = await roll.toMessage(
				{
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					flavor: `${game.i18n.format("op.attackedWith", { name: this.name })}${attackIndexSuffix}${flavorSuffix}${optionsSuffix}${conditionsSuffix}`,
					flags,
				},
				{ rollMode: options.rollMode ?? game.settings.get("core", "rollMode") }
			);

			// Track the most recent attack message id on the item instance so a subsequent
			// rollDamage can correlate to the originating attack (used by the Bloqueio reaction).
			this.lastAttackMessageId = attackMsg?.id ?? null;
			if (hitResult) {
				hitResult.attackMessageId = this.lastAttackMessageId;
				// Also write the id onto the attack message's own flag — without this,
				// later mutations that rebroadcast hitResult (e.g. the reaction reveal
				// path syncing back to the item card) would overwrite the id with the
				// pre-toMessage value (null).
				if (attackMsg) await attackMsg.setFlag("ordem-v2-classic", "hitResult", hitResult);
			}

			// Persist hitResult onto the most-recent item card for this item so the
			// damage button state updates. Em volleys de multi-ataque, AGREGAMOS por
			// `_volleyId`: cada ataque empurra sua entrada para `attackResults` e os
			// campos top-level (hit, revealed, isCritical) refletem o "qualquer
			// acerto ainda em pé / qualquer reação ainda pendente". Sem isso, um miss
			// posterior na mesma volley sobrescrevia um hit anterior e travava o
			// botão de dano, exatamente o sintoma que o reviewer reportou.
			if (hitResult) {
				const itemId = this.id;
				const cardMsg = [...game.messages]
					.reverse()
					.find((m) => m.content?.includes(`data-item-id="${itemId}"`) && m.content?.includes("chat-card item-card"));
				if (cardMsg) {
					const previous = cardMsg.getFlag("ordem-v2-classic", "hitResult") ?? null;
					const volleyId = options._volleyId ?? null;
					const sameVolley = volleyId && previous?.volleyId === volleyId && !options._volleyFirst;
					const entry = {
						attackMessageId: hitResult.attackMessageId ?? null,
						attackIndex: options._attackIndex ?? null,
						hit: hitResult.hit,
						revealed: hitResult.revealed,
						isCritical: hitResult.isCritical,
						targetDefense: hitResult.targetDefense,
						actorUuid: hitResult.actorUuid,
						targetTokenUuid: hitResult.targetTokenUuid ?? null,
						attackTotal: hitResult.attackTotal ?? null,
					};
					const attackResults = sameVolley ? [...(previous.attackResults ?? []), entry] : [entry];
					const anyHitOrPending = attackResults.some((a) => a.hit === true || a.revealed === false);
					const allRevealed = attackResults.every((a) => a.revealed !== false);
					const anyCritical = attackResults.some((a) => a.isCritical === true && a.revealed !== false);
					const toWrite = {
						...hitResult,
						volleyId,
						attackResults,
						hit: anyHitOrPending,
						revealed: allRevealed,
						isCritical: anyCritical,
					};
					await cardMsg.setFlag("ordem-v2-classic", "hitResult", toWrite);
				}
			}
		}

		/**
		 * A hook event that fires after a formula has been rolled for an Item.
		 * @function ordemparanormal.rollFormula
		 * @memberof hookEvents
		 * @param {OrdemItem} item  Item for which the roll was performed.
		 * @param {Roll} roll       The resulting roll.
		 */
		Hooks.callAll("ordemparanormal.rollFormula", this, roll);

		return { roll, criticalStatus, hitResult, attackOptions: chosenOptions };
	}

	/**
	 * Compare a roll result against a target actor's defense value.
	 * @param {Actor|null} targetActor  The actor being attacked.
	 * @param {number} rollTotal        The attack roll total.
	 * @param {object} criticalStatus   Result of isCritical().
	 * @returns {{hit: boolean, targetDefense: number, actorUuid: string, isCritical: boolean}|null}
	 */
	_compareWithDefense(targetActor, rollTotal, criticalStatus) {
		if (!targetActor) return null;
		const defense = targetActor.system?.defense?.value ?? 0;
		return {
			hit: rollTotal >= defense,
			targetDefense: defense,
			actorUuid: targetActor.uuid,
			isCritical: criticalStatus?.isCritical ?? false,
		};
	}

	/**
	 *
	 */
	/**
	 * Parse a weapon's critical formula (e.g. "19/x3", "x4", "20") into the multiplier.
	 * Defaults to 2 when no explicit multiplier is present.
	 * @param {string} formula
	 * @returns {number}
	 */
	static _parseCriticalMultiplier(formula) {
		const f = (formula ?? "").trim();
		if (!f) return 2;
		const xPart = f.includes("/") ? f.split("/").find((p) => p.includes("x")) : f.includes("x") ? f : null;
		if (!xPart) return 2;
		return Number(xPart.replaceAll("x", "")) || 2;
	}

	isCritical(critical = { isCritical: false }, options = {}) {
		const formulaCritical = (critical.crtalFormula ?? "").trim();

		// Separa os valores no formato 19/x3 pela barra e atribui
		// a variaveis com as respectivas conversões em qualquer ordem.
		if (formulaCritical && formulaCritical.includes("/")) {
			for (const crtalFor of formulaCritical.split("/")) {
				if (crtalFor.includes("x")) critical.multiplier = Number(crtalFor.replaceAll("x", ""));
				else critical.margin = Number(crtalFor);
			}
		} else {
			critical.multiplier = (formulaCritical.includes("x") && Number(formulaCritical.replaceAll("x", ""))) || 2;
			critical.margin = (!formulaCritical.includes("x") && Number(formulaCritical)) || 20;
		}
		if (options.marginBonus) critical.margin -= options.marginBonus; // ex.: Técnica Letal (+2 na margem de ameaça)
		critical.isCritical = (Number(critical.roll.result.split("+")[0]) || critical.roll.result) >= critical.margin && true;
		return critical;
	}

	/**
	 * Place an attack roll using an item (weapon, feat, spell, or equipment)
	 * Rely upon the d20Roll logic for the core implementation
	 */
	async rollDamage(options = {}) {
		if (!this.system.formulas.damage.parts) throw new Error("This Item does not have a formula to roll!");

		const prepareFormula = [];
		const damageTypes = [];

		// Damage Access
		const damage = { ...this.system.formulas.damage };
		const weaponPick = options.attackOptions?.weapon ?? null;
		if (weaponPick?.damageFormula) damage.formula = weaponPick.damageFormula;
		if (weaponPick?.damageType) damage.type = weaponPick.damageType;
		if (weaponPick?.damageAttr) damage.attr = weaponPick.damageAttr;

		// Critical variable — auto-detect from hitResult if not explicitly passed.
		// O multiplier vem da fórmula da arma (e.g. "19/x3" → 3, "x4" → 4); usar `2`
		// hardcoded silenciava o `x3`/`x4` quando o caller passava só `hitResult`
		// (ex.: macros, callers diretos fora do `_onChatCardAction "damage"` que
		// já recupera via `_parseCriticalMultiplier`).
		const hitResult = options.hitResult ?? null;
		const critical =
			options.critical ||
			(hitResult?.isCritical
				? { isCritical: true, multiplier: this.constructor._parseCriticalMultiplier(this.system.critical) }
				: false);

		const critApplied = Boolean((critical.isCritical && options.lastId) || options.event?.altKey);
		// Opções escolhidas na tela de ataque (ou só as automáticas, se a chamada não trouxe nenhuma).
		const extra = options.attackOptions ?? (this.parent?.type === "agent" ? defaultSelection(this) : null);
		// Maldição Energética: o dano do ataque vira Energia
		const convertedType = convertedDamageType(this, extra);
		if (convertedType) damage.type = convertedType;
		prepareFormula.push(
			...damageFormulaParts(damage.formula, {
				critMultiplier: critApplied ? critical.multiplier ?? 2 : 1,
				extraDice: extra?.damageDice ?? 0,
				explode: Boolean(extra?.weapon?.explode),
			})
		);

		// Verify the attributes
		for (const [name, attrObject] of Object.entries(this.parent.system.attributes)) {
			if (name == damage.attr) prepareFormula.push(attrObject.value);
		}

		// Get the main type damage
		damageTypes.push(
			game.i18n.has("op.damageTypeAbv." + damage.type)
				? game.i18n.localize("op.damageTypeAbv." + damage.type)
				: game.i18n.localize("op.undefined")
		);

		// Bônus de dano das opções de ataque
		if (extra?.damageFlat) prepareFormula.push(extra.damageFlat);
		for (const term of extra?.damageTerms ?? []) prepareFormula.push(term.replace(/^\+/, ""));

		// Get all the other formulas
		for (const parts of damage.parts) {
			prepareFormula.push(`(${parts[0] || 0})`);
			damageTypes.push(parts[1] ? game.i18n.localize("op.damageTypeAbv." + parts[1]) : "Indefinido");
		}

		// Combine all formulas and types
		// Espingarda em alcance médio ou maior: metade do dano, arredondada para baixo
		const formulas = extra?.weapon?.halve ? `floor((${prepareFormula.join("+")})/2)` : prepareFormula.join("+");
		const types = damageTypes.join("+").replaceAll("+", " + ");

		const rollConfig = {
			formula: formulas,
			data: this.getRollData(),
			chatMessage: true,
		};

		const roll = await new Roll(rollConfig.formula, rollConfig.data).evaluate();

		if (rollConfig.chatMessage) {
			const flags = {};
			// Only enable auto-apply when the entire roll uses a single damage type.
			// Mixed-type rolls (e.g. 1d6 cutting + 1d6 fire) would resolve incorrectly
			// against a single resistance — leave those for manual GM application.
			const partTypes = (damage.parts ?? []).map((p) => p?.[1]).filter(Boolean);
			const hasMixedTypes = partTypes.some((t) => t !== damage.type);
			if (hitResult?.actorUuid && !hasMixedTypes) {
				let targetName = null;
				try {
					targetName = fromUuidSync(hitResult.actorUuid)?.name ?? null;
				} catch (_err) {
					targetName = null;
				}
				flags["ordem-v2-classic.damageTarget"] = {
					actorUuid: hitResult.actorUuid,
					targetName,
					damageType: damage.type,
					attackMessageId: options.attackMessageId ?? hitResult.attackMessageId ?? this.lastAttackMessageId ?? null,
					...(ignoresRd(this, extra) ? { ignoreRd: true } : {}),
				};
				flags["ordem-v2-classic.damageInfo"] = {
					formula: formulas.replaceAll("+", " + "),
					isCritical: critApplied,
					multiplier: critApplied ? critical.multiplier ?? 2 : 1,
					weapon: this.name,
				};
			}
			// Mesma correção do attack roll: `rollMode` precisa ir no segundo argumento.
			const damageMsg = await roll.toMessage(
				{
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					flavor:
						game.i18n.format("op.rollDamageChat", { name: this.name, types: types }) +
						(options._attackIndex ? ` (${options._attackIndex}/${options._attackTotal})` : "") +
						(flags["ordem-v2-classic.damageTarget"]?.targetName ? ` → ${flags["ordem-v2-classic.damageTarget"].targetName}` : ""),
					flags: Object.keys(flags).length ? flags : undefined,
				},
				{ rollMode: game.settings.get("core", "rollMode") }
			);
			// Modo automático: acertou e sem reação pendente -> aplica sozinho (o GM valida/aplica).
			if (
				damageMsg &&
				flags["ordem-v2-classic.damageTarget"] &&
				damageApplicationMode() === "auto" &&
				hitResult?.hit === true &&
				hitResult?.revealed !== false
			) {
				requestCardDamage(damageMsg).catch((err) => console.error("Ordem Paranormal | aplicação automática falhou", err));
			}
			// Amaldiçoar Arma: o dano do elemento sai em carta própria, separado do dano da arma (não dobra no crítico).
			if (!extra?.weapon?.area) {
				await rollWeaponCurseDamage(this, {
					hitResult,
					attackMessageId: options.attackMessageId ?? hitResult?.attackMessageId ?? this.lastAttackMessageId ?? null,
					attackIndex: options._attackIndex ?? null,
					attackTotal: options._attackTotal ?? null,
				}).catch((err) => console.error("Ordem Paranormal | dano do Amaldiçoar Arma falhou", err));
				// Maldições da arma (Lancinante, Erosiva, Antielemento): dano do elemento em carta própria
				await rollCurseDamage(this, {
					attackOptions: extra,
					hitResult,
					critical: critApplied ? { isCritical: true, multiplier: critical.multiplier ?? 2 } : null,
					attackMessageId: options.attackMessageId ?? hitResult?.attackMessageId ?? this.lastAttackMessageId ?? null,
					attackIndex: options._attackIndex ?? null,
					attackTotal: options._attackTotal ?? null,
				}).catch((err) => console.error("Ordem Paranormal | dano das maldições falhou", err));
			}
		}

		/**
		 * A hook event that fires after a formula has been rolled for an Item.
		 * @function ordemparanormal.rollFormula
		 * @memberof hookEvents
		 * @param {Ordemitem} item  Item for which the roll was performed.
		 * @param {Roll} roll       The resulting roll.
		 */
		// Armas de área (Bazuca, Lança-chamas): o mesmo dano atinge os outros seres da área
		if (extra?.weapon?.area && !options._attackIndex) {
			await resolveWeaponArea({
				item: this,
				weapon: extra.weapon,
				total: Math.max(0, Math.floor(Number(roll.total))),
				damageType: damage.type,
				hitResult,
				messageId: extra.weapon.mode === "point" ? null : (options.attackMessageId ?? hitResult?.attackMessageId ?? this.lastAttackMessageId ?? null), // o disparo num ponto não tem cartão de ataque
			}).catch((err) => console.error("Ordem Paranormal | área da arma falhou", err));
		}

		Hooks.callAll("ordemparanormal.rollFormula", this, roll);

		return roll;
	}

	/**
	 * Bazuca num ponto: sem teste de ataque, não erra e ninguém é atingido diretamente.
	 * O ponto é a posição do alvo marcado; o dano atinge todos no raio (Reflexos pela metade).
	 */
	async rollAreaPoint({ attackOptions } = {}) {
		const targets = [...(game.user?.targets ?? [])];
		const areaPoint = attackOptions?.weapon?.areaPoint ?? null;
		if (!areaPoint && targets.length !== 1) {
			ui.notifications.warn("Escolha a área no mapa ou marque o alvo que define o ponto do disparo.");
			return null;
		}
		return this.rollDamage({
			attackOptions,
			critical: false,
			lastId: true,
			hitResult: { hit: true, point: true, areaPoint, targetTokenUuid: areaPoint ? null : (targets[0].document?.uuid ?? null) },
		});
	}

	/**
	 * Roll damage once per hitting attack in a multi-attack volley. Each attack
	 * that landed (and is revealed) rolls its own damage; the dice are doubled
	 * only for the attacks that rolled a critical, matching OP per-attack rules
	 * (a x4 creature that crits on one swing doubles only that swing). Each roll
	 * is routed to the actor that attack struck via its `actorUuid`, so
	 * multi-target volleys apply to the right token.
	 * @param {Array<object>} attackResults  Per-attack records from the card flag.
	 * @param {object} [options]
	 * @param {Event}  [options.event]       Originating click (altKey forces crit).
	 * @returns {Promise<Roll[]>}            One Roll per hitting attack.
	 */
	async rollVolleyDamage(attackResults, { event, attackOptions } = {}) {
		const entries = attackResults ?? [];
		const hits = entries.filter((a) => a?.hit === true && a?.revealed !== false);
		const rolls = [];
		for (const atk of hits) {
			const critical = atk.isCritical
				? { isCritical: true, multiplier: this.constructor._parseCriticalMultiplier(this.system.critical) }
				: false;
			rolls.push(
				await this.rollDamage({
					event,
					attackOptions,
					critical,
					lastId: true,
					hitResult: {
						actorUuid: atk.actorUuid ?? null,
						attackMessageId: atk.attackMessageId ?? null,
						isCritical: Boolean(atk.isCritical),
						hit: true,
						targetTokenUuid: atk.targetTokenUuid ?? null,
						attackTotal: atk.attackTotal ?? null,
					},
					_attackIndex: atk.attackIndex ?? null,
					_attackTotal: entries.length,
				})
			);
		}
		return rolls;
	}

	/**
	 * Trigger an item usage, optionally creating a chat message with followup actions.
	 **/
	async use(config = {}, options = {}) {
		const item = this;
		// const is = item.system;
		// const as = item.actor.system;

		// options = {
		// 	createMessage: false
		// };

		// Prepare card data & display it if options.createMessage is true
		const cardData = await item.roll(options);
		return cardData;
	}

	/**
	 * Handle clickable rolls.
	 * @param {Event} event   The originating click event
	 * @private
	 */
	async roll() {
		const item = this;

		// Initialize chat data.
		const speaker = ChatMessage.getSpeaker({ actor: this.actor });
		const rollMode = game.settings.get("core", "rollMode");
		// const label = 'Exibindo um(a) ' + game.i18n.localize('TYPES.Item.' + item.type) + ` (${item.name}):`;

		// Render the chat card template
		// Tenta obter o token de várias formas para garantir compatibilidade com tokens vinculados e não vinculados
		const token = this.actor.token || this.actor.getActiveTokens()?.[0] || null;
		const targets = [...(game.user?.targets ?? new Set())];
		const targetNames = targets.map((t) => t?.name).filter(Boolean);
		const targetText =
			targetNames.length === 0
				? null
				: targetNames.length === 1
				? targetNames[0]
				: `${targetNames.length} ${game.i18n.localize("op.targetsLabel")}: ${targetNames.join(", ")}`;
		const templateData = {
			actor: this.actor,
			tokenId: token?.uuid || null,
			item: this,
			data: await this.getChatData(),
			labels: this.labels,
			i18n: {},
			info: [],
			targetName: targetText,
		};

		if (item.type == "armament") {
			if (this.system?.proficiency)
				templateData.info.push(game.i18n.localize("op.proficiencyChoices." + this.system.proficiency));
			if (this.system?.critical) templateData.info.push(this.system.critical);
			if (this.system.types?.gripType)
				templateData.info.push(game.i18n.localize("op.weaponGripTypeChoices." + this.system.types.gripType));
			if (this.system.types?.rangeType?.name)
				templateData.info.push(game.i18n.localize("op.weaponTypeChoices." + this.system.types.rangeType.name));
			if (this.system.types?.damageType)
				templateData.info.push(game.i18n.localize("op.damageTypeChoices." + this.system.types.damageType));
			if (this.system.conditions?.improvised) templateData.info.push(game.i18n.localize("op.improvised"));
			if (this.system.conditions?.throwable) templateData.info.push(game.i18n.localize("op.throwable"));
			if (this.system.conditions?.agile) templateData.info.push(game.i18n.localize("op.agile"));
			if (this.system.conditions?.automatic) templateData.info.push(game.i18n.localize("op.automatic"));
			if (this.system.conditions?.adaptableGrip) templateData.info.push(game.i18n.localize("op.adaptableGrip"));
			if (this.system.conditions?.pistolBlow) templateData.info.push(game.i18n.localize("op.pistolBlow"));
		}

		if (item.type == "ritual") {
			if (this.system?.area.name && this.system.target == "area") {
				const area = {
					name: game.i18n.localize("op.areaChoices." + this.system.area.name),
					type: game.i18n.localize("op.areaTypeChoices." + this.system.area.type),
					size: this.system.area.size,
				};
				if (this.system?.area.name == "cone" || this.system?.area.name == "sphere") {
					templateData.i18n.areaLabel = game.i18n.format("op.areaLabelSphereCone", area);
				} else {
					templateData.i18n.areaLabel = game.i18n.format("op.areaLabelCubeLine", area);
				}
			}
		}

		const html = await foundry.applications.handlebars.renderTemplate(
			"systems/ordem-v2-classic/templates/chat/item-card.hbs",
			templateData
		);

		const chatMessageData = {
			speaker: speaker,
			rollMode: rollMode,
			content: html,
		};

		// Whisper to GM if roll mode is set to GM rolls
		if (rollMode == "blindroll") chatMessageData.whisper = ChatMessage.getWhisperRecipients("GM");
		if (rollMode == "selfroll") chatMessageData.whisper = [game.user.id];
		if (rollMode == "gmroll") {
			const gmUsers = game.users.filter((u) => u.isGM).map((u) => u.id);
			chatMessageData.whisper = [...new Set([...gmUsers, game.user.id])].flat();
		}
		const message = await ChatMessage.create(chatMessageData);

		Hooks.callAll("ordemparanormal.itemUsed", {
			item: this,
			actor: this.actor,
			token,
			message,
			chatMessageData,
		});
		return message;
	}

	/**
	 * Prepare data needed to roll an attack using an item (weapon, feat, spell, or equipment)
	 * and then pass it off to `d20Roll`.
	 * @param {object} [options]
	 * @param {boolean} [options.spellLevel]  Level at which a spell is cast.
	 * @returns {Promise<Roll>}   A Promise which resolves to the created Roll instance.
	 */
	async rollFormula(/* {spellLevel}={} */) {
		if (!this.system.formulas.extraFormula) throw new Error("This Item does not have a formula to roll!");

		const rollConfig = {
			formula: this.system.formulas.extraFormula,
			data: this.getRollData(),
			chatMessage: true,
		};
		// if ( spellLevel ) rollConfig.data.item.level = spellLevel;

		/**
		 * A hook event that fires before a formula is rolled for an Item.
		 * @function ordemparanormal.preRollFormula
		 * @memberof hookEvents
		 * @param {Item5e} item                 Item for which the roll is being performed.
		 * @param {object} config               Configuration data for the pending roll.
		 * @param {string} config.formula       Formula that will be rolled.
		 * @param {object} config.data          Data used when evaluating the roll.
		 * @param {boolean} config.chatMessage  Should a chat message be created for this roll?
		 * @returns {boolean}                   Explicitly return false to prevent the roll from being performed.
		 */

		// if ( Hooks.call('ordemparanormal.preRollFormula', this, rollConfig) === false ) return;

		const roll = await new Roll(rollConfig.formula, rollConfig.data).evaluate();

		if (rollConfig.chatMessage) {
			roll.toMessage(
				{
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					flavor: `${this.name}`,
				},
				{ rollMode: game.settings.get("core", "rollMode") }
			);
		}

		/**
		 * A hook event that fires after a formula has been rolled for an Item.
		 * @function ordemparanormal.rollFormula
		 * @memberof hookEvents
		 * @param {Item5e} item  Item for which the roll was performed.
		 * @param {Roll} roll    The resulting roll.
		 */
		Hooks.callAll("ordemparanormal.rollFormula", this, roll);

		return roll;
	}
}
