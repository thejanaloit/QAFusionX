/**
 * Checker-only: Use password instead of MFA number match.
 * Fresh context, one headed browser.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const checker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json", "utf8"));
const proof = "C:/Users/ThejanaD/QAFusionX/proof-checker-password-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/checker-password-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });

async function body(page: Page) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function shot(page: Page, n: string) {
  const p = path.join(proof, `${n}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => page.screenshot({ path: p }));
  fs.copyFileSync(p, path.join(mirror, path.basename(p)));
}
async function setInputValue(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { state: "attached", timeout: 25000 });
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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx = await browser.newContext({ viewport: { width: 1520, height: 960 } });
  const page = await ctx.newPage();
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);

  let logged = false;
  for (let i = 0; i < 100; i++) {
    const t = await body(page);
    if (/Duruma|Ask FxMind/i.test(t) && /MethmiB/i.test(t) && !/ThejanaD@lolctech/i.test(t) && !/Approve sign in|Enter password|Sign in/i.test(t)) {
      logged = true;
      break;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
      await page.waitForTimeout(2500);
      continue;
    }
    // Prefer password over MFA number match (MS labels vary)
    if (/Use my password|Use your password instead/i.test(t)) {
      await page.getByText(/Use my password|Use your password instead/i).first().click({ force: true });
      await page.waitForTimeout(2000);
      await shot(page, "chk-use-password");
      continue;
    }
    if (/Approve sign in|Authenticator app|Choose a way to sign in/i.test(t)) {
      await shot(page, "chk-mfa-prompt");
      const link = page.getByText(/Use my password|Use your password instead/i).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click({ force: true });
        await page.waitForTimeout(2000);
      } else {
        await page.waitForTimeout(1500);
      }
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInputValue(page, "#i0116", checker.email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInputValue(page, "#i0118", checker.password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      await shot(page, "chk-after-pwd");
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (/Pick an account|Use another account/i.test(t)) {
      await page.getByText(/Use another account/i).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      continue;
    }
    await page.waitForTimeout(700);
  }

  await shot(page, "chk-final");
  const who = await body(page);
  const isChecker = /MethmiB/i.test(who) && !/ThejanaD@lolctech/i.test(who) && !/Approve sign in/i.test(who);
  const result = { logged, isChecker, snippet: who.slice(0, 300) };
  fs.writeFileSync(path.join(proof, "_result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(mirror, "_result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  if (isChecker) {
    await page.goto("https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.getByText(/Pending Requests/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByText(/^Select$/i).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.getByText(/^Approve$/i).first().click({ force: true }).catch(() => {});
    await page.getByText(/Confirm|Yes|Proceed/i).first().click({ force: true }).catch(() => {});
    await shot(page, "chk-approve-attempt");
  }

  if (process.env.QAFUSIONX_CLOSE_BROWSER === "1") await browser.close();
  process.exit(isChecker ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
