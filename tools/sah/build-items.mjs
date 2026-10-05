// Parte do gerador que cuida de armas, equipamentos, catalisadores, itens amaldiçoados e modificações.
import fs from "node:fs";
import path from "node:path";
import { WEAPONS, GENERAL_ITEMS, CATALYST_INTRO, CATALYST_KINDS, CATALYST_ELEMENTS, CATALYST_EXPLAIN, MODIFICATIONS, CURSED } from "./content-items.mjs";
import { STATS, buildFolder, normalize, stableId, toHtml, slug } from "./lib.mjs";

const EQUIP_ICON = "systems/ordemparanormal/media/icons/equipments";
const MEMBRANA_LIVRO =
	"Um dispositivo complexo, composto por diversos medidores — de temperatura, campo magnético, dilatação temporal… Um agente treinado em Ocultismo pode usar o medidor para avaliar o estado da Membrana em uma área (veja a página 97), o que indica a chance de uma entidade se manifestar nela. Um ambiente com valores racionais e constantes ao longo de algumas horas dificilmente originará uma criatura ou manifestação perigosa. Porém, se as leituras apresentarem dados inexplicáveis ou com grandes variações, o lugar poderá conter uma entidade. Apesar de ser um bom indicativo, o medidor não fornece respostas definitivas, já que um ambiente com a Membrana danificada ainda pode não ter sido afetado por manifestações, assim como um lugar com a Membrana protegida por conter uma criatura poderosa vinda de outro lugar.";

const CURSED_ICON = {
	Sangue: "paranormal/amarras-de-sangue.svg",
	Morte: "paranormal/amarras-de-morte.svg",
	Conhecimento: "paranormal/amarras-de-conhecimento.svg",
	Energia: "paranormal/amarras-de-energia.svg",
	Medo: "paranormal/escuta-de-pulsos-paranormais.svg",
};
const CURSED_ICON_BY_NAME = {
	"Câmera Obscura": "paranormal/camera-de-aura-paranormal.svg",
	"Projétil de Lodo, curto": "ammunition/balas-curtas.svg",
	"Projétil de Lodo, longo": "ammunition/balas-longas.svg",
	"Pé de Morto": "paranormal/pe-de-morto.svg",
};

function mergeDeep(target, source) {
	for (const [k, v] of Object.entries(source)) {
		if (v && typeof v === "object" && !Array.isArray(v)) target[k] = mergeDeep(target[k] && typeof target[k] === "object" ? target[k] : {}, v);
		else target[k] = v;
	}
	return target;
}

