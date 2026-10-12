/** Poderes de origem do compêndio (leitura única por sessão): alimentam a ficha da origem e a confirmação de troca. */
let cache = null;

export function loadOriginPowers() {
	cache ??= (async () => {
		const pack = game.packs.get("ordem_v2_classic.originPowers");
		if (!pack) return [];
		const docs = await pack.getDocuments();
		return docs.filter((d) => d.type === "ability").map((d) => ({ name: d.name, description: d.system.description }));
	})();
	return cache;
}
