// Utilidades do gerador de conteúdo do suplemento Sobrevivendo ao Horror.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const SYSTEM_DIR = path.resolve("systems/ordem_v2_classic");
export const SOURCE_DIR = path.join(SYSTEM_DIR, "packs/_source");

export const normalize = (text) =>
	String(text ?? "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Id de 16 caracteres, determinístico (o gerador pode rodar de novo sem duplicar nada). */
export function stableId(...parts) {
	const hash = crypto.createHash("sha1").update(parts.join("::")).digest();
	let out = "";
	for (let i = 0; out.length < 16; i++) out += B62[hash[i % hash.length] % 62];
	return out;
}

export const iconSlug = (name) => slug(String(name).normalize("NFD").replace(/[̀-ͯ]/g, ""));

export const slug = (name) =>
	String(name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "[d]" do livro → @DisplayDice (sinal e quantidade vêm do texto colado ao símbolo). */
export function diceMarkup(text) {
	return text.replace(/([+–−])?(\d)?\[d\]/g, (_m, sign, qtd) => {
		const parts = [`qtd:${qtd ?? 1}`];
		if (sign) parts.push(`sign:${sign === "+" ? "plus" : "minus"}`);
		parts.push("dc:d20");
		return `@DisplayDice[${parts.join("|")}]`;
	});
}

/** Texto do livro → HTML (parágrafos por linha em branco; "Pré-requisito(s): …" final em itálico). */
export function toHtml(text) {
	const paragraphs = String(text).split(/\n\n/).map((p) => p.trim()).filter(Boolean);
	return paragraphs
		.map((p, index) => {
			let html = diceMarkup(esc(p));
			if (index === paragraphs.length - 1) html = html.replace(/(Pré-requisitos?:[^]*)$/, "<em>$1</em>");
			return `<p>${html}</p>`;
		})
		.join("");
}

/** HTML do compêndio → texto comparável com o PDF ("[d]" no lugar do dado). */
export function htmlToBookText(html) {
	return String(html ?? "")
		.replace(/<\/p>/g, "\n\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&([a-zA-Z])(acute|grave|circ|tilde|cedil|uml);/g, "$1")
		.replace(/@DisplayDice\[([^\]]+)\]/g, (_m, inner) => {
			const p = Object.fromEntries(inner.split("|").map((kv) => kv.split(":")));
			const sign = p.sign === "plus" ? "+" : p.sign === "minus" ? "–" : "";
			const qtd = Number(p.qtd ?? 1);
			return `${sign}${qtd > 1 ? qtd : ""}[d]`;
		});
}

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(p, out);
		else if (entry.name.endsWith(".json")) out.push(p);
	}
	return out;
}

/** Um compêndio em _source: documentos (itens e pastas) lidos do disco. */
export class PackSource {
	constructor(name) {
		this.name = name;
		this.dir = path.join(SOURCE_DIR, name);
		this.docs = walk(this.dir).map((file) => ({ file, json: JSON.parse(fs.readFileSync(file, "utf8")) }));
	}
	get items() {
		return this.docs.filter((d) => d.json._key?.startsWith("!items!"));
	}
	get folders() {
		return this.docs.filter((d) => d.json._key?.startsWith("!folders!"));
	}
	findItem(...names) {
		for (const n of names) {
			const found = this.items.find((d) => normalize(d.json.name) === normalize(n));
			if (found) return found;
		}
		return null;
	}
	findFolder(name, parentId = undefined) {
		return this.folders.find((d) => normalize(d.json.name) === normalize(name) && (parentId === undefined || d.json.folder === parentId)) ?? null;
	}
	save(doc) {
		fs.writeFileSync(doc.file, JSON.stringify(doc.json, null, 2) + "\n");
	}
	add(relDir, json) {
		const dir = path.join(this.dir, relDir);
		fs.mkdirSync(dir, { recursive: true });
		const isFolder = json._key.startsWith("!folders!");
		const file = path.join(dir, isFolder ? "_folder.json" : `${slug(json.name)}.json`);
		const doc = { file, json };
		this.docs.push(doc);
		this.save(doc);
		return doc;
	}
}

export const STATS = () => ({
	coreVersion: "14.365",
	systemId: "ordem_v2_classic",
	systemVersion: "7.3.3",
	createdTime: 1784900000000,
	modifiedTime: 1784900000000,
	lastModifiedBy: null,
	compendiumSource: null,
	duplicateSource: null,
	exportSource: null,
});

/** Efeito passivo (transfer) no mesmo formato dos efeitos já existentes nos compêndios. */
export function buildEffect(itemId, fx) {
	const id = stableId("effect", itemId, fx.name);
	return {
		name: fx.name,
		img: "icons/svg/aura.svg",
		_id: id,
		type: "base",
		system: { changes: [{ key: fx.key, type: "add", value: fx.value, phase: "initial", priority: null }] },
		disabled: Boolean(fx.ritual),
		start: null,
		duration: { value: null, units: "seconds", expiry: null, expired: false },
		description: fx.ritual ? "Ligue este efeito no dia em que cumprir a etapa ritualística." : "",
		tint: "#ffffff",
		transfer: true,
		statuses: [],
		showIcon: 1,
		folder: null,
		sort: 0,
		flags: {},
		_stats: STATS(),
		_key: `!items.effects!${itemId}.${id}`,
	};
}

export function buildFolder(packName, name, parent, { sort = 0 } = {}) {
	const id = stableId("folder", packName, parent ?? "", name);
	return {
		type: "Item",
		folder: parent ?? null,
		name,
		color: null,
		sorting: "a",
		_id: id,
		description: "",
		sort,
		flags: {},
		_stats: STATS(),
		_key: `!folders!${id}`,
	};
}
