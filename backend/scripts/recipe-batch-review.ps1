[CmdletBinding()]
param(
  [ValidateSet('export','submit')][string]$Mode = 'export',
  [string]$Api = 'http://localhost:5000/api',
  [string]$File = '.local/recipe-review.json',
  [switch]$ConfirmReviewed
)
$ErrorActionPreference = 'Stop'
$apiBase = $Api.TrimEnd('/')
$uri = [Uri]$apiBase
if ($uri.UserInfo -or $uri.Query -or $uri.Fragment -or
    !($uri.Scheme -eq 'https' -or ($uri.Scheme -eq 'http' -and $uri.Host -in @('localhost','127.0.0.1'))) -or
    !$uri.AbsolutePath.EndsWith('/api')) { throw 'Use an HTTPS API, or loopback HTTP, ending in /api.' }
if ($Mode -eq 'submit' -and !$ConfirmReviewed) { throw 'Review the exported evidence first, then add -ConfirmReviewed.' }
$credential = Get-Credential -UserName 'nutritionist@gmail.com' -Message 'Sign in as the RND performing this recipe review.'
if (!$credential) { throw 'Sign-in cancelled.' }
$previousToken = $env:KAINARA_REVIEW_TOKEN
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $body = @{ email=$credential.UserName; password=$credential.GetNetworkCredential().Password } | ConvertTo-Json -Compress
  $session = Invoke-RestMethod -Uri ($apiBase + '/auth/login') -Method Post -ContentType 'application/json' -Body $body -MaximumRedirection 0
  $body = $null
  if (!$session.success -or $session.data.user.role -ne 'NUTRITIONIST' -or !$session.data.accessToken) { throw 'An eligible RND login is required.' }
  $env:KAINARA_REVIEW_TOKEN = $session.data.accessToken
  $arguments = @('scripts/recipe-batch-review.mjs',$Mode,"--api=$apiBase","--file=$File")
  if ($ConfirmReviewed) { $arguments += '--confirm-reviewed' }
  & node.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Review stopped. Check its message and private receipts before retrying.' }
} finally {
  $body = $null
  $credential = $null
  $session = $null
  if ($null -eq $previousToken) { Remove-Item Env:KAINARA_REVIEW_TOKEN -ErrorAction SilentlyContinue }
  else { $env:KAINARA_REVIEW_TOKEN = $previousToken }
  Pop-Location
}
