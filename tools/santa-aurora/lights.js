async page => page.evaluate(async () => {
  const P = await (await fetch("/assets/santa-aurora/lights-payload.json?" + Date.now())).json();
  const log = [];
  for (const [name, L] of Object.entries(P)) for (const s of game.scenes.filter(s => s.folder && s.background.src.endsWith(`/${name}-8000x5800.webp`))) {
    const off = s.dimensions.sceneRect, gs = s.grid.size, gd = s.grid.distance;
    const old = s.lights.map(l => l.id);
    if (old.length) await s.deleteEmbeddedDocuments("AmbientLight", old);
    const docs = L.map(([x, y, r]) => {
      const dim = (r * 4 / gs) * gd;
      return { x: Math.round(off.x + x * 4), y: Math.round(off.y + y * 4), config: { color: "#ffd9a0", bright: Math.round(dim * 0.35 * 10) / 10, dim: Math.round(dim * 10) / 10, alpha: 0.22, attenuation: 0.6, luminosity: 0.5, angle: 360, darkness: { min: 0.2, max: 1 } } };
    });
    await s.createEmbeddedDocuments("AmbientLight", docs);
    log.push(`${s.name}: ${docs.length} (removidas ${old.length}) dist=${gd}`);
  }
  return JSON.stringify(log);
})
