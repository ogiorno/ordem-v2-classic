import { abilityUnlockLevel, findOriginPower, folderMatchesPath, nexToLevel, normalizeName, survivorClassStage } from "./level-progression-rules.mjs";

const SYSTEM = "ordem_v2_classic";
const PATH_PACKS = ["pathFighter", "pathSpecialist", "pathOccultist", "survivalPowers"];
const SURVIVOR_PACK = "survivalPowers";
const ORIGIN_PACK = "originPowers";
const MAX_KEYS = ["PV", "PE", "PD", "SAN"];

const _sources = (names) => names.map((n) => game.packs.get(`${SYSTEM}.${n}`)).filter(Boolean);
const grantedFlag = (item) => item.getFlag(SYSTEM, "granted");

/** Nomes das pastas do compêndio da raiz até a pasta dada (para casar "Monstruoso" + "Sangue"). */
function folderChain(folder) {
	const chain = [];
	for (let f = folder; f; f = f.folder) chain.unshift(f.name);
	return chain;
}

/** Habilidades de trilha (item "ability") dentro da pasta de compêndio com o nome da trilha. */
async function pathAbilityEntries(pathName) {
	const found = [];
	for (const pack of _sources(PATH_PACKS)) {
		const index = await pack.getIndex({ fields: ["folder", "type"] });
		const folderIds = new Set(pack.folders.filter((f) => folderMatchesPath(folderChain(f), pathName)).map((f) => f.id));
		if (!folderIds.size) continue;
		for (const entry of index) {
			if (entry.type !== "ability" || !folderIds.has(entry.folder)) continue;
			const level = abilityUnlockLevel(entry.name);
			if (level !== null) found.push({ pack, entry, level });
		}
	}
	return found;
}

/** Habilidades de classe do Sobrevivente (Empenho, Aumento de Atributo, Cicatrizado) e o estágio de cada uma. */
async function survivorClassEntries() {
	const pack = game.packs.get(`${SYSTEM}.${SURVIVOR_PACK}`);
	if (!pack) return [];
	const index = await pack.getIndex({ fields: ["folder", "type"] });
	return index
		.filter((entry) => entry.type === "ability" && !entry.folder)
		.map((entry) => ({ pack, entry, level: survivorClassStage(entry.name) }))
		.filter((e) => e.level !== null);
}

async function originPowerEntry(originItem) {
	const pack = game.packs.get(`${SYSTEM}.${ORIGIN_PACK}`);
	if (!pack) return null;
	const index = await pack.getIndex();
	const powerName = findOriginPower(originItem.name, originItem.system.description, index.map((e) => e.name));
	const entry = powerName ? index.find((e) => e.name === powerName) : null;
	return entry ? { pack, entry } : null;
}

/** Cria na ficha as habilidades ainda não possuídas (comparando pelo nome). */
async function grantEntries(actor, source, kind, entries) {
	const owned = new Set(actor.items.filter((i) => i.type === "ability").map((i) => normalizeName(i.name)));
	const toCreate = [];
	for (const { pack, entry, level } of entries) {
		if (owned.has(normalizeName(entry.name))) continue;
		const doc = await pack.getDocument(entry._id);
		if (!doc) continue;
		const data = doc.toObject();
		delete data._id;
		foundry.utils.setProperty(data, `flags.${SYSTEM}.granted`, { source: source.id, kind, level: level ?? null });
		toCreate.push(data);
		owned.add(normalizeName(entry.name));
	}
	if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate, { opAutoGrant: true });
	return toCreate.length;
}

/**
 * Sincroniza as habilidades de trilha com o Nível atual (ou o estágio, no Sobrevivente): concede as liberadas
 * e remove as ainda bloqueadas. O Sobrevivente também recebe as habilidades de classe do seu estágio.
 */
export async function syncPathAbilities(actor) {
	if (actor.type !== "agent") return;
	const nivel = actor.system._progress ?? actor.system.nivel.value;
	for (const path of actor.itemTypes.path) {
		const entries = (await pathAbilityEntries(path.name)).filter((e) => e.level <= nivel);
		await grantEntries(actor, path, "path", entries);
	}
	const cls = actor.itemTypes.class[0];
	if (actor.system._isSurvivor && cls) {
		const entries = (await survivorClassEntries()).filter((e) => e.level <= nivel);
		await grantEntries(actor, cls, "class", entries);
	}
	const locked = actor.items
		.filter((i) => {
			const g = grantedFlag(i);
			return ["path", "class"].includes(g?.kind) && g.level > nivel;
		})
		.map((i) => i.id);
	if (locked.length) await actor.deleteEmbeddedDocuments("Item", locked, { opAutoGrant: true });
}

