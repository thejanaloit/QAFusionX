/**
 * PF-58376 reinit — Schedule Monitory Dashboard (TD + CASA/Lending).
 * Bugs: PF-58426 (TD 401), PF-58505 (CASA OD Recovery blank / 88711).
 * Mouse-only + wait-until-analyzable. Entry URL once if new browser.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58376";
fs.mkdirSync(OUT, { recursive: true });
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
let seq = 0;
let entryLoaded = false;
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
    if (/Core Banking Modules/i.test(t) && /Loan Origination|Account Management|Term Deposit/i.test(t)) return true;
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

async function flipOpen(page: Page, titleRe: RegExp, label: string): Promise<Page> {
  const box = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, "i");
    const els = Array.from(document.querySelectorAll("div")).filter((el) => {
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      const r = el.getBoundingClientRect();
      return re.test(t) && r.width > 80 && r.width < 400 && r.height < 100 && r.height > 10;
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
    await page.mouse.click(box.x, box.y);
    await sleep(1000);
    await page.mouse.dblclick(box.x, box.y);
    await sleep(2200);
  }
  const pages = page.context().pages().filter((p) => !p.isClosed());
  return pages[pages.length - 1] || page;
}

async function goHomeModules(page: Page): Promise<Page> {
  // Prefer home dashboard modules grid
  if (/Core Banking Modules/i.test(await body(page))) return page;
  // try click fusionX / home icon or open new from entry once only via same window nav
  const hit = await mouseText(page, /Core Banking|Dashboard|Home/i, "homeish");
  if (hit) await waitReady(page, "homeish", (t) => /Core Banking Modules/i.test(t), 30_000);
  if (/Core Banking Modules/i.test(await body(page))) return page;
  // last resort: entry URL only if never loaded this process
  if (!entryLoaded) {
    await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
    entryLoaded = true;
    await login(page);
    await waitReady(page, "home", (t) => /Core Banking Modules/i.test(t));
  }
  return page;
}

async function main() {
  console.log("=== REINIT PF-58376 mouse-only ===");
  const browser = await chromium.launch({ headless: false, slowMo: 150, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);

  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  entryLoaded = true;
  await shot(page, "00-entry");
  await login(page);
  await waitReady(page, "home", (t) => /Core Banking Modules/i.test(t));
  await shot(page, "01-home");

  const findings: Array<{ bug: string; claim: string; verdict: string; notes: string; shot: string }> = [];

  // --- TD path (PF-58426) ---
  page = await flipOpen(page, /Term Deposit Management/i, "td");
  await waitReady(page, "td", (t, u) => /Term Deposit|Schedule|Interest|Dashboard|No Data|401|Unauthorized/i.test(t) || /term|td|deposit/i.test(u), 90_000);
  await shot(page, "td-land");

  for (const m of [/Schedule Monitory|Schedule Monitor|Monitory Dashboard|Schedule/i, /Credit Interest|Interest Apply|Search/i, /Process|Inquiry|Dashboard/i]) {
    await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 24));
    await waitReady(page, "td-menu", (t) => t.length > 40, 40_000);
  }
  const tdText = await body(page);
  const td401 = /401|Unauthorized|Insufficient Privileges|Forbidden/i.test(tdText);
  const tdNoData = /No Data/i.test(tdText);
  const td404 = /404|Not Found|schedule-monitory/i.test(tdText) || /404/.test(page.url());
  const shotTd = await shot(page, "assert-58426-td");
  findings.push({
    bug: "PF-58426",
    claim: "TD Schedule Monitory search — credit-interest-apply-log 401",
    verdict: td401 ? "CONFIRMED" : td404 ? "CONFIRMED" : tdNoData ? "PARTIAL" : "PARTIAL",
    notes: td401
      ? "401/Unauthorized/privileges visible on TD schedule path"
      : td404
        ? "404 / schedule-monitory missing on TD path"
        : `TD path reached; noData=${tdNoData} url=${page.url()}`,
    shot: shotTd,
  });

  // back to home modules
  page = await goHomeModules(page);
  await waitReady(page, "home2", (t) => /Core Banking Modules/i.test(t), 60_000);

  // --- CASA / Account Management (PF-58505) ---
  page = await flipOpen(page, /Account Management/i, "casa");
  // GBAF modal if present
  await sleep(2000);
  const modal = await body(page);
  if (/GBAF|IBAF|Banking Type|Select/i.test(modal)) {
    await mouseText(page, /GBAF/i, "gbaf");
    await waitReady(page, "gbaf", (t, u) => /casa|account|dashboard|Schedule|OD/i.test(t + u), 90_000);
  }
  await shot(page, "casa-land");

  for (const m of [
    /Schedule Monitory|Schedule Monitor|Monitory/i,
    /OD Recovery|Overdraft|Recovery/i,
    /Completed/i,
    /Search/i,
    /Select/i,
    /Process/i,
  ]) {
    await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 24));
    await waitReady(page, "casa-menu", (t) => t.length > 40, 40_000);
  }
  const casaText = await body(page);
  const blankCompleted = /Completed/i.test(casaText) && (/No Data|-\s*-|blank/i.test(casaText) || !/\d{2,}/.test(casaText));
  const err88711 = /88711|Something went wrong|error pages|HTTP 500|404/i.test(casaText);
  const shotCasa = await shot(page, "assert-58505-casa");
  findings.push({
    bug: "PF-58505",
    claim: "CASA OD Recovery Completed blank columns; Select opens 88711 errors",
    verdict: err88711 || blankCompleted ? "CONFIRMED" : "PARTIAL",
    notes: err88711
      ? "88711 / error page text visible after Select/nav"
      : blankCompleted
        ? "Completed view present with blank/No Data columns"
        : `CASA/OD path reached; url=${page.url()} — full Select repro may need seeded row`,
    shot: shotCasa,
  });

  const storyPass = findings.every((f) => f.verdict === "NOT_REPRO");
  const summary = {
    story: "PF-58376",
    at: new Date().toISOString(),
    storyPassAttempt: storyPass,
    honestDoneAllowed: storyPass,
    jiraDone: false,
    reasonNotDone: storyPass ? null : "Open/partial defects — not Done",
    findings,
    out: OUT,
  };
  fs.writeFileSync(path.join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58376.json", JSON.stringify(summary, null, 2));
  console.log("REINIT_58376_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
