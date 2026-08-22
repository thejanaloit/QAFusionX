import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { vaultIndexPath } from "./paths.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const cache = new Map<string, string | null>();

function resolveScript(name: string): string {
  return path.join(REPO_ROOT, "scripts", name);
}

/** Read a secret from TBB vault via Python helper (stdout only). */
export function getVaultSecret(key: string, reason = "QAFusionX"): string | null {
  const cacheKey = `${key}:${reason}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const script = resolveScript("resolve-secret.py");
  if (!fs.existsSync(script) || !fs.existsSync(vaultIndexPath())) {
    cache.set(cacheKey, null);
    return null;
  }
  try {
    const out = execFileSync("py", [script, key, reason], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, TBB_SECRET_AUTO_APPROVE: process.env.TBB_SECRET_AUTO_APPROVE ?? "1" },
    }).trim();
    const val = out || null;
    cache.set(cacheKey, val);
    return val;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}

export function getJiraToken(): string | null {
  for (const key of ["JIRA_API_TOKEN", "ATLASSIAN_API_TOKEN", "JIRA_TOKEN"]) {
    const fromEnv = process.env[key];
    if (fromEnv?.trim()) return fromEnv.trim();
    const fromVault = getVaultSecret(key, "QAFusionX Jira REST");
    if (fromVault) return fromVault;
  }
  return null;
}

export interface FusionxUatCreds {
  email: string;
  password: string;
}

/** FusionX UAT login from env or TBB vault (FUSIONX_UAT_* / QAFUSIONX_* keys). */
export function getFusionxUatCreds(): FusionxUatCreds | null {
  const email =
    process.env.QAFUSIONX_EMAIL?.trim() ||
    process.env.FUSIONX_UAT_USER?.trim() ||
    getVaultSecret("FUSIONX_UAT_USER", "QAFusionX UAT login") ||
    getVaultSecret("QAFUSIONX_EMAIL", "QAFusionX UAT login");
  const password =
    process.env.QAFUSIONX_PASSWORD?.trim() ||
    process.env.FUSIONX_UAT_PASSWORD?.trim() ||
    getVaultSecret("FUSIONX_UAT_PASSWORD", "QAFusionX UAT login") ||
    getVaultSecret("QAFUSIONX_PASSWORD", "QAFusionX UAT login");
  if (!email || !password) return null;
  return { email, password };
}