async function removeGranted(actor, sourceId) {
	const ids = actor.items.filter((i) => grantedFlag(i)?.source === sourceId).map((i) => i.id);
	if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids, { opAutoGrant: true });
}

/**
 * Migração única: fichas antigas progrediam pelo NEX. Deriva o Nível do NEX
 * (somente quando o Nível ainda está no valor padrão 1).
 */
async function migrateNivelFromNex() {
	if (!game.user.isGM || game.settings.get(SYSTEM, "nivelMigratedFromNex")) return;
	for (const actor of game.actors) {
		if (actor.type !== "agent" || actor.system._isSurvivor) continue;
		const level = nexToLevel(actor.system.NEX.value);
		if (actor.system.nivel.value === 1 && level > 1) await actor.update({ "system.nivel.value": level });
	}
	await game.settings.set(SYSTEM, "nivelMigratedFromNex", true);
}

/**
 * Migração única: concede o que as regras já davam mas os compêndios não entregavam (poder de origem do
 * suplemento, habilidades da trilha Monstruoso, habilidades do Sobrevivente). Só adiciona o que falta.
 */
async function migrateAutoGrants() {
	if (!game.user.isGM || game.settings.get(SYSTEM, "autoGrantsMigrated")) return;
	for (const actor of game.actors) {
		if (actor.type !== "agent") continue;
		for (const origin of actor.itemTypes.origin) {
			const found = await originPowerEntry(origin);
			if (found) await grantEntries(actor, origin, "origin", [found]);
		}
		await syncPathAbilities(actor);
	}
	await game.settings.set(SYSTEM, "autoGrantsMigrated", true);
}

/** O nível (agentes) ou o estágio (sobreviventes) mudou nesta atualização? */
const progressChanged = (changes) => changes?.system?.nivel?.value !== undefined || changes?.system?.stage?.value !== undefined;

export function registerLevelProgressionHooks() {
	game.settings.register(SYSTEM, "autoGrantsMigrated", { scope: "world", config: false, type: Boolean, default: false });
	Hooks.once("ready", () => migrateAutoGrants().catch((err) => console.error("Ordem Paranormal | Migração de habilidades falhou:", err)));

	game.settings.register(SYSTEM, "nivelMigratedFromNex", {
		scope: "world",
		config: false,
		type: Boolean,
		default: false,
	});
	Hooks.once("ready", () => migrateNivelFromNex().catch((err) => console.error("Ordem Paranormal | Migração de nível falhou:", err)));

	Hooks.on("createItem", async (item, options, userId) => {
		const actor = item.parent;
		if (userId !== game.user.id || actor?.documentName !== "Actor" || actor.type !== "agent") return;
		if (options?.opAutoGrant) return;
		try {
			if (item.type === "origin") {
				const found = await originPowerEntry(item);
				if (found) await grantEntries(actor, item, "origin", [found]);
			} else if (item.type === "path" || item.type === "class") {
				await syncPathAbilities(actor);
			}
		} catch (err) {
			console.error("Ordem Paranormal | Falha ao conceder habilidades automáticas:", err);
		}
	});

	Hooks.on("deleteItem", async (item, options, userId) => {
		const actor = item.parent;
		if (userId !== game.user.id || actor?.documentName !== "Actor" || actor.type !== "agent") return;
		if (options?.opAutoGrant || !["origin", "path", "class"].includes(item.type)) return;
		await removeGranted(actor, item.id);
	});

	// Guarda os máximos antes da mudança de nível para somar o ganho aos valores atuais.
	Hooks.on("preUpdateActor", (actor, changes, options) => {
		if (actor.type !== "agent" || !progressChanged(changes)) return;
		options.opMaxBefore = Object.fromEntries(MAX_KEYS.map((k) => [k, actor.system[k]?.max ?? 0]));
	});

	Hooks.on("updateActor", async (actor, changes, options, userId) => {
		if (userId !== game.user.id || actor.type !== "agent") return;
		if (!progressChanged(changes)) return;
		try {
			const before = options.opMaxBefore;
			if (before) {
				const gains = {};
				for (const k of MAX_KEYS) {
					const delta = (actor.system[k]?.max ?? 0) - before[k];
					if (delta > 0) gains[`system.${k}.value`] = Math.min(actor.system[k].value + delta, actor.system[k].max);
				}
				// Descer de nível: o valor atual não pode passar do novo máximo.
				for (const k of MAX_KEYS) {
					const res = actor.system[k];
					if (res && res.max > 0 && res.value > res.max) gains[`system.${k}.value`] = res.max;
				}
				if (Object.keys(gains).length) await actor.update(gains);
			}
			await syncPathAbilities(actor);
		} catch (err) {
			console.error("Ordem Paranormal | Falha ao aplicar evolução de nível:", err);
		}
	});
}
