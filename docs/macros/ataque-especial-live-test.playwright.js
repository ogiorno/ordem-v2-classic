async page => {
  return await page.evaluate(async () => {
    const out = [], actors = [], msgs = [];
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const dlg = async () => { for (let i = 0; i < 60; i++) { const el = document.querySelector(".op-attack-dialog"); if (el && el.querySelector("[data-pool]")) return el; await sleep(100); } return document.querySelector(".op-attack-dialog"); };
    const set = (el, v) => { el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); };
    try {
      const klass = (await game.packs.get("ordem_v2_classic.classes").getDocuments()).find(c => /combatente/i.test(c.name));
      const ae = (await game.packs.get("ordem_v2_classic.fighterPowers").getDocuments()).find(d => d.name === "Ataque Especial");
      const weapons = await game.packs.get("ordem_v2_classic.armaments").getDocuments();
      const wep = weapons.find(w => /^Faca$/i.test(w.name)) ?? weapons.find(w => w.system?.types?.rangeType?.name === "melee");
      out.push({ weapon: wep?.name, ae: ae?.name, aeFx: ae?.effects.map(e => e.flags?.ordem_v2_classic?.onUse) });
      for (const nivel of [1, 5, 11, 17, 20]) {
        for (const split of [[1, 0], [0, 1], "max-attack", "max-damage", "mixed"]) {
          const a = await Actor.create({ name: "ZZ ae n" + nivel, type: "agent", system: { class: "fighter", attributes: { str: { value: 3 }, dex: { value: 3 }, vit: { value: 3 }, int: { value: 1 }, pre: { value: 1 } } } });
          actors.push(a);
          await a.createEmbeddedDocuments("Item", [klass.toObject(), ae.toObject(), wep.toObject()]);
          await a.update({ "system.nivel.value": nivel, "system.skills.fighting.degree.label": "trained" });
          await sleep(1200);
          await a.update({ "system.PE.value": 40, "system.PD.value": 40 });
          await sleep(300);
          const actor = game.actors.get(a.id);
          const item = actor.items.find(i => i.type === "armament");
          const RES = actor.usingWithoutSanityRule ? "PD" : "PE";
          const before = actor.system[RES].value;
          const baseAtk = (await (async () => { const r = await new Roll("0").evaluate(); return 0; })());
          const p = item.rollAttack({ event: { shiftKey: false } });
          const el = await dlg();
          const row = el?.querySelector("[data-pool]");
          const r = { nivel, split: JSON.stringify(split), perRound: actor.system[RES].perRound, rowFound: !!row, max: row?.dataset.max, abilityMax: row?.dataset.abilityMax, limit: row?.dataset.limit };
          if (row) {
            const selA = row.querySelector('select[name$=".attack"]'), selD = row.querySelector('select[name$=".damage"]');
            r.attackOptions = [...selA.options].map(o => o.textContent.trim() + (o.disabled ? "x" : "")).join("|");
            const max = Number(row.dataset.max);
            let [x, y] = Array.isArray(split) ? split : split === "max-attack" ? [max, 0] : split === "max-damage" ? [0, max] : [Math.ceil(max / 2), Math.floor(max / 2)];
            x = Math.min(x, max); y = Math.min(y, max - x);
            set(selA, x); set(selD, y); await sleep(200);
            r.picked = [x, y];
            r.rowCost = row.querySelector("[data-pool-cost]")?.textContent;
            r.dialogTotal = el.querySelector("[data-total]")?.textContent;
            r.dialogLeft = el.querySelector("[data-left]")?.textContent;
            r.flag = row.querySelector("[data-pool-flag]")?.textContent;
          }
          el?.querySelector("button[data-action=attack]")?.click();
          const res = await p;
          await sleep(300);
          const fresh = game.actors.get(a.id);
          r.spent = before - fresh.system[RES].value;
          const m = game.messages.contents.at(-1);
          r.attackFormula = res?.roll?.formula;
          r.lines = res?.attackOptions?.lines;
          r.cfgAttackFlat = res?.attackOptions?.attackFlat;
          r.cfgDamageFlat = res?.attackOptions?.damageFlat;
          r.cfgCost = res?.attackOptions?.cost;
          // dano com essas opções
          const dmg = await item.rollDamage({ attackOptions: res?.attackOptions });
          r.damageFormula = dmg?.formula ?? game.messages.contents.at(-1)?.rolls?.[0]?.formula;
          // exigido
          const [x, y] = r.picked ?? [0, 0];
          const total = x + y;
          const expectCost = total ? 2 + (total - 1) : 0;
          r.expect = { cost: expectCost, atk: x * 5, dmg: y * 5 };
          const bonusIn = (f, n) => n === 0 ? true : new RegExp("\\+ ?" + n + "(\\D|$)").test(f ?? "");
          r.okCost = r.spent === expectCost;
          r.okAtk = x === 0 || /\+ ?\d/.test(r.attackFormula ?? "") && (r.attackFormula ?? "").includes(String(x * 5));
          r.okDmg = y === 0 || (r.damageFormula ?? "").includes(String(y * 5));
          r.okLines = total === 0 || (r.lines ?? []).some(l => /Ataque Especial/.test(l));
          out.push(r);
          for (const mm of game.messages.contents.slice(-6)) if (String(mm.speaker?.alias ?? "").startsWith("ZZ")) msgs.push(mm.id);
        }
      }
    } catch (e) { out.push({ erro: String(e.stack) }); }
    finally {
      document.querySelectorAll(".op-attack-dialog").forEach(e => e.closest(".application")?.querySelector("[data-action=close]")?.click());
      for (const id of new Set(msgs)) await game.messages.get(id)?.delete();
      for (const a of actors) await game.actors.get(a.id)?.delete();
    }
    return JSON.stringify(out);
  });
}
