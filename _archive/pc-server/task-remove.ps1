param(
  [string]$TaskName = "HC Sync Bridge"
)

$ErrorActionPreference = "Stop"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
Write-Host "Removed Scheduled Task: $TaskName" -ForegroundColor Green
