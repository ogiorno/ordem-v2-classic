// Gera o conteúdo do suplemento Sobrevivendo ao Horror nos compêndios (_source) e o arquivo de dados
// que o script temporário do mundo aplica nos compêndios vivos.
//   node tools/sah/build.mjs            → atualiza packs/_source e escreve tools/sah/out/sah-ops.json
import fs from "node:fs";
import path from "node:path";
import { ORIGINS } from "./content-origins.mjs";
import { FIGHTER_POWERS, SPECIALIST_POWERS, OCCULTIST_POWERS, GENERAL_POWERS, PARANORMAL_POWERS } from "./content-powers.mjs";
import {
	MONSTRUOSO,
	MONSTRUOSO_COMMON,
	MONSTRUOSO_PRESENCE_FX,
	PATH_TEXT,
	PATH_ABILITY_PATCH,
	POSSUIDO_99,
	PATH_META,
	PATH_RENAME,
	SURVIVOR_CLASS_TEXT,
	SURVIVOR_ABILITIES,
	SURVIVOR_PATHS,
} from "./content-paths.mjs";
import { buildItems } from "./build-items.mjs";
import { ONUSE } from "./content-onuse.mjs";
import { PackSource, STATS, buildEffect, buildFolder, iconSlug, normalize, slug, stableId, toHtml } from "./lib.mjs";

const ops = []; // montado no fim: { pack, kind: "item"|"folder", id, data } (o script do mundo faz upsert)
const deleted = []; // documentos que saem dos compêndios: { pack, id }
const touched = new Map(); // "pack:id" -> { pack, kind }
const touch = (pack, id, kind = "item") => touched.set(`${pack}:${id}`, { pack, id, kind });
const report = { updated: 0, created: 0, missing: [] };
const packs = {};
const pack = (name) => (packs[name] ??= new PackSource(name));

const ICON_BASE = "systems/ordemparanormal/media/icons/abilities";

function withEffects(itemId, fxList) {
	return (fxList ?? []).map((fx) => buildEffect(itemId, fx));
}

function applyItem(packName, doc, patch, { effects } = {}) {
	const src = pack(packName);
	const json = doc.json;
	if (patch.name) json.name = patch.name;
	if (patch.img) json.img = patch.img;
	json.system = { ...json.system, ...patch.system };
	if (effects) json.effects = effects;
	json.effects ??= [];
	src.save(doc);
	touch(packName, json._id);
	report.updated++;
}

function createItem(packName, relDir, json) {
	const src = pack(packName);
	src.add(relDir, json);
	touch(packName, json._id);
	report.created++;
}

function createFolder(packName, relDir, json) {
	const src = pack(packName);
	src.add(relDir, json);
	touch(packName, json._id, "folder");
}

function abilitySystem(def, abilityType, extra = {}) {
	return {
		abilityType,
		preRequisite: def.pre ?? "",
		description: toHtml(def.text),
		activation: def.act ?? "passive",
		cost: def.cost ?? 0,
		costType: "PE",
		...extra,
	};
}

// ------------------------------------------------------------------ poderes de classe / gerais / paranormais
function upsertPowers(packName, abilityType, defs) {
	const src = pack(packName);
	for (const def of defs) {
		const doc = src.findItem(def.name, def.oldName);
		if (!doc) {
			report.missing.push(`${packName}: ${def.name}`);
			continue;
		}
		applyItem(packName, doc, { name: def.name, system: abilitySystem(def, abilityType) }, { effects: withEffects(doc.json._id, def.fx) });
	}
}

upsertPowers("fighterPowers", "class", FIGHTER_POWERS);
upsertPowers("specialistPowers", "class", SPECIALIST_POWERS);
upsertPowers("occultistPowers", "class", OCCULTIST_POWERS);
upsertPowers("generalPowers", "general", GENERAL_POWERS);
upsertPowers("paranormalPowers", "paranormal", PARANORMAL_POWERS);

