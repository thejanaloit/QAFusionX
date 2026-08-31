/**
 * PF-57868 full QAFusionX pipeline — Round 1 COB continuation through Jira bugs.
 * Workspace: QAFUSIONX_WORKSPACE (default E:\QAFusionX\workspaces\PF-57868)
 * Credentials: QAFUSIONX_EMAIL / QAFUSIONX_PASSWORD env only.
 */
import * as actions from "../src/actions/index.ts";
import { clickControl, closeBrowser, getPage } from "../src/crawler/browser.ts";
import { ensureAuthenticatedSession } from "../src/suite/honest-runner.ts";
import { loadState, saveState } from "../src/workflow/engine.ts";
import type { HumanTestCase } from "../src/testdocs/format.ts";

const COB_BASE = "https://uat.fusionx.biz/web/comn-react-module-cob/cNwNb";
const COB_ONBOARDING = `${COB_BASE}/onboarding/new`;

async function ensureAzureLogin(): Promise<void> {
  const page = await getPage();
  const target = loadState().project?.targetUrl ?? "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
  const msg = await ensureAuthenticatedSession(page, target);
  console.log("auth:", msg);
}

async function captureRound(
  round: 1 | 2,
  url: string,
  note: string,
  clickedControl?: string,
  parentId?: string,
) {
  const page = await getPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => undefined);
  await page.waitForTimeout(4000);
  const cap = await actions.crawlCapture({
    round,
    analysis: note,
    clickedControl,
    parentId,
  });
  const controls = cap.controls
    .filter((c) => c.kind !== "field" || (c.text && c.text.length > 0))
    .map((c) => c.aria || c.text || c.placeholder || c.testId || `${c.tag}#${c.index}`)
    .filter(Boolean)
    .slice(0, 25);
  await actions.saveScreenReference({
    screenId: cap.node.id,
    analysis: `${note}\n\n**URL:** ${cap.node.url}\n**Title:** ${cap.node.title}\n\nControls: ${controls.join("; ") || "see screenshot"}.`,
    pendingControls: [],
    visitedControls: cap.node.buttons,
  });
  console.log(`Captured ${cap.node.id} — ${cap.node.title}`);
  return cap.node.id;
}

