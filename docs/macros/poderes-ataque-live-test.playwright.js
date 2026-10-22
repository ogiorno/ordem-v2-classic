async page => {
  return await page.evaluate(async () => {
    const out = [], actors = [], msgs = [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const dlg = async () => { for (let i = 0; i < 60; i++) { const el = document.querySelector(".op-attack-dialog"); if (el) return el; await sleep(100); } return null; };
    const docs = async (pk) => (await game.packs.get("ordem-v2-classic." + pk).getDocuments());
    try {
      const classes = await docs("classes");
      const kl = rx => classes.find(c => rx.test(c.name));
      const weapons = (await docs("armaments")).filter(w => w.type === "armament");
      const W = w => ({ name: w.name, prof: w.system.proficiency, r: w.system.types?.rangeType?.name, s: w.system.types?.rangeType?.subRangeType, a: w.system.types?.ammunitionType });
      const pick = f => weapons.find(f);
      const wTacFire = pick(w => w.system.proficiency === "tacticalWeapons" && w.system.types.rangeType.subRangeType === "fire" && w.system.types.ammunitionType === "shortBullets");
      const wLong = pick(w => w.system.types.ammunitionType === "longBullets");
      const wKatana = pick(w => w.system.proficiency === "tacticalWeapons" && w.system.types.rangeType.name === "melee");
      const wBow = pick(w => w.system.proficiency === "tacticalWeapons" && w.system.types.rangeType.subRangeType === "shoot");
      const wSimpleMelee = pick(w => w.system.proficiency === "simpleWeapons" && w.system.types.rangeType.name === "melee");
      out.push({ armas: [wTacFire, wLong, wKatana, wBow, wSimpleMelee].map(w => w ? W(w) : null) });
      const find = async (pk, rx) => (await docs(pk)).find(d => rx.test(d.name));
      const powers = {
        balistica: await find("specialistPowers", /Bal.stica Avan/),
        ninja: await find("specialistPowers", /Ninja Urbano/),
        mira: await find("pathSpecialist", /Mira de Elite/),
        furtivo: await find("pathSpecialist", /Ataque Furtivo/),
        disparo: await find("pathSpecialist", /Disparo Letal/),
        potencia: await find("pathFighter", /Pot.ncia M.xima/),
        ae: await find("fighterPowers", /^Ataque Especial$/),
      };
      out.push({ poderes: Object.fromEntries(Object.entries(powers).map(([k, v]) => [k, v?.name ?? null])) });

      // cenário: classe, nível, poderes, arma; cliques: toggles marcados e divisão do pool
      const run = async (label, { klass, nivel = 20, power, weapon, toggle = false, pool = null, int = 1, expect }) => {
        const a = await Actor.create({ name: "ZZ poder " + label, type: "agent", system: { class: klass === "especialista" ? "specialist" : "fighter", attributes: { str: { value: 2 }, dex: { value: 2 }, vit: { value: 2 }, int: { value: int }, pre: { value: 1 } } } });
        actors.push(a);
        const items = [kl(new RegExp(klass, "i")).toObject(), power.toObject(), weapon.toObject()];
        if (pool) items.push(powers.ae.toObject());
        await a.createEmbeddedDocuments("Item", items);
        await a.update({ "system.nivel.value": nivel, "system.skills.fighting.degree.label": "trained", "system.skills.aim.degree.label": "trained" });
        await sleep(1300);
        await a.update({ "system.PE.value": 40, "system.PD.value": 40 });
        await sleep(300);
        const actor = game.actors.get(a.id);
        const item = actor.items.find(i => i.type === "armament");
        const RES = actor.usingWithoutSanityRule ? "PD" : "PE";
        const before = actor.system[RES].value;
        const p = item.rollAttack({ event: { shiftKey: false } });
        const el = await dlg();
        const r = { label, arma: weapon.name, nivel };
        r.opcoes = [...el.querySelectorAll(".op-ad-option, [data-pool], [data-auto], .op-ad-applied-row")].map(x => x.textContent.replace(/\s+/g, " ").trim().slice(0, 90));
        const box = [...el.querySelectorAll("input[type=checkbox][name^='opt.']")];
        r.checkboxes = box.length;
        if (toggle && box.length) { box[0].checked = true; box[0].dispatchEvent(new Event("change", { bubbles: true })); }
        if (pool) {
          const row = el.querySelector("[data-pool]");
          r.poolChoices = row ? [...row.querySelector('select[name$=".attack"]').options].map(o => o.textContent.trim()).join("|") : null;
          if (row) {
            const [x, y] = pool;
            const sa = row.querySelector('select[name$=".attack"]'), sd = row.querySelector('select[name$=".damage"]');
            sa.value = x; sa.dispatchEvent(new Event("change", { bubbles: true }));
            sd.value = y; sd.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        await sleep(250);
        el.querySelector("button[data-action=attack]")?.click();
        const res = await p;
        await sleep(300);
        const cfg = res?.attackOptions;
        r.cost = before - game.actors.get(a.id).system[RES].value;
        r.cfg = { attackFlat: cfg?.attackFlat, damageFlat: cfg?.damageFlat, damageTerms: cfg?.damageTerms, critMargin: cfg?.critMargin, lines: cfg?.lines, cost: cfg?.cost };
        const dmg = await item.rollDamage({ attackOptions: cfg });
        const dm = game.messages.contents.at(-1);
        r.dano = dmg?.formula ?? dm?.rolls?.[0]?.formula;
        r.chat = (game.messages.contents.slice(-3).map(m => m.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)));
        r.ok = expect(r);
        out.push(r);
        for (const mm of game.messages.contents.slice(-6)) if (String(mm.speaker?.alias ?? "").startsWith("ZZ")) msgs.push(mm.id);
        document.querySelectorAll(".op-attack-dialog").forEach(e => e.closest(".application")?.querySelector("[data-action=close]")?.click());
      };
      const has = (f, s) => (f ?? "").replace(/\s/g, "").includes(s);
      await run("balistica+pistola", { klass: "especialista", power: powers.balistica, weapon: wTacFire, expect: r => r.cfg.damageFlat === 2 && has(r.dano, "+2") && r.cost === 0 });
      await run("balistica+katana(nao)", { klass: "especialista", power: powers.balistica, weapon: wKatana, expect: r => !r.cfg.damageFlat });
      await run("ninja+katana", { klass: "especialista", power: powers.ninja, weapon: wKatana, expect: r => r.cfg.damageFlat === 2 });
      await run("ninja+arco", { klass: "especialista", power: powers.ninja, weapon: wBow, expect: r => r.cfg.damageFlat === 2 });
      await run("ninja+pistola(nao)", { klass: "especialista", power: powers.ninja, weapon: wTacFire, expect: r => !r.cfg.damageFlat });
      await run("ninja+faca simples(nao)", { klass: "especialista", power: powers.ninja, weapon: wSimpleMelee, expect: r => !r.cfg.damageFlat });
      await run("mira+fuzil longo int3", { klass: "especialista", power: powers.mira, weapon: wLong, int: 3, expect: r => has(r.dano, "+3") && !has(r.dano, "+2+2") });
      await run("mira+pistola(nao) int3", { klass: "especialista", power: powers.mira, weapon: wTacFire, int: 3, expect: r => !has(r.dano, "+3") });
      for (const [nivel, dado] of [[2, "1d6"], [8, "2d6"], [13, "3d6"], [20, "4d6"]])
        await run("furtivo n" + nivel, { klass: "especialista", nivel, power: powers.furtivo, weapon: wKatana, toggle: true, expect: r => r.cost === 1 && has(r.dano, "+" + dado) });
      await run("furtivo desmarcado", { klass: "especialista", nivel: 20, power: powers.furtivo, weapon: wKatana, toggle: false, expect: r => r.cost === 0 && !has(r.dano, "d6") || (r.cost === 0 && !has(r.dano, "4d6")) });
      await run("disparo letal+arma de fogo", { klass: "especialista", power: powers.disparo, weapon: wTacFire, toggle: true, expect: r => r.cfg.critMargin === 2 && r.cost === 1 });
      await run("disparo letal+katana(nao)", { klass: "especialista", power: powers.disparo, weapon: wKatana, toggle: true, expect: r => r.checkboxes === 0 });
      await run("potencia+AE corpo a corpo [1,3]", { klass: "combatente", nivel: 20, power: powers.potencia, weapon: wKatana, pool: [1, 3], expect: r => r.cfg.attackFlat === 10 && r.cfg.damageFlat >= 30 && r.cost === 5 });
      await run("potencia+AE a distância [1,3]", { klass: "combatente", nivel: 20, power: powers.potencia, weapon: wTacFire, pool: [1, 3], expect: r => r.cfg.attackFlat === 5 && r.cfg.damageFlat === 15 && r.cost === 5 });
    } catch (e) { out.push({ erro: String(e.stack) }); }
    finally {
      document.querySelectorAll(".op-attack-dialog").forEach(e => e.closest(".application")?.querySelector("[data-action=close]")?.click());
      for (const id of new Set(msgs)) await game.messages.get(id)?.delete();
      for (const a of actors) await game.actors.get(a.id)?.delete();
    }
    return JSON.stringify(out);
  });
}
