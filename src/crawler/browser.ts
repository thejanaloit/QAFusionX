import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { bus } from "../events.ts";
import {
  assertMouseClickOnlyNav,
  assertVisibleBrowserLock,
  MOUSE_CLICK_ONLY_NAV_LOCK,
  VISIBLE_LAUNCH_ARGS,
} from "../visible-lock.ts";
import { loadState } from "../workflow/engine.ts";
import { abs, DIRS, ensureDir, writeFile } from "../workflow/paths.ts";
import type { ScreenNode, WorkflowState } from "../workflow/types.ts";

export interface InteractiveControl {
  index: number;
  tag: string;
  type: string | null;
  text: string;
  href: string | null;
  id: string | null;
  name: string | null;
  aria: string | null;
  testId: string | null;
  placeholder: string | null;
  role: string | null;
  disabled: boolean;
  kind: "button" | "link" | "field" | "tab" | "other";
}

export interface CaptureResult {
  node: ScreenNode;
  controls: InteractiveControl[];
  screenshotAbs: string;
}

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
/** LOCKED: entry URL may load once per unbreakable session; then mouse clicks only. */
let entryUrlLoaded = false;

export function mouseClickOnlyNavStatus() {
  return { ...MOUSE_CLICK_ONLY_NAV_LOCK, entryUrlLoaded };
}

/**
 * LOCKED entry navigation. First call may page.goto. Any later call throws.
 * Prefer this over raw page.goto everywhere in the engine.
 */
export async function gotoEntryUrlOnce(
  p: Page,
  url: string,
  opts?: { waitUntil?: "domcontentloaded" | "load" | "networkidle"; timeout?: number },
): Promise<void> {
  if (entryUrlLoaded) {
    assertMouseClickOnlyNav(`page.goto(${url})`);
  }
  await p.goto(url, {
    waitUntil: opts?.waitUntil ?? "domcontentloaded",
    timeout: opts?.timeout ?? 45_000,
  });
  entryUrlLoaded = true;
  bus.emitEvent(
    "browser:entry-url",
    `LOCKED: entry URL loaded once (${url}). From now on — mouse clicks only. No further URL navigation.`,
  );
}

export function headedEnabled(): boolean {
  assertVisibleBrowserLock();
  return true;
}

/** True when the same headed window is still alive (unbreakable session). */
export function browserSessionAlive(): boolean {
  return Boolean(browser?.isConnected() && page && !page.isClosed());
}

export async function getPage(): Promise<Page> {
  if (browserSessionAlive()) return page!;
  return openVisibleBrowser();
}

/** Cookie jar from the live headed context (for authenticated API probes). */
export async function getContextCookies(): Promise<
  Array<{ name: string; value: string; domain?: string; path?: string }>
> {
  if (!context) return [];
  return context.cookies();
}

/**
 * LOCKED — unbreakable one-browser session.
 * Reuses the existing headed window if still open. Never closes mid-flow
 * just to "open again". Launch only when no live session exists.
 */
export async function openVisibleBrowser(): Promise<Page> {
  assertVisibleBrowserLock();
  if (browserSessionAlive()) {
    bus.emitEvent(
      "browser:reuse",
      "LOCKED: reusing the same visible browser window — do not close/reopen mid-flow.",
    );
    return page!;
  }
  // Stale handles (window crashed / user closed) — clear without treating as mid-flow close
  if (browser || context || page) {
    await closeBrowser({ reason: "stale-session-recovery" });
  }
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 400,
      args: [...VISIBLE_LAUNCH_ARGS],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `LOCKED RULE: could not open a separate visible browser on this device (${detail}). Run QAFusionX on the user's computer so a real window can appear. Do not fall back to headless.`,
    );
  }
  bus.emitEvent(
    "browser:launch",
    "LOCKED: opened ONE separate visible browser window on this user's device. Keep this window open for Round 1 → Round 2 → suite → checker. Never close mid-flow.",
  );
  const videoDir = abs(path.join("reports", "video"));
  fs.mkdirSync(videoDir, { recursive: true });
  context = await browser.newContext({
    viewport: null,
    recordVideo: { dir: videoDir },
  });
  page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined);
  return page;
}

/**
 * END-OF-FLOW ONLY. Do not call between stories, rounds, or maker→checker.
 * Mid-flow close breaks the unbreakable one-browser rule.
 */
