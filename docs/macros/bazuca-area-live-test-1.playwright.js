async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const mine = new Set(); const hook = Hooks.on('createChatMessage', m => { if (m.author?.id === game.user.id) mine.add(m.id); }); const t0 = Date.now() - 2000; const out = {}; let scene; const actors = []; const prevScene = canvas.scene?.id;
    try {
      const baz = (await game.packs.get("ordem-v2-classic.armaments").getDocuments()).find(x => x.name === "Bazuca");
      const mk = async (n) => { const a = await Actor.create({ name: "ZZ " + n, type: "agent", system: { class: "fighter" } }); actors.push(a); return a; };
      const atk = await mk("atirador"), v1 = await mk("alvo dentro"), v2 = await mk("alvo borda"), v3 = await mk("alvo fora");
      const [it] = await atk.createEmbeddedDocuments("Item", [baz.toObject()]);
      scene = await Scene.create({ name: "ZZ baz cena", width: 3000, height: 1500, grid: { size: 100 } });
      const tk = (a, c, r) => ({ ...a.prototypeToken.toObject(), actorId: a.id, x: c * 100, y: r * 100 });
      // atirador (1,5); ponto escolhido: célula (8,5) => centro (850,550); dentro: (8,5)+adjacente (9,5); borda: (10,5)=2 quadrados; fora: (12,5)
      await scene.createEmbeddedDocuments("Token", [tk(atk, 1, 5), tk(v1, 8, 5), tk(v2, 10, 5), tk(v3, 13, 5)]);
      await scene.view(); await sleep(2500);
      ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
      canvas.tokens.releaseAll(); canvas.tokens.placeables.find(t => t.actor?.id === atk.id).control();
      for (const t of [...game.user.targets]) t.setTarget(false, { releaseOthers: false, groupSelection: true }); await sleep(300);
      const { promptAttackOptions } = await import('/systems/ordem-v2-classic/module/helpers/attack-options.mjs'); const p = promptAttackOptions(it);
      let el; for (let i = 0; i < 60 && !(el = document.querySelector(".op-attack-dialog")); i++) await sleep(100);
      await sleep(500);
      const pointRadio = el.querySelector('input[name=weaponMode][value=point]'); pointRadio.click(); await sleep(400);
      out.botao = { visivel: !el.querySelector("[data-area-row]").hidden, nota: el.querySelector("[data-area-note]").textContent, bloqueio: el.querySelector("[data-range-note]").textContent };
      // escolhe a área clicando no mapa (centro da célula 8,5)
      el.querySelector("[data-action=pick-area]").click(); await sleep(400);
      out.dialogOculto = getComputedStyle(el.closest(".application") ?? el).visibility;
      const view = canvas.app.view; const rect = view.getBoundingClientRect();
      const toClient = (wx, wy) => { const t = canvas.stage.worldTransform; return { x: rect.left + t.a * wx + t.tx, y: rect.top + t.d * wy + t.ty }; };
      const c = toClient(850, 550);
      view.dispatchEvent(new PointerEvent("pointermove", { clientX: c.x, clientY: c.y, bubbles: true }));
      await sleep(200);
      view.dispatchEvent(new PointerEvent("pointerdown", { clientX: c.x, clientY: c.y, button: 0, bubbles: true }));
      await sleep(600);
      out.depoisDeEscolher = { dialogVisivel: getComputedStyle(el.closest(".application") ?? el).visibility, nota: el.querySelector("[data-area-note]").textContent, alcance: el.querySelector("[data-range-note]").textContent, botaoTexto: el.querySelector("[data-action=pick-area]").textContent.trim() };
      el.querySelector("button[data-action=attack]").click();
      const cfg = await p; out.cfgArea = cfg?.weapon?.areaPoint; await it.roll(); await it.rollAreaPoint({ attackOptions: cfg }); await sleep(5000);
      const rep = game.messages.contents.filter(m => mine.has(m.id)).find(m => /weapon-area-report/.test(m.content));
      out.relatorio = rep?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      out.areaAnim = rep?.getFlag("ordem-v2-classic", "areaAnim");
      out.efeitosAtivos = Sequencer.EffectManager.effects.map(e => String(e.data?.file).slice(-32));
      out.circulo = !!canvas.interface.children.find(ch => ch instanceof PIXI.Graphics);
      out.pv = Object.fromEntries([v1, v2, v3].map(a => [a.name, game.actors.get(a.id).system.PV.value + "/" + game.actors.get(a.id).system.PV.max]));
    } catch (e) { out.erro = String(e.stack) } finally {
      document.querySelectorAll(".op-attack-dialog").forEach(e => e.closest(".application")?.querySelector("[data-action=close]")?.click());
      Hooks.off('createChatMessage', hook); await ChatMessage.deleteDocuments([...mine].filter(id => game.messages.get(id)));
      if (prevScene) await game.scenes.get(prevScene)?.view();
      await scene?.delete(); for (const a of actors) await a.delete();
    }
    return JSON.stringify(out);
  });
}
