/**
 * Regras puras da animação de dano nas criaturas (sem Foundry): qual elemento, qual faixa, quanto recuar e o que mostrar.
 * Quem toca a animação é `integrations/damage-fx.mjs`. Spec: docs/spec-animacao-dano-criaturas.md.
 */

export const ELEMENTS = Object.freeze(["blood", "death", "knowledge", "energy", "fear"]);
export const TIERS = Object.freeze(["leve", "media", "pesada", "critica"]);

/** Nomes que aparecem na ficha (inglês do sistema ou português) → chave do elemento. */
const ELEMENT_ALIASES = Object.freeze({
	blood: "blood", sangue: "blood",
	death: "death", morte: "death",
	knowledge: "knowledge", conhecimento: "knowledge",
	energy: "energy", energia: "energy",
	fear: "fear", medo: "fear",
});

const keyOf = (text) => ELEMENT_ALIASES[String(text ?? "").trim().toLowerCase()] ?? null;

/** DF-02: `elements.main`; vazio cai no primeiro reconhecido de `elements.others`; senão "neutral". */
export function resolveElement(elements) {
	const main = keyOf(elements?.main);
	if (main) return main;
	for (const part of String(elements?.others ?? "").split(/[,;/\s]+/)) {
		const key = keyOf(part);
		if (key) return key;
	}
	return "neutral";
}

/** Multiplicadores da opção de mundo "intensidade". */
export const INTENSITY = Object.freeze({
	sutil: { time: 0.75, move: 0.7 },
	normal: { time: 1, move: 1 },
	dramatica: { time: 1.25, move: 1.3 },
});

/** Por faixa: duração, vibração e recuo em frações da casa da cena, contorno (DF-24). */
export const TIER_SPECS = Object.freeze({
	leve: Object.freeze({ ms: 500, shakes: 2, shake: 0.03, recoil: 0, ring: "fino" }),
	media: Object.freeze({ ms: 700, shakes: 3, shake: 0.06, recoil: 0, ring: "normal" }),
	pesada: Object.freeze({ ms: 900, shakes: 3, shake: 0.08, recoil: 0.2, ring: "grosso" }),
	critica: Object.freeze({ ms: 1200, shakes: 4, shake: 0.08, recoil: 0.25, ring: "grosso-brilho" }),
});
export const KILL_MS = 1400;
export const BLOCK_MS = 400;
export const MAX_RECOIL_CELLS = 0.25;
export const MAX_FULL_EFFECTS = 3;
export const MAX_SIMULTANEOUS = 6;
export const STAGGER_MS = 80;
/** Segurança contra fotossensibilidade (DF-22): nenhum perfil passa de 3 clarões por segundo. */
export const MAX_FLASHES_PER_SECOND = 3;

/**
 * Perfil de cada elemento. `motion` é a assinatura do movimento; `slots` listam efeitos do Sequencer/JB2A
 * (do preferido ao alternativo; o primeiro que existir no banco vale; sem nenhum, só o movimento nativo).
 */
export const PROFILES = Object.freeze({
	blood: Object.freeze({
		label: "Sangue", motion: "kick-throb", color: "#e04848", flashHz: 2, scalePulse: 1.06,
		impact: ["jb2a.liquid.splash02.red", "jb2a.liquid.splash_side02.red", "blfx.misc.droplet1.blood.buble.red.1"],
		final: ["jb2a.liquid.splash02.red", "jb2a.liquid.splash_side02.red"],
	}),
	death: Object.freeze({
		label: "Morte", motion: "drag", color: "#9aa0a6", flashHz: 1, ghostDelayMs: 120, fade: 0.8,
		impact: ["jb2a.smoke.puff.centered.grey.0", "jb2a.smoke.puff.centered.grey.1", "jb2a.smoke.puff.side.grey.0"],
		final: ["jb2a.smoke.puff.ring.01.white.0", "jb2a.smoke.puff.centered.grey.0"],
	}),
	knowledge: Object.freeze({
		label: "Conhecimento", motion: "glitch", color: "#d9a52b", flashHz: 3, splitPx: 4,
		impact: ["jb2a.markers.01.blueyellow", "jb2a.magic_signs.rune.divination.intro.blue"],
		final: ["jb2a.magic_signs.rune.divination.outro.blue", "jb2a.markers.01.blueyellow"],
	}),
	energy: Object.freeze({
		label: "Energia", motion: "jitter", color: "#b25ce0", flashHz: 3, jitterHz: 30,
		impact: ["jb2a.static_electricity.03.blue", "jb2a.electric_arc.01", "jb2a.static_electricity.01.blue"],
		final: ["jb2a.electric_arc.02", "jb2a.lightning_ball.blue", "jb2a.static_electricity.02.blue"],
	}),
	fear: Object.freeze({
		label: "Medo", motion: "shrink", color: "#e8e8e8", flashHz: 1, scaleTo: 0.94, vignette: true, fxScale: 0.95, fxOpacity: 0.6,
		impact: ["jb2a.black_tentacles.dark_purple", "jb2a.arms_of_hadar.dark_purple"],
		final: ["jb2a.arms_of_hadar.dark_purple", "jb2a.darkness.black"],
	}),
	neutral: Object.freeze({
		label: "Neutro", motion: "shake", color: "#ffffff", flashHz: 1,
		impact: [], final: [],
	}),
});

