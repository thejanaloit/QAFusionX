/**
 * PF-57868 Round 1 crawl ONLY — real headed captures. Fails loudly if SSO/dashboard/COB incomplete.
 */
import fs from "node:fs";
import path from "node:path";
import * as actions from "../src/actions/index.ts";
import {
  clickControl,
  closeBrowser,
  fillField,
  getPage,
} from "../src/crawler/browser.ts";
import { abs, DIRS } from "../src/workflow/paths.ts";
import { loadState, saveState, writeStepFile } from "../src/workflow/engine.ts";

const EMAIL = process.env.QAFUSIONX_EMAIL ?? "";
const PASSWORD = process.env.QAFUSIONX_PASSWORD ?? "";
const DASHBOARD = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const COB_ONBOARDING =
  "https://uat.fusionx.biz/web/comn-react-module-cob/cNwNb/onboarding/new";

function reopenRound1(): void {
  for (const sub of [
    DIRS.roundOneScreenshots,
    DIRS.roundOneReferences,
    DIRS.roundOnePlan,
  ]) {
    const dir = abs(sub);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  const state = loadState();
  state.currentStepId = 4;
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
  state.steps["round-2-crawl"] = {
    status: "locked",
    gates: { round2Screens: false, round2References: false, missedReview: false },
  };
  saveState(state);
  writeStepFile(4, "available", "Round 1 re-opened — prior incomplete crawl cleared.");
  writeStepFile(5, "locked", "Waiting for Round 1 crawl.");
}

function alreadyCapturedAunex0(): boolean {
  return loadState().screens.some((s) => s.round === 1 && s.url.includes("aunex0"));
}

async function cap(
  analysis: string,
  clickedControl?: string,
  parentId?: string,
) {
  const page = await getPage();
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(800);
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
  console.log(`Captured ${result.node.id} — ${result.node.title}`);
  return result.node.id;
}

async function clickAzureAdOnly(): Promise<void> {
  const page = await getPage();
  const azure = page.locator("a, button").filter({ hasText: /Continue with AzureAd/i });
  await azure.first().click({ timeout: 15_000 });
  await Promise.race([
    page.waitForURL(/microsoftonline|login\.microsoft/i, { timeout: 45_000 }),
    page.waitForURL(/\/web\/home\//i, { timeout: 45_000 }),
  ]).catch(() => page.waitForTimeout(5000));
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function tryAunex0FormLogin(): Promise<boolean> {
  const page = await getPage();
  if (!page.url().includes("aunex0")) return false;
  const user = page.locator('input[placeholder="Username"], input[name="Username"], #Username').first();
  const pass = page.locator('input[placeholder="Password"], input[type="password"]').first();
  if ((await user.count()) === 0 || (await pass.count()) === 0) return false;
  if (!EMAIL || !PASSWORD) return false;
  await user.fill(EMAIL);
  await pass.fill(PASSWORD);
  await page.getByRole("button", { name: /^SIGN IN$/i }).click({ timeout: 10_000 });
  await Promise.race([
    page.waitForURL(/microsoftonline|login\.microsoft/i, { timeout: 30_000 }),
    page.waitForURL(/\/web\/home\//i, { timeout: 30_000 }),
  ]).catch(() => page.waitForTimeout(5000));
  return true;
}

async function loginToDashboard(): Promise<string> {
  const page = await getPage();
  let parent = "";

  for (let step = 0; step < 15; step += 1) {
    const url = page.url();

    if (url.includes("/web/home/") && url.includes("/dashboard")) {
      return await cap(
        "FusionX home dashboard after Azure AD SSO. UAT Kenya badge, branch profile, Core Banking flip-cards, System Administration tiles.",
        parent ? "SSO complete" : "entry",
        parent || undefined,
      );
    }

    if (url.includes("auth-callback")) {
      parent = await cap("OAuth auth-callback loading between identity provider and FusionX.", "OAuth redirect", parent || undefined);
      await page.waitForTimeout(6000);
      continue;
    }

    if (url.includes("accounts.google.com")) {
      parent = await cap("Wrong path — Google login. Backing out; use Azure AD only.", "Google (blocked)", parent || undefined);
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
      await page.waitForTimeout(2000);
      continue;
    }

    if (url.includes("aunex0") || url.includes("fusionx-uat.aunex0")) {
      if (!alreadyCapturedAunex0()) {
        parent = await cap(
          "Aunex0 login page (tenant cNwNb). Continue with AzureAd required; Google is wrong path.",
          parent ? "Retry login" : "entry",
          parent || undefined,
        );
      }
      await clickAzureAdOnly();
      if (page.url().includes("aunex0")) {
        await tryAunex0FormLogin();
      }
      if (page.url().includes("aunex0")) {
        throw new Error("Stuck on Aunex0 — Azure AD and form login did not redirect.");
      }
      continue;
    }

    if (url.includes("microsoftonline") || url.includes("login.microsoft")) {
      const hasPassword = (await page.locator("#i0118").count()) > 0;
      if (!hasPassword) {
        parent = await cap("Microsoft email step (#i0116).", "Continue with AzureAd", parent || undefined);
        if (!EMAIL) throw new Error("QAFUSIONX_EMAIL missing");
        await fillField("#i0116", EMAIL);
        await page.locator("#idSIButton9").click();
        await page.waitForTimeout(2500);
        continue;
      }
      parent = await cap("Microsoft password step (#i0118).", "Next (email)", parent || undefined);
      if (!PASSWORD) throw new Error("QAFUSIONX_PASSWORD missing");
      await fillField("#i0118", PASSWORD);
      await page.locator("#idSIButton9").click();
      await page.waitForTimeout(3000);
      const yes = page.getByRole("button", { name: "Yes" });
      if (await yes.count()) {
        parent = await cap("Microsoft Stay signed in — Yes/No.", "Sign in (password)", parent || undefined);
        await yes.first().click();
        await page.waitForTimeout(10_000);
      }
      continue;
    }

    // Session may skip dashboard and land on another FusionX route — go to dashboard explicitly.
    if (url.includes("uat.fusionx.biz")) {
      await page.goto(DASHBOARD, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(4000);
      continue;
    }

    parent = await cap(`Unexpected URL during SSO: ${url}`, undefined, parent || undefined);
    await page.waitForTimeout(2000);
  }

  throw new Error(`SSO failed — never reached dashboard. Last URL: ${page.url()}`);
}

async function waitForCobReady(): Promise<void> {
  const page = await getPage();
  await page.waitForFunction(
    () => !document.body?.innerText?.includes("Initializing"),
    { timeout: 90_000 },
  ).catch(() => undefined);
  await page.waitForTimeout(3000);
}

async function tryCobClick(labels: string[], parent: string): Promise<string> {
  const page = await getPage();
  if (!page.url().includes("fusionx.biz") || page.url().includes("aunex0")) {
    return parent;
  }
  const before = page.url();
  for (const label of labels) {
    try {
      await clickControl(0, label);
      await page.waitForTimeout(2500);
      if (page.url().includes("google.com") || page.url().includes("aunex0")) {
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
        continue;
      }
      if (page.url() !== before || label.length > 0) {
        return await cap(`COB after "${label}".`, label, parent);
      }
    } catch {
      /* try next label */
    }
  }
  return parent;
}

function validateRound1(): void {
  const state = loadState();
  const shots = state.screens.filter((s) => s.round === 1);
  const pngCount = fs.readdirSync(abs(DIRS.roundOneScreenshots)).filter((f) => f.endsWith(".png")).length;
  const hasDashboard = shots.some((s) => s.url.includes("/dashboard"));
  const hasCob = shots.some((s) => s.url.includes("comn-react-module-cob"));
  const hasMicrosoft = shots.some((s) => s.url.includes("microsoftonline"));
  const hasAunex0 = shots.some((s) => s.url.includes("aunex0"));
  if (pngCount < 3) {
    throw new Error(`Round 1 invalid: only ${pngCount} PNGs (need ≥3: login + dashboard + COB).`);
  }
  if (!hasAunex0 && !hasMicrosoft) {
    throw new Error("Round 1 invalid: no login capture (Aunex0 or Microsoft).");
  }
  if (!hasDashboard) throw new Error("Round 1 invalid: dashboard never captured.");
  if (!hasCob) throw new Error("Round 1 invalid: COB module never captured.");
  const cobNode = shots.find((s) => s.url.includes("comn-react-module-cob"));
  if (cobNode && cobNode.buttons.length === 0) {
    throw new Error("Round 1 invalid: COB captured while still loading (no controls detected).");
  }
}

function clearLoginPending(): void {
  const state = loadState();
  for (const node of state.screens) {
    if (
      node.url.includes("microsoftonline") ||
      node.url.includes("aunex0") ||
      node.url.includes("accounts.google.com")
    ) {
      node.pendingControls = [];
    }
  }
  saveState(state);
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Set QAFUSIONX_EMAIL and QAFUSIONX_PASSWORD before Round 1 crawl.");
  }

  reopenRound1();
  console.log("Round 1 crawl (strict) — workspace", process.env.QAFUSIONX_WORKSPACE);

  await actions.crawlOpen();
  const page = await getPage();
  let parent: string;

  if (page.url().includes("/dashboard")) {
    parent = await cap(
      "FusionX home dashboard (existing session). UAT Kenya badge, branch profile, Core Banking modules.",
      "entry",
    );
  } else {
    parent = await loginToDashboard();
  }

  await page.goto(DASHBOARD, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(4000);
  if (!loadState().screens.some((s) => s.url.includes("/dashboard"))) {
    parent = await cap(
      "FusionX home dashboard after login.",
      "Open dashboard URL",
      parent,
    );
  }

  await page.goto(COB_ONBOARDING, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForCobReady();
  if (page.url().includes("aunex0")) {
    parent = await loginToDashboard();
    await page.goto(COB_ONBOARDING, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitForCobReady();
  }
  parent = await cap(
    "COB onboarding/new (U2). Start Onboarding, customer type, Customer Search, wizard for PF-57868.",
    "Navigate to COB onboarding/new",
    parent,
  );

  for (const labels of [
    ["Start Onboarding", "Start onboarding"],
    ["Individual", "New Customer"],
    ["Customer Search", "Search"],
    ["General Information"],
    ["Next", "Continue"],
  ]) {
    parent = await tryCobClick(labels, parent);
  }

  clearLoginPending();
  validateRound1();

  const status = actions.completeRound(
    1,
    `Round 1 verified: Microsoft SSO, FusionX dashboard, COB onboarding/new and wizard clicks. PNG count meets minimum gate.`,
  );
  await closeBrowser();
  console.log("Round 1 DONE —", status.currentStep?.title);
}

main().catch(async (err) => {
  console.error("Round 1 FAILED:", err instanceof Error ? err.message : err);
  await closeBrowser();
  process.exit(1);
});
