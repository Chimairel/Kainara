# Start the owner's synthetic local review preview; never use the shared database.
$ErrorActionPreference = 'Stop'
$previewRoot = Split-Path -Parent $PSScriptRoot
$previewBackend = Join-Path $previewRoot 'backend'
$previewFrontend = Join-Path $previewRoot 'frontend'
$previewContainer = 'codex-meal-review-preview-20261008'
$previewRunning = docker inspect --format '{{.State.Running}}' $previewContainer
if ($LASTEXITCODE -ne 0) { throw 'The meal-review preview database is missing. Recreate the guarded acceptance fixture first.' }
if ($previewRunning -ne 'true') {
  docker start $previewContainer
  if ($LASTEXITCODE -ne 0) { throw 'Could not start the synthetic preview database.' }
}

$env:DATABASE_URL = 'postgresql://fixture:fixture-local-only@127.0.0.1:55485/kainara_meal_governance?schema=public'
$env:NODE_ENV = 'test'
$env:JWT_SECRET = 'synthetic-disposable-access-key'
$env:JWT_REFRESH_SECRET = 'synthetic-disposable-refresh-key'
$env:CLINICAL_DOCUMENT_ENCRYPTION_KEY = [Convert]::ToBase64String([byte[]](1..32))
$env:GEMINI_API_KEY = ''
$env:SMTP_USER = ''
$env:BREVO_API_KEY = ''
$env:PAYMONGO_SECRET_KEY = ''
$env:SMTP_VERIFY_ON_STARTUP = 'false'
$env:MEMBERSHIP_ENABLED = 'false'
$env:FRONTEND_URL = 'http://127.0.0.1:3103'
$env:CORS_ORIGINS = 'http://127.0.0.1:3103,http://localhost:3103'
if (-not (Get-NetTCPConnection -State Listen -LocalPort 5103 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath (Get-Command node).Source -WindowStyle Hidden -WorkingDirectory $previewBackend `
    -ArgumentList @('node_modules/tsx/dist/cli.mjs', 'scripts/meal-governance-preview.ts')
}

$env:NODE_ENV = 'production'
$env:NUTRIMIND_REPAIR_E2E = 'true'
$env:NEXT_PUBLIC_API_URL = '/api'
$env:INTERNAL_API_URL = 'http://127.0.0.1:5103'
$env:NEXT_PUBLIC_GOOGLE_CLIENT_ID = ''
if (-not (Test-Path -LiteralPath (Join-Path $previewFrontend '.next-repair/BUILD_ID'))) {
  throw 'Build the isolated frontend first using the preview environment and npm run build.'
}
if (Get-NetTCPConnection -State Listen -LocalPort 3103 -ErrorAction SilentlyContinue) {
  Write-Host 'A server is already listening on 3103. Open http://127.0.0.1:3103/login if it is the preview.'
  return
}
Write-Host 'Open http://127.0.0.1:3103/login and leave this terminal running.'
Push-Location $previewFrontend
try { npm run start -- --port 3103 --hostname 127.0.0.1 }
finally { Pop-Location }
