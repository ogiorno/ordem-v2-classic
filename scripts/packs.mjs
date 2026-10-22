// Compila/extrai packs: modules/<id>/packs/_source/<pack>  <->  modules/<id>/packs/<pack>
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

const action = process.argv[2];
if (!["pack", "unpack"].includes(action)) {
  console.error("uso: node scripts/packs.mjs <pack|unpack>");
  process.exit(1);
}

for (const kind of ["modules", "systems"]) {
  if (!existsSync(kind)) continue;
  for (const pkg of readdirSync(kind, { withFileTypes: true }).filter(d => d.isDirectory())) {
    const base = path.join(kind, pkg.name, "packs");
    const srcRoot = path.join(base, "_source");
    if (!existsSync(srcRoot)) continue;
    for (const pack of readdirSync(srcRoot, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const src = path.join(srcRoot, pack.name);
      const dest = path.join(base, pack.name);
      console.log(`${action}: ${dest}`);
      // recursive/folders: as fontes são organizadas em subpastas (uma por pasta do compêndio); sem isso só os arquivos da raiz entram.
      if (action === "pack") await compilePack(src, dest, { recursive: true });
      else await extractPack(dest, src, { folders: true });
    }
  }
}
