/**
 * Sync Jira issues into QAFusionX workspace User stories/.
 *
 * Usage:
 *   npx tsx scripts/sync-jira-stories.ts --workspace E:/QAFusionX/workspaces/PF-57868 --json jira/export/pf57868-bundle.json
 *   npx tsx scripts/sync-jira-stories.ts --workspace E:/QAFusionX/workspaces/PF-57868 --link https://lolcgroupdev.atlassian.net/browse/PF-57868
 *
 * With JIRA_EMAIL + JIRA_API_TOKEN in .env, --link pulls live from Jira REST API.
 * Without token, pass --json from Atlassian MCP export.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { JiraStory } from "../src/stories/ingest.ts";
import { fetchJiraStories, persistJiraStories } from "../src/stories/ingest.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

function loadDotEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(path.join(REPO, ".env"));

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function storiesFromExport(jsonPath: string): JiraStory[] {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as
    | JiraStory[]
    | { issues?: Array<{ key: string; fields: Record<string, unknown> }> };

  if (Array.isArray(raw)) return raw;

  if (raw.issues?.length) {
    return raw.issues.map((issue) => {
      const f = issue.fields;
      const status = f.status as { name?: string } | undefined;
      const issuetype = f.issuetype as { name?: string } | undefined;
      return {
        key: issue.key,
        summary: String(f.summary ?? issue.key),
        description: typeof f.description === "string" ? f.description : "",
        status: status?.name,
        issuetype: issuetype?.name,
      };
    });
  }

  throw new Error(`Unrecognized JSON shape in ${jsonPath}`);
}

function patchState(workspace: string, link: string, count: number) {
  const statePath = path.join(workspace, "state.json");
  if (!fs.existsSync(statePath)) return;
  const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<string, unknown>;
  state.userStories = {
    source: "jira",
    jiraLink: link,
    count,
    generatePending: false,
    syncedAt: new Date().toISOString(),
    syncMethod: process.env.JIRA_API_TOKEN ? "rest-api" : "atlassian-export",
  };
  state.updatedAt = new Date().toISOString();
  if (state.steps && typeof state.steps === "object") {
    const steps = state.steps as Record<string, { note?: string }>;
    if (steps["ask-user-stories"]) {
      steps["ask-user-stories"].note = `User stories source: jira (${count} files).`;
    }
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspace = path.resolve(args.workspace ?? process.env.QAFUSIONX_WORKSPACE ?? path.join(REPO, "artifacts"));
  const link =
    args.link ??
    "https://lolcgroupdev.atlassian.net/browse/PF-57868";

  process.env.QAFUSIONX_WORKSPACE = workspace;

  let stories: JiraStory[];
  if (args.json) {
    stories = storiesFromExport(path.resolve(args.json));
  } else if (process.env.JIRA_EMAIL && (process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN)) {
    const base =
      process.env.JIRA_BASE_URL ??
      args.base ??
      "https://lolcgroupdev.atlassian.net";
    stories = await fetchJiraStories({ baseUrl: base, link });
  } else {
    throw new Error(
      "No JIRA_API_TOKEN in .env and no --json export. Add token or pass --json from Atlassian MCP.",
    );
  }

  const saved = persistJiraStories(stories);
  const jiraDir = path.join(workspace, "jira");
  fs.mkdirSync(jiraDir, { recursive: true });
  fs.writeFileSync(path.join(jiraDir, "jira_link.txt"), link + "\n", "utf8");
  fs.writeFileSync(
    path.join(jiraDir, "sync-log.md"),
    `# Jira sync

- **Link:** ${link}
- **Issues:** ${saved.length}
- **Method:** ${args.json ? "atlassian-export" : "rest-api"}
- **At:** ${new Date().toISOString()}

## Files
${saved.map((s) => `- ${s.filename}`).join("\n")}
`,
    "utf8",
  );

  patchState(workspace, link, saved.length);

  console.log(JSON.stringify({ workspace, link, count: saved.length, files: saved.map((s) => s.filename) }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
