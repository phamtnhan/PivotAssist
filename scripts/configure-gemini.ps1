[CmdletBinding()]
param([switch]$FromExample)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$envPath = Join-Path $projectRoot "apps\web\.env.local"

if ($FromExample) {
  $keyLine = Get-Content -LiteralPath (Join-Path $projectRoot ".env.example") -Encoding UTF8 | Where-Object { $_ -match "^GEMINI_API_KEY=" } | Select-Object -First 1
  $geminiKey = ($keyLine -replace "^GEMINI_API_KEY=", "").Trim().Trim('"')
} else {
  $geminiKey = Read-Host "Paste GEMINI_API_KEY (input is hidden from source files)"
}

if ([string]::IsNullOrWhiteSpace($geminiKey)) { throw "GEMINI_API_KEY is empty." }

$lines = @()
if (Test-Path -LiteralPath $envPath) {
  $lines = @(Get-Content -LiteralPath $envPath -Encoding UTF8 | Where-Object { $_ -notmatch "^GEMINI_API_KEY=" -and $_ -notmatch "^GEMINI_TEXT_MODEL=" })
}
$lines += 'GEMINI_API_KEY="' + $geminiKey.Trim() + '"'
$lines += 'GEMINI_TEXT_MODEL="gemini-3.5-flash-lite"'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, ($lines -join [Environment]::NewLine) + [Environment]::NewLine, $utf8NoBom)
Write-Host "Gemini configured in .env.local. Restart the web server to apply it." -ForegroundColor Green
