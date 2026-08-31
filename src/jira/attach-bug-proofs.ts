import fs from "node:fs";
import path from "node:path";
import { abs, DIRS } from "../workflow/paths.ts";
import { attachProof, issueExists, listAttachments, readJiraConfig, type JiraConfig } from "./client.ts";

/** Story-prefix → open bugs that must receive those proof PNGs. */
export const STORY_BUG_MAP: Record<string, string[]> = {
  "58374": ["PF-58496", "PF-58497", "PF-58509", "PF-58510", "PF-58511", "PF-58438"],
  "58375": ["PF-58500", "PF-58502", "PF-58503", "PF-58499"],
  "58376": ["PF-58426", "PF-58425", "PF-58418", "PF-58505"],
  "58377": ["PF-58507", "PF-58512", "PF-58513", "PF-58430", "PF-58429"],
  "58378": ["PF-58514", "PF-58439"],
  "58380": ["PF-58438"],
  "58383": ["PF-58416", "PF-58398", "PF-58417"],
  checker: ["PF-58560"],
};

export const PROOF_ROOTS = [
  path.resolve(process.env.QAFUSIONX_REPO ?? "C:/Users/ThejanaD/QAFusionX", "proof-full-all-11-r2-aug31"),
  path.resolve(process.env.QAFUSIONX_REPO ?? "C:/Users/ThejanaD/QAFusionX", "proof-full-all-11-aug31"),
  path.resolve(process.env.QAFUSIONX_REPO ?? "C:/Users/ThejanaD/QAFusionX", "proof-checker-aug31"),
  abs("reports/proof/full-all-11-r2-aug31"),
  abs("reports/proof/full-all-11-aug31"),
  abs("reports/proof/checker-aug31"),
];

function pngsForPrefix(prefix: string): string[] {
  const out: string[] = [];
  for (const root of PROOF_ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      if (!name.toLowerCase().endsWith(".png")) continue;
      if (prefix === "checker") {
        if (/checker|error/i.test(name)) out.push(path.join(root, name));
      } else if (name.startsWith(prefix)) {
        out.push(path.join(root, name));
      }
    }
  }
  return [...new Set(out)];
}

function proofPathsFromBugMd(bugKey: string): string[] {
  const rel = path.join(DIRS.bugs, `${bugKey}.md`);
  const file = abs(rel);
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const paths: string[] = [];
  for (const m of text.matchAll(/`([^`]+\.png)`/gi)) {
    const p = m[1].replace(/\//g, path.sep);
    const candidates = [abs(p), path.resolve(process.env.QAFUSIONX_REPO ?? "C:/Users/ThejanaD/QAFusionX", p)];
    for (const c of candidates) {
      if (fs.existsSync(c)) paths.push(c);
    }
  }
  return paths;
}

export function filesForBug(bugKey: string): string[] {
  const files = new Set<string>(proofPathsFromBugMd(bugKey));
  const packagedDir = abs(path.join("jira", "attachments", bugKey));
  if (fs.existsSync(packagedDir)) {
    for (const name of fs.readdirSync(packagedDir)) {
      if (name.toLowerCase().endsWith(".png")) files.add(path.join(packagedDir, name));
    }
  }
  for (const [prefix, bugs] of Object.entries(STORY_BUG_MAP)) {
    if (!bugs.includes(bugKey)) continue;
    for (const f of pngsForPrefix(prefix)) files.add(f);
  }
  return [...files].filter((f) => fs.existsSync(f));
}

export interface AttachResult {
  bugKey: string;
  uploaded: string[];
  skipped: string[];
  errors: { file: string; error: string }[];
}

export async function attachProofsToBug(cfg: JiraConfig, bugKey: string): Promise<AttachResult> {
  const result: AttachResult = { bugKey, uploaded: [], skipped: [], errors: [] };
  let existing: Set<string>;
  try {
    existing = new Set(await listAttachments(cfg, bugKey));
  } catch (err) {
    result.errors.push({ file: "*", error: `list attachments: ${String(err)}` });
    return result;
  }
  if (!(await issueExists(cfg, bugKey))) {
    result.errors.push({ file: "*", error: "issue not found or no permission" });
    return result;
  }
  for (const file of filesForBug(bugKey)) {
    const base = path.basename(file);
    if (existing.has(base)) {
      result.skipped.push(base);
      continue;
    }
    try {
      await attachProof(cfg, bugKey, file);
      result.uploaded.push(base);
      existing.add(base);
    } catch (err) {
      result.errors.push({ file: base, error: String(err) });
    }
  }
  return result;
}

export async function attachAllBugProofs(bugKeys?: string[]): Promise<{ cfg: boolean; results: AttachResult[] }> {
  const cfg = readJiraConfig();
  if (!cfg) return { cfg: false, results: [] };

  const keys =
    bugKeys ??
    [...new Set(Object.values(STORY_BUG_MAP).flat())].sort();

  const results: AttachResult[] = [];
  for (const key of keys) {
    results.push(await attachProofsToBug(cfg, key));
  }
  return { cfg: true, results };
}
