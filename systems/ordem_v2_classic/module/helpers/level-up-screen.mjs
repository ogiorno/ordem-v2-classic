/**
 * Tela de recompensa ao subir de Nível: mostra o que o personagem ganhou (PV/PE/PD/SAN, limite de PE por turno,
 * habilidades de classe e de trilha, e as escolhas que ele ainda precisa fazer). Regras em level-up-rules.mjs.
 */
import { featuresBetween, isLevelUp, costUnit, isPossessedPath, possessionGain, resourceGains, shouldShowLevelUp, visibleGains } from "./level-up-rules.mjs";
import { newAbilitiesBetween } from "./level-progression.mjs";
import { canAnimate, playLevelUpAnimation } from "./level-up-motion.mjs";
import { chooseGradeRaises, resolvePending, trainingView } from "./skill-training.mjs";

const RESOURCE_ICON = { PV: "fa-heart", PE: "fa-bolt", PD: "fa-shield-halved", SAN: "fa-brain", PP: "fa-ghost" };
const esc = (text) => foundry.utils.escapeHTML(String(text ?? ""));
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

let current = null;

function resourceCard({ key, before, after, gain }) {
	return `<div class="op-lu-stat op-lu-${key}">
		<i class="fa-solid ${RESOURCE_ICON[key]}"></i>
		<span class="op-lu-stat-gain" data-gain="${gain}">+${gain}</span>
		<span class="op-lu-stat-name">${esc(t(`op.levelUp.resource.${key}`))}</span>
		<span class="op-lu-stat-total" data-before="${before}" data-after="${after}">${before} → ${after}</span>
	</div>`;
}

function featureLine(level, feature, unit) {
	const text = t(`op.levelUp.feature.${feature.id}`, { ...feature.params, unit });
	const tag = feature.choice ? `<em class="op-lu-choice">${esc(t("op.levelUp.choose"))}</em>` : "";
	return `<li class="${feature.choice ? "is-choice" : ""}"><b>${esc(t("op.levelUp.levelShort", { level }))}</b> ${esc(text)} ${tag}</li>`;
}

function abilityLine(ability) {
	const title = ability.uuid
		? `<a class="content-link" data-uuid="${esc(ability.uuid)}">${esc(ability.name)}</a>`
		: esc(ability.name);
	return `<li class="op-lu-ability">
		<img src="${esc(ability.img)}" alt="">
		<div><b>${title}</b><p>${esc(ability.summary)}</p></div>
	</li>`;
}

/** Botão "Escolher ritual" / "Ver poderes" (GR-07): fecha a tela e abre o Grimório no personagem, já em "Para mim". */
function addGrimoireButton(el, actor) {
	const grimoire = game.ordemparanormal?.grimoire;
	if (!grimoire || !game.settings.get("ordem_v2_classic", "grimoireEnabled")) return;
	const isCaster = actor.itemTypes.ritual.length > 0 || /ocultista/i.test(actor.itemTypes.class?.[0]?.name ?? "");
	const button = document.createElement("button");
	button.type = "button";
	button.className = "op-lu-grimoire";
	button.innerHTML = `<i class="fa-solid fa-book-skull"></i> ${esc(t(isCaster ? "op.grimoire.levelUpRituals" : "op.grimoire.levelUpPowers"))}`;
	button.addEventListener("click", () => {
		closeLevelUp();
		grimoire.open({ actor, tab: isCaster ? "ritual" : "power", forMe: true });
	});
	el.querySelector("footer")?.prepend(button);
}

/** Botão "Escolher perícias": vagas novas (Intelecto), escolhas pendentes e Grau de Treinamento (NEX 35% e 70%). */
function addTrainingButton(el, actor) {
	const view = trainingView(actor);
	if (!view || !(view.hasPending || view.freeRaise)) return;
	const button = document.createElement("button");
	button.type = "button";
	button.className = "op-lu-grimoire op-lu-training";
	button.innerHTML = `<i class="fa-solid fa-graduation-cap"></i> Escolher perícias`;
	button.addEventListener("click", async () => {
		closeLevelUp();
		await resolvePending(actor);
		await chooseGradeRaises(actor);
	});
	el.querySelector("footer")?.prepend(button);
}

