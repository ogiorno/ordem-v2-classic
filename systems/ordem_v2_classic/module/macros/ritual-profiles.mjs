// Perfil de fluxo de cada ritual (docs/arquivo/spec-fluxo-conjuracao-rapida.md, seção 3).
// Função pura: lê os campos do item e as regras de área e diz o que o jogador precisa decidir ao conjurar.
//
// Perfil principal (decide o fluxo):
//   PES  pessoal, sem alvo           ALI  buff num ser (ou numa arma/acessório de um ser), sem resistência
//   HOS  alvo hostil (resistência)   ARE  área no mapa      MAN  resolvido pelo Mestre (texto livre, objeto, ficção)
// Modificadores (acrescentam passos):
//   VAR variante (escolha de efeito)  RAP reação/ação livre  SUS sustentado
//   MED elemento Medo                 ADV forma Discente/Verdadeira

import { areaChoicesFor, areaRuleFor } from "./ritual-area-rules.mjs";
import { ritualRange, ritualTargets } from "./ritual-targeting.mjs";
import { isWeaponCurseRitual } from "../helpers/weapon-curse.mjs";

export const PROFILE = Object.freeze({ PERSONAL: "PES", ALLY: "ALI", HOSTILE: "HOS", AREA: "ARE", MANUAL: "MAN" });
export const MODIFIER = Object.freeze({ VARIANT: "VAR", QUICK: "RAP", SUSTAINED: "SUS", FEAR: "MED", ADVANCED: "ADV" });

export const PROFILE_LABELS = Object.freeze({
	PES: "Pessoal",
	ALI: "Buff em ser",
	HOS: "Alvo hostil",
	ARE: "Área",
	MAN: "Resolvido pelo Mestre",
});

const normalizeName = (name) => String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Rituais cujo efeito depende de ficção, objeto, destino no mapa ou texto livre: o sistema cobra e avisa,
 * o Mestre resolve (spec, seção 3.3). Os demais rituais sem automação seguem a regra geral.
 */
export const MANUAL_RITUALS = Object.freeze([
	"Chamas do Caos", "Dissipar Ritual", "Distorção Temporal", "Salto Fantasma", "Fim Inevitável", "Invólucro de Carne",
	"Vomitar Pestes", "Sopro do Caos", "Luz", "Convocação Instantânea", "Relembrar Fragmento", "Língua Morta",
	"Singularidade Temporal", "Coincidência Forçada", "Desacelerar Impacto", "Polarização Caótica",
]);
const MANUAL_SET = new Set(MANUAL_RITUALS.map(normalizeName));

const RESIST_SKILLS = ["resilience", "reflexes", "will"];

/** Modificadores de um ritual (independem da forma, exceto VAR que depende só do ritual). */
export function ritualModifiers(item) {
	const system = item?.system ?? {};
	const modifiers = [];
	if (areaChoicesFor(item)) modifiers.push(MODIFIER.VARIANT);
	if (["reaction", "free"].includes(system.execution)) modifiers.push(MODIFIER.QUICK);
	if (system.duration === "sustained") modifiers.push(MODIFIER.SUSTAINED);
	if (system.element === "fear") modifiers.push(MODIFIER.FEAR);
	if (system.studentForm || system.trueForm) modifiers.push(MODIFIER.ADVANCED);
	return modifiers;
}

/**
 * Classifica o ritual para uma forma (a forma pode mudar o perfil: Esfolar básico é um alvo, o Discente é uma explosão).
 * @param {object} item                    ritual (name, type?, system)
 * @param {object} [options]
 * @param {string} [options.formId]        "basic" | "student" | "true"
 * @param {string|null} [options.choiceId] escolha de efeito (Transfigurar Água/Terra)
 * @param {string} [options.formBody]      texto da forma, para "muda o alvo / o alcance"
 * @returns {{profile:string, modifiers:string[], intent:"self"|"ally"|"enemy"|"area"|"none", centered:boolean,
 *            multi:boolean, maxTargets:number|null, resisted:boolean, reason:string}}
 */
export function classifyRitual(item, { formId = "basic", choiceId = null, formBody = "" } = {}) {
	const system = item?.system ?? {};
	const modifiers = ritualModifiers(item);
	const range = ritualRange(item, formBody);
	const targets = ritualTargets(item, formBody);
	const resisted = RESIST_SKILLS.includes(system.skillResis);
	const base = { modifiers, resisted, maxTargets: targets.max, multi: targets.max === null || targets.max > 1 };
	const done = (profile, intent, reason, extra = {}) => ({ ...base, profile, intent, centered: false, reason, ...extra });

	if (MANUAL_SET.has(normalizeName(item?.name))) return done(PROFILE.MANUAL, "none", "ritual na lista de resolução manual");

	const rule = areaRuleFor(item, formId, choiceId);
	if (rule) {
		if (rule.area) {
			const centered = rule.area.center === "caster" || range.kind === "personal";
			return done(PROFILE.AREA, "area", "regra de área", { centered, multi: true, maxTargets: null });
		}
		if (rule.onCast) return done(PROFILE.HOSTILE, "enemy", "regra de dano sem área", { multi: Boolean(rule.chosen) || base.multi });
		return done(PROFILE.MANUAL, "none", "regra só com texto");
	}

	if (isWeaponCurseRitual(item)) return done(PROFILE.ALLY, "ally", "Amaldiçoar Arma: o alvo é quem empunha");

	if (targets.kind === "area") return done(PROFILE.MANUAL, "none", "área sem regra mapeada");
	if (targets.kind === "self" || (range.kind === "personal" && targets.kind !== "creature" && targets.kind !== "object")) {
		return done(PROFILE.PERSONAL, "self", "alvo é o conjurador", { maxTargets: 0, multi: false });
	}
	if (targets.kind === "object") {
		// arma e acessório são do ser que os empunha; outros objetos (e cadáveres) não são fichas no mapa
		return /arma|acess[oó]rio/i.test(targets.label)
			? done(PROFILE.ALLY, "ally", "arma ou acessório de um ser")
			: done(PROFILE.MANUAL, "none", "alvo é um objeto");
	}
	if (targets.kind === "creature") return resisted ? done(PROFILE.HOSTILE, "enemy", "ser com resistência") : done(PROFILE.ALLY, "ally", "ser sem resistência");
	// alvo "veja texto" ou vazio
	if (range.kind === "personal") return done(PROFILE.PERSONAL, "self", "alcance pessoal", { maxTargets: 0, multi: false });
	if (resisted) return done(PROFILE.HOSTILE, "enemy", "alvo no texto, com resistência", { maxTargets: 1, multi: false });
	return done(PROFILE.MANUAL, "none", "alvo só no texto");
}
