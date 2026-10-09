/**
 * Animação da tela de recompensa de nível, feita com a biblioteca Motion (lib/motion.min.js, global `Motion`).
 * Sem a biblioteca (ou com "reduzir movimento" ligado no sistema) a tela aparece direto com os valores finais.
 */

const SPARKS = 26;

/** A animação pode rodar? (Motion carregada e jogador sem "reduzir movimento"). */
export function canAnimate() {
	if (typeof globalThis.Motion?.animate !== "function") return false;
	return !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Conta de `from` até `to` num elemento de texto, com o formato dado. */
function countUp(Motion, el, from, to, { duration, delay = 0, format = (v) => String(v) }) {
	el.textContent = format(from);
	const control = Motion.animate(from, to, {
		duration,
		delay,
		ease: "easeOut",
		onUpdate: (value) => {
			el.textContent = format(Math.round(value));
		},
		onComplete: () => {
			el.textContent = format(to);
		},
	});
	// Pular a animação deve mostrar o valor final na hora, sem depender do callback da biblioteca.
	return {
		complete: () => {
			control.complete?.();
			el.textContent = format(to);
		},
	};
}

/** Faíscas douradas saindo do número do nível. */
function burst(Motion, container, count) {
	const controls = [];
	for (let i = 0; i < count; i++) {
		const spark = document.createElement("i");
		spark.className = "op-lu-spark";
		container.append(spark);
		const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
		const distance = 90 + Math.random() * 150;
		const size = 0.6 + Math.random() * 0.9;
		const control = Motion.animate(
			spark,
			{
				x: [0, Math.cos(angle) * distance],
				y: [0, Math.sin(angle) * distance + 30],
				scale: [size, 0],
				opacity: [1, 0],
			},
			{ duration: 0.9 + Math.random() * 0.7, delay: 0.25 + Math.random() * 0.1, ease: "easeOut" },
		);
		control.finished?.then(() => spark.remove()).catch(() => spark.remove());
		controls.push(control);
	}
	return controls;
}

/**
 * Prepara os elementos (escondidos) e toca a sequência. Chamar com o overlay já no DOM.
 * @param {HTMLElement} el overlay `.op-levelup-overlay`
 * @returns {{skip: () => void}} `skip()` termina tudo na hora (clique no cartão)
 */
export function playLevelUpAnimation(el) {
	const Motion = globalThis.Motion;
	const { animate, stagger } = Motion;
	const controls = [];
	const run = (...args) => {
		const c = animate(...args);
		controls.push(c);
		return c;
	};
	const spring = { type: "spring", stiffness: 260, damping: 18 };

	const card = el.querySelector(".op-levelup-card");
	const levelBox = el.querySelector(".op-lu-level");
	const levelNum = el.querySelector(".op-lu-level-num");
	const who = el.querySelector(".op-lu-who");
	const kicker = el.querySelector(".op-lu-kicker");
	const stats = [...el.querySelectorAll(".op-lu-stat")];
	const sections = [...el.querySelectorAll(".op-lu-body section")];
	const rows = [...el.querySelectorAll(".op-lu-ability, .op-lu-features li, .op-lu-round")];
	const footer = el.querySelector("footer");
	const flash = el.querySelector(".op-lu-flash");
	const sparks = el.querySelector(".op-lu-sparks");

	// 1. O cartão entra com mola.
	run(card, { opacity: [0, 1], scale: [0.8, 1], y: [30, 0] }, { ...spring, stiffness: 180, damping: 16 });
	if (kicker) run(kicker, { opacity: [0, 1], y: [-10, 0] }, { duration: 0.4, delay: 0.1 });

	// 2. O número do nível estoura e conta até o valor novo; clarão e faíscas acompanham.
	const from = Number(levelNum?.dataset.from);
	const to = Number(levelNum?.dataset.to);
	run(levelBox, { opacity: [0, 1], scale: [0.2, 1] }, { ...spring, delay: 0.25 });
	if (levelNum && Number.isFinite(from) && Number.isFinite(to)) controls.push(countUp(Motion, levelNum, from, to, { duration: 0.7, delay: 0.3 }));
	if (flash) run(flash, { opacity: [0.85, 0] }, { duration: 0.9, delay: 0.35, ease: "easeOut" });
	if (sparks) controls.push(...burst(Motion, sparks, SPARKS + Math.min(20, Math.max(0, to - from - 1) * 6)));
	if (who) run(who, { opacity: [0, 1], y: [10, 0] }, { duration: 0.45, delay: 0.55 });

	// 3. As seções e os cards de status entram em sequência; os números de cada card contam.
	let t = 0.8;
	run(sections, { opacity: [0, 1], y: [18, 0] }, { duration: 0.45, delay: stagger(0.22, { startDelay: t }) });
	run(stats, { opacity: [0, 1], scale: [0.6, 1], y: [16, 0] }, { ...spring, delay: stagger(0.12, { startDelay: t + 0.05 }) });
	stats.forEach((stat, i) => {
		const delay = t + 0.05 + i * 0.12;
		const gain = stat.querySelector(".op-lu-stat-gain");
		const total = stat.querySelector(".op-lu-stat-total");
		const g = Number(gain?.dataset.gain);
		if (gain && Number.isFinite(g)) controls.push(countUp(Motion, gain, 0, g, { duration: 0.8, delay: delay + 0.1, format: (v) => `+${v}` }));
		const b = Number(total?.dataset.before);
		const a = Number(total?.dataset.after);
		if (total && Number.isFinite(b) && Number.isFinite(a)) {
			controls.push(countUp(Motion, total, b, a, { duration: 0.8, delay: delay + 0.1, format: (v) => `${b} → ${v}` }));
		}
	});
	t += 0.25 + stats.length * 0.12;
	run(rows, { opacity: [0, 1], x: [-14, 0] }, { duration: 0.4, delay: stagger(0.09, { startDelay: t }) });
	t += rows.length * 0.09 + 0.2;

	// 4. O botão por último, com um pulso discreto.
	if (footer) run(footer, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: t });

	return {
		skip: () => controls.forEach((c) => c.complete?.()),
	};
}