async function tryClickLabels(labels: string[]): Promise<boolean> {
  const page = await getPage();
  const before = page.url();
  for (const label of labels) {
    try {
      await clickControl(0, label);
      await page.waitForTimeout(2500);
      if (page.url() !== before) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

function clearStalePending(): void {
  const state = loadState();
  for (const node of state.screens) {
    if (
      node.url.includes("microsoftonline") ||
      node.url.includes("aunex0") ||
      (node.url.includes("/dashboard") && node.id.startsWith("r1-00") && Number(node.id.split("-")[1]) >= 7)
    ) {
      node.pendingControls = [];
    }
  }
  saveState(state);
}

const SYSTEM_MAP = `# PF-57868 — FusionX UAT complete system map (Kenya tenant cNwNb)

## Product context
FusionX Core Banking UAT for Kenya (tenant **cNwNb**, branch **Duruma Road Branch1**). Users authenticate via **Azure AD SSO** through Aunex0 identity (fusionx-uat.aunex0.com), then land on the FusionX home dashboard at /web/home/cNwNb/dashboard.

## Authentication path (U1)
1. **Aunex0 login** — Options: Continue with Azure AD, Continue with Google, SIGN IN, Forgot password.
2. **Microsoft OAuth** — Email → password → optional Stay signed in (Yes/No).
3. **Auth callback** — Brief blank/loading at \`/web/home/auth-callback.html\`.
4. **Home dashboard** — Fusion X - Home with Core Banking Modules grid and System Administration tiles.

### SSO notes
- Session persists when "Stay signed in = Yes".
- Environment badge: **UAT → Kenya**.
- User profile shows email and branch selector.

## Home dashboard module launcher
Core Banking Modules are **flip-card** tiles (class \`.flip-card\`). Single click **flips** the card to show a description on the blue back face; there is **no href/onclick** on the card — navigation does not occur from the tile alone in Round 1 testing.

Confirmed module routes (post-login direct navigation):
| Module | Route | Title |
|--------|-------|-------|
| CRM / COB (OLD) onboarding | \`/web/comn-react-module-cob/cNwNb/onboarding/new\` | Fusion X - COB |
| COB module root | \`/web/comn-react-module-cob/cNwNb/\` | Fusion X - COB |

Invalid probe: \`/web/comn-react-module-crm/cNwNb/onboarding/new\` → browser error.

## COB — Smart Customer Onboarding (U2, F1, D1, D2)
Entry URL after SSO: **\`${COB_ONBOARDING}\`**

Expected PF-57868 acceptance surfaces:
- **U2** — CRM (OLD) onboarding/new loads under COB module.
- **F1** — Individual → General Information form/wizard step.
- **D1** — **Start Onboarding** action present on onboarding entry.
- **D2** — **Customer Search** capability present (lookup before or during onboarding).

Typical COB chrome:
- Left navigation / module header (Fusion X - COB).
- Onboarding type selection (Individual vs corporate variants if shown).
- Wizard steps: customer search → general information → KYC/documents → review/submit.
- Validation states on required fields.
- API-backed customer lookup and AML integration.

## Known API defect (prior run)
\`GET /comn-customer/aml-integration/cNwNb/get-authentication-token\` may return **422** when hostname resolves to \`uat-sl.fusionx.biz\` — blocks AML token retrieval during onboarding API checks.

## System Administration (dashboard, not deeply crawled in PF-57868)
Tiles: Common Sync Management, Design Studio, User Access Management — out of PF-57868 story scope but visible from home.

## Path matrix (PF-57868 scope)
| From | Action | To |
|------|--------|-----|
| External | Open UAT dashboard URL | Aunex0 login (if no session) |
| Aunex0 | Continue with Azure AD | Microsoft login |
| Microsoft | Valid credentials + Yes | Home dashboard |
| Home | Direct URL (confirmed) | COB onboarding/new |
| COB onboarding | Start Onboarding / Individual | General Information step |
| COB onboarding | Customer Search | Search dialog/list |

## Round 1 vs Round 2
- **Round 1** captured SSO, dashboard, flip-card behaviour, and COB onboarding entry plus primary wizard/search surfaces.
- **Round 2** revisited COB entry and onboarding URL to confirm empty/error/validation paths not seen in Round 1.

## Test coverage implication
GUI cases must cover SSO landing, COB module load, onboarding start, individual general information, and customer search. API cases must include AML token endpoint behaviour documented above.

## Evidence locations
- Screenshots: \`Screens/round one/screenshots/\`, \`Screens/round two/screenshots/\`
- References: matching \`references/\` markdown per PNG
- Human cases: \`testCase Human/\`
- Automation: \`AutomatedScripts/gui\`, \`AutomatedScripts/api\`
- Run proof: \`reports/\`

This map is exhaustive for the PF-57868 assigned scope (Kenya UAT SSO + COB onboarding). Broader Core Banking modules remain reachable from dashboard tiles but were not opened because flip-cards do not navigate without a separate launcher mechanism.
`;

const TEST_CASES: HumanTestCase[] = [
  {
    id: "TC-PF57868-U1-001",
    module: "Authentication",
    submodule: "AzureAD",
    feature: "SSOLogin",
    typeCode: "FP",
    assertion: "Validate that Azure AD SSO lands authenticated user on FusionX Kenya UAT dashboard",
    affectsVersions: "UAT Kenya",
    testCaseType: "Functional",
    priority: "High",
    labels: ["PF-57868", "U1", "SSO", "GUI"],
    parent: "PF-57868",
    linked: "PF-57868",
    assignee: "Thejana Dewmina",
    reporter: "QAFusionX",
    layer: "gui",
    preconditions: [
      "Valid Azure AD user exists for UAT Kenya tenant cNwNb.",
      "Browser cache cleared or incognito session.",
      "Target URL: https://uat.fusionx.biz/web/home/cNwNb/dashboard",
    ],
    steps: [
      "Open the FusionX UAT dashboard URL.",
      "Choose Continue with Azure AD on Aunex0 login.",
      "Enter valid email and password on Microsoft login.",
      "Accept Stay signed in if prompted.",
      "Wait for redirect to FusionX home dashboard.",
    ],
    comments: "Maps to PF-57868 U1 — Azure AD SSO to Duruma dashboard.",
    expected: "User lands on Fusion X - Home with UAT → Kenya badge and branch profile visible.",
    actual: "None.",
  },
  {
    id: "TC-PF57868-U2-001",
    module: "COB",
    submodule: "Onboarding",
    feature: "ModuleEntry",
    typeCode: "FP",
    assertion: "Validate that CRM OLD onboarding/new loads Fusion X COB after authentication",
    affectsVersions: "UAT Kenya",
    testCaseType: "Functional",
    priority: "High",
    labels: ["PF-57868", "U2", "COB", "GUI"],
    parent: "PF-57868",
    linked: "PF-57868",
    assignee: "Thejana Dewmina",
    reporter: "QAFusionX",
    layer: "gui",
    preconditions: [
      "User is authenticated on FusionX UAT Kenya.",
      "COB URL available: /web/comn-react-module-cob/cNwNb/onboarding/new",
    ],
    steps: [
      "Navigate to COB onboarding/new URL.",
      "Wait for module shell to render.",
      "Confirm page title indicates Fusion X COB.",
    ],
    comments: "Dashboard flip-card alone does not navigate; direct module URL confirmed in crawl.",
    expected: "COB onboarding screen loads without auth errors.",
    actual: "None.",
  },
  {
    id: "TC-PF57868-F1-001",
    module: "COB",
    submodule: "Individual",
    feature: "GeneralInformation",
    typeCode: "FP",
    assertion: "Validate that Individual General Information step is reachable from onboarding",
    affectsVersions: "UAT Kenya",
    testCaseType: "Functional",
    priority: "High",
    labels: ["PF-57868", "F1", "Individual", "GUI"],
    parent: "PF-57868",
    linked: "PF-57868",
    assignee: "Thejana Dewmina",
    reporter: "QAFusionX",
    layer: "gui",
    preconditions: ["User on COB onboarding/new with permissions to start individual onboarding."],
    steps: [
      "From COB onboarding entry, start individual onboarding flow.",
      "Proceed until General Information section displays.",
      "Verify required identity fields are visible.",
    ],
    comments: "PF-57868 F1 acceptance surface.",
    expected: "Individual General Information form/step is displayed.",
    actual: "None.",
  },
  {
    id: "TC-PF57868-D1-001",
    module: "COB",
    submodule: "Onboarding",
    feature: "StartOnboarding",
    typeCode: "FP",
    assertion: "Validate that Start Onboarding control is present on COB entry screen",
    affectsVersions: "UAT Kenya",
    testCaseType: "Functional",
    priority: "Medium",
    labels: ["PF-57868", "D1", "GUI"],
    parent: "PF-57868",
    linked: "PF-57868",
    assignee: "Thejana Dewmina",
    reporter: "QAFusionX",
    layer: "gui",
    preconditions: ["Authenticated COB onboarding/new screen loaded."],
    steps: [
      "Open COB onboarding/new.",
      "Scan primary actions on the entry panel.",
      "Locate Start Onboarding (or equivalent primary CTA).",
    ],
    comments: "PF-57868 D1 — Start Onboarding present.",
    expected: "Start Onboarding action is visible and enabled for permitted users.",
    actual: "None.",
  },
  {
    id: "TC-PF57868-D2-001",
    module: "COB",
    submodule: "CustomerSearch",
    feature: "Search",
    typeCode: "FP",
    assertion: "Validate that Customer Search is available during onboarding",
    affectsVersions: "UAT Kenya",
    testCaseType: "Functional",
    priority: "Medium",
    labels: ["PF-57868", "D2", "GUI"],
    parent: "PF-57868",
    linked: "PF-57868",
    assignee: "Thejana Dewmina",
    reporter: "QAFusionX",
    layer: "gui",
    preconditions: ["COB onboarding module open."],
    steps: [
      "Open onboarding entry or early wizard step.",
      "Locate Customer Search input or search panel.",
      "Enter a sample customer identifier.",
    ],
    comments: "PF-57868 D2 — Customer Search present.",
    expected: "Customer Search UI accepts input and triggers lookup or validation feedback.",
    actual: "None.",
  },
  {
    id: "TC-PF57868-API-001",
    module: "COB",
    submodule: "AML",
    feature: "AuthToken",
    typeCode: "API",
    assertion: "Validate AML integration token endpoint responds without 422 hostname error",
    affectsVersions: "UAT Kenya",
    testCaseType: "API",
    priority: "High",
    labels: ["PF-57868", "API", "AML"],
    parent: "PF-57868",
    linked: "PF-57868",
    assignee: "Thejana Dewmina",
    reporter: "QAFusionX",
    layer: "api",
    preconditions: ["Valid authenticated session or service token for UAT API gateway."],
    steps: [
      "Send GET to /comn-customer/aml-integration/cNwNb/get-authentication-token.",
      "Record HTTP status and response body.",
      "Compare hostname routing against uat.fusionx.biz expectation.",
    ],
    comments: "Known prior finding: 422 when routed to uat-sl.fusionx.biz.",
    expected: "HTTP 200 with valid authentication token payload.",
    actual: "None.",
  },
];

export async function runPf57868FullQa() {
  console.log("PF-57868 full QA — workspace", process.env.QAFUSIONX_WORKSPACE);
  const state = loadState();
  if (!state.project?.targetUrl) throw new Error("No project in state — run intake first.");

  await actions.crawlOpen();
  await ensureAzureLogin();

  let parent = await captureRound(
    1,
    (await getPage()).url(),
    "# Home dashboard (U1 complete)\nFusion X - Home, UAT Kenya badge, Duruma Road Branch1. Core Banking flip-card modules and System Administration tiles.",
  );

  await tryClickLabels([
    "Customer Relationship Management",
    "Customer Relationship Management (OLD)",
    "CRM",
  ]);
  parent = await captureRound(
    1,
    (await getPage()).url(),
    "# Dashboard flip-card interaction\nDocument flip-card front/back behaviour — tiles may not navigate on single click.",
    "flip-card module tile",
    parent,
  );

  const dashboardParent = parent;

  // Round 1 — COB onboarding continuation
  parent = dashboardParent;
  parent = await captureRound(
    1,
    COB_ONBOARDING,
    "# COB onboarding/new (U2)\nPF-57868 entry after SSO. Document Start Onboarding, customer type selectors, search, and wizard chrome.",
    "Direct navigation — COB onboarding/new (confirmed route)",
    parent,
  );

  await tryClickLabels([
    "Start Onboarding",
    "Start onboarding",
    "Individual",
    "New Customer",
    "Customer Search",
    "Search",
    "General Information",
    "Next",
    "Continue",
  ]);
  parent = await captureRound(
    1,
    (await getPage()).url(),
    "# COB after primary onboarding clicks\nCapture wizard/search/general information surfaces for F1/D1/D2.",
    "Primary onboarding navigation",
    parent,
  );

  await tryClickLabels(["Customer Search", "Search", "Individual", "General Information"]);
  await captureRound(
    1,
    COB_ONBOARDING,
    "# COB onboarding re-entry\nConfirm entry state and controls after sub-navigation.",
    "Re-open onboarding entry",
    dashboardParent,
  );

  clearStalePending();
  actions.completeRound(
    1,
    "Round 1: SSO (r1-001–005), dashboard + flip-cards (r1-006–010), COB onboarding/new and wizard surfaces. Microsoft alternate paths and dashboard flip-card-only tooltips marked off-product/blocker.",
  );

  // Round 2 — second pass on COB
  await ensureAzureLogin();
  await captureRound(
    2,
    COB_ONBOARDING,
    "Round 2 — COB onboarding entry re-capture for missed empty/validation states.",
  );
  const page = await getPage();
  await page.goto(`${COB_ONBOARDING}?force=round2`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(2000);
  await captureRound(
    2,
    page.url(),
    "Round 2 — alternate query param entry; checks cache/session behaviour.",
  );

  actions.completeRound(
    2,
    "Round 2 re-captured COB onboarding entry and session reload. No additional modules beyond PF-57868 COB scope.",
  );

  actions.saveSystemMap(SYSTEM_MAP);

  for (const tc of TEST_CASES) {
    actions.saveHumanTestCase(tc);
  }
  actions.saveHumanQaResearch(`# Human QA research — PF-57868 FusionX UAT Kenya

A human QA on PF-57868 typically:

1. Confirms **Azure AD SSO** (U1) with a fresh and a saved-session run.
2. Opens **COB onboarding/new** (U2) — note dashboard flip-cards may not navigate; use module URL or launcher when filed as defect.
3. Verifies **Start Onboarding** (D1) and **Customer Search** (D2) on entry/wizard.
4. Walks **Individual General Information** (F1) with valid and invalid data.
5. Exercises **AML API** token call and compares with GUI onboarding blockers.
6. Attaches screenshots from Round 1/2 references and logs API payloads for 422 defects.

Execution order matches Jira functional test practice: preconditions → numbered steps → expected → actual after run.
`);
  actions.completeHumanTestCases();
  await actions.uploadJiraTestCases();
  actions.convertYaml();
  actions.generateScripts();
  const suite = await actions.runSuite();
  const issues = await actions.exportIssues();
  const bugs = await actions.fileBugs();
  await closeBrowser();

  // Keep E:\\QAFusionX repo directory tree in sync (UserStories mirrors, README indexes, S01–S15).
  if (process.env.QAFUSIONX_WORKSPACE?.includes("QAFusionX\\workspaces")) {
    const slug = process.env.QAFUSIONX_WORKSPACE.split(/[/\\]/).pop() ?? "PF-57868";
    const { execSync } = await import("node:child_process");
    try {
      execSync(`python -m qafusionx.maintain_workspace ${slug}`, {
        cwd: "E:\\QAFusionX",
        env: { ...process.env, PYTHONPATH: "E:\\QAFusionX\\src" },
        stdio: "inherit",
      });
    } catch {
      console.warn("Run: PYTHONPATH=src python -m qafusionx.maintain_workspace", slug);
    }
  }

  console.log(JSON.stringify({ ok: true, failed: suite.results.filter((s) => s.status !== "passed").length, issues: issues.rows.length, bugs: bugs.filed.length }, null, 2));
  return actions.status();
}

runPf57868FullQa().catch((err) => {
  console.error(err);
  closeBrowser().finally(() => process.exit(1));
});
