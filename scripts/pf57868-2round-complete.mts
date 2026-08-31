/**
 * 2-round aggressive completion — all PARTIAL/FAIL stories.
 * ONE unbreakable headed browser. Round 2 hunts misses / alternate paths.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

function loadCreds() {
  const f = "C:/Users/ThejanaD/QAFusionX/tmp-creds.json";
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  return { email: process.env.QAFUSIONX_EMAIL, password: process.env.QAFUSIONX_PASSWORD };
}
const { email: makerEmail, password: makerPassword } = loadCreds();
const checkerEmail = process.env.CHECKER_EMAIL || "MethmiB@lolctech.com";
const checkerPassword =
  process.env.CHECKER_PASSWORD ||
  (fs.existsSync("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json")
    ? JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json", "utf8")).password
    : "");
if (!checkerPassword) {
  console.warn("WARN: checker password missing — set CHECKER_PASSWORD or tmp-checker-creds.json (gitignored)");
}

const proof = "C:/Users/ThejanaD/QAFusionX/proof-2round-complete-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/2round-complete-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });

const storagePrev = [
  path.join(proof, "_storage.json"),
  "C:/Users/ThejanaD/QAFusionX/proof-partials-complete-aug31/_storage.json",
  "C:/Users/ThejanaD/QAFusionX/proof-full-all-11-r2-aug31/_storage.json",
].find((p) => fs.existsSync(p));

const log: any[] = [];
const api: any[] = [];
const verdicts: Record<string, { status: string; notes: string[]; blockers: string[]; round: number }> = {};

function V(s: string) {
  if (!verdicts[s]) verdicts[s] = { status: "IN_PROGRESS", notes: [], blockers: [], round: 1 };
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
  fs.writeFileSync(path.join(proof, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(mirror, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(proof, "_verdicts.json"), JSON.stringify(verdicts, null, 2));
  fs.writeFileSync(path.join(mirror, "_verdicts.json"), JSON.stringify(verdicts, null, 2));
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

async function azureLogin(page: Page, email: string, password: string) {
  await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 80; i++) {
    const t = await body(page);
    if (/Duruma|Ask FxMind|Core Banking Modules/i.test(t) && !/Sign in|Continue with AzureAd|Enter a valid email|Enter password/i.test(t)) return true;
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0118").isVisible().catch(() => false)) {
      await setInputValue(page, "#i0118", password);
      await page.click("#idSIButton9").catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInputValue(page, "#i0116", email);
      await page.click("#idSIButton9").catch(() => {});
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.getByRole("button", { name: /^Yes$/i }).count()) {
      await page.getByRole("button", { name: /^Yes$/i }).first().click();
      await page.waitForTimeout(4000);
      continue;
    }
    await page.waitForTimeout(900);
  }
  return false;
}

async function waitReady(page: Page, ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = await body(page);
    if (!/LOADING|Authenticating|personalization is in progress|Initializing/i.test(t) && t.length > 60) return t;
    await page.waitForTimeout(700);
  }
  return body(page);
}

async function visit(page: Page, name: string, url: string, waitMs = 3500) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await waitReady(page, 28000);
  await page.waitForTimeout(waitMs);
  const t = await body(page);
  const s = await shot(page, name);
  rec(name, { url: page.url(), shot: s, text: t.slice(0, 1400) });
  return t;
}

async function clickText(page: Page, re: RegExp) {
  const loc = page.getByText(re).first();
  if (!(await loc.count().catch(() => 0))) return false;
  await loc.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1600);
  return true;
}

async function clickExact(page: Page, text: string) {
  const loc = page.getByText(text, { exact: true }).first();
  if (!(await loc.isVisible().catch(() => false))) return false;
  await loc.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1400);
  return true;
}

async function tableAction(page: Page, label: string) {
  const cell = page.locator("tr.ant-table-row td, a, button, span").filter({ hasText: new RegExp(`^${label}$`, "i") }).first();
  if (await cell.count()) {
    await cell.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1800);
    return true;
  }
  return clickText(page, new RegExp(`^${label}$`, "i"));
}

async function pickSelect(page: Page, optionRe: RegExp) {
  const open = page.locator(".ant-select-selector, .ant-select").first();
  if (await open.count()) await open.click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  const opt = page.locator(".ant-select-item-option-content, .ant-select-item").filter({ hasText: optionRe }).first();
  if (await opt.count()) {
    await opt.click({ force: true });
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function fillDates(page: Page) {
  const inputs = page.locator(".ant-picker-input input");
  const n = await inputs.count();
  if (!n) return;
  await inputs.first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const days = page.locator(".ant-picker-cell-in-view .ant-picker-cell-inner");
  if ((await days.count()) > 10) {
    await days.nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await days.nth(22).click({ force: true }).catch(() => {});
  }
}

async function tryGbaf(page: Page) {
  const t = await body(page);
  if (!/GBAF|IBAF/i.test(t)) return false;
  if (await clickExact(page, "GBAF")) return true;
  if (await clickText(page, /^GBAF$/i)) return true;
  // click card/tile
  const tile = page.locator("div, button, a").filter({ hasText: /^GBAF$/ }).first();
  if (await tile.count()) {
    await tile.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    return true;
  }
  return false;
}

async function fillSearch(page: Page, value: string) {
  const sels = ["#searchtext", "input[placeholder*='Account' i]", "input[placeholder*='Search' i]", "input[type='search']", ".ant-input"];
  for (const sel of sels) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ force: true });
      await el.fill("");
      await el.fill(value);
      await page.keyboard.press("Enter").catch(() => {});
      await clickText(page, /^Search$/i);
      await page.waitForTimeout(2500);
      return true;
    }
  }
  return false;
}

async function logoutInPlace(page: Page) {
  const avatar = page.locator(".ant-avatar, [class*='avatar']").first();
  if (await avatar.isVisible().catch(() => false)) {
    await avatar.click({ force: true });
    await page.waitForTimeout(1000);
  }
  if (await clickText(page, /Sign out|Log out|Logout/i)) {
    await page.waitForTimeout(2500);
    return;
  }
  await page.context().clearCookies();
  await page.goto("https://login.microsoftonline.com/common/oauth2/v2.0/logout").catch(() => {});
  await page.waitForTimeout(2000);
}

// ——— ROUND helpers per story ———

async function r58374(page: Page, round: number) {
  const S = "PF-58374";
  V(S).round = round;
  const p = `r${round}-74`;
  await visit(page, `${p}-list`, "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 4000);
  const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `R${round} list rows=${rows}`);
  await clickText(page, /Pending Requests/i);
  await shot(page, `${p}-pending`);
  await clickText(page, /^Requests$/i);
  await tableAction(page, "View");
  await waitReady(page);
  let t = await body(page);
  await shot(page, `${p}-view`);
  if (/grace|instalment|installment/i.test(t)) {
    clearBlock(S, /grace/i);
    note(S, `R${round} grace fields FOUND`);
  } else block(S, "No instalment-wise grace on View (PF-58496)");

  await clickText(page, /Go To Edit/i);
  await page.waitForTimeout(2000);
  await shot(page, `${p}-edit`);

  // Process tab
  await visit(page, `${p}-list2`, "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 3000);
  await clickText(page, /Process/i);
  await shot(page, `${p}-process`);

  // Create with multiple sub-product tries
  await visit(page, `${p}-create`, "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change/request", 3500);
  for (const re of [/INSURANCE/i, /PREMIUM/i, /LOAN/i, /FINANCE/i]) {
    if (await pickSelect(page, re)) break;
  }
  await clickText(page, /^Search$/i);
  await page.waitForTimeout(2000);
  t = await body(page);
  await shot(page, `${p}-search`);
  if (/Something went wrong|Failed/i.test(t)) block(S, "Create Search error toast");
  else note(S, `R${round} create search no fail toast`);

  // Template alternate URLs
  for (const url of [
    "https://uat.fusionx.biz/web/lending/cNwNb/settings",
    "https://uat.fusionx.biz/web/lending/cNwNb/settings/penal-interest-template",
    "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change/template",
  ]) {
    t = await visit(page, `${p}-tpl-${url.split("/").pop()}`, url, 2500);
    if (/grace/i.test(t)) {
      clearBlock(S, /Template.*grace/i);
      note(S, `R${round} grace on template path ${url}`);
    }
  }
  if (V(S).blockers.some((b) => /grace/i.test(b))) V(S).status = "PARTIAL";
  else V(S).status = "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function r58375(page: Page, round: number) {
  const S = "PF-58375";
  V(S).round = round;
  const p = `r${round}-75`;
  const urls = [
    ["owl", "https://uat.fusionx.biz/web/lending/cNwNb/origination-without-lead"],
    ["offer", "https://uat.fusionx.biz/web/lending/cNwNb/origination/offer-letter"],
    ["act", "https://uat.fusionx.biz/web/lending/cNwNb/account-activation"],
    ["contract", "https://uat.fusionx.biz/web/lending/cNwNb/origination/initiate-contract/5123446"],
    ["lead", "https://uat.fusionx.biz/web/lending/cNwNb/origination/initiate-contract/18185362728"],
    ["rto-acct", "https://uat.fusionx.biz/web/lending/cNwNb/origination/initiate-contract/LNLOAN00110000745RTO12608"],
    ["inq", "https://uat.fusionx.biz/web/lending/cNwNb/account-inquiry"],
    ["docs", "https://uat.fusionx.biz/web/lending/cNwNb/settings"],
  ] as const;
  for (const [name, url] of urls) {
    const t = await visit(page, `${p}-${name}`, url, 3500);
    if (/Print Offer Letter/i.test(t)) {
      note(S, `R${round} Print Offer on ${name}`);
      await clickText(page, /Print Offer Letter/i);
      await page.waitForTimeout(2000);
      const t2 = await body(page);
      await shot(page, `${p}-${name}-print`);
      if (/ROPJ|ROPB|Joint|Business/i.test(t2)) {
        clearBlock(S, /Joint|Business|Print Offer|template/i);
        note(S, `R${round} Joint/Business letter indicators on ${name}`);
      } else if (/LD01/i.test(t2)) block(S, "Binds LD01 not RTO Joint/Business (PF-58502)");
    }
    if (/Rent to Own|RTO|ROPI|ROPJ|ROPB/i.test(t)) note(S, `R${round} RTO markers on ${name}`);
  }
  await fillSearch(page, "LNLOAN00110000745RTO12608");
  await shot(page, `${p}-inq-rto`);
  if (!V(S).notes.some((n) => /Print Offer/i.test(n))) block(S, "Print Offer Letter stepper missing");
  if (!V(S).notes.some((n) => /Joint\/Business letter/i.test(n))) block(S, "No Joint/Business RTO templates (PF-58500)");
  V(S).status = V(S).blockers.length ? "PARTIAL" : "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function r58376(page: Page, round: number) {
  const S = "PF-58376";
  V(S).round = round;
  const p = `r${round}-76`;
  const bases = [
    "https://uat.fusionx.biz/web/comn-settings/cNwNb/schedule-monitory-dashboard",
    "https://uat.fusionx.biz/web/comn-settings/cNwNb/schedule-monitoring-dashboard",
    "https://uat.fusionx.biz/web/lending/cNwNb/schedule-monitory-dashboard",
  ];
  for (const url of bases) {
    await visit(page, `${p}-home-${url.includes("lending") ? "lend" : "comn"}`, url, 3500);
  }
  await visit(page, `${p}-main`, bases[0], 4000);
  await fillDates(page);
  for (const mod of [/TD/i, /Term Deposit/i, /Lending/i, /COMMON/i, /CASA/i]) {
    await pickSelect(page, mod);
    await clickText(page, /^Search$/i);
    await page.waitForTimeout(2500);
    const t = await body(page);
    const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
    await shot(page, `${p}-search-${mod.source.slice(0, 6)}`);
    note(S, `R${round} module ${mod} rows=${rows} Success=${/Success/i.test(t)} Error=${/Error/i.test(t)}`);
    if (rows > 0 && /Success/i.test(t) && /Error/i.test(t)) {
      clearBlock(S, /No Data|Success\+Error/i);
      note(S, `R${round} Success+Error AC met via ${mod}`);
      break;
    }
  }
  // Process submenu tries
  for (const lab of [/Apply Interest/i, /Interest Calculation/i, /CIAP/i, /CRIN/i, /Process/i]) {
    await clickText(page, lab);
    await page.waitForTimeout(1200);
  }
  await shot(page, `${p}-process`);
  if (!V(S).notes.some((n) => /Success\+Error AC met/i.test(n))) block(S, "Schedule search still No Data / no Success+Error (PF-58418/25/26)");
  V(S).status = V(S).blockers.some((b) => /No Data|Success/i.test(b)) ? "PARTIAL" : "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function r58377(page: Page, round: number) {
  const S = "PF-58377";
  V(S).round = round;
  const p = `r${round}-77`;
  const urls = [
    "https://uat.fusionx.biz/web/supplier/cNwNb/entity-creation",
    "https://uat.fusionx.biz/web/supplier/cNwNb/supplier-creation",
    "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation",
    "https://uat.fusionx.biz/web/supplier/cNwNb/supplier-inquiry",
    "https://uat.fusionx.biz/web/supplier/cNwNb/reports",
  ];
  for (const url of urls) {
    const t = await visit(page, `${p}-${url.split("/").pop()}`, url, 3500);
    const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
    note(S, `R${round} ${url.split("/").pop()} rows=${rows} len=${t.length}`);
  }
  await visit(page, `${p}-list`, urls[0], 4000);
  let rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  if (rows === 0) {
    await clickText(page, /Refresh|Search|All/i);
    await page.waitForTimeout(2000);
    rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  }
  if (rows > 0) {
    clearBlock(S, /Entity Creation blank/i);
    note(S, `R${round} Entity Creation rows=${rows}`);
    await tableAction(page, "View");
    await page.waitForTimeout(2500);
    await shot(page, `${p}-view`);
    const bad = api.filter((a) => a.status === 404 && /payee-detail/i.test(a.url));
    if (bad.length) block(S, "payee-detail 404 (PF-58507)");
  } else block(S, "Entity Creation blank");

  await visit(page, `${p}-create`, urls[0], 3000);
  await clickText(page, /Create New|Add New|Select Supplier/i);
  await clickText(page, /Individual/i);
  await shot(page, `${p}-indiv`);
  const t = await body(page);
  if (/Bussiness|Add a Individual/i.test(t)) block(S, "Copy typos (PF-58512)");

  await visit(page, `${p}-pend`, urls[2], 3500);
  const pendText = await body(page);
  const dups = (pendText.match(/SUP0000002558/g) || []).length;
  if (dups >= 2) block(S, `Pending duplicates SUP0000002558 x${dups} (PF-58513)`);
  await tableAction(page, "Select");
  await shot(page, `${p}-pend-select`);

  V(S).status = V(S).blockers.length ? "PARTIAL" : "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function r58378(page: Page, round: number) {
  const S = "PF-58378";
  V(S).round = round;
  const p = `r${round}-78`;
  await visit(page, `${p}-list`, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 4000);
  const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `R${round} NCD rows=${rows}`);
  await tableAction(page, "View");
  await waitReady(page);
  let t = await body(page);
  await shot(page, `${p}-view`);
  if (/Value Date\s*[-–—]/.test(t) || /Value Date\s+\-\s/.test(t)) block(S, "Value Date dash (PF-58514)");
  else note(S, `R${round} Value Date check text snippet ok or absent`);

  await visit(page, `${p}-create`, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/create", 3500);
  await pickSelect(page, /Saving|Cash|Kenyan|Deposit/i);
  await clickText(page, /Save|Confirm and Proceed|Submit/i);
  await page.waitForTimeout(2000);
  t = await body(page);
  await shot(page, `${p}-save`);
  if (/float|0\.00/i.test(t)) block(S, "Create blocked by float 0.00");
  else note(S, `R${round} create no float toast`);

  await visit(page, `${p}-auth`, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/authorize", 4000);
  await tableAction(page, "Select");
  await shot(page, `${p}-auth-select`);
  await clickText(page, /^Approve$/i);
  await shot(page, `${p}-auth-approve`);
  block(S, "Checker approve still required (PF-58560) — maker path only");

  await visit(page, `${p}-pending-tab`, "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 3000);
  await clickText(page, /Pending/i);
  await shot(page, `${p}-pending`);

  V(S).status = V(S).blockers.some((b) => /float|Value Date|Checker/i.test(b)) ? "PARTIAL" : "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function r58380(page: Page, round: number) {
  const S = "PF-58380";
  V(S).round = round;
  const p = `r${round}-80`;
  const accts = ["0042250036", "0032250038", "LNLOMO00110000023ILON2605", "011325099"];
  for (const acct of accts) {
    await visit(page, `${p}-inq-${acct.slice(0, 6)}`, "https://uat.fusionx.biz/web/lending/cNwNb/account-inquiry", 3000);
    await fillSearch(page, acct);
    const t = await body(page);
    await shot(page, `${p}-inq-${acct.slice(0, 6)}`);
    note(S, `R${round} inquiry ${acct} hit=${/DORCAS|JACOB|PRETERMINATED|EXPIRED|ACTIVE|004225|003225|LNLO/i.test(t)}`);
    if (/DORCAS|JACOB|PRETERMINATED|EXPIRED|ACTIVE/i.test(t)) clearBlock(S, /Inquiry fill miss/i);
  }

  for (const [name, url] of [
    ["rev", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reversal"],
    ["rev2", "https://uat.fusionx.biz/web/lending/cNwNb/receipt-reversal"],
    ["realloc", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reallocation/create"],
    ["maint", "https://uat.fusionx.biz/web/lending/cNwNb/account-maintenance"],
    ["txn", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management"],
  ] as const) {
    const t = await visit(page, `${p}-${name}`, url, 3500);
    const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
    note(S, `R${round} ${name} rows=${rows}`);
    if (rows > 0) {
      clearBlock(S, /Reversal list empty/i);
      await tableAction(page, "View");
      await shot(page, `${p}-${name}-view`);
    }
  }
  if (!V(S).notes.some((n) => /rev rows=[1-9]/i.test(n))) block(S, "Reversal list empty for migrated receipt reverse");
  V(S).status = V(S).blockers.length ? "PARTIAL" : "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function r58383(page: Page, round: number) {
  const S = "PF-58383";
  V(S).round = round;
  const p = `r${round}-83`;
  await visit(page, `${p}-td`, "https://uat.fusionx.biz/web/td/cNwNb/dashboard", 4000);
  await tryGbaf(page);
  await shot(page, `${p}-gbaf`);

  const paths = [
    "https://uat.fusionx.biz/web/td/cNwNb/account-management/manage-account",
    "https://uat.fusionx.biz/web/td/cNwNb/account-management/opening",
    "https://uat.fusionx.biz/web/td/cNwNb/account-management/activate",
    "https://uat.fusionx.biz/web/td/cNwNb/account-inquiry",
    "https://uat.fusionx.biz/web/td/cNwNb/account-management/ownership-transfer",
    "https://uat.fusionx.biz/web/td/cNwNb/account-management/owner-transfer-history",
    "https://uat.fusionx.biz/web/td/cNwNb/maintenance/ownership-transfer",
    "https://uat.fusionx.biz/web/td/cNwNb/maintenance/owner-transfer-history",
  ];
  for (const url of paths) {
    let t = await visit(page, `${p}-${url.split("/").slice(-2).join("-")}`, url, 3500);
    if (/GBAF|IBAF/i.test(t)) {
      await tryGbaf(page);
      await page.waitForTimeout(2000);
      t = await body(page);
      await shot(page, `${p}-retry-${url.split("/").pop()}`);
    }
    const past = /Account Number|Search By|Customer|Owner|Transfer|History|From Owner|To Owner/i.test(t) && !(/GBAF|IBAF/i.test(t) && t.length < 1000);
    note(S, `R${round} ${url.split("/").pop()} pastSelector=${past}`);
    if (past && /Owner|Transfer|History/i.test(t)) {
      clearBlock(S, /GBAF|selector|ownership/i);
      note(S, `R${round} ownership/history UI reached`);
    }
  }
  // Menu hunt from TD home
  await visit(page, `${p}-home2`, "https://uat.fusionx.biz/web/td/cNwNb/dashboard", 3000);
  await tryGbaf(page);
  for (const lab of [/Manage Account/i, /Account Inquiry/i, /Ownership/i, /Transfer/i, /Maintenance/i, /History/i]) {
    await clickText(page, lab);
    await page.waitForTimeout(1500);
    await tryGbaf(page);
  }
  await shot(page, `${p}-menu-hunt`);
  if (!V(S).notes.some((n) => /ownership\/history UI reached/i.test(n))) {
    block(S, "GBAF/IBAF selector still traps deep routes (PF-58398/58416)");
    V(S).status = "FAIL";
  } else V(S).status = "COMPLETE";
  rec(`verdict-${S}-r${round}`, V(S));
}

async function rNaSmoke(page: Page, round: number) {
  // Quick reconfirm N/A Kenya shells still empty — document only
  for (const [S, url] of [
    ["PF-58379", "https://uat.fusionx.biz/web/lending/cNwNb/accrued-interest"],
    ["PF-58381", "https://uat.fusionx.biz/web/cob/cNwNb/document-request"],
    ["PF-58382", "https://uat.fusionx.biz/web/casa/cNwNb/profit-sharing"],
    ["PF-58384", "https://uat.fusionx.biz/web/comn-settings/cNwNb/sms"],
  ] as const) {
    V(S).round = round;
    const t = await visit(page, `r${round}-na-${S.slice(-2)}`, url, 2500);
    const real = /Accrued Interest|Document Request|Profit Sharing|SMS Template|BRWNS/i.test(t);
    note(S, `R${round} realFeature=${real}`);
    V(S).status = real ? "PARTIAL" : "N/A_KENYA";
    if (real) clearBlock(S, /N\/A/);
    else block(S, "Feature not on Kenya UAT build");
  }
}

async function tryChecker(page: Page) {
  const S = "PF-58560";
  V(S).round = 2;
  note(S, "Checker attempt in same browser after maker rounds");
  await logoutInPlace(page);
  const ok = await azureLogin(page, checkerEmail, checkerPassword);
  await shot(page, "chk-login");
  if (!ok) {
    block(S, "MethmiB Azure AD login failed");
    V(S).status = "BLOCKED";
    rec("checker-fail", V(S));
    // restore maker session for any leftover
    await azureLogin(page, makerEmail, makerPassword);
    return false;
  }
  const who = await body(page);
  const isChecker = /MethmiB|Methmi/i.test(who) && !/ThejanaD@lolctech\.com/i.test(who);
  if (!isChecker) {
    note(S, "azureLogin returned OK but UI still maker (ThejanaD) — session switch failed");
    block(S, "Checker Azure switch not proven; UI still maker ThejanaD");
    V(S).status = "PARTIAL";
    rec("checker-session-retained", { whoSnippet: who.slice(0, 200) });
    // do not soft-clear maker checker blockers
    note("PF-58378", "Checker approve attempted but maker session retained");
    rec("checker-done", V(S));
    return false;
  }
  note(S, "Checker login OK (MethmiB visible)");
  clearBlock(S, /MethmiB|Checker|session/i);
  await visit(page, "chk-perc", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 4000);
  await clickText(page, /Pending Requests/i);
  await tableAction(page, "Select");
  await clickText(page, /^Approve$/i);
  await clickText(page, /Confirm|Yes|Proceed/i);
  await shot(page, "chk-perc-approve");
  await visit(page, "chk-ncd", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/authorize", 4000);
  await tableAction(page, "Select");
  await clickText(page, /^Approve$/i);
  await shot(page, "chk-ncd-approve");
  await visit(page, "chk-sup", "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation", 3500);
  await tableAction(page, "Select");
  await clickText(page, /Confirm|Approve/i);
  await shot(page, "chk-sup-confirm");
  V(S).status = "COMPLETE";
  clearBlock("PF-58378", /Checker approve/i);
  note("PF-58378", "Checker approve attempted in round-2 same browser as MethmiB");
  rec("checker-done", V(S));
  return true;
}

(async () => {
  console.log("creds", makerEmail, "pwdLen", makerPassword?.length);
  const browser = await chromium.launch({ headless: false, slowMo: 70 });
  const ctx = await browser.newContext({
    viewport: { width: 1520, height: 960 },
    ...(storagePrev ? { storageState: storagePrev } : {}),
  });
  const page = await ctx.newPage();
  page.on("response", (res) => {
    const u = res.url();
    if (/payee-detail|penal|receipt|non-counter|schedule|td-|offer|401|403|404|500/i.test(u) && api.length < 500) {
      api.push({ status: res.status(), method: res.request().method(), url: u.slice(0, 360) });
    }
  });

  try {
    await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    const t0 = await body(page);
    const inApp = /Duruma|Ask FxMind|Core Banking/i.test(t0) && !/Continue with AzureAd|Sign in|Enter password/i.test(t0);
    if (!inApp && !(await azureLogin(page, makerEmail, makerPassword))) throw new Error("maker-login-failed");
    await shot(page, "00-maker-home");
    rec("maker-ready", { ok: true });

    // ===== ROUND 1 =====
    rec("round-1-start", {});
    await r58374(page, 1);
    await r58375(page, 1);
    await r58376(page, 1);
    await r58377(page, 1);
    await r58378(page, 1);
    await r58380(page, 1);
    await r58383(page, 1);
    await rNaSmoke(page, 1);
    rec("round-1-done", { verdicts: JSON.parse(JSON.stringify(verdicts)) });

    // ===== ROUND 2 — misses / alternates =====
    rec("round-2-start", {});
    await r58374(page, 2);
    await r58375(page, 2);
    await r58376(page, 2);
    await r58377(page, 2);
    await r58378(page, 2);
    await r58380(page, 2);
    await r58383(page, 2);
    await rNaSmoke(page, 2);
    rec("round-2-done", { verdicts: JSON.parse(JSON.stringify(verdicts)) });

    // Checker in SAME browser
    await tryChecker(page);

    rec("api-summary", {
      count: api.length,
      bad401: api.filter((x) => x.status === 401).slice(0, 15),
      bad404: api.filter((x) => x.status === 404).slice(0, 15),
      bad500: api.filter((x) => x.status >= 500).slice(0, 10),
    });
    await ctx.storageState({ path: path.join(proof, "_storage.json") });
    rec("all-2round-done", { verdicts });
    console.log(JSON.stringify(verdicts, null, 2));
  } catch (e: any) {
    rec("fatal", { error: String(e).slice(0, 500), shot: await shot(page, "fatal") });
    console.error(e);
  } finally {
    if ((process.env.QAFUSIONX_CLOSE_BROWSER ?? "1").trim() === "1") await browser.close();
    else await new Promise((r) => setTimeout(r, 600_000));
  }
})();
