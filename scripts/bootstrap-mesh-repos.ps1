# Clone / update Theja mesh repos (TBB, Ultimate, theGod, TTP, TCB) before MCP link.
# Called by link-tbb-mesh.ps1

param(
  [string]$Install = "",
  [hashtable]$Vars = $null
)

$ErrorActionPreference = "Stop"
if (-not $Install) {
  $Install = if ($env:QAFUSIONX_HOME) { $env:QAFUSIONX_HOME } else { Join-Path $env:USERPROFILE "QAFusionX" }
}

$configPath = Join-Path $Install "config\tbb-mesh.json"
if (-not (Test-Path $configPath)) {
  Write-Warning "Missing $configPath - cannot bootstrap mesh repos."
  return
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json

function Expand-Placeholders([string]$Text, [hashtable]$V) {
  if (-not $Text) { return $Text }
  $out = $Text
  foreach ($k in $V.Keys) {
    $out = $out -replace [regex]::Escape('${' + $k + '}'), [string]$V[$k]
  }
  return $out
}

if (-not $Vars) {
  $Vars = @{}
  foreach ($prop in $config.defaults.PSObject.Properties) {
    $envVal = [Environment]::GetEnvironmentVariable([string]$prop.Name)
    $Vars[[string]$prop.Name] = if ($envVal) { $envVal } else { [string]$prop.Value }
  }
}

function Ensure-MeshRepo($repo, [hashtable]$V) {
  $envKey = [string]$repo.envKey
  $root = [string]$V[$envKey]
  if (-not $root) {
    Write-Warning "No path for $($repo.label) ($envKey) - skipped."
    return $false
  }

  $marker = Join-Path $root ([string]$repo.marker)
  $ok = (Test-Path $root) -and (Test-Path $marker)

  if (-not $ok) {
    Write-Host "Cloning $($repo.label) -> $root"
    $parent = Split-Path $root -Parent
    if ($parent -and -not (Test-Path $parent)) {
      New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    if ((Test-Path $root) -and -not (Test-Path $marker)) {
      Write-Warning "Removing incomplete folder: $root"
      Remove-Item -Recurse -Force $root
    }
    if (-not (Test-Path $root)) {
      git clone ([string]$repo.github) $root
    }
    $ok = Test-Path $marker
  } else {
    Write-Host "Updating $($repo.label) (git pull)"
    Push-Location $root
    try { git pull --ff-only 2>&1 | Out-Null } catch { Write-Warning "git pull failed for $root" }
    Pop-Location
  }

  if (-not $ok) {
    if ($repo.required) {
      Write-Warning "REQUIRED repo missing marker: $marker"
    }
    return $false
  }

  if ($repo.npmInstall -and (Test-Path (Join-Path $root "package.json"))) {
    Write-Host "npm install -> $root"
    Push-Location $root
    npm install --omit=dev 2>&1 | Out-Null
    Pop-Location
  }

  if ($envKey -eq "THEJA_BACKBONE_ROOT") {
    $vault = Join-Path $root ".tbb\vault\index.json"
    if (Test-Path $vault) {
      Write-Host "TBB vault OK -> $vault"
    } else {
      Write-Warning "TBB cloned but vault index missing. Restore vault or run TBB spine init on $root"
    }
  }

  return $true
}

Write-Host ""
Write-Host "=== Bootstrap Theja mesh repos ==="
$repos = @($config.meshRepos)
foreach ($repo in $repos) {
  Ensure-MeshRepo $repo $Vars | Out-Null
}
Write-Host "=== Mesh repo bootstrap done ==="
Write-Host ""