// ------------------------------------------------------------------ origens e poderes de origem
{
	const origins = pack("origins");
	const powers = pack("originPowers");
	let folder = powers.folders.find((f) => normalize(f.json.name) === "sobrevivendoaohorror");
	if (!folder) {
		const json = buildFolder("originPowers", "Sobrevivendo ao Horror", null, { sort: 1000000 });
		createFolder("originPowers", "sobrevivendo-ao-horror", json);
		folder = powers.folders.find((f) => f.json._id === json._id);
	}
	touch("originPowers", folder.json._id, "folder");
	let sort = 0;
	for (const origin of ORIGINS) {
		const doc = origins.findItem(origin.name, origin.oldName);
		if (!doc) {
			report.missing.push(`origins: ${origin.name}`);
			continue;
		}
		const credit = origin.credit ? `<p><em>Origem da comunidade — ${origin.credit.replace(/&/g, "&amp;")}</em></p>` : "";
		const description =
			credit +
			`<p>${origin.narrative}</p>` +
			`<p><strong><em>Perícias treinadas.</em></strong> ${origin.skills}</p>` +
			`<p><strong><em>${origin.power.name}.</em></strong> ${toHtml(origin.power.text).replace(/^<p>/, "").replace(/<\/p>$/, "").replace(/<\/p><p>/g, "</p><p>")}</p>`;
		applyItem("origins", doc, { name: origin.name, system: { description, chatDescription: "" } });

		const powerDef = { text: origin.power.text, act: origin.power.act, cost: origin.power.cost };
		const existing = powers.findItem(origin.power.name);
		const id = existing?.json._id ?? stableId("originPower", origin.power.name);
		const system = abilitySystem(powerDef, "origin");
		const effects = withEffects(id, origin.power.fx);
		if (existing) {
			applyItem("originPowers", existing, { name: origin.power.name, system }, { effects });
		} else {
			sort += 1000;
			createItem("originPowers", "sobrevivendo-ao-horror", {
				name: origin.power.name,
				type: "ability",
				_id: id,
				img: `${ICON_BASE}/origin/${origin.power.icon}`,
				system: { id: 0, chatDescription: "", ...system },
				effects,
				folder: folder.json._id,
				sort,
				ownership: { default: 0 },
				flags: {},
				_stats: STATS(),
				_key: `!items!${id}`,
			});
		}
	}
}

