# Run ONCE to create your Android signing key and print the 4 GitHub secrets.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\make-keystore.ps1
# Keep the printed values private. The .keystore file is git-ignored on purpose.

$ErrorActionPreference = 'Stop'
$alias   = 'kanzup'
$ksPath  = Join-Path $PSScriptRoot '..\kanzup-release.keystore'
$ksPath  = [System.IO.Path]::GetFullPath($ksPath)

# Generate a strong random password (used for both store and key).
$bytes = New-Object 'System.Byte[]' 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$pass = [Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').Replace('=','')

if (Test-Path $ksPath) {
  Write-Host "A keystore already exists at $ksPath — delete it first if you really want a new one." -ForegroundColor Yellow
  Write-Host "(Making a new key changes the app signature; existing installs can't upgrade over it.)"
  exit 1
}

& keytool -genkeypair -v -keystore $ksPath -alias $alias `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $pass -keypass $pass `
  -dname "CN=KanzUp, O=KanzUp, C=MA"

$b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($ksPath))

Write-Host ""
Write-Host "==================== ADD THESE 4 GITHUB SECRETS ====================" -ForegroundColor Green
Write-Host "Repo -> Settings -> Secrets and variables -> Actions -> New repository secret"
Write-Host ""
Write-Host "KEY_ALIAS            = $alias"
Write-Host "KEY_STORE_PASSWORD   = $pass"
Write-Host "KEY_PASSWORD         = $pass"
Write-Host ""
Write-Host "ANDROID_KEYSTORE_BASE64 (paste the whole line below):"
Write-Host $b64
Write-Host ""
Write-Host "Keystore saved at: $ksPath   (KEEP A PRIVATE BACKUP; it is git-ignored)" -ForegroundColor Yellow
