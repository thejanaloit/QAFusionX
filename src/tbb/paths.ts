import fs from "node:fs";
import path from "node:path";

const DEFAULT_TBB = process.platform === "win32" ? "E:/ThejaBackBone" : path.join(process.env.HOME ?? "", "ThejaBackBone");

/** Resolve ThejaBackBone root from env (set by install script or MCP config). */
export function tbbRoot(): string {
  const raw =
    process.env.THEJA_BACKBONE_ROOT ||
    process.env.TBB_ROOT ||
    process.env.THEJA_BACKBONE ||
    DEFAULT_TBB;
  return path.resolve(raw);
}

export function vaultDir(): string {
  if (process.env.TBB_VAULT_DIR) return path.resolve(process.env.TBB_VAULT_DIR);
  return path.join(tbbRoot(), ".tbb", "vault");
}

export function vaultIndexPath(): string {
  return path.join(vaultDir(), "index.json");
}

export function isTbbLinked(): boolean {
  const root = tbbRoot();
  return fs.existsSync(root) && fs.existsSync(vaultIndexPath());
}

export function repoRootFromImportMeta(importMetaUrl: string): string {
  return path.resolve(path.dirname(new URL(importMetaUrl).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
}
