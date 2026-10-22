async page => {
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    const a = game.actors.get("rEIRWSp771uw88JT");
    const info = () => [...a.sheet.element.querySelectorAll(".op-cat-limit")].map(e => e.textContent.replace(/\s+/g, " ").trim() + (e.classList.contains("is-over") ? "!" : "")).join(" | ");
    const it = a.items.find(i => i.type === "armament");
    // 1) pela interface do item: marca uma modificação nova
    const ms = it.sheet.element.querySelector("multi-select");
    ms.select("cruel"); ms.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(1500);
    out.aposUI = Array.from(game.actors.get(a.id).items.get(it.id).system.modifications);
    out.fichaAposUI = info();
    // 2) patente maior: III deixa de ser vermelho
    await a.update({ "system.patent.prestigePoints": 100 });
    await sleep(1000);
    out.patente100 = info();
    out.pill100 = a.sheet.element.querySelector(".op-cat-pill")?.className;
    // 3) sem modificações: volta a categoria base
    await it.update({ "system.modifications": [] });
    await sleep(800);
    out.semMods = info();
    // 4) proteção modificada
    const prot = (await game.packs.get("ordem-v2-classic.protections").getDocuments())[0];
    const [p] = await a.createEmbeddedDocuments("Item", [prot.toObject()]);
    await p.update({ "system.modifications": ["reforcada", "blindada"] });
    await a.update({ "system.patent.prestigePoints": 0 });
    await sleep(1000);
    out.protecao = { nome: p.name, base: p.system.category, ficha: info(), pills: [...a.sheet.element.querySelectorAll(".op-cat-pill")].map(e => e.textContent + (e.classList.contains("is-over") ? "!" : "")) };
    // 5) acima de IV
    await it.update({ "system.category": 4, "system.modifications": ["cruel"] });
    await sleep(800);
    out.acimaIV = info();
    // limpeza
    a.sheet.close(); it.sheet.close();
    await a.delete();
    out.sobras = game.actors.filter(x => x.name.startsWith("ZZ")).length;
    return JSON.stringify(out);
  });
}
