/**
 * PF-58374 reinit — mouse-only + wait-until-analyzable.
 * Story: Penal Interest / instalment-wise grace (Lending).
 * Bugs under check: PF-58496, PF-58497.
 * Output: E:\QA OUTPUTS\PF-57868-reinit\proof\PF-58374\
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58374";
const MIRROR = "C:/Users/ThejanaD/QAFusionX/proof-reinit-58374-aug31";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MIRROR, { recursive: true });

const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
let seq = 0;
let entryLoaded = false;

async function body(page: Page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    await page.waitForTimeout(800);
    return "";
  }
}

async function shot(page: Page, name: string) {
  seq += 1;
  const file = `${String(seq).padStart(3, "0")}-${name}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 20_000 });
    fs.copyFileSync(path.join(OUT, file), path.join(MIRROR, file));
    console.log("SHOT", file);
  } catch (e) {
    console.log("SHOT_FAIL", file, e instanceof Error ? e.message : e);
  }
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
      await page.waitForTimeout(2500);
      continue;
    }
    if (ok(t, u)) {
      quiet++;
      if (quiet >= 2) {
        await page.waitForTimeout(1000);
        await shot(page, `ready-${label}`);
        return true;
      }
    } else quiet = 0;
    await page.waitForTimeout(1200);
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
  const y = box.y + Math.min(box.height / 2, 24);
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
  await page.mouse.move(x, y, { steps: 40 });
  await page.waitForTimeout(300);
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
    if (/Core Banking Modules/i.test(t) && /Loan Origination/i.test(t) && !/personalization is in progress/i.test(t)) return true;
    if (/personalization is in progress|Please wait/i.test(t)) {
      await page.waitForTimeout(3500);
      continue;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await mouseText(page, /Continue with AzureAd/i, "azuread");
      await page.waitForTimeout(2000);
      continue;
    }
    if (/Use my password|Use your password instead/i.test(t)) {
      await mouseText(page, /Use my password|Use your password instead/i, "usepwd");
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInput(page, "#i0116", maker.email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await page.waitForTimeout(2200);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInput(page, "#i0118", maker.password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await page.waitForTimeout(2800);
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
    await page.waitForTimeout(1000);
  }
  return false;
}

async function clickLoanFlip(page: Page) {
  const box = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("div")).filter((el) => {
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      const r = el.getBoundingClientRect();
      return /^Loan Origination and Management$/i.test(t) && r.width > 80 && r.width < 360 && r.height < 80;
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const leaf = els[0];
    if (!leaf) return null;
    let n: HTMLElement | null = leaf;
    let best = leaf;
    for (let i = 0; i < 6 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 140 && r.width <= 380 && r.height >= 100 && r.height <= 240) best = n;
      n = n.parentElement;
    }
    const r = best.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!box) return mouseText(page, /Loan Origination and Management/i, "loan-text");
  await page.mouse.move(box.x, box.y, { steps: 40 });
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1800);
  await shot(page, "loan-flipped");
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1200);
  await page.mouse.dblclick(box.x, box.y);
  await page.waitForTimeout(2000);
  // adopt new tab
  const pages = page.context().pages().filter((p) => !p.isClosed());
  for (const p of [...pages].reverse()) {
    if (/\/web\/(loan|lending|perc)/i.test(p.url()) || /Penal|PERC|Loan/i.test(await p.evaluate(() => document.body?.innerText ?? "").catch(() => ""))) {
      await p.bringToFront();
      return p;
    }
  }
  return pages[pages.length - 1] || page;
}

async function main() {
  console.log("=== REINIT PF-58374 mouse-only ===");
  const browser = await chromium.launch({ headless: false, slowMo: 160, args: ["--start-maximized", "--new-window"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);

  if (entryLoaded) throw new Error("locked");
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  entryLoaded = true;
  await shot(page, "00-entry");

  const ok = await login(page);
  await waitReady(page, "home", (t) => /Core Banking Modules/i.test(t) && /Loan Origination/i.test(t));
  await shot(page, ok ? "01-home" : "01-fail");

  page = await clickLoanFlip(page);
  await waitReady(page, "lending", (t, u) => /Penal|PERC|Interest|Loan|Grace|Dashboard|Inquiry/i.test(t) || /loan|lending|perc/i.test(u), 90_000);

  const findings: Array<{ bug: string; claim: string; verdict: string; notes: string; shot: string }> = [];

  // Navigate menus for grace / PERC
  for (const m of [
    /Penal Interest/i,
    /PERC/i,
    /Interest Rate Change/i,
    /Grace/i,
    /Template/i,
    /Authorization/i,
    /Pending/i,
    /Inquiry/i,
    /Settings/i,
  ]) {
    await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 24));
    await waitReady(page, "menu", (t) => t.length > 40, 45_000);
  }

  const t = await body(page);
  const hasGrace = /instalment.?wise|grace period|grace days/i.test(t);
  const hasPerc = /PERC|Penal Interest|Interest Rate Change/i.test(t);
  const shotA = await shot(page, "assert-grace-ui");

  findings.push({
    bug: "PF-58496",
    claim: "Instalment-wise grace fields missing on PERC View",
    verdict: hasGrace ? "NOT_REPRO" : "CONFIRMED",
    notes: hasGrace ? "Grace/instalment-wise text visible after mouse nav" : "No instalment-wise grace fields found on reachable Lending/PERC screens",
    shot: shotA,
  });

  // Go To Edit / Approve reject check (58497) — best effort
  const editHit = await mouseText(page, /Go To Edit|Edit|Approve|Reject|Authorization/i, "auth-edit");
  await waitReady(page, "auth", (x) => x.length > 40, 45_000);
  const t2 = await body(page);
  const badEdit = /Approve|Reject/i.test(t2) && /APPROVED|approved/i.test(t2);
  const shotB = await shot(page, "assert-58497");
  findings.push({
    bug: "PF-58497",
    claim: "Go To Edit on APPROVED PERC reopens Approve/Reject",
    verdict: editHit && badEdit ? "CONFIRMED" : editHit ? "PARTIAL" : "BLOCKED",
    notes: editHit
      ? badEdit
        ? "Approve/Reject still visible in approved context"
        : "Reached auth/edit area — approved reopen not clearly reproduced this pass"
      : "Could not reach Go To Edit / Authorization control by mouse this pass",
    shot: shotB,
  });

  const storyPass = findings.every((f) => f.verdict === "NOT_REPRO");
  const summary = {
    story: "PF-58374",
    at: new Date().toISOString(),
    storyPassAttempt: storyPass,
    honestDoneAllowed: storyPass,
    findings,
    out: OUT,
    rule: "mouse-only + wait-until-analyzable + honest-done",
  };
  fs.writeFileSync(path.join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    "E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58374.json",
    JSON.stringify(summary, null, 2),
  );
  console.log("REINIT_58374_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
