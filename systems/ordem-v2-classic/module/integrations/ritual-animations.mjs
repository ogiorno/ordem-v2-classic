const ELEMENT_COLORS = {
	blood: "#b3262d",
	death: "#6b6f7a",
	knowledge: "#c98a12",
	energy: "#3978e8",
	fear: "#4a4a4a",
};

const CURSE_LABELS = { knowledge: "Conhecimento", energy: "Energia", death: "Morte", blood: "Sangue" };

/** Nome sob o qual o ritual está no mapa de animações: Amaldiçoar Arma tem uma entrada por elemento. */
export function ritualAnimationName(item) {
	const name = String(item?.name ?? "");
	const label = CURSE_LABELS[item?.system?.element];
	return /^Amaldi[cç]oar Arma$/i.test(name) && label ? `${name} - ${label}` : name;
}

const MANAGED_FLAG = "ordemRitualLibrary";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** O Automated Animations recusa qualquer id que não seja UUID v4 e, ao recusar, não registra mais nenhuma configuração dele. */
export function isAutoAnimationsId(value) {
	return UUID_V4.test(String(value ?? ""));
}

/** Registers the JB2A casting visuals in Automated Animations without replacing other entries. */
export async function registerRitualAnimations() {
	if (!game.user.isGM || !game.modules.get("autoanimations")?.active) return;
	if (!game.settings.settings.has("autoanimations.aaAutorec-ontoken")) return;

	const response = await fetch(`systems/${game.system.id}/module/macros/ritual-animation-map.json`);
	if (!response.ok) throw new Error(`Não foi possível carregar o mapa de animações (${response.status}).`);
	const mapping = await response.json();
	if (!Array.isArray(mapping) || mapping.length === 0) throw new Error("O mapa de animações de rituais está vazio.");

	const currentOnToken = foundry.utils.deepClone(game.settings.get("autoanimations", "aaAutorec-ontoken") ?? []);
	const currentRange = foundry.utils.deepClone(game.settings.get("autoanimations", "aaAutorec-range") ?? []);
	const onToken = currentOnToken.filter((entry) => entry.metaData?.[MANAGED_FLAG] !== true);
	const range = currentRange.filter((entry) => {
		const isPreviousEletrocusaoMapping =
			entry.label === "Eletrocussão" &&
			entry.menu === "range" &&
			entry.primary?.video?.animation === "chainlightning";
		return entry.metaData?.[MANAGED_FLAG] !== true && !isPreviousEletrocusaoMapping;
	});
	const base = onToken.find((entry) => entry.menu === "ontoken" && entry.primary?.video);
	if (!base) throw new Error("Automated Animations não disponibilizou um modelo válido de efeito sobre o token.");
	const existingNames = new Set(onToken.map((entry) => normalizeName(entry.label)));
	const managed = [];

	for (const ritual of mapping) {
		const normalizedName = normalizeName(ritual.name);
		if (!ritual.name || !ritual.asset || existingNames.has(normalizedName)) continue;

		const entry = foundry.utils.deepClone(base);
		entry.id = crypto.randomUUID();
		entry.label = ritual.name;
		entry.menu = "ontoken";
		entry.metaData = { [MANAGED_FLAG]: true, element: ritual.element, source: "JB2A_DnD5e" };
		entry.primary.video = {
			dbSection: "static",
			menuType: "spell",
			animation: "curewounds",
			variant: "01",
			color: "blue",
			enableCustom: true,
			customPath: ritual.asset,
		};
		entry.primary.options = {
			...entry.primary.options,
			playOn: "source",
			elevation: 1000,
			delay: 0,
			fadeIn: 180,
			fadeOut: 300,
			size: 1.25,
			opacity: 1,
			tint: true,
			tintColor: ELEMENT_COLORS[ritual.element] ?? ELEMENT_COLORS.fear,
		};
		managed.push(entry);
		existingNames.add(normalizedName);
	}

	const migratedEletrocusao = range.length !== currentRange.length;
	// só regrava quando falta vínculo ou algum registro antigo tem id inválido, para não reescrever a configuração a cada carga
	const previous = currentOnToken.filter((entry) => entry.metaData?.[MANAGED_FLAG] === true);
	const needsWrite = previous.length !== managed.length || previous.some((entry) => !isAutoAnimationsId(entry.id));
	if ((managed.length && needsWrite) || migratedEletrocusao) {
		await game.settings.set("autoanimations", "aaAutorec-ontoken", [...onToken, ...managed]);
		if (migratedEletrocusao) await game.settings.set("autoanimations", "aaAutorec-range", range);
	}
	console.info(`Ordem Paranormal | ${managed.length} animações de rituais vinculadas ao JB2A.`);
	if (managed.length && needsWrite) ui.notifications.info(`${managed.length} animações de rituais foram vinculadas à biblioteca JB2A.`);
}

function normalizeName(value) {
	return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}
