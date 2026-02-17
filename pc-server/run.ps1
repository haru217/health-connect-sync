param(
  [int]$Port = 8765,
  [string]$HostAddr = "0.0.0.0",
  [string]$DbPath = "hc_sync.db"
)

$ErrorActionPreference = "Stop"

Write-Host "== Health Connect Sync Bridge (PC local server) ==" -ForegroundColor Cyan

# Show IP candidates (best-effort)
try {
  .\show-ip.ps1
  Write-Host "UDP discovery: enabled on 8766 (message: HC_SYNC_DISCOVER)" -ForegroundColor Cyan
} catch {
  Write-Host "(Could not list IPs: $($_.Exception.Message))" -ForegroundColor Yellow
}


# Load .env if present (API_KEY etc.)
$envPath = Join-Path (Get-Location) ".env"
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Length -ne 2) { return }
    $k = $parts[0].Trim()
    $v = $parts[1].Trim().Trim('"')
    if ($k) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

if (-not $env:API_KEY) {
  $env:API_KEY = Read-Host "Enter API_KEY (shared secret)"
}
if ([string]::IsNullOrWhiteSpace($env:API_KEY)) {
  throw "API_KEY is required (set API_KEY env var or pc-server/.env)"
}

$env:PORT = "$Port"
$env:HOST = $HostAddr
$env:DB_PATH = $DbPath

# Create venv if needed
if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python server.py
