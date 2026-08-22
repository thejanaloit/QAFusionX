# Install QAFusionX for EVERY Cursor project and chat on Windows.
# Writes %USERPROFILE%\.cursor\mcp.json and %USERPROFILE%\.cursor\rules\qafusionx*.mdc

$ErrorActionPreference = "Stop"
$HomeDir = $env:USERPROFILE
$Install = if ($env:QAFUSIONX_HOME) { $env:QAFUSIONX_HOME } else { Join-Path $HomeDir "QAFusionX" }
$RepoUrl = if ($env:QAFUSIONX_REPO) { $env:QAFUSIONX_REPO } else { "https://github.com/thejanaloit/QAFusionX.git" }

New-Item -ItemType Directory -Force -Path (Join-Path $HomeDir ".cursor\rules") | Out-Null

if (-not (Test-Path (Join-Path $Install "src\index.ts"))) {
  if (Test-Path $Install) { Remove-Item -Recurse -Force $Install }
  git clone $RepoUrl $Install
}

Push-Location $Install
if (Test-Path "package.json") { npm install --omit=dev }
Pop-Location

$env:QAFUSIONX_HOME = $Install
& (Join-Path $Install "scripts\link-tbb-mesh.ps1") -Install $Install

Write-Host ""
Write-Host "QAFusionX is now user-level (all projects, all chats) on this Windows machine."
Write-Host "In Cursor: Command Palette → Developer: Reload Window"
Write-Host "Then Settings → Tools & MCP → turn QAFusionX on."
