# Roda o Foundry como servidor local (sem janela Electron) e abre no navegador.
# Depois de editar o codigo: F5 no navegador. Nao precisa reiniciar nada.
# FECHE o app desktop do Foundry antes (a pasta de dados e travada por um processo so).
param([int]$Port = 30000)

$install = "C:\Users\Geh\VTT\Foundry Virtual Tabletop"
$exe  = Join-Path $install "Foundry Virtual Tabletop.exe"
$main = Join-Path $install "resources\app\main.js"
$data = Join-Path $env:LOCALAPPDATA "FoundryVTT"

# O Foundry v14 exige Node 24; usamos o Node embutido no executavel do app.
$env:ELECTRON_RUN_AS_NODE = "1"
$url = "http://localhost:$Port"
Start-Job { Start-Sleep 8; Start-Process $using:url } | Out-Null
& $exe -r (Join-Path $PSScriptRoot "no-electron.cjs") $main --dataPath="$data" --port=$Port
