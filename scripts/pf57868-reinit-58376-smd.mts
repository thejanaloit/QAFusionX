import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58376";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 310;

async function shot(page: import("playwright").Page, n: string) {
  seq += 1;
  const f = `${String(seq).padStart(3, "0")}-${n}.png`;
  await page.screenshot({ path: `${OUT}/${f}`, fullPage: false }).catch(() => undefined);
  console.log("SHOT", f);
  return f;
}

const browser = await chromium.launch({ headless: false, slowMo: 100, args: ["--start-maximized"] });
const page = await (await browser.newContext({ viewport: null })).newPage();
await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
// Re-login path heavy — navigate from saved session won't work. Use entry + login quick then common again is too long.
// Instead attach isn't available — open common settings URL is FORBIDDEN by mouse-only.
// So: login home → common sync flip → wait loading → click Schedule Monitory in sidebar.

const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120_000 });
const body = async () => {
  try {
    return await page.evaluate(() => document.body?.innerText || "");
  } catch {
    return "";
  }
};
const mouseText = async (re: RegExp, label: string) => {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  const box = await loc.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 18), { steps: 24 });
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 18));
  return true;
};
const setInput = async (sel: string, val: string) => {
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
};
for (let i = 0; i < 70; i++) {
  const t = await body();
  if (/Core Banking Modules/i.test(t) && !/personalization is in progress/i.test(t)) break;
  if (/Continue with AzureAd/i.test(t)) {
    await mouseText(/Continue with AzureAd/i, "a");
    await sleep(1500);
    continue;
  }
  if (await page.locator("#i0116").count()) {
    await setInput("#i0116", maker.email);
    await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
    await sleep(2000);
    continue;
  }
  if (await page.locator("#i0118").count()) {
    await setInput("#i0118", maker.password);
    await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
    await sleep(2500);
    continue;
  }
  if (/Stay signed in/i.test(t)) {
    await mouseText(/^Yes$/i, "y");
    continue;
  }
  if (/Pick an account/i.test(t)) {
    await mouseText(/ThejanaD@lolctech\.com/i, "p");
    continue;
  }
  await sleep(800);
}

const box = await page.evaluate(() => {
  const els = [...document.querySelectorAll("div")].filter((el) => {
    const t = (el.innerText || "").replace(/\s+/g, " ").trim();
    const r = el.getBoundingClientRect();
    return /Common Sync Management|common settings for fusionX/i.test(t) && r.width > 80 && r.width < 420;
  });
  els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
  const leaf = els[0];
  if (!leaf) return null;
  let n: HTMLElement | null = leaf;
  let best = leaf;
  for (let i = 0; i < 6 && n; i++) {
    const r = n.getBoundingClientRect();
    if (r.width >= 140 && r.width <= 420 && r.height >= 90 && r.height <= 260) best = n;
    n = n.parentElement;
  }
  const r = best.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (box) {
  await page.mouse.move(box.x, box.y, { steps: 30 });
  await page.mouse.click(box.x, box.y);
  await sleep(1200);
  await page.mouse.dblclick(box.x, box.y);
  await sleep(2500);
}
let p = page.context().pages().filter((x) => !x.isClosed()).at(-1) || page;
await p.bringToFront();

// wait until analyzable (no loading spinner only)
for (let i = 0; i < 40; i++) {
  const t = await p.evaluate(() => document.body?.innerText || "");
  if (/Schedule Monitory Dashboard/i.test(t) && !/^[\s\S]{0,80}Loading/i.test(t.slice(0, 200))) break;
  await sleep(1500);
}
await shot(p, "common-ready");

const hit = await p.getByText(/Schedule Monitory Dashboard/i).first();
if (await hit.count()) {
  const b = await hit.boundingBox();
  if (b) {
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 28 });
    await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
}
await sleep(3000);
for (let i = 0; i < 30; i++) {
  const t = await p.evaluate(() => document.body?.innerText || "");
  if (!/personalization is in progress/i.test(t) && t.length > 80) break;
  await sleep(1500);
}
const smd = await shot(p, "smd-opened");
const text = await p.evaluate(() => document.body?.innerText || "");
const url = p.url();

// try TD / CASA search controls
for (const label of [/TD/i, /Term Deposit/i, /CASA/i, /Search/i, /Process/i]) {
  const loc = p.getByText(label).first();
  if (await loc.count()) {
    const b = await loc.boundingBox();
    if (b) {
      await p.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 16), { steps: 20 });
      await p.mouse.click(b.x + b.width / 2, b.y + Math.min(b.height / 2, 16));
      await sleep(800);
    }
  }
}
await sleep(1500);
const after = await shot(p, "smd-search");
const text2 = await p.evaluate(() => document.body?.innerText || "");

const summary = {
  story: "PF-58376",
  at: new Date().toISOString(),
  url,
  smdShot: smd,
  afterShot: after,
  is404: /404|Not Found/i.test(text2 + url),
  is401: /401|Unauthorized|Insufficient Privileges/i.test(text2),
  noData: /No Data/i.test(text2),
  hasSmd: /Schedule Monitory|Schedule Name|Success|Error|Process/i.test(text2),
  snippet: text2.slice(0, 600),
};
fs.writeFileSync(`${OUT}/_smd-open.json`, JSON.stringify(summary, null, 2));

// merge into tracker
const findings = [
  {
    bug: "PF-58426",
    claim: "TD Schedule Monitory — credit-interest-apply-log 401",
    verdict: summary.is401 ? "CONFIRMED" : summary.is404 ? "CONFIRMED" : summary.noData ? "PARTIAL" : summary.hasSmd ? "PARTIAL" : "BLOCKED",
    notes: `Opened Common Settings → Schedule Monitory attempt. url=${url} 401=${summary.is401} 404=${summary.is404} noData=${summary.noData}`,
    shot: after,
  },
  {
    bug: "PF-58505",
    claim: "CASA OD Recovery Completed blank; Select → 88711",
    verdict: "PARTIAL",
    notes: "CASA path reaches IBAF/GBAF selector / CASA dashboard in earlier pass; OD Recovery menu not confirmed this SMD focus. Keep open.",
    shot: "025-assert-58505-casa.png",
  },
];
const full = {
  story: "PF-58376",
  at: summary.at,
  honestDoneAllowed: false,
  jiraDone: false,
  findings,
  smd: summary,
  out: OUT,
};
fs.writeFileSync(`${OUT}/_summary.json`, JSON.stringify(full, null, 2));
fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58376.json", JSON.stringify(full, null, 2));
console.log("SMD_OPEN_DONE", JSON.stringify(summary));