// ------------------------------------------------------------------ trilhas (item "path") e habilidades de trilha
{
	const paths = pack("paths");
	for (const doc of paths.items) {
		if (!doc.file.includes("sobrevivendo-ao-horror")) continue;
		const key = doc.json.name.replace(/ - .*$/, "");
		const base = PATH_TEXT[key] ?? PATH_TEXT[doc.json.name];
		if (!base) continue;
		let text = base;
		const elem = /Monstruoso - (\w+)/.exec(doc.json.name)?.[1];
		if (elem) text = `${base}\n\nElemento desta trilha: ${elem}. As habilidades de NEX 10%, 40%, 65% e 99% descrevem os efeitos deste elemento.`;
		applyItem("paths", doc, { system: { description: toHtml(text) } });
	}

	// Monstruoso: uma habilidade por elemento e NEX.
	const ELEM_LABEL = { sangue: "Sangue", morte: "Morte", conhecimento: "Conhecimento", energia: "Energia" };
	const TIER_NAME = { 10: "Ser Amaldiçoado", 40: "Ser Macabro", 65: "Ser Assustador", 99: "Ser Aterrorizante" };
	const fighter = pack("pathFighter");
	for (const [elem, tiers] of Object.entries(MONSTRUOSO)) {
		for (const nex of [10, 40, 65, 99]) {
			const name = `NEX ${nex}% - ${TIER_NAME[nex]} (${ELEM_LABEL[elem]})`;
			const doc = fighter.findItem(name);
			if (!doc) {
				report.missing.push(`pathFighter: ${name}`);
				continue;
			}
			const tier = tiers[nex];
			const text = `${MONSTRUOSO_COMMON[nex]}\n\n${tier.text}`;
			const fx = [...(tier.fx ?? [])];
			if (nex === 65) fx.push(MONSTRUOSO_PRESENCE_FX);
			applyItem(
				"pathFighter",
				doc,
				{
					system: {
						description: toHtml(text),
						preRequisite: `Trilha: Monstruoso (${ELEM_LABEL[elem]})`,
						activation: tier.act ?? "passive",
						cost: tier.cost ?? 0,
					},
				},
				{ effects: withEffects(doc.json._id, fx) }
			);
		}
	}

	// Possuído NEX 99%: uma habilidade só, com as quatro opções (as variantes por elemento saem).
	{
		const occ = pack("pathOccultist");
		const variants = occ.items.filter((d) => /^NEX 99% - Tornamo-nos Um/.test(d.json.name));
		const keep = variants.find((d) => d.json.name === POSSUIDO_99.name) ?? variants.find((d) => /conhecimento/i.test(d.json.name));
		if (keep) {
			applyItem(
				"pathOccultist",
				keep,
				{
					name: POSSUIDO_99.name,
					system: { description: toHtml(POSSUIDO_99.text), preRequisite: "Trilha: Possuído", activation: POSSUIDO_99.act, cost: POSSUIDO_99.cost, abilityType: "path" },
				},
				{ effects: [] }
			);
			for (const d of variants.filter((x) => x !== keep)) {
				fs.unlinkSync(d.file);
				occ.docs.splice(occ.docs.indexOf(d), 1);
				deleted.push({ pack: "pathOccultist", id: d.json._id });
			}
		}
	}

	// Toda habilidade de trilha do suplemento é do tipo "path" (algumas vieram como "class" e caíam na aba errada da ficha).
	for (const packName of ["pathFighter", "pathSpecialist", "pathOccultist"]) {
		for (const doc of pack(packName).items) {
			if (!doc.file.includes("sobrevivendo-ao-horror")) continue;
			const renamed = PATH_RENAME[doc.json.name];
			const meta = PATH_META[renamed ?? doc.json.name];
			applyItem(packName, doc, { name: renamed, system: { abilityType: "path", ...(meta ? { activation: meta.act, cost: meta.cost } : {}) } });
		}
	}

	// Efeitos das demais habilidades de trilha.
	for (const packName of ["pathFighter", "pathSpecialist", "pathOccultist"]) {
		const src = pack(packName);
		for (const [name, patch] of Object.entries(PATH_ABILITY_PATCH)) {
			const doc = src.findItem(name);
			if (!doc) continue;
			applyItem(packName, doc, { system: {} }, { effects: withEffects(doc.json._id, patch.fx) });
		}
	}
}

