async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = Date.now(); const out = {}; let scene, a, b; const prevScene = canvas.scene?.id; const origRand = CONFIG.Dice.randomUniform;
    const lastCardBtn = () => [...document.querySelectorAll('button[data-action="damage"]')].at(-1);
    const resultText = () => [...document.querySelectorAll(".hit-result")].at(-1)?.textContent.replace(/\s+/g, " ").trim();
    try {
      const w = (await game.packs.get("ordem-v2-classic.armaments").getDocuments()).find(x => x.type === "armament" && x.system.types.rangeType.name === "melee");
      a = await Actor.create({ name: "ZZ comp atk", type: "agent", system: { class: "fighter" } });
      b = await Actor.create({ name: "ZZ comp alvo", type: "agent", system: { class: "fighter" } });
      const [it] = await a.createEmbeddedDocuments("Item", [w.toObject()]);
      scene = await Scene.create({ name: "ZZ comp cena", width: 3000, height: 1000, grid: { size: 100 } });
      const [ta, tb] = await scene.createEmbeddedDocuments("Token", [{ ...a.prototypeToken.toObject(), actorId: a.id, x: 100, y: 100 }, { ...b.prototypeToken.toObject(), actorId: b.id, x: 200, y: 100 }]);
      await scene.view(); await sleep(2500);
      ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); await sleep(800);
      const target = () => canvas.tokens.placeables.find(t => t.actor?.id === b.id).setTarget(true, { releaseOthers: true, groupSelection: false });
      target();
      const attack = async (u) => { CONFIG.Dice.randomUniform = () => u; await it.roll(); await sleep(1200); await it.rollAttack({ event: { shiftKey: true } }); await sleep(2800); CONFIG.Dice.randomUniform = origRand; };

      // 1) 20 natural adjacente: acerto crítico, sem "vs Defesa", botão brilha, clique normaliza
      await attack(0.0001);
      const btn = lastCardBtn();
      out.crit20 = { texto: resultText(), temVsDefesa: !!document.querySelector(".vs-defense"), classe: btn?.className, etiqueta: btn && getComputedStyle(btn, "::before").content };
      btn?.click(); await sleep(700);
      out.crit20.aposClique = { classe: btn?.className, etiqueta: btn && getComputedStyle(btn, "::before").content, sombra: btn?.style.boxShadow };

      // 2) 1 natural: erro crítico, sem brilho
      await attack(0.9999);
      const b2 = lastCardBtn();
      out.nat1 = { texto: resultText(), temVsDefesa: !!document.querySelector(".vs-defense"), classeBotao: b2?.className };

      // 3) crítico que erra: sem brilho (força o resultado no cartão)
      await attack(0.0001);
      const card = game.messages.contents.filter(m => m.timestamp > t0 && m.getFlag("ordem-v2-classic", "hitResult") && m.rolls.length === 0).at(-1);
      const hr = foundry.utils.deepClone(card.getFlag("ordem-v2-classic", "hitResult"));
      await card.setFlag("ordem-v2-classic", "hitResult", { ...hr, hit: false, isCritical: true }); await sleep(1500);
      out.critErrou = { classeBotao: lastCardBtn()?.className, texto: resultText() };

      // 4) alvo longe (corpo a corpo): janela de ataque, clique avisa e a janela fica aberta
      await tb.update({ x: 1200 }); await sleep(800); target();
      const p = it.rollAttack({ event: { shiftKey: false } });
      let el; for (let i = 0; i < 60 && !(el = document.querySelector(".op-attack-dialog")); i++) await sleep(100);
      await sleep(600);
      el.querySelector("button[data-action=attack]").click(); await sleep(700);
      out.longe = { janelaAberta: !!document.querySelector(".op-attack-dialog"), toast: [...document.querySelectorAll("#notifications li, .notification")].map(n => n.textContent.trim().slice(0, 90)) };
      document.querySelectorAll(".op-attack-dialog").forEach(e => e.closest(".application")?.querySelector("[data-action=close]")?.click());
      await p.catch(() => {});
      // shift+clique longe também avisa
      const r = await it.rollAttack({ event: { shiftKey: true } }); out.longeShift = { resultado: r };
    } catch (e) { out.erro = String(e.stack) } finally {
      CONFIG.Dice.randomUniform = origRand;
      document.querySelectorAll(".op-attack-dialog").forEach(e => e.closest(".application")?.querySelector("[data-action=close]")?.click());
      await ChatMessage.deleteDocuments(game.messages.contents.filter(m => m.timestamp > t0).map(m => m.id));
      if (prevScene) await game.scenes.get(prevScene)?.view();
      await scene?.delete(); await a?.delete(); await b?.delete();
    }
    return JSON.stringify(out);
  });
}
