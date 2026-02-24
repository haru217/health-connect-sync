$ErrorActionPreference = "Continue"

# Force UTF-8 console IO to reduce mojibake in mixed PowerShell/Python workflows.
try {
  chcp 65001 > $null
} catch {
}

try {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [Console]::InputEncoding = $utf8NoBom
  [Console]::OutputEncoding = $utf8NoBom
  $OutputEncoding = $utf8NoBom
} catch {
}

# Ensure child Python processes keep UTF-8 behavior.
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
