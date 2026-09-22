// Servidor Foundry + hot reload.
//  - editou JS/CSS/HBS/lang/etc.  -> navegador recarrega sozinho (via módulo "dev-reload")
//  - editou module.json/system.json/template.json -> reinicia o servidor e recarrega
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { watch, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const install = "C:\\Users\\Geh\\VTT\\Foundry Virtual Tabletop";
const exe = path.join(install, "Foundry Virtual Tabletop.exe");
const main = path.join(install, "resources", "app", "main.js");
const data = path.join(process.env.LOCALAPPDATA, "FoundryVTT");
const port = Number(process.env.FOUNDRY_PORT ?? 30000);
const reloadPort = 35729;
const manifests = new Set(["module.json", "system.json", "template.json"]);

// ---- servidor SSE: avisa o navegador para recarregar ----
const clients = new Set();
createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*"
  });
  res.write("retry: 1000\n\n");
  clients.add(res);
  req.on("close", () => clients.delete(res));
}).listen(reloadPort, "127.0.0.1");
const notify = () => { for (const c of clients) c.write("event: reload\ndata: 1\n\n"); };

// ---- processo do Foundry ----
let child = null;
let restarting = false;

function start() {
  console.log("[dev] iniciando Foundry em http://localhost:" + port);
  child = spawn(exe, ["-r", path.join(root, "scripts", "no-electron.cjs"), main,
    `--dataPath=${data}`, `--port=${port}`], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
  });
  child.on("exit", code => {
    if (restarting) { restarting = false; start(); return; }
    console.log("[dev] Foundry encerrou (código " + code + ")");
    process.exit(code ?? 0);
  });
}

function restart() {
  console.log("[dev] manifesto mudou -> reiniciando o servidor...");
  restarting = true;
  child.kill();
}

// ---- observa arquivos ----
const ignored = /(^|[\\/])(node_modules|\.git|packs)([\\/]|$)/;
let timer = null;
let needsRestart = false;
for (const dir of ["modules", "systems"]) {
  const full = path.join(root, dir);
  if (!existsSync(full)) continue;
  watch(full, { recursive: true }, (_evt, file) => {
    if (!file || ignored.test(file)) return;
    if (manifests.has(path.basename(file))) needsRestart = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (needsRestart) {
        needsRestart = false;
        restart();
        // o navegador reconecta quando o servidor voltar e recarrega (ver dev-reload)
      } else {
        console.log("[dev] arquivo mudou -> recarregando navegador");
        notify();
      }
    }, 200);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { child?.kill(); process.exit(0); });
process.on("exit", () => child?.kill());

start();
setTimeout(() => spawn("cmd", ["/c", "start", "", `http://localhost:${port}`], { stdio: "ignore" }), 8000);
