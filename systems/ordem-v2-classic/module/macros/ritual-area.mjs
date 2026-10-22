import { validateAreaPlacement } from "./ritual-targeting.mjs";

// Posicionamento da área de um ritual no mapa (Modelo Medido) e seleção dos tokens dentro dela.

const DEG = { cone: 90 };

/**
 * Os rituais trazem a área como texto livre ("esfera com 6m de raio", "cone de 4,5m", "9 cubos com 1,5m de lado").
 * Interpreta forma e tamanho; devolve null se o ritual não for de área ou o texto não der para entender.
 */
function parseArea(item) {
	const { target, area } = item.system;
	if (!/área/i.test(target ?? "") && !/área/i.test(area?.name ?? "")) return null;
	const text = `${area?.name ?? ""} ${target ?? ""}`.toLowerCase();
	const size = parseFloat((text.match(/([0-9]+(?:[.,][0-9]+)?) *m(?![a-zà-ú])/) ?? [])[1]?.replace(",", "."));
	if (!Number.isFinite(size) || size <= 0) return null;
	if (/cone/.test(text)) return { shape: "cone", size };
	if (/linha|raio de luz/.test(text) && !/de raio/.test(text)) return { shape: "line", size };
	if (/cubo|quadrad/.test(text)) return { shape: "cube", size };
	if (/raio|esfera|círculo|circulo|nuvem|explos|emana|área de/.test(text)) {
		return { shape: "sphere", size: /diâmetro|diametro/.test(text) ? size / 2 : size };
	}
	return null;
}

/** Modelo a partir da área definida numa regra (ritual-area-rules.mjs). Medidas em metros. */
function templateFromRule(area) {
	const base = { fillColor: game.user.color?.css ?? "#7d3fc4" };
	switch (area.shape) {
		case "cone": return { ...base, t: "cone", angle: DEG.cone, distance: area.distance };
		case "ray": return { ...base, t: "ray", distance: area.distance, width: area.width ?? canvas.dimensions.distance };
		case "rect": return { ...base, t: "rect", distance: area.distance * Math.SQRT2, direction: 45 }; // diagonal: o lado vale `distance`
		default: return { ...base, t: "circle", distance: area.distance };
	}
}

/**
 * Dados do modelo para o ritual, ou null se ele não for de área ou faltar forma/tamanho.
 * Com `rule`, a área vem da regra; uma regra sem `area` age só nos alvos marcados (null).
 */
export function areaTemplateData(item, rule = null) {
	if (rule) return rule.area ? templateFromRule(rule.area) : null;
	const parsed = parseArea(item);
	if (!parsed) return null;
	const base = { fillColor: game.user.color?.css ?? "#7d3fc4" };
	switch (parsed.shape) {
		case "cone": return { ...base, t: "cone", angle: DEG.cone, distance: parsed.size };
		case "line": return { ...base, t: "ray", distance: parsed.size, width: canvas.dimensions.distance };
		case "cube": return { ...base, t: "rect", distance: parsed.size * Math.SQRT2 }; // diagonal: o lado vale `size`
		default: return { ...base, t: "circle", distance: parsed.size };
	}
}

/**
 * Deixa o jogador posicionar a área: a prévia segue o mouse, clique esquerdo coloca,
 * roda do mouse gira, clique direito ou Esc cancela.
 * Devolve `{ template, tokenIds }` (tokens dentro da área, sem o conjurador) ou null se cancelou.
 */
