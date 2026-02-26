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
  "todo" { "" }
  "done" { "$Actor @ $timestamp" }
  "blocked" { "$Actor (blocked)" }
  default { "$Actor (in_progress)" }
}

function Escape-JsDoubleQuotedString {
  param([Parameter(Mandatory = $true)][string]$Value)
  return ($Value -replace '\\', '\\\\' -replace '"', '\"')
}

$content = Get-Content -Path $DashboardPath -Raw -Encoding UTF8
$escapedTaskId = [regex]::Escape($TaskId)
$objectPattern = '\{(?<body>[^{}]*id:\s*"' + $escapedTaskId + '"[^{}]*)\}'
$match = [regex]::Match($content, $objectPattern)

if (-not $match.Success) {
  throw "TaskId not found: $TaskId"
}

$body = $match.Groups["body"].Value
$body = [regex]::Replace($body, 'defaultStatus:\s*"[^"]*"', 'defaultStatus: "' + $Status + '"', 1)

if ($Status -eq "todo") {
  $body = [regex]::Replace($body, ',\s*defaultStamp:\s*"[^"]*"', '', 1)
}
else {
  $stampEscaped = Escape-JsDoubleQuotedString -Value $stamp
  if ($body -match 'defaultStamp:\s*"[^"]*"') {
    $body = [regex]::Replace($body, 'defaultStamp:\s*"[^"]*"', 'defaultStamp: "' + $stampEscaped + '"', 1)
  }
  else {
    $body = [regex]::Replace($body, 'defaultStatus:\s*"[^"]*"', '$0, defaultStamp: "' + $stampEscaped + '"', 1)
  }
}

$updatedObject = '{' + $body + '}'
$newContent = $content.Substring(0, $match.Index) + $updatedObject + $content.Substring($match.Index + $match.Length)

Set-Content -Path $DashboardPath -Value $newContent -Encoding UTF8
Write-Output "Updated $TaskId -> $Status by $Actor"
