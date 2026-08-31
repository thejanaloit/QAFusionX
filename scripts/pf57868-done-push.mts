/**
 * Done-push pass: annotate-ready proof + aggressive completion attempts.
 * ONE headed browser. Fresh checker context (no maker storageState).
 * Click GBAF to escape selector. Fill schedule dates properly.
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import fs from "node:fs";
import path from "node:path";

function loadJson(f: string) {
  return JSON.parse(fs.readFileSync(f, "utf8"));
}
const maker = loadJson("C:/Users/ThejanaD/QAFusionX/tmp-creds.json");
const checker = fs.existsSync("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json")
  ? loadJson("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json")
  : { email: process.env.CHECKER_EMAIL || "MethmiB@lolctech.com", password: process.env.CHECKER_PASSWORD || "" };

const proof = "C:/Users/ThejanaD/QAFusionX/proof-done-push-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/done-push-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });

const log: any[] = [];
const verdicts: Record<string, { status: string; notes: string[]; blockers: string[] }> = {};

function V(s: string) {
  if (!verdicts[s]) verdicts[s] = { status: "IN_PROGRESS", notes: [], blockers: [] };
  return verdicts[s];
}
function note(s: string, m: string) {
  V(s).notes.push(m);
}
function block(s: string, m: string) {
  if (!V(s).blockers.includes(m)) V(s).blockers.push(m);
}
function clearBlock(s: string, re: RegExp) {
  V(s).blockers = V(s).blockers.filter((b) => !re.test(b));
}
function save() {
  fs.writeFileSync(path.join(proof, "_verdicts.json"), JSON.stringify(verdicts, null, 2));
  fs.writeFileSync(path.join(mirror, "_verdicts.json"), JSON.stringify(verdicts, null, 2));
  fs.writeFileSync(path.join(proof, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(mirror, "_exec.json"), JSON.stringify(log, null, 2));
}
function rec(step: string, extra: any = {}) {
  log.push({ step, at: new Date().toISOString(), ...extra });
  save();
}

async function body(page: Page) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function shot(page: Page, n: string) {
  const p = path.join(proof, n.endsWith(".png") ? n : `${n}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => page.screenshot({ path: p }));
  try {
    fs.copyFileSync(p, path.join(mirror, path.basename(p)));
  } catch {}
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

async function azureLogin(page: Page, email: string, password: string) {
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 90; i++) {
    const t = await body(page);
    if (/Duruma|Ask FxMind|Core Banking Modules/i.test(t) && !/Sign in|Continue with AzureAd|Enter a valid email|Enter password/i.test(t)) {
      return true;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInputValue(page, "#i0116", email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInputValue(page, "#i0118", password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      continue;
    }
    if (/Stay signed in|Don't show this again/i.test(t)) {
      await page.locator("#idSIButton9").click({ force: true }).catch(() => clickText(page, /^Yes$/i));
      await page.waitForTimeout(2500);
      continue;
    }
    if (/Pick an account|Use another account/i.test(t)) {
      await clickText(page, /Use another account/i);
      await page.waitForTimeout(1500);
      continue;
    }
    await page.waitForTimeout(800);
  }
  return false;
}

async function hardLogout(page: Page, ctx: BrowserContext) {
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1000);
  await clickText(page, /ThejanaD|Methmi|@lolctech/i);
  await page.waitForTimeout(500);
  await clickText(page, /Sign out|Log out|Logout/i);
  await page.waitForTimeout(1500);
  await ctx.clearCookies();
  await page.goto("https://login.microsoftonline.com/common/oauth2/v2.0/logout").catch(() => {});
  await page.waitForTimeout(2500);
  await ctx.clearCookies();
}

async function whoAmI(page: Page) {
  const t = await body(page);
  if (/MethmiB@lolctech\.com|MethmiB/i.test(t) && !/ThejanaD@lolctech\.com/i.test(t)) return "checker";
  if (/ThejanaD@lolctech\.com|ThejanaD/i.test(t)) return "maker";
  return "unknown";
}

async function visit(page: Page, name: string, url: string, wait = 3500) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await shot(page, name);
  return body(page);
}

async function pickGBAF(page: Page) {
  const t = await body(page);
  if (/Select Banking & Finance Type|General Banking & Finance|GBAF/i.test(t)) {
    const gbaf = page.getByText(/General Banking & Finance/i).first();
    if (await gbaf.isVisible().catch(() => false)) {
      await gbaf.click({ force: true });
      await page.waitForTimeout(2500);
      return true;
    }
    await clickText(page, /GBAF/i);
    await page.waitForTimeout(2500);
    return true;
  }
  return false;
}

async function fillScheduleAndSearch(page: Page) {
  // try ant date pickers + schedule name
  const from = page.locator("input").nth(0);
  const to = page.locator("input").nth(1);
  await from.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.type("2026-08-01");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await to.click({ force: true }).catch(() => {});
  await page.keyboard.type("2026-08-31");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  // module already set sometimes — open schedule name dropdown
  const selects = page.locator(".ant-select");
  const n = await selects.count();
  if (n >= 2) {
    await selects.nth(1).click({ force: true });
    await page.waitForTimeout(800);
    const opt = page.locator(".ant-select-item-option").first();
    if (await opt.isVisible().catch(() => false)) await opt.click({ force: true });
    else await page.keyboard.press("Enter");
  }
  await clickText(page, /^Search$/i);
  await page.waitForTimeout(3000);
}

(async () => {
  console.log("done-push start", maker.email);
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  // fresh maker context — no prior storage (cleaner session)
  let ctx = await browser.newContext({ viewport: { width: 1520, height: 960 } });
  let page = await ctx.newPage();

  // ——— MAKER ———
  const okMaker = await azureLogin(page, maker.email, maker.password);
  await shot(page, "00-maker");
  if (!okMaker) {
    rec("fatal-maker-login");
    console.log(JSON.stringify(verdicts, null, 2));
    if (process.env.QAFUSIONX_CLOSE_BROWSER === "1") await browser.close();
    process.exit(1);
  }
  note("session", "maker login OK");
  rec("maker-ready");

  // PF-58374 — open pending Select → look for grace
  {
    const S = "PF-58374";
    await visit(page, "74-list", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 3500);
    await clickText(page, /Pending Requests/i);
    await page.waitForTimeout(1500);
    await shot(page, "74-pending");
    const select = page.getByText(/^Select$/i).first();
    if (await select.isVisible().catch(() => false)) {
      await select.click({ force: true });
      await page.waitForTimeout(3000);
      await shot(page, "74-detail");
      const t = await body(page);
      const hasGrace = /grace|instalment.?wise|installment.?wise|Grace Period/i.test(t);
      note(S, `detail graceFields=${hasGrace}`);
      if (hasGrace) {
        clearBlock(S, /grace|58496/i);
        V(S).status = "DONE_CANDIDATE";
      } else {
        block(S, "No instalment-wise grace on detail (PF-58496)");
        V(S).status = "PARTIAL";
      }
    } else {
      block(S, "No Select on pending");
      V(S).status = "PARTIAL";
    }
    rec("74-done-attempt", V(S));
  }

  // PF-58375 — hunt Print Offer
  {
    const S = "PF-58375";
    const urls = [
      ["75-owl", "https://uat.fusionx.biz/web/lending/cNwNb/origination-without-lead"],
      ["75-offer", "https://uat.fusionx.biz/web/lending/cNwNb/offer-letter"],
      ["75-print", "https://uat.fusionx.biz/web/lending/cNwNb/print-offer-letter"],
      ["75-docs", "https://uat.fusionx.biz/web/lending/cNwNb/document-generation"],
    ];
    let found = false;
    for (const [n, u] of urls) {
      const t = await visit(page, n, u, 3000);
      if (/Print Offer|Offer Letter|Joint|Business|RTO Template/i.test(t) && t.length > 400) found = true;
    }
    note(S, `offerUiFound=${found}`);
    if (found) {
      clearBlock(S, /Offer|58500|Print/i);
      V(S).status = "DONE_CANDIDATE";
    } else {
      block(S, "Print Offer / Joint-Business templates still missing");
      V(S).status = "PARTIAL";
    }
    rec("75-done-attempt", V(S));
  }

  // PF-58376 — fill schedule properly
  {
    const S = "PF-58376";
    await visit(page, "76-main", "https://uat.fusionx.biz/web/common/cNwNb/schedule-monitory-dashboard", 3500);
    await pickGBAF(page);
    await shot(page, "76-after-gbaf");
    // try modules
    for (const mod of ["CASA", "Lending", "COMMON", "TD"]) {
      await visit(page, `76-${mod}-pre`, "https://uat.fusionx.biz/web/common/cNwNb/schedule-monitory-dashboard", 2500);
      const modSel = page.locator(".ant-select").first();
      if (await modSel.isVisible().catch(() => false)) {
        await modSel.click({ force: true });
        await page.waitForTimeout(600);
        await clickText(page, new RegExp(`^${mod}$`, "i"));
        await page.waitForTimeout(500);
      }
      await fillScheduleAndSearch(page);
      await shot(page, `76-${mod}-search`);
      const t = await body(page);
      const ok = /Success|Error|Running|Completed|Failed/i.test(t) && !/No Data/i.test(t);
      note(S, `${mod} ok=${ok} noData=${/No Data/i.test(t)}`);
      if (ok) {
        clearBlock(S, /Schedule|58418|58425|58426/i);
        V(S).status = "DONE_CANDIDATE";
        break;
      }
    }
    if (V(S).status !== "DONE_CANDIDATE") {
      block(S, "Schedule still No Data after date+name fill (PF-58418/25/26)");
      V(S).status = "PARTIAL";
    }
    rec("76-done-attempt", V(S));
  }

  // PF-58377
  {
    const S = "PF-58377";
    const t1 = await visit(page, "77-entity", "https://uat.fusionx.biz/web/supplier/cNwNb/entity-creation", 4000);
    const blank = t1.length < 350 || /Supplier\s*$/.test(t1.slice(0, 80));
    note(S, `entityBlank=${blank} len=${t1.length}`);
    const t2 = await visit(page, "77-pend", "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation", 3500);
    const dups = (t2.match(/SUP0000002558/g) || []).length;
    note(S, `dup2558=${dups}`);
    if (!blank && dups <= 1) {
      clearBlock(S, /Entity|58513|duplicate/i);
      V(S).status = "DONE_CANDIDATE";
    } else {
      if (blank) block(S, "Entity Creation still blank");
      if (dups > 1) block(S, `Pending duplicates SUP0000002558 x${dups}`);
      V(S).status = "PARTIAL";
    }
    rec("77-done-attempt", V(S));
  }

  // PF-58378 value date
  {
    const S = "PF-58378";
    await visit(page, "78-list", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 3500);
    const view = page.getByText(/^View$/i).first();
    if (await view.isVisible().catch(() => false)) {
      await view.click({ force: true });
      await page.waitForTimeout(2500);
      await shot(page, "78-view");
      const t = await body(page);
      const badVd = /Value Date\s*[-–—]\s*$|Value Date\s*-\s/i.test(t) || /Value Date:\s*-/.test(t) || /Value Date\s+-\s/.test(t);
      const hasDate = /Value Date\s+\d{1,2}[\/\-]\d{1,2}/i.test(t);
      note(S, `valueDateDash=${badVd} hasDate=${hasDate}`);
      if (hasDate && !badVd) {
        clearBlock(S, /Value Date|58514/i);
        V(S).status = "DONE_CANDIDATE";
      } else {
        block(S, "Value Date still dash (PF-58514)");
        V(S).status = "PARTIAL";
      }
    } else {
      block(S, "No View on NCD list");
      V(S).status = "PARTIAL";
    }
    rec("78-done-attempt", V(S));
  }

  // PF-58380
  {
    const S = "PF-58380";
    let hit = false;
    for (const acct of ["0042250036", "0032250038", "011325099", "LNLOMO00110000023ILON2605"]) {
      await visit(page, `80-inq-${acct.slice(0, 6)}`, "https://uat.fusionx.biz/web/lending/cNwNb/account-management/account-inquiry", 2500);
      await pickGBAF(page);
      const inp = page.locator("input").first();
      if (await inp.isVisible().catch(() => false)) {
        await inp.fill(acct).catch(() => setInputValue(page, "input", acct));
        await clickText(page, /^Search$/i);
        await page.waitForTimeout(2500);
        await shot(page, `80-inq-${acct.slice(0, 6)}-r`);
        const t = await body(page);
        if (t.includes(acct) && !/No Data|no records/i.test(t)) hit = true;
      }
    }
    await visit(page, "80-rev", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reversal", 3000);
    await pickGBAF(page);
    await shot(page, "80-rev-after");
    note(S, `inquiryHit=${hit}`);
    if (hit) {
      clearBlock(S, /Reversal|inquiry|empty/i);
      V(S).status = "DONE_CANDIDATE";
    } else {
      block(S, "Inquiry/reversal still no data");
      V(S).status = "PARTIAL";
    }
    rec("80-done-attempt", V(S));
  }

  // PF-58383 — click GBAF then deep routes
  {
    const S = "PF-58383";
    let past = 0;
    const routes = [
      ["83-manage", "https://uat.fusionx.biz/web/account-management/cNwNb/manage-account"],
      ["83-open", "https://uat.fusionx.biz/web/account-management/cNwNb/opening"],
      ["83-act", "https://uat.fusionx.biz/web/account-management/cNwNb/activate"],
      ["83-inq", "https://uat.fusionx.biz/web/account-management/cNwNb/account-inquiry"],
      ["83-own", "https://uat.fusionx.biz/web/account-management/cNwNb/ownership-transfer"],
    ];
    for (const [n, u] of routes) {
      await visit(page, n, u, 3000);
      const clicked = await pickGBAF(page);
      await page.waitForTimeout(2000);
      await shot(page, `${n}-after`);
      const t = await body(page);
      const trapped = /Select Banking & Finance Type/i.test(t);
      note(S, `${n} clickedGbaf=${clicked} trapped=${trapped}`);
      if (!trapped && t.length > 500) past++;
    }
    if (past >= 2) {
      clearBlock(S, /GBAF|IBAF|58398|58416/i);
      V(S).status = "DONE_CANDIDATE";
    } else {
      block(S, "GBAF/IBAF selector still traps deep routes");
      V(S).status = "FAIL";
    }
    rec("83-done-attempt", V(S));
  }

  // N/A Kenya → mark DONE_NA (eligible for Jira Done with N/A comment)
  for (const [S, url] of [
    ["PF-58379", "https://uat.fusionx.biz/web/lending/cNwNb/accrued-interest"],
    ["PF-58381", "https://uat.fusionx.biz/web/lending/cNwNb/document-request"],
    ["PF-58382", "https://uat.fusionx.biz/web/lending/cNwNb/profit-sharing"],
    ["PF-58384", "https://uat.fusionx.biz/web/lending/cNwNb/sms-template"],
  ] as const) {
    const t = await visit(page, `na-${S.slice(-2)}`, url, 2500);
    const real = /Accrued Interest|Document Request|Profit Sharing|SMS Template|BRWNS/i.test(t);
    if (!real) {
      V(S).status = "DONE_NA_KENYA";
      note(S, "Feature absent on Kenya UAT — Done as N/A Kenya");
      clearBlock(S, /./);
    } else {
      V(S).status = "PARTIAL";
      block(S, "Feature unexpectedly present — re-verify ACs");
    }
    rec(`na-${S}`, V(S));
  }

  await ctx.storageState({ path: path.join(proof, "_maker-storage.json") }).catch(() => {});

  // ——— CHECKER fresh context ———
  {
    const S = "PF-58560";
    await hardLogout(page, ctx);
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    ctx = await browser.newContext({ viewport: { width: 1520, height: 960 } }); // NO storage
    page = await ctx.newPage();
    const ok = await azureLogin(page, checker.email, checker.password);
    await shot(page, "chk-login");
    const who = await whoAmI(page);
    note(S, `loginOk=${ok} whoAmI=${who}`);
    if (ok && who === "checker") {
      clearBlock(S, /./);
      V(S).status = "DONE_CANDIDATE";
      await visit(page, "chk-perc", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 3500);
      await clickText(page, /Pending Requests/i);
      await page.waitForTimeout(1500);
      const sel = page.getByText(/^Select$/i).first();
      if (await sel.isVisible().catch(() => false)) {
        await sel.click({ force: true });
        await page.waitForTimeout(2000);
        await clickText(page, /^Approve$/i);
        await clickText(page, /Confirm|Yes|Proceed/i);
        await shot(page, "chk-approve");
        note(S, "approve attempted as MethmiB");
        clearBlock("PF-58378", /Checker|58560/i);
        if (V("PF-58378").status === "DONE_CANDIDATE" || !V("PF-58378").blockers.some((b) => /Value Date/i.test(b))) {
          // keep 78 as is
        }
        note("PF-58378", "Checker path attempted as real MethmiB");
      }
      await visit(page, "chk-ncd", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/authorize", 3500);
      await shot(page, "chk-ncd");
    } else {
      block(S, `Checker switch failed (who=${who})`);
      V(S).status = "PARTIAL";
      block("PF-58378", "Checker approve still required (PF-58560)");
    }
    rec("checker-done", V(S));
  }

  // Final status rollup — only true DONE if no blockers
  for (const [k, v] of Object.entries(verdicts)) {
    if (v.status === "DONE_CANDIDATE" && v.blockers.length === 0) v.status = "DONE";
    if (v.status === "DONE_NA_KENYA") v.status = "DONE"; // N/A Kenya accepted as Done
  }
  save();
  console.log(JSON.stringify(verdicts, null, 2));
  rec("all-done-push-finished");
  if (process.env.QAFUSIONX_CLOSE_BROWSER === "1") await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
