// Dano, cura e recursos das habilidades de ameaça (lógica pura, sem Foundry).
// PV, SAN e PE são recursos distintos: um nunca substitui o outro. Tipo ausente ou desconhecido bloqueia.
import { damageForMode } from "./threat-ability-resistance.mjs";
import { resolveDamage } from "./threat-calc.mjs";

/** Nome escrito na ficha → chave de tipo de dano do sistema (system.resistances). */
const TYPE_ALIASES = Object.freeze({
	corte: "cuttingDamage", cutting: "cuttingDamage", cuttingdamage: "cuttingDamage",
	impacto: "impactDamage", impact: "impactDamage", impactdamage: "impactDamage",
	"perfuração": "piercingDamage", perfuracao: "piercingDamage", piercing: "piercingDamage", piercingdamage: "piercingDamage",
	"balístico": "ballisticDamage", balistico: "ballisticDamage", ballistic: "ballisticDamage", ballisticdamage: "ballisticDamage",
	sangue: "bloodDamage", blood: "bloodDamage", blooddamage: "bloodDamage",
	morte: "deathDamage", death: "deathDamage", deathdamage: "deathDamage",
	conhecimento: "knowledgeDamage", knowledge: "knowledgeDamage", knowledgedamage: "knowledgeDamage",
	energia: "energyDamage", energy: "energyDamage", energydamage: "energyDamage",
	medo: "fearDamage", fear: "fearDamage", feardamage: "fearDamage",
	fogo: "fireDamage", fire: "fireDamage", firedamage: "fireDamage",
	frio: "coldDamage", cold: "coldDamage", colddamage: "coldDamage",
	"elétrico": "eletricDamage", eletrico: "eletricDamage", "eletricidade": "eletricDamage", eletric: "eletricDamage", eletricdamage: "eletricDamage",
	"químico": "chemicalDamage", quimico: "chemicalDamage", chemical: "chemicalDamage", chemicaldamage: "chemicalDamage",
	mental: "mentalDamage", mentaldamage: "mentalDamage"
});

export const resolveDamageType = (name) => TYPE_ALIASES[String(name ?? "").trim().toLowerCase()] ?? null;

/** Recursos que cada tipo de ficha sabe alterar. Outro recurso exige aplicação manual. */
export const SUPPORTED_RESOURCES = Object.freeze({ agent: ["pv", "san", "pe"], threat: ["pv"] });

export const supportsResource = (actorType, resource) => (SUPPORTED_RESOURCES[actorType] ?? []).includes(resource);

/** Caminho do recurso na ficha. */
export function resourcePath(actorType, resource) {
	if (resource === "pv") return actorType === "threat" ? "system.attributes.hp" : "system.PV";
	if (resource === "san") return "system.SAN";
	if (resource === "pe") return "system.PE";
	return null;
}

const get = (obj, path) => path.split(".").slice(1).reduce((o, k) => o?.[k], obj);

/** Valida uma entrada de dano/cura configurada; devolve o motivo do bloqueio ou null. */
export function blockReason(entry) {
	if (!entry) return "no-entry";
	if (!entry.formula) return "missing-formula";
	if ((entry.kind ?? "damage") === "damage" && !resolveDamageType(entry.type)) return entry.type ? "unknown-type" : "missing-type";
	if (!["pv", "san", "pe"].includes(entry.resource ?? "pv")) return "unsupported-resource";
	return null;
}

/**
 * Efeito de uma entrada sobre um alvo, sem aplicar. `snapshot` = { type, system } do ator-alvo.
 * `rolled` = valor rolado; `mode` = full/half/negate vindo da resistência.
 */
export function previewChange({ entry, rolled, mode = "full", snapshot }) {
	const kind = entry.kind ?? "damage";
	const resource = entry.resource ?? "pv";
	const blocked = blockReason(entry);
	const base = { kind, resource, type: kind === "damage" ? resolveDamageType(entry.type) : null, rolled: Math.max(0, Math.floor(Number(rolled) || 0)), mode };
	if (blocked) return { ...base, supported: false, reason: blocked };
	if (!supportsResource(snapshot.type, resource)) return { ...base, supported: false, reason: "resource-unsupported-by-target" };
	const path = resourcePath(snapshot.type, resource);
	const res = get(snapshot.system, path);
	const before = Number(res?.value);
	const max = Number(res?.max);
	if (!Number.isFinite(before)) return { ...base, supported: false, reason: "resource-missing" };
	const afterSave = damageForMode(base.rolled, mode);

	if (kind === "heal") {
		const room = Number.isFinite(max) ? Math.max(0, max - before) : afterSave;
		const healed = Math.min(afterSave, room);
		return { ...base, supported: true, path, before, after: before + healed, finalDamage: 0, healed, capped: healed < afterSave, blockedByDefense: 0, multiplier: 1 };
	}

	// PV de ameaça/agente e SAN/PE seguem a mesma conta de defesas (RD/imunidade/vulnerabilidade do tipo).
	const defs = resolveDamage(afterSave, base.type, {
		resistances: snapshot.system.resistances ?? {},
		genericRd: snapshot.type === "threat" ? snapshot.system.genericRd : null,
		ignoreRd: entry.ignoreRd === true
	});
	return { ...base, supported: true, path, before, after: Math.max(0, before - defs.finalDamage), finalDamage: defs.finalDamage, healed: 0, capped: false, blockedByDefense: defs.blocked, multiplier: defs.multiplier, immune: defs.immune };
}

/** Rolagens por política: `once` reaproveita um valor para todos; `perTarget` rola de novo para cada alvo. */
export function assignRolls(entries, targetIds, rollFn) {
	const out = {};
	entries.forEach((entry, i) => {
		const shared = entry.roll === "perTarget" ? null : rollFn(entry, null);
		out[i] = Object.fromEntries(targetIds.map((id) => [id, entry.roll === "perTarget" ? rollFn(entry, id) : shared]));
	});
	return out;
}

/** Registro auditável de uma aplicação (fonte, alvo, valores antes/depois). */
export function auditRecord({ source, targetId, targetName, change, userId = null, at = null }) {
	return {
		source, targetId, targetName, userId, at,
		kind: change.kind, resource: change.resource, type: change.type, path: change.path ?? null,
		rolled: change.rolled, mode: change.mode,
		finalDamage: change.finalDamage, healed: change.healed, blockedByDefense: change.blockedByDefense,
		before: change.before, after: change.after, supported: change.supported, reason: change.reason ?? null
	};
}
