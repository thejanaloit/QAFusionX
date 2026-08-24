# Confluence FusionX knowledge clone — summary

- Harvest date: 2026-08-24
- Source: FusionX Confluence space (local clone under workspace PF-57868)
- Markdown pages under workspace clone/FusionX: ~683
- Indexes: `indexes/fusionx-page-index.json`, `indexes/fusionx-account-related.json`
- URS: `URS_1.1_extracted.md` (PF-58142 / cross-branch account opening control)
- Accounts Module: `clone/FusionX/17170440__Accounts_Module*.md`
- Attachments index: `jira-attachments/PF-52430/README.md`

## Agent usage

1. Call `qafusionx_knowledge_search` with queries like `Current Stage`, `Other Branch Approval Rejected`, `URS 1.1`.
2. Train Excel packs from URS + wiki **before** inventing cases; remap any URS 1.0 TC language.
3. **Jira updates: NONE** unless the user explicitly asks in that turn.

## Not committed here

Large HTML dumps, docx, xlsx, mp4, and `.auth.tmp.json` are excluded from the QAFusionX git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>".
