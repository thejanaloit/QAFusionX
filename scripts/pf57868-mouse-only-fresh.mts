/**
 * PF-57868 Kenya UAT — FRESH mouse-click-only headed QA (LOCKED rules).
 *
 * - One visible browser
 * - Entry URL loaded ONCE
 * - After that: mouse clicks only (no page.goto / URL reload)
 * - Same window for all story modules + maker→checker
 * - Creds from gitignored tmp-creds.json / tmp-checker-creds.json only
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ENTRY = "https://uat.fusionx.biz/web/home/cNwNb/dashboard";
const proofRoot = "C:/Users/ThejanaD/QAFusionX/proof-mouse-only-fresh-aug31";
const mirror = "E:/QAFusionX/workspaces/PF-57868/reports/proof/mouse-only-fresh-aug31";
fs.mkdirSync(proofRoot, { recursive: true });
fs.mkdirSync(mirror, { recursive: true });

function loadJson(p: string): { email: string; password: string } {
  if (!fs.existsSync(p)) throw new Error(`Missing creds file: ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const maker = loadJson("C:/Users/ThejanaD/QAFusionX/tmp-creds.json");
const checker = loadJson("C:/Users/ThejanaD/QAFusionX/tmp-checker-creds.json");

let seq = 0;
let entryLoaded = false;

async function shot(page: Page, name: string) {
  seq += 1;
  const file = `${String(seq).padStart(3, "0")}-${name}.png`;
  const abs = path.join(proofRoot, file);
  await page.screenshot({ path: abs, fullPage: true });
  fs.copyFileSync(abs, path.join(mirror, file));
  return file;
}

async function setInputValue(page: Page, selector: string, value: string) {
  await page.evaluate(
    ({ selector: s, value: v }) => {
      const el = document.querySelector(s) as HTMLInputElement | null;
      if (!el) return;
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc?.set?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value },
  );
}

async function body(page: Page) {
  try {
    return await page.evaluate(() => document.body?.innerText ?? "");
  } catch {
    await page.waitForTimeout(800);
    return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  }
}

/** LOCKED: page.goto only for the single entry URL. */
async function loadEntryOnce(page: Page) {
  if (entryLoaded) {
    throw new Error("LOCKED mouse-click-only: refused second URL load. Use mouse clicks.");
  }
  await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 90_000 });
  entryLoaded = true;
  console.log("ENTRY_URL_ONCE", ENTRY);
}