/** Monta o HTML da tela (separado para poder ser testado). */
export function buildLevelUpHTML({ name, img, from, to, gains, perRound, ppLimit, features, abilities, className, unit = "PE" }) {
	const multi = to - from > 1;
	const stats = gains.map(resourceCard).join("");
	const perRoundHtml = perRound
		? `<p class="op-lu-round"><i class="fa-solid fa-hourglass-half"></i> ${esc(t("op.levelUp.perRound", { label: perRound.label, value: perRound.value }))}</p>`
		: "";
	const ppHtml = ppLimit
		? `<p class="op-lu-round"><i class="fa-solid fa-ghost"></i> ${esc(t("op.levelUp.ppLimit", { value: ppLimit }))}</p>`
		: "";
	const featureHtml = features.flatMap(({ level, features: list }) => list.map((f) => featureLine(level, f, unit))).join("");
	const abilityHtml = abilities.map(abilityLine).join("");
	return `<div class="op-levelup-card" role="dialog" aria-modal="true" aria-label="${esc(t("op.levelUp.title"))}">
		<div class="op-lu-rays"></div>
		<div class="op-lu-flash"></div>
		<div class="op-lu-sparks"></div>
		<header class="op-lu-head">
			<span class="op-lu-kicker">${esc(t("op.levelUp.title"))}</span>
			<div class="op-lu-level">${multi ? `<small>${from} →</small> ` : ""}<span class="op-lu-level-num" data-from="${from}" data-to="${to}">${to}</span></div>
			<div class="op-lu-who"><img src="${esc(img)}" alt=""><div><b>${esc(name)}</b><span>${esc(className ?? "")}</span></div></div>
		</header>
		<div class="op-lu-body">
			${stats ? `<section><h3>${esc(t("op.levelUp.gains"))}</h3><div class="op-lu-stats">${stats}</div>${perRoundHtml}${ppHtml}</section>` : perRoundHtml}
			${abilityHtml ? `<section><h3>${esc(t("op.levelUp.abilities"))}</h3><ul class="op-lu-list">${abilityHtml}</ul></section>` : ""}
			${featureHtml ? `<section><h3>${esc(t("op.levelUp.features"))}</h3><ul class="op-lu-features">${featureHtml}</ul></section>` : ""}
			${!stats && !abilityHtml && !featureHtml ? `<p class="op-lu-empty">${esc(t("op.levelUp.nothing"))}</p>` : ""}
		</div>
		<footer><button type="button" class="op-lu-close"><i class="fa-solid fa-check"></i> ${esc(t("op.levelUp.continue"))}</button></footer>
	</div>`;
}

export function closeLevelUp() {
	if (!current) return;
	document.removeEventListener("keydown", current.onKey, true);
	current.el.classList.add("is-closing");
	const el = current.el;
	current = null;
	setTimeout(() => el.remove(), 250);
}

/**
 * Mostra a tela de recompensa.
 * @param {Actor} actor
 * @param {{from: number, to: number, before: Record<string, number>}} info níveis e máximos antes da mudança
 */
