#!/usr/bin/env bash
# Create github.com/<you>/QAFusionX and push main.
# Requires: gh auth login   (this cloud environment has no GitHub token)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  echo "Then re-run: bash scripts/publish-github.sh"
  exit 1
fi

NAME="${1:-QAFusionX}"
VIS="${2:-public}"

if gh repo view "$NAME" >/dev/null 2>&1; then
  echo "Repo $NAME already exists on your account. Adding remote and pushing."
else
  gh repo create "$NAME" --"$VIS" --description "QAFusionX — sequential MCP QA agent. Ask mode first, then crawl, test, automate, file Jira bugs." --source="$ROOT" --remote=github --push
  echo "Created and pushed."
  gh repo view --web
  exit 0
fi

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$(gh repo view "$NAME" --json url -q .url).git"
else
  git remote add github "$(gh repo view "$NAME" --json url -q .url).git"
fi
git push -u github main
echo "Pushed main → github ($NAME)"
gh repo view --web
