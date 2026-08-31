/**
 * PF-58378 reinit — Non-counter deposits (NCD). Bug PF-58514 Value Date = '-'.
 * Mouse-only + wait-until-analyzable.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58378";
fs.mkdirSync(OUT, { recursive: true });
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
let seq = 0;
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
    if (/personalization is in progress|Please wait, Your/i.test(t) && t.length < 500) {
      quiet = 0;
      await sleep(2500);
      continue;
    }
    if (ok(t, u)) {
      quiet++;
      if (quiet >= 2) {
        await sleep(800);
        await shot(page, `ready-${label}`);
        return true;
      }
    } else quiet = 0;
    await sleep(1200);
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
  await page.mouse.move(x, y, { steps: 36 });
  await sleep(250);
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
  for (let i = 0; i < 100; i++) {
    const t = await body(page);
    if (/Core Banking Modules/i.test(t) && /Loan Origination/i.test(t)) return true;
    if (/personalization is in progress/i.test(t)) {
      await sleep(3500);
      continue;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await mouseText(page, /Continue with AzureAd/i, "azuread");
      await sleep(2000);
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

async function main() {
  console.log("=== REINIT PF-58378 NCD mouse-only ===");
  const browser = await chromium.launch({ headless: false, slowMo: 150, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await shot(page, "00-entry");
  await login(page);
  await waitReady(page, "home", (t) => /Loan Origination and Management/i.test(t));

  const box = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("div,span")).filter((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      const r = el.getBoundingClientRect();
      return t === "Loan Origination and Management" && r.width > 40 && r.width < 320 && r.height < 70 && r.y > 180;
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const leaf = els[0] as HTMLElement | undefined;
    if (!leaf) return null;
    let n: HTMLElement | null = leaf;
    let best = leaf;
    for (let i = 0; i < 8 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 150 && r.width <= 380 && r.height >= 100 && r.height <= 240) best = n;
      n = n.parentElement;
    }
    const r = best.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (box) {
    await page.mouse.move(box.x, box.y, { steps: 40 });
    await page.mouse.click(box.x, box.y);
    await sleep(1600);
    await shot(page, "loan-flipped");
    await page.mouse.dblclick(box.x, box.y);
    await sleep(2200);
  } else {
    await mouseText(page, /Loan Origination and Management/i, "loan");
    await sleep(2000);
  }
  page = ctx.pages().filter((p) => !p.isClosed()).at(-1) || page;
  await page.bringToFront();
  await waitReady(page, "lending", (t, u) => /Transaction Management|Welcome to Lending|Non.?counter|Deposit/i.test(t) || /lending/i.test(u), 90_000);
  await shot(page, "lending-land");

  await mouseText(page, /Transaction Management/i, "txn-mgmt");
  await sleep(1500);
  for (const m of [/Non.?[Cc]ounter|Non Counter|NCD|Deposit/i, /Create|New/i, /Inquiry|Pending|View/i, /Batch/i]) {
    await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 20));
    await waitReady(page, "ncd-menu", (t) => t.length > 40, 40_000);
  }
  await shot(page, "ncd-list");

  // try View on a row (prefer numeric id / View link)
  const viewBox = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a,button,span")).filter((el) => {
      const t = (el.textContent || "").trim();
      const r = el.getBoundingClientRect();
      return (t === "View" || t === "VIEW") && r.width > 8 && r.y > 200;
    });
    const el = links[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (viewBox) {
    await page.mouse.move(viewBox.x, viewBox.y, { steps: 28 });
    await page.mouse.click(viewBox.x, viewBox.y);
    await sleep(3000);
  } else {
    await mouseText(page, /\bView\b/i, "view");
    await sleep(2500);
  }
  await waitReady(page, "ncd-view", (t) => /Value Date|Batch Date|Non.?counter|Deposit|1565|Save|Back/i.test(t), 60_000);
  const t = await body(page);
  const shotA = await shot(page, "assert-58514");
  const valueDash = /Value Date\s*[:\-]?\s*-(\s|$)/i.test(t) || /Value Date[\s\S]{0,40}\n\s*-\s*/i.test(t) || (/Value Date/i.test(t) && /Batch Date/i.test(t) && /\n-\n|\s-\s/.test(t));
  // simpler: look for Value Date near dash in raw text
  const valueDateDash = /Value Date[\s\S]{0,80}?-\s*(?:\n|$)/i.test(t) || /Value Date\s*-\s*$/im.test(t);
  const hasBatch = /Batch Date/i.test(t);
  const hasValueLabel = /Value Date/i.test(t);

  const findings = [
    {
      bug: "PF-58514",
      claim: "NCD View Value Date is dash while Batch Date is set",
      verdict: hasValueLabel && (valueDash || valueDateDash) ? "CONFIRMED" : hasValueLabel && hasBatch ? "PARTIAL" : "PARTIAL",
      notes: hasValueLabel
        ? `Value Date label present; dashHeuristic=${valueDash || valueDateDash}; batch=${hasBatch}; url=${page.url()}`
        : `NCD view not clearly opened; url=${page.url()}`,
      shot: shotA,
    },
  ];

  const storyPass = findings.every((f) => f.verdict === "NOT_REPRO");
  const summary = {
    story: "PF-58378",
    at: new Date().toISOString(),
    honestDoneAllowed: storyPass,
    jiraDone: false,
    findings,
    out: OUT,
    url: page.url(),
    snippet: t.slice(0, 500),
  };
  fs.writeFileSync(path.join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58378.json", JSON.stringify(summary, null, 2));
  console.log("REINIT_58378_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
