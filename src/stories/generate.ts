import fs from "node:fs";
import path from "node:path";
import { abs, DIRS, ensureDir, listFiles, readFile, writeFile } from "../workflow/paths.ts";
import type { ScreenNode, WorkflowState } from "../workflow/types.ts";
import type { StoryFile } from "./ingest.ts";

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "story"
  );
}

function titleFromBody(filename: string, body: string): string {
  const heading = body.split("\n").find((l) => l.startsWith("# "));
  if (heading) return heading.replace(/^#\s+/, "").trim();
  return path.basename(filename, path.extname(filename)).replace(/[-_]/g, " ");
}

function pathKey(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function roleFor(pathname: string): string {
  if (/login|signin|auth/i.test(pathname)) return "unauthenticated user";
  if (/settings|admin/i.test(pathname)) return "administrator";
  return "Sales officer";
}

function capabilityFor(pathname: string, title: string, screens: ScreenNode[]): string {
  const joined = `${pathname} ${title} ${screens.map((s) => s.buttons.join(" ")).join(" ")}`.toLowerCase();
  if (/login|signin/.test(joined)) return "sign in with valid credentials";
  if (/emergency/.test(joined)) return "enter and review Emergency Details";
  if (/intermediaries\/new|add new/.test(joined)) return "add a new intermediary through the wizard";
  if (/\/edit|manage/.test(joined)) return "manage an existing intermediary";
  if (/intermediaries$/.test(pathname)) return "browse and search the intermediary list";
  if (/settings/.test(joined)) return "review module settings and version labels";
  if (/home|workspace/.test(joined)) return "open Intermediary Management from the module home";
  return `use the "${title || pathname}" screen`;
}

function benefitFor(pathname: string): string {
  if (/login|signin/i.test(pathname)) return "I can reach the Sales & Marketing workspace";
  if (/emergency/i.test(pathname)) return "we can contact a related person during an incident";
  if (/new/i.test(pathname)) return "a complete intermediary record is persisted";
  if (/edit|manage/i.test(pathname)) return "emergency information can be corrected without recreating the record";
  if (/intermediaries$/i.test(pathname)) return "I can find and open the right record";
  if (/settings/i.test(pathname)) return "I know which version and parent epic this run belongs to";
  return "I can complete the captured business flow without getting stuck";
}

export function draftStoriesFromCrawl(state: WorkflowState): StoryFile[] {
  ensureDir(DIRS.generatedUserStories);
  const groups = new Map<string, ScreenNode[]>();
  for (const screen of state.screens) {
    const key = pathKey(screen.url);
    const list = groups.get(key) ?? [];
    list.push(screen);
    groups.set(key, list);
  }

  const stories: StoryFile[] = [];
  let index = 0;
  for (const [pathname, screens] of groups) {
    index += 1;
    const title = screens[0]?.title || pathname;
    const role = roleFor(pathname);
    const want = capabilityFor(pathname, title, screens);
    const soThat = benefitFor(pathname);
    const fields = screens.flatMap((s) => s.buttons);
    const uniqueFields = [...new Set(fields)].slice(0, 24);
    const refs = screens
      .map((s) => readFile(s.referenceRel))
      .filter((x): x is string => Boolean(x))
      .join("\n");
    const fieldHints = refs
      .split("\n")
      .filter((l) => /emergency|username|password|relationship|address|contact|display name/i.test(l))
      .slice(0, 12);

    const id = `US-GEN-${String(index).padStart(3, "0")}`;
    const heading = `${id} ${want.charAt(0).toUpperCase()}${want.slice(1)}`;
    const body = `# ${heading}

**Source:** generated from system crawl (Round 1 + Round 2)
**Screens:** ${[...new Set(screens.map((s) => s.url))].join(", ")}
**Rounds seen:** ${[...new Set(screens.map((s) => s.round))].join(", ")}
**Role:** ${role}

As a ${role}, I want to ${want} so that ${soThat}.

## Acceptance
${acceptanceLines(pathname, screens, uniqueFields)
  .map((line) => `- ${line}`)
  .join("\n")}

## Discovered controls
${uniqueFields.map((f) => `- ${f}`).join("\n") || "- none recorded"}

## Field / reference hints
${fieldHints.map((l) => `- ${l.replace(/^[-*]\s*/, "")}`).join("\n") || "- see the matching reference MD files"}

## Trace
${screens.map((s) => `- ${s.id} (${s.round === 1 ? "round one" : "round two"}) \`${s.screenshotRel}\``).join("\n")}
`;
    const file = `${String(index).padStart(3, "0")}-${slug(heading)}.md`;
    const rel = path.join(DIRS.generatedUserStories, file);
    writeFile(rel, body.trim() + "\n");
    stories.push({ filename: file, title: heading, body });
  }

  writeFile(
    path.join(DIRS.generatedUserStories, "000-index.md"),
    `# Generated user stories

These stories were produced after Round 2 because Question 2 was **generate from our own system**.
Downstream test cases MUST use this directory, not the placeholder in \`User stories/\`.

- Count: ${stories.length}
- Generated: ${new Date().toISOString()}
- Project: ${state.project?.name ?? "unknown"}
- Target: ${state.project?.targetUrl ?? "unknown"}

${stories.map((s, i) => `${i + 1}. ${s.title} — \`${s.filename}\``).join("\n")}
`,
  );

  return stories;
}

function acceptanceLines(pathname: string, screens: ScreenNode[], controls: string[]): string[] {
  const lines = [
    `The screen at ${pathname} is reachable from the captured navigation path.`,
    "Every control listed below is visible and either works or is explicitly marked disabled.",
  ];
  if (screens.some((s) => s.isPopup)) {
    lines.push("Any popup / dialog on this path can be opened and dismissed.");
  }
  if (/emergency/i.test(pathname + controls.join(" "))) {
    lines.push(
      "Emergency Details includes Emergency Name, Relationship Type, Emergency Contact Detail, and Emergency Address (optional).",
    );
  }
  if (/login/i.test(pathname)) {
    lines.push("Valid credentials reach the authenticated workspace; invalid credentials show an error.");
  }
  if (controls.some((c) => /save|continue|sign in/i.test(c))) {
    lines.push("Primary submit / continue actions persist or advance the flow.");
  }
  return lines;
}

export function saveGeneratedStory(title: string, body: string, index?: number): string {
  ensureDir(DIRS.generatedUserStories);
  const next =
    index ??
    listFiles(DIRS.generatedUserStories, ".md").filter((n) => !n.startsWith("000-")).length + 1;
  const file = `${String(next).padStart(3, "0")}-${slug(title)}.md`;
  const content = body.includes(title) ? body : `# ${title}\n\n${body}`;
  writeFile(path.join(DIRS.generatedUserStories, file), content.trim() + "\n");
  return file;
}

export function listGeneratedStories(): StoryFile[] {
  return listFiles(DIRS.generatedUserStories, ".md")
    .filter((name) => !name.startsWith("000-"))
    .map((name) => {
      const body = fs.readFileSync(abs(path.join(DIRS.generatedUserStories, name)), "utf8");
      return { filename: name, title: titleFromBody(name, body), body };
    });
}

export function listActiveStories(source?: string): StoryFile[] {
  if (source === "generate") return listGeneratedStories();
  return listFiles(DIRS.userStories, ".md")
    .filter((name) => !name.startsWith("000-"))
    .map((name) => {
      const body = fs.readFileSync(abs(path.join(DIRS.userStories, name)), "utf8");
      return { filename: name, title: titleFromBody(name, body), body };
    });
}
