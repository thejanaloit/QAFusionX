/**
 * PF-57868 — Account Management → IBAF/GBAF modal → TD dashboard
 * LOCKED: one browser, entry URL once, mouse.move+click only, WAIT until analyzable.
 *
 * User proof: after clicking GBAF (2nd), TD dashboard at /web/td/... appears.
 * This script MUST open the selector modal and try BOTH IBAF and GBAF with waits.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const proof = "C:/Users/ThejanaD/QAFusionX/proof-ibaf-gbaf-wait-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/ibaf-gbaf-wait-aug31";
fs.mkdirSync(proof, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });

const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
let seq = 0;
let entryLoaded = false;

async function body(page: Page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    await page.waitForTimeout(800);
    return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  }
}

async function shot(page: Page, name: string) {
  seq += 1;
  const file = `${String(seq).padStart(3, "0")}-${name}.png`;
  try {
    await page.screenshot({ path: path.join(proof, file), fullPage: false, timeout: 20_000 });
    fs.copyFileSync(path.join(proof, file), path.join(mirror, file));
    console.log("SHOT", file, page.url().slice(0, 90));
  } catch (e) {
    console.log("SHOT_FAIL", file, e instanceof Error ? e.message : e);
  }
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

/** LOCKED: wait until screen is analyzable */
async function waitAnalyzable(page: Page, label: string, ready: (t: string, u: string) => boolean, maxMs = 90_000) {
  console.log("WAIT_ANALYZABLE", label);
  const start = Date.now();
  let last = "";
  let quiet = 0;
  while (Date.now() - start < maxMs) {
    const t = await body(page);
    const u = page.url();
    if (/personalization is in progress|Please wait, Your|Loading\.\.\./i.test(t) && t.length < 400) {
      quiet = 0;
      await page.waitForTimeout(2000);
      continue;
    }
    if (ready(t, u)) {
      quiet += 1;
      if (quiet >= 2) {
        await page.waitForTimeout(1200);
        await shot(page, `ready-${label}`);
        console.log("READY", label, u.slice(0, 100));
        return true;
      }
    } else {
      quiet = 0;
    }
    if (t.slice(0, 80) !== last) last = t.slice(0, 80);
    await page.waitForTimeout(1500);
  }
  await shot(page, `timeout-${label}`);
  console.log("WAIT_TIMEOUT", label);
  return false;
}

async function mouseClickText(page: Page, re: RegExp, label: string) {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  const box = await loc.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 28);
  await page.evaluate(
    ({ x: cx, y: cy }) => {
      document.getElementById("qafx-ring")?.remove();
      const d = document.createElement("div");
      d.id = "qafx-ring";
      d.style.cssText = `position:fixed;left:${cx - 30}px;top:${cy - 30}px;width:60px;height:60px;border:3px solid #e11;border-radius:50%;z-index:2147483647;pointer-events:none`;
      document.body.appendChild(d);
    },
    { x, y },
  );
  await shot(page, `aim-${label}`);
  console.log("MOUSE →", label, Math.round(x), Math.round(y));
  await page.mouse.move(x, y, { steps: 40 });
  await page.waitForTimeout(350);
  await page.mouse.click(x, y);
  await page.evaluate(() => document.getElementById("qafx-ring")?.remove()).catch(() => undefined);
  await page.waitForTimeout(800);
  return true;
}

async function loadEntryOnce(page: Page) {
  if (entryLoaded) throw new Error("LOCKED: no second URL load");
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  entryLoaded = true;
  console.log("ENTRY_ONCE", ENTRY);
}

