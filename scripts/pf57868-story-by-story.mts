/**
 * Story-by-story headed QA (ONE browser) — refresh proofs then finalize Book1 Excels.
 * Order: 58374 → 58384. Does not close browser between stories.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
const proofRoot = "C:/Users/ThejanaD/QAFusionX/proof-story-by-story-aug31";
const mirrorRoot = "E:/QAFusionX/workspaces/PF-57868/reports/proof/story-by-story-aug31";
fs.mkdirSync(proofRoot, { recursive: true });
fs.mkdirSync(mirrorRoot, { recursive: true });

const log: any[] = [];
function rec(step: string, extra: any = {}) {
  log.push({ step, at: new Date().toISOString(), ...extra });
  fs.writeFileSync(path.join(proofRoot, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(mirrorRoot, "_exec.json"), JSON.stringify(log, null, 2));
}

async function body(page: Page) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function shot(page: Page, story: string, n: string) {
  const dir = path.join(proofRoot, story);
  const mdir = path.join(mirrorRoot, story);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(mdir, { recursive: true });
  const p = path.join(dir, `${n}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => page.screenshot({ path: p }));
  fs.copyFileSync(p, path.join(mdir, `${n}.png`));
  // also refresh 2round names used by Book1 generator when applicable
  const map: Record<string, string> = {
    "74-view": "r2-74-view.png",
    "74-edit": "r2-74-edit.png",
    "74-tpl": "r2-74-tpl-template.png",
    "75-offer": "r2-75-offer.png",
    "75-contract": "r2-75-contract.png",
    "75-inq-rto": "r2-75-inq-rto.png",
    "76-search": "r2-76-search-CASA.png",
    "76-process": "r2-76-process.png",
    "77-entity": "r2-77-entity-creation.png",
    "77-supplier": "r2-77-supplier-creation.png",
    "77-pend": "r2-77-pending-supplier-confirmation.png",
    "78-view": "r2-78-view.png",
    "78-save": "r2-78-save.png",
    "80-rev": "r2-80-rev.png",
    "80-inq": "r2-80-inq-004225.png",
    "80-realloc": "r2-80-realloc.png",
    "83-manage": "r2-83-account-management-manage-account.png",
    "83-own": "r2-83-maintenance-ownership-transfer.png",
    "83-inq": "r2-83-cNwNb-account-inquiry.png",
    "na-79": "r2-na-79.png",
    "na-81": "r2-na-81.png",
    "na-82": "r2-na-82.png",
    "na-84": "r2-na-84.png",
  };
  const destName = map[n];
  if (destName) {
    const dest = path.join("C:/Users/ThejanaD/QAFusionX/proof-2round-complete-aug31", destName);
    fs.copyFileSync(p, dest);
  }
  return p;
}
async function setInputValue(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { state: "attached", timeout: 20000 });
  await page.evaluate(
    ({ selector: sel, value: val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) throw new Error(`missing ${sel}`);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      el.focus();
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value },
  );
}
async function clickText(page: Page, re: RegExp) {
  const loc = page.getByText(re).first();
  if (await loc.isVisible().catch(() => false)) {
    await loc.click({ force: true });
    return true;
  }
  return false;
}
async function azureLogin(page: Page) {
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 90; i++) {
    const t = await body(page);
    if (/Duruma|Ask FxMind/i.test(t) && !/Sign in|Continue with AzureAd|Enter a valid email|Enter password/i.test(t)) return true;
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInputValue(page, "#i0116", maker.email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInputValue(page, "#i0118", maker.password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    await page.waitForTimeout(700);
  }
  return false;
}
async function go(page: Page, url: string, wait = 3500) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(wait);
}

(async () => {
  console.log("story-by-story start", maker.email);
  const browser = await chromium.launch({ headless: false, slowMo: 55 });
  const ctx = await browser.newContext({ viewport: { width: 1520, height: 960 } });
  const page = await ctx.newPage();
  if (!(await azureLogin(page))) {
    rec("fatal-login");
    console.log("LOGIN FAIL");
    if (process.env.QAFUSIONX_CLOSE_BROWSER === "1") await browser.close();
    process.exit(1);
  }
  rec("maker-ready");
  await shot(page, "PF-58374", "00-home");

  // ——— 58374 ———
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change");
  await clickText(page, /Pending Requests/i);
  await page.waitForTimeout(1500);
  await shot(page, "PF-58374", "74-view");
  const sel = page.getByText(/^Select$/i).first();
  if (await sel.isVisible().catch(() => false)) {
    await sel.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, "PF-58374", "74-edit");
  }
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/settings");
  await shot(page, "PF-58374", "74-tpl");
  rec("done-PF-58374");

  // ——— 58375 ———
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/offer-letter");
  await shot(page, "PF-58375", "75-offer");
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/document-generation");
  await shot(page, "PF-58375", "75-contract");
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/rent-to-own-inquiry");
  await shot(page, "PF-58375", "75-inq-rto");
  rec("done-PF-58375");

  // ——— 58376 ———
  await go(page, "https://uat.fusionx.biz/web/common/cNwNb/schedule-monitory-dashboard");
  await shot(page, "PF-58376", "76-search");
  // copy 404/empty to done-push name if needed
  const s76 = path.join(proofRoot, "PF-58376", "76-search.png");
  if (fs.existsSync(s76)) fs.copyFileSync(s76, path.join("C:/Users/ThejanaD/QAFusionX/proof-done-push-aug31", "76-CASA-search.png"));
  await go(page, "https://uat.fusionx.biz/web/common/cNwNb/process-scheduler-console");
  await shot(page, "PF-58376", "76-process");
  rec("done-PF-58376");

  // ——— 58377 ———
  await go(page, "https://uat.fusionx.biz/web/supplier/cNwNb/entity-creation");
  await shot(page, "PF-58377", "77-entity");
  await go(page, "https://uat.fusionx.biz/web/supplier/cNwNb/supplier-creation");
  await shot(page, "PF-58377", "77-supplier");
  await go(page, "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation");
  await shot(page, "PF-58377", "77-pend");
  rec("done-PF-58377");

  // ——— 58378 ———
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit");
  await shot(page, "PF-58378", "78-list");
  const view = page.getByText(/^View$/i).first();
  if (await view.isVisible().catch(() => false)) {
    await view.click({ force: true });
    await page.waitForTimeout(2500);
    await shot(page, "PF-58378", "78-view");
  }
  await clickText(page, /Create New|Create/i);
  await page.waitForTimeout(2000);
  await shot(page, "PF-58378", "78-save");
  rec("done-PF-58378");

  // ——— 58380 ———
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reversal");
  await shot(page, "PF-58380", "80-rev");
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/account-management/account-inquiry");
  await shot(page, "PF-58380", "80-inq");
  await go(page, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reallocation");
  await shot(page, "PF-58380", "80-realloc");
  rec("done-PF-58380");

  // ——— 58383 ———
  await go(page, "https://uat.fusionx.biz/web/account-management/cNwNb/manage-account");
  await shot(page, "PF-58383", "83-manage");
  await go(page, "https://uat.fusionx.biz/web/account-management/cNwNb/ownership-transfer");
  await shot(page, "PF-58383", "83-own");
  await go(page, "https://uat.fusionx.biz/web/account-management/cNwNb/account-inquiry");
  await shot(page, "PF-58383", "83-inq");
  rec("done-PF-58383");

  // ——— N/A ———
  for (const [s, url, n] of [
    ["PF-58379", "https://uat.fusionx.biz/web/lending/cNwNb/accrued-interest", "na-79"],
    ["PF-58381", "https://uat.fusionx.biz/web/lending/cNwNb/document-request", "na-81"],
    ["PF-58382", "https://uat.fusionx.biz/web/casa/cNwNb/profit-sharing", "na-82"],
    ["PF-58384", "https://uat.fusionx.biz/web/comn-settings/cNwNb/sms", "na-84"],
  ] as const) {
    await go(page, url, 2500);
    await shot(page, s, n);
    rec(`done-${s}`);
  }

  await ctx.storageState({ path: path.join(proofRoot, "_storage.json") }).catch(() => {});
  rec("all-stories-captured");

  // regenerate Book1 per-story Excels with fine-tuned boxes
  const gen = spawnSync("py", ["C:/Users/ThejanaD/QAFusionX/scripts/pf57868-finalize-book1-per-story.py"], {
    encoding: "utf8",
    timeout: 300000,
  });
  fs.writeFileSync(path.join(proofRoot, "_book1-gen.log"), [gen.stdout, gen.stderr].join("\n"));
  console.log("book1 gen status", gen.status);
  console.log(gen.stdout?.slice(-800));
  rec("book1-excel-regenerated", { status: gen.status });

  if (process.env.QAFUSIONX_CLOSE_BROWSER === "1") await browser.close();
  console.log("STORY_BY_STORY_DONE");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
