// Gera a fonte do compêndio `curses` (Maldições Paranormais): packs/_source/curses/** a partir de curse-rules.mjs
// (uma só fonte de verdade: o texto e os efeitos vêm da tabela; ver docs/spec-modificacoes-paranormais.md, §3.1).
// Uso (a partir de foundry-dev): node tools/maldicoes/gerar-fonte-maldicoes.mjs
// Idempotente: apaga e recria packs/_source/curses. Ícones: usa fixtures/curse-icons.json quando existir (spec-icones-maldicoes.md).
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CURSES, ELEMENTS, KINDS, ATTRIBUTE_NAMES } from "../../systems/ordem_v2_classic/module/helpers/curse-rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const system = path.join(root, "systems/ordem_v2_classic");
const out = path.join(system, "packs/_source/curses");
const iconsFile = path.join(system, "fixtures/curse-icons.json");
const icons = fs.existsSync(iconsFile) ? JSON.parse(fs.readFileSync(iconsFile, "utf8")) : {};
const FALLBACK = "icons/svg/aura.svg";
const NOW = 1792207618168;

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** Id fixo de 16 caracteres a partir do nome: o pacote compilado mantém os mesmos ids a cada geração. */
const idOf = (seed) => {
	const hash = crypto.createHash("sha1").update(`curses:${seed}`).digest();
	return Array.from({ length: 16 }, (_, i) => ALPHABET[hash[i] % ALPHABET.length]).join("");
};
const stats = () => ({ coreVersion: "14.369", systemId: "ordem_v2_classic", systemVersion: "8.0.2", createdTime: NOW, modifiedTime: NOW, lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null });
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const FOLDERS = [
	{ kind: "weapon", name: "Armas", sort: 100000 },
	{ kind: "protection", name: "Proteções", sort: 200000 },
	{ kind: "accessory", name: "Acessórios", sort: 300000 },
];
const MODE = { auto: "Automática: o sistema aplica sozinho.", semi: "Semi: o sistema monta, a mesa confirma.", manual: "Manual: cartão de uso com custo; o resto é da mesa." };

/** O que o sistema faz com a maldição, em frases (vai para a descrição do item do compêndio). */
function behavior(c) {
	const out = [];
	const bonuses = c.changes?.map((x) => x.label) ?? [];
	if (c.byClass) out.push("Na ficha: +2 em Defesa e resistência a dano 2 (proteção leve ou escudo) ou 5 (proteção pesada).");
	else if (c.elementFromChoice) out.push("Na ficha: resistência 10 ao elemento escolhido; o item conta como do elemento.");
	else if (bonuses.length) out.push(`Na ficha enquanto o item está equipado: ${bonuses.join("; ")}.`);
	if (c.lock) out.push("Só liga depois de um dia de uso do item (conta pelo tempo do mundo).");
	if (c.attack) out.push(`Tela de ataque: opção "${c.attack.label}"${c.attack.cost ? ` (${c.attack.cost} PE)` : ""} — ${c.attack.hint}.`);
	if (c.doubleCritMargin) out.push("Ataque: a margem de ameaça da arma duplica (automático).");
	if (c.damage) out.push(`Dano extra: ${c.damage.formula} ${c.damage.multiplyOnCrit ? "(multiplica no crítico) " : ""}em carta própria${c.damage.always ? "" : ", quando a opção é escolhida"}.`);
	if (c.afterHit?.condition) out.push("Ao acertar: aplica a condição Imóvel ao alvo.");
	if (c.afterHit?.dot) out.push("Ao acertar: avisa o Mestre do dano contínuo.");
	if (c.use) out.push(`Botão de uso na ficha do item: ${c.use.label}${c.use.cost ? ` (${c.use.cost} PE/PD)` : ""}.`);
	if (c.choice === "element") out.push("Ao anexar ao item, o sistema pergunta o elemento.");
	if (c.choice === "ritual") out.push("Ao anexar ao item, o sistema pergunta qual ritual fica guardado.");
	if (c.reason) out.push(c.reason);
	return out;
}

fs.rmSync(out, { recursive: true, force: true });
for (const f of FOLDERS) {
	const dir = path.join(out, slug(f.name));
	fs.mkdirSync(dir, { recursive: true });
	const id = idOf(`folder:${f.kind}`);
	f.id = id;
	f.dir = dir;
	fs.writeFileSync(path.join(dir, "_folder.json"), JSON.stringify({ type: "Item", folder: null, name: f.name, color: null, sorting: "a", _id: id, description: "", sort: f.sort, flags: {}, _stats: stats(), _key: `!folders!${id}` }, null, 2) + "\n");
}

let count = 0;
let order = 0;
const bundle = { folders: [], items: [] };
for (const f of FOLDERS) bundle.folders.push(JSON.parse(fs.readFileSync(path.join(f.dir, "_folder.json"), "utf8")));
for (const c of Object.values(CURSES)) {
	const folder = FOLDERS.find((f) => f.kind === c.kind);
	const element = ELEMENTS[c.element];
	const id = idOf(`item:${c.key}`);
	const body = [
		`<p><strong>${esc(element.label)}</strong> · maldição de ${esc(KINDS[c.kind].toLowerCase())} · ${esc(MODE[c.mode])}</p>`,
		`<p>${esc(c.text)}</p>`,
		`<h4>No sistema</h4>`,
		`<ul>${behavior(c).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`,
		`<p><em>Arraste para a ficha de um agente (ou para um item) e escolha o item que vira amaldiçoado. A primeira maldição soma +II à categoria do item e as seguintes +I.</em></p>`,
		`<p><small>Fonte: Ordem Paranormal RPG — Livro de Regras v1.3, Itens amaldiçoados (livro p. 144–147).</small></p>`,
	].join("\n");
	const item = {
		name: c.label,
		type: "curse",
		_id: id,
		img: icons[c.key] ?? FALLBACK,
		system: { description: body, chatDescription: "", curseKey: c.key, element: c.element, applies: c.kind, mode: c.mode, price: "" },
		effects: [],
		folder: folder.id,
		sort: (order += 100000),
		ownership: { default: 0 },
		flags: {},
		_stats: stats(),
		_key: `!items!${id}`,
	};
	fs.writeFileSync(path.join(folder.dir, `${slug(c.label)}.json`), JSON.stringify(item, null, 2) + "\n");
	bundle.items.push(item);
	count++;
}
// Cópia servida pelo Foundry: o GM completa o compêndio por ela quando o pacote compilado ainda não existe (curses.mjs, ensureCursePack).
fs.mkdirSync(path.join(system, "fixtures"), { recursive: true });
fs.writeFileSync(path.join(system, "fixtures/curses-pack.json"), JSON.stringify(bundle) + "\n");
console.log(`maldições: ${count} itens em ${path.relative(root, out)}`);
void ATTRIBUTE_NAMES;
