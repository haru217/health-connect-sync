param(
  [string]$ProjectRoot = "C:\Users\user\health-connect-sync",
  [string]$PromptFile = "$PSScriptRoot\codex_task_prompt.txt"
)

$ErrorActionPreference = "Continue"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
  throw "Project root not found: $ProjectRoot"
}

if (-not (Test-Path -LiteralPath $PromptFile)) {
  throw "Prompt file not found: $PromptFile"
}

$prompt = Get-Content -LiteralPath $PromptFile -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($prompt)) {
  throw "Prompt file is empty: $PromptFile"
}

$loginStatus = & codex login status 2>&1
if ($LASTEXITCODE -ne 0 -or $loginStatus -notmatch "Logged in") {
  throw "Codex login is not ready. Run 'codex login' once interactively."
}

$logDir = Join-Path $ProjectRoot "automation\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$eventsFile = Join-Path $logDir ("codex-events-" + $timestamp + ".jsonl")
$lastMessageFile = Join-Path $logDir ("codex-last-" + $timestamp + ".txt")

$prompt | & codex exec `
  -C $ProjectRoot `
  --skip-git-repo-check `
  --dangerously-bypass-approvals-and-sandbox `
  --json `
  -o $lastMessageFile `
  - 2>&1 | Tee-Object -FilePath $eventsFile

if ($LASTEXITCODE -ne 0) {
  throw "codex exec failed. See: $eventsFile"
}

Write-Output ("Completed. last=" + $lastMessageFile)
Write-Output ("events=" + $eventsFile)
