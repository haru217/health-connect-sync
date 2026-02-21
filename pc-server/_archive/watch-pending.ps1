param(
  [int]$IntervalSec = 30,
  [string]$PendingDir = "..\pending",
  [string]$BaseUrl = "http://localhost:8765",
  [string]$ApiKey = "",
  [string]$PythonExe = "python",
  [switch]$Once
)

$ErrorActionPreference = "Continue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

if ($PythonExe -eq "python") {
  $venvPython = Join-Path $dir ".venv\Scripts\python.exe"
  if (Test-Path $venvPython) {
    $PythonExe = $venvPython
  }
}

Write-Host "[watch-pending] start interval=${IntervalSec}s baseUrl=$BaseUrl pendingDir=$PendingDir" -ForegroundColor Cyan

do {
  $args = @("import_pending.py", "--pending-dir", $PendingDir, "--base-url", $BaseUrl)
  if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
    $args += @("--api-key", $ApiKey)
  }

  & $PythonExe @args
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[watch-pending] importer exited with code $LASTEXITCODE" -ForegroundColor Yellow
  }

  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSec
} while ($true)
