/**
 * Resolve as armas de área no mapa (Bazuca e Lança-chamas): acha os seres, rola Reflexos, aplica dano e Em Chamas e posta o relatório.
 * Geometria e contas puras em weapon-area.mjs; regras em docs/spec-armas-area-recarga.md.
 */
import { BAZOOKA_RADIUS_SQUARES, areaKind, flameHit, lineHits, radiusDamage, radiusHits, reflexDT } from "./weapon-area.mjs";
import { activeConditions } from "./conditions.mjs";

const SYSTEM = "ordem_v2_classic";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hpOf = (actor) => Number(actor.type === "threat" ? actor.system.attributes?.hp?.value : actor.system.PV?.value);

/** Centro do token em quadrados do mapa. */
const squareCenter = (tokenDoc) => {
	const size = tokenDoc.parent.grid.size;
	return { x: (tokenDoc.x + (tokenDoc.width * size) / 2) / size, y: (tokenDoc.y + (tokenDoc.height * size) / 2) / size };
};

/** Token de quem ataca: o controlado, senão o primeiro da ficha. */
function attackerToken(actor) {
	const mine = actor.getActiveTokens?.() ?? [];
	return (mine.find((t) => t.controlled) ?? mine[0])?.document ?? null;
}

async function setOnFire(actor) {
	const { applyCondition } = await import("../macros/ritual-area-engine.mjs");
	if (activeConditions(actor, "burning").length) return false;
	await applyCondition(actor, { key: "burning", label: "Em Chamas" }, {});
	return true;
}

/**
 * @param {object} p
 * @param {Item} p.item            a arma
 * @param {object} p.weapon        config.weapon da tela de ataque (mode, area)
 * @param {number} p.total         total do dano rolado (um só para todos)
 * @param {string} p.damageType
 * @param {object|null} p.hitResult  { hit, actorUuid, targetTokenUuid, attackTotal } do ataque
 * @param {string|null} p.messageId  cartão do ataque, para não resolver duas vezes
 * @returns {Promise<string[]|null>} linhas do relatório, ou null se nada foi resolvido
 */
export async function resolveWeaponArea({ item, weapon, total, damageType, hitResult, messageId = null }) {
	const kind = weapon?.area ?? areaKind(item.name);
	if (!kind) return null;
	const point = weapon?.mode === "point";
	const actor = item.parent;
	const origin = attackerToken(actor);
	const targetDoc = hitResult?.targetTokenUuid ? await fromUuid(hitResult.targetTokenUuid) : null;
	if (!origin || !targetDoc || origin.parent !== targetDoc.parent) {
		ui.notifications.warn("Área da arma: marque um alvo no mesmo mapa de quem ataca.");
		return null;
	}
	if (kind === "radius" && !point && hitResult?.hit !== true) return null; // errou: sem explosão
	const message = messageId ? game.messages.get(messageId) : null;
	if (message?.getFlag(SYSTEM, "areaResolved")) {
		ui.notifications.info("A área desta arma já foi resolvida neste ataque.");
		return null;
	}
	if (message) await message.setFlag(SYSTEM, "areaResolved", true);

	const scene = origin.parent;
	const primaryActorId = point ? null : targetDoc.actor?.id;
	const candidates = scene.tokens.filter((t) => t.actor && t.id !== origin.id && hpOf(t.actor) > 0);
	const lines = [];
	const speaker = ChatMessage.getSpeaker({ actor });
	const pos = (t) => ({ id: t.id, ...squareCenter(t) });

	if (kind === "radius") {
		const dt = reflexDT(actor.system.attributes?.dex?.value);
		const hitIds = new Set(radiusHits(squareCenter(targetDoc), candidates.map(pos), BAZOOKA_RADIUS_SQUARES));
		for (const token of candidates.filter((t) => hitIds.has(t.id))) {
			if (!point && token.actor.id === primaryActorId) continue; // o alvo atingido recebe o dano inteiro pelo cartão
			const { autoRoll } = await import("../macros/ritual-area-engine.mjs");
			const save = await autoRoll(token.actor, "reflexes", dt);
			const passed = Boolean(save?.success);
			const amount = radiusDamage(total, passed);
			const before = hpOf(token.actor);
			const result = await token.actor.applyDamage(amount, { damageType });
			lines.push(`${token.name}: Reflexos ${save ? save.total : "—"} contra DT ${dt}: ${passed ? "passou, metade do dano" : "falhou, dano inteiro"} (${amount}). PV ${before} → ${hpOf(token.actor)}${result?.finalDamage !== undefined && result.finalDamage !== amount ? ` (resistência: ${result.finalDamage})` : ""}.`);
		}
		if (!lines.length) lines.push("Ninguém mais dentro do raio de 3 m.");
	} else {
		const attackTotal = Number(hitResult?.attackTotal);
		const hitIds = new Set(lineHits(squareCenter(origin), squareCenter(targetDoc), candidates.map(pos)));
		for (const token of candidates.filter((t) => hitIds.has(t.id))) {
			const primary = token.actor.id === primaryActorId;
			const defense = Number(token.actor.system?.defense?.value) || 0;
			if (!flameHit(attackTotal, defense)) {
				lines.push(`${token.name}: Defesa ${defense} contra ${attackTotal}: não foi atingido.`);
				continue;
			}
			let note = `Defesa ${defense} contra ${attackTotal}: atingido`;
			if (!primary) {
				const before = hpOf(token.actor);
				await token.actor.applyDamage(total, { damageType });
				note += `, dano ${total}. PV ${before} → ${hpOf(token.actor)}`;
			} else note += " (dano pelo cartão)";
			note += (await setOnFire(token.actor)) ? ". Em Chamas." : ". Já estava Em Chamas.";
			lines.push(`${token.name}: ${note}`);
		}
		if (!lines.length) lines.push("Ninguém na linha de fogo.");
	}
	await ChatMessage.create({
		speaker,
		content: `<article class="weapon-area-report"><h4>${escapeHtml(item.name)} — ${kind === "radius" ? (point ? "disparo num ponto, raio de 3 m" : "explosão, raio de 3 m") : "linha de fogo"}</h4><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul></article>`,
	});
	return lines;
}
