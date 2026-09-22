# Cria junctions de modules/* e systems/* em Foundry Data (idempotente).
$root = Split-Path $PSScriptRoot -Parent
$data = Join-Path $env:LOCALAPPDATA "FoundryVTT\Data"
foreach ($kind in "modules", "systems") {
  $src = Join-Path $root $kind
  if (-not (Test-Path $src)) { continue }
  foreach ($dir in Get-ChildItem $src -Directory) {
    $dest = Join-Path $data "$kind\$($dir.Name)"
    if (Test-Path $dest) { Write-Host "ja existe: $dest"; continue }
    New-Item -ItemType Junction -Path $dest -Target $dir.FullName | Out-Null
    Write-Host "linkado: $dest -> $($dir.FullName)"
  }
}
