async page => {
  await page.setViewportSize({ width: 1500, height: 950 });
  return await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = { falhas: [] };
    let a;
    try {
      const M = await import("/systems/ordem-v2-classic/module/helpers/item-categories.mjs");
      const weapons = (await game.packs.get("ordem-v2-classic.armaments").getDocuments()).filter(w => w.type === "armament");
      const keys = Object.keys(M.WEAPON_MODIFICATIONS);
      out.armasNoCompendio = weapons.length;
      out.modificacoes = keys.length;
      // 1) toda arma x toda modificação: o schema aceita e a categoria sobe 1 por modificação
      let checks = 0;
      for (const w of weapons) {
        const base = w.system.category;
        for (let n = 0; n <= keys.length; n++) {
          const d = w.toObject();
          d.system.modifications = keys.slice(0, n);
          const clone = new Item.implementation(d);
          const got = M.effectiveCategory(clone);
          checks++;
          if (clone.system.modifications.size !== n || got !== base + n) out.falhas.push({ arma: w.name, n, base, got });
        }
      }
      out.verificacoes = checks;
      // 2) ficha real: katana + 2 modificações, depois cada habilidade que reduz
      a = await Actor.create({ name: "ZZ categoria reducao", type: "agent", system: { class: "fighter" } });
      const katana = weapons.find(w => /katana/i.test(w.name));
      const [it] = await a.createEmbeddedDocuments("Item", [katana.toObject()]);
      await it.update({ "system.modifications": ["certeira", "perigosa"] });
      await a.update({ "system.patent.prestigePoints": 20 });
      const abil = async (pack, rx) => (await game.packs.get("ordem-v2-classic." + pack).getDocuments()).find(d => rx.test(d.name));
      const A = {
        fav: await abil("pathFighter", /A Favorita/),
        tec: await abil("pathFighter", /T.cnica Secreta/),
        mat: await abil("pathFighter", /M.quina de Matar/),
        rem: await abil("pathSpecialist", /Remend/),
        ferr: await abil("originPowers", /Ferramentas Favoritas/),
      };
      out.habilidades = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v?.name ?? null]));
      const pills = () => [...a.sheet.element.querySelectorAll(".op-cat-pill")].map(e => e.textContent.trim() + (e.classList.contains("is-over") ? "!" : "") + " [" + e.dataset.tooltip + "]");
      const limits = () => [...a.sheet.element.querySelectorAll(".op-cat-limit")].map(e => e.textContent.replace(/\s+/g, " ").trim() + (e.classList.contains("is-over") ? "!" : "")).join(" | ");
      a.sheet.render({ force: true });
      await sleep(2500);
      a.sheet.element.querySelector('[data-tab="inventory"]')?.click();
      await sleep(500);
      const snap = async (label) => { await sleep(900); out[label] = { pills: pills(), limites: limits() }; };
      await snap("1_katana_I_mais_2_mods_operador");
      // marca como favorita e dá A Favorita
      await it.update({ "system.favorite": true });
      await snap("2_favorita_sem_habilidade");
      const give = async (doc) => { const [x] = await a.createEmbeddedDocuments("Item", [doc.toObject()]); return x; };
      const fa = await give(A.fav); await snap("3_A_Favorita");
      const te = await give(A.tec); await snap("4_Tecnica_Secreta");
      const ma = await give(A.mat); await snap("5_Maquina_de_Matar");
      // a redução abre espaço: com a katana a III−III=0 não conta; adicionar 4 mods e conferir que cabe
      await it.update({ "system.modifications": ["certeira", "perigosa", "cruel", "tatica"] });
      await snap("6_Maquina_de_Matar_com_4_mods");
      await ma.delete(); await te.delete(); await fa.delete();
      await snap("7_sem_habilidades_4_mods");
      // equipamento geral: Remendão e Ferramentas Favoritas
      const geral = (await game.packs.get("ordem-v2-classic.generalEquipments")?.getDocuments?.() ?? []).find(g => g.system.category >= 2);
      out.geralUsado = geral && { nome: geral.name, cat: geral.system.category };
      if (geral) {
        const g = await give(geral);
        await snap("8_equipamento_geral");
        const rm = await give(A.rem); await snap("9_Remendao");
        await rm.delete();
        await g.update({ "system.favorite": true });
        const ff = await give(A.ferr); await snap("10_Ferramentas_Favoritas");
      }
      // arma que não é favorita não é afetada
      await it.update({ "system.favorite": false, "system.modifications": [] });
      await give(A.mat);
      await snap("11_Maquina_de_Matar_arma_nao_favorita");
    } catch (e) { out.erro = String(e.stack ?? e); }
    finally {
      try { a?.sheet?.close(); await a?.delete(); } catch (e) { out.limpeza = String(e); }
      out.sobras = game.actors.filter(x => x.name.startsWith("ZZ categoria")).length;
    }
    return JSON.stringify(out);
  });
}
