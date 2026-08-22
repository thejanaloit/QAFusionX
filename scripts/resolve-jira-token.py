"""Print JIRA API token from TBB vault (stdout only). Never log elsewhere."""
from __future__ import annotations

import sys
from pathlib import Path

import os

TBB = Path(os.environ.get("THEJA_BACKBONE_ROOT", r"E:\ThejaBackBone"))
if str(TBB) not in sys.path:
    sys.path.insert(0, str(TBB))

from tbb import vault  # noqa: E402

vault.VAULT_DIR = Path(os.environ.get("TBB_VAULT_DIR", str(TBB / ".tbb" / "vault")))
vault.INDEX_PATH = vault.VAULT_DIR / "index.json"

_KEYS = ("JIRA_API_TOKEN", "ATLASSIAN_API_TOKEN", "JIRA_TOKEN")


def _yes(_name: str, _reason: str | None) -> bool:
    return True


def main() -> int:
    for key in _KEYS:
        if not vault.has(key):
            continue
        try:
            print(vault.get(key, reason="QAFusionX Jira REST", confirm=_yes), end="")
            return 0
        except Exception:
            continue
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
