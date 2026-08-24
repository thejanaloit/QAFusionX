import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type KnowledgeHit = {
  path: string;
  title: string;
  snippet: string;
};

function defaultKnowledgeRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/knowledge -> repo root
  const repoRoot = path.resolve(here, "..", "..");
  return path.join(repoRoot, "knowledge", "confluence");
}

/** Resolves QAFUSIONX_KNOWLEDGE or `<repo>/knowledge/confluence`. */
export function knowledgeRoot(): string {
  const fromEnv = process.env.QAFUSIONX_KNOWLEDGE?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return defaultKnowledgeRoot();
}

const TEXT_EXT = new Set([".md", ".json", ".txt"]);

function walkFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    if (ent.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    // Skip huge dumps / auth secrets
    if (ent.name === ".auth.tmp.json" || ent.name.endsWith(".auth.tmp.json")) continue;
    out.push(full);
  }
}

function titleFrom(filePath: string, body: string): string {
  const base = path.basename(filePath);
  const mdH1 = body.match(/^#\s+(.+)$/m);
  if (mdH1) return mdH1[1].trim();
  if (base.endsWith(".json")) {
    try {
      const j = JSON.parse(body) as { title?: string; name?: string };
      if (j.title) return String(j.title);
      if (j.name) return String(j.name);
    } catch {
      /* ignore */
    }
  }
  return base.replace(/\.(md|json|txt)$/i, "").replace(/__/g, " — ");
}

function snippetAround(body: string, idx: number, qLen: number): string {
  const start = Math.max(0, idx - 80);
  const end = Math.min(body.length, idx + qLen + 160);
  let snip = body.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = "…" + snip;
  if (end < body.length) snip = snip + "…";
  return snip;
}

/**
 * Case-insensitive scan of .md / .json / .txt under knowledgeRoot().
 * Returns { path, title, snippet }[] capped by limit.
 */
export function searchKnowledge(query: string, limit = 20): KnowledgeHit[] {
  const q = query?.trim();
  if (!q) return [];
  const cap = Math.max(1, Math.min(limit || 20, 100));
  const root = knowledgeRoot();
  const files: string[] = [];
  walkFiles(root, files);

  const needle = q.toLowerCase();
  const hits: KnowledgeHit[] = [];

  for (const file of files) {
    if (hits.length >= cap) break;
    let body: string;
    try {
      const st = fs.statSync(file);
      if (st.size > 2_000_000) continue; // skip multi-MB text dumps
      body = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lower = body.toLowerCase();
    const idx = lower.indexOf(needle);
    const nameHit = path.basename(file).toLowerCase().includes(needle);
    if (idx < 0 && !nameHit) continue;
    const rel = path.relative(root, file) || file;
    hits.push({
      path: rel.replace(/\\/g, "/"),
      title: titleFrom(file, body),
      snippet: idx >= 0 ? snippetAround(body, idx, needle.length) : titleFrom(file, body),
    });
  }

  return hits;
}
