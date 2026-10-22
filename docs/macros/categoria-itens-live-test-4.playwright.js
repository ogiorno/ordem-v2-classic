async page => {
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = {}; let a;
    try {
      a = await Actor.create({ name: "ZZ categoria geral", type: "agent", system: { class: "specialist" } });
      await a.update({ "system.patent.prestigePoints": 20 });
      const [g] = await a.createEmbeddedDocuments("Item", [{ name: "ZZ Equip", type: "generalEquipment", system: { category: 2 } }]);
      const abil = async (pack, rx) => (await game.packs.get("ordem-v2-classic." + pack).getDocuments()).find(d => rx.test(d.name));
      a.sheet.render({ force: true }); await sleep(2500);
      a.sheet.element.querySelector('[data-tab="inventory"]')?.click(); await sleep(500);
      const pill = async l => { await sleep(900); out[l] = [...a.sheet.element.querySelectorAll(".op-cat-pill, .badge-cat-input")].map(e => (e.value ?? e.textContent).trim() + (e.classList.contains("is-over") ? "!" : "")); out[l + "_lim"] = [...a.sheet.element.querySelectorAll(".op-cat-limit")].map(e => e.textContent.replace(/\s+/g, " ").trim()).join("|"); };
      await pill("1_base_II");
      const [rm] = await a.createEmbeddedDocuments("Item", [(await abil("pathSpecialist", /Remend/)).toObject()]); await pill("2_Remendao");
      await rm.delete(); await g.update({ "system.favorite": true });
      await a.createEmbeddedDocuments("Item", [(await abil("originPowers", /Ferramentas Favoritas/)).toObject()]); await pill("3_FerramentasFavoritas");
      await g.update({ "system.modifications": [] });
      g.sheet.render({ force: true }); await sleep(1500);
      out.itemSheetTemFavorito = !!g.sheet.element.querySelector('[name="system.favorite"]');
      g.sheet.close();
    } catch (e) { out.erro = String(e.stack) } finally { a?.sheet?.close(); await a?.delete(); out.sobras = game.actors.filter(x => x.name.startsWith("ZZ categoria")).length; }
    return JSON.stringify(out);
  });
}
