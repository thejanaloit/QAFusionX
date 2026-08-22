# QAFusionX — project tool pack

| Tool | Launch |
|------|--------|
| MCP server | `npx --yes tsx src/index.ts` |
| Full mesh install | `powershell -File scripts/install-full-mesh.ps1` |
| Jira token | `py scripts/resolve-jira-token.py` |
| Any vault key | `py scripts/resolve-secret.py FUSIONX_UAT_USER "QAFusionX UAT login"` |

## Vault keys (typical)

- `JIRA_API_TOKEN` / `ATLASSIAN_API_TOKEN`
- `FUSIONX_UAT_USER` / `FUSIONX_UAT_PASSWORD`
- `QAFUSIONX_EMAIL` / `QAFUSIONX_PASSWORD` (aliases)

## Workspace

Set `QAFUSIONX_WORKSPACE` to the per-project folder (e.g. `E:/QAFusionX/workspaces/PF-57868`).
