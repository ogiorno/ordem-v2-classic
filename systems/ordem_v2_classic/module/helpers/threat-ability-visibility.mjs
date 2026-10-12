// Permissão e visibilidade das habilidades de ameaça (lógica pura, sem Foundry).
// Contexto sempre explícito (usuário, ator, usuários ativos): nada de globais, para valer em Node.

/**
 * Quem pode executar e onde a execução roda.
 * - o Mestre ativo resolve localmente;
 * - outro Mestre ou o dono do ator pedem ao Mestre ativo (sem duplicar a resolução);
 * - sem Mestre ativo, ninguém resolve (os efeitos precisam de um Mestre para alterar fichas de outros donos).
 * `actor.testUserPermission(user, "OWNER")` decide o dono.
 */
export function executionAuthority({ user, actor, activeGmId }) {
	if (!user || !actor) return { allowed: false, reason: "missing-context" };
	if (!activeGmId) return { allowed: false, reason: "no-active-gm" };
	if (user.isGM) return user.id === activeGmId ? { allowed: true, mode: "local", resolver: activeGmId } : { allowed: true, mode: "delegate", resolver: activeGmId };
	if (actor.type !== "threat") return { allowed: false, reason: "not-a-threat" };
	if (actor.testUserPermission?.(user, "OWNER")) return { allowed: true, mode: "delegate", resolver: activeGmId };
	return { allowed: false, reason: "not-authorized" };
}

/** Só um Mestre resolve pedidos delegados, e só o Mestre ativo (evita dois Mestres executarem o mesmo pedido). */
export const mayResolveRequest = ({ user, activeGmId }) => !!user?.isGM && user.id === activeGmId;

/** Só o Mestre aplica o resultado no painel. */
export const mayApplyPanel = (user) => !!user?.isGM;

export const VISIBILITY = Object.freeze({ gm: 0, owner: 1, public: 2 });

/** O espectador vê um dado com este nível? `viewer` = { isGM, ownsTarget }. */
export function canSee(level, viewer) {
	if (viewer?.isGM) return true;
	if (level === "public") return true;
	if (level === "owner") return !!viewer?.ownsTarget;
	return false;
}

/** Nível mais restritivo entre dois (menor valor). */
const stricter = (a, b) => (VISIBILITY[a] <= VISIBILITY[b] ? a : b);

/** Padrão conservador: DT e Defesa só do Mestre; o resultado narrável é público. */
export function visibilityOf(execution) {
	return { dc: execution?.visibility?.dc ?? "gm", defense: execution?.visibility?.defense ?? "gm", result: execution?.visibility?.result ?? "public" };
}

/**
 * Modo de rolagem do chat: vale o mais restritivo entre o configurado pela habilidade para o resultado
 * e o da mesa (`rollMode` do core: publicroll | gmroll | blindroll | selfroll).
 */
export function resolveRollMode({ result = "public", tableMode = "publicroll" }) {
	const fromLevel = { gm: "gmroll", owner: "gmroll", public: "publicroll" }[result] ?? "gmroll";
	const order = ["publicroll", "gmroll", "blindroll", "selfroll"];
	return order.indexOf(tableMode) > order.indexOf(fromLevel) ? tableMode : fromLevel;
}

/** Destinatários de uma mensagem conforme o nível: Mestres, + donos do alvo se `owner`, todos se `public` (lista vazia = pública). */
export function recipients({ level, targetActor, users }) {
	if (level === "public") return [];
	const ids = new Set();
	for (const u of users ?? []) {
		if (u.isGM) ids.add(u.id);
		else if (level === "owner" && targetActor?.testUserPermission?.(u, "OWNER")) ids.add(u.id);
	}
	return [...ids];
}

/** Chaves que nunca podem aparecer em HTML, flags ou payload visíveis a jogadores. */
export const SECRET_KEYS = Object.freeze(["dc", "dt", "save", "saves", "rolled", "original", "edited", "finalDamage", "healed", "blockedByDefense", "records", "before", "after", "targetDefense", "baseDefense", "attempts", "total", "mode", "execution", "formula"]);

/** Procura chaves secretas em qualquer profundidade; devolve os caminhos achados. */
export function findSecrets(value, path = "") {
	const found = [];
	if (Array.isArray(value)) value.forEach((v, i) => found.push(...findSecrets(v, `${path}[${i}]`)));
	else if (value && typeof value === "object") {
		for (const [k, v] of Object.entries(value)) {
			const here = path ? `${path}.${k}` : k;
			if (SECRET_KEYS.includes(k)) found.push(here);
			found.push(...findSecrets(v, here));
		}
	}
	return found;
}

/** Remove as chaves secretas de um objeto (cópia). */
export function stripSecrets(value) {
	if (Array.isArray(value)) return value.map(stripSecrets);
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRET_KEYS.includes(k)).map(([k, v]) => [k, stripSecrets(v)]));
	return value;
}

/** O HTML público não pode trazer DT/Defesa ("DT 18", "Defesa 25"). */
export const htmlLeaks = (html) => /\b(DT|Defesa)\s*\d+/i.test(String(html ?? ""));

/**
 * Nota para o dono do agente atingido: só a mudança efetivamente aplicada à própria ficha (recurso e condições),
 * sem DT, rolagem do Mestre nem Defesa de terceiros.
 */
export function ownerNote({ itemName, row, level = "owner" }) {
	if (level === "gm") return null;
	const lines = [];
	for (const rec of row.applied?.records ?? []) {
		if (!rec.supported || rec.before === rec.after) continue;
		const unit = { pv: "PV", san: "SAN", pe: "PE" }[rec.resource] ?? rec.resource;
		lines.push(`${unit}: ${rec.before} → ${rec.after}`);
	}
	const conds = (row.effects ?? []).filter((e) => e.applies).map((e) => e.condition?.label).filter(Boolean);
	if (conds.length) lines.push(conds.join(", "));
	if (!lines.length) return null;
	return `${itemName}: ${lines.join("; ")}.`;
}
