import { normalizeExecution } from "../helpers/threat-ability-execution.mjs";
import { CONE_ANGLE, areaGeometry, planAreaUse, rectCenter, validateTargets } from "../helpers/threat-ability-targeting.mjs";

// Seleção de alvos e prévia de área no mapa para habilidades de ameaça (T04).
// Só valida e mostra; não rola dado, não cobra recurso e não cria Região/Efeito.

const pxPerMeter = () => canvas.dimensions.size / canvas.dimensions.distance;

/** Retângulo alinhado à grade do token (mesma regra dos rituais). */
export function tokenRect(token) {
	const size = canvas.grid.size;
	const d = token.document;
	const x0 = Math.floor(d.x / size) * size;
	const y0 = Math.floor(d.y / size) * size;
	return {
		x: x0, y: y0,
		w: Math.ceil((d.x + d.width * size - 1) / size) * size - x0,
		h: Math.ceil((d.y + d.height * size - 1) / size) * size - y0
	};
}

const isDead = (token) => !!token.actor?.statuses?.has?.("dead") || (token.actor?.type === "threat" && token.actor?.system?.attributes?.hp?.value === 0);

export function candidateOf(token) {
	return { id: token.id, name: token.name, kind: token.actor?.type === "agent" ? "agent" : "threat", dead: isDead(token), ...tokenRect(token) };
}

const sourceTokenOf = (actor) => actor?.getActiveTokens?.().find((t) => t.document.parent?.id === canvas.scene?.id) ?? null;

function banner(text) {
	const node = document.createElement("div");
	node.className = "ritual-area-banner";
	node.setAttribute("role", "status");
	node.textContent = text;
	document.body.appendChild(node);
	return node;
}

function summarize(plan) {
	if (!plan?.hits) return "";
	return plan.hits.length
		? plan.hits.map((h) => `${h.name} (${Math.round(h.coverage * 100)}%, ${h.distance.toFixed(1)} m)`).join("; ")
		: "nenhum alvo atingido";
}

/**
 * Alvos pelos tokens marcados do usuário (tecla T). Devolve o resultado de validateTargets, sem efeitos.
 * `self` e execução sem cena caem direto no resultado puro (manual quando falta token).
 */
export function pickTargets({ actor, execution }) {
	const exec = normalizeExecution(execution);
	const source = sourceTokenOf(actor);
	const hasScene = !!canvas.scene && !!source;
	const selected = [...game.user.targets].map(candidateOf);
	const caster = source ? candidateOf(source) : null;
	const result = validateTargets({ targeting: exec?.targeting, caster, selected, pxPerMeter: hasScene ? pxPerMeter() : 1, hasScene });
	return { ...result, selected, casterId: caster?.id ?? null };
}

/**
 * Prévia de área: segue o mouse (ou a direção do mouse para formas a partir do conjurador), roda gira,
 * clique esquerdo confirma, clique direito/Esc cancela. Devolve o plano de planAreaUse.
 */
