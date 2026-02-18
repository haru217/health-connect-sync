param(
  [string]$PendingPath = "..\pending\2026-02-18.jsonl"
)

$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $dir ".env"
if (-not (Test-Path $envPath)) { throw ".env not found. Create it from .env.example and set API_KEY" }

$apiKeyLine = (Get-Content $envPath | Where-Object { $_ -match '^API_KEY=' } | Select-Object -First 1)
if (-not $apiKeyLine) { throw "API_KEY missing in .env" }
$apiKey = $apiKeyLine.Split('=',2)[1].Trim()

$pendingFull = Resolve-Path (Join-Path $dir $PendingPath)

Get-Content $pendingFull | ForEach-Object {
  if (-not $_.Trim()) { return }
  $obj = $_ | ConvertFrom-Json
  $date = $obj.local_date
  $items = @()
  foreach($it in $obj.items){
    $it | Add-Member -NotePropertyName local_date -NotePropertyValue $date -Force
    $items += $it
  }
  $body = @{ items = $items } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "http://localhost:8765/api/nutrition/log" -Headers @{"X-Api-Key"=$apiKey} -ContentType "application/json" -Body $body | Out-Null
}

Write-Host "Imported pending from $pendingFull" -ForegroundColor Green
