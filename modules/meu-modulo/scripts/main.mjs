import "./escadas.mjs";
import "./passos.mjs";

const MODULE_ID = "meu-modulo";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  game.settings.register(MODULE_ID, "saudacao", {
    name: "MEUMODULO.Settings.Saudacao",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", () => {
  if (game.settings.get(MODULE_ID, "saudacao")) {
    ui.notifications.info(game.i18n.format("MEUMODULO.Ola", { user: game.user.name }));
  }
});
