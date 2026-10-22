// Cores de destaque dos elementos no Grimório (GR-24) e a conta de contraste (WCAG) que as confere. Funções puras.
// Sangue vermelho, Morte cinza, Medo preto, Conhecimento amarelo, Energia roxo (confirmadas pelo Geh em 20/10/2026).
// A interface é escura: cinza e preto nunca são só "cor de preenchimento"; o destaque é borda, ícone e texto em tom claro.

/** Superfície escura sobre a qual os destaques são conferidos. */
export const SURFACE = "#15121a";

/**
 * Por elemento: `accent` (preenchimento de botão e de aba), `onAccent` (texto sobre o preenchimento),
 * `ink` (texto de destaque sobre a superfície escura) e `edge` (borda e ícone sobre a superfície escura).
 */
export const ELEMENT_THEME = Object.freeze({
	blood: { accent: "#b3262d", onAccent: "#ffffff", ink: "#ff9a9a", edge: "#d4545b" },
	death: { accent: "#8b919c", onAccent: "#0d0f12", ink: "#d3d7de", edge: "#9aa1ad" },
	fear: { accent: "#0b0b0d", onAccent: "#f1f2f4", ink: "#d9dce1", edge: "#aab0b8" },
	knowledge: { accent: "#d8a21e", onAccent: "#1a1300", ink: "#f2cf6e", edge: "#d8a21e" },
	energy: { accent: "#7d3fc4", onAccent: "#ffffff", ink: "#c9a8ff", edge: "#9a67dd" },
	default: { accent: "#b3262d", onAccent: "#ffffff", ink: "#ff9a9a", edge: "#d4545b" },
});

export function themeFor(element) {
	return ELEMENT_THEME[element] ?? ELEMENT_THEME.default;
}

function channel(v) {
	const c = v / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG) de uma cor "#rrggbb". */
export function relativeLuminance(hex) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) throw new Error(`cor inválida: ${hex}`);
	const n = parseInt(m[1], 16);
	return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Razão de contraste (1 a 21) entre duas cores. */
export function contrastRatio(a, b) {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}
