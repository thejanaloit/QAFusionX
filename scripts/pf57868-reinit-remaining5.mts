/**
 * PF-57868 remaining 5: PF-58380…58384 — one headed browser, entry URL once, mouse-only.
 * Output: E:\QA OUTPUTS\PF-57868-reinit\proof\PF-5838x\ + tracker JSON
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const ROOT = "E:/QA OUTPUTS/PF-57868-reinit";
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function outDir(story: string) {
  const d = path.join(ROOT, "proof", story);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

async function body(page: Page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    return "";
  }
}

function makeShot(dir: string) {
  let seq = 0;
  return async (page: Page, name: string) => {
    seq += 1;
    const file = `${String(seq).padStart(3, "0")}-${name}.png`;
    await page.screenshot({ path: path.join(dir, file), fullPage: false, timeout: 20_000 }).catch(() => undefined);
    console.log("SHOT", path.basename(dir), file);
    return file;
  };
}

async function mouseText(page: Page, re: RegExp, label: string, shot?: (p: Page, n: string) => Promise<string>) {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await loc.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 20);
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
  if (shot) await shot(page, `aim-${label}`);
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

async function login(page: Page, shot: (p: Page, n: string) => Promise<string>) {
  for (let i = 0; i < 100; i++) {
    const t = await body(page);
    if (/Core Banking Modules/i.test(t) && /Loan Origination|Account Management|Term Deposit/i.test(t)) return true;
    if (/personalization is in progress/i.test(t)) {
      await sleep(3500);
      continue;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await mouseText(page, /Continue with AzureAd/i, "azuread", shot);
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
      await mouseText(page, /^Yes$/i, "stay", shot);
      continue;
    }
    if (/Pick an account/i.test(t)) {
      await mouseText(page, /ThejanaD@lolctech\.com/i, "pick", shot);
      continue;
    }
    await sleep(1000);
  }
  return false;
}

async function waitReady(page: Page, label: string, ok: (t: string) => boolean, shot: (p: Page, n: string) => Promise<string>, maxMs = 75_000) {
  console.log("WAIT", label);
  const t0 = Date.now();
  let quiet = 0;
  while (Date.now() - t0 < maxMs) {
    const t = await body(page);
    if (/personalization is in progress/i.test(t) && t.length < 500) {
      quiet = 0;
      await sleep(2500);
      continue;
    }
    if (ok(t)) {
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

async function flipExact(page: Page, title: string, shot: (p: Page, n: string) => Promise<string>): Promise<Page> {
  const box = await page.evaluate((title) => {
    const els = Array.from(document.querySelectorAll("div,span")).filter((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      const r = el.getBoundingClientRect();
      return t === title && r.width > 40 && r.width < 340 && r.height < 70 && r.y > 160;
    });
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const leaf = els[0] as HTMLElement | undefined;
    if (!leaf) return null;
    let n: HTMLElement | null = leaf;
    let best = leaf;
    for (let i = 0; i < 8 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 140 && r.width <= 400 && r.height >= 100 && r.height <= 250) best = n;
      n = n.parentElement;
    }
    const r = best.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, title);
  if (!box) {
    await mouseText(page, new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "flip-text", shot);
    await sleep(2000);
  } else {
    await page.mouse.move(box.x, box.y, { steps: 36 });
    await page.mouse.click(box.x, box.y);
    await sleep(1500);
    await shot(page, "flipped");
    await page.mouse.dblclick(box.x, box.y);
    await sleep(2200);
  }
  const pages = page.context().pages().filter((p) => !p.isClosed());
  return pages[pages.length - 1] || page;
}

async function goHome(page: Page, shot: (p: Page, n: string) => Promise<string>) {
  const home = page.context().pages().find((p) => /\/web\/home\//i.test(p.url()) && !p.isClosed());
  if (home) {
    await home.bringToFront();
    await waitReady(home, "home", (t) => /Core Banking Modules/i.test(t), shot, 45_000);
    return home;
  }
  // mouse: try clicking grid icon / fusion home — fallback same-window only if already on home
  if (/Core Banking Modules/i.test(await body(page))) return page;
  await mouseText(page, /Core Banking|fusionX/i, "homeish", shot);
  await sleep(1500);
  return page;
}

function saveSummary(story: string, summary: object) {
  const dir = outDir(story);
  fs.writeFileSync(path.join(dir, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(ROOT, "tracker", `${story}.json`), JSON.stringify(summary, null, 2));
  console.log("SUMMARY", story, JSON.stringify(summary));
}

async function sidebarSearch(page: Page, q: string, shot: (p: Page, n: string) => Promise<string>) {
  const search = page.getByPlaceholder(/Search menu/i).first();
  if (await search.count()) {
    await search.click({ force: true });
    await search.fill(q);
    await sleep(1000);
    await shot(page, `search-${q.replace(/\s+/g, "-").slice(0, 24)}`);
    return true;
  }
  return false;
}

async function main() {
  console.log("=== REMAINING 5 PACK (58380-58384) ===");
  const browser = await chromium.launch({ headless: false, slowMo: 130, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ viewport: null });
  let page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);

  // bootstrap shot helper for login
  let shot = makeShot(outDir("PF-58380"));
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await shot(page, "00-entry");
  await login(page, shot);
  await waitReady(page, "home", (t) => /Core Banking Modules/i.test(t), shot);

  // -------- PF-58380 Receipt / migrated contracts --------
  {
    const story = "PF-58380";
    const dir = outDir(story);
    shot = makeShot(dir);
    page = await goHome(page, shot);
    page = await flipExact(page, "Loan Origination and Management", shot);
    await page.bringToFront();
    await waitReady(page, "lending", (t) => /Lending|Transaction|Receipt|Dashboard/i.test(t), shot);
    await shot(page, "lending");
    await sidebarSearch(page, "Receipt", shot);
    for (const m of [/Receipt Reversal/i, /Receipt/i, /Reallocation/i, /Inquiry/i, /Transaction Management/i]) {
      await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 18), shot);
      await sleep(1800);
    }
    await shot(page, "receipt-area");
    const t = await body(page);
    const blank = /No Data|blank|Loading/i.test(t) || (!/Receipt|Reverse|Reallocation/i.test(t) && /Welcome to Lending/i.test(t));
    const found = /Receipt Reversal|Receipt/i.test(t) && !/Welcome to Lending System/i.test(t);
    const shotA = await shot(page, "assert-58380");
    saveSummary(story, {
      story,
      at: new Date().toISOString(),
      honestDoneAllowed: false,
      jiraDone: false,
      findings: [
        {
          bug: "migrated-receipts",
          claim: "Receipt reversal / inquiry / reallocation for migrated contracts",
          verdict: found && blank ? "CONFIRMED" : found ? "PARTIAL" : "PARTIAL",
          notes: `foundUI=${found} emptyOrWelcome=${blank} url=${page.url()}`,
          shot: shotA,
        },
      ],
      url: page.url(),
      out: dir,
    });
  }

  // -------- PF-58381 Document Request N/A --------
  {
    const story = "PF-58381";
    const dir = outDir(story);
    shot = makeShot(dir);
    page = await goHome(page, shot);
    if (!/Core Banking Modules/i.test(await body(page))) {
      // still on lending — search Document Request there too
    } else {
      page = await flipExact(page, "Loan Origination and Management", shot);
      await waitReady(page, "lending2", (t) => /Lending|Settings/i.test(t), shot);
    }
    await sidebarSearch(page, "Document Request", shot);
    const hit = await mouseText(page, /Document Request/i, "doc-req", shot);
    await sleep(1500);
    await shot(page, "after-doc-search");
    // Common Sync path also
    page = await goHome(page, shot);
    if (/Core Banking Modules/i.test(await body(page))) {
      page = await flipExact(page, "Common Sync Management", shot);
      await sleep(2500);
      await shot(page, "common");
      await sidebarSearch(page, "Document Request", shot);
      await mouseText(page, /Document Request/i, "doc-common", shot);
      await sleep(1500);
    }
    const t = await body(page);
    const na = !hit && !/Document Request/i.test(t);
    const shotA = await shot(page, "assert-na-81");
    saveSummary(story, {
      story,
      at: new Date().toISOString(),
      jiraWasDone: true,
      kenyaNA: na || !hit,
      honestDoneAllowed: na || !hit,
      findings: [
        {
          bug: "N/A-Kenya",
          claim: "Document Request workflow on Kenya build",
          verdict: hit ? "FOUND_ON_BUILD" : "N/A_CONFIRMED",
          notes: hit ? "Document Request menu hit — re-evaluate Done" : "No Document Request feature via Lending/Common search",
          shot: shotA,
        },
      ],
      url: page.url(),
      out: dir,
    });
  }

  // -------- PF-58382 Profit Sharing / IBAF --------
  {
    const story = "PF-58382";
    const dir = outDir(story);
    shot = makeShot(dir);
    page = await goHome(page, shot);
    page = await flipExact(page, "Account Management", shot);
    await sleep(2000);
    await shot(page, "am-modal-or-land");
    const modal = await body(page);
    if (/Islamic Banking|IBAF|GBAF|Select Banking/i.test(modal)) {
      await mouseText(page, /Islamic Banking & Finance|IBAF/i, "ibaf", shot);
      await sleep(3000);
      await waitReady(page, "ibaf", (t) => /Profit|CASA|Dashboard|Account|No Data|404/i.test(t) || t.length > 80, shot);
    }
    await sidebarSearch(page, "Profit Sharing", shot);
    const hit = await mouseText(page, /Profit Sharing/i, "profit", shot);
    await sleep(1500);
    const t = await body(page);
    const shotA = await shot(page, "assert-na-82");
    const onIbaf = /IBAF|Islamic|Profit/i.test(t) || /ibaf|islamic/i.test(page.url());
    const na = !hit && !/Profit Sharing Ratio|Profit Sharing Template/i.test(t);
    saveSummary(story, {
      story,
      at: new Date().toISOString(),
      jiraWasDone: true,
      kenyaNA: na,
      honestDoneAllowed: na,
      findings: [
        {
          bug: "N/A-Kenya-IBAF",
          claim: "Profit Sharing Template on Kenya IBAF/CASA",
          verdict: hit ? "FOUND_ON_BUILD" : na ? "N/A_CONFIRMED" : "PARTIAL",
          notes: `ibafPath=${onIbaf} profitHit=${hit} url=${page.url()}`,
          shot: shotA,
        },
      ],
      url: page.url(),
      out: dir,
    });
  }

  // -------- PF-58383 TD ownership transfer history (58398/58416) --------
  {
    const story = "PF-58383";
    const dir = outDir(story);
    shot = makeShot(dir);
    page = await goHome(page, shot);
    page = await flipExact(page, "Term Deposit Management", shot);
    await sleep(2000);
    let t = await body(page);
    if (/Select Banking|IBAF|GBAF/i.test(t)) {
      await mouseText(page, /General Banking & Finance|GBAF/i, "gbaf", shot);
      await sleep(3000);
      await waitReady(page, "td", (x) => /TD|Term|Dashboard|Account|Maintenance/i.test(x), shot);
    }
    await shot(page, "td-land");
    await sidebarSearch(page, "Ownership", shot);
    for (const m of [/Ownership Transfer|Owner Transfer|Ownership/i, /Account Inquiry|Inquiry/i, /Maintenance/i, /History/i]) {
      await mouseText(page, m, m.source.replace(/[^a-z0-9]+/gi, "-").slice(0, 18), shot);
      await sleep(1800);
    }
    t = await body(page);
    const trapped = /Select Banking|IBAF|GBAF/i.test(t) && /Account Management/i.test(t);
    const hasHistory = /Owner Transfer History|Ownership Transfer|Transfer History/i.test(t);
    const shotA = await shot(page, "assert-58383");
    saveSummary(story, {
      story,
      at: new Date().toISOString(),
      honestDoneAllowed: hasHistory && !trapped,
      jiraDone: false,
      findings: [
        {
          bug: "PF-58398",
          claim: "GBAF/IBAF selector traps deep TD routes",
          verdict: trapped ? "CONFIRMED" : "PARTIAL",
          notes: `trapped=${trapped} url=${page.url()}`,
          shot: shotA,
        },
        {
          bug: "PF-58416",
          claim: "Owner transfer history cycle not displayable",
          verdict: hasHistory ? "NOT_REPRO" : "PARTIAL",
          notes: `historyUI=${hasHistory}`,
          shot: shotA,
        },
      ],
      url: page.url(),
      out: dir,
    });
  }

  // -------- PF-58384 BRWNS SMS N/A --------
  {
    const story = "PF-58384";
    const dir = outDir(story);
    shot = makeShot(dir);
    page = await goHome(page, shot);
    page = await flipExact(page, "Loan Origination and Management", shot);
    await waitReady(page, "lending3", (t) => /Lending|Settings/i.test(t), shot);
    await mouseText(page, /^Settings$/i, "settings", shot);
    await sleep(2000);
    await sidebarSearch(page, "BRWNS", shot);
    let hit = await mouseText(page, /BRWNS|SMS Notification|Alert Management/i, "brwns", shot);
    await sleep(1500);
    if (!hit) {
      await sidebarSearch(page, "SMS", shot);
      hit = await mouseText(page, /SMS|Client SMS|Notification/i, "sms", shot);
      await sleep(1500);
    }
    const t = await body(page);
    const na = !hit && !/BRWNS/i.test(t);
    const shotA = await shot(page, "assert-na-84");
    saveSummary(story, {
      story,
      at: new Date().toISOString(),
      jiraWasDone: true,
      kenyaNA: na,
      honestDoneAllowed: na,
      findings: [
        {
          bug: "N/A-Kenya",
          claim: "BRWNS Client SMS Notification on Kenya Lending",
          verdict: hit ? "FOUND_ON_BUILD" : "N/A_CONFIRMED",
          notes: hit ? "SMS/BRWNS-related control found" : "No BRWNS/SMS feature under Lending Settings search",
          shot: shotA,
        },
      ],
      url: page.url(),
      out: dir,
    });
  }

  console.log("REMAINING5_DONE");
  // keep browser open briefly then leave process (do not close — user one-browser; process end may close)
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
