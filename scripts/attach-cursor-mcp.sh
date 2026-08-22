#!/usr/bin/env bash
# Merge QAFusionX into the local Cursor MCP config (~/.cursor/mcp.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${HOME}/.cursor/mcp.json"
mkdir -p "${HOME}/.cursor"

python3 - "$DEST" "$ROOT" <<'PY'
import json, os, sys
dest, root = sys.argv[1], sys.argv[2]
server = {
    "command": "npx",
    "args": ["tsx", os.path.join(root, "src/index.ts")],
    "env": {
        "QAFUSIONX_WORKSPACE": os.path.join(root, "artifacts"),
        "QAFUSIONX_SAMPLE_ORIGIN": "http://127.0.0.1:43181",
    },
}
data = {}
if os.path.exists(dest):
    try:
        data = json.loads(open(dest, encoding="utf-8").read() or "{}")
    except json.JSONDecodeError:
        data = {}
servers = data.get("mcpServers") or data.get("servers") or {}
servers["QAFusionX"] = server
data["mcpServers"] = servers
open(dest, "w", encoding="utf-8").write(json.dumps(data, indent=2) + "\n")
print(f"Attached QAFusionX MCP → {dest}")
print("Restart Cursor (or reload MCP servers) so it appears in the tool list.")
PY
