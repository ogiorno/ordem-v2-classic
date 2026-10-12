// Casamento (puro) entre fichas/itens do mundo e as configurações revisadas do fixture.
// Nada é aplicado sozinho: isto só decide o que PODERIA ser aplicado quando o Mestre pedir.

const plain = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const stripHtml = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Chave de nome comparável: sem acento, caixa, marcadores iniciais ("•"), sufixos de VD ("VD 20") e espaços extras. */
export function nameKey(name) {
	return plain(name).replace(/^[\s••*-]+/, "").replace(/\s+vd\s*\d+$/i, "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

/** Texto da descrição do item comparável ao `normalizedDescription` do fixture. */
export const descriptionKey = (html) => plain(stripHtml(html)).replace(/\s+/g, " ").trim();

/**
 * Plano de aplicação para um ator: uma linha por item `ability` com configuração encontrada.
 * `configs` = abilities do fixture de configurações; `corpus` = habilidades do corpus (id → normalizedDescription).
 */
export function planConfigApplication({ actorName, items, configs, corpusById = new Map(), overwrite = false }) {
	const creatureKey = nameKey(actorName);
	const mine = configs.filter((c) => nameKey(c.creature) === creatureKey);
	const used = new Set();
	const rows = [];
	for (const item of items.filter((i) => i.type === "ability")) {
		const key = nameKey(item.name);
		const candidates = mine.filter((c) => nameKey(c.name) === key && !used.has(c.id));
		const config = candidates[0] ?? null;
		if (!config) { rows.push({ itemId: item.id, name: item.name, action: "skip", reason: mine.length ? "no-config" : "unknown-creature" }); continue; }
		used.add(config.id);
		const source = corpusById.get(config.id);
		const same = source ? descriptionKey(item.system?.description) === descriptionKey(source.normalizedDescription) : null;
		if (!config.execution) rows.push({ itemId: item.id, name: item.name, configId: config.id, state: config.state, action: "skip", reason: "manual" });
		else if (item.system?.execution && !overwrite) rows.push({ itemId: item.id, name: item.name, configId: config.id, state: config.state, action: "skip", reason: "has-execution" });
		else if (same === false) rows.push({ itemId: item.id, name: item.name, configId: config.id, state: config.state, action: "skip", reason: "description-changed" });
		else rows.push({ itemId: item.id, name: item.name, configId: config.id, state: config.state, action: "apply", reviewActivation: !item.system?.activation });
	}
	return { creature: creatureKey, matched: mine.length > 0, rows };
}

export const summarizePlan = (plan) => ({
	apply: plan.rows.filter((r) => r.action === "apply").length,
	skipped: plan.rows.filter((r) => r.action === "skip").length,
	reviewActivation: plan.rows.filter((r) => r.action === "apply" && r.reviewActivation).length
});

const DEFAULT_IMAGES = new Set(["icons/svg/item-bag.svg", "icons/svg/mystery-man.svg", "", null, undefined]);

/** Ícones a aplicar: só itens com configuração casada, ícone gerado e imagem ainda padrão (item-bag/mystery-man). */
export function planIconApplication(rows, items, icons) {
	const byId = new Map(items.map((i) => [i.id, i]));
	return rows.filter((r) => r.configId && icons[r.configId] && DEFAULT_IMAGES.has(byId.get(r.itemId)?.img)).map((r) => ({ _id: r.itemId, img: icons[r.configId] }));
}
