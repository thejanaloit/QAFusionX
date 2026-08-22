# Link QAFusionX + Theja mesh (TBB, TTP, TCB, Ultimate, theGod, ThejaD) into global Cursor MCP.
# Called by install-global-cursor.ps1 and install-full-mesh.ps1

param(
  [string]$Install = "",
  [string]$McpPath = ""
)

$ErrorActionPreference = "Stop"
$HomeDir = $env:USERPROFILE
if (-not $Install) {
  $Install = if ($env:QAFUSIONX_HOME) { $env:QAFUSIONX_HOME } else { Join-Path $HomeDir "QAFusionX" }
}
if (-not $McpPath) { $McpPath = Join-Path $HomeDir ".cursor\mcp.json" }

$configPath = Join-Path $Install "config\tbb-mesh.json"
if (-not (Test-Path $configPath)) {
  Write-Warning "Missing $configPath - skipping mesh link (QAFusionX-only install)."
  return
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json

function Expand-Placeholders([string]$Text, [hashtable]$Vars) {
  if (-not $Text) { return $Text }
  $out = $Text
  foreach ($k in $Vars.Keys) {
    $out = $out -replace [regex]::Escape('${' + $k + '}'), [string]$Vars[$k]
  }
  return $out
}

$vars = @{}
foreach ($prop in $config.defaults.PSObject.Properties) {
  $envVal = [Environment]::GetEnvironmentVariable([string]$prop.Name)
  $vars[[string]$prop.Name] = if ($envVal) { $envVal } else { [string]$prop.Value }
}

& (Join-Path $Install "scripts\bootstrap-mesh-repos.ps1") -Install $Install -Vars $vars

$meshEnv = @{}
foreach ($prop in $config.meshEnv.PSObject.Properties) {
  $meshEnv[[string]$prop.Name] = Expand-Placeholders ([string]$prop.Value) $vars
}

$workspace = if ($env:QAFUSIONX_WORKSPACE) { $env:QAFUSIONX_WORKSPACE } else { Join-Path $Install "artifacts" }

$qfxEnv = @{
  QAFUSIONX_HOME      = $Install
  QAFUSIONX_WORKSPACE = $workspace
}
foreach ($prop in $config.qafusionxEnv.PSObject.Properties) {
  $qfxEnv[[string]$prop.Name] = Expand-Placeholders ([string]$prop.Value) $vars
}
foreach ($k in $meshEnv.Keys) {
  if (-not $qfxEnv.ContainsKey($k)) { $qfxEnv[$k] = $meshEnv[$k] }
}

$servers = [ordered]@{}
$servers["QAFusionX"] = @{
  command = "npx"
  args    = @("--yes", "tsx", (Join-Path $Install "src\index.ts"))
  env     = $qfxEnv
}

foreach ($name in $config.mcpServers.PSObject.Properties.Name) {
  $def = $config.mcpServers.$name
  $argList = @()
  foreach ($a in @($def.args)) {
    $argList += Expand-Placeholders ([string]$a) $vars
  }
  $rootKey = switch ($name) {
    "ThejaThinkingPattern" { "THEJA_TTP_ROOT" }
    "ThejaCentralBrain"    { "THEJA_TCB_ROOT" }
    "ThejaUltimate"        { "THEJA_ULTIMATE_ROOT" }
    "theGod"               { "THEGOD_ROOT" }
    "ThejaD"               { "THEJAD_PACKAGE_ROOT" }
    default                { $null }
  }
  if ($rootKey -and -not (Test-Path $vars[$rootKey])) {
    Write-Warning "Skipping mesh MCP '$name' - path not found: $($vars[$rootKey])"
    continue
  }
  $servers[$name] = @{
    command = [string]$def.command
    args    = $argList
    env     = $meshEnv
  }
}

$mcp = @{ mcpServers = @{} }
if (Test-Path $McpPath) {
  try {
    $existing = Get-Content $McpPath -Raw | ConvertFrom-Json
    if ($existing.mcpServers) {
      foreach ($p in $existing.mcpServers.PSObject.Properties) {
        $mcp.mcpServers[[string]$p.Name] = $p.Value
      }
    }
  } catch {
    Write-Warning "Could not parse existing mcp.json - overwriting mesh entries only."
  }
}

foreach ($k in $servers.Keys) {
  $mcp.mcpServers[$k] = $servers[$k]
}

New-Item -ItemType Directory -Force -Path (Split-Path $McpPath) | Out-Null
($mcp | ConvertTo-Json -Depth 12) | Set-Content -Path $McpPath -Encoding UTF8
Write-Host "TBB mesh + QAFusionX linked -> $McpPath"
Write-Host "  TBB root: $($vars['THEJA_BACKBONE_ROOT'])"
Write-Host "  Workspace: $workspace"

# Copy Cursor rules (including TBB mesh rule)
$rulesDir = Join-Path $HomeDir ".cursor\rules"
New-Item -ItemType Directory -Force -Path $rulesDir | Out-Null
Get-ChildItem (Join-Path $Install ".cursor\rules\*.mdc") -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $rulesDir $_.Name) -Force
  Write-Host "Global rule -> $(Join-Path $rulesDir $_.Name)"
}

# Register project pack in TBB spine (non-fatal if TBB missing)
$tbbRoot = $vars["THEJA_BACKBONE_ROOT"]
$packSrc = Join-Path $Install "config\tbb-project-pack"
$packDst = Join-Path $tbbRoot ".tbb\spine\chambers\tools\projects\qafusionx"
if ((Test-Path $tbbRoot) -and (Test-Path $packSrc)) {
  New-Item -ItemType Directory -Force -Path $packDst | Out-Null
  Copy-Item (Join-Path $packSrc "*") $packDst -Force -Recurse
  Write-Host "TBB project pack registered -> $packDst"

  $indexPath = Join-Path $tbbRoot ".tbb\spine\chambers\tools\projects\INDEX.md"
  if (Test-Path $indexPath) {
    $idx = Get-Content $indexPath -Raw
    if ($idx -notmatch "qafusionx") {
      $installPosix = $Install -replace '\\', '/'
      $row = "| ``qafusionx`` | QAFusionX | sequential-qa-mcp | 6 | ``$installPosix`` |"
      $idx = $idx -replace '(\| `fusionxqaagent`[^\n]+\r?\n)', "`${1}$row`n"
      Set-Content -Path $indexPath -Value $idx -Encoding UTF8
      Write-Host "Updated TBB projects INDEX.md"
    }
  }
}

Write-Host ""
Write-Host "Reload Cursor (Developer: Reload Window) and enable QAFusionX + mesh MCPs in Settings."
