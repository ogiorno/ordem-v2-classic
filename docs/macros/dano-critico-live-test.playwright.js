async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = Date.now(); const out = {}; let scene, a, b; const prevScene = canvas.scene?.id; const origRand = CONFIG.Dice.randomUniform;
    try {
      const w = (await game.packs.get("ordem_v2_classic.armaments").getDocuments()).find(x => x.type === "armament" && x.system.types.rangeType.name === "melee");
      a = await Actor.create({ name: "ZZ crit atk", type: "agent", system: { class: "fighter" } });
      b = await Actor.create({ name: "ZZ crit alvo", type: "agent", system: { class: "fighter" } });
      const [it] = await a.createEmbeddedDocuments("Item", [w.toObject()]);
      scene = await Scene.create({ name: "ZZ crit cena", width: 1000, height: 1000, grid: { size: 100 } });
      await scene.createEmbeddedDocuments("Token", [{ ...a.prototypeToken.toObject(), actorId: a.id, x: 100, y: 100 }, { ...b.prototypeToken.toObject(), actorId: b.id, x: 200, y: 100 }]);
      await scene.view(); await sleep(2500);
      const ta = canvas.tokens.placeables.find(t => t.actor?.id === a.id), tb = canvas.tokens.placeables.find(t => t.actor?.id === b.id);
      tb.setTarget(true, { releaseOthers: true, groupSelection: false });
      CONFIG.Dice.randomUniform = () => 0.0001;
      await it.roll(); await sleep(1500); await it.rollAttack({ event: { shiftKey: true } }); await sleep(3000); ui.sidebar.expand?.(); ui.sidebar.changeTab?.('chat','primary'); await sleep(1500);
      await sleep(3000);
      const btn = [...document.querySelectorAll('button[data-action="damage"]')].at(-1);
      out.dom = { msgs: document.querySelectorAll('.chat-message').length, btns: document.querySelectorAll('button[data-action]').length, chat: !!ui.chat?.element, vis: ui.chat?.element?.offsetHeight, last: game.messages.contents.at(-1)?.content?.slice(0,60) }; out.todas = game.messages.contents.filter(m => m.timestamp > t0).map(m => ({ id: m.id, rolls: m.rolls.length, txt: m.content.replace(/<[^>]+>/g,' ').trim().slice(0,40), flags: Object.keys(m.flags.ordem_v2_classic ?? {}) })); out.achou = !!btn; out.hit = JSON.stringify(game.messages.contents.map(m => m.getFlag("ordem_v2_classic","hitResult")).filter(Boolean).at(-1)); out.classe = btn?.className; out.rotulo = btn && getComputedStyle(btn, "::before").content;
      out.sombra1 = btn && getComputedStyle(btn).boxShadow; await sleep(450); out.sombra2 = btn && getComputedStyle(btn).boxShadow;
      out.temMotion = typeof Motion?.animate;
      btn?.click(); await sleep(800);
      const btn2 = [...document.querySelectorAll('button[data-action="damage"]')].find(x => x === btn) ?? null;
      out.depoisClasse = btn?.className; out.depoisRotulo = btn && getComputedStyle(btn, "::before").content; out.depoisSombra = btn?.style.boxShadow;
    } catch (e) { out.erro = String(e.stack) } finally {
      CONFIG.Dice.randomUniform = origRand;
      await ChatMessage.deleteDocuments(game.messages.contents.filter(m => m.timestamp > t0).map(m => m.id));
      if (prevScene) await game.scenes.get(prevScene)?.view();
      await scene?.delete(); await a?.delete(); await b?.delete();
    }
    return JSON.stringify(out);
  });
}