export async function closeBrowser(opts?: { reason?: string; force?: boolean }): Promise<void> {
  const reason = opts?.reason ?? "end-of-flow";
  if (!opts?.force && reason !== "end-of-flow" && reason !== "stale-session-recovery" && reason !== "workflow-reset") {
    bus.emitEvent(
      "browser:close-blocked",
      `LOCKED: refused browser close (${reason}). Keep the same window open until the full QA flow finishes.`,
    );
    return;
  }
  bus.emitEvent("browser:close", `Closing visible browser (${reason}).`);
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  browser = null;
  context = null;
  page = null;
  entryUrlLoaded = false;
}

/**
 * LOCKED: entry URL once in the SAME open window — never relaunch, never second goto.
 * After entry, crawl must advance only via clickControl / on-page UI.
 */
export async function openTarget(url: string): Promise<{ url: string; title: string }> {
  const p = await getPage();
  if (entryUrlLoaded) {
    bus.emitEvent(
      "browser:url-blocked",
      `LOCKED mouse-click-only: refused openTarget(${url}). Already on ${p.url()}. Use mouse clicks.`,
    );
    return { url: p.url(), title: await p.title() };
  }
  await gotoEntryUrlOnce(p, url);
  await p.waitForTimeout(900);
  return { url: p.url(), title: await p.title() };
}

async function extractControls(p: Page): Promise<InteractiveControl[]> {
  const script = `(() => {
    const nodes = Array.from(document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [data-testid]'
    ));
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width + rect.height > 0;
    };
    return nodes.filter(visible).map((el, index) => {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      const type = el.getAttribute("type");
      let kind = "other";
      if (tag === "button" || role === "button" || type === "submit" || type === "button") kind = "button";
      else if (tag === "a" || role === "link") kind = "link";
      else if (role === "tab") kind = "tab";
      else if (tag === "input" || tag === "select" || tag === "textarea") kind = "field";
      const text = (el.innerText || el.getAttribute("value") || "").trim().replace(/\\s+/g, " ").slice(0, 120);
      return {
        index,
        tag,
        type,
        text,
        href: el.getAttribute("href"),
        id: el.id || null,
        name: el.getAttribute("name"),
        aria: el.getAttribute("aria-label"),
        testId: el.getAttribute("data-testid"),
        placeholder: el.getAttribute("placeholder"),
        role,
        disabled: el.disabled === true,
        kind
      };
    });
  })()`;
  return (await p.evaluate(script)) as InteractiveControl[];
}

function roundDirs(round: 1 | 2) {
  if (round === 1) {
    return {
      shots: DIRS.roundOneScreenshots,
      refs: DIRS.roundOneReferences,
    };
  }
  return {
    shots: DIRS.roundTwoScreenshots,
    refs: DIRS.roundTwoReferences,
  };
}

export async function captureScreen(state: WorkflowState, round: 1 | 2, opts?: {
  parentId?: string;
  clickedControl?: string;
  isPopup?: boolean;
}): Promise<CaptureResult> {
  const p = await getPage();
  await p.waitForTimeout(250);
  const dirs = roundDirs(round);
  ensureDir(dirs.shots);
  ensureDir(dirs.refs);

  const seq = state.screens.filter((s) => s.round === round).length + 1;
  const slug = `${String(seq).padStart(3, "0")}`;
  const pngRel = path.join(dirs.shots, `${slug}.png`);
  const pngAbs = abs(pngRel);
  await p.screenshot({ path: pngAbs, fullPage: true });

  const controls = await extractControls(p);
  const buttons = controls
    .filter((c) => c.kind !== "field")
    .map((c) => {
      const label = c.aria || c.text || c.testId || c.id || c.href || `${c.tag}#${c.index}`;
      return `[${c.kind}] ${label}${c.disabled ? " (disabled)" : ""}`;
    });

  const node: ScreenNode = {
    id: `r${round}-${slug}`,
    round,
    seq,
    url: p.url(),
    title: await p.title(),
    screenshotRel: pngRel,
    referenceRel: path.join(dirs.refs, `${slug}.md`),
    parentId: opts?.parentId,
    clickedControl: opts?.clickedControl,
    buttons,
    pendingControls: buttons.filter((b) => !b.includes("(disabled)")),
    visitedControls: opts?.clickedControl ? [opts.clickedControl] : [],
    isPopup: opts?.isPopup ?? (await p.locator('[role="dialog"], [data-slot="dialog-content"]').count()) > 0,
  };

  state.screens.push(node);
  bus.emitEvent("crawl:capture", `Captured ${node.id} — ${node.title}`, {
    data: { url: node.url, screenshot: pngRel, buttons: buttons.length },
  });

  return { node, controls, screenshotAbs: pngAbs };
}

