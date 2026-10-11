async page => {
  return await page.evaluate(async () => {
    const out = [], actors = [], msgs = [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const dialogFor = async () => { for (let i = 0; i < 50; i++) { const app = [...foundry.applications.instances.values()].find(a => a.constructor.name === "SkillToolRollConfigurationDialog"); if (app?.element?.querySelector("button")) return app; await sleep(100); } return null; };
    try {
      const cp = game.packs.get("ordem_v2_classic.classes");
      const klass = (await cp.getDocuments()).find(c => /especialista/i.test(c.name));
      const perito = (await game.packs.get("ordem_v2_classic.specialistPowers").getDocuments()).find(d => d.name === "Perito");
      const run = async (label, nivel, pe, skill, check, expect) => {
        const a = await Actor.create({ name: "ZZ perito " + label, type: "agent", system: { class: "specialist" } });
        actors.push(a);
        await a.createEmbeddedDocuments("Item", [klass.toObject(), perito.toObject()]);
        await a.update({ "system.nivel.value": nivel, "system.PE.value": pe, "system.PD.value": pe, "system.skills.investigation.degree.label": "trained", "system.skills.fighting.degree.label": "trained" });
        await sleep(1500); await a.update({ "system.PE.value": pe, "system.PD.value": pe }); await sleep(500); const actor = game.actors.get(a.id);
        const RES = actor.usingWithoutSanityRule ? "PD" : "PE"; const peBefore = actor.system[RES].value;
        const p = actor.rollSkill({ skill }, {}, {});
        const app = await dialogFor();
        const cb = app?.element?.querySelector("input[name=perito]");
        const r = { label, nivel, pe, skill, checkbox: !!cb, labelText: cb?.closest(".form-group")?.querySelector("label")?.textContent?.trim() };
        if (cb && check) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); await sleep(300); }
        app?.element?.querySelector("button[data-action=normal]")?.click();
        const rolls = await p;
        await sleep(200);
        const fresh = game.actors.get(a.id);
        r.rolled = !!rolls?.length;
        r.formula = game.messages.contents.at(-1)?.rolls?.[0]?.formula;
        r.recurso = RES; r.peSpent = peBefore - fresh.system[RES].value;
        if (rolls?.length) { const m = game.messages.contents.at(-1); if (m) msgs.push(m.id); }
        r.ok = r.rolled === expect.rolled && r.peSpent === expect.spent && (!expect.die || r.formula.includes(expect.die)) && (expect.box === undefined || r.checkbox === expect.box);
        if (!r.ok) r.expected = expect;
        out.push(r);
        app?.close?.();
      };
      for (const [n, pe, die] of [[1, 2, "1d6"], [5, 3, "1d8"], [11, 4, "1d10"], [17, 5, "1d12"], [20, 5, "1d12"]]) {
        await run(`com perito n${n}`, n, 20, "investigation", true, { rolled: true, spent: pe, die, box: true });
        await run(`sem marcar n${n}`, n, 20, "investigation", false, { rolled: true, spent: 0, box: true });
      }
      await run("luta sem opção", 11, 20, "fighting", true, { rolled: true, spent: 0, box: false });
      await run("PE insuficiente", 11, 3, "investigation", true, { rolled: false, spent: 0, box: true });
      await run("PE exato", 11, 4, "investigation", true, { rolled: true, spent: 4, die: "1d10", box: true });
    } catch (e) { out.push({ erro: String(e.stack) }); }
    finally {
      for (const id of msgs) await game.messages.get(id)?.delete();
      for (const a of actors) await game.actors.get(a.id)?.delete();
      [...foundry.applications.instances.values()].filter(a => a.constructor.name === "SkillToolRollConfigurationDialog").forEach(a => a.close());
    }
    return JSON.stringify(out);
  });
}
