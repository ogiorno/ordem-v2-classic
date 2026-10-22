async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = Date.now(); const out = { seq: game.modules.get("sequencer")?.active, jb2a: !!(game.modules.get("JB2A_DnD5e")?.active || game.modules.get("jb2a_patreon")?.active) }; let scene, a, b; const prevScene = canvas.scene?.id;
    try {
      const weapons = await game.packs.get("ordem-v2-classic.armaments").getDocuments();
      const melee = weapons.find(x => x.type === "armament" && x.system.types.rangeType.name === "melee"); out.armaMelee = melee.name;
      const gun = weapons.find(x => x.type === "armament" && x.system.types.rangeType.name === "ranged" && x.system.types.rangeType.subRangeType === "fire");
      a = await Actor.create({ name: "ZZ anim atk", type: "agent", system: { class: "fighter" } });
      b = await Actor.create({ name: "ZZ anim alvo", type: "agent", system: { class: "fighter" } });
      const [im, ig] = await a.createEmbeddedDocuments("Item", [melee.toObject(), gun.toObject()]);
      scene = await Scene.create({ name: "ZZ anim cena", width: 3000, height: 1000, grid: { size: 100 } });
      await scene.createEmbeddedDocuments("Token", [{ ...a.prototypeToken.toObject(), actorId: a.id, x: 200, y: 400 }, { ...b.prototypeToken.toObject(), actorId: b.id, x: 300, y: 400 }]);
      await scene.view(); await sleep(2500);
      ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
      canvas.tokens.placeables.find(t => t.actor?.id === b.id).setTarget(true, { releaseOthers: true, groupSelection: false });
      const watch = async () => { const seen = []; const tt = Date.now(); for (let i = 0; i < 80; i++) { const effs = Sequencer.EffectManager.effects; if (effs.length) { const e = effs[0]; const d = e.data; seen.push({ ms: Date.now() - tt, file: String(d?.file).slice(-34), rotacaoGraus: Math.round((d?.rotation ?? 0) * 180 / Math.PI) , rotRaw: d?.rotation, rotateTowards: JSON.stringify(d?.rotateTowards ?? null)?.slice(0, 120), pos: JSON.stringify(d?.source?.document?.x ?? d?.position ?? null).slice(0, 60), stretch: JSON.stringify(d?.stretchTo ?? null).slice(0,160), src: e.source?.x, tgt: e.target?.x, sprite: [Math.round(e.sprite?.x ?? NaN), Math.round(e.sprite?.y ?? NaN), Math.round(e.sprite?.angle ?? NaN)] }); break; } await sleep(50); } return seen[0] ?? null; };
      // melee pela janela de ataque
      const p = im.rollAttack({ event: { shiftKey: false } });
      let el; for (let i = 0; i < 60 && !(el = document.querySelector(".op-attack-dialog")); i++) await sleep(100);
      await sleep(400);
      const click = Date.now(); el.querySelector("button[data-action=attack]").click();
      let closed = null; for (let i = 0; i < 40; i++) { if (!document.querySelector(".op-attack-dialog")) { closed = Date.now() - click; break; } await sleep(25); }
      const w = await watch(); await p;
      out.melee = { fechouEm: closed, efeito: w, atacanteX: 250, alvoX: 350 };
      await sleep(3000);
      // tiro
      await Sequencer.EffectManager.endEffects?.();
      const p2 = ig.rollAttack({ event: { shiftKey: true } }); const w2 = await watch(); await p2;
      out.tiro = w2;
    } catch (e) { out.erro = String(e.stack) } finally {
      await ChatMessage.deleteDocuments(game.messages.contents.filter(m => m.timestamp > t0 - 5000).map(m => m.id));
      if (prevScene) await game.scenes.get(prevScene)?.view();
      await scene?.delete(); await a?.delete(); await b?.delete();
    }
    return JSON.stringify(out);
  });
}
