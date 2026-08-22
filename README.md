# QAFusionX

Sequential MCP QA agent. When this server is connected in Cursor it **locks Ask mode**, asks two compulsory questions, then walks a 15-step workflow that cannot skip. Completing step N writes a tick in `step-by-step/` — that tick is the only way step N+1 unlocks.

The Control Console is a live GUI for the same engine: numbered pipeline, Ask-mode banner, artifact browser, and a test-run console you can watch.

**Visible watch mode is compulsory.** Round 1, Round 2, and GUI automated runs open a real Chromium window (headed, maximized, slowed). Silent/headless crawl or GUI testing is off unless you explicitly set `QAFUSIONX_HEADED=0`. Run QAFusionX on your own machine so the browser appears on your desktop.

## What it does

1. **Ask — project & target** (Ask mode) — product name, what to test, live URL, screenshot.
2. **Ask — user stories** (Ask mode, compulsory) — zip / files, Jira link, or generate-from-system.
3. Persist `User stories/` and `General/01-target.md`.
4. **Round 1 crawl** — every screen and popup: capture → reason → reference MD → living plan → next click.
5. Freeze Round 1 plan / todo.
6. **Round 2 crawl** — same directory shape, hunting anything Round 1 missed.
7. **Generate user stories** — **only if Question 2 was generate-from-system**. After Round 2, create `GeneratedUser stories/` from every captured flow. Later tests use that set only. Zip/Jira runs mark this step N/A.
8. **Complete system map** — long, exhaustive markdown (short files are rejected).
9. **Human test cases** in Jira functional format under `testCase Human/`.
10. Upload those cases to Jira (or write offline payloads).
11. Convert 1:1 to YAML in `testc2ai/`.
12. Generate **GUI and API** Playwright scripts in `AutomatedScripts/`.
13. Run the suite in a **visible headed browser** (you watch every click) with results also streamed to the GUI.
14. Export failures to `reports/QAFusionX-Issues.xlsx` + `.csv` with proof.
15. File Jira **bug** tickets: subject, precondition, steps, expected, actual, proof.

## Run locally

```bash
npm install
npx playwright install chromium
cd console && npm install && cd ..
cp .env.example .env   # optional Jira credentials
npm run dev
```

- Control Console: http://127.0.0.1:43181
- Engine API: http://127.0.0.1:43180
- Sample app under test: http://127.0.0.1:43181/sample/login  
  Demo login: `qa.analyst` / `FusionX@2026`

Click **Run guided demo** on the console to execute every step against the bundled Intermediary Management sample (Emergency Details fields matching a Jira functional case).

MCP-only:

```bash
npx tsx src/index.ts
```

## Attach QAFusionX to Cursor (every project, every chat)

**Windows (your Cursor desktop) — run once:**

```powershell
git clone https://github.com/thejanaloit/QAFusionX.git $env:USERPROFILE\QAFusionX
cd $env:USERPROFILE\QAFusionX
powershell -ExecutionPolicy Bypass -File .\scripts\install-global-cursor.ps1
```

**macOS / Linux:**

```bash
git clone https://github.com/thejanaloit/QAFusionX.git ~/QAFusionX
cd ~/QAFusionX
bash scripts/install-global-cursor.sh
```

That writes a **user-level** config (`~/.cursor/mcp.json`) and **user rules** (`~/.cursor/rules/qafusionx.mdc`, `qafusionx-visible-browser.mdc`). Cursor merges that into every workspace and every Agent/Ask chat. Then:

1. Command Palette → **Developer: Reload Window**
2. Settings → **Tools & MCP** → turn **QAFusionX** on (green)

This repo also has `.cursor/mcp.json` so opening the QAFusionX folder alone is enough. The installer is what makes it global.

On first use the agent **must**:

1. Switch to **Ask** mode.
2. Ask what the project is and what to test (URL + screenshot).
3. Ask for user stories (zip, Jira, or generate). This second question is mandatory.

Until both answers are stored, every later tool returns `BLOCKED`.

## Publish to GitHub

The cloud agent that built this project has no GitHub login, so it cannot create `github.com/<you>/QAFusionX` from here. The source is already on the Cursor Origin remote. On your machine, after `gh auth login`:

```bash
bash scripts/publish-github.sh QAFusionX public
```

That creates the GitHub repo, adds a `github` remote, and pushes `main`.

## User story sources

| Method | How |
| --- | --- |
| Zip / files | `qafusionx_submit_user_stories` with `source: "zip"` and `zipPath` or `files[]` |
| Jira | `source: "jira"` and `jiraLink` (browse URL, JQL, or issue key). Needs `JIRA_EMAIL` + `JIRA_API_TOKEN` |
| Generate | `source: "generate"` only records the choice. After Round 2, `GeneratedUser stories/` is created from the captured screens. Test cases must use that directory. |

## Artifact layout

```
artifacts/
  step-by-step/                 ticks — the only unlock
  User stories/                 zip / Jira stories
  GeneratedUser stories/        method 3 only, after Round 2
  General/                      01-target.md, human-qa-research.md
  Screens/
    round one/screenshots|references|plan/
    round two/screenshots|references|plan/
    complete-system-map.md
  testCase Human/               Jira-shaped markdown + json
  testc2ai/                     YAML for the AI runner
  AutomatedScripts/gui|api
  reports/                      suite results, XLSX/CSV, proof
  jira/                         upload log, payloads, created keys
  bugs/                         bug tickets with proof
```

## Human test case shape

Titles follow the Jira functional pattern:

`[Sales & Marketing Module] [Intermediary Management][Add new/Manage][FP] - Validate that the Emergency Details section displays all required fields.`

Required sections: Affects versions, Labels, Test Case Type, Priority, Parent, Linked work items, Preconditions, Test Steps, Test Comments, Expected Result, Actual Result.

## Jira

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`. Without them, QAFusionX still completes the steps by writing `jira/payloads/*.json` — it never skips the node.

## Visible browser (compulsory)

Crawls and GUI tests must be something you can **watch**. QAFusionX launches headed Chromium (`QAFUSIONX_HEADED=1`, the default) with `slowMo` so each click is visible. Do not replace those rounds with a silent HTTP fetch.

- Local Windows/macOS/Linux desktop: a real browser window opens on your screen.
- `QAFUSIONX_HEADED=0` is only for when you explicitly ask for silent mode.

## Sinhala — මෙය කොහොමද පාවිච්චි කරන්නේ

Cursor එකේ QAFusionX MCP එක connect කළාම **Ask mode** එකට යන්න. මුලින්ම project එක සහ test කරන්න ඕන දේ, URL එක, screenshot එක අහනවා. ඊට පස්සේ **අනිවාර්යයෙන්** user stories අහනවා — zip, Jira link, හෝ system එකෙන් generate. මේ දෙකම උත්තර දුන්නට පස්සේ විතරක් crawl / test generation පටන් ගන්න පුළුවන්. කිසිම step එකක් skip කරලා ඊළඟ එකට යන්න බෑ; `step-by-step/` තියෙන tick එක තමයි ඊළඟ unlock එක.
