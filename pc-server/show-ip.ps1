$ErrorActionPreference = "Stop"

Write-Host "PC Name: $env:COMPUTERNAME" -ForegroundColor Cyan

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -ne "WellKnown" -and
    $_.ValidLifetime -ne ([TimeSpan]::Zero)
  } |
  Sort-Object -Property InterfaceMetric, IPAddress

if (-not $ips) {
  Write-Host "No IPv4 addresses found (are you connected to Wi-Fi/LAN?)." -ForegroundColor Yellow
  exit 0
}

Write-Host "Candidate LAN IPv4 addresses:" -ForegroundColor Cyan
foreach ($ip in $ips) {
  $ifAlias = $ip.InterfaceAlias
  $addr = $ip.IPAddress
  Write-Host "- $addr  ($ifAlias)"
}

Write-Host "\nTry these as server URL from Android:" -ForegroundColor Cyan
foreach ($ip in $ips) {
  Write-Host "  http://$($ip.IPAddress):8765" 
}

Write-Host "\nTip: You may also try using the PC name (works on many home LANs):" -ForegroundColor Cyan
Write-Host "  http://$env:COMPUTERNAME:8765" 
