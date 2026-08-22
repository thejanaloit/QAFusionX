# QAFusionX + Theja mesh (TBB vault, TTP, TCB, Ultimate, theGod, ThejaD)
# Run once on Windows after cloning QAFusionX.

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

& (Join-Path $scriptDir "install-global-cursor.ps1")

Write-Host ""
Write-Host "Full mesh install complete."
Write-Host "  Auto-cloned/updated: TBB, ThejaUltimate, theGod, TTP, TCB (+ ThejaD if present)"
Write-Host "  Credentials flow: TBB vault -> QAFusionX (Jira, FusionX UAT)"
Write-Host "Store secrets: py $repoRoot\scripts\store-jira-token.py  (or tbb vault set via ThejaBackBone)"
