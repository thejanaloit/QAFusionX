# MCP adaptations — QAFusionX

## Law

1. **TBB first** — credentials and flow definitions live in ThejaBackBone vault, not in chat or `.env` commits.
2. **Install links mesh** — `install-full-mesh.ps1` registers QAFusionX + TTP + TCB + Ultimate + theGod + ThejaD in global `~/.cursor/mcp.json`.
3. **Honest gates** — only `step-by-step/*.md` DONE ticks unlock the next QAFusionX tool; mesh MCPs must not bypass gates.
4. **Headed browser** — crawl and GUI tests use a visible window on the user's device.

## When to call mesh MCPs

| Situation | MCP |
|-----------|-----|
| Missing Jira/FusionX secret | TBB vault via `resolve-secret.py` |
| Stuck on SSO or loading spinner | theGod / ThejaUltimate browser unstuck |
| FusionX screen parity | ThejaD `thejad_fusionx_stitch_parity` |
| Think before GO/NO-GO on a step | TTP `ttp_think` |
| Cross-run QA memory | TCB `tcb_ingest` / `tcb_think` |
