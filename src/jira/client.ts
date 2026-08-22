import fs from "node:fs";
import path from "node:path";
import { abs, DIRS, writeFile } from "../workflow/paths.ts";
import type { HumanTestCase } from "../testdocs/format.ts";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  token: string;
  projectKey: string;
}

export function readJiraConfig(overrides?: Partial<JiraConfig>): JiraConfig | null {
  const baseUrl = overrides?.baseUrl || process.env.JIRA_BASE_URL || process.env.JIRA_URL;
  const email = overrides?.email || process.env.JIRA_EMAIL;
  const token = overrides?.token || process.env.JIRA_API_TOKEN || process.env.JIRA_TOKEN;
  const projectKey = overrides?.projectKey || process.env.JIRA_PROJECT_KEY;
  if (!baseUrl || !email || !token || !projectKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), email, token, projectKey };
}

function authHeader(cfg: JiraConfig): string {
  return `Basic ${Buffer.from(`${cfg.email}:${cfg.token}`).toString("base64")}`;
}

function adfDoc(text: string) {
  const paragraphs = text.split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", version: 1, content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

export function testCaseDescription(tc: HumanTestCase): string {
  return [
    `*Affects versions:* ${tc.affectsVersions}`,
    `*Test Case Type:* ${tc.testCaseType}`,
    `*Priority:* ${tc.priority}`,
    `*Labels:* ${tc.labels.join(", ")}`,
    `*Parent:* ${tc.parent ?? "—"}`,
    `*Linked:* ${tc.linked ?? "—"}`,
    `*Layer:* ${tc.layer}`,
    "",
    "h2. Preconditions",
    ...tc.preconditions.map((p, i) => `${i + 1}. ${p}`),
    "",
    "h2. Test Steps",
    ...tc.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "h2. Test Comments",
    tc.comments ?? "None.",
    "",
    "h2. Expected Result",
    tc.expected,
    "",
    "h2. Actual Result",
    tc.actual ?? "None.",
  ].join("\n");
}

export function bugDescription(opts: {
  precondition: string;
  steps: string[];
  expected: string;
  actual: string;
  proof: string;
}): string {
  return [
    "h2. Precondition",
    opts.precondition,
    "",
    "h2. Test Steps",
    ...opts.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "h2. Expected Result",
    opts.expected,
    "",
    "h2. Actual Result",
    opts.actual,
    "",
    "h2. Proof",
    opts.proof,
  ].join("\n");
}

export async function createIssue(
  cfg: JiraConfig,
  fields: {
    summary: string;
    description: string;
    issuetype: string;
    labels?: string[];
    priority?: string;
  },
): Promise<{ key: string; id: string; self: string }> {
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: cfg.projectKey },
        summary: fields.summary,
        description: adfDoc(fields.description),
        issuetype: { name: fields.issuetype },
        labels: fields.labels ?? [],
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Jira create failed (${res.status}): ${(await res.text()).slice(0, 800)}`);
  }
  return (await res.json()) as { key: string; id: string; self: string };
}

export async function attachProof(cfg: JiraConfig, issueKey: string, fileAbs: string): Promise<void> {
  if (!fs.existsSync(fileAbs)) return;
  const form = new FormData();
  const buf = fs.readFileSync(fileAbs);
  const blob = new Blob([buf]);
  form.append("file", blob, path.basename(fileAbs));
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      "X-Atlassian-Token": "no-check",
    },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Jira attach failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
}

export function writeOfflinePayload(kind: "testcase" | "bug", id: string, payload: unknown): string {
  const rel = path.join(DIRS.jiraPayloads, `${kind}-${id}.json`);
  writeFile(rel, JSON.stringify(payload, null, 2));
  return abs(rel);
}
