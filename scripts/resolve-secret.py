"""Print a secret from TBB vault (stdout only). Usage: py resolve-secret.py KEY [reason]"""
from __future__ import annotations

import os
import sys
from pathlib import Path

TBB = Path(os.environ.get("THEJA_BACKBONE_ROOT", r"E:\ThejaBackBone"))
if str(TBB) not in sys.path:
    sys.path.insert(0, str(TBB))

from tbb import vault  # noqa: E402

vault.VAULT_DIR = Path(os.environ.get("TBB_VAULT_DIR", str(TBB / ".tbb" / "vault")))
vault.INDEX_PATH = vault.VAULT_DIR / "index.json"


def _yes(_name: str, _reason: str | None) -> bool:
    return os.environ.get("TBB_SECRET_AUTO_APPROVE", "1") == "1"


def main() -> int:
    if len(sys.argv) < 2:
        return 1
    key = sys.argv[1]
    reason = sys.argv[2] if len(sys.argv) > 2 else "QAFusionX"
    if not vault.has(key):
        return 1
    try:
        print(vault.get(key, reason=reason, confirm=_yes), end="")
        return 0
    except Exception:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