export const BLOCK_PROFILE = Object.freeze({ label: "Bloqueio", color: "#c9ced6", flashHz: 1, impact: [] });

/** Cores do tipo de dano para a faísca de impacto (as mesmas da etiqueta do cartão). */
export const DAMAGE_SPARK = Object.freeze({
	cuttingDamage: "#c9ced6", impactDamage: "#a8a29e", piercingDamage: "#d6b88a", ballisticDamage: "#e0a33a",
	bloodDamage: "#e04848", deathDamage: "#9aa0a6", knowledgeDamage: "#d9a52b", energyDamage: "#b25ce0", fearDamage: "#e8e8e8",
	fireDamage: "#ff7a2e", eletricDamage: "#f5e642", coldDamage: "#5cc8ff", chemicalDamage: "#7ddc4a", mentalDamage: "#ff7ad9",
});

/** DF-03: cortes de 10/25/50% do PV máximo; sobe uma faixa por vulnerabilidade e outra por crítico (teto: crítica). */
export function damageTier({ lost = 0, max = 0, vulnerable = false, crit = false } = {}) {
	const pct = max > 0 ? Math.max(0, lost) / max : lost > 0 ? 1 : 0;
	let index = pct >= 0.5 ? 3 : pct >= 0.25 ? 2 : pct >= 0.1 ? 1 : 0;
	index += (vulnerable ? 1 : 0) + (crit ? 1 : 0);
	return TIERS[Math.min(3, index)];
}

/** DF-01: só queda de PV (ou um bloqueio avisado pelo `applyDamage`) dispara a reação. */
export function shouldPlay({ before, after, blocked = false } = {}) {
	if (blocked) return true;
	return Number.isFinite(before) && Number.isFinite(after) && after < before;
}

/** DF-14/DF-17: movimento completo só com orçamento e sem "reduzir movimento"; senão só flash + contorno. */
export function pickMotion({ reducedMotion = false, budgetLeft = MAX_SIMULTANEOUS } = {}) {
	return reducedMotion || budgetLeft <= 0 ? "flat" : "full";
}

/** Vagas livres entre as animações simultâneas (DF-17). */
export const budget = (active = 0, limit = MAX_SIMULTANEOUS) => Math.max(0, limit - active);

/** DF-17: dos golpes de uma mesma área, só os de maior dano ganham o efeito completo. */
export function rankFullEffects(losses, top = MAX_FULL_EFFECTS) {
	const order = losses.map((lost, index) => ({ lost, index })).sort((a, b) => b.lost - a.lost || a.index - b.index);
	return new Set(order.slice(0, top).map((entry) => entry.index));
}

/** Atraso do início da reação de cada criatura atingida junto (escalonamento). */
export const staggerDelay = (position) => Math.max(0, position) * STAGGER_MS;

/** DF-20: que selos aparecem. Bloqueio e RD para todos; vulnerabilidade só para o Mestre (ou se revelada). */
export function visibleBadges({ isGM = false, revealVulnerability = false, blocked = 0, finalDamage = 1, multiplier = 1 } = {}) {
	const badges = [];
	if (finalDamage === 0) badges.push("block");
	else if (blocked > 0) badges.push("resist");
	if (multiplier > 1 && (isGM || revealVulnerability)) badges.push("vulnerable");
	return badges;
}

