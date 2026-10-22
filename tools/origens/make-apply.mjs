// Gera tools/origens/out/apply.js: upsert idempotente das origens e poderes de Arquivos Secretos nos compêndios vivos.
// Rodar depois de build-as.mjs; executar no mundo como GM: playwright-cli -s=<nome> --raw eval "$(cat tools/origens/out/apply.js)"
import fs from "node:fs";
const ops = JSON.parse(fs.readFileSync("tools/origens/out/as-ops.json", "utf8"));
const folder = JSON.parse(fs.readFileSync("systems/ordem-v2-classic/packs/_source/originPowers/arquivos-secretos/_folder.json", "utf8"));
const code = `(async () => {
	const SYS = "ordem-v2-classic";
	const ops = ${JSON.stringify(ops)};
	const folder = ${JSON.stringify(folder)};
	const clean = (d) => { const c = foundry.utils.deepClone(d); delete c._key; delete c._stats; delete c.ownership; return c; };
	const log = [];
	const withUnlocked = async (pack, fn) => {
		const was = pack.locked;
		if (was) await pack.configure({ locked: false });
		try { await fn(); } finally { if (was) await pack.configure({ locked: true }); }
	};
	const powers = game.packs.get(SYS + ".originPowers");
	await withUnlocked(powers, async () => {
		if (!powers.folders.get(folder._id)) { await Folder.create(clean(folder), { pack: powers.collection, keepId: true }); log.push("pasta criada"); }
		const index = await powers.getIndex();
		for (const doc of ops.powers) {
			const found = index.find((e) => e.name === doc.name);
			if (found) { await (await powers.getDocument(found._id)).update({ "system.description": doc.system.description }); log.push("poder atualizado: " + doc.name); }
			else { await Item.create(clean(doc), { pack: powers.collection, keepId: true }); log.push("poder criado: " + doc.name); }
		}
	});
	const origins = game.packs.get(SYS + ".origins");
	await withUnlocked(origins, async () => {
		const index = await origins.getIndex();
		for (const { name, doc } of ops.origins) {
			const found = index.find((e) => e.name === name);
			if (found) { await (await origins.getDocument(found._id)).update({ "system.description": doc.system.description }); log.push("origem atualizada: " + name); }
			else { await Item.create(clean(doc), { pack: origins.collection, keepId: true }); log.push("origem criada: " + name); }
		}
	});
	return JSON.stringify(log);
})()`;
fs.writeFileSync("tools/origens/out/apply.js", code);
console.log("ok", code.length);
