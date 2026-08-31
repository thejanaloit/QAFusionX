/**
 * PF-58376 deepen — Common Sync → Schedule Monitory Dashboard (+ CASA GBAF OD).
 * Mouse-only; entry once.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58376";
fs.mkdirSync(OUT, { recursive: true });
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
let seq = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function body(page: Page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    await sleep(800);
    return "";
  }
}
async function shot(page: Page, name: string) {
  seq += 1;
  const file = `${String(seq).padStart(3, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 20_000 }).catch(() => undefined);
  console.log("SHOT", file);
  return file;
}
async function waitReady(page: Page, label: string, ok: (t: string, u: string) => boolean, maxMs = 90_000) {
  console.log("WAIT", label);
  const t0 = Date.now();
  let quiet = 0;
  while (Date.now() - t0 < maxMs) {
    const t = await body(page);
    const u = page.url();
    if (/personalization is in progress/i.test(t) && t.length < 500) {
      quiet = 0;
      await sleep(2500);
      continue;
    }
    if (ok(t, u)) {
      quiet++;
      if (quiet >= 2) {
        await shot(page, `ready-${label}`);
        return true;
      }
    } else quiet = 0;
    await sleep(1100);
  }
  await shot(page, `timeout-${label}`);
  return false;
}
async function mouseText(page: Page, re: RegExp, label: string) {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await loc.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 22);
  await page.evaluate(
    ({ x: cx, y: cy }) => {
      document.getElementById("qafx-ring")?.remove();
      const d = document.createElement("div");
      d.id = "qafx-ring";
      d.style.cssText = `position:fixed;left:${cx - 28}px;top:${cy - 28}px;width:56px;height:56px;border:3px solid #e11;border-radius:50%;z-index:2147483647;pointer-events:none`;
      document.body.appendChild(d);
    },
    { x, y },
  );
  await shot(page, `aim-${label}`);
  await page.mouse.move(x, y, { steps: 30 });
  await sleep(200);
  await page.mouse.click(x, y);
  await page.evaluate(() => document.getElementById("qafx-ring")?.remove()).catch(() => undefined);
  return true;
}
async function setInput(page: Page, sel: string, val: string) {
  await page.evaluate(
    ({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      el.focus();
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel, val },
  );
}
async function login(page: Page) {
  for (let i = 0; i < 90; i++) {
    const t = await body(page);
    if (/Core Banking Modules/i.test(t)) return true;
    if (/Continue with AzureAd/i.test(t)) {
      await mouseText(page, /Continue with AzureAd/i, "azuread");
      await sleep(2000);
      continue;
    }
    if (/Use my password|Use your password instead/i.test(t)) {
      await mouseText(page, /Use my password|Use your password instead/i, "usepwd");
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInput(page, "#i0116", maker.email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await sleep(2200);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInput(page, "#i0118", maker.password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await sleep(2800);
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await mouseText(page, /^Yes$/i, "stay");
      continue;
    }
    if (/Pick an account/i.test(t)) {
      await mouseText(page, /ThejanaD@lolctech\.com/i, "pick");
      continue;
    }
    await sleep(1000);
  }
  return false;
}
async function flip(page: Page, titleRe: RegExp, label: string): Promise<Page> {
  const box = await page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const els = Array.from(document.querySelectorAll("div")).filter((el) => {
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      const r = el.getBoundingClientRect();
      return re.test(t) && r.width > 70 && r.width < 420 && r.height < 110;
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const leaf = els[0];
    if (!leaf) return null;
    let n: HTMLElement | null = leaf;
    let best = leaf;
    for (let i = 0; i < 6 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 130 && r.width <= 420 && r.height >= 90 && r.height <= 260) best = n;
      n = n.parentElement;
    }
    const r = best.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, titleRe.source);
  if (!box) await mouseText(page, titleRe, label);
  else {
    await page.mouse.move(box.x, box.y, { steps: 40 });
    await page.mouse.click(box.x, box.y);
    await sleep(1500);
    await page.mouse.dblclick(box.x, box.y);
    await sleep(2200);
  }
  const pages = page.context().pages().filter((p) => !p.isClosed());
  for (const p of [...pages].reverse()) {
    if (/comn|casa|td|schedule|common/i.test(p.url())) {
      await p.bringToFront();
      return p;
    }
  }
  return pages[pages.length - 1] || page;
}

async function main() {
  console.log("=== DEEPEN PF-58376 Common Sync Schedule Monitory ===");
  const browser = await chromium.launch({ headless: false, slowMo: 140, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await shot(page, "d00-entry");
  await login(page);
  await waitReady(page, "home", (t) => /Core Banking Modules|Common Sync/i.test(t));

  // Common Sync Management → Schedule Monitory
  page = await flip(page, /Common Sync Management/i, "common-sync");
  await waitReady(page, "sync", (t, u) => /Schedule|Sync|Common|Monitory|404|Unauthorized/i.test(t) || /comn/i.test(u), 90_000);
  await shot(page, "sync-land");

  await mouseText(page, /Schedule Monitory Dashboard|Schedule Monitor|Monitory Dashboard/i, "smd");
  await waitReady(page, "smd", (t, u) => /Schedule|Search|Process|No Data|404|401|Unauthorized|Success|Error|CASA|TD/i.test(t) || /schedule/i.test(u), 90_000);
  const smdShot = await shot(page, "smd-screen");
  let t = await body(page);
  const is404 = /404|Not Found|page doesn.?t exist/i.test(t) || /404/.test(page.url());
  const is401 = /401|Unauthorized|Insufficient Privileges/i.test(t);

  // Try module filters / search
  for (const m of [/CASA/i, /TD|Term Deposit/i, /Lending/i, /Search/i, /Success/i, /Error/i, /Completed/i]) {
    await mouseText(page, m, `smd-${m.source.slice(0, 10)}`);
    await sleep(900);
  }
  await mouseText(page, /Search|Apply|Submit|Process/i, "smd-search-btn");
  await sleep(2000);
  t = await body(page);
  const afterSearch = await shot(page, "smd-after-search");

  const findings = [
    {
      bug: "PF-58426",
      claim: "TD Schedule Monitory — credit-interest-apply-log 401",
      verdict: is401 ? "CONFIRMED" : is404 ? "CONFIRMED" : /No Data|401|Unauthorized/i.test(t) ? "CONFIRMED" : "PARTIAL",
      notes: `Common Sync → Schedule Monitory. 404=${is404} 401=${is401} url=${page.url()} textHits=${/No Data|Unauthorized|Success|Error/i.test(t)}`,
      shot: afterSearch || smdShot,
    },
  ];

  // Return home for CASA OD Recovery (Account Management → GBAF)
  // Open new page in same context via home icon if possible — else flip from home tab
  const homePage = ctx.pages().find((p) => /\/web\/home\//i.test(p.url())) || page;
  await homePage.bringToFront();
  page = homePage;
  if (!/Core Banking Modules/i.test(await body(page))) {
    await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  }
  await waitReady(page, "home2", (t) => /Core Banking Modules/i.test(t), 60_000);
  page = await flip(page, /Account Management/i, "am");
  await sleep(1500);
  if (/Select Banking|GBAF|IBAF/i.test(await body(page))) {
    // click GBAF card (2nd) — prefer blue General Banking text
    await mouseText(page, /General Banking & Finance|GBAF/i, "gbaf-card");
    await waitReady(page, "casa", (t, u) => /casa|account|OD|Recovery|Dashboard/i.test(t + u), 90_000);
  }
  await shot(page, "casa-land");
  for (const m of [/Schedule Monitory|Monitory/i, /OD Recovery|Overdraft Recovery|Recovery/i, /Completed/i, /Select/i]) {
    await mouseText(page, m, `casa-${m.source.slice(0, 12)}`);
    await waitReady(page, "casa-m", (x) => x.length > 30, 35_000);
  }
  const casaT = await body(page);
  const casaShot = await shot(page, "assert-58505");
  const err = /88711|Something went wrong|error/i.test(casaT);
  const blank = /Completed/i.test(casaT) && /No Data|^\s*$/m.test(casaT);
  findings.push({
    bug: "PF-58505",
    claim: "CASA OD Recovery Completed blank; Select → 88711",
    verdict: err || blank ? "CONFIRMED" : "PARTIAL",
    notes: `url=${page.url()} err88711=${err} blankCompleted=${blank}`,
    shot: casaShot,
  });

  const storyPass = findings.every((f) => f.verdict === "NOT_REPRO");
  const summary = {
    story: "PF-58376",
    at: new Date().toISOString(),
    deepen: true,
    honestDoneAllowed: storyPass,
    jiraDone: false,
    findings,
    out: OUT,
  };
  fs.writeFileSync(path.join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58376.json", JSON.stringify(summary, null, 2));
  console.log("REINIT_58376_DEEP_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
