param(
  [Parameter(Mandatory = $true)] [ValidateSet("kokomaru3","shinsekai")] [string]$Account,
  [Parameter(Mandatory = $true)] [ValidateSet("claude","codex")] [string]$Agent,
  [Parameter(Mandatory = $true)] [int]$Limit5h,
  [Parameter(Mandatory = $true)] [int]$Used5h,
  [Parameter(Mandatory = $true)] [int]$Limit1w,
  [Parameter(Mandatory = $true)] [int]$Used1w,
  [string]$Source = "manual"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $PSScriptRoot "rate_limits.json"
$jsPath = Join-Path $PSScriptRoot "rate_limits.js"

if (-not (Test-Path $jsonPath)) {
  throw "Missing $jsonPath"
}

$raw = Get-Content -Path $jsonPath -Raw
$data = $raw | ConvertFrom-Json

$now = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

$accountNode = $data.accounts.PSObject.Properties[$Account].Value
if (-not $accountNode) { throw "Unknown account: $Account" }
$agentNode = $accountNode.PSObject.Properties[$Agent].Value
if (-not $agentNode) { throw "Unknown agent: $Agent" }

$agentNode.limit5h = [Math]::Max(0, $Limit5h)
$agentNode.used5h = [Math]::Max(0, $Used5h)
$agentNode.limit1w = [Math]::Max(0, $Limit1w)
$agentNode.used1w = [Math]::Max(0, $Used1w)
$agentNode.updatedAt = $now
$data.updatedAt = $now
$data.source = "ops/rate_limits.json"

$json = $data | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($jsonPath, $json, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($jsPath, "window.CEO_RATE_LIMITS = $json;`n", (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Updated rate limits: $Account / $Agent @ $now"
