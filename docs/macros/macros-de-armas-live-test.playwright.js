async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = {}; let a, a2; const myMacros = () => game.macros.filter(m => m.flags?.ordem_v2_classic?.weaponMacro);
    const hb = () => foundry.utils.deepClone(game.user.hotbar);
    const before = hb(); const charAntes = game.user.character?.id ?? null; out.charAntes = charAntes; out.macrosAntes = myMacros().length;
    try {
      const weapons = (await game.packs.get("ordem_v2_classic.armaments").getDocuments()).filter(x => x.type === "armament");
      a = await Actor.create({ name: "ZZ hotbar", type: "agent", system: { class: "fighter" } });
      await game.user.update({ character: a.id }); await sleep(500);
      const [w1, w2] = await a.createEmbeddedDocuments("Item", [weapons[0].toObject(), weapons[1].toObject()]);
      await sleep(2000);
      out.aposAdicionar = { barra: hb(), macros: myMacros().map(m => ({ n: m.name, cmd: m.command.slice(-40) })), nomes: [w1.name, w2.name] };
      const [g] = await a.createEmbeddedDocuments("Item", [{ name: "ZZ geral", type: "generalEquipment" }]); await sleep(800);
      out.equipNaoGeraMacro = myMacros().length;
      await w1.delete(); await sleep(1500);
      out.aposRemoverUma = { barra: hb(), macros: myMacros().map(m => m.name) };
      await w1.parent?.items.get(w2.id)?.update({ name: "ZZ renomeada" }); await sleep(1200);
      out.aposRenomear = myMacros().map(m => m.name);
      await a.delete(); a = null; await sleep(1500);
      out.aposApagarAgente = { barra: hb(), macros: myMacros().length };
    } catch (e) { out.erro = String(e.stack) } finally {
      await game.user.update({ character: charAntes });
      await a?.delete(); await sleep(800);
      for (const m of myMacros()) if (m.name.startsWith("ZZ") || true) { /* sobras */ }
      out.sobrasMacros = myMacros().length; out.barraFinal = hb(); out.barraIgualAntes = JSON.stringify(out.barraFinal) === JSON.stringify(before);
    }
    return JSON.stringify(out);
  });
}
