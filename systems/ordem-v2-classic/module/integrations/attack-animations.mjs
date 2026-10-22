/**
 * Animações dos ataques com arma (Sequencer + JB2A): corpo a corpo, tiro, rajada e arremesso.
 * O cartão do ataque guarda de quem para quem (`flags.ordem-v2-classic.attackAnim`); cada cliente toca a animação
 * localmente quando recebe a mensagem. Sem Sequencer/JB2A, ou com a opção desligada, nada acontece.
 */
const SYSTEM = "ordem-v2-classic";
export const ANIMATION_SETTING = "attackAnimations";

/** Efeitos por tipo de ataque, do preferido ao alternativo (o primeiro que existir no banco do Sequencer). */
export const ATTACK_EFFECTS = Object.freeze({
	melee: { kind: "at-target", files: ["jb2a.melee_generic.slash.01.orange", "jb2a.melee_generic.slash.02.001.blue", "jb2a.club.melee.01.white"] },
	shot: { kind: "stretch", files: ["jb2a.bullet.01.orange", "jb2a.bullet.02.orange"], shots: 1 },
	burst: { kind: "stretch", files: ["jb2a.bullet.02.orange", "jb2a.bullet.01.orange"], shots: 3 },
	throw: { kind: "stretch", files: ["jb2a.dagger.throw.01.white", "jb2a.arrow.physical.white.01"], shots: 1 },
	rocket: { kind: "stretch", files: ["jb2a.fireball.beam.orange", "jb2a.bullet.01.orange"], shots: 1 },
	flame: { kind: "stretch", files: ["jb2a.breath_weapons.fire.line.orange", "jb2a.fireball.beam.orange"], shots: 1 },
});

/** Espera depois que a janela de ataque fecha, para quem atacou ver a animação (ms). */
export const ANIMATION_HOLD_MS = 450;
const DIALOG_SELECTOR = ".op-attack-dialog";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Segura a animação até a janela de ataque sumir e mais um instante. */
export async function waitForDialogClose(hold = ANIMATION_HOLD_MS, limit = 3000) {
	const start = Date.now();
	while (document.querySelector(DIALOG_SELECTOR) && Date.now() - start < limit) await sleep(50);
	await sleep(hold);
}

export const pickFile = (kind, exists) => (ATTACK_EFFECTS[kind]?.files ?? []).find((file) => exists(file)) ?? null;

export async function playAttackAnimation(anim) {
	if (!game.modules.get("sequencer")?.active || typeof Sequence === "undefined") return false;
	const def = ATTACK_EFFECTS[anim?.kind];
	if (!def) return false;
	const from = (await fromUuid(anim.from))?.object;
	const to = (await fromUuid(anim.to))?.object;
	if (!from || !to || from.scene?.id !== canvas.scene?.id) return false;
	const file = pickFile(anim.kind, (path) => Sequencer.Database.entryExists(path));
	if (!file) return false;
	await waitForDialogClose();
	const sequence = new Sequence();
	if (def.kind === "at-target") {
		// o golpe vem de quem atacou e vai em direção ao alvo (a arte aponta para a frente: virada para o atacante e girada 180°)
		sequence.effect().file(file).atLocation(to).rotateTowards(from, { rotationOffset: 180 }).scaleToObject(1.4).randomRotation(false);
	} else {
		for (let i = 0; i < (def.shots ?? 1); i++) {
			const effect = sequence.effect().file(file).atLocation(from).stretchTo(to, { randomOffset: def.shots > 1 ? 0.6 : 0.2 });
			if (i > 0) effect.delay(120 * i);
		}
	}
	await sequence.play();
	return true;
}

Hooks.once("init", () => {
	game.settings.register(SYSTEM, ANIMATION_SETTING, {
		name: "Animações de ataque com arma",
		hint: "Toca a animação do golpe ou do tiro (Sequencer + JB2A) quando alguém ataca com uma arma. Vale só para este navegador.",
		scope: "client",
		config: true,
		type: Boolean,
		default: true,
	});
});

Hooks.on("createChatMessage", (message) => {
	const areaAnim = message.getFlag?.(SYSTEM, "areaAnim");
	if (areaAnim && game.settings.get(SYSTEM, ANIMATION_SETTING) && Date.now() - (message.timestamp ?? 0) <= 15000) {
		waitForDialogClose()
			.then(() => import("../helpers/weapon-area-visual.mjs"))
			.then(({ playAreaAnimation }) => playAreaAnimation(areaAnim))
			.catch((error) => console.warn("Ordem Paranormal | Animação da área falhou:", error));
	}
	const anim = message.getFlag?.(SYSTEM, "attackAnim");
	if (!anim || !game.settings.get(SYSTEM, ANIMATION_SETTING)) return;
	// só mensagens novas (não o histórico do chat ao abrir o mundo)
	if (Date.now() - (message.timestamp ?? 0) > 15000) return;
	playAttackAnimation(anim).catch((error) => console.warn("Ordem Paranormal | Animação de ataque falhou:", error));
});
