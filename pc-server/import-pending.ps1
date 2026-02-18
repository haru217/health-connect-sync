param(
  [string]$PendingDir = "..\pending",
  [string]$BaseUrl = "http://localhost:8765",
  [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

$pythonExe = Join-Path $dir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
  $pythonExe = "python"
}

$args = @("import_pending.py", "--pending-dir", $PendingDir, "--base-url", $BaseUrl)
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
  $args += @("--api-key", $ApiKey)
}

& $pythonExe @args
exit $LASTEXITCODE
