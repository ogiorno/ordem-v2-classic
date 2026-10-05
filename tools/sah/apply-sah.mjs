// TEMPORÁRIO — aplica o conteúdo do suplemento Sobrevivendo ao Horror nos compêndios vivos do sistema.
// Idempotente: roda no GM ativo ao carregar o mundo e só altera o que diferir. Remover depois de aplicar.
const SYSTEM = "ordem_v2_classic";
const log = (...a) => console.log("SAH apply |", ...a);

const sameEffects = (current, wanted) => {
	const norm = (list) =>
		JSON.stringify(
			list
				.map((e) => ({ id: e._id ?? e.id, name: e.name, disabled: Boolean(e.disabled), changes: (e.system?.changes ?? e.changes ?? []).map((c) => ({ key: c.key, value: c.value, type: c.type })) }))
				.sort((a, b) => a.id.localeCompare(b.id))
		);
	return norm(current) === norm(wanted);
};

async function apply() {
	const ops = await (await fetch("/modules/meu-modulo/scripts/sah-ops.json")).json();
	const summary = { deleted: 0, folderCreated: 0, folderUpdated: 0, created: 0, updated: 0, unchanged: 0, errors: [] };
	const unlocked = new Map();
	const packOf = async (name) => {
		const pack = game.packs.get(`${SYSTEM}.${name}`);
		if (!pack) throw new Error(`compêndio ausente: ${name}`);
		if (pack.locked && !unlocked.has(name)) {
			await pack.configure({ locked: false });
			unlocked.set(name, pack);
		}
		return pack;
	};

	for (const op of ops) {
		try {
			const pack = await packOf(op.pack);
			const data = foundry.utils.deepClone(op.data);
			if (op.kind === "delete") {
				const gone = pack.index.has(op.id) ? await pack.getDocument(op.id) : null;
				if (gone) {
					await gone.delete();
					summary.deleted++;
				}
				continue;
			}
			if (op.kind === "folder") {
				const current = pack.folders.get(op.id);
				if (!current) {
					await Folder.implementation.create(data, { pack: pack.collection, keepId: true });
					summary.folderCreated++;
				} else if (current.name !== data.name || (current.folder?.id ?? null) !== (data.folder ?? null)) {
					await current.update({ name: data.name, folder: data.folder ?? null, sort: data.sort });
					summary.folderUpdated++;
				} else summary.unchanged++;
				continue;
			}
			const doc = pack.index.has(op.id) ? await pack.getDocument(op.id) : null;
			if (!doc) {
				await Item.implementation.create(data, { pack: pack.collection, keepId: true });
				summary.created++;
				continue;
			}
			const sys = data.system ?? {};
			// Só os campos de conteúdo; o resto da ficha do item (campos antigos do compêndio) fica como está.
			const KEYS = ["description", "chatDescription", "preRequisite", "activation", "cost", "costType", "abilityType", "category", "weight", "critical", "range", "formulas"];
			const patch = Object.fromEntries(KEYS.filter((k) => k in sys).map((k) => [k, sys[k]]));
			const NUMERIC = ["cost", "category", "weight"];
			const same = (k) => {
				if (NUMERIC.includes(k)) return (Number(doc.system[k]) || 0) === (Number(patch[k]) || 0);
				if (k === "formulas") return JSON.stringify([doc.system.formulas?.damage?.formula, doc.system.formulas?.damage?.type]) === JSON.stringify([patch.formulas?.damage?.formula, patch.formulas?.damage?.type]);
				return String(doc.system[k] ?? "") === String(patch[k] ?? "");
			};
			const sameSystem = Object.keys(patch).every(same);
			const sameEff = sameEffects([...doc.effects], data.effects ?? []);
			const sameMeta = doc.name === data.name && (doc.folder?.id ?? null) === (data.folder ?? null);
			if (sameSystem && sameEff && sameMeta) {
				summary.unchanged++;
				continue;
			}
			await doc.update({ name: data.name, img: data.img, system: patch, folder: data.folder ?? null, sort: data.sort });
			if (!sameEff) {
				const old = [...doc.effects].map((e) => e.id);
				if (old.length) await doc.deleteEmbeddedDocuments("ActiveEffect", old);
				if (data.effects?.length) await doc.createEmbeddedDocuments("ActiveEffect", data.effects, { keepId: true });
			}
			summary.updated++;
		} catch (err) {
			console.error("SAH apply | falha", op.pack, op.id, err);
			summary.errors.push(`${op.pack}:${op.id}: ${err.message}`);
		}
	}
	for (const pack of unlocked.values()) await pack.configure({ locked: true });
	log("resumo", summary);
	globalThis.__sahApplySummary = summary;
	ui.notifications.info(`Sobrevivendo ao Horror: ${summary.created} criados, ${summary.updated} atualizados, ${summary.unchanged} já estavam certos${summary.errors.length ? `, ${summary.errors.length} erros` : ""}.`);
}

Hooks.once("ready", () => {
	if (!game.user.isGM) return;
	apply().catch((err) => console.error("SAH apply | erro geral", err));
});