export async function showLevelUpScreen(actor, { from, to, before, withoutSanity = actor.usingWithoutSanityRule }) {
	if (!isLevelUp(from, to)) return null;
	closeLevelUp();
	const className = actor.itemTypes.class[0]?.name ?? "";
	const after = Object.fromEntries(["PV", "PE", "PD", "SAN"].map((k) => [k, actor.system[k]?.max ?? 0]));
	const gains = visibleGains(resourceGains(before, after), withoutSanity);
	// Pontos de possessão (PP): só a trilha Possuído, do Sobrevivendo ao Horror.
	const possessed = actor.itemTypes.path.some((p) => isPossessedPath(p.name));
	const pp = possessed ? possessionGain(from, to) : null;
	if (pp) gains.push(pp);
	const ppLimit = pp ? actor.system.attributes?.pre?.value : null;
	const perRoundKey = costUnit(withoutSanity);
	const perRoundValue = actor.system[perRoundKey]?.perRound;
	const perRoundBefore = actor.system._isSurvivor ? null : from;
	const perRound = perRoundValue && perRoundValue !== perRoundBefore
		? { label: t(`op.levelUp.resource.${perRoundKey}`), value: perRoundValue }
		: null;
	const abilities = await newAbilitiesBetween(actor, from, to);
	const features = actor.system._isSurvivor ? [] : featuresBetween(className, from, to, { possessed });

	const el = document.createElement("div");
	el.className = "op-levelup-overlay";
	el.innerHTML = buildLevelUpHTML({ name: actor.name, img: actor.img, from, to, gains, perRound, ppLimit, features, abilities, className, unit: costUnit(withoutSanity) });
	try {
		addGrimoireButton(el, actor);
		addTrainingButton(el, actor);
	} catch (error) {
		console.warn("Grimório: botão da tela de nível indisponível", error);
	}
	const animate = canAnimate();
	if (animate) el.classList.add("op-lu-motion");
	document.body.append(el);
	const player = animate ? playLevelUpAnimation(el) : null;
	// Clique no cartão pula a animação e mostra tudo na hora.
	el.querySelector(".op-levelup-card").addEventListener("click", () => player?.skip());
	const onKey = (event) => {
		if (event.key !== "Escape" && event.key !== "Enter") return;
		event.stopPropagation();
		closeLevelUp();
	};
	document.addEventListener("keydown", onKey, true);
	el.querySelector(".op-lu-close").addEventListener("click", closeLevelUp);
	el.addEventListener("click", (event) => {
		if (event.target === el) closeLevelUp();
	});
	el.querySelectorAll("a.content-link[data-uuid]").forEach((a) =>
		a.addEventListener("click", async (event) => {
			event.preventDefault();
			(await fromUuid(a.dataset.uuid))?.sheet?.render(true);
		}),
	);
	current = { el, onKey };
	requestAnimationFrame(() => el.classList.add("is-open"));
	el.querySelector(".op-lu-close").focus();
	return el;
}

export function registerLevelUpScreen() {
	// Guarda o nível anterior (os máximos antes já são guardados por level-progression.mjs em opMaxBefore).
	Hooks.on("preUpdateActor", (actor, changes, options) => {
		if (actor.type !== "agent") return;
		const nivel = changes?.system?.nivel?.value;
		const stage = changes?.system?.stage?.value;
		if (nivel === undefined && stage === undefined) return;
		options.opProgressBefore = actor.system._progress ?? actor.system.nivel.value;
	});

	Hooks.on("updateActor", (actor, changes, options, userId) => {
		if (actor.type !== "agent" || options.opProgressBefore === undefined) return;
		const from = options.opProgressBefore;
		const to = actor.system._progress;
		if (!isLevelUp(from, to)) return;
		const isGM = game.user.isGM;
		const isOwner = actor.testUserPermission(game.user, "OWNER");
		const activePlayerOwners = game.users.filter((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER")).length;
		if (!shouldShowLevelUp({ isGM, isOwner, isUpdater: userId === game.user.id, activePlayerOwners })) return;
		showLevelUpScreen(actor, { from, to, before: options.opMaxBefore ?? {} }).catch((err) =>
			console.error("Ordem Paranormal | Falha ao mostrar a tela de nível:", err),
		);
	});

	// Atalho para o Mestre rever a tela (ex.: macro: game.system.levelUp.preview(actor, 1, 4)).
	Hooks.once("ready", () => {
		game.system.levelUp = {
			preview: (actor, from, to) => {
				const after = Object.fromEntries(["PV", "PE", "PD", "SAN"].map((k) => [k, actor.system[k]?.max ?? 0]));
				const before = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, Math.max(0, v - Math.max(0, to - from) * 2)]));
				return showLevelUpScreen(actor, { from, to, before });
			},
			close: closeLevelUp,
		};
	});
}
