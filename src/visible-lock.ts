/**
 * LOCKED RULE — not optional, not an env toggle.
 *
 * QAFusionX is a sequential pipeline, but crawl + GUI tests are NEVER
 * a silent in-pipeline job. On every user's own device a separate
 * browser window must open and show every navigation and click.
 */
export const VISIBLE_BROWSER_LOCK = {
  locked: true as const,
  headlessAllowed: false as const,
  mode: "separate-window-on-user-device" as const,
  unbreakableSession: true as const,
  mouseClickOnlyNav: true as const,
  rule:
    "LOCKED. The pipeline still runs in order, but Round 1, Round 2, and GUI tests never run silently inside it. When any user runs QAFusionX on their device, a separate browser window must open on that device and show every screen, popup, and click. ONE window only — never close/reopen mid-flow; navigate in the same session through Round 1 → Round 2 → suite → maker/checker. After the entry URL loads ONCE, NEVER reload / type / page.goto another URL — reach every screen by mouse clicks only in that same window.",
};

/**
 * LOCKED — mouse-click-only navigation after the single entry URL.
 * Cannot be skipped, weakened, or bypassed with deep-link gotos.
 */
export const MOUSE_CLICK_ONLY_NAV_LOCK = {
  locked: true as const,
  entryUrlLoadsAllowed: 1 as const,
  subsequentUrlNavAllowed: false as const,
  rule:
    "LOCKED. Open one browser. Load the entry URL at most once. After that, do not freshly start, do not page.goto, do not type another URL into the address bar, and do not deep-link. The entire QA flow (Round 1/2, every story, maker→checker) must advance only by mouse clicks (and typing into on-page fields). Sinhala: browser එකක් / URL එකක් වරක් open කළාම ආයෙ URL වලින් load කරන්න බෑ — mouse click වලින් විතරක් flow යන්න.",
};

export function assertMouseClickOnlyNav(action: string): void {
  throw new Error(
    `LOCKED RULE (mouse-click-only nav): refused "${action}". Entry URL already loaded (or would bypass the single-entry rule). Reach screens only by mouse clicks in the same visible browser. Never freshly restart via URL.`,
  );
}

export function visibleBrowserStatus() {
  return {
    ...VISIBLE_BROWSER_LOCK,
    mouseClickOnlyNav: MOUSE_CLICK_ONLY_NAV_LOCK,
    headed: true,
    envForcedHeaded: true,
  };
}

export function assertVisibleBrowserLock(): void {
  const raw = (process.env.QAFUSIONX_HEADED ?? "1").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "silent" || raw === "headless") {
    throw new Error(
      "LOCKED RULE: the visible browser cannot be turned off. Unset QAFUSIONX_HEADED or set it to 1. QAFusionX must open a separate browser window on this user's device — never headless, never a silent pipeline step.",
    );
  }
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error(
      "LOCKED RULE: this machine has no display. Run QAFusionX on the user's own device so a separate browser window can open there. Do not continue headless and do not hide the crawl inside the pipeline.",
    );
  }
}

export const VISIBLE_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--start-maximized",
  "--new-window",
] as const;

export const VISIBLE_BROWSER_LOCK_MARKDOWN = `# LOCKED — visible browser on every user's device

This rule cannot be skipped, toggled, or replaced by a silent pipeline job.

QAFusionX is a sequential pipeline. That does **not** mean crawl or GUI tests run in the background.

When QAFusionX runs on a user's machine:

1. A **separate real browser window** opens on **that user's device**.
2. Round 1, Round 2, and GUI suite execution happen **inside that same window**.
3. The user watches every navigation, popup, and click.
4. Headless / silent / hidden webview / API-only substitutes are **forbidden**.
5. **UNBREAKABLE SESSION:** do not close the browser between stories, rounds, or maker→checker. Keep one window open; navigate inside it. Close only at end-of-flow.
6. **MOUSE-CLICK-ONLY NAV (LOCKED):** load the entry URL **once**. After that, **never** \`page.goto\` / address-bar URL / deep-link reload. Full QA must move only by **mouse clicks** through the UI.

\`QAFUSIONX_HEADED=0\` is rejected. There is no silent mode.
`;