// ------------------------------------------------------------------ Sobrevivente
{
	const classes = pack("classes");
	const cls = classes.findItem("Sobrevivente");
	if (cls) applyItem("classes", cls, { system: { description: SURVIVOR_CLASS_TEXT } });

	const paths = pack("paths");
	const shFolder = paths.folders.find((f) => f.json.name === "Sobrevivendo ao Horror" && f.json.folder === null);
	let survFolder = paths.folders.find((f) => f.json.name === "Sobrevivente" && f.json.folder === shFolder.json._id);
	if (!survFolder) {
		const json = buildFolder("paths", "Sobrevivente", shFolder.json._id, { sort: 0 });
		createFolder("paths", "sobrevivendo-ao-horror/sobrevivente", json);
		survFolder = paths.folders.find((f) => f.json._id === json._id);
	}
	touch("paths", survFolder.json._id, "folder");
	let sort = 0;
	for (const trail of SURVIVOR_PATHS) {
		sort += 100000;
		const existing = paths.findItem(trail.name);
		const id = existing?.json._id ?? stableId("survivorPath", trail.name);
		const system = { id: 0, description: toHtml(trail.text), chatDescription: "" };
		if (existing) applyItem("paths", existing, { system });
		else
			createItem("paths", "sobrevivendo-ao-horror/sobrevivente", {
				name: trail.name,
				type: "path",
				_id: id,
				img: `systems/ordemparanormal/media/icons/abilities/class/survivor/${iconSlug(trail.name)}.svg`,
				system,
				effects: [],
				folder: survFolder.json._id,
				sort,
				ownership: { default: 0 },
				flags: {},
				_stats: STATS(),
				_key: `!items!${id}`,
			});
	}

	// Habilidades de classe e de trilha no compêndio survivalPowers.
	const surv = pack("survivalPowers");
	const folderIds = {};
	let folderSort = 0;
	for (const trail of SURVIVOR_PATHS) {
		folderSort += 100000;
		let f = surv.folders.find((x) => x.json.name === trail.name);
		if (!f) {
			const json = buildFolder("survivalPowers", trail.name, null, { sort: folderSort });
			createFolder("survivalPowers", slug(trail.name), json);
			f = surv.folders.find((x) => x.json._id === json._id);
		}
		folderIds[trail.name] = f.json._id;
		touch("survivalPowers", f.json._id, "folder");
	}
	let itemSort = 0;
	for (const def of SURVIVOR_ABILITIES) {
		itemSort += 10000;
		const doc = surv.findItem(def.name, def.oldName);
		const id = doc?.json._id ?? stableId("survivalPower", def.name);
		const iconKey = def.iconKey ?? iconSlug(def.oldName ?? def.name.replace(/^Estágio \d - /, ""));
		const system = abilitySystem({ ...def, pre: def.kind === "path" ? `Trilha: ${def.path}` : "" }, "class");
		const effects = withEffects(id, def.fx);
		const folder = def.kind === "path" ? folderIds[def.path] : null;
		if (doc) {
			doc.json.folder = folder;
			doc.json.sort = itemSort;
			applyItem("survivalPowers", doc, { name: def.name, system }, { effects });
		} else {
			createItem("survivalPowers", def.kind === "path" ? slug(def.path) : "", {
				name: def.name,
				type: "ability",
				_id: id,
				img: `${ICON_BASE}/class/survivor/${iconKey}.svg`,
				system: { id: 0, chatDescription: "", ...system },
				effects,
				folder,
				sort: itemSort,
				ownership: { default: 0 },
				flags: {},
				_stats: STATS(),
				_key: `!items!${id}`,
			});
		}
	}
}

// ------------------------------------------------------------------ armas, equipamentos e itens amaldiçoados
buildItems({ pack, touch, createItem, createFolder, applyItem, withEffects, report });

// ------------------------------------------------------------------ efeitos do Livro que dependiam do NEX
// "+1 PV para cada 5% de NEX" passou a usar o Nível (o NEX é independente; nível 1 = 5%, 20 = 99%).
for (const [packName, name] of [["originPowers", "Calejado"], ["pathFighter", "NEX 10% - Casca Grossa"]]) {
	const doc = pack(packName).findItem(name);
	if (!doc) continue;
	let changed = false;
	for (const e of doc.json.effects ?? []) {
		for (const c of e.system?.changes ?? []) {
			if (c.value === "@NEX.value / 5") {
				c.value = "@nivel.value";
				changed = true;
			}
		}
	}
	if (changed) pack(packName).save(doc);
	touch(packName, doc.json._id);
}

// ------------------------------------------------------------------ opções da tela de ataque
for (const def of ONUSE) {
	const doc = pack(def.pack).findItem(def.item);
	if (!doc) {
		report.missing.push(`${def.pack}: ${def.item}`);
		continue;
	}
	const id = stableId("onuse", doc.json._id, def.effect);
	doc.json.effects = (doc.json.effects ?? []).filter((e) => e._id !== id);
	const effect = buildEffect(doc.json._id, { name: def.effect, key: "system.defense.value", value: 0 });
	effect._id = id;
	effect._key = `!items.effects!${doc.json._id}.${id}`;
	effect.system = { changes: [] };
	effect.disabled = true;
	effect.transfer = false;
	effect.description = def.description;
	effect.flags = { ordem_v2_classic: { onUse: def.onUse } };
	doc.json.effects.push(effect);
	pack(def.pack).save(doc);
	touch(def.pack, doc.json._id);
}

