param(
  [int]$Port = 8765,
  [int]$DiscoveryPort = 8766
)

$ErrorActionPreference = "Stop"

$ruleName = "HC Sync Bridge TCP $Port"
$ruleNameUdp = "HC Sync Bridge UDP $DiscoveryPort"

# Remove existing rule with same name (safe update)
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Profile Private

# UDP discovery port
Get-NetFirewallRule -DisplayName $ruleNameUdp -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule `
  -DisplayName $ruleNameUdp `
  -Direction Inbound `
  -Action Allow `
  -Protocol UDP `
  -LocalPort $DiscoveryPort `
  -Profile Private

Write-Host "Firewall rules added: $ruleName, $ruleNameUdp (Private profile)" -ForegroundColor Green
