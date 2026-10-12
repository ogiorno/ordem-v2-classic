// Carrega os compêndios no índice do Grimório (uma vez, em memória). Depende do Foundry (`game.packs`).
// Rituais: pacote do sistema `rituals`; enquanto ele não estiver registrado, o compêndio do mundo `biblioteca-de-rituais`.
// Perícias: diário "Perícias" do pacote bookrules.
// Poderes: pacotes *Powers, generalPowers, paranormalPowers e path*. Condições: diário "Condições" do pacote bookrules.
import { NON_SKILL_PAGES, conditionEntry, curseEntry, powerEntry, ritualEntry, skillEntry } from "./grimoire-index.mjs";
import { STATUS_TO_CONDITION } from "./grimoire-conditions.mjs";

const SYSTEM = "ordem_v2_classic";
export const POWER_PACKS = ["fighterPowers", "specialistPowers", "occultistPowers", "survivalPowers", "originPowers", "generalPowers", "paranormalPowers", "pathFighter", "pathSpecialist", "pathOccultist"];
const RITUAL_PACKS = [`${SYSTEM}.rituals`, "world.biblioteca-de-rituais"];

let cache = null;
let loading = null;

/** Descarta o índice (um item de compêndio mudou); o próximo `loadGrimoireIndex` refaz. */
export function invalidateGrimoireIndex() {
	cache = null;
	loading = null;
}

/** Quais compêndios entram no Grimório (para o aviso de "pacote ainda não registrado"). */
export function grimoirePackIds() {
	return { rituals: RITUAL_PACKS.find((id) => game.packs.get(id)) ?? null, powers: POWER_PACKS.map((n) => `${SYSTEM}.${n}`).filter((id) => game.packs.get(id)), conditions: game.packs.get(`${SYSTEM}.bookrules`) ? `${SYSTEM}.bookrules` : null, curses: game.packs.get(`${SYSTEM}.curses`) ? `${SYSTEM}.curses` : null };
}

function conditionIcon(name) {
	const status = Object.entries(STATUS_TO_CONDITION).find(([, n]) => n === name)?.[0];
	if (!status) return null;
	return CONFIG.statusEffects?.find((s) => s.id === status)?.img ?? null;
}

const asDoc = (d) => ({ uuid: d.uuid, name: d.name, img: d.img, system: d.system, flags: d.flags });

async function loadRituals() {
	const id = RITUAL_PACKS.find((p) => game.packs.get(p));
	if (!id) return [];
	const docs = await game.packs.get(id).getDocuments();
	const seen = new Set();
	return docs.filter((d) => d.type === "ritual" && !seen.has(d.name) && seen.add(d.name)).map((d) => ritualEntry(asDoc(d)));
}

async function loadPowers() {
	const out = [];
	for (const name of POWER_PACKS) {
		const pack = game.packs.get(`${SYSTEM}.${name}`);
		if (!pack) continue;
		const docs = await pack.getDocuments();
		for (const d of docs) if (d.type === "ability") out.push(powerEntry(asDoc(d), { pack: name, folderName: d.folder?.name ?? null }));
	}
	return out;
}

async function loadConditions() {
	const pack = game.packs.get(`${SYSTEM}.bookrules`);
	if (!pack) return [];
	const index = await pack.getIndex();
	const found = index.find((e) => e.name === "Condições");
	if (!found) return [];
	const journal = await pack.getDocument(found._id);
	return journal.pages.contents.map((p) => conditionEntry({ uuid: p.uuid, name: p.name, text: p.text }, { img: conditionIcon(p.name) }));
}

async function loadSkills() {
	const pack = game.packs.get(`${SYSTEM}.bookrules`);
	if (!pack) return [];
	const found = (await pack.getIndex()).find((e) => e.name === "Perícias");
	if (!found) return [];
	const journal = await pack.getDocument(found._id);
	return journal.pages.contents.filter((p) => !NON_SKILL_PAGES.includes(p.name) && p.text?.content).map((p) => skillEntry({ uuid: p.uuid, name: p.name, text: p.text }));
}

async function loadCurses() {
	const pack = game.packs.get(`${SYSTEM}.curses`);
	if (!pack) return [];
	const docs = await pack.getDocuments();
	return docs.filter((d) => d.type === "curse").map((d) => curseEntry(asDoc(d)));
}

/** @returns {Promise<object[]>} todas as entradas (rituais, poderes e condições) */
export async function loadGrimoireIndex() {
	if (cache) return cache;
	if (!loading) {
		loading = Promise.all([loadRituals(), loadPowers(), loadConditions(), loadSkills(), loadCurses()]).then(([r, p, c, s, m]) => (cache = [...r, ...p, ...c, ...s, ...m]));
		loading.catch(() => { loading = null; });
	}
	return loading;
}
