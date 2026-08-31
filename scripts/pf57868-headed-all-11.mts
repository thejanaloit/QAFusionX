import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const makerEmail = process.env.QAFUSIONX_EMAIL!;
const makerPassword = process.env.QAFUSIONX_PASSWORD!;
const checkerEmail = process.env.CHECKER_EMAIL || "MethmiB@lolctech.com";
const checkerPassword = process.env.CHECKER_PASSWORD!;
const proof = "C:/Users/ThejanaD/QAFusionX/proof-full-all-11-r2-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/full-all-11-r2-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });
const storage = path.join(proof, "_storage.json");
const log: any[] = [];
const api: any[] = [];
const issues: any[] = [];
const RTO_CONTRACT = "LNLOAN00110000745RTO12608";
const ACCOUNTS = ["0042250036", "0032250038", RTO_CONTRACT];

async function body(page: any) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function shot(page: any, n: string) {
  const p = path.join(proof, n.endsWith(".png") ? n : n + ".png");
  await page.screenshot({ path: p, fullPage: true }).catch(() => page.screenshot({ path: p }));
  try { fs.copyFileSync(p, path.join(mirror, path.basename(p))); } catch {}
  return p;
}
function rec(step: string, extra: any = {}) {
  log.push({ step, at: new Date().toISOString(), ...extra });
  fs.writeFileSync(path.join(proof, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(mirror, "_exec.json"), JSON.stringify(log, null, 2));
}
function flag(story: string, concern: string, shot?: string, extra: any = {}) {
  issues.push({ story, concern, shot, ...extra, at: new Date().toISOString() });
  fs.writeFileSync(path.join(proof, "_issues.json"), JSON.stringify(issues, null, 2));
  fs.writeFileSync(path.join(mirror, "_issues.json"), JSON.stringify(issues, null, 2));
}

async function azureLogin(page: any, email: string, password: string) {
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
  for (let i = 0; i < 100; i++) {
    const t = await body(page);
    const url = page.url();
    if (/personalization is in progress/i.test(t)) { await page.waitForTimeout(1200); continue; }
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click();
      await page.waitForTimeout(1800);
      continue;
    }
    if (/microsoftonline|login\.microsoft/i.test(url) || /Enter password/i.test(t)) {
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
      if (await page.getByRole("button", { name: /^Yes$/i }).count()) {
        await page.getByRole("button", { name: /^Yes$/i }).first().click();
        await page.waitForTimeout(3000);
        continue;
      }
      if (await page.getByRole("button", { name: /^No$/i }).count()) {
        await page.getByRole("button", { name: /^No$/i }).first().click();
        await page.waitForTimeout(2000);
        continue;
      }
    }
    if (/Core Banking Modules|Duruma|Ask FxMind|FusionX/i.test(t) && !/personalization is in progress|no healthy upstream/i.test(t)) return true;
    if (/no healthy upstream/i.test(t)) {
      await page.waitForTimeout(5000);
      await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded" }).catch(() => {});
      continue;
    }
    await page.waitForTimeout(900);
  }
  return false;
}

async function logout(page: any) {
  const avatar = page.locator(".ant-avatar, [class*='avatar'], img[alt*='profile' i]").first();
  if (await avatar.isVisible().catch(() => false)) {
    await avatar.click({ force: true });
    await page.waitForTimeout(1200);
  }
  const signOut = page.getByText(/Sign out|Log out|Logout/i).first();
  if (await signOut.isVisible().catch(() => false)) {
    await signOut.click();
    await page.waitForTimeout(2500);
    return;
  }
  await page.context().clearCookies();
  await page.goto("https://login.microsoftonline.com/common/oauth2/v2.0/logout", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function waitReady(page: any, ms = 40000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = await body(page);
    if (!/LOADING|Authenticating|personalization is in progress|Initializing|Verifying account/i.test(t) && t.length > 80) return t;
    await page.waitForTimeout(900);
  }
  return await body(page);
}

async function visit(page: any, name: string, url: string, waitMs = 5000) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitReady(page, 32000);
  await page.waitForTimeout(waitMs);
  const t = await body(page);
  const s = await shot(page, name);
  rec(name, { url: page.url(), shot: s, text: t.slice(0, 1700), rows: await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0) });
  if (/Insufficient Privileges|403 Forbidden|401 Unauthorized|Something went wrong/i.test(t)) {
    flag(name.split("-")[0] || "GEN", `Screen shows privilege/error: ${name}`, s, { url: page.url() });
  }
  return t;
}

