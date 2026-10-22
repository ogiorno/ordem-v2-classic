/**
 * Reação visual do token ao dano (docs/spec-animacao-dano-criaturas.md). Só visual: não altera PV, posição nem efeitos.
 * `applyDamage` manda o contexto do golpe nas opções do `update` (`opDamageFx`) e `preUpdateActor` guarda o PV antes;
 * cada cliente recebe `updateActor` e toca a animação localmente. As regras (faixa, elemento, recuo) ficam em
 * `helpers/damage-fx-rules.mjs`.
 */
import {
	PROFILES, BLOCK_PROFILE, TIERS, KILL_MS, MAX_SIMULTANEOUS,
	resolveElement, buildReaction, budget, rankFullEffects, staggerDelay, visibleBadges, recoilVector,
} from "../helpers/damage-fx-rules.mjs";

const SYSTEM = "ordem-v2-classic";
const HP_PATH = "system.attributes.hp.value";
const PV_PATH = "system.PV.value";
const BATCH_MS = 60;
const DICE_WAIT_MS = 3000;

export const SETTINGS = Object.freeze({
	enabled: "damageFx",
	intensity: "damageFxIntensity",
	reduceMotion: "damageFxReduceMotion",
	revealVulnerability: "damageFxRevealVulnerability",
});

/** Animações em andamento por token. */
const active = new Map();
let queue = [];
let flushTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setting = (key, fallback) => {
	try { return game.settings.get(SYSTEM, key) ?? fallback; } catch { return fallback; }
};
export const fxEnabled = () => Boolean(setting(SETTINGS.enabled, true)) && Boolean(canvas?.ready);
const reducedMotion = () => Boolean(setting(SETTINGS.reduceMotion, false)) || Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

/** Dados de depuração para os testes (DF-26). */
function debugState() {
	CONFIG.opDamageFx ??= { lastReaction: null, history: [], get active() { return active.size; } };
	return CONFIG.opDamageFx;
}

/* -------------------------------------------- */
/*  Cores e geometria                           */
/* -------------------------------------------- */

const toInt = (hex) => Number.parseInt(String(hex).replace("#", ""), 16);
function lerpColor(a, b, amount) {
	const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
	const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
	return (Math.round(ar + (br - ar) * amount) << 16) | (Math.round(ag + (bg - ag) * amount) << 8) | Math.round(ab + (bb - ab) * amount);
}
const RING_WIDTH = { fino: 2, normal: 3, grosso: 5, "grosso-brilho": 5, prateado: 4 };
const centerOf = (placeable) => placeable?.center ?? (placeable?.document ? { x: placeable.document.x, y: placeable.document.y } : null);

/** Posição do atacante a partir do uuid do token (ou null). */
function positionFromUuid(uuid) {
	if (!uuid) return null;
	try {
		const doc = fromUuidSync(uuid);
		const object = doc?.object ?? doc?.parent?.object;
		return centerOf(object?.document ? object : doc?.object);
	} catch { return null; }
}

/* -------------------------------------------- */
/*  Movimento                                   */
/* -------------------------------------------- */

