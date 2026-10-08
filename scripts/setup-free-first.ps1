[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipSeed,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Invoke-Pnpm {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  & corepack pnpm @Arguments
  if ($LASTEXITCODE -ne 0) { throw "pnpm command failed with exit code $LASTEXITCODE" }
}

if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw "Node.js/Corepack was not found. Install Node.js and run this script again."
}

if (-not $SkipInstall) {
  Write-Host "[1/4] Installing workspace dependencies..." -ForegroundColor Cyan
  Invoke-Pnpm @("install")
}

Write-Host "[2/4] Syncing local MySQL schema..." -ForegroundColor Cyan
Invoke-Pnpm @("--filter", "@pivotassist/db", "exec", "prisma", "db", "push", "--accept-data-loss")

if (-not $SkipSeed) {
  Write-Host "[3/4] Seeding sample accounts, CVs, jobs and interview reports..." -ForegroundColor Cyan
  $env:NODE_ENV = "production"
  Invoke-Pnpm @("db:seed")
  $env:NODE_ENV = "development"
} else {
  Write-Host "[3/4] Seed skipped." -ForegroundColor DarkGray
}

if (-not $SkipBuild) {
  Write-Host "[4/4] Building all workspace packages..." -ForegroundColor Cyan
  Invoke-Pnpm @("build")
} else {
  Write-Host "[4/4] Build skipped." -ForegroundColor DarkGray
}

Write-Host "" 
Write-Host "Setup complete. Run .\scripts\run-dev.ps1 to open PivotAssist at http://localhost:3000" -ForegroundColor Green
