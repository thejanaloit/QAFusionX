/**
 * PF-58377 reinit — Supplier Module process enhancements.
 * Bug: PF-58507 View supplier payee-detail undefined → 404.
 * Mouse-only + wait-until-analyzable.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58377";
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
    if (/Core Banking Modules/i.test(t) && /Entity Management|Loan Origination/i.test(t)) return true;
    if (/personalization is in progress|Please wait/i.test(t)) {
      await sleep(3500);
      continue;
    }
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
      return re.test(t) && r.width > 80 && r.width < 400 && r.height < 100;
    });
    els.sort(
      (a, b) =>
        a.getBoundingClientRect().width * a.getBoundingClientRect().height -
        b.getBoundingClientRect().width * b.getBoundingClientRect().height,
    );
    const leaf = els[0];
    if (!leaf) return null;
    let n: HTMLElement | null = leaf;
    let best = leaf;
    for (let i = 0; i < 6 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 140 && r.width <= 400 && r.height >= 90 && r.height <= 260) best = n;
      n = n.parentElement;
    }
    const r = best.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, titleRe.source);
  if (!box) {
    await mouseText(page, titleRe, label);
    await sleep(2000);
  } else {
    await page.mouse.move(box.x, box.y, { steps: 40 });
    await page.mouse.click(box.x, box.y);
    await sleep(1600);
    await shot(page, `${label}-flipped`);
    await page.mouse.dblclick(box.x, box.y);
    await sleep(2200);
  }
  const pages = page.context().pages().filter((p) => !p.isClosed());
  for (const p of [...pages].reverse()) {
    if (/supplier|entity/i.test(p.url())) {
      await p.bringToFront();
      return p;
    }
  }
  return pages[pages.length - 1] || page;
}

async function main() {
  console.log("=== REINIT PF-58377 Supplier mouse-only ===");
  const browser = await chromium.launch({ headless: false, slowMo: 150, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await shot(page, "00-entry");
  await login(page);
  await waitReady(page, "home", (t) => /Core Banking Modules/i.test(t));
  await shot(page, "01-home");

  page = await flip(page, /Entity Management/i, "entity");
  await waitReady(page, "entity", (t, u) => /Supplier|Entity|View|Create|Inquiry|Reports/i.test(t) || /supplier|entity/i.test(u), 90_000);
  await shot(page, "entity-land");

  for (const m of [
    /Supplier/i,
    /View Suppliers|View Supplier/i,
    /Select Supplier/i,
    /Create|Individual|Corporate/i,
    /Pending Supplier|Pending/i,
    /Inquiry/i,
    /Reports/i,
  ]) {
    await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 24));
    await waitReady(page, "sup-menu", (t) => t.length > 40, 40_000);
  }
  await shot(page, "supplier-shell");

  // try View on a row
  const viewHit = await mouseText(page, /\bView\b/i, "view-row");
  await waitReady(page, "view", (t) => t.length > 40, 45_000);
  const t = await body(page);
  const shotView = await shot(page, "assert-58507-view");
  const is404 = /404|Not Found|undefined|payee-detail|payee detail/i.test(t) || /404|undefined/i.test(page.url());
  const blankShell = /Supplier/i.test(t) && !/NIC|Name|Code|Payee|Bank|Account/i.test(t) && t.length < 800;
  const hasDetail = /Payee|NIC|Supplier Code|Bank Account|Mobile/i.test(t);

  const findings = [
    {
      bug: "PF-58507",
      claim: "View supplier calls payee-detail with undefined — 404",
      verdict: is404 ? "CONFIRMED" : viewHit && !hasDetail ? "CONFIRMED" : viewHit && hasDetail ? "NOT_REPRO" : "PARTIAL",
      notes: viewHit
        ? is404
          ? "404/undefined/payee-detail visible after View"
          : hasDetail
            ? "Supplier detail fields visible — 404 not seen this pass"
            : `View opened but detail sparse/blank shell url=${page.url()}`
        : `Could not click View row; shell url=${page.url()} blankish=${blankShell}`,
      shot: shotView,
    },
  ];

  const storyPass = findings.every((f) => f.verdict === "NOT_REPRO");
  const summary = {
    story: "PF-58377",
    at: new Date().toISOString(),
    honestDoneAllowed: storyPass,
    jiraDone: false,
    findings,
    out: OUT,
    url: page.url(),
  };
  fs.writeFileSync(path.join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58377.json", JSON.stringify(summary, null, 2));
  console.log("REINIT_58377_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