export function buildItems(ctx) {
	const { pack, touch, createItem, createFolder, applyItem, withEffects, report } = ctx;

	// -------------------------------------------------------------- armas
	const arms = pack("armaments");
	for (const def of WEAPONS) {
		const doc = arms.findItem(def.name);
		if (!doc) {
			report.missing.push(`armaments: ${def.name}`);
			continue;
		}
		const f = def.fix;
		applyItem("armaments", doc, {
			system: {
				description: toHtml(def.text),
				category: f.cat,
				weight: f.w,
				critical: f.crit,
				range: f.range,
				formulas: mergeDeep(structuredClone(doc.json.system.formulas), { damage: { formula: f.dmg, type: f.dtype } }),
			},
		});
	}

	// -------------------------------------------------------------- equipamentos gerais
	const gen = pack("general");
	const sahRoot = gen.folders.find((d) => d.json.name === "Sobrevivendo ao Horror" && d.json.folder === null);
	const livroRoot = gen.folders.find((d) => d.json.name === "Livro de Regras" && d.json.folder === null);
	const sahFolder = (name) => gen.folders.find((d) => d.json.folder === sahRoot.json._id && normalize(d.json.name) === normalize(name));
	const livroFolder = (name) => gen.folders.find((d) => d.json.folder === livroRoot.json._id && normalize(d.json.name) === normalize(name));
	const folderIdFor = (key) => {
		if (key === "medicamentos") return gen.folders.find((d) => normalize(d.json.name) === "medicamentos" && gen.folders.some((p) => p.json._id === d.json.folder && p.json.folder === sahRoot.json._id))?.json._id;
		const map = { "acess-rios": "Acessórios", explosivos: "Explosivos", "itens-operacionais": "Itens Operacionais", "itens-paranormais": "Itens Paranormais" };
		return sahFolder(map[key])?.json._id;
	};

	function moveDoc(packName, doc, newFolderId, relDir) {
		const src = pack(packName);
		doc.json.folder = newFolderId;
		const dir = path.join(src.dir, relDir);
		fs.mkdirSync(dir, { recursive: true });
		const newFile = path.join(dir, path.basename(doc.file));
		if (newFile !== doc.file) {
			fs.unlinkSync(doc.file);
			doc.file = newFile;
		}
		src.save(doc);
	}

	for (const def of GENERAL_ITEMS) {
		const doc = gen.findItem(def.name, def.oldName);
		if (!doc) {
			report.missing.push(`general: ${def.name}`);
			continue;
		}
		const system = { description: toHtml(def.text), chatDescription: "", category: def.cat, weight: def.w };
		const effects = withEffects(doc.json._id, def.fx);
		if (def.name === "Medidor de Condição Vertebral") moveDoc("general", doc, folderIdFor("itens-paranormais"), "sobrevivendo-ao-horror/itens-paranormais");
		applyItem("general", doc, { name: def.name, system }, { effects });
	}

	// "Medidor de Estabilidade da Membrana" é item do Livro de Regras (p. 67): estava como texto provisório no suplemento.
	{
		const doc = gen.findItem("Medidor de Estabilidade da Membrana");
		if (doc) {
			moveDoc("general", doc, livroFolder("Itens Paranormais").json._id, "livro-de-regras/itens-paranormais");
			applyItem("general", doc, { system: { description: toHtml(MEMBRANA_LIVRO), chatDescription: "", category: 2, weight: 1 } }, { effects: [] });
		}
	}

	// -------------------------------------------------------------- catalisadores
	for (const [elem, info] of Object.entries(CATALYST_ELEMENTS)) {
		for (const kind of CATALYST_KINDS) {
			const doc = gen.findItem(`${kind.name} de ${elem}`, `${kind.oldName ?? kind.name} de ${elem}`);
			if (!doc) {
				report.missing.push(`general: ${kind.name} de ${elem}`);
				continue;
			}
			const text = `Catalisador ritualístico de ${elem} — ${kind.name}. ${CATALYST_INTRO}\n\n${kind.name}: ${kind.text}\n\n${CATALYST_EXPLAIN}\n\n${elem}. ${info.text}`;
			applyItem("general", doc, { name: `${kind.name} de ${elem}`, system: { description: toHtml(text), chatDescription: "", category: 1, weight: 0.5 } }, { effects: [] });
		}
	}

	// -------------------------------------------------------------- pastas novas: itens amaldiçoados e modificações
	const ensureFolder = (packName, name, parentId, relDir, sort) => {
		const src = pack(packName);
		let f = src.folders.find((d) => d.json.name === name && (d.json.folder ?? null) === (parentId ?? null));
		if (!f) {
			const json = buildFolder(packName, name, parentId, { sort });
			createFolder(packName, relDir, json);
			f = src.folders.find((d) => d.json._id === json._id);
		}
		touch(packName, f.json._id, "folder");
		return f.json._id;
	};
	const cursedRoot = ensureFolder("general", "Itens Amaldiçoados", sahRoot.json._id, "sobrevivendo-ao-horror/itens-amaldi-oados", 900000);
	const elemFolders = {};
	let order = 0;
	for (const elem of ["Sangue", "Morte", "Conhecimento", "Energia", "Medo"]) {
		order += 100000;
		elemFolders[elem] = ensureFolder("general", elem, cursedRoot, `sobrevivendo-ao-horror/itens-amaldi-oados/${slug(elem)}`, order);
	}
	const modsFolder = ensureFolder("general", "Modificações", sahRoot.json._id, "sobrevivendo-ao-horror/modifica-es", 950000);

	order = 0;
	for (const def of CURSED) {
		order += 1;
		const rel = CURSED_ICON_BY_NAME[def.name] ?? CURSED_ICON[def.elem];
		if (def.kind === "weapon") continue; // Fuzil Alheio é arma: tratado abaixo
		upsertGeneralAt(def, `sobrevivendo-ao-horror/itens-amaldi-oados/${slug(def.elem)}`, elemFolders[def.elem], rel, {});
	}
	for (const def of MODIFICATIONS) upsertGeneralAt({ ...def, cat: 0, w: 0 }, "sobrevivendo-ao-horror/modifica-es", modsFolder, "accessories/kit-de-pericia.svg", {});

	function upsertGeneralAt(def, relDir, folderId, imgRel, extraSystem) {
		const id = stableId("sahGeneral", def.name);
		const existing = gen.findItem(def.name);
		const system = { description: toHtml(def.text), chatDescription: "", weight: def.w ?? 0, category: def.cat ?? 0, ...extraSystem };
		if (existing) {
			existing.json.folder = folderId;
			applyItem("general", existing, { system }, { effects: [] });
			return;
		}
		createItem("general", relDir, {
			name: def.name,
			type: "generalEquipment",
			_id: id,
			img: `${EQUIP_ICON}/${imgRel}`,
			system: { using: { state: true, class: "fas" }, type: "", quantity: 1, ...system },
			effects: [],
			folder: folderId,
			sort: 0,
			ownership: { default: 0 },
			flags: {},
			_stats: STATS(),
			_key: `!items!${id}`,
		});
	}

	// -------------------------------------------------------------- Fuzil Alheio (arma amaldiçoada): cópia do Fuzil de Precisão com dano de Energia e sem munição
	{
		const fuzilDef = CURSED.find((c) => c.kind === "weapon");
		const base = arms.findItem("Fuzil de Precisão");
		const sahArms = arms.folders.find((d) => d.json.name === "Sobrevivendo ao Horror" && d.json.folder === null);
		const folderId = ensureFolder("armaments", "Itens Amaldiçoados", sahArms.json._id, "sobrevivendo-ao-horror/itens-amaldi-oados", 900000);
		const id = stableId("sahWeapon", fuzilDef.name);
		const json = structuredClone(base.json);
		json.name = fuzilDef.name;
		json._id = id;
		json._key = `!items!${id}`;
		json._stats = STATS();
		json.folder = folderId;
		json.sort = 0;
		json.effects = [];
		json.ownership = { default: 0 };
		json.system.description = toHtml(fuzilDef.text);
		json.system.chatDescription = "";
		json.system.category = fuzilDef.cat;
		json.system.weight = fuzilDef.w;
		json.system.types.ammunitionType = "";
		json.system.formulas.damage.type = "energyDamage";
		const existing = arms.findItem(fuzilDef.name);
		if (existing) applyItem("armaments", existing, { system: json.system });
		else createItem("armaments", "sobrevivendo-ao-horror/itens-amaldi-oados", json);
	}
}
