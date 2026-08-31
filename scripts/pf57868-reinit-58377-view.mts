import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "E:/QA OUTPUTS/PF-57868-reinit/proof/PF-58377";
const maker = JSON.parse(fs.readFileSync("C:/Users/ThejanaD/QAFusionX/tmp-creds.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 200;
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
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 16), { steps: 24 });
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 16));
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
const page0 = await (await browser.newContext({ viewport: null })).newPage();
await page0.setViewportSize({ width: 1520, height: 960 }).catch(() => undefined);
await page0.goto("https://uat.fusionx.biz/web/home/cNwNb/dashboard", { waitUntil: "domcontentloaded", timeout: 120_000 });
for (let i = 0; i < 70; i++) {
  const t = await body(page0);
  if (/Entity Management/i.test(t) && /Core Banking/i.test(t)) break;
  if (/Continue with AzureAd/i.test(t)) {
    await mouseText(page0, /Continue with AzureAd/i, "a");
    await sleep(1500);
    continue;
  }
  if (await page0.locator("#i0116").count()) {
    await setInput(page0, "#i0116", maker.email);
    await page0.locator("#idSIButton9").click({ force: true }).catch(() => page0.keyboard.press("Enter"));
    await sleep(2000);
    continue;
  }
  if (await page0.locator("#i0118").count()) {
    await setInput(page0, "#i0118", maker.password);
    await page0.locator("#idSIButton9").click({ force: true }).catch(() => page0.keyboard.press("Enter"));
    await sleep(2500);
    continue;
  }
  if (/Stay signed in/i.test(t)) {
    await mouseText(page0, /^Yes$/i, "y");
    continue;
  }
  if (/Pick an account/i.test(t)) {
    await mouseText(page0, /ThejanaD@lolctech\.com/i, "p");
    continue;
  }
  await sleep(800);
}
const box = await page0.evaluate(() => {
  const els = Array.from(document.querySelectorAll("div,span")).filter((el) => {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    const r = el.getBoundingClientRect();
    return t === "Entity Management" && r.width > 40 && r.width < 280 && r.height < 60 && r.y > 200;
  });
  els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
  const leaf = els[0] as HTMLElement | undefined;
  if (!leaf) return null;
  let n: HTMLElement | null = leaf;
  let best = leaf;
  for (let i = 0; i < 8 && n; i++) {
    const r = n.getBoundingClientRect();
    if (r.width >= 150 && r.width <= 360 && r.height >= 110 && r.height <= 240) best = n;
    n = n.parentElement;
  }
  const r = best.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (box) {
  await page0.mouse.move(box.x, box.y, { steps: 35 });
  await page0.mouse.click(box.x, box.y);
  await sleep(1500);
  await page0.mouse.dblclick(box.x, box.y);
  await sleep(2500);
}
let page = page0.context().pages().filter((p) => !p.isClosed()).at(-1) || page0;
await page.bringToFront();
for (let i = 0; i < 40; i++) {
  const t = await body(page);
  if (/Entity Creation|View|Supplier/i.test(t) && !/personalization is in progress/i.test(t)) break;
  await sleep(1200);
}
await mouseText(page, /Entity Creation/i, "entity-creation");
await sleep(2000);
await shot(page, "entity-creation");

// click first View in action column via evaluate coords of link text View near table
const viewBox = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a,button,span")).filter((el) => {
    const t = (el.textContent || "").trim();
    const r = el.getBoundingClientRect();
    return t === "View" && r.width > 10 && r.y > 250;
  });
  const el = links[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log("VIEW_BOX", viewBox);
if (viewBox) {
  await page.mouse.move(viewBox.x, viewBox.y, { steps: 28 });
  await page.mouse.click(viewBox.x, viewBox.y);
}
await sleep(3500);
for (let i = 0; i < 25; i++) {
  const t = await body(page);
  if (!/personalization is in progress/i.test(t) && t.length > 60) break;
  await sleep(1200);
}
const shotA = await shot(page, "assert-view-detail");
const t = await body(page);
const url = page.url();
const is404 = /404|Not Found|undefined|payee-detail/i.test(t) || /undefined|404/i.test(url);
const hasDetail = /Payee|NIC|Supplier Code|Bank Account|Mobile|Email|Address/i.test(t);
const blank = !hasDetail && (/Supplier|Entity/i.test(t) || /supplier/i.test(url));
const findings = [
  {
    bug: "PF-58507",
    claim: "View supplier payee-detail undefined → 404",
    verdict: is404 ? "CONFIRMED" : blank ? "CONFIRMED" : hasDetail ? "NOT_REPRO" : "PARTIAL",
    notes: `Clicked View on Entity Creation. url=${url} 404=${is404} blank=${blank} detail=${hasDetail}`,
    shot: shotA,
  },
];
const summary = {
  story: "PF-58377",
  at: new Date().toISOString(),
  honestDoneAllowed: findings.every((f) => f.verdict === "NOT_REPRO"),
  jiraDone: false,
  findings,
  out: OUT,
  url,
};
fs.writeFileSync(`${OUT}/_summary.json`, JSON.stringify(summary, null, 2));
fs.writeFileSync("E:/QA OUTPUTS/PF-57868-reinit/tracker/PF-58377.json", JSON.stringify(summary, null, 2));
console.log("VIEW_DONE", JSON.stringify(summary));