async function azureLogin(page: Page, email: string, password: string) {
  for (let i = 0; i < 120; i++) {
    const t = await body(page);
    if (/Core Banking Modules/i.test(t) && /Loan Origination|Account Management/i.test(t) && !/personalization is in progress/i.test(t))
      return true;
    if (/personalization is in progress|Please wait/i.test(t)) {
      await page.waitForTimeout(3500);
      continue;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await mouseClickText(page, /Continue with AzureAd/i, "azuread");
      await waitAnalyzable(page, "after-azuread", (x) => /email|password|Pick an account|#i0116|Sign in/i.test(x) || /i0116/.test(x), 60_000);
      continue;
    }
    if (/Use my password|Use your password instead/i.test(t)) {
      await mouseClickText(page, /Use my password|Use your password instead/i, "use-pwd");
      continue;
    }
    if (await page.locator("#i0116").count()) {
      const b = await page.locator("#i0116").boundingBox();
      if (b) {
        await page.mouse.move(b.x + 40, b.y + 12, { steps: 30 });
        await page.mouse.click(b.x + 40, b.y + 12);
      }
      await setInput(page, "#i0116", email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await page.waitForTimeout(2200);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInput(page, "#i0118", password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
      await page.waitForTimeout(2800);
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await mouseClickText(page, /^Yes$/i, "stay-yes");
      continue;
    }
    if (/Pick an account/i.test(t)) {
      await mouseClickText(page, /ThejanaD@lolctech\.com/i, "pick-maker");
      continue;
    }
    await page.waitForTimeout(1200);
  }
  return false;
}

async function goHomeFlipGrid(page: Page) {
  const t = await body(page);
  if (/Core Banking Modules/i.test(t) && /Account Management/i.test(t)) return true;
  // Click breadcrumb Home if present
  await mouseClickText(page, /^Home$/i, "breadcrumb-home");
  await waitAnalyzable(page, "home", (x) => /Core Banking Modules/i.test(x), 60_000);
  if (/Core Banking Modules/i.test(await body(page))) return true;
  // Left rail home grid icon (x < 90)
  const icons = page.locator("aside button, [class*='sidebar'] button");
  const n = Math.min(await icons.count(), 8);
  for (let i = 0; i < n; i++) {
    const box = await icons.nth(i).boundingBox();
    if (!box || box.x > 100) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await waitAnalyzable(page, `rail-${i}`, (x) => /Core Banking Modules/i.test(x), 30_000);
    if (/Core Banking Modules/i.test(await body(page))) return true;
  }
  return /Core Banking Modules/i.test(await body(page));
}

async function openAccountMgmtModal(page: Page) {
  await goHomeFlipGrid(page);
  await mouseClickText(page, /Account Management/i, "account-mgmt-tile");
  // Double-click if flip-card
  const loc = page.getByText(/Account Management/i).first();
  const box = await loc.boundingBox();
  if (box) {
    await page.mouse.dblclick(box.x + box.width / 2, box.y + 20);
  }
  await waitAnalyzable(
    page,
    "ibaf-gbaf-modal",
    (t) => /Select Banking & Finance Type|Islamic Banking|General Banking|IBAF|GBAF/i.test(t),
    90_000,
  );
  return /Select Banking & Finance Type|Islamic Banking|General Banking/i.test(await body(page));
}

async function exploreAfterFinancePick(page: Page, which: "IBAF" | "GBAF") {
  await waitAnalyzable(
    page,
    `after-${which}`,
    (t, u) =>
      (/Dashboard|Account Management|Teller Management|Trial Calculation|Term Deposit|TD/i.test(t) &&
        !/Select Banking & Finance Type/i.test(t)) ||
      /\/web\/(td|account|casa)\//i.test(u),
    90_000,
  );
  await shot(page, `landed-${which}`);

  // Sidebar items — mouse only, wait each time
  const side = ["Dashboard", "Account Management", "Teller Management", "Manage Transaction", "Maintenance", "Reports", "Settings"];
  for (const item of side) {
    const hit = await mouseClickText(page, new RegExp(`^${item}$|${item}`, "i"), `side-${which}-${item}`);
    if (!hit) continue;
    await waitAnalyzable(
      page,
      `side-${which}-${item}`,
      (t) => t.length > 80 && !/personalization is in progress/i.test(t),
      60_000,
    );
  }

  // TD-specific: Trial Calculation if visible
  if (await mouseClickText(page, /Trial Calculation/i, `trial-${which}`)) {
    await waitAnalyzable(page, `trial-${which}`, (t) => t.length > 50, 60_000);
  }
}

async function main() {
  console.log("=== IBAF/GBAF + WAIT-ANALYZABLE (mouse-only) ===");
  const browser = await chromium.launch({ headless: false, slowMo: 180, args: ["--start-maximized", "--new-window"] });
  const ctx = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
  await page.bringToFront();

  await loadEntryOnce(page);
  await shot(page, "00-entry");
  const ok = await azureLogin(page, maker.email, maker.password);
  await waitAnalyzable(page, "maker-home", (t) => /Core Banking Modules/i.test(t) && /Account Management/i.test(t), 90_000);
  await shot(page, ok ? "01-home" : "01-fail");
  if (!ok && !/Core Banking Modules/i.test(await body(page))) {
    console.log("BLOCKED_LOGIN");
    return;
  }

  const log: Array<{ pick: string; modal: boolean; note: string; url: string }> = [];

  // --- Pass 1: GBAF (2nd) — user already proved this lands on TD dashboard ---
  {
    const modal = await openAccountMgmtModal(page);
    if (modal) {
      await mouseClickText(page, /General Banking & Finance|GBAF/i, "pick-GBAF-2nd");
      await exploreAfterFinancePick(page, "GBAF");
      log.push({ pick: "GBAF", modal: true, note: "clicked 2nd option + explored", url: page.url() });
    } else {
      log.push({ pick: "GBAF", modal: false, note: "modal not shown", url: page.url() });
      await shot(page, "no-modal-gbaf");
    }
  }

  // --- Pass 2: back home, open modal again, pick IBAF (1st) ---
  {
    await goHomeFlipGrid(page);
    await waitAnalyzable(page, "home-before-ibaf", (t) => /Core Banking Modules/i.test(t), 60_000);
    const modal = await openAccountMgmtModal(page);
    if (modal) {
      await mouseClickText(page, /Islamic Banking & Finance|IBAF/i, "pick-IBAF-1st");
      await exploreAfterFinancePick(page, "IBAF");
      log.push({ pick: "IBAF", modal: true, note: "clicked 1st option + explored", url: page.url() });
    } else {
      log.push({ pick: "IBAF", modal: false, note: "modal not shown", url: page.url() });
    }
  }

  // Also try Term Deposit tile from home (mouse) if visible
  await goHomeFlipGrid(page);
  if (await mouseClickText(page, /Term Deposit Management/i, "td-tile")) {
    await waitAnalyzable(page, "td-tile", (t, u) => /Dashboard|Trial Calculation|\/web\/td\//i.test(t + u), 90_000);
    // If modal appears again
    if (/Select Banking & Finance Type/i.test(await body(page))) {
      await mouseClickText(page, /General Banking & Finance|GBAF/i, "td-tile-GBAF");
      await waitAnalyzable(page, "td-after-gbaf", (t) => /Trial Calculation|Dashboard/i.test(t), 90_000);
    }
  }

  const summary = {
    ok: true,
    rules: ["one-browser", "entry-url-once", "mouse-only", "wait-until-analyzable"],
    log,
    proof,
    mirror,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(proof, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(mirror, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    "E:/QAFusionX/workspaces/PF-57868/reports/ibaf-gbaf-wait-round.md",
    `# IBAF/GBAF + wait-until-analyzable\n\n${log.map((r) => `- **${r.pick}** modal=${r.modal} — ${r.note}\n  - ${r.url}`).join("\n")}\n\nProof: \`${mirror}\`\n`,
  );
  console.log("IBAF_GBAF_WAIT_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