// ------------------------------------------------------------------ correções pontuais de texto
// Caractere de controle (hífen mole) que ficou no meio de palavras ao importar o livro, e um erro de digitação.
const TEXT_FIXES = [[/\u0002/g, ""], [/efeito que causa da mental/g, "efeito que causa dano mental"]];
for (const name of fs.readdirSync(path.join("systems/ordem_v2_classic/packs/_source"))) {
	if (name === "macros" || name === "bookrules") continue;
	const src = pack(name);
	for (const doc of src.items) {
		let changed = false;
		const sys = doc.json.system ?? {};
		for (const field of ["description", "chatDescription"]) {
			const before = sys[field];
			if (typeof before !== "string") continue;
			let after = before;
			for (const [re, rep] of TEXT_FIXES) after = after.replace(re, rep);
			if (after !== before) {
				sys[field] = after;
				changed = true;
			}
		}
		if (!changed) continue;
		src.save(doc);
		touch(name, doc.json._id);
	}
}

// Documentos que já tiveram o caractere de controle removido numa execução anterior (lista gerada do git).
const carry = "tools/sah/out/ctrl-fixed.txt";
if (fs.existsSync(carry)) {
	for (const rel of fs.readFileSync(carry, "utf8").split(/\r?\n/).filter(Boolean)) {
		const m = /packs\/_source\/([^/]+)\//.exec(rel);
		const file = path.join("systems/ordem_v2_classic", rel);
		if (!m || !fs.existsSync(file)) continue;
		const json = JSON.parse(fs.readFileSync(file, "utf8"));
		if (json._key?.startsWith("!items!")) touch(m[1], json._id);
	}
}

// ------------------------------------------------------------------ operações para o mundo (upsert)
const clean = (json) => {
	const data = structuredClone(json);
	delete data._key;
	delete data._stats;
	for (const e of data.effects ?? []) {
		delete e._key;
		delete e._stats;
	}
	return data;
};
for (const { pack: packName, id, kind } of touched.values()) {
	const src = pack(packName);
	const doc = (kind === "folder" ? src.folders : src.items).find((d) => d.json._id === id);
	if (!doc) throw new Error(`documento não encontrado: ${packName}:${id}`);
	if (kind === "item" && doc.json.type === "ability") {
		// campos numéricos que vieram como texto ("2", "") ou com id estranho no cadastro antigo
		const sys = doc.json.system;
		const cost = sys.cost === null || sys.cost === "" || sys.cost === undefined ? 0 : Number(sys.cost) || 0;
		if (sys.cost !== cost || typeof sys.id !== "number") {
			sys.cost = cost;
			sys.id = typeof sys.id === "number" ? sys.id : 0;
			src.save(doc);
		}
	}
	ops.push({ pack: packName, kind, id, data: clean(doc.json) });
}
// remoções ficam registradas em tools/sah/out/deleted.json para que uma nova execução também as repita
const deletedFile = "tools/sah/out/deleted.json";
const knownDeleted = fs.existsSync(deletedFile) ? JSON.parse(fs.readFileSync(deletedFile, "utf8")) : [];
for (const d of deleted) if (!knownDeleted.some((k) => k.id === d.id)) knownDeleted.push(d);
fs.mkdirSync("tools/sah/out", { recursive: true });
fs.writeFileSync(deletedFile, JSON.stringify(knownDeleted));
for (const d of knownDeleted) ops.push({ pack: d.pack, kind: "delete", id: d.id, data: {} });
// pastas antes dos itens
const order = { folder: 0, item: 1, delete: 2 };
ops.sort((a, b) => order[a.kind] - order[b.kind]);

fs.mkdirSync("tools/sah/out", { recursive: true });
fs.writeFileSync("tools/sah/out/sah-ops.json", JSON.stringify(ops));
console.log(`itens: ${report.updated} atualizados + ${report.created} criados | operações (upsert): ${ops.length}`);
if (report.missing.length) console.log("NÃO ENCONTRADOS:\n" + report.missing.join("\n"));
