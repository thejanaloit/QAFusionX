"""Store JIRA API token in TBB vault + merge into QAFusionX .env (no echo)."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TBB = Path(r"E:\ThejaBackBone")
ENV = REPO / ".env"

token = (os.environ.get("JIRA_API_TOKEN") or os.environ.get("JIRA_TOKEN") or "").strip()
if not token:
    print("Set JIRA_API_TOKEN in the environment first.", file=sys.stderr)
    raise SystemExit(1)

if str(TBB) not in sys.path:
    sys.path.insert(0, str(TBB))
from tbb import vault  # noqa: E402

vault.VAULT_DIR = TBB / ".tbb" / "vault"
vault.INDEX_PATH = vault.VAULT_DIR / "index.json"
vault.add("JIRA_API_TOKEN", token, note="lolcgroupdev Atlassian API token for QAFusionX")

lines: list[str] = []
if ENV.exists():
    lines = ENV.read_text(encoding="utf-8").splitlines()

out: list[str] = []
seen = {"JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_PROJECT_KEY", "JIRA_API_TOKEN"}
defaults = {
    "JIRA_BASE_URL": "https://lolcgroupdev.atlassian.net",
    "JIRA_EMAIL": "thejanaD@lolctech.com",
    "JIRA_PROJECT_KEY": "PF",
    "JIRA_API_TOKEN": token,
}
for line in lines:
    m = re.match(r"^([A-Z_]+)=", line)
    if m and m.group(1) in seen:
        key = m.group(1)
        out.append(f"{key}={defaults[key]}")
        seen.discard(key)
    else:
        out.append(line)
for key in sorted(seen):
    out.append(f"{key}={defaults[key]}")
ENV.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
print("stored:vault+env")
