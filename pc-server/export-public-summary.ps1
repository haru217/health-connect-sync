param(
  [string]$Out = "../docs/data/summary.json",
  [switch]$KeepDates
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$args = @("export_public_summary.py", "--out", $Out)
if ($KeepDates) {
  $args += "--keep-dates"
}

python @args
