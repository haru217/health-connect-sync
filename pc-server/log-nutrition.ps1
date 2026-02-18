param(
  [Parameter(Mandatory=$true)][string]$Alias,
  [double]$Count = 1
)

$ErrorActionPreference = "Stop"

$envPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) ".env"
if (-not (Test-Path $envPath)) { throw ".env not found. Create it from .env.example and set API_KEY" }

$apiKey = (Get-Content $envPath | Where-Object { $_ -match '^API_KEY=' } | Select-Object -First 1)
if (-not $apiKey) { throw "API_KEY missing in .env" }
$apiKey = $apiKey.Split('=',2)[1].Trim()

$body = @{ alias=$Alias; count=$Count } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8765/api/nutrition/log" -Headers @{"X-Api-Key"=$apiKey} -ContentType "application/json" -Body $body
Write-Host "Logged: $Alias x$Count" -ForegroundColor Green
