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
  rule:
    "LOCKED. The pipeline still runs in order, but Round 1, Round 2, and GUI tests never run silently inside it. When any user runs QAFusionX on their device, a separate browser window must open on that device and show every screen, popup, and click.",
};

export function visibleBrowserStatus() {
  return {
    ...VISIBLE_BROWSER_LOCK,
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
2. Round 1, Round 2, and GUI suite execution happen **inside that window**.
3. The user watches every navigation, popup, and click.
4. Headless / silent / hidden webview / API-only substitutes are **forbidden**.

\`QAFUSIONX_HEADED=0\` is rejected. There is no silent mode.
`;