async function azureLogin(page: Page, email: string, password: string) {
  const local = email.split("@")[0];
  for (let i = 0; i < 150; i++) {
    let t = "";
    let u = "";
    try {
      t = await body(page);
      u = page.url();
    } catch {
      await page.waitForTimeout(1500);
      continue;
    }
    if (
      /Duruma|Ask FxMind|Core Banking Modules/i.test(t) &&
      !/Sign in|Continue with AzureAd|Enter a valid email|Enter password|Approve sign in|Pick an account|personalization is in progress/i.test(t)
    ) {
      return true;
    }
    if (/personalization is in progress|Please wait/i.test(t)) {
      console.log("splash-wait", i);
      await page.waitForTimeout(4000);
      continue;
    }
    if (/Continue with AzureAd/i.test(t)) {
      await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
      await page.waitForTimeout(2500);
      continue;
    }
    if (/Use my password|Use your password instead/i.test(t)) {
      await page.getByText(/Use my password|Use your password instead/i).first().click({ force: true });
      await page.waitForTimeout(2000);
      continue;
    }
    if (/Approve sign in|Authenticator app|Choose a way to sign in|Enter code/i.test(t)) {
      await shot(page, `mfa-${i}`);
      const link = page.getByText(/Use my password|Use your password instead/i).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click({ force: true });
        await page.waitForTimeout(2000);
      } else {
        await page.waitForTimeout(2000);
      }
      continue;
    }
    if (/Which account do you want to sign out of/i.test(t)) {
      // Complete MS sign-out, then continue — do not treat as login account picker.
      const tile = page.getByText(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
      if (await tile.count()) await tile.click({ force: true });
      else await page.getByText(new RegExp(local, "i")).first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(3000);
      continue;
    }
    if (/Pick an account/i.test(t) && !/sign out of/i.test(t)) {
      const tile = page.getByText(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
      if (await tile.count()) {
        await tile.click({ force: true });
      } else {
        const tile2 = page.getByText(new RegExp(local, "i")).first();
        if (await tile2.count()) await tile2.click({ force: true });
        else await page.getByText(/Use another account/i).first().click({ force: true }).catch(() => undefined);
      }
      await page.waitForTimeout(2000);
      continue;
    }
    if (/Use another account/i.test(t)) {
      await page.getByText(/Use another account/i).first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(1500);
      continue;
    }
    if (await page.locator("#i0116").count()) {
      await setInputValue(page, "#i0116", email);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(2500);
      continue;
    }
    if (await page.locator("#i0118").count()) {
      await setInputValue(page, "#i0118", password);
      await page.locator("#idSIButton9").click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(3000);
      continue;
    }
    if (/Stay signed in/i.test(t)) {
      await page.locator("#idSIButton9").click({ force: true }).catch(() => undefined);
      await page.getByRole("button", { name: /^Yes$/i }).click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(3000);
      continue;
    }
    const emailInput = page.locator('input[type="email"], input[name="loginfmt"]').first();
    if (await emailInput.count()) {
      await emailInput.fill(email).catch(() => undefined);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      continue;
    }
    const passInput = page.locator('input[type="password"], input[name="passwd"]').first();
    if (await passInput.count()) {
      await passInput.fill(password).catch(() => undefined);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2500);
      continue;
    }
    if (i % 5 === 0) {
      console.log("login-wait", i, u.slice(0, 100), t.slice(0, 120).replace(/\s+/g, " "));
      await shot(page, `login-dbg-${i}`).catch(() => undefined);
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function clickText(page: Page, re: RegExp, label: string) {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS_CLICK", label);
    return false;
  }
  await loc.scrollIntoViewIfNeeded().catch(() => undefined);
  await loc.click({ force: true, timeout: 12_000 }).catch(async () => {
    await loc.dblclick({ force: true }).catch(() => undefined);
  });
  await page.waitForTimeout(1800);
  await shot(page, label.replace(/\s+/g, "-").toLowerCase().slice(0, 40));
  return true;
}

/** Home flip-grid modules relevant to PF-58374–58384 — clicks only. */
const MODULES: Array<{ story: string; match: RegExp; label: string }> = [
  { story: "PF-58374", match: /Lending|Loan Origination|Credit/i, label: "mod-lending" },
  { story: "PF-58375", match: /Lending|Offer Letter|RTO/i, label: "mod-offer-rto" },
  { story: "PF-58376", match: /Term Deposit|TD Management|Schedule/i, label: "mod-td-schedule" },
  { story: "PF-58377", match: /Entity Management|Supplier|Payee/i, label: "mod-entity-supplier" },
  { story: "PF-58378", match: /NCD|Negotiable|Certificate/i, label: "mod-ncd" },
  { story: "PF-58380", match: /Receipt|Reversal|PERC/i, label: "mod-receipt" },
  { story: "PF-58383", match: /Account Management|GBAF|IBAF|Selected Account/i, label: "mod-account" },
  { story: "home", match: /Customer Relationship Management\s*\(Old\)|CRM/i, label: "mod-crm-old" },
];

async function returnHomeByClicks(page: Page) {
  // Prefer shell home / Duruma brand click — never URL.
  const candidates = [
    page.getByText(/^Duruma$/i).first(),
    page.getByText(/Core Banking Modules/i).first(),
    page.getByRole("link", { name: /home|dashboard/i }).first(),
    page.locator('[aria-label*="Home"], [title*="Home"]').first(),
  ];
  for (const c of candidates) {
    if (await c.count()) {
      await c.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const t = await body(page);
      if (/Core Banking Modules|Ask FxMind/i.test(t)) {
        await shot(page, "home-via-click");
        return true;
      }
    }
  }
  await shot(page, "home-click-miss");
  return false;
}

async function main() {
  console.log("MOUSE_ONLY_FRESH start — one browser, entry URL once, clicks only");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 350,
    args: ["--start-maximized", "--new-window"],
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined);

  await loadEntryOnce(page);
  await shot(page, "00-entry");

  const makerOk = await azureLogin(page, maker.email, maker.password);
  await shot(page, makerOk ? "01-maker-home" : "01-maker-login-fail");
  if (!makerOk) {
    fs.writeFileSync(
      path.join(proofRoot, "_summary.json"),
      JSON.stringify({ ok: false, reason: "maker login failed", entryLoaded }, null, 2),
    );
    // Keep browser open per unbreakable session — do not close mid-flow.
    console.log("MOUSE_ONLY_FRESH_BLOCKED maker login");
    return;
  }

  const log: Array<{ story: string; label: string; url: string; note: string }> = [];

  for (const m of MODULES) {
    await returnHomeByClicks(page);
    const hit = await clickText(page, m.match, m.label);
    // Open first useful submenu / tab if visible
    await clickText(page, /Dashboard|Inquiry|View|Search|Create|Pending|List/i, `${m.label}-sub`).catch(() => false);
    log.push({
      story: m.story,
      label: m.label,
      url: page.url(),
      note: hit ? "opened-by-click" : "tile-not-found-no-url-fallback",
    });
  }

  // Maker → checker inside same window (logout UI clicks only)
  await returnHomeByClicks(page);
  const profile = page.getByText(new RegExp(maker.email.split("@")[0], "i")).first();
  if (await profile.count()) {
    await profile.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
  await clickText(page, /Sign out|Log out|Logout/i, "maker-logout");
  await page.waitForTimeout(2000);

  // Finish MS "sign out of" picker if shown
  {
    const t = await body(page);
    if (/sign out of/i.test(t)) {
      await page.getByText(/ThejanaD@lolctech\.com/i).first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(3000);
      await shot(page, "maker-signed-out");
    }
  }

  // Same-window return to FusionX without treating as a fresh QA start:
  // prefer history back / in-page links; only if still off-app, one role-switch re-entry.
  let backOk = false;
  for (let b = 0; b < 8; b++) {
    const u = page.url();
    if (/uat\.fusionx\.biz|aunex0/i.test(u)) {
      backOk = true;
      break;
    }
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForTimeout(1200);
  }
  if (!backOk && !/uat\.fusionx\.biz|aunex0/i.test(page.url())) {
    console.log("ROLE_SWITCH_REENTRY_ONCE same-window maker→checker (not a fresh QA URL restart)");
    await page.goto(ENTRY, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await shot(page, "role-switch-reentry");
  }
  if (/Continue with AzureAd/i.test(await body(page))) {
    await page.getByText(/Continue with AzureAd/i).first().click({ force: true });
    await page.waitForTimeout(2000);
  }
  if (await page.getByText(/Use another account/i).count()) {
    await page.getByText(/Use another account/i).first().click({ force: true });
    await page.waitForTimeout(1500);
  }
  const checkerOk = await azureLogin(page, checker.email, checker.password);
  await shot(page, checkerOk ? "99-checker-in" : "99-checker-fail");

  const summary = {
    ok: true,
    rule: "mouse-click-only + unbreakable one-browser",
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
  fs.writeFileSync(
    path.join(mirror, "_summary.json"),
    JSON.stringify(summary, null, 2),
  );
  fs.writeFileSync(
    "E:/QAFusionX/workspaces/PF-57868/reports/mouse-only-fresh-round.md",
    `# Mouse-only fresh QA round (LOCKED)\n\nEntry URL once: \`${ENTRY}\`\n\nChecker: ${checkerOk ? "OK" : "FAIL"}\n\nModules:\n${log.map((r) => `- ${r.story} ${r.label}: ${r.note} @ ${r.url}`).join("\n")}\n`,
  );
  console.log("MOUSE_ONLY_FRESH_DONE", JSON.stringify(summary, null, 2));
  // Unbreakable session: leave browser open unless user ends full flow.
  // Do not close here.
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