export function writeReferenceMd(
  node: ScreenNode,
  controls: InteractiveControl[],
  analysis: string,
): string {
  const body = `# ${node.id} — ${node.title}

- **Round:** ${node.round}
- **URL:** ${node.url}
- **Popup / dialog:** ${node.isPopup ? "yes" : "no"}
- **Parent:** ${node.parentId ?? "—"}
- **Clicked to arrive:** ${node.clickedControl ?? "entry"}
- **Screenshot:** \`${node.screenshotRel}\`

## Operator analysis
${analysis.trim() || "_Pending high-end reasoning pass. Fill this after reading the PNG._"}

## Every interactive control
${controls
  .map((c) => {
    const label = c.aria || c.text || c.placeholder || c.testId || c.name || c.id || "(unlabelled)";
    return `- **${c.kind}** \`${label}\` — tag=${c.tag} type=${c.type ?? "—"} href=${c.href ?? "—"} testid=${c.testId ?? "—"} disabled=${c.disabled}`;
  })
  .join("\n") || "- none detected"}

## Reachable screens from here
${node.pendingControls.map((b) => `- via ${b}`).join("\n") || "- none (terminal or unparsed)"}

## Decision
Choose the first unvisited actionable control unless a user-story path must be forced. After the click, capture immediately, including any popup that appears.
`;
  writeFile(node.referenceRel, body);
  return node.referenceRel;
}

/** Canonical CRM OLD / COB destination for PF-57868 (never Cash/ATM/home tiles). */
export const FUSIONX_COB_ONBOARDING_PATH = "/web/comn-react-module-cob/cNwNb/onboarding";

/** Account Management shell (PF-58142 Account Opening / cross-branch subsequent accounts). */
export const FUSIONX_ACCOUNT_MODULE_PATH = "/web/casa/cNwNb/dashboard";

/** Active crawl scope from recorded project (Ask Q1). */
export function crawlScope(): "cob" | "account" {
  try {
    const p = loadState().project;
    const blob = `${p?.parent ?? ""} ${p?.name ?? ""} ${p?.whatToTest ?? ""}`.toLowerCase();
    if (/pf-58142|account opening|cross-branch|subsequent account|account management/.test(blob)) {
      return "account";
    }
  } catch {
    // fall through
  }
  return "cob";
}

/**
 * Wrong-module URLs that mislead the headed browser (seen: Cash & Teller tab
 * becomes active while COB opens in a sibling tab). Detect by path, not tile label.
 * Account scope allows /web/account; COB scope forbids it.
 */
export function forbiddenModuleUrl(): RegExp {
  if (crawlScope() === "account") {
    return /\/web\/(cash|atm|loan|yard|smartcore|term[-_]?deposit|collateral|entity|incentive|legal|recovery|design[-_]?studio|user[-_]?access|common[-_]?sync|comn-react-module-cob)\b/i;
  }
  return /\/web\/(cash|atm|loan|account|yard|smartcore|term[-_]?deposit|collateral|entity|incentive|legal|recovery|design[-_]?studio|user[-_]?access|common[-_]?sync)\b/i;
}

/** @deprecated use forbiddenModuleUrl() — kept for suite imports */
export const FUSIONX_FORBIDDEN_MODULE_URL =
  /\/web\/(cash|atm|loan|account|yard|smartcore|term[-_]?deposit|collateral|entity|incentive|legal|recovery|design[-_]?studio|user[-_]?access|common[-_]?sync)\b/i;

/** Known FusionX home flip-cards that only flip — open the real module URL. */
const FUSIONX_FLIP_CARD_ROUTES: Array<{ match: RegExp; path: string }> = [
  {
    match: /customer relationship management\s*\(old\)/i,
    path: FUSIONX_COB_ONBOARDING_PATH,
  },
  {
    match: /search customer|start onboarding/i,
    path: "/web/comn-react-module-cob/cNwNb/onboarding/new",
  },
  {
    match: /account management/i,
    path: FUSIONX_ACCOUNT_MODULE_PATH,
  },
];

/** Never open these home tiles during the active programme scope. */
function forbiddenTiles(): RegExp {
  if (crawlScope() === "account") {
    return /cash and transaction|atm and payment|loan origination|yard management|smartcore|term deposit management|incentive management|legal affairs|recovery management|entity management|collateral|design studio|user access|common sync|smart customer onboarding|customer relationship management/i;
  }
  return /cash and transaction|atm and payment|account management|loan origination|yard management|smartcore|term deposit management|incentive management|legal affairs|recovery management|entity management|collateral|design studio|user access|common sync|smart customer onboarding/i;
}

/**
 * Force the active Playwright page onto COB onboarding via MOUSE CLICKS only.
 * LOCKED: never page.goto after entry URL. Prefer an already-open COB tab, else
 * click Home / CRM OLD tiles. URL deep-links are forbidden.
 */
export async function ensureCobDestination(p: Page): Promise<{ recovered: boolean; fromUrl: string; toUrl: string }> {
  const fromUrl = p.url();
  // PF-58142 Account Opening: never force COB — stay on Account Management surfaces.
  if (crawlScope() === "account") {
    return { recovered: false, fromUrl, toUrl: fromUrl };
  }
  const forbidden = forbiddenModuleUrl();

  // Prefer an already-open COB tab in this context (bring to front + reuse).
  const ctx = p.context();
  for (const other of ctx.pages()) {
    if (other.isClosed()) continue;
    const u = other.url();
    if (u.includes("comn-react-module-cob") && !forbidden.test(u)) {
      await other.bringToFront().catch(() => undefined);
      page = other;
      return { recovered: other !== p || forbidden.test(fromUrl), fromUrl, toUrl: other.url() };
    }
  }

  const needsForce =
    forbidden.test(fromUrl) ||
    /\/web\/home\//i.test(fromUrl) ||
    (!fromUrl.includes("comn-react-module-cob") && /fusionx\.biz/i.test(fromUrl) && !/aunex0|microsoftonline/i.test(fromUrl));

  if (needsForce) {
    bus.emitEvent(
      "browser:recover",
      `Wrong/off-scope surface (${fromUrl}). LOCKED mouse-only: clicking Home/CRM tiles — no URL goto.`,
    );
    // Try Duruma / home chrome then CRM OLD flip-card — clicks only.
    const homeClick = p.getByText(/Duruma|Ask FxMind|Core Banking Modules/i).first();
    if (await homeClick.count()) {
      await homeClick.click({ force: true }).catch(() => undefined);
      await p.waitForTimeout(800);
    }
    const crm = p.getByText(/Customer Relationship Management\s*\(Old\)|CRM\s*\(Old\)/i).first();
    if (await crm.count()) {
      await crm.click({ force: true }).catch(() => undefined);
      await p.waitForTimeout(1500);
      await crm.dblclick({ force: true }).catch(() => undefined);
      await p.waitForTimeout(1200);
    }
    for (const other of ctx.pages()) {
      if (other.isClosed()) continue;
      if (other.url().includes("comn-react-module-cob") && !forbidden.test(other.url())) {
        await other.bringToFront().catch(() => undefined);
        page = other;
        return { recovered: true, fromUrl, toUrl: other.url() };
      }
    }
    bus.emitEvent(
      "browser:recover-blocked",
      `LOCKED mouse-only: could not reach COB by clicks from ${fromUrl}. Refused page.goto. Continue clicking UI.`,
    );
    return { recovered: false, fromUrl, toUrl: p.url() };
  }

  return { recovered: false, fromUrl, toUrl: p.url() };
}

async function maybeOpenFlipCardModule(p: Page, label: string, beforeUrl: string): Promise<boolean> {
  if (forbiddenTiles().test(label)) {
    throw new Error(`Blocked wrong module click for ${crawlScope()} scope: ${label}`);
  }
  const route = FUSIONX_FLIP_CARD_ROUTES.find((r) => r.match.test(label));
  if (!route) return false;
  // LOCKED mouse-only: flip-cards must open via further clicks, never page.goto deep-links.
  if (p.url() !== beforeUrl) return true;
  bus.emitEvent(
    "browser:flip-no-goto",
    `LOCKED mouse-only: flip-card "${label}" did not change URL. Refused goto(${route.path}). Keep clicking UI.`,
  );
  // Retry click/dblclick on the same label — still no URL navigation.
  const loc = p.getByText(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first();
  if (await loc.count()) {
    await loc.dblclick({ force: true }).catch(() => undefined);
    await p.waitForTimeout(1200);
  }
  return p.url() !== beforeUrl;
}

async function clickCobDashboardTile(p: Page, label: string): Promise<boolean> {
  if (!/^(FACILITIES|CUSTOMER SEARCH)$/i.test(label.trim())) return false;
  const before = await p.locator("text=/Search Customer/i").count();
  const ok = await p.evaluate((labelText) => {
    const want = labelText.trim().toUpperCase();
    // Prefer leaf-ish nodes whose visible label is exactly the tile title.
    const candidates = Array.from(document.querySelectorAll("div, button, section, span, p, a")).filter((el) => {
      const kids = Array.from(el.children);
      const ownText = (el.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
      // Tile text is short: "FACILITIES" or "FACILITIES >" etc.
      if (!(ownText === want || ownText === `${want} >` || ownText === `${want}>` || ownText.startsWith(`${want} `) && ownText.length < want.length + 8)) {
        return false;
      }
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width >= 70 && r.height >= 36 && r.height <= 160 && r.top > 80;
    }) as HTMLElement[];
    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    });
    const target = candidates[0];
    if (!target) return false;
    let node: HTMLElement | null = target;
    for (let i = 0; i < 5 && node; i++) {
      const r = node.getBoundingClientRect();
      if (r.height >= 48 && r.height <= 180 && r.width >= 90 && r.width <= 360) {
        node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        return true;
      }
      node = node.parentElement;
    }
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  }, label);
  if (!ok) return false;
  await p.waitForTimeout(900);
  if (/FACILITIES/i.test(label)) {
    const after = await p.locator("text=/Search Customer/i").count();
    const selected = await p.locator("text=/Select one or more facilities/i").count();
    return after > before || selected > 0;
  }
  return true;
}

export async function clickControl(
  index: number,
  label?: string,
): Promise<{ url: string; title: string; popupOpened: boolean }> {
  const p = await getPage();
  const beforeUrl = p.url();
  const dialogBefore = await p.locator('[role="dialog"], [data-slot="dialog-content"]').count();
  if (label?.trim()) {
    const text = label.trim();
    if (await clickCobDashboardTile(p, text)) {
      await p.waitForTimeout(1200);
      await maybeOpenFlipCardModule(p, text, beforeUrl);
      if (forbiddenModuleUrl().test(p.url())) {
        await ensureCobDestination(p);
        throw new Error(
          `Blocked wrong-module navigation after tile click: forbidden URL. Recovered to in-scope module.`,
        );
      }
      const dialogAfterTile = await p.locator('[role="dialog"], [data-slot="dialog-content"]').count();
      return {
        url: p.url(),
        title: await p.title(),
        popupOpened: dialogAfterTile > dialogBefore || (p.url() === beforeUrl && dialogAfterTile > 0),
      };
    }
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const candidates = [
      p.getByRole("link", { name: new RegExp(escaped, "i") }),
      p.getByRole("button", { name: new RegExp(escaped, "i") }),
      p.locator("a[href]").filter({ hasText: new RegExp(escaped, "i") }),
      p.locator("button").filter({ hasText: new RegExp(escaped, "i") }),
      p.locator("p, span, h3, h4, a, div").filter({ hasText: new RegExp(escaped, "i") }),
      p.getByText(text, { exact: false }),
      p.locator(`[title="${text}"]`),
    ];
    let clicked = false;
    for (const loc of candidates) {
      const count = await loc.count();
      for (let i = 0; i < Math.min(count, 8); i++) {
        const target = loc.nth(i);
        const box = await target.boundingBox().catch(() => null);
        if (!box || box.width < 8 || box.height < 8) continue;
        try {
          await target.scrollIntoViewIfNeeded().catch(() => undefined);
          await target.click({ timeout: 8_000 });
          await p.waitForTimeout(400);
          if (p.url() === beforeUrl) {
            await target.dblclick({ timeout: 8_000 }).catch(() => undefined);
          }
          clicked = true;
          break;
        } catch {
          try {
            await target.click({ timeout: 8_000, force: true });
            clicked = true;
            break;
          } catch {
            // try next match
          }
        }
      }
      if (clicked) break;
    }
    if (!clicked) {
      clicked = await p.evaluate((labelText) => {
        const needle = labelText.toLowerCase();
        const card = Array.from(document.querySelectorAll(".flip-card, [class*='module-card'], [class*='flip-card']")).find(
          (el) => (el.textContent ?? "").toLowerCase().includes(needle),
        ) as HTMLElement | undefined;
        if (card) {
          card.scrollIntoView({ block: "center" });
          card.click();
          return true;
        }
        const match = Array.from(document.querySelectorAll("a, button, [role='button'], [role='link'], [role='menuitem']")).find(
          (el) => (el.textContent ?? "").toLowerCase().replace(/\s+/g, " ").includes(needle),
        ) as HTMLElement | undefined;
        if (!match) return false;
        match.scrollIntoView({ block: "center" });
        match.click();
        return true;
      }, text);
    }
    if (!clicked) {
      // Known COB deep-links (Search Customer / Start Onboarding) when the control is not in the a11y tree.
      clicked = await maybeOpenFlipCardModule(p, text, beforeUrl);
    }
    if (!clicked) {
      throw new Error(`Could not find clickable control matching label: ${text}`);
    }
    await p.waitForTimeout(1200);
    // Flip-cards only flip — open the known CRM OLD / COB module URL in-session.
    await maybeOpenFlipCardModule(p, text, beforeUrl);
  } else {
    const locator = p.locator(
      'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [data-testid]',
    );
    await locator.nth(index).click({ timeout: 8_000, force: true });
  }
  await p.waitForTimeout(800);
  // Hard stop: if Cash/ATM/etc. became the active page, reclaim COB immediately.
  if (forbiddenModuleUrl().test(p.url())) {
    const recover = await ensureCobDestination(p);
    throw new Error(
      `Blocked wrong-module navigation for ${crawlScope()} scope: landed on ${recover.fromUrl}; recovered to ${recover.toUrl}.`,
    );
  }
  const dialogAfter = await p.locator('[role="dialog"], [data-slot="dialog-content"]').count();
  return {
    url: p.url(),
    title: await p.title(),
    popupOpened: dialogAfter > dialogBefore || (p.url() === beforeUrl && dialogAfter > 0),
  };
}

export async function fillField(locator: string, value: string): Promise<void> {
  const p = await getPage();
  await p.locator(locator).first().fill(value);
}

export function livingPlanMarkdown(state: WorkflowState, round: 1 | 2): string {
  const nodes = state.screens.filter((s) => s.round === round);
  const pending = nodes.flatMap((n) => n.pendingControls.map((c) => ({ screen: n.id, control: c })));
  return `# Round ${round} living plan

