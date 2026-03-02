param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("task", "screen", "decision", "approval")]
  [string]$Type,

  # task params
  [string]$TaskId,
  [ValidateSet("todo", "in_progress", "blocked", "done")]
  [string]$Status,

  # screen params
  [string]$Name,
  [ValidateSet("ok", "wip", "not_started")]
  [string]$ScreenStatus,
  [string]$Summary,

  # decision params
  [string]$Screen,
  [string]$Question,
  [string]$Options,
  [ValidateSet("high", "medium", "low")]
  [string]$Priority,

  # approval params
  [string]$Title,
  [string]$Description,

  # common
  [Parameter(Mandatory = $true)]
  [string]$Actor,

  [string]$DashboardPath = "ops/archive/CEO_DASHBOARD.html"
)

if (-not (Test-Path $DashboardPath)) {
  throw "Dashboard file not found: $DashboardPath"
}

$content = Get-Content -Path $DashboardPath -Raw -Encoding UTF8

function Escape-JsString {
  param([Parameter(Mandatory = $true)][string]$Value)
  return ($Value -replace '\\', '\\\\' -replace '"', '\"' -replace "'", "\\'")
}

switch ($Type) {
  "task" {
    if (-not $TaskId -or -not $Status) {
      throw "task requires -TaskId and -Status"
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $stamp = switch ($Status) {
      "todo" { "" }
      "done" { "$Actor @ $timestamp" }
      "blocked" { "$Actor (blocked)" }
      default { "$Actor (in_progress)" }
    }

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
      $stampEscaped = Escape-JsString -Value $stamp
      if ($body -match 'defaultStamp:\s*"[^"]*"') {
        $body = [regex]::Replace($body, 'defaultStamp:\s*"[^"]*"', 'defaultStamp: "' + $stampEscaped + '"', 1)
      }
      else {
        $body = [regex]::Replace($body, 'defaultStatus:\s*"[^"]*"', '$0, defaultStamp: "' + $stampEscaped + '"', 1)
      }
    }

    $updatedObject = '{' + $body + '}'
    $content = $content.Substring(0, $match.Index) + $updatedObject + $content.Substring($match.Index + $match.Length)
    Write-Output "Updated task $TaskId -> $Status by $Actor"
  }

  "screen" {
    if (-not $Name -or -not $ScreenStatus) {
      throw "screen requires -Name and -ScreenStatus (ok/wip/not_started)"
    }
    $escapedName = [regex]::Escape($Name)
    $screenPattern = '\{(?<body>[^{}]*name:\s*"' + $escapedName + '"[^{}]*)\}'
    $match = [regex]::Match($content, $screenPattern)

    if (-not $match.Success) {
      throw "Screen not found: $Name"
    }

    $body = $match.Groups["body"].Value
    $body = [regex]::Replace($body, 'status:\s*"[^"]*"', 'status: "' + $ScreenStatus + '"', 1)

    if ($Summary) {
      $summaryEscaped = Escape-JsString -Value $Summary
      $body = [regex]::Replace($body, 'summary:\s*"[^"]*"', 'summary: "' + $summaryEscaped + '"', 1)
    }

    $body = [regex]::Replace($body, 'owner:\s*"[^"]*"', 'owner: "' + (Escape-JsString -Value $Actor) + '"', 1)

    $updatedObject = '{' + $body + '}'
    $content = $content.Substring(0, $match.Index) + $updatedObject + $content.Substring($match.Index + $match.Length)
    Write-Output "Updated screen '$Name' -> $ScreenStatus by $Actor"
  }

  "decision" {
    if (-not $Screen -or -not $Question -or -not $Options) {
      throw "decision requires -Screen, -Question, and -Options (comma-separated)"
    }
    if (-not $Priority) { $Priority = "medium" }

    # Find the highest existing ID
    $idMatches = [regex]::Matches($content, 'id:\s*"D-(\d+)"')
    $maxId = 0
    foreach ($m in $idMatches) {
      $num = [int]$m.Groups[1].Value
      if ($num -gt $maxId) { $maxId = $num }
    }
    $newId = "D-" + ($maxId + 1).ToString("000")

    $optArray = ($Options -split ',') | ForEach-Object { '"' + (Escape-JsString -Value $_.Trim()) + '"' }
    $optStr = $optArray -join ", "

    $newEntry = '{ id: "' + $newId + '", screen: "' + (Escape-JsString -Value $Screen) + '", question: "' + (Escape-JsString -Value $Question) + '", options: [' + $optStr + '], priority: "' + $Priority + '", from: "' + (Escape-JsString -Value $Actor) + '", originalThread: "", answer: null }'

    # Insert before the closing bracket of CEO_DECISIONS array
    $arrayPattern = '(const CEO_DECISIONS = \[[\s\S]*?)\];'
    $arrayMatch = [regex]::Match($content, $arrayPattern)
    if (-not $arrayMatch.Success) {
      throw "CEO_DECISIONS array not found"
    }

    $existing = $arrayMatch.Groups[1].Value.TrimEnd()
    if ($existing -match ',\s*$' -or $existing -match '\[\s*$') {
      $replacement = $existing + "`n                " + $newEntry + "`n            ];"
    }
    else {
      $replacement = $existing + ",`n                " + $newEntry + "`n            ];"
    }

    $content = $content.Substring(0, $arrayMatch.Index) + $replacement + $content.Substring($arrayMatch.Index + $arrayMatch.Length)
    Write-Output "Added decision $newId for '$Screen' by $Actor"
  }

  "approval" {
    if (-not $Screen -or -not $Title -or -not $Description) {
      throw "approval requires -Screen, -Title, and -Description"
    }

    # Find the highest existing ID
    $idMatches = [regex]::Matches($content, 'id:\s*"A-(\d+)"')
    $maxId = 0
    foreach ($m in $idMatches) {
      $num = [int]$m.Groups[1].Value
      if ($num -gt $maxId) { $maxId = $num }
    }
    $newId = "A-" + ($maxId + 1).ToString("000")

    $newEntry = '{ id: "' + $newId + '", screen: "' + (Escape-JsString -Value $Screen) + '", title: "' + (Escape-JsString -Value $Title) + '", description: "' + (Escape-JsString -Value $Description) + '", status: "pending", from: "' + (Escape-JsString -Value $Actor) + '" }'

    $arrayPattern = '(const CEO_APPROVALS = \[[\s\S]*?)\];'
    $arrayMatch = [regex]::Match($content, $arrayPattern)
    if (-not $arrayMatch.Success) {
      throw "CEO_APPROVALS array not found"
    }

    $existing = $arrayMatch.Groups[1].Value.TrimEnd()
    if ($existing -match ',\s*$' -or $existing -match '\[\s*$') {
      $replacement = $existing + "`n                " + $newEntry + "`n            ];"
    }
    else {
      $replacement = $existing + ",`n                " + $newEntry + "`n            ];"
    }

    $content = $content.Substring(0, $arrayMatch.Index) + $replacement + $content.Substring($arrayMatch.Index + $arrayMatch.Length)
    Write-Output "Added approval $newId for '$Screen' by $Actor"
  }
}

Set-Content -Path $DashboardPath -Value $content -Encoding UTF8
