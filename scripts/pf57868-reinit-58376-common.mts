import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58376";
fs.mkdirSync(OUT, { recursive: true });
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 300;

async function shot(page: import("playwright").Page, n: string) {
  seq += 1;
  const f = `${String(seq).padStart(3, "0")}-${n}.png`;
  await page.screenshot({ path: `${OUT}/${f}`, fullPage: false }).catch(() => undefined);
  console.log("SHOT", f);
  return f;
}
async function body(page: import("playwright").Page) {
  try {
    return await page.evaluate(() => document.body?.innerText || "");
  } catch {
    return "";
  }
}
async function mouseText(page: import("playwright").Page, re: RegExp, label: string) {
  const loc = page.getByText(re).first();
  if (!(await loc.count())) {
    console.log("MISS", label);
    return false;
  }
  const box = await loc.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 20);
  await page.mouse.move(x, y, { steps: 30 });
  await page.mouse.click(x, y);
  return true;
}
async function setInput(page: import("playwright").Page, sel: string, val: string) {
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

const browser = await chromium.launch({ headless: false, slowMo: 120, args: ["--start-maximized"] });
const page = await (await browser.newContext({ viewport: null })).newPage();
await page.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
await page.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120_000 });

for (let i = 0; i < 80; i++) {
  const t = await body(page);
  if (/Core Banking Modules/i.test(t)) break;
  if (/Continue with AzureAd/i.test(t)) {
    await mouseText(page, /Continue with AzureAd/i, "a");
    await sleep(1500);
    continue;
  }
  if (await page.locator("#i0116").count()) {
    await setInput(page, "#i0116", maker.email);
    await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
    await sleep(2000);
    continue;
  }
  if (await page.locator("#i0118").count()) {
    await setInput(page, "#i0118", maker.password);
    await page.locator("#idSIButton9").click({ force: true }).catch(() => page.keyboard.press("Enter"));
    await sleep(2500);
    continue;
  }
  if (/Stay signed in/i.test(t)) {
    await mouseText(page, /^Yes$/i, "y");
    continue;
  }
  if (/Pick an account/i.test(t)) {
    await mouseText(page, /ThejanaD@lolctech\.com/i, "p");
    continue;
  }
  await sleep(900);
}
await shot(page, "home");

const box = await page.evaluate(() => {
  const els = [...document.querySelectorAll("div")].filter((el) => {
    const t = (el.innerText || "").replace(/\s+/g, " ").trim();
    const r = el.getBoundingClientRect();
    return /Common Sync Management|common settings for fusionX/i.test(t) && r.width > 80 && r.width < 420;
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
    if (r.width >= 140 && r.width <= 420 && r.height >= 90 && r.height <= 260) best = n;
    n = n.parentElement;
  }
  const r = best.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});

if (box) {
  await page.mouse.move(box.x, box.y, { steps: 40 });
  await page.mouse.click(box.x, box.y);
  await sleep(1500);
  await shot(page, "common-flipped");
  await page.mouse.dblclick(box.x, box.y);
  await sleep(2500);
} else {
  await mouseText(page, /create and manage common settings/i, "common-desc");
  await sleep(2000);
}

let p = page.context().pages().filter((x) => !x.isClosed()).at(-1) || page;
await p.bringToFront();
await shot(p, "common-open");
console.log("URL", p.url());
await mouseText(p, /Schedule Monitory Dashboard|Schedule Monitor|Monitory|Process Scheduler/i, "smd");
await sleep(2500);
await shot(p, "smd");
const t2 = await body(p);
const summary = {
  story: "PF-58376",
  at: new Date().toISOString(),
  focus: "common-sync",
  url: p.url(),
  is404: /404|Not Found/i.test(t2),
  is401: /401|Unauthorized|Insufficient/i.test(t2),
  noData: /No Data/i.test(t2),
  textSnippet: t2.slice(0, 500),
};
fs.writeFileSync(`${OUT}/_common-sync-focus.json`, JSON.stringify(summary, null, 2));
console.log("FOCUS_DONE", JSON.stringify(summary));
