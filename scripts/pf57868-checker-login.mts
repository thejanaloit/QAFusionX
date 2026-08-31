import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const email = process.env.CHECKER_EMAIL!;
const password = process.env.CHECKER_PASSWORD!;
const proof = "C:/Users/ThejanaD/QAFusionX/proof-checker-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/checker-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });
const log: any[] = [];

async function body(page: any) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function shot(page: any, n: string) {
  const p = path.join(proof, n + ".png");
  await page.screenshot({ path: p, fullPage: true }).catch(() => page.screenshot({ path: p }));
  try { fs.copyFileSync(p, path.join(mirror, path.basename(p))); } catch {}
  return p;
}
function rec(step: string, extra: any = {}) {
  log.push({ step, at: new Date().toISOString(), ...extra });
  fs.writeFileSync(path.join(proof, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(mirror, "_exec.json"), JSON.stringify(log, null, 2));
}

async function login(page: any) {
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
  for (let i = 0; i < 100; i++) {
    const t = await body(page);
    const url = page.url();
    if (/Continue with AzureAd/i.test(t)) { await page.getByText(/Continue with AzureAd/i).first().click(); await page.waitForTimeout(1500); continue; }
    if (/microsoftonline|login\.microsoft/i.test(url) || /Enter password|Sign in/i.test(t)) {
      if (await page.locator("#i0118").isVisible().catch(() => false)) {
        await page.fill("#i0118", password);
        await page.click("#idSIButton9");
        continue;
      }
      if (await page.locator("#i0116").isVisible().catch(() => false)) {
        await page.fill("#i0116", email);
        await page.click("#idSIButton9");
        continue;
      }
      if (await page.getByRole("button", { name: /^Yes$/i }).count()) { await page.getByRole("button", { name: /^Yes$/i }).first().click(); continue; }
    }
    if (/Core Banking Modules|Duruma|FusionX/i.test(t) && !/Continue with AzureAd|Enter password/i.test(t)) return true;
    await page.waitForTimeout(900);
  }
  return false;
}

async function clickTableAction(page: any, label: string) {
  await page.evaluate((lab: string) => {
    for (const row of [...document.querySelectorAll("tr.ant-table-row")]) {
      const el = [...row.querySelectorAll("a,button,span")].find((e) => ((e as HTMLElement).innerText || "").trim() === lab) as HTMLElement | undefined;
      if (el?.offsetParent) { el.click(); return; }
    }
  }, label);
  await page.waitForTimeout(4500);
}

async function clickText(page: any, re: RegExp) {
  const loc = page.getByRole("button", { name: re }).first();
  if (await loc.count() && await loc.isVisible().catch(() => false)) await loc.click();
  else await page.getByText(re).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(4000);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await (await browser.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
  try {
    if (!(await login(page))) throw new Error("checker-login-failed");
    rec("login", { shot: await shot(page, "00-home"), text: (await body(page)).slice(0, 600) });

    await page.goto("https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await clickText(page, /^Pending Requests$/i);
    rec("perc-pending", { shot: await shot(page, "perc-pending"), text: (await body(page)).slice(0, 1200) });
    await clickTableAction(page, "Select");
    rec("perc-select", { shot: await shot(page, "perc-select"), text: (await body(page)).slice(0, 1200) });
    await clickText(page, /^Approve$/i);
    rec("perc-approve", { shot: await shot(page, "perc-approve"), text: (await body(page)).slice(0, 1200) });
    await clickText(page, /Confirm and Proceed|Confirm|Yes/i);
    rec("perc-confirm", { shot: await shot(page, "perc-confirm"), text: (await body(page)).slice(0, 1200) });

    await page.goto("https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/authorize", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    rec("ncd-auth", { shot: await shot(page, "ncd-auth"), text: (await body(page)).slice(0, 1200) });
    await clickTableAction(page, "Select");
    rec("ncd-select", { shot: await shot(page, "ncd-select"), text: (await body(page)).slice(0, 1200) });
    await clickText(page, /^Approve$/i);
    rec("ncd-approve", { shot: await shot(page, "ncd-approve"), text: (await body(page)).slice(0, 1200) });

    await page.goto("https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    rec("sup-pending", { shot: await shot(page, "sup-pending"), text: (await body(page)).slice(0, 1200) });
    await clickTableAction(page, "Select");
    rec("sup-select", { shot: await shot(page, "sup-select"), text: (await body(page)).slice(0, 1200) });
    await clickText(page, /Confirm|Approve|Authorize/i);
    rec("sup-confirm", { shot: await shot(page, "sup-confirm"), text: (await body(page)).slice(0, 1200) });

    rec("done", { ok: true });
    await page.waitForTimeout(5000);
  } catch (e: any) {
    rec("error", { message: String(e), shot: await shot(page, "error") });
  } finally {
    await browser.close();
  }
})();
