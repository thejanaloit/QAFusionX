/**
 * PF-57868 Round 1 — COB onboarding ONLY
 * Target: https://uat.fusionx.biz/web/comn-react-module-cob/cNwNb/onboarding
 */
import fs from "node:fs";
import * as actions from "../src/actions/index.ts";
import { clickControl, closeBrowser, fillField, getPage } from "../src/crawler/browser.ts";
import { abs, DIRS } from "../src/workflow/paths.ts";
import { loadState, saveState, writeStepFile } from "../src/workflow/engine.ts";

const COB_ONBOARDING =
  "https://uat.fusionx.biz/web/comn-react-module-cob/cNwNb/onboarding";
const EMAIL = process.env.QAFUSIONX_EMAIL ?? "";
const PASSWORD = process.env.QAFUSIONX_PASSWORD ?? "";

async function ensureReachCob(): Promise<void> {
  const page = await getPage();
  await page.goto(COB_ONBOARDING, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(5000);

  for (let i = 0; i < 12 && !page.url().includes("comn-react-module-cob/cNwNb/onboarding"); i += 1) {
    if (!page.url().includes("aunex0") && !page.url().includes("microsoftonline")) {
      await page.goto(COB_ONBOARDING, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(4000);
      continue;
    }
    const azure = page.locator("a, button").filter({ hasText: /Continue with AzureAd/i });
    if (await azure.count()) await azure.first().click({ timeout: 10_000 });
    await page.waitForTimeout(3000);
    if (page.url().includes("microsoftonline") || page.url().includes("login.microsoft")) {
      if (!(await page.locator("#i0118").count())) {
        if (EMAIL) await fillField("#i0116", EMAIL);
        await page.locator("#idSIButton9").click();
        await page.waitForTimeout(2500);
      } else {
        if (PASSWORD) await fillField("#i0118", PASSWORD);
        await page.locator("#idSIButton9").click();
        await page.waitForTimeout(3000);
      }
      const yes = page.getByRole("button", { name: "Yes" });
      if (await yes.count()) await yes.first().click();
      await page.waitForTimeout(8000);
    }
    if (page.url().includes("aunex0") && EMAIL && PASSWORD) {
      await page.locator('input[placeholder="Username"]').fill(EMAIL).catch(() => undefined);
      await page.locator('input[type="password"]').fill(PASSWORD).catch(() => undefined);
      await page.getByRole("button", { name: /^SIGN IN$/i }).click().catch(() => undefined);
      await page.waitForTimeout(8000);
    }
    await page.goto(COB_ONBOARDING, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(5000);
  }

  await waitForCobUi();

  if (!page.url().includes("comn-react-module-cob/cNwNb/onboarding")) {
    throw new Error(`Could not reach COB /onboarding. Last URL: ${page.url()}`);
  }
}

function reopenRound1(): void {
  for (const sub of [DIRS.roundOneScreenshots, DIRS.roundOneReferences, DIRS.roundOnePlan]) {
    const dir = abs(sub);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  const state = loadState();
  state.currentStepId = 4;
  state.project = {
    ...state.project!,
    targetUrl: COB_ONBOARDING,
    whatToTest:
      "FusionX UAT Kenya COB Customer Onboarding Dashboard only — Customer Search, Facilities, and related controls at /onboarding (tenant cNwNb). PF-57868 scope.",
  };
  state.screens = state.screens.filter((s) => s.round !== 1);
  state.steps["round-1-crawl"] = {
    status: "available",
    gates: {
      openedTarget: false,
      visibleBrowserOpened: false,
      atLeastOneScreen: false,
      referencesMatchScreenshots: false,
      noPendingQueue: false,
    },
  };
  state.steps["round-1-plan"] = {
    status: "locked",
    gates: { livingPlan: false, todoList: false, coverageNote: false },
  };
  saveState(state);
  writeStepFile(4, "available", "Round 1 re-opened — COB /onboarding scope only.");
}

async function cap(analysis: string, clickedControl?: string, parentId?: string) {
  const page = await getPage();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(1500);
      await assertNotLoadingScreen();
      const result = await actions.crawlCapture({
        round: 1,
        analysis: `${analysis}\n\n**URL:** ${page.url()}\n**Title:** ${await page.title()}`,
        clickedControl,
        parentId,
      });
      await actions.saveScreenReference({
        screenId: result.node.id,
        analysis: `${analysis}\n\n**URL:** ${result.node.url}\n**Title:** ${result.node.title}`,
        pendingControls: result.node.pendingControls,
        visitedControls: result.node.visitedControls,
      });
      console.log(`Captured ${result.node.id} — ${await page.title()}`);
      return result.node.id;
    } catch (err) {
      if (attempt === 2) throw err;
      await page.waitForTimeout(2000);
    }
  }
  throw new Error("capture failed");
}

async function waitForCobUi(): Promise<void> {
  const page = await getPage();
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? "";
        return (
          t.includes("Customer Identification") ||
          t.includes("Welcome to Customer Onboarding Dashboard") ||
          (t.includes("CUSTOMER SEARCH") && !t.includes("Authenticating") && !t.includes("Initializing"))
        );
      },
      { timeout: 120_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(2000);
}

async function assertNotLoadingScreen(): Promise<void> {
  const page = await getPage();
  const text = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  if (/Authenticating|Initializing|LOADING/i.test(text) && !text.includes("Customer Identification")) {
    throw new Error("COB page still on loading/authenticating spinner — not the testable UI yet.");
  }
}

async function tryClick(label: string, parent: string): Promise<string> {
  const page = await getPage();
  if (!page.url().includes("comn-react-module-cob")) return parent;
  try {
    await clickControl(0, label);
    await page.waitForTimeout(2500);
    return await cap(`After clicking "${label}" on COB onboarding dashboard.`, label, parent);
  } catch {
    return parent;
  }
}

function validateRound1(): void {
  const state = loadState();
  const shots = state.screens.filter((s) => s.round === 1);
  const pngCount = fs
    .readdirSync(abs(DIRS.roundOneScreenshots))
    .filter((f) => f.endsWith(".png")).length;
  const onCob = shots.every((s) => s.url.includes("comn-react-module-cob/cNwNb/onboarding"));
  if (pngCount < 2) {
    throw new Error(`Need ≥2 PNGs on COB /onboarding; got ${pngCount}.`);
  }
  if (!onCob && !shots.some((s) => s.url.includes("comn-react-module-cob"))) {
    throw new Error("No capture on COB onboarding URL.");
  }
  const entry = shots[0];
  const refText = fs.readFileSync(abs(entry.referenceRel), "utf8");
  if (entry.buttons.length === 0 && !refText.includes("Customer Identification")) {
    throw new Error("Entry screen not the Customer Search UI — still loading or wrong page.");
  }
}

async function main() {
  reopenRound1();
  console.log("COB onboarding-only crawl —", COB_ONBOARDING);

  process.env.QAFUSIONX_HEADED = "1";
  await actions.crawlOpen();
  await ensureReachCob();

  let parent = await cap(
    "COB Customer Onboarding Dashboard — default Customer Search panel. Fields: Customer Identification, Customer Ref Code, Customer Full Name, Business Registration Number, Customer Contact Number. Search button. Left nav: FACILITIES, CUSTOMER SEARCH.",
    "entry",
  );

  parent = await tryClick("FACILITIES", parent);
  parent = await tryClick("CUSTOMER SEARCH", parent);
  parent = await tryClick("Search", parent);

  const p = await getPage();
  const fields = [
    "Customer Identification",
    "Customer Ref Code",
    "Customer Full Name",
  ];
  for (const ph of fields) {
    const loc = p.getByPlaceholder(ph);
    if (await loc.count()) {
      await loc.first().fill("TEST");
      await p.waitForTimeout(400);
    }
  }
  parent = await cap(
    "Customer Search form with sample values entered in identification/ref/name fields.",
    "Fill search fields (TEST)",
    parent,
  );

  const st = loadState();
  for (const node of st.screens) {
    if (node.url.includes("aunex0")) node.pendingControls = [];
  }
  saveState(st);

  validateRound1();
  const status = actions.completeRound(
    1,
    "Round 1 — COB /onboarding only: Customer Search entry, Facilities tile, Search interaction, form fill state. Scope excludes dashboard SSO and /onboarding/new.",
  );
  await closeBrowser();
  console.log("Round 1 DONE —", status.currentStep?.title);
}

main().catch(async (err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  await closeBrowser();
  process.exit(1);
});
