import { performance } from "node:perf_hooks";
import { searchEntries, searchFields } from "../systems/ordem-v2-classic/module/helpers/grimoire-text.mjs";

const entries = Array.from({ length: 600 }, (_, i) => {
	const name = `Ritual de Teste Numero ${i} Qualquer`;
	return { uuid: `u.${i}`, name, ...searchFields(name, "texto longo ".repeat(40)) };
});
const times = [];
for (let i = 0; i < 20; i++) {
	const start = performance.now();
	searchEntries(entries, "ritulal tsete");
	if (i >= 5) times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(`Busca em 600 entradas: mediana ${times[Math.floor(times.length / 2)].toFixed(1)} ms (${times.length} amostras, Node ${process.version})`);
