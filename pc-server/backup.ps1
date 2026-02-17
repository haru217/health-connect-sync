param(
  [string]$DbPath = "hc_sync.db",
  [string]$OutDir = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DbPath)) {
  throw "DB not found: $DbPath"
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$out = Join-Path $OutDir "hc_sync_$ts.db"

Copy-Item -Path $DbPath -Destination $out -Force
Write-Host "Backed up: $DbPath -> $out" -ForegroundColor Green
