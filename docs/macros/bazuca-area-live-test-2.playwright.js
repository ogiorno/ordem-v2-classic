async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const mine = new Set(); const hook = Hooks.on('createChatMessage', m => { if (m.author?.id === game.user.id) mine.add(m.id); }); const out = {}; let scene; const actors = []; const prevScene = canvas.scene?.id; const origRand = CONFIG.Dice.randomUniform;
    try {
      const baz = (await game.packs.get("ordem_v2_classic.armaments").getDocuments()).find(x => x.name === "Bazuca");
      const mk = async (n) => { const a = await Actor.create({ name: "ZZ " + n, type: "agent", system: { class: "fighter" } }); actors.push(a); return a; };
      const atk = await mk("atirador"), v1 = await mk("alvo"), v2 = await mk("vizinho"), v3 = await mk("longe");
      const [it] = await atk.createEmbeddedDocuments("Item", [baz.toObject()]);
      scene = await Scene.create({ name: "ZZ baz cena2", width: 3000, height: 1500, grid: { size: 100 } });
      const tk = (a, c, r) => ({ ...a.prototypeToken.toObject(), actorId: a.id, x: c * 100, y: r * 100 });
      await scene.createEmbeddedDocuments("Token", [tk(atk, 1, 5), tk(v1, 8, 5), tk(v2, 9, 5), tk(v3, 14, 5)]);
      await scene.view(); await sleep(2500);
      ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
      canvas.tokens.releaseAll(); canvas.tokens.placeables.find(t => t.actor?.id === atk.id).control();
      canvas.tokens.placeables.find(t => t.actor?.id === v1.id).setTarget(true, { releaseOthers: true, groupSelection: false });
      CONFIG.Dice.randomUniform = () => 0.0001;
      await it.roll(); await sleep(800); await it.rollAttack({ event: { shiftKey: true } }); await sleep(2500);
      CONFIG.Dice.randomUniform = origRand;
      out.anim = game.messages.contents.filter(m => mine.has(m.id)).map(m => m.getFlag("ordem_v2_classic", "attackAnim")?.kind).filter(Boolean);
      const btn = [...document.querySelectorAll('button[data-action="damage"]')].at(-1); out.btnClasse = btn?.className; btn?.click(); await sleep(6000);
      const rep = game.messages.contents.filter(m => mine.has(m.id)).find(m => /weapon-area-report/.test(m.content));
      out.relatorio = rep?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      out.areaAnim = !!rep?.getFlag("ordem_v2_classic", "areaAnim");
    } catch (e) { out.erro = String(e.stack) } finally {
      CONFIG.Dice.randomUniform = origRand; Hooks.off('createChatMessage', hook);
      await ChatMessage.deleteDocuments([...mine].filter(id => game.messages.get(id)));
      if (prevScene) await game.scenes.get(prevScene)?.view();
      await scene?.delete(); for (const a of actors) await a.delete();
    }
    return JSON.stringify(out);
  });
}