export async function placeAreaTemplate(actor, item, rule = null, { range = null, banner = null } = {}) {
	const base = areaTemplateData(item, rule);
	if (!base || !canvas.scene) return null;
	const sourceToken = actor.getActiveTokens().find((token) => token.document.parent?.id === canvas.scene.id);
	const rect = canvas.dimensions.sceneRect;
	const start = sourceToken?.center ?? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	const doc = new CONFIG.MeasuredTemplate.documentClass(
		{ direction: 0, ...base, user: game.user.id, x: start.x, y: start.y },
		{ parent: canvas.scene },
	);
	const preview = new CONFIG.MeasuredTemplate.objectClass(doc);
	canvas.templates.preview.addChild(preview);
	await preview.draw();
	// Área centrada no conjurador (ex.: emanação, explosão pessoal): fica no lugar dele, sem clique.
	// Alcance pessoal com área (explosão, esfera ao redor de você) também nasce no conjurador, como no livro
	const atCaster = (rule?.area?.center === "caster" || range?.kind === "personal") && sourceToken;
	// Barra flutuante da mira (FC-41): ritual, custo e como confirmar ou cancelar; sai quando a área é colocada ou cancelada.
	let bannerNode = null;
	if (!atCaster) {
		canvas.templates.activate();
		if (banner) {
			bannerNode = document.createElement("div");
			bannerNode.className = "ritual-area-banner";
			bannerNode.setAttribute("role", "status");
			bannerNode.textContent = banner;
			document.body.appendChild(bannerNode);
		} else ui.notifications.info("Clique no mapa para colocar a área. Roda do mouse gira; botão direito ou Esc cancela.");
	}

	const canvasEl = canvas.app.canvas ?? canvas.app.view;
	const point = (event) => {
		// os eventos vêm do elemento do canvas, em captura: o clique vale mesmo em cima de um token
		const local = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
		return event.shiftKey ? local : canvas.templates.getSnappedPoint(local);
	};
	const redraw = () => {
		preview.renderFlags.set({ refreshShape: true, refreshPosition: true });
		preview.refresh?.();
	};

	const placed = atCaster || await new Promise((resolve) => {
		const finish = (result) => {
			canvasEl.removeEventListener("pointermove", onMove, true);
			canvasEl.removeEventListener("pointerdown", onDown, true);
			canvasEl.removeEventListener("wheel", onWheel, true);
			canvasEl.removeEventListener("contextmenu", onContext, true);
			document.removeEventListener("keydown", onKey, true);
			delete canvasEl.dataset.placingArea;
			bannerNode?.remove();
			resolve(result);
		};
		const onMove = (event) => {
			const p = point(event);
			doc.updateSource({ x: p.x, y: p.y });
			redraw();
		};
		const onDown = (event) => {
				if (event.button !== 0) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const clicked = point(event);
			doc.updateSource({ x: clicked.x, y: clicked.y });
			// o ponto escolhido precisa estar dentro do alcance do ritual
			if (range && sourceToken) {
				const size = canvas.grid.size;
				const x0 = Math.floor(sourceToken.document.x / size) * size;
				const y0 = Math.floor(sourceToken.document.y / size) * size;
				const caster = {
					x: x0, y: y0,
					w: Math.ceil((sourceToken.document.x + sourceToken.document.width * size - 1) / size) * size - x0,
					h: Math.ceil((sourceToken.document.y + sourceToken.document.height * size - 1) / size) * size - y0,
				};
				const check = validateAreaPlacement({ range, caster, point: { x: doc.x, y: doc.y }, pxPerMeter: canvas.dimensions.size / canvas.dimensions.distance });
					if (!check.ok) return ui.notifications.warn(check.reason);
			}
			finish(true);
		};
		const onWheel = (event) => {
			event.preventDefault();
			event.stopPropagation();
			const step = event.shiftKey ? 15 : 5;
			doc.updateSource({ direction: Math.normalizeDegrees(doc.direction + step * Math.sign(event.deltaY)) });
			redraw();
		};
		const onContext = (event) => {
			event.preventDefault();
			event.stopPropagation();
			finish(false);
		};
		const onKey = (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			finish(false);
		};
		canvasEl.addEventListener("pointermove", onMove, true);
		canvasEl.addEventListener("pointerdown", onDown, true);
		canvasEl.addEventListener("wheel", onWheel, { capture: true, passive: false });
		canvasEl.addEventListener("contextmenu", onContext, true);
		document.addEventListener("keydown", onKey, true);
		canvasEl.dataset.placingArea = "true"; // a mira está pronta para receber o clique (usado pelos testes ao vivo)
	});

	const data = doc.toObject();
	preview.destroy({ children: true });
	if (!placed) return null;
	const created = await createAreaRegion(data, { x: data.x, y: data.y }, item.name);
	const tokenIds = canvas.tokens.placeables
		.filter((token) => token.id !== sourceToken?.id && regionContains(created, token.center))
		.map((token) => token.id);
	return { template: created, tokenIds };
}

/* -------------------------------------------- */
/*  Região: a área persistente do ritual        */
/* -------------------------------------------- */

/**
 * No Foundry v14 o Modelo Medido é só um atalho legado (não guarda flags). A área que fica no mapa é uma Região,
 * então convertemos a forma do modelo (t, distance, direction, angle, width) para uma forma de Região, em pixels.
 */
export function regionShapeFromTemplate(data, origin) {
	const px = canvas.dimensions.distancePixels;
	const distance = data.distance * px;
	const direction = Math.toRadians(data.direction ?? 0);
	switch (data.t) {
		case "circle":
			return { type: "circle", x: origin.x, y: origin.y, radius: distance };
		case "rect": {
			// como o Modelo Medido: retângulo alinhado aos eixos cuja diagonal segue `direction`
			const dx = Math.cos(direction) * distance;
			const dy = Math.sin(direction) * distance;
			return { type: "rectangle", x: origin.x + Math.min(0, dx), y: origin.y + Math.min(0, dy), width: Math.abs(dx), height: Math.abs(dy), rotation: 0 };
		}
		case "cone": {
			const half = Math.toRadians((data.angle ?? 90) / 2);
			const points = [origin.x, origin.y];
			const steps = Math.max(6, Math.ceil((data.angle ?? 90) / 3));
			for (let i = 0; i <= steps; i++) {
				const a = direction - half + (2 * half * i) / steps;
				points.push(origin.x + Math.cos(a) * distance, origin.y + Math.sin(a) * distance);
			}
			return { type: "polygon", points };
		}
		default: { // ray
			const half = ((data.width ?? canvas.dimensions.distance) * px) / 2;
			const nx = -Math.sin(direction) * half;
			const ny = Math.cos(direction) * half;
			const ex = Math.cos(direction) * distance;
			const ey = Math.sin(direction) * distance;
			return { type: "polygon", points: [origin.x + nx, origin.y + ny, origin.x - nx, origin.y - ny, origin.x - nx + ex, origin.y - ny + ey, origin.x + nx + ex, origin.y + ny + ey] };
		}
	}
}

/** Cria a Região da área, visível para todos. `data` é o modelo (de `areaTemplateData` + posição/direção). */
export async function createAreaRegion(data, origin, name, flags = {}) {
	const [region] = await canvas.scene.createEmbeddedDocuments("Region", [{
		name,
		color: data.fillColor ?? game.user.color?.css ?? "#7d3fc4",
		shapes: [regionShapeFromTemplate(data, origin)],
		visibility: CONST.REGION_VISIBILITY.ALWAYS,
		flags,
	}]);
	return region;
}

/** O ponto (pixels) está dentro da Região? */
export function regionContains(region, point) {
	return !!region.polygonTree?.testPoint({ x: point.x, y: point.y });
}
