import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "..", "..");

export function workspaceRoot(): string {
  if (process.env.QAFUSIONX_WORKSPACE) {
    return path.resolve(process.env.QAFUSIONX_WORKSPACE);
  }
  return path.join(REPO_ROOT, "artifacts");
}

export const DIRS = {
  stepByStep: "step-by-step",
  userStories: "User stories",
  general: "General",
  screens: "Screens",
  roundOne: path.join("Screens", "round one"),
  roundOneScreenshots: path.join("Screens", "round one", "screenshots"),
  roundOneReferences: path.join("Screens", "round one", "references"),
  roundOnePlan: path.join("Screens", "round one", "plan"),
  roundTwo: path.join("Screens", "round two"),
  roundTwoScreenshots: path.join("Screens", "round two", "screenshots"),
  roundTwoReferences: path.join("Screens", "round two", "references"),
  roundTwoPlan: path.join("Screens", "round two", "plan"),
  testCaseHuman: "testCase Human",
  testc2ai: "testc2ai",
  automated: "AutomatedScripts",
  automatedGui: path.join("AutomatedScripts", "gui"),
  automatedApi: path.join("AutomatedScripts", "api"),
  reports: "reports",
  jira: "jira",
  jiraTestcases: path.join("jira", "testcases"),
  jiraBugs: path.join("jira", "bugs"),
  jiraPayloads: path.join("jira", "payloads"),
  bugs: "bugs",
  proofs: path.join("reports", "proof"),
} as const;

export function abs(...parts: string[]): string {
  return path.join(workspaceRoot(), ...parts);
}

export function ensureDir(rel: string): string {
  const dir = abs(rel);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureLayout(): void {
  for (const rel of Object.values(DIRS)) {
    ensureDir(rel);
  }
}

export function listFiles(rel: string, ext?: string): string[] {
  const dir = abs(rel);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .filter((name) => (ext ? name.toLowerCase().endsWith(ext.toLowerCase()) : true))
    .sort();
}

export function writeFile(rel: string, contents: string): string {
  const file = abs(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
  return file;
}

export function readFile(rel: string): string | null {
  const file = abs(rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

export function copyInto(srcAbs: string, destRel: string): string {
  const dest = abs(destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcAbs, dest);
  return dest;
}

export function countFiles(rel: string, ext?: string): number {
  return listFiles(rel, ext).length;
}
