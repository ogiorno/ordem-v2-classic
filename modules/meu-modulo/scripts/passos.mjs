const MODULE_ID = "meu-modulo";

/**
 * Passo do teclado (WASD/setas) menor em cenas sem grade.
 * O Foundry anda 1 quadrado (100 px) por toque; aqui o passo vira uma fração disso.
 */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "passoTeclado", {
    name: "Passo do teclado (%)",
    hint: "Quanto o token anda por toque em WASD/setas, em % de um quadrado. Só vale em cenas sem grade.",
    scope: "world",
    config: true,
    type: Number,
    default: 35,
    range: { min: 10, max: 100, step: 5 },
  });

  const Token = foundry.canvas.placeables.Token;
  const original = Token.prototype._getShiftedPosition;
  Token.prototype._getShiftedPosition = function (dx, dy, dz) {
    const pos = original.call(this, dx, dy, dz);
    if (!canvas.grid.isGridless) return pos;
    const fator = (game.settings.get(MODULE_ID, "passoTeclado") ?? 100) / 100;
    if (fator >= 1) return pos;
    const x0 = this.document._source.x;
    const y0 = this.document._source.y;
    return { ...pos, x: Math.round(x0 + (pos.x - x0) * fator), y: Math.round(y0 + (pos.y - y0) * fator) };
  };
});
