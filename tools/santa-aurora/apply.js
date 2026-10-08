async page => page.evaluate(async () => {
  const payload = await (await fetch("/assets/santa-aurora/walls-payload.json?" + Date.now())).json();
  const report = [];
  const backup = {};
  for (const [name, items] of Object.entries(payload)) {
    const targets = game.scenes.filter(s => s.background.src?.endsWith(`/${name}-8000x5800.webp`) && s.folder);
    for (const scene of targets) {
    if (scene.width !== 8000 || scene.grid.size !== 200) await scene.update({ width: 8000, height: 5800, "grid.size": 200, padding: 0.25 });
    const off = { x: scene.dimensions.sceneRect.x, y: scene.dimensions.sceneRect.y };
    backup[scene.id] = scene.walls.map(w => w.toObject());
    const mk = it => ({ c: [it.c[0] + off.x, it.c[1] + off.y, it.c[2] + off.x, it.c[3] + off.y], move: 20, sight: it.k === "window" ? 10 : it.k === "rail" ? 0 : 20, light: it.k === "window" ? 10 : it.k === "rail" ? 0 : 20, sound: 20, door: it.k === "door" ? 1 : 0, ds: 0 });
    await scene.deleteEmbeddedDocuments("Wall", scene.walls.map(w => w.id));
    await scene.createEmbeddedDocuments("Wall", items.map(mk));
    report.push(`${scene.name} [${scene.folder.name}] off=${off.x},${off.y} grid=${scene.grid.size}: ${scene.walls.size} paredes`);
    }
  }
  window.__wallBackup = backup;
  return JSON.stringify({ report, backup: Object.keys(backup).length });
})
