#!/usr/bin/env bash
# Install QAFusionX for EVERY Cursor project and chat on this machine.
# Writes ~/.cursor/mcp.json and ~/.cursor/rules/qafusionx*.mdc
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

export QAFUSIONX_HOME="$INSTALL"
python3 "$INSTALL/scripts/link-tbb-mesh.py" || true

python3 - "$HOME_DIR/.cursor/mcp.json" "$INSTALL" <<'PY'
import json, os, sys
dest, install = sys.argv[1], sys.argv[2]
# link-tbb-mesh.py already merged mesh; this block kept for backward compat if python mesh fails
if not os.path.exists(dest):
    server_abs = {
        "command": "npx",
        "args": ["--yes", "tsx", os.path.join(install, "src", "index.ts")],
        "env": {
            "QAFUSIONX_HOME": install,
            "QAFUSIONX_WORKSPACE": os.path.join(install, "artifacts"),
            "QAFUSIONX_SAMPLE_ORIGIN": "http://127.0.0.1:43181",
            "QAFUSIONX_HEADED": "1",
            "THEJA_BACKBONE_ROOT": os.environ.get("THEJA_BACKBONE_ROOT", ""),
        },
    }
    data = {"mcpServers": {"QAFusionX": server_abs}}
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, "w", encoding="utf-8").write(json.dumps(data, indent=2) + "\n")
    print(f"Fallback MCP written → {dest}")
PY

for rule in "$INSTALL/.cursor/rules/"*.mdc; do
  [ -f "$rule" ] || continue
  base=$(basename "$rule")
  cp "$rule" "$HOME_DIR/.cursor/rules/$base"
  echo "Global rule written → $HOME_DIR/.cursor/rules/$base"
done

echo
echo "QAFusionX is now user-level (all projects, all chats) on this machine."
echo "Reload Cursor: Command Palette → Developer: Reload Window"
echo "Then Settings → Tools & MCP → QAFusionX should be green."
