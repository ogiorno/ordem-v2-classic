// Regras puras do ritual Amaldiçoar Arma e da Resistência à Fraqueza (sem depender do Foundry, testável em Node).
// Especificação: docs/arquivo/spec-amaldicoar-arma.md

export const SYSTEM_ID = "ordem_v2_classic";

/** Elementos que têm versão do ritual e o tipo de dano que cada um causa. */
export const CURSE_ELEMENTS = Object.freeze({
	knowledge: { label: "Conhecimento", damageType: "knowledgeDamage" },
	energy: { label: "Energia", damageType: "energyDamage" },
	death: { label: "Morte", damageType: "deathDamage" },
	blood: { label: "Sangue", damageType: "bloodDamage" },
});

/** Dados de bônus por forma: básico +1d6, Discente +2d6, Verdadeiro +4d6. */
export const CURSE_DICE = Object.freeze({ basic: 1, student: 2, true: 4 });
export const CURSE_FORM_LABELS = Object.freeze({ basic: "Normal", student: "Discente", true: "Verdadeiro" });
export const CURSE_ICON = "icons/svg/sword.svg";
export const RESIST_ICON = "icons/svg/shield.svg";

const RITUAL_NAME = /^Amaldi[cç]oar Arma/i;

export function isWeaponCurseRitual(item) {
	return item?.type === "ritual" && RITUAL_NAME.test(String(item.name ?? ""));
}

/** Dados do bônus ({element, form, dice, formula, damageType, label}) ou null se elemento/forma não existem. */
export function curseSpec(element, form) {
	const info = CURSE_ELEMENTS[element];
	const dice = CURSE_DICE[form];
	if (!info || !dice) return null;
	return {
		element,
		form,
		dice,
		formula: `${dice}d6`,
		damageType: info.damageType,
		label: `Amaldiçoar Arma — ${CURSE_FORM_LABELS[form]} · ${info.label}`,
	};
}

/**
 * A que a maldição está ligada.
 *   weapon  uma arma corpo a corpo específica (`weaponId`)
 *   ammo    pacote de munição: vale para qualquer arma à distância
 *   any     alvo sem armas na ficha (ex.: ameaça): vale para qualquer ataque
 */
export const CURSE_SCOPES = Object.freeze(["weapon", "ammo", "any"]);

export function curseLink(scope, weaponId = null, weaponName = "") {
	if (!CURSE_SCOPES.includes(scope)) return null;
	if (scope === "weapon" && !weaponId) return null;
	return { scope, weaponId: scope === "weapon" ? weaponId : null, weaponName: weaponName || "" };
}

function linkLabel(link) {
	if (link.scope === "weapon") return link.weaponName || "arma";
	if (link.scope === "ammo") return "pacote de munição";
	return "qualquer arma";
}

/** Dados do Efeito Ativo que representa a arma amaldiçoada (vai para a tabela de efeitos da ficha). */
export function curseEffectData({ element, form, link, casterName = "", casterUuid = null, itemUuid = null, sceneId = null }) {
	const spec = curseSpec(element, form);
	if (!spec || !link) return null;
	const info = CURSE_ELEMENTS[element];
	return {
		name: `Arma Amaldiçoada (${info.label} · ${CURSE_FORM_LABELS[form]})`,
		img: CURSE_ICON,
		origin: itemUuid ?? casterUuid ?? null,
		description: `<p>${spec.label}: +${spec.formula} de dano de ${info.label} em ${linkLabel(link)} até o fim da cena.${casterName ? ` Conjurado por ${casterName}.` : ""}</p>`,
		changes: [],
		flags: {
			[SYSTEM_ID]: {
				weaponCurse: { element, form, dice: spec.dice, formula: spec.formula, damageType: spec.damageType, scope: link.scope, weaponId: link.weaponId, weaponName: link.weaponName, sceneId, casterName },
			},
		},
	};
}

