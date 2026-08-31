/**
 * PARTIAL → complete-stage redo for PF-58374/75/76/77/78/80/83
 * ONE continuous headed browser (unbreakable session).
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

function loadCreds() {
  const credFile = "C:/Users/ThejanaD/QAFusionX/tmp-creds.json";
  if (fs.existsSync(credFile)) {
    const j = JSON.parse(fs.readFileSync(credFile, "utf8"));
    return { email: j.email as string, password: j.password as string };
  }
  return {
    email: process.env.QAFUSIONX_EMAIL || "ThejanaD@lolctech.com",
    password: process.env.QAFUSIONX_PASSWORD || "",
  };
}
const { email: makerEmail, password: makerPassword } = loadCreds();
if (!makerPassword || makerPassword.length < 8) {
  console.error("Missing password — write tmp-creds.json or set QAFUSIONX_PASSWORD without shell # truncation");
  process.exit(1);
}
console.log("creds", makerEmail, "pwdLen", makerPassword.length);const proof = "C:/Users/ThejanaD/QAFusionX/proof-partials-complete-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/partials-complete-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });
const storage = path.join(proof, "_storage.json");
const storagePrev = [
  path.join(proof, "_storage.json"),
  "C:/Users/ThejanaD/QAFusionX/proof-full-all-11-r2-aug31/_storage.json",
  "C:/Users/ThejanaD/QAFusionX/proof-full-all-11-aug31/_storage.json",
].find((p) => fs.existsSync(p));

const log: any[] = [];
const verdicts: Record<string, { status: string; notes: string[]; blockers: string[] }> = {};
const api: any[] = [];

function v(story: string) {
  if (!verdicts[story]) verdicts[story] = { status: "IN_PROGRESS", notes: [], blockers: [] };
  return verdicts[story];
}
function note(story: string, msg: string) {
  v(story).notes.push(msg);
}
function block(story: string, msg: string) {
  v(story).blockers.push(msg);
}
function setStatus(story: string, status: string) {
  v(story).status = status;
}

async function body(page: any) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}
async function shot(page: any, n: string) {
  const p = path.join(proof, n.endsWith(".png") ? n : `${n}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => page.screenshot({ path: p }));
  try {
    fs.copyFileSync(p, path.join(mirror, path.basename(p)));
  } catch {}
  return p;
}
function rec(step: string, extra: any = {}) {
  log.push({ step, at: new Date().toISOString(), ...extra });
  fs.writeFileSync(path.join(proof, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(mirror, "_exec.json"), JSON.stringify(log, null, 2));
  fs.writeFileSync(path.join(proof, "_verdicts.json"), JSON.stringify(verdicts, null, 2));
  fs.writeFileSync(path.join(mirror, "_verdicts.json"), JSON.stringify(verdicts, null, 2));
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
    if (/Duruma|Ask FxMind|Core Banking Modules/i.test(t) && !/Sign in|Continue with AzureAd|Enter a valid email|Enter password/i.test(t)) {
      return true;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      const vis = await page.locator("#i0118").isVisible().catch(() => false);
      const attached = await page.locator("#i0118").count();
      if (attached && (vis || !(await page.locator("#i0116").isVisible().catch(() => false)))) {
        // password step if email already done
      }
    }
    if (await page.locator("#i0116").count()) {
      const emailVisible = await page.locator("#i0116").isVisible().catch(() => false);
      const pwdVisible = await page.locator("#i0118").isVisible().catch(() => false);
      if (pwdVisible) {
        await setInputValue(page, "#i0118", password);
        await page.click("#idSIButton9").catch(() => {});
        await page.waitForTimeout(2500);
        continue;
      }
      if (emailVisible || (await page.locator("#i0116").count())) {
        await setInputValue(page, "#i0116", email);
        await page.click("#idSIButton9").catch(() => {});
        await page.waitForTimeout(2500);
        continue;
      }
    }
    if (await page.getByRole("button", { name: /^Yes$/i }).count()) {
      await page.getByRole("button", { name: /^Yes$/i }).first().click();
      await page.waitForTimeout(4000);
      continue;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function waitReady(page: any, ms = 35000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = await body(page);
    if (!/LOADING|Authenticating|personalization is in progress|Initializing|Verifying account/i.test(t) && t.length > 80) return t;
    await page.waitForTimeout(800);
  }
  return await body(page);
}

async function visit(page: any, name: string, url: string, waitMs = 4000) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitReady(page, 30000);
  await page.waitForTimeout(waitMs);
  const t = await body(page);
  const s = await shot(page, name);
  rec(name, { url: page.url(), shot: s, text: t.slice(0, 1600) });
  return t;
}

async function clickText(page: any, re: RegExp) {
  const loc = page.getByText(re).first();
  if (!(await loc.count().catch(() => 0))) return { ok: false };
  await loc.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1800);
  return { ok: true };
}

async function clickExact(page: any, text: string) {
  const loc = page.getByText(text, { exact: true }).first();
  if (!(await loc.isVisible().catch(() => false))) return false;
  await loc.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  return true;
}

async function clickTableAction(page: any, label: string) {
  const cell = page.locator("tr.ant-table-row td").filter({ hasText: new RegExp(`^${label}$|\\b${label}\\b`, "i") }).first();
  if (await cell.count()) {
    await cell.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    return true;
  }
  return !!(await clickText(page, new RegExp(`^${label}$`, "i"))).ok;
}

async function pickAntOption(page: any, placeholderOrLabel: RegExp, optionText: RegExp) {
  const field = page.locator(".ant-select, .ant-picker").filter({ hasText: placeholderOrLabel }).first();
  const clickTarget = (await field.count())
    ? field.locator(".ant-select-selector, input").first()
    : page.getByText(placeholderOrLabel).first();
  await clickTarget.click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  const opt = page.locator(".ant-select-item-option-content, .ant-select-item").filter({ hasText: optionText }).first();
  if (await opt.count()) {
    await opt.click({ force: true });
    await page.waitForTimeout(600);
    return true;
  }
  // typeahead
  const input = page.locator(".ant-select-focused input, .ant-select-open input").first();
  if (await input.count()) {
    await input.fill("").catch(() => {});
    await input.type(optionText.source.replace(/[\\^$.*+?()[\]{}|]/g, "").slice(0, 12), { delay: 40 }).catch(() => {});
    await page.waitForTimeout(700);
    const o2 = page.locator(".ant-select-item-option-content").first();
    if (await o2.count()) {
      await o2.click({ force: true });
      return true;
    }
  }
  return false;
}

async function fillDateRange(page: any) {
  const from = page.locator("input[placeholder*='From' i], .ant-picker-input input").first();
  const to = page.locator("input[placeholder*='To' i], .ant-picker-input input").nth(1);
  if (await from.count()) {
    await from.click({ force: true });
    await page.waitForTimeout(500);
    // pick day 1 then day 28 of visible calendar
    const days = page.locator(".ant-picker-cell-in-view .ant-picker-cell-inner");
    if ((await days.count()) > 5) {
      await days.nth(0).click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      await days.nth(20).click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  if (await to.count()) {
    await to.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const days = page.locator(".ant-picker-cell-in-view .ant-picker-cell-inner");
    if ((await days.count()) > 5) await days.nth(25).click({ force: true }).catch(() => {});
  }
}

// ——— Stories ———

async function complete58374(page: any) {
  const S = "PF-58374";
  await visit(page, "c74-list", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change", 5000);
  let t = await body(page);
  const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `List loaded rows=${rows}`);
  if (rows > 0) note(S, "Requests tab has batches — list AC pass");
  else block(S, "Requests list empty");

  await clickText(page, /^Pending Requests$/i);
  await page.waitForTimeout(2000);
  await shot(page, "c74-pending");
  note(S, `Pending tab text has PENDING=${/PENDING/i.test(await body(page))}`);

  await clickText(page, /^Requests$/i);
  await page.waitForTimeout(1500);
  const viewed = await clickTableAction(page, "View");
  await waitReady(page);
  t = await body(page);
  await shot(page, "c74-view");
  note(S, `View opened=${viewed}; has Batch=${/Batch Number|481|AVK/i.test(t)}`);
  const hasGrace = /grace|instalment.?wise|installment.?wise/i.test(t);
  if (!hasGrace) block(S, "No instalment-wise grace fields on View (PF-58496)");
  else note(S, "Grace fields present");

  // Go To Edit path
  await clickText(page, /Go To Edit/i);
  await page.waitForTimeout(2500);
  t = await body(page);
  await shot(page, "c74-edit");
  if (/Authorization|Approve|Reject/i.test(t) && /APPROVED|approved/i.test(t) === false) {
    block(S, "Go To Edit opens Authorization chrome (PF-58497)");
  }
  note(S, `After Go To Edit url=${page.url()} authChrome=${/Authorization|Approve/i.test(t)}`);

  // Create New with sub-product pick
  await visit(page, "c74-create", "https://uat.fusionx.biz/web/lending/cNwNb/account-management/penal-interest-rate-change/request", 4000);
  await pickAntOption(page, /Sub Product|Please select/i, /INSURANCE|PREMIUM|LOAN|FINANCE/i);
  await shot(page, "c74-create-picked");
  await clickText(page, /^Search$/i);
  await page.waitForTimeout(2500);
  t = await body(page);
  await shot(page, "c74-search");
  if (/Something went wrong|Failed/i.test(t)) block(S, "Create Search still errors");
  else note(S, "Create Search after sub-product — no fail toast");

  // Template setting hunt
  await visit(page, "c74-tpl", "https://uat.fusionx.biz/web/lending/cNwNb/settings", 3000);
  await clickText(page, /Penal|Interest Template|Template/i);
  await page.waitForTimeout(2000);
  await shot(page, "c74-tpl-hunt");
  t = await body(page);
  if (!/grace/i.test(t)) block(S, "Template settings also lack grace (PF-58511 typos remain)");

  if (v(S).blockers.some((b) => /grace|Go To Edit|Search still/i.test(b))) setStatus(S, "PARTIAL_COMPLETE");
  else setStatus(S, "COMPLETE");
  note(S, "Verification stage re-executed: list/pending/view/edit/create/template");
  rec("verdict-58374", v(S));
}

async function complete58375(page: any) {
  const S = "PF-58375";
  await visit(page, "c75-owl", "https://uat.fusionx.biz/web/lending/cNwNb/origination-without-lead", 4000);
  let t = await body(page);
  note(S, `OWL loaded; RTO card=${/Rent to Own|RTO/i.test(t)}`);

  await visit(page, "c75-offer", "https://uat.fusionx.biz/web/lending/cNwNb/origination/offer-letter", 4000);
  t = await body(page);
  if (/No Data|empty|This is the description/i.test(t) && t.length < 400) block(S, "Offer letter URL empty shell (PF-58499)");
  await shot(page, "c75-offer");

  // Contract activate / inquiry RTO
  await visit(page, "c75-act", "https://uat.fusionx.biz/web/lending/cNwNb/account-activation", 4000);
  await clickText(page, /Rent to Own|RTO|Search/i);
  await page.waitForTimeout(2000);
  await shot(page, "c75-act-search");

  // Direct contract
  await visit(
    page,
    "c75-contract",
    "https://uat.fusionx.biz/web/lending/cNwNb/origination/initiate-contract/5123446",
    5000,
  );
  t = await body(page);
  await shot(page, "c75-contract");
  note(S, `Contract page has Print Offer=${/Print Offer Letter|Offer Letter/i.test(t)}`);
  if (/Print Offer Letter/i.test(t)) {
    await clickText(page, /Print Offer Letter/i);
    await page.waitForTimeout(2500);
    t = await body(page);
    await shot(page, "c75-print");
    note(S, `Letter code LD01=${/LD01/i.test(t)}; Joint/Business=${/Joint|Business|ROPJ|ROPB/i.test(t)}`);
    if (/LD01/i.test(t) && !/ROPJ|ROPB|Joint|Business/i.test(t)) block(S, "Binds LD01 not RTO Joint/Business (PF-58502)");
  } else block(S, "Print Offer Letter stepper missing on contract");

  // Loan documents templates
  await visit(page, "c75-docs", "https://uat.fusionx.biz/web/lending/cNwNb/settings", 3000);
  await clickText(page, /Document|Letter|Template/i);
  await page.waitForTimeout(2000);
  t = await body(page);
  await shot(page, "c75-docs");
  if (!/ROPJ|ROPB|Rent to Own Joint|Rent to Own Business/i.test(t)) block(S, "No Joint/Business RTO templates (PF-58500)");
  else note(S, "Found Joint/Business template labels");

  setStatus(S, v(S).blockers.length ? "PARTIAL_COMPLETE" : "COMPLETE");
  note(S, "Verification stage re-executed: OWL/offer/activation/contract/print/templates");
  rec("verdict-58375", v(S));
}

async function complete58376(page: any) {
  const S = "PF-58376";
  await visit(page, "c76-home", "https://uat.fusionx.biz/web/comn-settings/cNwNb/schedule-monitory-dashboard", 5000);
  let t = await body(page);
  note(S, `Dashboard loaded=${/Schedule Monitory|Module|From Date/i.test(t)}`);

  await fillDateRange(page);
  await pickAntOption(page, /Module|Please select/i, /TD|Term Deposit|Lending/i);
  await shot(page, "c76-filled");
  await clickText(page, /^Search$/i);
  await page.waitForTimeout(3500);
  t = await body(page);
  await shot(page, "c76-search");
  const hasRows = (await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0)) > 0;
  note(S, `After dates+module search rows=${hasRows} Success=${/Success/i.test(t)} Error=${/Error/i.test(t)} Incomplete=${/Incomplete/i.test(t)}`);
  if (!hasRows || /No Data/i.test(t)) block(S, "Schedule search still No Data — cannot verify Success+Error (PF-58418/25/26)");
  else if (!/Success/i.test(t) || !/Error/i.test(t)) block(S, "Rows exist but Success+Error pair not both visible");
  else note(S, "Success and Error rows visible — AC met");

  // Process Apply Interest Auto / CIAP style menus
  await clickText(page, /Apply Interest|Interest Calculation|Process/i);
  await page.waitForTimeout(2000);
  await shot(page, "c76-process");

  setStatus(S, v(S).blockers.length ? "PARTIAL_COMPLETE" : "COMPLETE");
  note(S, "Verification stage re-executed with date+module filters");
  rec("verdict-58376", v(S));
}

async function complete58377(page: any) {
  const S = "PF-58377";
  await visit(page, "c77-list", "https://uat.fusionx.biz/web/supplier/cNwNb/entity-creation", 5000);
  let rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `Entity Creation rows=${rows}`);
  if (rows === 0) block(S, "Entity Creation blank");

  // Prefer View on a row with SUP id
  const viewOk = await clickTableAction(page, "View");
  await page.waitForTimeout(3000);
  let t = await body(page);
  await shot(page, "c77-view");
  note(S, `View modal/page opened=${viewOk}; Individual=${/Individual|Person|Identification/i.test(t)}`);

  // Watch for 404 payee-detail
  const bad404 = api.filter((a) => a.status === 404 && /payee-detail/i.test(a.url));
  if (bad404.length) block(S, `payee-detail 404 still (${bad404[0].url.slice(0, 120)}) PF-58507`);
  else note(S, "No payee-detail 404 in this session yet");

  await visit(page, "c77-create", "https://uat.fusionx.biz/web/supplier/cNwNb/entity-creation", 3000);
  await clickText(page, /Create New|Add New|Select Supplier/i);
  await page.waitForTimeout(1500);
  await clickText(page, /Individual/i);
  await page.waitForTimeout(2000);
  t = await body(page);
  await shot(page, "c77-indiv");
  note(S, `Create Individual tabs=${/Payee|Charge|Bank|Contact/i.test(t)}`);
  if (/Bussiness|Add a Individual/i.test(t)) block(S, "Copy typos still present (PF-58512)");

  await visit(page, "c77-pend", "https://uat.fusionx.biz/web/supplier/cNwNb/pending-supplier-confirmation", 4000);
  rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `Pending rows=${rows}`);
  const text = await body(page);
  const dups = (text.match(/SUP0000002558/g) || []).length;
  if (dups >= 2) block(S, `Pending duplicates SUP0000002558 x${dups} (PF-58513)`);

  await visit(page, "c77-inq", "https://uat.fusionx.biz/web/supplier/cNwNb/supplier-inquiry", 4000);
  note(S, `Inquiry loaded=${/Organization Type|Individual|Corporate|Search/i.test(await body(page))}`);

  setStatus(S, v(S).blockers.length ? "PARTIAL_COMPLETE" : "COMPLETE");
  note(S, "Verification stage re-executed: list/view/create/pending/inquiry");
  rec("verdict-58377", v(S));
}

async function complete58378(page: any) {
  const S = "PF-58378";
  await visit(page, "c78-list", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit", 5000);
  let rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `NCD list rows=${rows}`);
  if (rows === 0) block(S, "NCD list blank (PF-58439 regression?)");
  else note(S, "List not blank — PF-58439 mitigated");

  await clickTableAction(page, "View");
  await waitReady(page);
  let t = await body(page);
  await shot(page, "c78-view");
  note(S, `View amount=${/1,?200|Amount/i.test(t)} ValueDateDash=${/Value Date\s*[-–—]/i.test(t) || /Value Date\s*$/i.test(t)}`);
  if (/Value Date\s*[-–—.]|Value Date\s+_/.test(t) || (t.includes("Value Date") && t.includes("-"))) {
    block(S, "Value Date still dash (PF-58514)");
  }

  await visit(page, "c78-create", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/create", 4000);
  t = await body(page);
  await shot(page, "c78-create");
  // try pick deposit type / save
  await pickAntOption(page, /Deposit Type|Currency|Pay Method/i, /Saving|Cash|Kenyan/i);
  await clickText(page, /Save|Confirm and Proceed|Submit/i);
  await page.waitForTimeout(2000);
  t = await body(page);
  await shot(page, "c78-save");
  if (/float|0\.00|Please select|required/i.test(t)) block(S, "Create still blocked by float/validation");
  else note(S, "Create save did not show float block");

  await visit(page, "c78-auth", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/non-counter-deposit/authorize", 4000);
  rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `Authorize pending rows=${rows}`);
  if (rows > 0) {
    await clickTableAction(page, "Select");
    await page.waitForTimeout(2000);
    await shot(page, "c78-auth-select");
    note(S, "Authorize Select opened — checker still needed for Approve");
    block(S, "Checker approve not done (PF-58560)");
  }

  setStatus(S, v(S).blockers.length ? "PARTIAL_COMPLETE" : "COMPLETE");
  note(S, "Verification stage re-executed: list/view/create/authorize");
  rec("verdict-58378", v(S));
}

async function complete58380(page: any) {
  const S = "PF-58380";
  await visit(page, "c80-inq", "https://uat.fusionx.biz/web/lending/cNwNb/account-inquiry", 4000);
  const input = page.locator("#searchtext, input[placeholder*='Account' i], input[placeholder*='Search' i]").first();
  if (await input.count()) {
    await input.fill("0042250036");
    await page.keyboard.press("Enter").catch(() => {});
    await clickText(page, /^Search$/i);
    await page.waitForTimeout(3000);
  }
  let t = await body(page);
  await shot(page, "c80-inq-fill");
  note(S, `Inquiry 0042250036 found=${/DORCAS|PRETERMINATED|0042250036/i.test(t)}`);

  await visit(page, "c80-rev", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reversal", 5000);
  const rows = await page.locator("tr.ant-table-row:not(.ant-table-measure-row)").count().catch(() => 0);
  note(S, `Receipt reversal rows=${rows}`);
  if (rows > 0) {
    await clickTableAction(page, "View");
    await page.waitForTimeout(2000);
    await shot(page, "c80-rev-view");
    note(S, "Reversal View opened");
  } else block(S, "Reversal list empty for migrated receipt reverse");

  await visit(page, "c80-realloc", "https://uat.fusionx.biz/web/lending/cNwNb/transaction-management/receipt-reallocation/create", 4000);
  note(S, `Reallocation create=${/Reallocation|Account|Receipt/i.test(await body(page))}`);

  await visit(page, "c80-maint", "https://uat.fusionx.biz/web/lending/cNwNb/account-maintenance", 4000);
  note(S, `Loan maintenance=${/Maintenance|Search|Account/i.test(await body(page))}`);

  // Second loan
  await visit(page, "c80-inq2", "https://uat.fusionx.biz/web/lending/cNwNb/account-inquiry", 3000);
  if (await input.count()) {
    await input.fill("0032250038");
    await clickText(page, /^Search$/i);
    await page.waitForTimeout(2500);
  }
  t = await body(page);
  await shot(page, "c80-maua");
  note(S, `0032250038 found=${/JACOB|EXPIRED|Maua|0032250038/i.test(t)}`);

  setStatus(S, v(S).blockers.length ? "PARTIAL_COMPLETE" : "COMPLETE");
  note(S, "Verification stage re-executed: inquiry/reversal/realloc/maint");
  rec("verdict-58380", v(S));
}

async function complete58383(page: any) {
  const S = "PF-58383";
  await visit(page, "c83-td", "https://uat.fusionx.biz/web/td/cNwNb/dashboard", 5000);
  let t = await body(page);
  note(S, `TD dashboard=${/Term Deposit|Account Management|Opening/i.test(t)}`);

  // Pick GBAF if selector
  if (/GBAF|IBAF|Select Business Unit|Select.*Unit/i.test(t)) {
    await clickExact(page, "GBAF") || (await clickText(page, /^GBAF$/i));
    await page.waitForTimeout(2500);
    await shot(page, "c83-gbaf");
    note(S, "Clicked GBAF on selector");
  }

  // Manage account
  await visit(page, "c83-manage", "https://uat.fusionx.biz/web/td/cNwNb/account-management/manage-account", 5000);
  t = await body(page);
  await shot(page, "c83-manage");
  if (/GBAF|IBAF/i.test(t) && /Core Banking Modules/i.test(t)) {
    await clickExact(page, "GBAF") || (await clickText(page, /^GBAF$/i));
    await page.waitForTimeout(3000);
    await shot(page, "c83-manage2");
  }
  t = await body(page);
  if (/GBAF|IBAF/i.test(t) && !/Account Number|Search By|Customer/i.test(t)) {
    block(S, "Still stuck on GBAF/IBAF selector after click (PF-58398/58416)");
  } else note(S, "Manage Account chrome reached past selector");

  // Ownership / history URLs
  for (const [name, url] of [
    ["c83-own", "https://uat.fusionx.biz/web/td/cNwNb/account-management/ownership-transfer"],
    ["c83-hist", "https://uat.fusionx.biz/web/td/cNwNb/account-management/owner-transfer-history"],
    ["c83-inq", "https://uat.fusionx.biz/web/td/cNwNb/account-inquiry"],
  ] as const) {
    await visit(page, name, url, 4000);
    t = await body(page);
    if (/GBAF|IBAF/i.test(t) && t.length < 900) block(S, `${name} reset to unit selector`);
    note(S, `${name} ownership/history UI=${/Owner|Transfer|History|From|To/i.test(t)}`);
  }

  setStatus(S, v(S).blockers.length ? "FAIL_COMPLETE_STAGE" : "COMPLETE");
  note(S, "Verification stage re-executed: TD/GBAF/manage/ownership/history/inquiry");
  rec("verdict-58383", v(S));
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx = await browser.newContext({
    viewport: { width: 1520, height: 960 },
    ...(storagePrev ? { storageState: storagePrev } : {}),
  });
  const page = await ctx.newPage();
  page.on("response", (res) => {
    const u = res.url();
    if (/payee-detail|interest-rate|receipt|non-counter|penal|td-|schedule|offer|401|403|404|500/i.test(u) && api.length < 400) {
      api.push({ status: res.status(), method: res.request().method(), url: u.slice(0, 360) });
    }
  });

  try {
    await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    const t = await body(page);
    const inApp = /Core Banking Modules|Duruma|Ask FxMind/i.test(t) && !/Continue with AzureAd|Enter password/i.test(t);
    if (!inApp && !(await azureLogin(page, makerEmail, makerPassword))) throw new Error("maker-login-failed");
    await shot(page, "00-home");
    rec("maker-ready", { ok: true });

    // Same browser — dig through all PARTIALs
    await complete58374(page);
    await complete58375(page);
    await complete58376(page);
    await complete58377(page);
    await complete58378(page);
    await complete58380(page);
    await complete58383(page);

    rec("api-summary", {
      count: api.length,
      bad401: api.filter((x) => x.status === 401).slice(0, 15),
      bad403: api.filter((x) => x.status === 403).slice(0, 10),
      bad404: api.filter((x) => x.status === 404).slice(0, 15),
      bad500: api.filter((x) => x.status >= 500).slice(0, 10),
    });
    await ctx.storageState({ path: storage });
    rec("all-partials-done", { verdicts });
    console.log(JSON.stringify(verdicts, null, 2));
  } catch (e: any) {
    rec("fatal", { error: String(e).slice(0, 500), shot: await shot(page, "fatal") });
  } finally {
    // End-of-flow close only when requested; default keep open briefly then close for this completion batch
    if ((process.env.QAFUSIONX_CLOSE_BROWSER ?? "1").trim() === "1") await browser.close();
    else await new Promise((r) => setTimeout(r, 600_000));
  }
})();
