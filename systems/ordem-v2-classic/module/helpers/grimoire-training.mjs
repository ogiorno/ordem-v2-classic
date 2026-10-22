/**
 * Grimório: o que o personagem tem de treinamento em cada perícia e em cada poder que concede perícia
 * (regras puras, sem Foundry — testável em Node). Spec: docs/arquivo/spec-pericias-treinadas.md, seção 5.
 */
import { DEGREES, DEGREE_NAMES, DEGREE_POINTS } from "./skill-training-rules.mjs";

const TONES = ["none", "trained", "veteran", "expert"];

/** Chip do grau: "Veterana +10". */
export function degreeChip(index = 0) {
	const i = Math.max(0, Math.min(3, Number(index) || 0));
	return { label: i ? `${DEGREE_NAMES[DEGREES[i]]} +${DEGREE_POINTS[i]}` : DEGREE_NAMES.untrained, tone: TONES[i] };
}

/**
 * Leitura de uma perícia para a ficha escolhida.
 * @param {{ name: string, degree: number, sources: string[], locked: string[], plus: {value:number,label:string}[], manual: boolean }} info
 */
export function skillReading({ name, degree = 0, sources = [], locked = [], plus = [], manual = false } = {}) {
	const lines = [];
	if (sources.length) lines.push(`Veio de: ${sources.join(" · ")}.`);
	else if (degree > 0 && manual) lines.push("Veio de: escolha na ficha.");
	if (locked.length) lines.push(`Travada por: ${locked.join(", ")} 🔒.`);
	for (const p of plus) lines.push(`+${p.value} de ${p.label} (já era treinado).`);
	if (!lines.length && degree === 0) lines.push(`${name}: você não é treinado nesta perícia.`);
	return { title: "Seu treinamento", chip: degreeChip(degree), lines };
}

/** Linha de um poder que concede, escolhe ou trava perícia. */
export function powerReading({ mode = null, skill = "", bonus = 0, pending = false, kind = "" } = {}) {
	if (pending || !skill) return { title: "Seu treinamento", chip: null, lines: ["Escolha pendente: use o botão Escolher na aba Perícias."] };
	if (mode === "plus") return { title: "Seu treinamento", chip: null, lines: [`+${bonus || 2} aplicado em ${skill} (você já era treinado nela).`] };
	if (mode === "hold" || kind === "hold") return { title: "Seu treinamento", chip: null, lines: [`Perícia escolhida: ${skill} 🔒 (não pode ser destreinada enquanto o poder existir).`] };
	return { title: "Seu treinamento", chip: null, lines: [`Perícia escolhida: ${skill} 🔒 · treinada por este poder.`] };
}

/** Cartão "Quantas perícias posso ter?" com os números da ficha e as regras R3–R5 em três linhas. */
export function budgetCard({ train, raise, points, showRaise = false, over = false } = {}) {
	const numbers = [`Perícias treinadas: ${train.used} / ${train.allowed}`];
	if (showRaise) numbers.push(`Aumentos de grau: ${raise.used} / ${raise.allowed}`);
	numbers.push(`Pontos: ${points.used} / ${points.allowed}`);
	return {
		title: "Quantas perícias posso ter?",
		numbers,
		over,
		rules: [
			"A origem entra primeiro: a classe nunca repete uma perícia que a origem já deu (escolha outra).",
			"Veterano só a partir do NEX 35% e Expert a partir do NEX 70%; o Grau de Treinamento sobe um degrau por vez.",
			"O Intelecto permanente soma vagas e aumentos; poderes que dão treinamento não gastam vaga.",
		],
	};
}
