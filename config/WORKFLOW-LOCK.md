# QAFusionX — LOCKED WORKFLOW (Constitution)

**Version:** `2026-08-22-locked`  
**Law:** This pipeline behaves like compulsory n8n. Step N+1 is forbidden until step N writes a DONE tick in `step-by-step/`. No agent, MCP, or script may bypass the engine.

---

## Phase 0 — Ask mode (Steps 1–2, mandatory)

| Step | Mode | What happens |
|------|------|--------------|
| **1** | Ask | Question 1: project name, what to test, live URL, screenshot |
| **2** | Ask | Question 2 (never skip): user stories via **(1) zip/upload**, **(2) Jira link**, or **(3) generate from system** |

Until both are submitted via MCP, every mutating tool returns `BLOCKED`.

---

## Phase 1 — Workspace (Step 3)

| Step | Directories | Content |
|------|-------------|---------|
| **3** | `User stories/` | Every uploaded or Jira-fetched story |
| | `General/` | `01-target.md` — what to test + URL (+ research later) |

---

## Phase 2 — Crawl Round 1 (Steps 4–5)

| Step | Path | Loop (repeat until end state) |
|------|------|-------------------------------|
| **4** | `Screens/round one/screenshots/` | Open URL in **visible browser** → capture **every** screen & popup |
| | `Screens/round one/references/` | After **each** PNG: read with high-end vision/reasoning → one MD per shot listing **every** button & reachable screen |
| | | Decide next click (prefer first unvisited control) → click → capture again |
| **5** | `Screens/round one/plan/` | `living-plan.md` + `todo.md` — updated after **every** screen; frozen when Round 1 ends |

---

## Phase 3 — Crawl Round 2 (Step 6)

| Step | Path | Purpose |
|------|------|---------|
| **6** | `Screens/round two/{screenshots,references,plan}/` | Same loop as Round 1; hunt misses (empty, error, validation, alternate buttons). Directories must exist even if nothing new. |

---

## Phase 4 — Generated stories (Step 7, method 3 only)

| Step | Path | When |
|------|------|------|
| **7** | `GeneratedUser stories/` | **Only** if Question 2 = generate-from-system. After Round 2. All later tests use this directory. Zip/Jira → N/A. |

---

## Phase 5 — System map (Step 8)

| Step | Path | Rule |
|------|------|------|
| **8** | `Screens/complete-system-map.md` | **Long & exhaustive** — every screen, path, button, flow. Not a summary. Thousands of words if needed. |

---

## Phase 6 — Human test cases (Steps 9–10)

| Step | Path | Rule |
|------|------|------|
| **9** | `testCase Human/` | High-end reasoning model + system map + user stories. Full system. GUI **and** API. Jira functional shape. |
| | `General/human-qa-research.md` | How a human QA would test (internet research) |
| **10** | `jira/testcases/` | Upload every case to Jira (or offline payloads — never skip) |

---

## Phase 7 — Machine layer (Steps 11–12)

| Step | Path | Rule |
|------|------|------|
| **11** | `testc2ai/` | 1:1 YAML per human test case |
| **12** | `AutomatedScripts/gui/` + `api/` | 1:1 Playwright GUI + HTTP API scripts per YAML |

---

## Phase 8 — Execute & report (Steps 13–15)

| Step | Output | Rule |
|------|--------|------|
| **13** | `reports/suite-results.json` | Run **all** scripts. GUI in **visible browser**. **Priority=PASS** via real user flows (login, waits, alternate paths). Retry each case **honestly up to 10 rounds**; never invent a pass; mark **FAILED** only after all rounds. FusionX UAT: Azure AD via vault/env; assert real COB chrome / product APIs (not `/api/sample/health`). |
| **14** | `reports/QAFusionX-Issues.xlsx` + `.csv` | Every failure with proof (like iPay Lite Testing workbook) |
| **15** | `jira/bugs/`, `bugs/` | Bug per issue: subject, precondition, steps, expected, actual, proof |
| **15b** | `jira/attachments/<PF-xxxx>/`, `reports/jira-attachment-log.json` | **LOCKED:** every proof PNG must be a Jira **attachment** on the matching bug (`qafusionx_attach_bug_proofs`). REST via `JIRA_API_TOKEN` or `scripts/upload-jira-bug-proofs.py`. |
| **16** | `reports/*-ipay-lite.xlsx`, `artifacts/` | iPay Lite Testing.xlsx column format — ≥110 rows per story sheet (`qafusionx_generate_ipay_excel`). |

---

## Visible browser (immutable)

- `QAFUSIONX_HEADED=0` rejected  
- Crawl + GUI tests open a **separate window** on the user's device  
- Never headless, never silent pipeline  
- **UNBREAKABLE SESSION:** one browser for Round 1 → Round 2 → stories → maker → checker → suite. Never close/reopen mid-flow. Navigate in the same window. `closeBrowser` = end-of-flow only.

---

## Sinhala — මූලික නීතිය

QAFusionX MCP use කරන වෙලාවේ **Ask mode** එකට යන්න. මුලින් project + URL + screenshot, ඊට පස්සේ **අනිවාර්යයෙන්** user stories (zip / Jira / generate). ඊට පස්සේ step-by-step tick එකක් නැතුව ඊළඟ step එකට යන්න බෑ. හැම screen එකම capture → reference MD → plan update → click. Round 1 + Round 2 දෙකම. ඊට පස්සේ system map, test cases, YAML, scripts, run, export, Jira bugs. Headless බෑ. **එකම browser window එකේ digatama යන්න — අතරේ close කරන්න එපා.**