/** Deslocamento/escala/transparência/clarão num instante `t` (0..1) de uma reação. Puro dado de entrada → saída. */
function frame(r, t, elapsedMs, grid, recoil) {
	const full = r.motion === "full";
	const env = Math.sin(Math.PI * t);
	const decay = 1 - t;
	let dx = 0, dy = 0, scale = 1, alpha = 1, flash = env * 0.6;
	if (full) {
		const amp = r.shake * grid * decay;
		const wave = Math.sin(t * r.shakes * 2 * Math.PI);
		const profile = r.profile;
		const out = Math.sin(Math.PI * Math.min(1, t * 1.15));
		dx = recoil.x * out;
		dy = recoil.y * out;
		switch (profile.motion) {
			case "kick-throb": dx += wave * amp; scale = 1 + (profile.scalePulse - 1) * Math.sin(Math.PI * Math.min(1, t * 2)); break;
			case "drag": dx += Math.sin(t * r.shakes * Math.PI) * amp * 0.6; alpha = 1 - 0.2 * env; break;
			case "glitch": {
				const step = Math.floor(t * r.shakes * 4);
				dx += (step % 2 ? 1 : -1) * ((step * 37) % 5 + 3) / 7 * amp + (step % 2 ? 1 : -1) * (profile.splitPx ?? 0) * 0.2 * decay;
				flash = (Math.floor((elapsedMs / 1000) * profile.flashHz * 2) % 2 === 0 ? 0.5 : 0.1) * decay;
				break;
			}
			case "jitter": {
				const step = Math.floor((elapsedMs / 1000) * (profile.jitterHz ?? 30));
				const rnd = (n) => { const v = Math.sin(step * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
				dx += (rnd(1) - 0.5) * 2 * amp;
				dy += (rnd(2) - 0.5) * 2 * amp;
				flash = env * 0.35;
				break;
			}
			case "shrink": scale = 1 - (1 - profile.scaleTo) * env; dx += wave * amp * 0.6; break;
			default: dx += wave * amp;
		}
		if (r.kill) { scale *= 1 - 0.08 * t; alpha *= 1 - 0.3 * t; }
	}
	return { dx, dy, scale, alpha, flash };
}

/* -------------------------------------------- */
/*  Execução                                    */
/* -------------------------------------------- */

function cancel(tokenId, { record, keepPosition = false } = {}) {
	const state = active.get(tokenId);
	if (!state) return;
	active.delete(tokenId);
	canvas.app?.ticker?.remove(state.tick);
	try { state.gfx?.destroy(); } catch { /* já destruído */ }
	const token = state.token;
	const mesh = token?.mesh;
	if (state.effectsWasVisible !== undefined && !token?.destroyed && token?.effects && !token.effects.destroyed) {
		token.effects.visible = state.effectsWasVisible;
		token.renderFlags?.set({ refreshEffects: true });
	}
	if (!token?.destroyed && mesh && !mesh.destroyed) {
		// volta ao estado original; se o token andou de verdade (DF-27), a posição é a nova e não a de antes
		const o = state.orig;
		if (!keepPosition) mesh.position.set(o.x, o.y);
		mesh.scale.set(o.scaleX, o.scaleY);
		mesh.alpha = o.alpha;
		mesh.tint = o.tint;
		token.renderFlags?.set({ refreshMesh: true, refreshPosition: true });
	}
	if (record) {
		requestAnimationFrame(() => requestAnimationFrame(() => {
			const mesh = token?.mesh;
			const o = state.orig;
			const done = !mesh || mesh.destroyed ? null : {
				x: mesh.x, y: mesh.y, scaleX: mesh.scale.x, alpha: mesh.alpha, tint: Number(mesh.tint),
			};
			const restored = done ? Math.abs(done.x - o.x) < 0.5 && Math.abs(done.y - o.y) < 0.5 && Math.abs(done.scaleX - o.scaleX) < 1e-3 && Math.abs(done.alpha - o.alpha) < 1e-3 && done.tint === o.tint : false;
			const dbg = debugState();
			if (dbg.lastReaction && dbg.lastReaction.id === state.id) Object.assign(dbg.lastReaction, { orig: o, final: done, restored });
		}));
	}
}

/** Mais forte vence quando duas reações cabem no mesmo token. */
const strength = (r) => (r.kill ? 10 : r.kind === "block" ? 0 : TIERS.indexOf(r.tier) + 1);

async function playSlot(token, files, { scale = 1.3, opacity = 1 } = {}) {
	if (!game.modules.get("sequencer")?.active || typeof Sequence === "undefined" || !files?.length) return false;
	const file = files.find((entry) => Sequencer.Database.entryExists(entry));
	if (!file) return false;
	try {
		await new Sequence().effect().file(file).atLocation(token).scaleToObject(scale).opacity(opacity).play();
		return true;
	} catch (error) {
		console.warn("Ordem Paranormal | Efeito de dano falhou:", error);
		return false;
	}
}

let nextId = 1;
/** Toca uma reação num token. Resolve quando termina. */
function playOnToken(token, r, { delay = 0, full = true, attacker = null, areaCenter = null, badges = [], hp = null } = {}) {
	return new Promise((resolve) => {
		const mesh = token?.mesh;
		if (!token || token.destroyed || !mesh || mesh.destroyed) return resolve(false);
		const existing = active.get(token.id);
		if (existing) {
			if (strength(existing.reaction) >= strength(r)) return resolve(false);
			cancel(token.id);
		}
		const grid = canvas.grid?.size ?? 100;
		const move = r.move ?? 1;
		const recoil = r.kind === "damage" && r.motion === "full"
			? recoilVector({ attackerPos: attacker, tokenPos: centerOf(token), areaCenter, tier: r.tier, gridSize: grid, move })
			: { x: 0, y: 0 };
		const orig = { x: mesh.x, y: mesh.y, scaleX: mesh.scale.x, scaleY: mesh.scale.y, alpha: mesh.alpha, tint: Number(mesh.tint) };
		const gfx = new PIXI.Graphics();
		token.addChild(gfx);
		const id = nextId++;
		const state = { id, token, reaction: r, orig, gfx, tick: null, started: false };
		// Final (0 PV): o ícone de "morto" só aparece depois da animação, mesmo que o status já tenha sido marcado por outro cliente.
		if (r.kill && token.effects) {
			state.effectsWasVisible = token.effects.visible;
			token.effects.visible = false;
		}
		const color = toInt(r.tintColor);
		const spark = r.sparkColor ? toInt(r.sparkColor) : null;
		const impact = (() => {
			const c = centerOf(token);
			if (!c || !attacker) return { x: token.w / 2, y: token.h / 2 };
			const dx = attacker.x - c.x, dy = attacker.y - c.y, d = Math.hypot(dx, dy) || 1;
			return { x: token.w / 2 + (dx / d) * token.w * 0.35, y: token.h / 2 + (dy / d) * token.h * 0.35 };
		})();
		let elapsed = 0;
		state.tick = (ticker) => {
			const dt = ticker?.deltaMS ?? 16;
			elapsed += dt;
			if (elapsed < delay) return;
			const local = elapsed - delay;
			if (!state.started) {
				state.started = true;
				if (full && r.motion === "full") playSlot(token, r.kind === "block" ? BLOCK_PROFILE.impact : r.kill ? r.profile.final : r.profile.impact, { scale: r.profile.fxScale ?? 1.3, opacity: r.profile.fxOpacity ?? 1 });
			}
			const t = Math.min(1, local / r.durationMs);
			const f = frame(r, t, local, grid, recoil);
			mesh.position.set(orig.x + f.dx, orig.y + f.dy);
			mesh.scale.set(orig.scaleX * f.scale, orig.scaleY * f.scale);
			mesh.alpha = orig.alpha * f.alpha;
			mesh.tint = lerpColor(orig.tint, color, Math.max(0, Math.min(1, f.flash)));
			// contorno: espessura pela faixa, forma própria por situação (anel prateado, vermelho do Mestre, pulso)
			const env = Math.sin(Math.PI * t);
			gfx.clear();
			const rw = RING_WIDTH[r.ring] ?? 3;
			const cx = token.w / 2, cy = token.h / 2, rx = token.w / 2 + 3, ry = token.h / 2 + 3;
			if (r.ring === "grosso-brilho") gfx.lineStyle(rw + 5, color, 0.25 * env).drawEllipse(cx, cy, rx + 2, ry + 2);
			gfx.lineStyle(rw, color, 0.9 * env).drawEllipse(cx, cy, rx, ry);
			if (r.profile?.vignette) gfx.lineStyle(0).beginFill(0x000000, 0.28 * env).drawEllipse(cx, cy, rx + 10, ry + 10).endFill();
			if (badges.includes("vulnerable")) gfx.lineStyle(3, 0xff3030, 0.9 * env).drawEllipse(cx, cy, rx + 6, ry + 6);
			if (r.crossedHurt || r.bigHit) gfx.lineStyle(2, 0x8b1a1a, env > 0.6 ? 0.9 : 0.3).drawEllipse(cx, cy, rx + 11, ry + 11);
			if (spark !== null && local < 220) {
				const s = local / 220;
				gfx.lineStyle(0).beginFill(spark, 1 - s).drawCircle(impact.x, impact.y, 5 + 14 * s).endFill();
			}
			if (t >= 1) {
				cancel(token.id, { record: true });
				resolve(true);
			}
		};
		active.set(token.id, state);
		const dbg = debugState();
		const snapshot = {
			id, tokenId: token.id, actorId: token.actor?.id ?? null, name: token.name, kind: r.kind, element: r.element, tier: r.tier,
			kill: r.kill, crossedHurt: r.crossedHurt, bigHit: r.bigHit, vulnerable: r.vulnerable, motion: r.motion, durationMs: r.durationMs,
			ring: r.ring, badges, recoil, sparkColor: r.sparkColor, full, hp, effectsHidden: Boolean(r.kill && token.effects), at: Date.now(), orig: null, final: null, restored: null,
		};
		dbg.lastReaction = snapshot;
		dbg.history.push(snapshot);
		if (dbg.history.length > 100) dbg.history.shift();
		canvas.app.ticker.add(state.tick);
	});
}

async function waitForDice() {
	const start = Date.now();
	while (game.dice3d?.box?.rolling && Date.now() - start < DICE_WAIT_MS) await sleep(100);
}

/* -------------------------------------------- */
/*  Fila e entrada                              */
/* -------------------------------------------- */

function agentFlash(token) {
	const r = {
		kind: "flash", element: "neutral", profile: PROFILES.neutral, tier: "leve", motion: "flat", kill: false, crossedHurt: false, bigHit: false,
		vulnerable: false, ring: "fino", tintColor: "#e04848", sparkColor: null, durationMs: 180, shake: 0, shakes: 0, recoilCells: 0, move: 1,
	};
	return playOnToken(token, r, { full: false });
}

function tokensFor(actor) {
	// ator do mundo atualizado: os tokens vinculados mudam sempre; os não vinculados só se herdam o PV (sem alteração própria)
	const path = actor.type === "agent" ? PV_PATH : HP_PATH;
	const own = (token) => actor.isToken || token.document.actorLink || foundry.utils.getProperty(token.actor ?? {}, path) === foundry.utils.getProperty(actor, path);
	return actor.getActiveTokens(false, false).filter(own).filter((token) => token.scene?.id === canvas.scene?.id && (game.user.isGM || (!token.document.hidden && token.isVisible !== false)));
}

async function flush() {
	flushTimer = null;
	const batch = queue;
	queue = [];
	if (!fxEnabled() || !batch.length) return;
	await waitForDice();
	const intensity = setting(SETTINGS.intensity, "normal");
	const reveal = Boolean(setting(SETTINGS.revealVulnerability, false));
	const reduced = reducedMotion();
	const items = [];
	for (const entry of batch) {
		for (const token of tokensFor(entry.actor)) items.push({ ...entry, token });
	}
	// só os de maior dano ganham o efeito completo; o resto, flash + contorno
	const full = rankFullEffects(items.map((item) => Math.max(0, item.before - item.after)));
	let slots = budget(active.size, MAX_SIMULTANEOUS);
	items.forEach((item, index) => {
		const ctx = item.ctx ?? {};
		if (!item.isThreat) {
			agentFlash(item.token);
			return;
		}
		const r = buildReaction({
			element: resolveElement(item.actor.system.elements), before: item.before, after: item.after, max: item.max,
			damageType: ctx.damageType, finalDamage: ctx.finalDamage, blocked: ctx.blocked ?? 0, multiplier: ctx.multiplier ?? 1,
			crit: Boolean(ctx.crit), reducedMotion: reduced, budgetLeft: full.has(index) ? slots : 0, intensity,
		});
		if (r.motion === "full") slots -= 1;
		const badges = visibleBadges({ isGM: game.user.isGM, revealVulnerability: reveal, blocked: ctx.blocked ?? 0, finalDamage: ctx.finalDamage ?? 1, multiplier: ctx.multiplier ?? 1 });
		playOnToken(item.token, r, {
			delay: staggerDelay(index), full: full.has(index), badges,
			attacker: positionFromUuid(ctx.sourceUuid), areaCenter: ctx.areaCenter ?? null, hp: { before: item.before, after: item.after, max: item.max },
		}).catch((error) => console.warn("Ordem Paranormal | Reação de dano falhou:", error));
	});
}

function enqueue(entry) {
	queue.push(entry);
	if (!flushTimer) flushTimer = setTimeout(flush, BATCH_MS);
}

/** Quanto esperar (ms) antes de marcar a ameaça como morta, para o final do elemento aparecer. */
export function deathFxDelayMs(actor) {
	try {
		if (!fxEnabled() || actor?.type !== "threat" || !tokensFor(actor).length) return 0;
		const scale = { sutil: 0.75, normal: 1, dramatica: 1.25 }[setting(SETTINGS.intensity, "normal")] ?? 1;
		return Math.round(KILL_MS * scale) + 100;
	} catch { return 0; }
}

/* -------------------------------------------- */
/*  Pré-visualização do Mestre                  */
/* -------------------------------------------- */

/** Toca os cinco elementos nas quatro faixas num token escolhido (selecionado ou alvo). Não altera nada no mundo. */
export async function playPreview(token = canvas.tokens?.controlled?.[0] ?? [...(game.user.targets ?? [])][0]) {
	if (!token) {
		ui.notifications.warn("Selecione um token para pré-visualizar as animações de dano.");
		return false;
	}
	const intensity = setting(SETTINGS.intensity, "normal");
	for (const element of [...Object.keys(PROFILES)]) {
		for (const tier of TIERS) {
			const max = 100;
			const lost = { leve: 5, media: 15, pesada: 35, critica: 60 }[tier];
			const r = buildReaction({ element, before: max, after: max - lost, max, reducedMotion: reducedMotion(), intensity });
			await playOnToken(token, r, { full: true });
			await sleep(150);
		}
	}
	return true;
}

/* -------------------------------------------- */
/*  Registro                                    */
/* -------------------------------------------- */

class DamageFxPreviewMenu extends foundry.applications.api.ApplicationV2 {
	async render() {
		playPreview();
		return this;
	}
}

Hooks.once("init", () => {
	game.settings.register(SYSTEM, SETTINGS.enabled, {
		name: "Animação de dano nas criaturas", hint: "O token da ameaça reage ao dano com um movimento do elemento dela. Vale só para este navegador.",
		scope: "client", config: true, type: Boolean, default: true,
	});
	game.settings.register(SYSTEM, SETTINGS.reduceMotion, {
		name: "Reduzir movimento do dano", hint: "Troca o tremor, o recuo e as partículas por um flash de cor e o contorno. Vale só para este navegador.",
		scope: "client", config: true, type: Boolean, default: false,
	});
	game.settings.register(SYSTEM, SETTINGS.intensity, {
		name: "Intensidade da animação de dano", hint: "Sutil, Normal (contida) ou Dramática. Vale para todos.",
		scope: "world", config: true, type: String, default: "normal",
		choices: { sutil: "Sutil", normal: "Normal", dramatica: "Dramática" },
	});
	game.settings.register(SYSTEM, SETTINGS.revealVulnerability, {
		name: "Mostrar vulnerabilidade aos jogadores", hint: "Se ligado, o anel vermelho de vulnerabilidade também aparece para os jogadores. Desligado: só o Mestre vê.",
		scope: "world", config: true, type: Boolean, default: false,
	});
	game.settings.registerMenu(SYSTEM, "damageFxPreview", {
		name: "Pré-visualizar animações de dano", label: "Tocar no token selecionado", hint: "Selecione um token no mapa e clique: toca os cinco elementos nas quatro faixas, sem alterar nada.",
		icon: "fa-solid fa-burst", type: DamageFxPreviewMenu, restricted: true,
	});
	debugState();
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
	if (actor.type === "threat" && foundry.utils.getProperty(changes, HP_PATH) !== undefined) {
		options.opFxBefore = actor.system.attributes?.hp?.value;
		options.opFxMax = actor.system.attributes?.hp?.max;
	} else if (actor.type === "agent" && foundry.utils.getProperty(changes, PV_PATH) !== undefined) {
		options.opFxBefore = actor.system.PV?.value;
		options.opFxMax = actor.system.PV?.max;
	}
});

Hooks.on("updateActor", (actor, changes, options) => {
	try {
		const isThreat = actor.type === "threat";
		if (!isThreat && actor.type !== "agent") return;
		if (!fxEnabled()) return;
		const ctx = options?.opDamageFx ?? null;
		const afterRaw = foundry.utils.getProperty(changes, isThreat ? HP_PATH : PV_PATH);
		const blockSignal = isThreat && ctx?.finalDamage === 0 && foundry.utils.getProperty(changes, `flags.${SYSTEM}.fxBlockAt`) !== undefined;
		if (afterRaw === undefined && !blockSignal) return;
		const before = options?.opFxBefore;
		const after = afterRaw ?? before;
		if (!(blockSignal || (Number.isFinite(before) && Number.isFinite(after) && after < before))) return;
		enqueue({ actor, before, after, max: options?.opFxMax ?? 0, ctx, isThreat });
	} catch (error) {
		console.warn("Ordem Paranormal | Animação de dano falhou:", error);
	}
});

// DF-27: movimento real do token durante a reação cancela o deslocamento visual; o Foundry assume a posição nova.
Hooks.on("updateToken", (doc, changes) => {
	if (("x" in changes || "y" in changes) && active.has(doc.id)) cancel(doc.id, { keepPosition: true });
});
Hooks.on("deleteToken", (doc) => cancel(doc.id));
Hooks.on("canvasTearDown", () => { for (const id of [...active.keys()]) cancel(id); queue = []; });
