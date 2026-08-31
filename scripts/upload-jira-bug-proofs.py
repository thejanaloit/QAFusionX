"""Upload proof PNGs to Jira bugs via REST API."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error
import base64

WORKSPACE = Path(os.environ.get("QAFUSIONX_WORKSPACE", r"E:\QAFusionX\workspaces\PF-57868"))
ATTACH_ROOT = WORKSPACE / "jira" / "attachments"
BASE = os.environ.get("JIRA_BASE_URL", "https://lolcgroupdev.atlassian.net").rstrip("/")
EMAIL = os.environ.get("JIRA_EMAIL", "thejanaD@lolctech.com")


def get_token() -> str:
    if os.environ.get("JIRA_API_TOKEN"):
        return os.environ["JIRA_API_TOKEN"].strip()
    script = Path(r"C:\Users\ThejanaD\QAFusionX\scripts\resolve-secret.py")
    out = subprocess.check_output(["py", str(script), "JIRA_API_TOKEN", "QAFusionX Jira REST"], text=True)
    return out.strip()


def auth_header(token: str) -> str:
    raw = f"{EMAIL}:{token}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def issue_exists(token: str, key: str) -> bool:
    req = urllib.request.Request(
        f"{BASE}/rest/api/3/issue/{key}?fields=summary",
        headers={"Authorization": auth_header(token), "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        return e.code == 200


def list_attachments(token: str, key: str) -> set[str]:
    req = urllib.request.Request(
        f"{BASE}/rest/api/3/issue/{key}?fields=attachment",
        headers={"Authorization": auth_header(token), "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode())
            return {a["filename"] for a in data.get("fields", {}).get("attachment", [])}
    except urllib.error.HTTPError:
        return set()


def upload_file(token: str, key: str, path: Path) -> None:
    boundary = "----QAFusionXBoundary"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode()
    body += b"Content-Type: image/png\r\n\r\n"
    body += path.read_bytes()
    body += f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{BASE}/rest/api/3/issue/{key}/attachments",
        data=body,
        headers={
            "Authorization": auth_header(token),
            "X-Atlassian-Token": "no-check",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        r.read()


def main() -> int:
    token = get_token()
    # verify auth
    me = urllib.request.Request(
        f"{BASE}/rest/api/3/myself",
        headers={"Authorization": auth_header(token), "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(me, timeout=30) as r:
            user = json.loads(r.read().decode())
            print(f"Auth OK: {user.get('displayName')} ({user.get('emailAddress')})")
    except urllib.error.HTTPError as e:
        print(
            f"JIRA REST auth failed ({e.code}).\n"
            "Create a new token: https://id.atlassian.com/manage-profile/security/api-tokens\n"
            "Set JIRA_API_TOKEN in C:\\Users\\ThejanaD\\QAFusionX\\.env or TBB vault, then re-run.",
            file=sys.stderr,
        )
        return 1

    results = []
    if not ATTACH_ROOT.exists():
        print("No jira/attachments folder — run pack script first", file=sys.stderr)
        return 1

    for bug_dir in sorted(ATTACH_ROOT.iterdir()):
        if not bug_dir.is_dir():
            continue
        key = bug_dir.name
        if not issue_exists(token, key):
            results.append({"bug": key, "error": "issue not found"})
            continue
        existing = list_attachments(token, key)
        uploaded, skipped, errors = [], [], []
        for png in sorted(bug_dir.glob("*.png")):
            if png.name in existing:
                skipped.append(png.name)
                continue
            try:
                upload_file(token, key, png)
                uploaded.append(png.name)
                time.sleep(0.35)
            except Exception as ex:
                errors.append({"file": png.name, "error": str(ex)})
        results.append({"bug": key, "uploaded": uploaded, "skipped": skipped, "errors": errors})
        print(f"{key}: +{len(uploaded)} skip={len(skipped)} err={len(errors)}")

    out = WORKSPACE / "reports" / "jira-attachment-log.json"
    out.write_text(json.dumps({"results": results}, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
