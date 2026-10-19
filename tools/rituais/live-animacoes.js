// Teste ao vivo das animações de rituais (rodar no navegador como Mestre, via `playwright-cli eval`).
// Uso: window.__animCircle = 1; depois eval deste arquivo (uma expressão async) -> JSON com um resultado por ritual.
// Para cada ritual do círculo: coloca o ritual num agente da arena, dispara o mesmo fluxo `aa.workflow` que a conjuração dispara
// e confere que (1) o Sequencer criou um efeito, (2) o arquivo é o do mapa, (3) o vídeo carregou e (4) o efeito está no token do conjurador.
(async () => {
	const circle = Number(window.__animCircle);
	const pause = (ms) => new Promise((r) => setTimeout(r, ms));
	const { openArena } = await import("/systems/ordem_v2_classic/module/macros/ritual-live-arena.mjs");
	const { ritualAnimationName } = await import("/systems/ordem_v2_classic/module/integrations/ritual-animations.mjs");
	const map = await (await fetch("/systems/ordem_v2_classic/module/macros/ritual-animation-map.json")).json();
	const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
	const byName = new Map(map.map((r) => [norm(r.name), r]));
	const pack = game.packs.get("world.biblioteca-de-rituais");
	const library = (await pack.getDocuments()).filter((d) => Number(d.system.circle) === circle).sort((a, b) => a.name.localeCompare(b.name, "pt"));
	const arena = await openArena({ agents: ["Agente NEX 50 — Ocultista"] });
	const results = [];
	try {
		const { actor, token } = arena.agents[0];
		const created = await actor.createEmbeddedDocuments("Item", library.map((d) => d.toObject()));
		for (const item of created) {
			const row = { name: item.name, circle, ok: false };
			const animationName = ritualAnimationName(item);
			const entry = byName.get(norm(animationName));
			row.mapped = Boolean(entry);
			try {
				await Sequencer.EffectManager.endAllEffects();
				const before = new Set(Sequencer.EffectManager.effects.map((e) => e.id));
				Hooks.callAll("aa.workflow", token, animationName === item.name ? item : item.clone({ name: animationName }), { targets: [] });
				let effect = null;
				for (let i = 0; i < 20 && !effect; i++) {
					await pause(150);
					effect = Sequencer.EffectManager.effects.find((e) => !before.has(e.id));
				}
				row.played = Boolean(effect);
				if (effect) {
					const file = String(effect.data?.file ?? "");
					row.file = file.split("/").pop();
					row.fileMatches = Boolean(entry) && file.includes(entry.assetName);
					for (let i = 0; i < 30 && !effect.ready; i++) await pause(150);
					const texture = effect.sprite?.texture ?? effect.spriteContainer?.children?.[0]?.texture;
					const video = texture?.baseTexture?.resource?.source;
					row.loaded = Boolean(effect.ready) && (!video || video.videoWidth > 0);
					const pos = effect.data?.source?.object ?? effect.data?.source;
					row.onCaster = pos?.id === token.id || pos?.document?.id === token.id || (pos?.x === token.center.x && pos?.y === token.center.y) || Boolean(effect.source);
					// o efeito faz fade-in: considera visível se em algum instante da primeira meia hora de segundo ele fica opaco no palco
					row.visible = false;
					for (let i = 0; i < 12 && !row.visible && !effect.isDestroyed; i++) {
						const sprite = effect.sprite ?? effect.spriteContainer;
						row.visible = Boolean(sprite) && sprite.worldAlpha > 0 && sprite.renderable !== false && effect.visible !== false;
						if (!row.visible) await pause(100);
					}
				}
				row.ok = row.mapped && row.played && row.fileMatches && row.loaded && row.visible;
			} catch (error) {
				row.error = String(error?.message ?? error);
			}
			results.push(row);
		}
	} finally {
		await Sequencer.EffectManager.endAllEffects();
		await arena.close();
	}
	return JSON.stringify({ circle, total: results.length, ok: results.filter((r) => r.ok).length, falhas: results.filter((r) => !r.ok), results: results.map((r) => [r.name, r.ok]) });
})()
