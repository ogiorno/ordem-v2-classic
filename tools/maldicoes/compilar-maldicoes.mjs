// Compila só o pacote `curses` (sem mexer nos outros): packs/_source/curses -> packs/curses (e a cópia em Data/systems).
// Uso: node tools/maldicoes/compilar-maldicoes.mjs [--data]
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sys = path.join(root, "systems/ordem-v2-classic/packs");
await compilePack(path.join(sys, "_source/curses"), path.join(sys, "curses"));
console.log("compilado:", path.join(sys, "curses"));
if (process.argv.includes("--data")) {
	const data = path.join(process.env.LOCALAPPDATA, "FoundryVTT", "Data", "systems", "ordem-v2-classic", "packs", "curses");
	await compilePack(path.join(sys, "_source/curses"), data);
	console.log("compilado:", data);
}
