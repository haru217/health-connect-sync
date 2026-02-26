param(
  [Parameter(Mandatory = $true)]
  [string]$TaskId,

  [Parameter(Mandatory = $true)]
  [ValidateSet("todo", "in_progress", "blocked", "done")]
  [string]$Status,

  [Parameter(Mandatory = $true)]
  [string]$Actor,

  [string]$DashboardPath = "ops/CEO_DASHBOARD.html"
)

if (-not (Test-Path $DashboardPath)) {
  throw "Dashboard file not found: $DashboardPath"
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$stamp = switch ($Status) {
  "todo" { "—" }
  "done" { "$Actor @ $timestamp" }
  "blocked" { "$Actor (blocked)" }
  default { "$Actor (進行中)" }
}

$lines = Get-Content -Path $DashboardPath -Encoding UTF8
$updated = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "data-id=`"$([regex]::Escape($TaskId))`"") {
    $line = $lines[$i]
    $line = [regex]::Replace($line, 'data-default="[^"]*"', "data-default=`"$Status`"")
    if ($line -match 'data-stamp="[^"]*"') {
      $line = [regex]::Replace($line, 'data-stamp="[^"]*"', "data-stamp=`"$stamp`"")
    }
    else {
      $line = $line -replace 'data-default="[^"]*"', "data-default=`"$Status`" data-stamp=`"$stamp`""
    }
    $line = [regex]::Replace($line, '<div class="stamp">[^<]*</div>', "<div class=`"stamp`">$stamp</div>")
    $lines[$i] = $line
    $updated = $true
    break
  }
}

if (-not $updated) {
  throw "TaskId not found: $TaskId"
}

Set-Content -Path $DashboardPath -Value $lines -Encoding UTF8
Write-Output "Updated $TaskId -> $Status by $Actor"
