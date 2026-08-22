import fs from "node:fs";
import { SEED_CASES, SEED_STORIES, SYSTEM_MAP } from "./fixtures.ts";
import * as actions from "../actions/index.ts";
import { getPage, closeBrowser } from "../crawler/browser.ts";
import { bus } from "../events.ts";

const PNG_DOT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function origin(): string {
  return process.env.QAFUSIONX_SAMPLE_ORIGIN ?? "http://127.0.0.1:43181";
}

export async function runGuidedDemo(opts?: { source?: "zip" | "generate" }) {
  const source = opts?.source ?? "zip";
  bus.emitEvent("demo:start", "Guided demo starting. Every workflow step will run in order.");
  actions.resetState();
  actions.begin();

  const tmpShot = "/tmp/qafusionx-target.png";
  fs.writeFileSync(tmpShot, PNG_DOT);

  actions.submitProject({
    name: "InfoIns Sales & Marketing — Intermediary Management",
    whatToTest:
      "Add new/Manage Intermediary Emergency Details: Emergency Name, Relationship Type, Emergency Contact Detail, Emergency Address (optional).",
    targetUrl: `${origin()}/sample/login`,
    screenshotPath: tmpShot,
    affectsVersion: "1.2.25-QA",
    parent: "NFNS-279 SALES MODULE",
    reporter: "QAFusionX",
    assignee: "Janith Bodaragama",
  });

  await actions.submitUserStories(
    source === "generate"
      ? { source: "generate" }
      : {
          source: "zip",
          files: SEED_STORIES.map((s) => ({ name: s.name, content: s.content })),
        },
  );

  actions.persistWorkspace();

  await actions.crawlOpen();
  const page = await getPage();

  const round1 = [
    "/sample/login",
    "/sample/home",
    "/sample/intermediaries",
    "/sample/intermediaries/new?step=basic",
    "/sample/intermediaries/new?step=contact",
    "/sample/intermediaries/new?step=emergency",
    "/sample/intermediaries/new?step=documents",
    "/sample/intermediaries/new?step=review",
    "/sample/intermediaries/IM-1001",
    "/sample/intermediaries/IM-1001/edit",
    "/sample/settings",
  ];

  await page.goto(`${origin()}/sample/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username").fill("qa.analyst");
  await page.getByLabel("Password").fill("FusionX@2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(300);

  for (const path of round1) {
    await page.goto(`${origin()}${path}`, { waitUntil: "domcontentloaded" });
    const captured = await actions.crawlCapture({
      round: 1,
      analysis: `Demo capture of ${path}. All visible buttons and fields are listed in the controls dump. This is Round 1 of the compulsory two-round crawl.`,
    });
    await actions.saveScreenReference({
      screenId: captured.node.id,
      analysis: `Visited ${path}. Title: ${captured.node.title}. Controls: ${captured.controls
        .map((c) => c.text || c.aria || c.testId)
        .filter(Boolean)
        .join(", ")}.`,
      pendingControls: [],
      visitedControls: captured.node.buttons,
    });
  }

  await page.goto(`${origin()}/sample/intermediaries/new?step=emergency`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /leave|home|intermediaries/i }).first().click().catch(() => undefined);
  await actions.crawlCapture({
    round: 1,
    analysis: "Possible leave-wizard popup or navigation chrome after leaving the emergency step.",
    isPopup: true,
  });

  actions.completeRound(
    1,
    "Round 1 visited login, home, list, every wizard step, view, manage, settings, and the leave-wizard chrome. Living plan updated after each capture.",
  );

  const round2 = [
    "/sample/login",
    "/sample/intermediaries?q=zzz-no-match",
    "/sample/intermediaries/new?step=emergency",
    "/sample/intermediaries/IM-1002",
  ];
  for (const path of round2) {
    await page.goto(`${origin()}${path}`, { waitUntil: "domcontentloaded" });
    const captured = await actions.crawlCapture({
      round: 2,
      analysis: `Round 2 miss-hunt capture of ${path}: login error/empty, zero-search, emergency isolation, record without emergency.`,
    });
    await actions.saveScreenReference({
      screenId: captured.node.id,
      analysis: `Round 2 ${path}. Checking empty, error, and missed emergency states.`,
      pendingControls: [],
      visitedControls: captured.node.buttons,
    });
  }
  actions.completeRound(
    2,
    "Round 2 re-captured login, empty search, isolated emergency step, and a record with no emergency details. Nothing further outstanding in the sample graph.",
  );

  if (actions.status().userStories?.source === "generate") {
    actions.draftGeneratedUserStories();
    actions.completeGeneratedUserStories();
  }

  actions.saveSystemMap(SYSTEM_MAP);

  for (const tc of SEED_CASES) {
    actions.saveHumanTestCase(tc);
  }
  actions.saveHumanQaResearch(`# Human QA research

A human QA assigned NFNS-style Sales & Marketing / Intermediary Management work typically:

1. Reads the parent epic and the linked Add new/Manage story.
2. Writes a functional case with bracketed module path in the title, numbered preconditions, numbered steps, expected result, and empty actual until execution.
3. Walks the wizard, concentrating on Emergency Details because optional vs required fields are a common production defect.
4. Tries negative data (letters in a phone, missing Guardian, saving without address).
5. Confirms persistence on Manage.
6. Repeats critical assertions through the API.

Sources of practice: ISTQB Foundation (test procedure specification), Jira Xray/Zephyr field layout (precondition, steps, expected), and common insurance-intermediary KYC emergency-contact rules.

QAFusionX encodes that same artefact shape so a human can still execute the cases when automation is not trusted.
`);
  actions.completeHumanTestCases();
  await actions.uploadJiraTestCases();
  actions.convertYaml();
  actions.generateScripts();
  const suite = await actions.runSuite();
  const issues = await actions.exportIssues();
  const bugs = await actions.fileBugs();
  await closeBrowser();

  bus.emitEvent("demo:done", "Guided demo finished every compulsory step.");
  return {
    status: actions.status(),
    suite: suite.results,
    issues: issues.rows,
    bugs: bugs.filed,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGuidedDemo()
    .then((r) => {
      console.log(JSON.stringify({ ok: true, failed: r.suite.filter((s) => s.status !== "passed").length }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
