param(
  [string]$ProjectId = "health-connect-bridge-haru",
  [string]$Region = "asia-northeast1",
  [string]$ServiceName = "hc-sync-api"
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing command '$name'. Install it and ensure it's in PATH."
  }
}

Write-Host "== Health Connect Sync Bridge deploy ==" -ForegroundColor Cyan

Require-Command gcloud

# Login & set project
Write-Host "Setting gcloud project: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId

# Enable APIs
Write-Host "Enabling APIs..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com

# Secrets
$tokenPepper = Read-Host "Enter TOKEN_PEPPER (random long string)"
if ([string]::IsNullOrWhiteSpace($tokenPepper)) { throw "TOKEN_PEPPER required" }

$registerKey = Read-Host "Optional REGISTER_KEY (leave blank to skip)"

# Deploy
Push-Location "$PSScriptRoot\..\server"
try {
  $envVars = "TOKEN_PEPPER=$tokenPepper,REGISTER_ENABLED=true"
  if (-not [string]::IsNullOrWhiteSpace($registerKey)) {
    $envVars = "$envVars,REGISTER_KEY=$registerKey"
  }

  Write-Host "Deploying to Cloud Run ($Region)..." -ForegroundColor Cyan
  gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars $envVars `
    --max-instances 1
}
finally {
  Pop-Location
}

Write-Host "Done. Next: create Firestore database (Native, $Region) in Console if not already." -ForegroundColor Yellow
