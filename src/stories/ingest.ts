import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { readJiraConfig } from "../jira/client.ts";
import { abs, DIRS, ensureDir, listFiles, writeFile } from "../workflow/paths.ts";

export interface StoryFile {
  filename: string;
  title: string;
  body: string;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "story";
}

function titleFromBody(filename: string, body: string): string {
  const heading = body.split("\n").find((l) => l.startsWith("# "));
  if (heading) return heading.replace(/^#\s+/, "").trim();
  return path.basename(filename, path.extname(filename)).replace(/[-_]/g, " ");
}

export function saveStoryMarkdown(title: string, body: string, index: number): string {
  ensureDir(DIRS.userStories);
  const file = `${String(index).padStart(3, "0")}-${slug(title)}.md`;
  const rel = path.join(DIRS.userStories, file);
  const content = body.includes(title) ? body : `# ${title}\n\n${body}`;
  writeFile(rel, content.trim() + "\n");
  return rel;
}

export function ingestMarkdownStories(stories: { title: string; body: string }[]): StoryFile[] {
  ensureDir(DIRS.userStories);
  return stories.map((s, i) => {
    const filename = saveStoryMarkdown(s.title, s.body, i + 1);
    return { filename, title: s.title, body: s.body };
  });
}

export function ingestZip(zipPath: string): StoryFile[] {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip not found: ${zipPath}`);
  }
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const stories: StoryFile[] = [];
  let i = 0;
  for (const entry of entries) {
    const name = path.basename(entry.entryName);
    if (name.startsWith(".")) continue;
    i += 1;
    const body = entry.getData().toString("utf8");
    const title = titleFromBody(name, body);
    const filename = saveStoryMarkdown(title, body, i);
    stories.push({ filename, title, body });
  }
  return stories;
}

export function ingestRawFiles(files: { name: string; content: string }[]): StoryFile[] {
  return files.map((f, i) => {
    const title = titleFromBody(f.name, f.content);
    const filename = saveStoryMarkdown(title, f.content, i + 1);
    return { filename, title, body: f.content };
  });
}

export interface JiraStory {
  key: string;
  summary: string;
  description: string;
  status?: string;
  issuetype?: string;
}

export async function fetchJiraStories(opts: {
  baseUrl: string;
  email?: string;
  token?: string;
  link: string;
}): Promise<JiraStory[]> {
  const email = opts.email ?? process.env.JIRA_EMAIL;
  const token = opts.token ?? readJiraConfig()?.token;
  if (!email || !token) {
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN are required to pull stories from Jira.");
  }

  const jql = jqlFromLink(opts.link);
  const url = `${opts.baseUrl.replace(/\/$/, "")}/rest/api/3/search/jql`;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql,
      maxResults: 100,
      fields: ["summary", "description", "status", "issuetype", "labels"],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira search failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    issues: Array<{
      key: string;
      fields: {
        summary: string;
        description?: unknown;
        status?: { name: string };
        issuetype?: { name: string };
      };
    }>;
  };
  return data.issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    description: adfToText(issue.fields.description),
    status: issue.fields.status?.name,
    issuetype: issue.fields.issuetype?.name,
  }));
}

export function persistJiraStories(stories: JiraStory[]): StoryFile[] {
  return stories.map((s, i) => {
    const body = `# ${s.key} — ${s.summary}

**Type:** ${s.issuetype ?? "Story"}
**Status:** ${s.status ?? "Unknown"}

## Description
${s.description || "_No description in Jira._"}
`;
    const filename = saveStoryMarkdown(`${s.key} ${s.summary}`, body, i + 1);
    return { filename, title: `${s.key} — ${s.summary}`, body };
  });
}

function jqlFromLink(link: string): string {
  try {
    const url = new URL(link);
    const jql = url.searchParams.get("jql");
    if (jql) return jql;
    const match = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (match) return `key = ${match[1]} OR parent = ${match[1]} OR "Epic Link" = ${match[1]} ORDER BY created ASC`;
    const project = url.pathname.match(/\/projects\/([A-Z][A-Z0-9]+)/i);
    if (project) return `project = ${project[1]} AND issuetype in (Story, Epic) ORDER BY created ASC`;
  } catch {
    // not a URL — treat as JQL or issue key
  }
  if (/^[A-Z][A-Z0-9]+-\d+$/i.test(link.trim())) {
    return `key = ${link.trim()} OR parent = ${link.trim()}`;
  }
  return link;
}

function adfToText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  const node = value as { type?: string; text?: string; content?: unknown[] };
  if (node.text) return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(adfToText).join(node.type === "paragraph" ? "\n\n" : "");
  }
  return "";
}

export function listSavedStories(): StoryFile[] {
  return listFiles(DIRS.userStories, ".md").map((name) => {
    const body = fs.readFileSync(abs(path.join(DIRS.userStories, name)), "utf8");
    return { filename: name, title: titleFromBody(name, body), body };
  });
}