Updated: ${new Date().toISOString()}

This file is rewritten after every capture. It is the source of truth for remaining navigation.

## Coverage
- Screens captured: ${nodes.length}
- Popups captured: ${nodes.filter((n) => n.isPopup).length}
- Pending controls: ${pending.length}

## Visited screens
${nodes
  .map(
    (n) =>
      `- [${n.id}] ${n.title} — ${n.url}${n.isPopup ? " (popup)" : ""}\n  - arrived via: ${n.clickedControl ?? "entry"}\n  - buttons: ${n.buttons.length}\n  - pending: ${n.pendingControls.length}`,
  )
  .join("\n") || "- none yet"}

## Todo — remaining clicks
${pending.map((p, i) => `- [ ] ${i + 1}. On ${p.screen}, click ${p.control}`).join("\n") || "- [x] No pending in-app controls recorded."}

## Decision rule
Always pick the first unchecked todo unless it leaves the product origin. After the click, capture, refer, update this file, then continue.

## End condition
Round ${round} ends only when every listed control is visited, dismissed as off-product, or explicitly marked blocked with a reason.
`;
}

export function writeLivingPlan(state: WorkflowState, round: 1 | 2): void {
  const dir = round === 1 ? DIRS.roundOnePlan : DIRS.roundTwoPlan;
  const plan = livingPlanMarkdown(state, round);
  writeFile(path.join(dir, "living-plan.md"), plan);
  const nodes = state.screens.filter((s) => s.round === round);
  const pending = nodes.flatMap((n) => n.pendingControls);
  const todo = `# Round ${round} todo

- Captured screens: ${nodes.length}
- Remaining controls: ${pending.length}

${pending.map((c, i) => `- [ ] ${i + 1}. ${c}`).join("\n") || "- [x] Round navigation complete"}
`;
  writeFile(path.join(dir, "todo.md"), todo);
}

export function screenshotExists(rel: string): boolean {
  return fs.existsSync(abs(rel));
}
