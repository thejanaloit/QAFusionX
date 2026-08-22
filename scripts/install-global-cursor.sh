#!/usr/bin/env bash
# Install QAFusionX for EVERY Cursor project and chat on this machine.
# Writes ~/.cursor/mcp.json and ~/.cursor/rules/qafusionx.mdc
set -euo pipefail

HOME_DIR="${HOME}"
INSTALL="${QAFUSIONX_HOME:-$HOME_DIR/QAFusionX}"
REPO_URL="${QAFUSIONX_REPO:-https://github.com/thejanaloit/QAFusionX.git}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$HOME_DIR/.cursor/rules"

if [ "$ROOT" != "$INSTALL" ]; then
  if [ ! -d "$INSTALL/.git" ]; then
    if [ -d "$ROOT/src" ]; then
      mkdir -p "$(dirname "$INSTALL")"
      rm -rf "$INSTALL"
      ln -sfn "$ROOT" "$INSTALL"
      echo "Linked $INSTALL → $ROOT"
    else
      git clone "$REPO_URL" "$INSTALL"
    fi
  fi
fi

if [ -f "$INSTALL/package.json" ]; then
  (cd "$INSTALL" && npm install --omit=dev)
fi

python3 - "$HOME_DIR/.cursor/mcp.json" "$INSTALL" <<'PY'
import json, os, sys
dest, install = sys.argv[1], sys.argv[2]
server = {
    "command": "npx",
    "args": ["--yes", "tsx", os.path.join("${userHome}", "QAFusionX", "src", "index.ts")],
    "env": {
        "QAFUSIONX_HOME": "${userHome}/QAFusionX",
        "QAFUSIONX_WORKSPACE": "${userHome}/QAFusionX/artifacts",
        "QAFUSIONX_SAMPLE_ORIGIN": "http://127.0.0.1:43181",
    },
}
# Prefer an absolute path on this machine so it works even if interpolation is off
server_abs = {
    "command": "npx",
    "args": ["--yes", "tsx", os.path.join(install, "src", "index.ts")],
    "env": {
        "QAFUSIONX_HOME": install,
        "QAFUSIONX_WORKSPACE": os.path.join(install, "artifacts"),
        "QAFUSIONX_SAMPLE_ORIGIN": "http://127.0.0.1:43181",
    },
}
data = {}
if os.path.exists(dest):
    try:
        data = json.loads(open(dest, encoding="utf-8").read() or "{}")
    except json.JSONDecodeError:
        data = {}
servers = data.get("mcpServers") or {}
servers["QAFusionX"] = server_abs
data["mcpServers"] = servers
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, "w", encoding="utf-8").write(json.dumps(data, indent=2) + "\n")
print(f"Global MCP written → {dest}")
PY

RULE_SRC="$INSTALL/.cursor/rules/qafusionx.mdc"
RULE_DST="$HOME_DIR/.cursor/rules/qafusionx.mdc"
if [ -f "$RULE_SRC" ]; then
  cp "$RULE_SRC" "$RULE_DST"
  echo "Global rule written → $RULE_DST"
fi

echo
echo "QAFusionX is now user-level (all projects, all chats) on this machine."
echo "Reload Cursor: Command Palette → Developer: Reload Window"
echo "Then Settings → Tools & MCP → QAFusionX should be green."
