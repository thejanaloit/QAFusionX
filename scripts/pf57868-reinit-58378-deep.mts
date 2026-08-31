/**
 * PF-58378 deepen — search sidebar for Non-counter / NCD, open View, assert Value Date.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58378";
fs.mkdirSync(OUT, { recursive: true });
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
let seq = 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function body(page: Page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    return "";
  }
}
async function shot(page: Page, name: string) {
  seq += 1;
  const f = `${String(seq).padStart(3, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, f), fullPage: false }).catch(() => undefined);
  console.log("SHOT", f);
  return f;
}
async function mouseText(page: Page, re: RegExp, label: string) {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  const box = await loc.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 18), { steps: 28 });
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 18));
  await shot(page, `aim-${label}`);
  return true;
}
async function setInput(page: Page, sel: string, val: string) {
  await page.evaluate(
    ({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return;
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      el.focus();
      if (s) s.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel, val },
  );
}
async function login(page: Page) {
  for (let i = 0; i < 80; i++) {
    const t = await body(page);
    if (/Core Banking Modules/i.test(t) && /Loan Origination/i.test(t)) return true;
    if (/Continue with AzureAd/i.test(t)) {
      await mouseText(page, /Continue with AzureAd/i, "a");
      await sleep(1500);
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInput(page, "#i0116", maker.email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await sleep(2000);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInput(page, "#i0118", maker.password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await sleep(2500);
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await mouseText(page, /^Yes$/i, "y");
      continue;
    }
    if (/Pick an account/i.test(t)) {
      await mouseText(page, /ThejanaD@lolctech\.com/i, "p");
      continue;
    }
    await sleep(900);
  }
  return false;
}

async function main() {
  console.log("=== DEEPEN PF-58378 NCD search ===");
  const browser = await chromium.launch({ headless: false, slowMo: 130, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await login(page);

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
    await page.mouse.move(box.x, box.y, { steps: 35 });
    await page.mouse.click(box.x, box.y);
    await sleep(1400);
    await page.mouse.dblclick(box.x, box.y);
    await sleep(2200);
  }
  page = ctx.pages().filter((p) => !p.isClosed()).at(-1) || page;
  await page.bringToFront();
  for (let i = 0; i < 40; i++) {
    const t = await body(page);
    if (/Transaction Management|Welcome to Lending/i.test(t) && !/personalization is in progress/i.test(t)) break;
    await sleep(1200);
  }
  await shot(page, "lending");

  // type into Search menu
  const search = page.getByPlaceholder(/Search menu/i).first();
  if (await search.count()) {
    await search.click({ force: true });
    await search.fill("Non Counter");
    await sleep(1200);
    await shot(page, "search-non-counter");
  } else {
    await mouseText(page, /Search menu/i, "search-label");
    await page.keyboard.type("Non Counter", { delay: 40 });
    await sleep(1200);
    await shot(page, "search-typed");
  }

  for (const m of [/Non Counter Deposit/i, /Non-Counter/i, /Noncounter/i, /Non Counter/i, /Counter Deposit/i]) {
    if (await mouseText(page, m, m.source.slice(0, 18))) {
      await sleep(2500);
      break;
    }
  }
  await shot(page, "after-ncd-nav");

  // nested Transaction Management child click again then search deposit
  await mouseText(page, /^Transaction Management$/i, "txn-child");
  await sleep(2000);
  await shot(page, "txn-child");

  // fill sidebar search again with Deposit
  const search2 = page.getByPlaceholder(/Search menu/i).first();
  if (await search2.count()) {
    await search2.fill("Deposit");
    await sleep(1000);
    await shot(page, "search-deposit");
    for (const m of [/Non Counter/i, /Non-Counter Deposit/i, /Receipt/i, /Deposit/i]) {
      await mouseText(page, m, `dep-${m.source.slice(0, 12)}`);
      await sleep(1500);
    }
  }
  await shot(page, "ncd-candidate");

  const viewBox = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a,button,span")).filter((el) => {
      const t = (el.textContent || "").trim();
      const r = el.getBoundingClientRect();
      return t === "View" && r.width > 8 && r.y > 200;
    });
    const el = links[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (viewBox) {
    await page.mouse.move(viewBox.x, viewBox.y, { steps: 24 });
    await page.mouse.click(viewBox.x, viewBox.y);
    await sleep(3000);
  }
  await shot(page, "assert-58514");
  const t = await body(page);
  const url = page.url();
  const hasValue = /Value Date/i.test(t);
  const hasBatch = /Batch Date/i.test(t);
  const dash = /Value Date[\s\S]{0,60}?-\s*(?:\n|$|Batch)/i.test(t);
  const findings = [
    {
      bug: "PF-58514",
      claim: "NCD View Value Date is dash while Batch Date is set",
      verdict: hasValue && dash ? "CONFIRMED" : hasValue && hasBatch ? "PARTIAL" : "PARTIAL",
      notes: `url=${url} value=${hasValue} batch=${hasBatch} dash=${dash}`,
      shot: "assert-58514.png".replace(/^/, String(seq).padStart(3, "0") + "-").replace(/^\d+-/, "") ,
    },
  ];
  // fix shot name to last shot
  const lastShot = [...fs.readdirSync(OUT)].filter((x) => x.includes("assert-58514")).sort().at(-1) || "assert-58514.png";
  findings[0].shot = lastShot;

  const summary = {
    story: "PF-58378",
    at: new Date().toISOString(),
    deepen: true,
    honestDoneAllowed: findings.every((f) => f.verdict === "NOT_REPRO"),
    jiraDone: false,
    findings,
    out: OUT,
    url,
    snippet: t.slice(0, 600),
  };
  fs.writeFileSync(path.join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58378.json", JSON.stringify(summary, null, 2));
  console.log("REINIT_58378_DEEP_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
