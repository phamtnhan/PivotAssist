[CmdletBinding()]
param(
  [switch]$Seed,
  [switch]$Build,
  [switch]$Production,
  [int]$Port = 3000
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

if ($Seed) {
  Write-Host "Seeding local demo data..." -ForegroundColor Cyan
  $env:NODE_ENV = "production"
  Invoke-Pnpm @("db:seed")
  $env:NODE_ENV = "development"
}

if ($Build) {
  Write-Host "Building workspace..." -ForegroundColor Cyan
  Invoke-Pnpm @("build")
}

if ($Production) {
  Write-Host "Starting production server on http://localhost:$Port" -ForegroundColor Green
  Invoke-Pnpm @("--filter", "@pivotassist/web", "exec", "next", "start", "--port", "$Port")
} else {
  Write-Host "Starting development server on http://localhost:$Port" -ForegroundColor Green
  if ($Port -eq 3000) {
    Invoke-Pnpm @("--filter", "@pivotassist/web", "run", "dev")
  } else {
    $env:NODE_OPTIONS = "--max-old-space-size=12288"
    Invoke-Pnpm @("--filter", "@pivotassist/web", "exec", "next", "dev", "--turbopack", "--port", "$Port")
  }
}