export async function placeAbilityArea({ actor, execution, bannerText = "" }) {
	const exec = normalizeExecution(execution);
	const source = sourceTokenOf(actor);
	if (!exec?.area || !canvas.scene || !source) {
		return planAreaUse({ targeting: exec?.targeting, area: exec?.area ?? {}, caster: null, pxPerMeter: 1, hasScene: false });
	}
	const ppm = pxPerMeter();
	const caster = candidateOf(source);
	const candidates = canvas.tokens.placeables.map(candidateOf);
	const fromCaster = exec.area.origin !== "point";
	const needsAim = ["line", "cone", "cube", "rect"].includes(exec.area.shape);

	const graphics = new PIXI.Graphics();
	canvas.interface.addChild(graphics);
	let node = null;
	let point = rectCenter(caster);
	let direction = 0;
	let offset = 0;
	let plan = planAreaUse({ targeting: exec.targeting, area: exec.area, caster, point: fromCaster ? null : point, direction, candidates, pxPerMeter: ppm });

	const draw = () => {
		graphics.clear();
		const origin = fromCaster ? rectCenter(caster) : point;
		const geometry = areaGeometry(exec.area, { origin, direction, pxPerMeter: ppm, casterRect: caster });
		const bad = !plan.ok && !plan.cancelled;
		graphics.lineStyle(2, bad ? 0xcc3333 : 0x7d3fc4, 0.9).beginFill(bad ? 0xcc3333 : 0x7d3fc4, 0.25);
		if (geometry.kind === "circle") graphics.drawCircle(geometry.cx, geometry.cy, geometry.r);
		else graphics.drawPolygon(geometry.points.flatMap((p) => [p.x, p.y]));
		graphics.endFill();
		graphics.lineStyle(3, 0xffd34d, 1);
		for (const h of plan.hits ?? []) {
			const c = candidates.find((x) => x.id === h.id);
			if (c) graphics.drawRect(c.x, c.y, c.w, c.h);
		}
		if (node) node.textContent = `${bannerText || "Clique para confirmar; roda gira; botão direito ou Esc cancela."} — ${plan.ok ? summarize(plan) : plan.problems?.[0] ?? ""}`;
	};

	const evaluate = () => {
		plan = planAreaUse({ targeting: exec.targeting, area: exec.area, caster, point: fromCaster ? null : point, direction, candidates, pxPerMeter: ppm });
		draw();
	};

	// Emanação do conjurador (sem direção a escolher): resolve sem pedir clique, mas ainda mostra o resultado.
	if (fromCaster && !needsAim) {
		evaluate();
		graphics.destroy();
		return plan;
	}

	canvas.templates.activate();
	node = banner(bannerText);
	const canvasEl = canvas.app.canvas ?? canvas.app.view;
	const local = (event) => canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
	const finalPlan = await new Promise((resolve) => {
		let tearHook = null;
		const finish = (result) => {
			if (tearHook !== null) Hooks.off("canvasTearDown", tearHook);
			canvasEl.removeEventListener("pointermove", onMove, true);
			canvasEl.removeEventListener("pointerdown", onDown, true);
			canvasEl.removeEventListener("wheel", onWheel, true);
			canvasEl.removeEventListener("contextmenu", onContext, true);
			document.removeEventListener("keydown", onKey, true);
			delete canvasEl.dataset.placingAbility;
			resolve(result);
		};
		const aim = (event) => {
			const p = local(event);
			if (fromCaster) {
				const c = rectCenter(caster);
				const raw = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
				direction = (((event.shiftKey ? raw : Math.round(raw / 15) * 15) + offset) % 360 + 360) % 360;
			} else {
				point = event.shiftKey ? p : canvas.templates.getSnappedPoint(p);
			}
		};
		const onMove = (event) => { aim(event); evaluate(); };
		const onDown = (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			aim(event);
			evaluate();
			if (!plan.ok) return ui.notifications.warn(plan.problems?.[0] ?? "Posição inválida.");
			finish(plan);
		};
		const onWheel = (event) => {
			event.preventDefault();
			event.stopPropagation();
			const step = (event.shiftKey ? 15 : 5) * Math.sign(event.deltaY);
			if (fromCaster) offset += step; else direction = (direction + step + 360) % 360;
			aim(event);
			evaluate();
		};
		const cancel = (event) => {
			event.preventDefault();
			event.stopPropagation();
			finish(planAreaUse({ targeting: exec.targeting, area: exec.area, caster, pxPerMeter: ppm, cancelled: true }));
		};
		const onContext = (event) => cancel(event);
		const onKey = (event) => { if (event.key === "Escape") cancel(event); };
		// trocar de cena (ou fechar o canvas) no meio da mira cancela sem efeitos
		tearHook = Hooks.on("canvasTearDown", () => finish(planAreaUse({ targeting: exec.targeting, area: exec.area, caster, pxPerMeter: ppm, cancelled: true })));
		canvasEl.addEventListener("pointermove", onMove, true);
		canvasEl.addEventListener("pointerdown", onDown, true);
		canvasEl.addEventListener("wheel", onWheel, { capture: true, passive: false });
		canvasEl.addEventListener("contextmenu", onContext, true);
		document.addEventListener("keydown", onKey, true);
		canvasEl.dataset.placingAbility = "true"; // mira pronta (usado pelos testes ao vivo)
		draw();
	});
	node?.remove();
	graphics.destroy();
	return finalPlan;
}

export { CONE_ANGLE };
