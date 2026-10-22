// Armazenamento privado do painel de resolução (puro: recebe o `storage` por injeção).
//
// Por quê não ficar em flag de mensagem? O servidor do Foundry entrega TODAS as mensagens (inclusive sussurros de
// outros usuários) e documentos de acesso restrito aos clientes; o jogador consegue ler flags pelo console. O painel
// guarda DT, totais de resistência e valores antes/depois, então fica só no navegador do Mestre. A mensagem de chat
// leva apenas o `panelId` (sem segredo). Custo: o painel só abre no navegador que o criou.

const PREFIX = "opThreatAbilityPanels";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export class PanelStore {
	/** @param {{getItem:Function,setItem:Function,removeItem:Function}} storage  localStorage ou equivalente */
	constructor(storage, { worldId, userId, now = () => Date.now() }) {
		this.storage = storage;
		this.key = `${PREFIX}:${worldId}:${userId}`;
		this.now = now;
	}

	#read() {
		try {
			const parsed = JSON.parse(this.storage.getItem(this.key) ?? "{}");
			return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
		} catch {
			return {};
		}
	}

	#write(all) {
		try {
			this.storage.setItem(this.key, JSON.stringify(all));
			return true;
		} catch {
			return false; // cota cheia ou armazenamento bloqueado
		}
	}

	get(id) {
		const entry = this.#read()[id];
		return entry ? JSON.parse(JSON.stringify(entry.panel)) : null;
	}

	set(id, panel) {
		const all = this.#read();
		all[id] = { at: this.now(), panel: JSON.parse(JSON.stringify(panel)) };
		return this.#write(all);
	}

	delete(id) {
		const all = this.#read();
		if (!(id in all)) return false;
		delete all[id];
		return this.#write(all);
	}

	/** Remove painéis antigos; devolve quantos saíram. */
	prune() {
		const all = this.#read();
		const limit = this.now() - MAX_AGE_MS;
		let removed = 0;
		for (const [id, entry] of Object.entries(all)) {
			if (!entry?.at || entry.at < limit) { delete all[id]; removed++; }
		}
		if (removed) this.#write(all);
		return removed;
	}

	ids() {
		return Object.keys(this.#read());
	}
}
