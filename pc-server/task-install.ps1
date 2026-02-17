param(
  [string]$TaskName = "HC Sync Bridge",
  [string]$WorkDir = $(Resolve-Path .),
  [string]$RunScript = "run.ps1"
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $WorkDir $RunScript
if (-not (Test-Path $scriptPath)) {
  throw "Script not found: $scriptPath"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $WorkDir

# Trigger at logon (most reliable for user context)
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Settings: restart on failure
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Run only when user is logged on (so it can access user profile / network)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel LeastPrivilege

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Installed Scheduled Task: $TaskName" -ForegroundColor Green
Write-Host "Note: put API_KEY in .env so the task can start without prompts." -ForegroundColor Yellow
