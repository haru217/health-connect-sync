$ErrorActionPreference='Continue'
$root='C:\Users\senta\health-connect-sync'
$webDir=Join-Path $root 'web-app'
$tmp=Join-Path $root '.tmp-api-check'
if(Test-Path $tmp){Remove-Item $tmp -Recurse -Force}
New-Item -ItemType Directory -Path $tmp | Out-Null

function Get-Status([string]$url,[string]$out){
  $code = & curl.exe -sS -o $out -w "%{http_code}" $url
  return [int]$code
}

$ready=$false
for($i=1;$i -le 12;$i++){
  $hfile=Join-Path $tmp 'healthz.txt'
  $code=Get-Status 'http://127.0.0.1:8787/healthz' $hfile
  if($code -eq 200){ $ready=$true; break }
  Start-Sleep -Seconds ([Math]::Min([Math]::Pow(2,$i-1),20))
}

$seedStatus=$null
$seedErr=$null
if($ready){
  try{
    $seedStatus=[int](& curl.exe -sS -X POST -H "content-type: application/json" -d "{}" -o (Join-Path $tmp 'seed.json') -w "%{http_code}" "http://127.0.0.1:8787/api/dev/seed-mock")
  }catch{
    $seedStatus=-1
    $seedErr=$_.Exception.Message
  }
}

$paths=@(
  '/api/home-summary?date=2026-02-26',
  '/api/summary',
  '/api/connection-status',
  '/api/body-data?date=2026-02-26&period=week',
  '/api/sleep-data?date=2026-02-26&period=week',
  '/api/vitals-data?date=2026-02-26&period=week',
  '/api/nutrition/day?date=2026-02-26',
  '/api/supplements',
  '/api/profile',
  '/api/nutrients/targets?date=2026-02-26'
)

$eps=@()
$idx=0
foreach($p in $paths){
  $idx++
  $ofile=Join-Path $tmp ("ep"+$idx+".json")
  $url="http://127.0.0.1:8787"+$p
  $status=-1
  try{ $status=Get-Status $url $ofile }catch{}
  $keys=''
  $has=$false
  $err=$null
  if(Test-Path $ofile){
    try{
      $keys = node -e "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');let j=JSON.parse(s);if(Array.isArray(j)){console.log(j.length>0?'array':'');}else if(j&&typeof j==='object'){console.log(Object.keys(j).join(','));}else{console.log('');}" $ofile
      if($keys){ $has=$true }
    }catch{ $err='non-json' }
  }
  $eps += [pscustomobject]@{path=$p;status=$status;major_keys_exist=$has;top_level_keys=$keys;error=$err}
}

$stop='not_found'
try{
  $conn=Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if($conn){ Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue; $stop='stopped' }
}catch{ $stop='stop_failed' }

Push-Location $webDir
npm run build
$buildExit=$LASTEXITCODE
Pop-Location

[pscustomobject]@{
  healthz_ready=$ready
  seed_status=$seedStatus
  seed_error=$seedErr
  wrangler_stop=$stop
  build_exit=$buildExit
  endpoints=$eps
} | ConvertTo-Json -Depth 6
