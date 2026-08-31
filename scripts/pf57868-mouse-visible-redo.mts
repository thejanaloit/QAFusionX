/**
 * PF-57868 — VISIBLE mouse-only QA (from initial).
 * LOCKED: one headed browser, entry URL ONCE, then real mouse.move + click only.
 * User must see the Chrome for Testing window — cursor moves slowly to every control.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const proofRoot = "C:/Users/ThejanaD/QAFusionX/proof-mouse-visible-redo-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/mouse-visible-redo-aug31";
fs.mkdirSync(proofRoot, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });

function loadJson(p: string): { email: string; password: string } {
  if (!fs.existsSync(p)) throw new Error(`Missing creds: ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
const maker = loadJson("C:/Users/ThejanaD/QAFusionX/tmp-creds.json");
const checker = loadJson("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json");

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
  const abs = path.join(proofRoot, file);
  await page.screenshot({ path: abs, fullPage: false });
  fs.copyFileSync(abs, path.join(mirror, file));
  console.log("SHOT", file);
  return file;
}

async function setInputValue(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { state: "attached", timeout: 25000 }).catch(() => undefined);
  await page.evaluate(
    ({ selector: s, value: v }) => {
      const el = document.querySelector(s) as HTMLInputElement | null;
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      el.focus();
      if (setter) setter.call(el, v);
      else el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value },
  );
}

/** VISIBLE mouse: move cursor in many steps, then click. No URL. */
async function mouseClickAt(page: Page, x: number, y: number, label: string) {
  console.log("MOUSE_MOVE →", label, Math.round(x), Math.round(y));
  await page.mouse.move(x, y, { steps: 48 });
  await page.waitForTimeout(400);
  await page.mouse.click(x, y);
  await page.waitForTimeout(1600);
  await shot(page, `click-${label}`.replace(/[^a-z0-9-]+/gi, "-").slice(0, 48));
}

async function mouseClickText(page: Page, re: RegExp, label: string): Promise<boolean> {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(500);
  const box = await loc.boundingBox();
  if (!box) {
    console.log("NO_BOX", label);
    return false;
  }
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 24);
  // Red ring so human sees the target
  await page.evaluate(
    ({ x: cx, y: cy }) => {
      const d = document.createElement("div");
      d.id = "qafx-mouse-ring";
      d.style.cssText = `position:fixed;left:${cx - 28}px;top:${cy - 28}px;width:56px;height:56px;border:3px solid #e11;border-radius:50%;pointer-events:none;z-index:2147483647;box-shadow:0 0 0 4px rgba(255,0,0,.25)`;
      document.getElementById("qafx-mouse-ring")?.remove();
      document.body.appendChild(d);
    },
    { x, y },
  );
  await shot(page, `aim-${label}`.replace(/[^a-z0-9-]+/gi, "-").slice(0, 40));
  await mouseClickAt(page, x, y, label);
  await page.evaluate(() => document.getElementById("qafx-mouse-ring")?.remove()).catch(() => undefined);
  return true;
}

async function loadEntryOnce(page: Page) {
  if (entryLoaded) throw new Error("LOCKED: second URL load forbidden — mouse only after entry");
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 120_000 });
  entryLoaded = true;
  console.log("ENTRY_URL_ONCE_ONLY", ENTRY);
}

