const MODULE_ID = "meu-modulo";
const ENTRY_NAME = "Pistas (lupas do mapa)";

/**
 * Lupa de investigação: um pino do mapa (Note) com a flag `lupa` abre um diálogo de teste.
 * Quem clica rola a perícia contra a DT e vê o texto de sucesso ou de falha.
 * Flag: { skill, dt, sucesso, falha }.
 */
function getToken(skill) {
  const serve = (t) => t.isOwner && t.actor?.system.skills?.[skill];
  return canvas.tokens.controlled[0]
    ?? canvas.tokens.placeables.find((t) => serve(t) && t.actor.id === game.user.character?.id)
    ?? canvas.tokens.placeables.find(serve)
    ?? canvas.tokens.placeables.find((t) => t.isOwner);
}

async function investigar(note) {
  const { skill = "investigation", dt = 15, sucesso = "", falha = "" } = note.document.getFlag(MODULE_ID, "lupa");
  const actor = getToken(skill)?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Selecione o seu token para investigar.");
  if (!actor.system.skills?.[skill]) return ui.notifications.warn(`${actor.name} não faz testes de perícia. Selecione um agente.`);

  const pericia = game.i18n.localize(CONFIG.op.skills[skill] ?? skill);
  const confirmou = await foundry.applications.api.DialogV2.confirm({
    window: { title: note.document.text || "Investigar" },
    content: `<p><b>${actor.name}</b> examina o local.</p><p>Teste de <b>${pericia}</b> (DT ${dt}).</p>`,
    yes: { label: "Rolar", icon: "fa-solid fa-dice-d20" },
    no: { label: "Cancelar" },
    rejectClose: false,
  });
  if (!confirmou) return;

  // create:false devolve o D20Roll em vez de já postar a mensagem; a mensagem sai junto com o resultado
  const rolls = await actor.rollSkill({ skill, rolls: [{ options: { target: dt } }] }, { configure: false }, { create: false });
  const roll = Array.isArray(rolls) ? rolls[0] : rolls;
  const total = Number(roll?.total);
  if (!Number.isFinite(total)) return;

  const achou = total >= dt;
  const texto = achou ? sucesso : falha;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls: [roll],
    sound: CONFIG.sounds.dice,
    content: `<p><b>${pericia}</b>: ${total} contra DT ${dt} — <b>${achou ? "sucesso" : "falha"}</b>.</p>`
      + (texto ? `<p>${texto}</p>` : ""),
  });
}

/** Cria o pino de lupa na cena atual (só o Mestre). */
async function criarLupa({ x, y, dt = 15, skill = "investigation", sucesso = "", falha = "Você não encontra nada de útil.", texto = "Investigar" } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("Só o Mestre cria lupas.");
  if (!canvas.scene) return ui.notifications.warn("Não há cena aberta.");
  // O pino só aparece para os jogadores se existir uma entrada de diário que eles possam ver (nível Limitado).
  let entry = game.journal.getName(ENTRY_NAME);
  entry ??= await JournalEntry.create({ name: ENTRY_NAME, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED } });
  const centro = canvas.dimensions.sceneRect;
  const [nota] = await canvas.scene.createEmbeddedDocuments("Note", [{
    x: x ?? centro.x + centro.width / 2,
    y: y ?? centro.y + centro.height / 2,
    entryId: entry.id,
    texture: { src: "icons/svg/eye.svg" },
    iconSize: 48,
    text: texto,
    global: true,
    flags: { [MODULE_ID]: { lupa: { skill, dt, sucesso, falha } } },
  }]);
  return nota;
}

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = { ...game.modules.get(MODULE_ID).api, criarLupa };

  const Note = foundry.canvas.placeables.Note;
  const original = Note.prototype._onClickLeft;
  Note.prototype._onClickLeft = function (event) {
    if (!this.document.getFlag(MODULE_ID, "lupa")) return original.call(this, event);
    event.stopPropagation?.();
    return investigar(this);
  };
});

// duplo clique também investiga, em vez de abrir o diário
Hooks.on("activateNote", (note) => (note.document.getFlag(MODULE_ID, "lupa") ? false : undefined));
