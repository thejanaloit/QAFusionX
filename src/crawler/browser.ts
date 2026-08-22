import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { bus } from "../events.ts";
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

export async function getPage(): Promise<Page> {
  if (page && !page.isClosed()) return page;
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  const videoDir = abs(path.join("reports", "video"));
  fs.mkdirSync(videoDir, { recursive: true });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir },
  });
  page = await context.newPage();
  return page;
}

export async function closeBrowser(): Promise<void> {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  browser = null;
  context = null;
  page = null;
}

export async function openTarget(url: string): Promise<{ url: string; title: string }> {
  const p = await getPage();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await p.waitForTimeout(400);
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

export async function clickControl(index: number): Promise<{ url: string; title: string; popupOpened: boolean }> {
  const p = await getPage();
  const beforeUrl = p.url();
  const dialogBefore = await p.locator('[role="dialog"], [data-slot="dialog-content"]').count();
  const locator = p
    .locator(
      'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [data-testid]',
    )
    .locator("visible=true");
  await locator.nth(index).click({ timeout: 8_000 });
  await p.waitForTimeout(500);
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