async function clickTableAction(page: any, label: string) {
  const before = page.url();
  const ok = await page.evaluate((lab: string) => {
    const rows = [...document.querySelectorAll("tr.ant-table-row")].filter((r) => !r.classList.contains("ant-table-measure-row"));
    for (const row of rows) {
      const el = [...row.querySelectorAll("a,button,span")].find((e) => ((e as HTMLElement).innerText || "").trim() === lab) as HTMLElement | undefined;
      if (el?.offsetParent) { el.click(); return true; }
    }
    const any = [...document.querySelectorAll("a,button,span")].find((e) => {
      const t = ((e as HTMLElement).innerText || "").trim();
      return t === lab && (e as HTMLElement).offsetParent && !(e as HTMLElement).closest(".ant-layout-sider");
    }) as HTMLElement | undefined;
    if (any) { any.click(); return true; }
    return false;
  }, label);
  await page.waitForTimeout(4500);
  return { ok, url: page.url(), changed: page.url() !== before, text: (await body(page)).slice(0, 1600) };
}

async function clickText(page: any, re: RegExp) {
  const before = page.url();
  const loc = page.getByRole("button", { name: re }).first();
  try {
    if (await loc.count() && await loc.isVisible() && !(await loc.isDisabled().catch(() => true))) {
      await loc.click({ timeout: 8000 });
    } else {
      const t = page.getByText(re).first();
      if (await t.count() && await t.isVisible().catch(() => false)) await t.click({ force: true, timeout: 8000 });
      else return { ok: false, url: page.url() };
    }
  } catch (e: any) {
    return { ok: false, error: String(e).slice(0, 120), url: page.url() };
  }
  await page.waitForTimeout(4000);
  return { ok: true, url: page.url(), changed: page.url() !== before, text: (await body(page)).slice(0, 1400) };
}

async function pickSelects(page: any, howMany = 8) {
  const picked: string[] = [];
  const n = await page.locator(".ant-layout-content .ant-select:not(.ant-select-disabled)").count().catch(() => 0);
  for (let i = 0; i < Math.min(howMany, n); i++) {
    try {
      const sel = page.locator(".ant-layout-content .ant-select:not(.ant-select-disabled)").nth(i);
      if (!(await sel.isVisible().catch(() => false))) continue;
      await sel.click({ timeout: 5000 });
      await page.waitForTimeout(800);
      const opt = page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").first();
      if (await opt.count()) {
        picked.push((await opt.innerText().catch(() => "")).slice(0, 80));
        await opt.click();
        await page.waitForTimeout(600);
      } else await page.keyboard.press("Escape");
    } catch { await page.keyboard.press("Escape").catch(() => {}); }
  }
  return picked;
}

async function fillSafe(page: any, value: string) {
  const loc = page.locator(".ant-layout-content input:visible:not([disabled]):not([type=checkbox]):not([type=radio])");
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const inp = loc.nth(i);
    const meta = [await inp.getAttribute("placeholder"), await inp.getAttribute("id"), await inp.getAttribute("class")].join(" ").toLowerCase();
    if (/search menu|datepicker|picker|combobox|ant-select-selection-search|ant-picker/i.test(meta)) continue;
    try {
      await inp.click({ timeout: 3000 });
      await inp.fill(value, { timeout: 4000 });
      return { ok: true, i };
    } catch { continue; }
  }
  return { ok: false, n };
}

async function clickMatchingMenus(page: any, re: RegExp, prefix: string, max = 12) {
  const items = page.locator(".ant-menu-item, .ant-menu-submenu-title");
  const n = await items.count();
  let hits = 0;
  for (let i = 0; i < n && hits < max; i++) {
    const label = ((await items.nth(i).innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    if (!label || /search menu/i.test(label) || !re.test(label)) continue;
    await items.nth(i).click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    rec(`${prefix}-${label.slice(0, 40)}`, { url: page.url(), shot: await shot(page, `${prefix}-${hits}`), text: (await body(page)).slice(0, 900) });
    hits++;
  }
  return hits;
}

async function clickGbafTd(page: any) {
  for (const re of [/GBAF/i, /General Banking/i, /GB/i]) {
    const el = page.getByText(re).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ force: true });
      await page.waitForTimeout(3500);
      rec("70-gbaf-click", { url: page.url(), shot: await shot(page, "70-gbaf"), text: (await body(page)).slice(0, 1200) });
      return true;
    }
  }
  return false;
}

