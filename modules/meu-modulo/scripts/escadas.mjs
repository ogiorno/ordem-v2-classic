const MODULE_ID = "meu-modulo";

/**
 * Escadas por ícone: um pino do mapa (Note) com a flag `regionUuid` leva o token selecionado
 * para outra cena. O clique move o token até uma região pequena com o comportamento
 * "Teletransporte"; é ele que faz a troca de cena.
 */
async function usarEscada(note) {
  const uuid = note.document.getFlag(MODULE_ID, "regionUuid");
  const region = uuid ? await fromUuid(uuid) : null;
  if (!region) return ui.notifications.warn("Esta escada ainda não está ligada a outro andar.");

  const token = canvas.tokens.controlled[0]
    ?? canvas.tokens.placeables.find((t) => t.isOwner && t.actor?.id === game.user.character?.id)
    ?? canvas.tokens.placeables.find((t) => t.isOwner);
  if (!token) return ui.notifications.warn("Selecione o seu token para usar a escada.");

  // calcula a geometria das regiões da cena antes de mover (senão o Foundry pode falhar ao testar a entrada)
  for (const r of token.document.parent.regions) void r.polygonTree;

  const shape = region.shapes[0];
  const cx = shape.x + (shape.width ?? 0) / 2;
  const cy = shape.y + (shape.height ?? 0) / 2;
  const size = canvas.grid.size;
  const alvo = {
    x: Math.round(cx - (token.document.width * size) / 2),
    y: Math.round(cy - (token.document.height * size) / 2),
  };
  // A região só dispara quando o token ENTRA nela. Um salto direto (teleport) não dispara,
  // então o token vai para perto da região e dá o último passo andando.
  // ponto de partida: o primeiro lado de onde dá para andar até a região sem atravessar parede
  const metade = (token.document.width * size) / 2;
  const centro = { x: alvo.x + metade, y: alvo.y + metade };
  const lados = [[-150, 0], [150, 0], [0, -150], [0, 150], [-90, -90], [90, -90], [-90, 90], [90, 90]];
  const livre = lados.find(([dx, dy]) => !CONFIG.Canvas.polygonBackends.move.testCollision(
    { x: centro.x + dx, y: centro.y + dy }, centro, { type: "move", mode: "any" }));
  const [dx, dy] = livre ?? [-90, 0];
  await token.document.update({ x: alvo.x + dx, y: alvo.y + dy }, { teleport: true, animate: false });
  await token.document.update(alvo, { animate: false });
}

// Com a camada de Notas ativa (mestre editando o mapa), o pino se comporta como nota comum: dá para arrastar.
const editando = () => game.user.isGM && canvas.notes?.active;

Hooks.once("init", () => {
  const Note = foundry.canvas.placeables.Note;
  const original = Note.prototype._onClickLeft;
  Note.prototype._onClickLeft = function (event) {
    if (!this.document.getFlag(MODULE_ID, "regionUuid") || editando()) return original.call(this, event);
    event.stopPropagation?.();
    return usarEscada(this);
  };
});

// duplo clique também usa a escada, em vez de abrir o diário
Hooks.on("activateNote", (note) => (note.document.getFlag(MODULE_ID, "regionUuid") && !editando() ? false : undefined));