async function azureLogin(page: Page, email: string, password: string) {
  const local = email.split("@")[0];
  for (let i = 0; i < 160; i++) {
    let t = "";
    try {
      t = await body(page);
    } catch {
      await page.waitForTimeout(1500);
      continue;
    }
    if (
      /Core Banking Modules|Account Management|Loan Origination/i.test(t) &&
      !/Sign in|Continue with AzureAd|Enter password|Approve sign in|Pick an account|personalization is in progress/i.test(t)
    ) {
      return true;
    }
    if (/personalization is in progress|Please wait/i.test(t)) {
      console.log("splash-wait", i);
      await page.waitForTimeout(4000);
      continue;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await mouseClickText(page, /Continue with AzureAd/i, "azuread");
      continue;
    }
    if (/Use my password|Use your password instead/i.test(t)) {
      await mouseClickText(page, /Use my password|Use your password instead/i, "use-password");
      continue;
    }
    if (/Which account do you want to sign out of/i.test(t)) {
      await mouseClickText(page, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "signout-account");
      continue;
    }
    if (/Pick an account/i.test(t)) {
      const hit =
        (await mouseClickText(page, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "pick-email")) ||
        (await mouseClickText(page, new RegExp(local, "i"), "pick-local")) ||
        (await mouseClickText(page, /Use another account/i, "other-account"));
      if (!hit) await page.waitForTimeout(1500);
      continue;
    }
    if (await page.locator("#i0116").count()) {
      const box = await page.locator("#i0116").boundingBox();
      if (box) await mouseClickAt(page, box.x + 40, box.y + 12, "email-field");
      await setInputValue(page, "#i0116", email);
      await page.waitForTimeout(400);
      const next = await page.locator("#idSIButton9").boundingBox();
      if (next) await mouseClickAt(page, next.x + next.width / 2, next.y + next.height / 2, "next-email");
      else await page.keyboard.press("Enter");
      await page.waitForTimeout(2200);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      const box = await page.locator("#i0118").boundingBox();
      if (box) await mouseClickAt(page, box.x + 40, box.y + 12, "pass-field");
      await setInputValue(page, "#i0118", password);
      await page.waitForTimeout(400);
      const next = await page.locator("#idSIButton9").boundingBox();
      if (next) await mouseClickAt(page, next.x + next.width / 2, next.y + next.height / 2, "next-pass");
      else await page.keyboard.press("Enter");
      await page.waitForTimeout(2800);
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await mouseClickText(page, /^Yes$/i, "stay-yes");
      continue;
    }
    if (i % 8 === 0) {
      console.log("login-wait", i, page.url().slice(0, 90), t.slice(0, 80).replace(/\s+/g, " "));
      await shot(page, `login-dbg-${i}`);
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function returnHomeMouse(page: Page) {
  // Sidebar home (first icon area) then Core Banking text
  const side = page.locator("aside button, [class*='side'] button, nav button").first();
  if (await side.count()) {
    const box = await side.boundingBox();
    if (box) {
      await mouseClickAt(page, box.x + box.width / 2, box.y + box.height / 2, "sidebar-home");
      if (/Core Banking Modules/i.test(await body(page))) return true;
    }
  }
  if (await mouseClickText(page, /Core Banking Modules/i, "core-banking-label")) return true;
  // Click near FusionX logo / top-left
  await mouseClickAt(page, 48, 28, "top-left-logo");
  await page.waitForTimeout(1200);
  return /Core Banking Modules|Account Management/i.test(await body(page));
}

const TILES: Array<{ story: string; text: string; label: string; deep: string[] }> = [
  {
    story: "PF-58374",
    text: "Loan Origination and Management",
    label: "loan-origination",
    deep: ["PERC", "Product", "Inquiry", "View", "Search"],
  },
  {
    story: "PF-58375",
    text: "Loan Origination and Management",
    label: "offer-via-lending",
    deep: ["Offer", "RTO", "Print", "Template", "Document"],
  },
  {
    story: "PF-58376",
    text: "Term Deposit Management",
    label: "term-deposit",
    deep: ["Schedule", "Apply Interest", "Inquiry", "Search"],
  },
  {
    story: "PF-58377",
    text: "Entity Management",
    label: "entity",
    deep: ["Entity Creation", "Supplier", "Payee", "Pending", "Create"],
  },
  {
    story: "PF-58378",
    text: "Term Deposit Management",
    label: "ncd-via-td",
    deep: ["NCD", "Value Date", "Certificate", "Inquiry"],
  },
  {
    story: "PF-58380",
    text: "Loan Origination and Management",
    label: "receipt-via-lending",
    deep: ["Receipt", "Reversal", "PERC"],
  },
  {
    story: "PF-58383",
    text: "Account Management",
    label: "account",
    deep: ["Manage Selected", "Inquiry", "Search", "GBAF", "IBAF"],
  },
  {
    story: "CRM",
    text: "Customer Relationship Management (OLD)",
    label: "crm-old",
    deep: ["FACILITIES", "CUSTOMER SEARCH", "Search Customer", "Onboarding"],
  },
];

async function main() {
  console.log("=== VISIBLE MOUSE-ONLY REDO FROM INITIAL ===");
  console.log("WATCH the Chrome for Testing window — red ring + slow cursor moves");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 220,
    args: ["--start-maximized", "--new-window"],
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);

  // Bring to front
  await page.bringToFront();
  await loadEntryOnce(page);
  await shot(page, "00-entry-once");

  const makerOk = await azureLogin(page, maker.email, maker.password);
  await shot(page, makerOk ? "01-maker-home" : "01-maker-fail");
  if (!makerOk) {
    fs.writeFileSync(path.join(proofRoot, "_summary.json"), JSON.stringify({ ok: false, reason: "maker login" }, null, 2));
    console.log("MOUSE_VISIBLE_BLOCKED maker");
    return;
  }

  const log: Array<{ story: string; label: string; url: string; note: string }> = [];

  for (const tile of TILES) {
    await returnHomeMouse(page);
    await page.waitForTimeout(800);
    // Prefer exact tile text; double-open with mouse
    let opened = await mouseClickText(page, new RegExp(tile.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), tile.label);
    if (opened) {
      // Second click / dbl via mouse on same target
      const loc = page.getByText(new RegExp(tile.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
      const box = await loc.boundingBox();
      if (box) {
        await mouseClickAt(page, box.x + box.width / 2, box.y + 20, `${tile.label}-2nd`);
        await page.mouse.dblclick(box.x + box.width / 2, box.y + 20);
        await page.waitForTimeout(2000);
        await shot(page, `${tile.label}-after-dbl`);
      }
    }
    let deepHit = "";
    for (const d of tile.deep) {
      if (await mouseClickText(page, new RegExp(d, "i"), `${tile.label}-${d}`)) {
        deepHit = d;
        break;
      }
    }
    log.push({
      story: tile.story,
      label: tile.label,
      url: page.url(),
      note: opened ? `mouse-opened; deep=${deepHit || "none"}` : "tile-miss-no-url",
    });
  }

  // Maker → checker same window
  await returnHomeMouse(page);
  await mouseClickText(page, /ThejanaD@lolctech\.com/i, "profile");
  await mouseClickText(page, /Sign out|Log out|Logout/i, "logout");
  await page.waitForTimeout(2000);
  {
    const t = await body(page);
    if (/sign out of/i.test(t)) {
      await mouseClickText(page, /ThejanaD@lolctech\.com/i, "confirm-signout");
      await page.waitForTimeout(2500);
    }
  }
  // Prefer history back (not fresh QA restart)
  for (let b = 0; b < 8; b++) {
    if (/uat\.fusionx\.biz|aunex0/i.test(page.url())) break;
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForTimeout(1000);
  }
  if (!/uat\.fusionx\.biz|aunex0|microsoftonline/i.test(page.url())) {
    console.log("ROLE_SWITCH_REENTRY_ONCE (maker→checker only)");
    await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await shot(page, "role-switch-once");
  }
  if (/Continue with AzureAd/i.test(await body(page))) {
    await mouseClickText(page, /Continue with AzureAd/i, "azuread-checker");
  }
  if (/Use another account/i.test(await body(page))) {
    await mouseClickText(page, /Use another account/i, "other-for-checker");
  }
  const checkerOk = await azureLogin(page, checker.email, checker.password);
  await shot(page, checkerOk ? "99-checker-ok" : "99-checker-fail");

  const summary = {
    ok: true,
    mode: "VISIBLE mouse.move + click only after single entry URL",
    entryUrl: ENTRY,
    entryLoadedOnce: entryLoaded,
    maker: maker.email,
    checker: checker.email,
    checkerOk,
    modules: log,
    proofDir: proofRoot,
    mirror,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(proofRoot, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(mirror, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    "E:/QAFusionX/workspaces/PF-57868/reports/mouse-visible-redo.md",
    `# Visible mouse-only redo (from initial)\n\nEntry URL **once**. Then **mouse.move (48 steps) + click** only. Red aim rings on screenshots.\n\nChecker: ${checkerOk ? "OK" : "FAIL"}\n\n${log.map((r) => `- ${r.story} ${r.label}: ${r.note}`).join("\n")}\n\nProof: \`${mirror}\`\n`,
  );
  console.log("MOUSE_VISIBLE_DONE", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
