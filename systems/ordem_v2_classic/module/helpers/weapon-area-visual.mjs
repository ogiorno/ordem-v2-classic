/**
 * Parte visual das armas de área (Bazuca): escolher o ponto no mapa, mostrar o círculo da área e tocar a explosão.
 * Regras e contas ficam em weapon-area.mjs / weapon-area-resolve.mjs; ver docs/arquivo/spec-area-da-bazuca.md.
 */
const COLOR = 0xff9800;

/** Desenha um círculo (PIXI 7 ou 8) no gráfico dado. */
function drawCircle(graphics, x, y, radius, { fill = 0.18, line = 0.95 } = {}) {
	graphics.clear();
	if (typeof graphics.circle === "function") {
		graphics.circle(x, y, radius).fill({ color: COLOR, alpha: fill }).stroke({ width: 3, color: COLOR, alpha: line });
	} else {
		graphics.lineStyle(3, COLOR, line);
		graphics.beginFill(COLOR, fill);
		graphics.drawCircle(x, y, radius);
		graphics.endFill();
	}
}

/** Centro do quadrado do mapa que contém o ponto. */
const snap = (point) => {
	const center = canvas.grid.getCenterPoint?.(point) ?? point;
	return { x: center.x, y: center.y };
};

/**
 * Deixa o jogador clicar no mapa para escolher o centro da área (o círculo acompanha o mouse; Esc ou botão direito cancela).
 * @returns {Promise<{sceneId:string,x:number,y:number}|null>} ponto em pixels do mapa, no centro do quadrado
 */
export function pickAreaPoint({ radiusSquares = 2 } = {}) {
	return new Promise((resolve) => {
		if (!canvas?.ready || !canvas.scene) return resolve(null);
		const view = canvas.app.view;
		const graphics = new PIXI.Graphics();
		canvas.interface.addChild(graphics);
		const radius = radiusSquares * canvas.grid.size;
		const at = (event) => snap(canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY }));
		let done = false;
		const finish = (value) => {
			if (done) return;
			done = true;
			view.removeEventListener("pointermove", move, true);
			view.removeEventListener("pointerdown", down, true);
			window.removeEventListener("keydown", key, true);
			graphics.destroy();
			resolve(value);
		};
		function move(event) {
			const p = at(event);
			drawCircle(graphics, p.x, p.y, radius);
		}
		function down(event) {
			event.preventDefault();
			event.stopPropagation();
			finish(event.button === 0 ? { sceneId: canvas.scene.id, ...at(event) } : null);
		}
		function key(event) {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			finish(null);
		}
		view.addEventListener("pointermove", move, true);
		view.addEventListener("pointerdown", down, true);
		window.addEventListener("keydown", key, true);
		ui.notifications.info("Clique no mapa para escolher o centro da área (Esc cancela).");
	});
}

/** Mostra o círculo da área no mapa por alguns segundos e some devagar. */
export function flashArea({ x, y, radius }, ms = 3500) {
	if (!canvas?.ready) return;
	const graphics = new PIXI.Graphics();
	canvas.interface.addChild(graphics);
	drawCircle(graphics, x, y, radius, { fill: 0.22, line: 1 });
	const start = performance.now();
	const tick = () => {
		const t = (performance.now() - start) / ms;
		if (t >= 1 || graphics.destroyed) {
			canvas.app.ticker.remove(tick);
			if (!graphics.destroyed) graphics.destroy();
			return;
		}
		graphics.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
	};
	canvas.app.ticker.add(tick);
}

/** Tipos de efeito da explosão, do preferido ao alternativo. */
export const AREA_EFFECTS = Object.freeze({
	projectile: ["jb2a.fireball.beam.orange", "jb2a.bullet.01.orange"],
	explosion: ["jb2a.fireball.explosion.orange", "jb2a.explosion.01.orange"],
});

/**
 * Projétil (opcional), círculo da área e explosão no ponto. Cada cliente toca localmente.
 * @param {{ from?:string, withProjectile?:boolean, sceneId:string, center:{x:number,y:number}, radius:number }} anim posições em pixels do mapa
 */
export async function playAreaAnimation(anim) {
	if (!anim?.center || anim.sceneId !== canvas.scene?.id) return false;
	flashArea({ ...anim.center, radius: anim.radius });
	if (!game.modules.get("sequencer")?.active || typeof Sequence === "undefined") return true;
	const first = (list) => list.find((file) => Sequencer.Database.entryExists(file));
	const projectile = first(AREA_EFFECTS.projectile);
	const explosion = first(AREA_EFFECTS.explosion);
	const from = anim.from ? (await fromUuid(anim.from))?.object : null;
	const sequence = new Sequence();
	if (anim.withProjectile && projectile && from) sequence.effect().file(projectile).atLocation(from).stretchTo(anim.center).waitUntilFinished(-200);
	if (explosion) sequence.effect().file(explosion).atLocation(anim.center).size({ width: anim.radius * 2, height: anim.radius * 2 }, { gridUnits: false }).belowTokens(false);
	if (!sequence.sections?.length) return true;
	await sequence.play();
	return true;
}
