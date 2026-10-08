async page => page.evaluate(async () => {
  const ENTRY = game.journal.get("UCfiGa3CAxXJfirw") ? "UCfiGa3CAxXJfirw" : null;
  const LABEL = { terreo: "Térreo", "primeiro-andar": "Primeiro andar", subsolo: "Subsolo", mezanino: "Mezanino", sotao: "Sótão" };
  // [mapa baixo, nível baixo, pino (unid.), mapa alto, nível alto, pino]; unidades = 1/2000 da largura
  const L = [
    ["arquivo-municipal", "terreo", [1030, 450], "primeiro-andar", [940, 850]],
    ["arquivo-municipal", "primeiro-andar", [1040, 850], "sotao", [965, 900]],
    ["casa-17-do-canal", "terreo", [1015, 700], "primeiro-andar", [1085, 470]],
    ["casa-augusto", "subsolo", [830, 300], "terreo", [1010, 430]],
    ["casa-augusto", "terreo", [1010, 330], "primeiro-andar", [1270, 270]],
    ["casa-nair", "terreo", [1315, 760], "primeiro-andar", [1050, 880]],
    ["casa-helena", "terreo", [845, 640], "primeiro-andar", [1020, 360]],
    ["frigorifico-aurora", "subsolo", [1000, 140], "terreo", [1060, 150]],
    ["frigorifico-aurora", "terreo", [1765, 250], "mezanino", [910, 370]],
    ["garagem-ambulancias", "terreo", [1436, 400], "primeiro-andar", [1690, 950]],
    ["posto-sete-vidas", "terreo", [950, 280], "primeiro-andar", [865, 450]],
    ["radio-aurora-fm", "terreo", [190, 600], "primeiro-andar", [1005, 930]],
  ];
  const sceneOf = (folderId, map, lvl) => game.scenes.find(s => s.folder?.id === folderId && s.background.src.endsWith(`/${map === "casa-nair" ? "casa-nair" : map}-${lvl}-8000x5800.webp`));
  const folders = [...new Set(game.scenes.filter(s => s.folder && s.background.src.includes("/santa-aurora/") && s.width === 8000).map(s => s.folder.id))];
  const log = [];
  const pos = (s, p) => { const r = s.dimensions.sceneRect; return [Math.round(r.x + p[0] * 4), Math.round(r.y + p[1] * 4)]; };
  for (const fid of folders) for (const [map, lo, pLo, hi, pHi] of L) {
    const A = sceneOf(fid, map, lo), B = sceneOf(fid, map, hi);
    if (!A || !B) continue;
    // limpa o que este script criou antes
    for (const s of [A, B]) {
      const rs = s.regions.filter(r => r.getFlag("meu-modulo", "auto") === "escada").map(r => r.id);
      if (rs.length) await s.deleteEmbeddedDocuments("Region", rs.filter(id => s.regions.get(id)));
      const ns = s.notes.filter(n => n.getFlag("meu-modulo", "auto") === "escada").map(n => n.id);
      if (ns.length) await s.deleteEmbeddedDocuments("Note", ns);
    }
  }
  for (const fid of folders) for (const [map, lo, pLo, hi, pHi] of L) {
    const A = sceneOf(fid, map, lo), B = sceneOf(fid, map, hi);
    if (!A || !B) { continue; }
    const made = {};
    for (const [S, p, other, tag] of [[A, pLo, B, "up"], [B, pHi, A, "down"]]) {
      const [x, y] = pos(S, p);
      const [arr] = await S.createEmbeddedDocuments("Region", [{ name: `Chegada (${tag === "up" ? "vindo de " + LABEL[hi] : "vindo de " + LABEL[lo]})`, color: "#2ecc71", shapes: [{ type: "rectangle", x: x - 200, y: y + 120, width: 400, height: 160, hole: false }], flags: { "meu-modulo": { auto: "escada" } } }]);
      const [stair] = await S.createEmbeddedDocuments("Region", [{ name: `Escada p/ ${tag === "up" ? LABEL[hi] : LABEL[lo]}`, color: "#4a90d9", shapes: [{ type: "rectangle", x: x - 100, y: y - 100, width: 200, height: 200, hole: false }], flags: { "meu-modulo": { auto: "escada" } } }]);
      made[tag] = { S, x, y, arr, stair, tag };
    }
    for (const [from, to] of [[made.up, made.down], [made.down, made.up]]) {
      await from.stair.createEmbeddedDocuments("RegionBehavior", [{ type: "teleportToken", name: "Teletransporte", system: { destinations: [to.arr.uuid], choice: false, snap: false, placement: "random", revealed: false } }]);
      const text = from.tag === "up" ? `Subir ao ${LABEL[hi]}` : `Descer ao ${LABEL[lo]}`;
      await from.S.createEmbeddedDocuments("Note", [{ x: from.x, y: from.y, text, entryId: ENTRY, texture: { src: from.tag === "up" ? "icons/svg/upgrade.svg" : "icons/svg/downgrade.svg" }, iconSize: 80, fontSize: 28, flags: { "meu-modulo": { regionUuid: from.stair.uuid, auto: "escada" } } }]);
    }
    log.push(`${A.name} <-> ${B.name}`);
  }
  return JSON.stringify({ entry: ENTRY, log });
})
