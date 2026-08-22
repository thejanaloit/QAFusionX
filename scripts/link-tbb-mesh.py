#!/usr/bin/env python3
"""Merge QAFusionX + Theja mesh into ~/.cursor/mcp.json (cross-platform)."""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path


def expand(text: str, vars_: dict[str, str]) -> str:
    out = text
    for k, v in vars_.items():
        out = out.replace("${" + k + "}", v)
    return out


def main() -> int:
    install = Path(os.environ.get("QAFUSIONX_HOME", Path.home() / "QAFusionX")).resolve()
    mcp_path = Path(os.environ.get("CURSOR_MCP_JSON", Path.home() / ".cursor" / "mcp.json"))
    config_path = install / "config" / "tbb-mesh.json"
    if not config_path.is_file():
        print(f"Missing {config_path}", file=sys.stderr)
        return 1

    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    defaults = cfg.get("defaults", {})
    vars_: dict[str, str] = {}
    for k, v in defaults.items():
        vars_[k] = os.environ.get(k, v)

    mesh_env = {k: expand(str(v), vars_) for k, v in cfg.get("meshEnv", {}).items()}
    workspace = os.environ.get("QAFUSIONX_WORKSPACE", str(install / "artifacts"))

    qfx_env: dict[str, str] = {
        "QAFUSIONX_HOME": str(install),
        "QAFUSIONX_WORKSPACE": workspace,
    }
    for k, v in cfg.get("qafusionxEnv", {}).items():
        qfx_env[k] = expand(str(v), vars_)
    for k, v in mesh_env.items():
        qfx_env.setdefault(k, v)

    servers: dict = {
        "QAFusionX": {
            "command": "npx",
            "args": ["--yes", "tsx", str(install / "src" / "index.ts")],
            "env": qfx_env,
        }
    }

    root_keys = {
        "ThejaThinkingPattern": "THEJA_TTP_ROOT",
        "ThejaCentralBrain": "THEJA_TCB_ROOT",
        "ThejaUltimate": "THEJA_ULTIMATE_ROOT",
        "theGod": "THEGOD_ROOT",
        "ThejaD": "THEJAD_PACKAGE_ROOT",
    }
    for name, defn in cfg.get("mcpServers", {}).items():
        root_key = root_keys.get(name)
        if root_key and not Path(vars_[root_key]).exists():
            print(f"Skipping {name} — missing {vars_[root_key]}", file=sys.stderr)
            continue
        servers[name] = {
            "command": defn["command"],
            "args": [expand(str(a), vars_) for a in defn.get("args", [])],
            "env": mesh_env,
        }

    data: dict = {"mcpServers": {}}
    if mcp_path.is_file():
        try:
            data = json.loads(mcp_path.read_text(encoding="utf-8") or "{}")
        except json.JSONDecodeError:
            data = {}
    merged = data.get("mcpServers") or {}
    merged.update(servers)
    data["mcpServers"] = merged
    mcp_path.parent.mkdir(parents=True, exist_ok=True)
    mcp_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"TBB mesh + QAFusionX linked → {mcp_path}")

    rules_src = install / ".cursor" / "rules"
    rules_dst = Path.home() / ".cursor" / "rules"
    rules_dst.mkdir(parents=True, exist_ok=True)
    if rules_src.is_dir():
        for rule in rules_src.glob("*.mdc"):
            shutil.copy2(rule, rules_dst / rule.name)
            print(f"Global rule → {rules_dst / rule.name}")

    tbb_root = Path(vars_["THEJA_BACKBONE_ROOT"])
    pack_src = install / "config" / "tbb-project-pack"
    pack_dst = tbb_root / ".tbb" / "spine" / "chambers" / "tools" / "projects" / "qafusionx"
    if tbb_root.is_dir() and pack_src.is_dir():
        pack_dst.mkdir(parents=True, exist_ok=True)
        for f in pack_src.iterdir():
            if f.is_file():
                shutil.copy2(f, pack_dst / f.name)
        print(f"TBB project pack → {pack_dst}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
