param(
  [string]$TaskName = "HealthConnectSync-Codex",
  [string]$StartTime = "09:00"
)

$ErrorActionPreference = "Stop"

$utf8Bootstrap = Join-Path $PSScriptRoot "enable_utf8_env.ps1"
if (Test-Path -LiteralPath $utf8Bootstrap) {
  . $utf8Bootstrap
}

$runner = Join-Path $PSScriptRoot "run_codex_task.ps1"
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Runner script not found: $runner"
}

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runner`""

& schtasks /Create `
  /TN $TaskName `
  /SC DAILY `
  /ST $StartTime `
  /TR $taskCommand `
  /F | Out-Null

& schtasks /Query /TN $TaskName /V /FO LIST