/** Lê os dados da maldição de um efeito (ou null se não for um). Efeito desligado não conta. */
export function curseOf(effect) {
	if (!effect || effect.disabled) return null;
	const data = effect.flags?.[SYSTEM_ID]?.weaponCurse ?? effect.getFlag?.(SYSTEM_ID, "weaponCurse");
	if (!data || !CURSE_ELEMENTS[data.element] || !CURSE_DICE[data.form]) return null;
	return data;
}

/** A maldição vale para esta arma? `weapon` = { id, ranged }. */
export function curseMatchesWeapon(curse, weapon) {
	if (!curse || !weapon) return false;
	if (curse.scope === "any") return true;
	if (curse.scope === "ammo") return weapon.ranged === true;
	if (curse.scope === "weapon") return curse.weaponId === weapon.id;
	return false;
}

/** Todas as maldições ativas de uma lista de efeitos que valem para a arma. */
export function cursesForWeapon(effects, weapon) {
	const list = [];
	for (const effect of effects ?? []) {
		const curse = curseOf(effect);
		if (curse && curseMatchesWeapon(curse, weapon)) list.push({ effect, curse });
	}
	return list;
}

/** Efeitos que a nova maldição substitui: mesma ligação (arma, ou munição, ou qualquer). Não acumula. */
export function cursesReplacedBy(effects, link) {
	const list = [];
	for (const effect of effects ?? []) {
		const data = effect?.flags?.[SYSTEM_ID]?.weaponCurse ?? effect?.getFlag?.(SYSTEM_ID, "weaponCurse");
		if (!data) continue;
		if (data.scope === link.scope && (link.scope !== "weapon" || data.weaponId === link.weaponId)) list.push(effect);
	}
	return list;
}

/** Fórmula do dano do elemento. O crítico não dobra o dado do elemento (só os da arma). */
export function curseDamageFormula(curse) {
	return curse?.formula ?? null;
}

/* -------------------------------------------- */
/*  Resistência à fraqueza                      */
/* -------------------------------------------- */

/** Tipos de dano que podem ter vulnerabilidade/resistência de elemento. */
export const WEAKNESS_TYPES = Object.freeze(Object.values(CURSE_ELEMENTS).map((entry) => entry.damageType).concat(["fearDamage"]));

export function weaknessResistEffectData(damageType, { origin = null } = {}) {
	if (!WEAKNESS_TYPES.includes(damageType)) return null;
	const label = labelOfDamageType(damageType);
	return {
		name: `Resistência à Fraqueza (${label})`,
		img: RESIST_ICON,
		origin,
		description: `<p>Não sofre o dobro do dano de ${label}, mesmo tendo vulnerabilidade a ele.</p>`,
		changes: [],
		flags: { [SYSTEM_ID]: { weaknessResist: { damageType } } },
	};
}

export function labelOfDamageType(damageType) {
	const entry = Object.values(CURSE_ELEMENTS).find((info) => info.damageType === damageType);
	return entry?.label ?? (damageType === "fearDamage" ? "Medo" : String(damageType ?? ""));
}

/** O ser tem o efeito de resistência à fraqueza ligado para este tipo de dano? */
export function hasWeaknessResist(effects, damageType) {
	if (!damageType) return false;
	for (const effect of effects ?? []) {
		if (!effect || effect.disabled) continue;
		const data = effect.flags?.[SYSTEM_ID]?.weaknessResist ?? effect.getFlag?.(SYSTEM_ID, "weaknessResist");
		if (data?.damageType === damageType) return true;
	}
	return false;
}

/** Texto curto para o aviso de dano aplicado: vulnerabilidade que dobrou ou que a resistência à fraqueza impediu. */
export function vulnerabilityNote(result) {
	if (result?.vulnerabilityIgnored) return "resistência à fraqueza: não dobrou";
	if (result?.multiplier === 2) return "vulnerável: dobrou";
	return "";
}