/**
 * DF-21: deslocamento visual do recuo, em pixels. Para longe de quem atacou; sem atacante, radial a partir do centro
 * da área; sem nenhum dos dois, não recua (só vibra). Nunca passa de 0,25 casa.
 */
export function recoilVector({ attackerPos, tokenPos, areaCenter, tier = "leve", gridSize = 100, move = 1 } = {}) {
	const spec = TIER_SPECS[tier] ?? TIER_SPECS.leve;
	const origin = attackerPos ?? areaCenter;
	if (!origin || !tokenPos || !spec.recoil) return { x: 0, y: 0 };
	const dx = tokenPos.x - origin.x;
	const dy = tokenPos.y - origin.y;
	const dist = Math.hypot(dx, dy);
	if (!dist) return { x: 0, y: 0 };
	const cells = Math.min(MAX_RECOIL_CELLS, spec.recoil * move);
	return { x: (dx / dist) * cells * gridSize, y: (dy / dist) * cells * gridSize };
}

/**
 * Monta a reação do token a um golpe.
 * @param {object} input
 * @param {string} input.element        Chave de `resolveElement`.
 * @param {number} input.before         PV antes.
 * @param {number} input.after          PV depois.
 * @param {number} input.max            PV máximo.
 * @param {string} [input.damageType]   Tipo do dano (toque de cor).
 * @param {number} [input.finalDamage]  Dano depois de RD/imunidade/vulnerabilidade, se o `applyDamage` avisou.
 * @param {number} [input.blocked]      Quanto a RD absorveu.
 * @param {number} [input.multiplier]   Vulnerabilidade (>1).
 * @param {boolean} [input.crit]        Acerto crítico.
 * @param {boolean} [input.reducedMotion]
 * @param {number} [input.budgetLeft]
 * @param {string} [input.intensity]    sutil | normal | dramatica.
 */
export function buildReaction({
	element = "neutral", before = 0, after = 0, max = 0, damageType, finalDamage, blocked = 0, multiplier = 1,
	crit = false, reducedMotion = false, budgetLeft = MAX_SIMULTANEOUS, intensity = "normal",
} = {}) {
	const scale = INTENSITY[intensity] ?? INTENSITY.normal;
	const profileKey = PROFILES[element] ? element : "neutral";
	const motion = pickMotion({ reducedMotion, budgetLeft });
	const sparkColor = DAMAGE_SPARK[damageType] ?? null;

	// DF-05: dano zerado por RD ou imunidade é bloqueio, com ou sem mudança de PV.
	if (finalDamage === 0) {
		return {
			kind: "block", element: profileKey, profile: BLOCK_PROFILE, tier: null, motion, kill: false, crossedHurt: false, bigHit: false,
			vulnerable: false, ring: "prateado", tintColor: BLOCK_PROFILE.color, sparkColor, durationMs: Math.round(BLOCK_MS * scale.time),
			shake: 0, shakes: 0, recoilCells: 0, move: scale.move,
		};
	}

	const lost = Math.max(0, before - after);
	const vulnerable = multiplier > 1;
	const tier = damageTier({ lost, max, vulnerable, crit });
	const spec = TIER_SPECS[tier];
	const kill = after <= 0 && before > 0;
	const half = max / 2;
	const crossedHurt = !kill && max > 0 && before > half && after <= half;
	const bigHit = before > 0 && lost >= before / 2;
	const durationMs = Math.round((kill ? KILL_MS : spec.ms + (crossedHurt ? 250 : 0) + (bigHit ? 150 : 0)) * scale.time);
	return {
		kind: "damage", element: profileKey, profile: PROFILES[profileKey], tier, motion, kill, crossedHurt, bigHit, vulnerable,
		resisted: blocked > 0, crit: Boolean(crit), ring: spec.ring, tintColor: PROFILES[profileKey].color, sparkColor,
		durationMs, shake: spec.shake * scale.move, shakes: spec.shakes, recoilCells: Math.min(MAX_RECOIL_CELLS, spec.recoil * scale.move),
		move: scale.move,
	};
}
