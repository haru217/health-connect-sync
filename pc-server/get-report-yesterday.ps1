$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $dir ".env"
if (-not (Test-Path $envPath)) { throw ".env not found. Create it from .env.example and set API_KEY" }

$apiKeyLine = (Get-Content $envPath | Where-Object { $_ -match '^API_KEY=' } | Select-Object -First 1)
if (-not $apiKeyLine) { throw "API_KEY missing in .env" }
$apiKey = $apiKeyLine.Split('=',2)[1].Trim()

$r = Invoke-RestMethod -Method Get -Uri "http://localhost:8765/api/report/yesterday" -Headers @{"X-Api-Key"=$apiKey}
$r.text
