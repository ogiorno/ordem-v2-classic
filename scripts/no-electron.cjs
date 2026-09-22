// Faz o Foundry achar que roda em Node puro (servidor), mesmo usando o Node embutido do Electron.
try { delete process.versions.electron; } catch {}
if ("electron" in process.versions) {
  try { Object.defineProperty(process, "versions", { value: { ...process.versions, electron: undefined } }); } catch {}
}
if ("electron" in process.versions) {
  const v = { ...process.versions }; delete v.electron;
  Object.defineProperty(process, "versions", { value: v, configurable: true });
}
