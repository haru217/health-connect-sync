param(
  [string]$Out = "../docs/data/summary.json",
  [switch]$RelativeDates
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$args = @("export_public_summary.py", "--out", $Out)
if ($RelativeDates) {
  $args += "--relative-dates"
}

python @args
