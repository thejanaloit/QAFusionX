# Install QAFusionX for EVERY Cursor project and chat on Windows.
# Writes %USERPROFILE%\.cursor\mcp.json and %USERPROFILE%\.cursor\rules\qafusionx.mdc

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

$mcpPath = Join-Path $HomeDir ".cursor\mcp.json"
$mcp = @{
  mcpServers = @{
    QAFusionX = @{
      command = "npx"
      args    = @("--yes", "tsx", (Join-Path $Install "src\index.ts"))
      env     = @{
        QAFUSIONX_HOME           = $Install
        QAFUSIONX_WORKSPACE      = (Join-Path $Install "artifacts")
        QAFUSIONX_SAMPLE_ORIGIN  = "http://127.0.0.1:43181"
      }
    }
  }
}

if (Test-Path $mcpPath) {
  try {
    $existing = Get-Content $mcpPath -Raw | ConvertFrom-Json
    if (-not $existing.mcpServers) { $existing | Add-Member -NotePropertyName mcpServers -NotePropertyValue (@{}) }
    $existing.mcpServers | Add-Member -NotePropertyName QAFusionX -NotePropertyValue $mcp.mcpServers.QAFusionX -Force
    $mcp = $existing
  } catch {
    # keep new file
  }
}

($mcp | ConvertTo-Json -Depth 8) | Set-Content -Path $mcpPath -Encoding UTF8
Write-Host "Global MCP written → $mcpPath"

$ruleSrc = Join-Path $Install ".cursor\rules\qafusionx.mdc"
$ruleDst = Join-Path $HomeDir ".cursor\rules\qafusionx.mdc"
if (Test-Path $ruleSrc) {
  Copy-Item $ruleSrc $ruleDst -Force
  Write-Host "Global rule written → $ruleDst"
}

Write-Host ""
Write-Host "QAFusionX is now user-level (all projects, all chats) on this Windows machine."
Write-Host "In Cursor: Command Palette → Developer: Reload Window"
Write-Host "Then Settings → Tools & MCP → turn QAFusionX on."
