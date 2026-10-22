async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const katana = (await game.packs.get("ordem-v2-classic.armaments").getDocuments()).find(w => /katana/i.test(w.name));
    const a = await Actor.create({ name: "ZZ categoria", type: "agent", system: { class: "fighter" } });
    out.id = a.id;
    const [it] = await a.createEmbeddedDocuments("Item", [katana.toObject()]);
    out.baseCat = it.system.category;
    await it.update({ "system.modifications": ["certeira", "perigosa"] });
    out.mods = Array.from(game.actors.get(a.id).items.get(it.id).system.modifications);
    await a.update({ "system.patent.prestigePoints": 0 });
    a.sheet.render({ force: true });
    await sleep(2500);
    const root = a.sheet.element;
    root.querySelector('[data-tab="inventory"]')?.click();
    await sleep(600);
    const rows = [...root.querySelectorAll(".op-cat-limit")].map(e => ({ t: e.textContent.replace(/\s+/g, " ").trim(), over: e.classList.contains("is-over"), color: getComputedStyle(e.querySelector(".op-cat-used")).color }));
    out.rows = rows;
    const pill = root.querySelector(".op-cat-pill");
    out.pill = pill && { t: pill.textContent, over: pill.classList.contains("is-over"), tip: pill.dataset.tooltip, bg: getComputedStyle(pill).backgroundColor };
    return JSON.stringify(out);
  });
}
