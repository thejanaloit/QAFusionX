/**
 * Upload packaged proof PNGs to Jira bugs via visible browser (fallback when REST token 401).
 * Requires you to be logged into lolcgroupdev.atlassian.net in the opened Chrome window.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const WORKSPACE = process.env.QAFUSIONX_WORKSPACE ?? "E:/QAFusionX/workspaces/PF-57868";
const ATTACH_ROOT = path.join(WORKSPACE, "jira", "attachments");
const BASE = "https://lolcgroupdev.atlassian.net/browse";

async function uploadToIssue(page: import("playwright").Page, key: string, files: string[]) {
  await page.goto(`${BASE}/${key}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2500);

  // Already attached filenames on page
  const existing = new Set(
    (await page.locator('[data-testid="issue.views.issue-base.foundation.status.field"] ~ * a, [data-testid*="attachment"] a, .attachment-list a').allTextContents()).map((t) => t.trim()),
  );

  for (const file of files) {
    const base = path.basename(file);
    if ([...existing].some((e) => e.includes(base))) {
      console.log(`  skip ${base} (already on page)`);
      continue;
    }
    const input = page.locator('input[type="file"]').first();
    if ((await input.count()) === 0) {
      // Open attach menu
      const attachBtn = page.getByRole("button", { name: /attach|add attachment|upload/i }).first();
      if (await attachBtn.count()) {
        await attachBtn.click();
        await page.waitForTimeout(800);
      }
    }
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(file);
    await page.waitForTimeout(1500);
    console.log(`  uploaded ${base}`);
  }
}

async function main() {
  if (!fs.existsSync(ATTACH_ROOT)) {
    console.error("No jira/attachments — run pack/upload prep first");
    process.exit(1);
  }

  const bugDirs = fs.readdirSync(ATTACH_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
  const browser = await chromium.launch({ headless: false, channel: "chrome", slowMo: 50 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Log into Jira if prompted, then press Enter in this terminal...");
  await page.goto(`${BASE}/PF-57868`, { waitUntil: "domcontentloaded" });
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const results: { bug: string; files: number; error?: string }[] = [];
  for (const dir of bugDirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = dir.name;
    const files = fs.readdirSync(path.join(ATTACH_ROOT, key)).filter((f) => f.endsWith(".png")).map((f) => path.join(ATTACH_ROOT, key, f));
    if (!files.length) continue;
    console.log(`\n${key} (${files.length} pngs)`);
    try {
      await uploadToIssue(page, key, files);
      results.push({ bug: key, files: files.length });
    } catch (err) {
      console.error(`  ERROR ${key}:`, err);
      results.push({ bug: key, files: files.length, error: String(err) });
    }
  }

  const logPath = path.join(WORKSPACE, "reports", "jira-browser-upload-log.json");
  fs.writeFileSync(logPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  console.log("\nDone. Log:", logPath);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
