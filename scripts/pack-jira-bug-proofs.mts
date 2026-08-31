import fs from "node:fs";
import path from "node:path";
import { STORY_BUG_MAP, attachAllBugProofs, filesForBug } from "../src/jira/attach-bug-proofs.ts";

const WORKSPACE = process.env.QAFUSIONX_WORKSPACE ?? "E:/QAFusionX/workspaces/PF-57868";
const outRoot = path.join(WORKSPACE, "jira", "attachments");

const bugs = [...new Set(Object.values(STORY_BUG_MAP).flat())].sort();
const manifest: Record<string, string[]> = {};
for (const bug of bugs) {
  const dir = path.join(outRoot, bug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  manifest[bug] = [];
  const seen = new Set<string>();
  for (const src of filesForBug(bug)) {
    const base = path.basename(src);
    if (seen.has(base)) continue;
    seen.add(base);
    const dest = path.join(dir, base);
    fs.copyFileSync(src, dest);
    manifest[bug].push(dest);
  }
}
fs.writeFileSync(path.join(WORKSPACE, "reports", "jira-attachment-manifest.json"), JSON.stringify({ at: new Date().toISOString(), manifest }, null, 2));
console.log("Packaged attachments:", bugs.map((b) => `${b}=${manifest[b].length}`).join(", "));

const upload = await attachAllBugProofs(bugs);
fs.writeFileSync(path.join(WORKSPACE, "reports", "jira-attachment-log.json"), JSON.stringify(upload, null, 2));
console.log(JSON.stringify(upload, null, 2));