async function runMaker(page: any) {
  rec("maker-start", { user: makerEmail, shot: await shot(page, "00-maker-home") });

  const roles = await page.evaluate(async () => {
    const r = await fetch("https://uat.fusionx.biz/comn-authnex/rolePermissionValidate/v1/cNwNb/user-details", { credentials: "include" });
    const json = await r.json().catch(() => ({} as any));
    return { status: r.status, roleCount: (json.roles || json.data?.roles || []).length };
  });
  rec("maker-roles", roles);
  if (roles.status === 401) flag("GEN", "rolePermissionValidate user-details returns 401 for maker", "00-maker-home.png");

  // PF-58374
  await visit(page, "58374-penal-list", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 7000);
  rec("58374-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58374-view") });
  const graceWords = [...new Set(((await body(page)).match(/grace|instalment|installment/gi) || []))];
  rec("58374-grace-check", { graceWords, text: (await body(page)).slice(0, 1600) });
  if (!graceWords.length) flag("PF-58374", "No grace/instalment fields on PERC view or list", "58374-view.png");

  await visit(page, "58374-penal-list2", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 4000);
  rec("58374-create", { ...(await clickText(page, /Create New Request/i)), shot: await shot(page, "58374-create") });
  rec("58374-picks", { picks: await pickSelects(page, 6) });
  rec("58374-search", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58374-search") });
  if (/Something went wrong|Please select/i.test(await body(page))) flag("PF-58374", "Create PERC search fails without sub product", "58374-search.png");

  await visit(page, "58374-penal-list3", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 4000);
  rec("58374-pending-tab", { ...(await clickText(page, /^Pending Requests$/i)), shot: await shot(page, "58374-pending") });
  rec("58374-pending-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "58374-pending-select") });

  await visit(page, "58374-template", "https://uat.fusionx.biz/web/lending/cNwNb/settings/penal-interest-template-setting", 5000);
  rec("58374-template-body", { text: (await body(page)).slice(0, 1600), grace: [...new Set(((await body(page)).match(/grace|instalment/gi) || []))] });

  // PF-58378 NCD maker
  await visit(page, "58378-ncd", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 7000);
  rec("58378-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58378-view") });
  rec("58378-alloc", { ...(await clickText(page, /View Allocation Details/i)), shot: await shot(page, "58378-alloc") });

  await visit(page, "58378-ncd2", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 4000);
  rec("58378-create", { ...(await clickText(page, /Create New/i)), shot: await shot(page, "58378-create") });
  rec("58378-picks", { picks: await pickSelects(page, 10) });
  await fillSafe(page, "QA" + Date.now().toString().slice(-8));
  await fillSafe(page, "LNLOAN00410000685ILON2608");
  rec("58378-add", { ...(await clickText(page, /Add to Batch/i)), shot: await shot(page, "58378-add") });
  rec("58378-save", { ...(await clickText(page, /^Save$/i)), shot: await shot(page, "58378-save") });
  const ncdSave = await body(page);
  if (/float|0\.00|Please Select|deposit type/i.test(ncdSave)) flag("PF-58378", "NCD create blocked: float/deposit type validation", "58378-save.png");

  await visit(page, "58378-pending", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 4000);
  rec("58378-pending-tab", { ...(await clickText(page, /Pending Requests/i)), shot: await shot(page, "58378-pending") });
  rec("58378-pending-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "58378-pending-select") });

  // PF-58377 Supplier
  await visit(page, "58377-sup", "https://uat.fusionx.biz/web/supplier/cNwNb/view-suppliers", 7000);
  rec("58377-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58377-view") });
  await visit(page, "58377-create-nav", "https://uat.fusionx.biz/web/supplier/cNwNb/view-suppliers", 4000);
  rec("58377-create", { ...(await clickText(page, /Create New/i)), shot: await shot(page, "58377-create") });
  rec("58377-individual", { ...(await clickText(page, /Add New Individual Supplier/i)), shot: await shot(page, "58377-individual") });
  rec("58377-picks", { picks: await pickSelects(page, 8) });
  rec("58377-save", { ...(await clickText(page, /Save|Submit|Confirm|Next/i)), shot: await shot(page, "58377-save") });

  await visit(page, "58377-pending", "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation", 5000);
  rec("58377-pend-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "58377-pend-select") });

  await visit(page, "58377-inq", "https://uat.fusionx.biz/web/supplier/cNwNb/supplier-inquiry", 4000);
  rec("58377-inq-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58377-inq-view") });

  // PF-58380 Receipts
  await visit(page, "58380-inq", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/inquiry?mode=account", 5000);
  await fillSafe(page, ACCOUNTS[0]);
  rec("58380-search", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58380-inq") });
  rec("58380-loan-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58380-loan-view") });
  rec("58380-menus", { hits: await clickMatchingMenus(page, /receipt|transaction|schedule|charge|penal|interest/i, "58380m", 8) });

  await visit(page, "58380-receipt", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/receipt-reversal", 5000);
  rec("58380-receipt-create", { ...(await clickText(page, /Create New/i)), shot: await shot(page, "58380-receipt-create") });
  await fillSafe(page, ACCOUNTS[0]);
  rec("58380-receipt-search", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58380-receipt-search") });
  rec("58380-receipt-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58380-receipt-view") });

  await visit(page, "58380-realloc", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reallocation/create", 5000);
  await fillSafe(page, ACCOUNTS[0]);
  rec("58380-realloc", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58380-realloc") });

  // PF-58375 RTO
  await visit(page, "58375-activation", "https://uat.fusionx.biz/web/lending/cNwNb/account-activation", 5000);
  rec("58375-menus", { hits: await clickMatchingMenus(page, /offer|activation|origination|rent|joint/i, "58375m", 10) });
  for (const [n, u] of [
    ["58375-docs", "https://uat.fusionx.biz/web/lending/cNwNb/settings/loan-documents-setting"],
    ["58375-offer", "https://uat.fusionx.biz/web/lending/cNwNb/origination/offer-letter"],
    ["58375-orig", "https://uat.fusionx.biz/web/lending/cNwNb/origination"],
  ] as const) await visit(page, n, u, 3500);

  await visit(page, "58375-rto-inq", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/inquiry?mode=account", 4000);
  await fillSafe(page, RTO_CONTRACT);
  rec("58375-rto-search", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58375-rto-search") });
  rec("58375-rto-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58375-rto-view") });
  const rtoText = await body(page);
  if (!/ROPI|Rent to Own|Joint|Business|Offer Letter/i.test(rtoText)) flag("PF-58375", "RTO contract view lacks Joint/Business offer letter indicators", "58375-rto-view.png");

  // PF-58379 Accrued
  await visit(page, "58379-lending", "https://uat.fusionx.biz/web/lending/cNwNb/", 4000);
  rec("58379-menus", { hits: await clickMatchingMenus(page, /accrued|interest|charge|provision/i, "58379m", 10) });
  for (const [n, u] of [
    ["58379-acc1", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/accrued-interest"],
    ["58379-acc2", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/accrued-interest"],
  ] as const) {
    const t = await visit(page, n, u, 3000);
    if (/404|not found|Insufficient/i.test(t)) flag("PF-58379", `Accrued interest route missing on Kenya: ${u}`, `${n}.png`);
  }

  // PF-58381 COB
  await visit(page, "58381-cob", "https://uat.fusionx.biz/web/cob/cNwNb/", 5000);
  rec("58381-menus", { hits: await clickMatchingMenus(page, /document|request|onboard|pending/i, "58381m", 10) });
  for (const [n, u] of [
    ["58381-doc", "https://uat.fusionx.biz/web/cob/cNwNb/document-request"],
    ["58381-pend", "https://uat.fusionx.biz/web/cob/cNwNb/pending-approvals"],
  ] as const) {
    const t = await visit(page, n, u, 3000);
    if (t.length < 120 || /404|not found/i.test(t)) flag("PF-58381", `Document Request not on Kenya COB: ${u}`, `${n}.png`);
  }

  // PF-58382 CASA Islamic
  await visit(page, "58382-casa", "https://uat.fusionx.biz/web/casa/cNwNb/", 5000);
  rec("58382-menus", { hits: await clickMatchingMenus(page, /islamic|profit|sharing|mudarab/i, "58382m", 10) });
  for (const [n, u] of [
    ["58382-profit", "https://uat.fusionx.biz/web/casa/cNwNb/profit-sharing"],
    ["58382-islamic", "https://uat.fusionx.biz/web/casa/cNwNb/islamic"],
  ] as const) await visit(page, n, u, 3000);

  // PF-58376 Schedule
  await visit(page, "58376-schedule", "https://uat.fusionx.biz/web/comn-settings/cNwNb/schedule-monitory-dashboard", 6000);
  rec("58376-picks", { picks: await pickSelects(page, 6) });
  rec("58376-search", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58376-search") });
  rec("58376-search2", { ...(await clickText(page, /^Search$/i)), shot: await shot(page, "58376-search2") });
  const ciap401 = api.filter((x) => /credit-interest-apply-log/.test(x.url) && x.status === 401);
  if (ciap401.length) flag("PF-58376", "CIAP schedule API returns 401", "58376-search.png", { api: ciap401 });

  // PF-58384 SMS
  await visit(page, "58384-settings", "https://uat.fusionx.biz/web/comn-settings/cNwNb/", 5000);
  rec("58384-menus", { hits: await clickMatchingMenus(page, /sms|alert|brwns|notification/i, "58384m", 12) });
  for (const [n, u] of [
    ["58384-sms", "https://uat.fusionx.biz/web/comn-settings/cNwNb/sms"],
    ["58384-alert", "https://uat.fusionx.biz/web/comn-settings/cNwNb/alert"],
  ] as const) await visit(page, n, u, 3000);

  // PF-58383 TD
  await visit(page, "58383-td-home", "https://uat.fusionx.biz/web/td/cNwNb/", 5000);
  await clickGbafTd(page);
  rec("58383-td-menus", { hits: await clickMatchingMenus(page, /owner|transfer|inquiry|account|history|manage/i, "58383m", 12) });
  for (const [n, u] of [
    ["58383-own", "https://uat.fusionx.biz/web/td/cNwNb/ownership-transfer"],
    ["58383-hist", "https://uat.fusionx.biz/web/td/cNwNb/owner-transfer-history"],
    ["58383-inq", "https://uat.fusionx.biz/web/td/cNwNb/account-inquiry"],
    ["58383-mgmt", "https://uat.fusionx.biz/web/td/cNwNb/accounts/manage-account"],
  ] as const) await visit(page, n, u, 4000);
  rec("58383-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "58383-select") });
  rec("58383-view", { ...(await clickTableAction(page, "View")), shot: await shot(page, "58383-view") });
  const tdText = await body(page);
  if (/GBAF|IBAF|Select Account Type/i.test(tdText) && !/Ownership Transfer History|Transfer History/i.test(tdText)) {
    flag("PF-58383", "TD stuck on GBAF/IBAF selector — ownership history not reachable", "58383-td-home.png");
  }

  rec("maker-done", { ok: true });
}

async function runChecker(page: any) {
  rec("checker-login-start", { user: checkerEmail });
  await logout(page);
  const ok = await azureLogin(page, checkerEmail, checkerPassword);
  if (!ok) {
    flag("GEN", "Checker MethmiB login failed on Kenya UAT", "checker-login-fail.png");
    rec("checker-login-fail", { shot: await shot(page, "checker-login-fail") });
    return;
  }
  rec("checker-home", { shot: await shot(page, "checker-home"), text: (await body(page)).slice(0, 800) });

  const roles = await page.evaluate(async () => {
    const r = await fetch("https://uat.fusionx.biz/comn-authnex/rolePermissionValidate/v1/cNwNb/user-details", { credentials: "include" });
    const json = await r.json().catch(() => ({} as any));
    return { status: r.status, roleCount: (json.roles || json.data?.roles || []).length };
  });
  rec("checker-roles", roles);

  // PERC approve
  await visit(page, "chk-58374-penal", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 6000);
  rec("chk-58374-pending", { ...(await clickText(page, /^Pending Requests$/i)), shot: await shot(page, "chk-58374-pending") });
  rec("chk-58374-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "chk-58374-select") });
  rec("chk-58374-approve", { ...(await clickText(page, /^Approve$/i)), shot: await shot(page, "chk-58374-approve") });
  rec("chk-58374-confirm", { ...(await clickText(page, /Confirm and Proceed|Confirm|Yes/i)), shot: await shot(page, "chk-58374-confirm") });

  // NCD authorize
  await visit(page, "chk-58378-auth", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/authorize", 6000);
  rec("chk-58378-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "chk-58378-select") });
  rec("chk-58378-approve", { ...(await clickText(page, /^Approve$/i)), shot: await shot(page, "chk-58378-approve") });
  rec("chk-58378-confirm", { ...(await clickText(page, /Confirm|Yes|Proceed/i)), shot: await shot(page, "chk-58378-confirm") });

  // Supplier pending confirm
  await visit(page, "chk-58377-pend", "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation", 5000);
  rec("chk-58377-select", { ...(await clickTableAction(page, "Select")), shot: await shot(page, "chk-58377-select") });
  rec("chk-58377-confirm", { ...(await clickText(page, /Confirm|Approve|Authorize/i)), shot: await shot(page, "chk-58377-confirm") });

  rec("checker-done", { ok: true });
}

const storagePrev = [
  path.join(proof, "_storage.json"),
  "C:/Users/ThejanaD/QAFusionX/proof-aggressive-aug31/_storage.json",
  "C:/Users/ThejanaD/QAFusionX/proof-cto-perm-check/_storage.json",
  "C:/Users/ThejanaD/QAFusionX/proof-full-rerun/_storage.json",
].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({
    viewport: { width: 1520, height: 960 },
    ...(storagePrev ? { storageState: storagePrev } : {}),
  });
  const page = await ctx.newPage();
  page.on("response", (res) => {
    const u = res.url();
    if (/lending-account|comn-supplies|interest-rate|receipt|non-counter|penal|td-|casa-|schedule|401|403|accrued|offer|payee/i.test(u) && api.length < 500) {
      api.push({ status: res.status(), method: res.request().method(), url: u.slice(0, 380) });
    }
  });
  try {
    await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3000);
    let t = await body(page);
    const alreadyIn = /Core Banking Modules|Duruma|Ask FxMind/i.test(t) && !/Continue with AzureAd|Enter password/i.test(t);
    if (!alreadyIn && !(await azureLogin(page, makerEmail, makerPassword))) throw new Error("maker-login-failed");
    await runMaker(page);
    if (checkerPassword) await runChecker(page);
    else rec("checker-skipped", { reason: "no CHECKER_PASSWORD" });

    rec("api-summary", {
      count: api.length,
      bad401: api.filter((x) => x.status === 401).slice(0, 30),
      bad403: api.filter((x) => x.status === 403).slice(0, 20),
      bad404: api.filter((x) => x.status === 404).slice(0, 20),
      bad500: api.filter((x) => x.status >= 500).slice(0, 20),
    });
    await ctx.storageState({ path: storage });
    rec("all-done", { issueCount: issues.length, ok: true });
    const closeAtEnd = (process.env.QAFUSIONX_CLOSE_BROWSER ?? "0").trim() === "1";
    if (!closeAtEnd) {
      rec("browser-kept-open", { rule: "unbreakable-one-browser-session" });
      console.log(
        "LOCKED: same browser kept open (unbreakable session). Set QAFUSIONX_CLOSE_BROWSER=1 only for end-of-flow close.",
      );
      // Keep Node alive so Playwright does not tear down Chromium on process exit
      await new Promise((r) => setTimeout(r, 3_600_000));
    }
  } catch (e: any) {
    rec("fatal", { error: String(e).slice(0, 500), shot: await shot(page, "fatal") });
    flag("GEN", `Fatal QA error: ${String(e).slice(0, 200)}`, "fatal.png");
  } finally {
    if ((process.env.QAFUSIONX_CLOSE_BROWSER ?? "0").trim() === "1") {
      await browser.close();
    }
  }
})();
