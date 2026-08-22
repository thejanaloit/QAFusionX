import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { submitProject, submitUserStories } from "../src/actions/index.ts";
import { abs, DIRS } from "../src/workflow/paths.ts";

const targetUrl = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const shotPath = abs(path.join(DIRS.general, "bootstrap-screenshot.png"));
fs.mkdirSync(path.dirname(shotPath), { recursive: true });

console.log("Opening visible browser for Step 1 screenshot…");
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: shotPath, fullPage: true });
await browser.close();
console.log("Screenshot saved:", shotPath);

const p1 = submitProject({
  name: "PF-57868 FusionX UAT Dashboard",
  whatToTest:
    "FusionX UAT Kenya — Azure AD SSO login, home dashboard, CRM (OLD) / COB onboarding flows per story PF-57868.",
  targetUrl,
  screenshotPath: shotPath,
  affectsVersion: "UAT Kenya",
  jiraBaseUrl: "https://lolcgroupdev.atlassian.net",
  jiraProjectKey: "PF",
  reporter: "Thejana Dewmina",
  parent: "PF-57868",
});
console.log("Step 1:", p1.message);

const p2 = await submitUserStories({
  source: "jira",
  jiraLink: "https://lolcgroupdev.atlassian.net/browse/PF-57868",
  jiraBaseUrl: "https://lolcgroupdev.atlassian.net",
});
console.log("Step 2:", p2.message, "stories:", p2.stories?.length ?? 0);
