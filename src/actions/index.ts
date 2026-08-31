import fs from "node:fs";
import path from "node:path";
import { stringify as yamlStringify } from "yaml";
import { ASK_MODE_BANNER } from "../protocol.ts";
import { bus } from "../events.ts";
import {
  captureScreen,
  clickControl,
  closeBrowser,
  fillField,
  getPage,
  openVisibleBrowser,
  openTarget,
  browserSessionAlive,
  writeLivingPlan,
  writeReferenceMd,
  type InteractiveControl,
} from "../crawler/browser.ts";
import { VISIBLE_BROWSER_LOCK_MARKDOWN } from "../visible-lock.ts";
import {
  attachProof,
  bugDescription,
  createIssue,
  readJiraConfig,
  testCaseDescription,
  writeOfflinePayload,
} from "../jira/client.ts";
import { attachAllBugProofs, filesForBug, STORY_BUG_MAP } from "../jira/attach-bug-proofs.ts";
import { writeIssuesWorkbook, type IssueRow } from "../reports/issues.ts";
import { generatePf57868IpayExcel } from "../reports/ipay-lite.ts";
import {
  fetchJiraStories,
  ingestRawFiles,
  ingestZip,
  listSavedStories,
  persistJiraStories,
} from "../stories/ingest.ts";
import {
  draftStoriesFromCrawl,
  listActiveStories,
  listGeneratedStories,
  saveGeneratedStory,
} from "../stories/generate.ts";
import { formatHumanTestCase, validateHumanMarkdown, type HumanTestCase } from "../testdocs/format.ts";
import {
  ensureAuthenticatedSession,
  evaluateApiWithRetries,
  evaluateGuiWithRetries,
  MAX_SUITE_ROUNDS,
} from "../suite/honest-runner.ts";
import { apiSpec, guiSpec } from "../testdocs/scripts.ts";
import {
  beginStep,
  completeStep,
  loadState,
  missingGates,
  publicStatus,
  resetState,
  saveState,
  setGate,
  WorkflowBlocked,
} from "../workflow/engine.ts";
import { abs, countFiles, DIRS, ensureLayout, listFiles, readFile, writeFile } from "../workflow/paths.ts";
import { STEPS } from "../workflow/steps.ts";
import type { ProjectInfo, StorySource, WorkflowState } from "../workflow/types.ts";

function json(data: unknown) {
  return JSON.parse(JSON.stringify(data));
}

function activeCrawlStepKey(state: WorkflowState): "round-1-crawl" | "round-2-crawl" {
  const r1 = state.steps["round-1-crawl"];
  const r2 = state.steps["round-2-crawl"];
  if (r1?.status !== "done") return "round-1-crawl";
  if (r2 && r2.status !== "done" && r2.status !== "locked") return "round-2-crawl";
  throw new WorkflowBlocked({
    code: "STEP_GATE",
    message: "No active crawl round. Finish Round 1 before Round 2.",
    requiredStep: r1?.status !== "done" ? "round-1-crawl" : "round-2-crawl",
  });
}

function assertNoPendingRound1(state: WorkflowState) {
  const queued = state.crawlQueue.length;
  const pendingOnScreens = state.screens
    .filter((s) => s.round === 1)
    .reduce((n, s) => n + (s.pendingControls?.length ?? 0), 0);
  if (queued > 0 || pendingOnScreens > 0) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `Round 1 still has unvisited controls (queue=${queued}, pendingOnScreens=${pendingOnScreens}). Visit every screen before completing Round 1.`,
      requiredStep: "round-1-crawl",
    });
  }
}

export function status() {
  ensureLayout();
  const state = loadState();
  return publicStatus(state);
}

export function begin() {
  ensureLayout();
  let state = loadState();
  state.askMode.projectAsked = true;
  state = beginStep(state, "ask-project");
  saveState(state);
  return {
    ...publicStatus(state),
    askBanner: ASK_MODE_BANNER,
    question: {
      id: 1,
      prompt:
        "What is this project, and what must be tested? Send the product name, the behaviour under test, the live URL, and a screenshot of the target.",
    },
    nextQuestion:
      "After Question 1 is recorded you MUST ask Question 2: upload user stories as zip, Jira link, or generate-from-system.",
  };
}

export function submitProject(input: {
  name: string;
  whatToTest: string;
  targetUrl: string;
  screenshotPath?: string;
  screenshotBase64?: string;
  affectsVersion?: string;
  jiraBaseUrl?: string;
  jiraProjectKey?: string;
  assignee?: string;
  reporter?: string;
  parent?: string;
}) {
  let state = loadState();
  state = beginStep(state, "ask-project");

  if (!input.name?.trim() || !input.whatToTest?.trim() || !input.targetUrl?.trim()) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Project name, what to test, and target URL are all required.",
      requiredStep: "ask-project",
      missingGates: ["projectName", "whatToTest", "targetUrl"],
    });
  }

  try {
    new URL(input.targetUrl);
  } catch {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "targetUrl must be an absolute http(s) URL.",
      requiredStep: "ask-project",
    });
  }

  let screenshotRel: string | undefined;
  if (input.screenshotBase64) {
    const buf = Buffer.from(input.screenshotBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    screenshotRel = path.join(DIRS.general, "target-screenshot.png");
    fs.writeFileSync(abs(screenshotRel), buf);
  } else if (input.screenshotPath && fs.existsSync(input.screenshotPath)) {
    screenshotRel = path.join(DIRS.general, "target-screenshot" + path.extname(input.screenshotPath));
    fs.copyFileSync(input.screenshotPath, abs(screenshotRel));
  }

  const project: ProjectInfo = {
    name: input.name.trim(),
    whatToTest: input.whatToTest.trim(),
    targetUrl: input.targetUrl.trim(),
    screenshotPath: screenshotRel,
    affectsVersion: input.affectsVersion ?? "1.0.0-QA",
    jiraBaseUrl: input.jiraBaseUrl,
    jiraProjectKey: input.jiraProjectKey,
    assignee: input.assignee,
    reporter: input.reporter ?? "QAFusionX",
    parent: input.parent,
  };
  state.project = project;
  state.askMode.projectAnswered = true;
  state.askMode.storiesAsked = true;
  state = setGate(state, "ask-project", "projectName");
  state = setGate(state, "ask-project", "whatToTest");
  state = setGate(state, "ask-project", "targetUrl");
  if (screenshotRel) state = setGate(state, "ask-project", "screenshot");

  if (!screenshotRel) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "A screenshot is compulsory for Question 1. Pass screenshotPath or screenshotBase64.",
      requiredStep: "ask-project",
      missingGates: missingGates(state, "ask-project"),
    });
  }

  writeFile(
    path.join(DIRS.general, "01-target.md"),
    `# What we are testing

- **Project:** ${project.name}
- **Under test:** ${project.whatToTest}
- **URL:** ${project.targetUrl}
- **Affects versions:** ${project.affectsVersion}
- **Screenshot:** \`${screenshotRel}\`

This file is the first General markdown. Do not start crawling until Question 2 (user stories) is answered and Step 3 has persisted the workspace.
`,
  );

  state = completeStep(state, "ask-project", "Project identity, URL, and screenshot recorded.");
  bus.emitEvent("ask:project", `Project recorded: ${project.name}`);

  return {
    ...publicStatus(state),
    question: {
      id: 2,
      prompt: `Upload the user stories for ${project.name}. Choose exactly one method: (1) zip/files, (2) Jira link, (3) generate from the system after crawl.`,
      methods: ["zip", "jira", "generate"],
    },
    message: "Question 1 complete. Stay in Ask mode and immediately ask Question 2.",
  };
}

export async function submitUserStories(input: {
  source: StorySource;
  zipPath?: string;
  files?: { name: string; content: string }[];
  jiraLink?: string;
  jiraBaseUrl?: string;
}) {
  let state = loadState();
  state = beginStep(state, "ask-user-stories");

  if (!["zip", "jira", "generate"].includes(input.source)) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "source must be zip, jira, or generate.",
      requiredStep: "ask-user-stories",
    });
  }

  let count = 0;
  if (input.source === "zip") {
    if (!input.zipPath && !input.files?.length) {
      throw new WorkflowBlocked({
        code: "VALIDATION",
        message: "For zip source provide zipPath or files[].",
        requiredStep: "ask-user-stories",
      });
    }
    const stories = input.zipPath ? ingestZip(input.zipPath) : ingestRawFiles(input.files ?? []);
    count = stories.length;
  } else if (input.source === "jira") {
    if (!input.jiraLink) {
      throw new WorkflowBlocked({
        code: "VALIDATION",
        message: "jiraLink is required for Jira source.",
        requiredStep: "ask-user-stories",
      });
    }
    const base =
      input.jiraBaseUrl ||
      state.project?.jiraBaseUrl ||
      process.env.JIRA_BASE_URL ||
      new URL(input.jiraLink).origin;
    const fetched = await fetchJiraStories({ baseUrl: base, link: input.jiraLink });
    const saved = persistJiraStories(fetched);
    count = saved.length;
  } else {
    writeFile(
      path.join(DIRS.userStories, "000-generate-pending.md"),
      `# Generate-from-system selected

This placeholder only records Question 2. Real stories are NOT written yet.

After Round 1 and Round 2 screen capture, QAFusionX will create \`GeneratedUser stories/\` and draft one user story per discovered flow. Test cases must be based on that directory, not this file.
`,
    );
    count = 1;
  }

  state.userStories = {
    source: input.source,
    zipPath: input.zipPath,
    jiraLink: input.jiraLink,
    count,
    generatePending: input.source === "generate",
  };
  state.askMode.storiesAnswered = true;
  state.askMode.unlocked = true;
  state = setGate(state, "ask-user-stories", "sourceChosen");
  state = setGate(state, "ask-user-stories", "sourcePayload");
  state = completeStep(state, "ask-user-stories", `User stories source: ${input.source} (${count} files).`);

  return {
    ...publicStatus(state),
    message: "Ask mode unlocked. You may now persist the workspace (Step 3) and leave Ask mode.",
    stories: listSavedStories().map((s) => s.filename),
  };
}

export function persistWorkspace() {
  let state = loadState();
  state = beginStep(state, "persist-workspace");
  ensureLayout();
  const stories = listSavedStories();
  if (!state.project) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Project is missing. Complete Step 1.",
      requiredStep: "ask-project",
    });
  }
  if (!stories.length) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "User stories directory is empty.",
      requiredStep: "ask-user-stories",
    });
  }
  const brief = readFile(path.join(DIRS.general, "01-target.md"));
  if (!brief) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "General/01-target.md is missing.",
      requiredStep: "persist-workspace",
    });
  }
  writeFile(
    path.join(DIRS.general, "00-index.md"),
    `# ${state.project.name}

- Stories: ${stories.length} files in \`User stories/\`
- Target: ${state.project.targetUrl}
- Source: ${state.userStories?.source}
- Visible browser: LOCKED — separate window on this user's device
`,
  );
  writeFile(path.join(DIRS.general, "02-visible-browser-lock.md"), VISIBLE_BROWSER_LOCK_MARKDOWN);
  state = setGate(state, "persist-workspace", "userStoriesDir");
  state = setGate(state, "persist-workspace", "generalBrief");
  if (stories.length >= 1) state = setGate(state, "persist-workspace", "storiesCount");
  state = completeStep(state, "persist-workspace", `Saved ${stories.length} user stories and the General brief.`);
  return { ...publicStatus(state), stories: stories.map((s) => s.filename) };
}

export async function crawlOpen() {
  let state = loadState();
  state = beginStep(state, "round-1-crawl");
  if (!state.project) throw new WorkflowBlocked({ code: "VALIDATION", message: "No project URL.", requiredStep: "ask-project" });
  const opened = await openTarget(state.project.targetUrl);
  state = setGate(state, "round-1-crawl", "openedTarget");
  state = setGate(state, "round-1-crawl", "visibleBrowserOpened");
  saveState(state);
  return { ...opened, ...publicStatus(state) };
}

export async function crawlCapture(input: {
  round: 1 | 2;
  analysis?: string;
  parentId?: string;
  clickedControl?: string;
  isPopup?: boolean;
}) {
  let state = loadState();
  const stepKey = input.round === 1 ? "round-1-crawl" : "round-2-crawl";
  state = beginStep(state, stepKey);
  const captured = await captureScreen(state, input.round, {
    parentId: input.parentId,
    clickedControl: input.clickedControl,
    isPopup: input.isPopup,
  });
  writeReferenceMd(captured.node, captured.controls, input.analysis ?? "");
  writeLivingPlan(state, input.round);
  if (input.round === 1) {
    state = setGate(state, "round-1-crawl", "atLeastOneScreen");
    if (countFiles(DIRS.roundOneReferences, ".md") >= countFiles(DIRS.roundOneScreenshots, ".png")) {
      state = setGate(state, "round-1-crawl", "referencesMatchScreenshots");
    }
  } else {
    if (countFiles(DIRS.roundTwoScreenshots, ".png") >= 1) state = setGate(state, "round-2-crawl", "round2Screens");
    if (countFiles(DIRS.roundTwoReferences, ".md") >= 1) state = setGate(state, "round-2-crawl", "round2References");
  }
  saveState(state);
  return {
    node: captured.node,
    controls: captured.controls,
    screenshotAbs: captured.screenshotAbs,
    instruction:
      "READ the screenshot with a high-end reasoning model. Then call qafusionx_save_screen_reference with a full analysis of every button and reachable screen. Update the plan. Click the first unvisited control.",
    status: publicStatus(state),
  };
}

export function saveScreenReference(input: {
  screenId: string;
  analysis: string;
  pendingControls?: string[];
  visitedControls?: string[];
}) {
  let state = loadState();
  const node = state.screens.find((s) => s.id === input.screenId);
  if (!node) throw new Error(`Unknown screen ${input.screenId}`);
  const stepKey = node.round === 2 ? "round-2-crawl" : "round-1-crawl";
  state = beginStep(state, stepKey);
  if (input.pendingControls) node.pendingControls = input.pendingControls;
  if (input.visitedControls) node.visitedControls = input.visitedControls;
  const dummy: InteractiveControl[] = node.buttons.map((b, index) => ({
    index,
    tag: "button",
    type: "button",
    text: b,
    href: null,
    id: null,
    name: null,
    aria: b,
    testId: null,
    placeholder: null,
    role: "button",
    disabled: b.includes("(disabled)"),
    kind: "button",
  }));
  writeReferenceMd(node, dummy, input.analysis);
  writeLivingPlan(state, node.round);
  saveState(state);
  return { saved: node.referenceRel, node };
}

export async function crawlClick(input: { index: number; label?: string }) {
  let state = loadState();
  state = beginStep(state, activeCrawlStepKey(state));
  saveState(state);
  const result = await clickControl(input.index, input.label);
  return { ...result, next: "Call qafusionx_capture_screen immediately, including if a popup opened." };
}

export async function crawlFill(input: { locator: string; value: string }) {
  let state = loadState();
  state = beginStep(state, activeCrawlStepKey(state));
  saveState(state);
  await fillField(input.locator, input.value);
  return { filled: true };
}

export function completeRound(round: 1 | 2, coverageNote: string) {
  let state = loadState();
  if (round === 1) {
    state = beginStep(state, "round-1-crawl");
    const shots = countFiles(DIRS.roundOneScreenshots, ".png");
    const refs = countFiles(DIRS.roundOneReferences, ".md");
    if (shots < 1 || refs < shots) {
      throw new WorkflowBlocked({
        code: "VALIDATION",
        message: `Round 1 incomplete: ${shots} screenshots, ${refs} references. Every screenshot needs a reference MD.`,
        requiredStep: "round-1-crawl",
      });
    }
    state = setGate(state, "round-1-crawl", "atLeastOneScreen");
    state = setGate(state, "round-1-crawl", "referencesMatchScreenshots");
    state = setGate(state, "round-1-crawl", "openedTarget");
    assertNoPendingRound1(state);
    state = setGate(state, "round-1-crawl", "noPendingQueue");
    state = completeStep(state, "round-1-crawl", coverageNote);

    state = beginStep(state, "round-1-plan");
    if (!readFile(path.join(DIRS.roundOnePlan, "living-plan.md")) || !readFile(path.join(DIRS.roundOnePlan, "todo.md"))) {
      writeLivingPlan(state, 1);
    }
    writeFile(path.join(DIRS.roundOnePlan, "coverage.md"), coverageNote);
    state = setGate(state, "round-1-plan", "livingPlan");
    state = setGate(state, "round-1-plan", "todoList");
    state = setGate(state, "round-1-plan", "coverageNote");
    state = completeStep(state, "round-1-plan", "Living plan frozen for Round 1.");
  } else {
    state = beginStep(state, "round-2-crawl");
    writeFile(path.join(DIRS.roundTwoPlan, "missed-review.md"), coverageNote);
    if (countFiles(DIRS.roundTwoScreenshots, ".png") < 1) {
      throw new WorkflowBlocked({
        code: "VALIDATION",
        message: "Round 2 must capture at least one screen (re-capture the entry URL if nothing was missed).",
        requiredStep: "round-2-crawl",
      });
    }
    state = setGate(state, "round-2-crawl", "round2Screens");
    state = setGate(state, "round-2-crawl", "round2References");
    state = setGate(state, "round-2-crawl", "missedReview");
    writeLivingPlan(state, 2);
    state = completeStep(state, "round-2-crawl", coverageNote);
    state = settleGeneratedStoriesStep(state);
  }
  return publicStatus(state);
}

function settleGeneratedStoriesStep(state: ReturnType<typeof loadState>) {
  if (state.userStories?.source === "generate") {
    return state;
  }
  if (state.steps["generate-user-stories"]?.status === "done") return state;
  state = beginStep(state, "generate-user-stories");
  state = setGate(state, "generate-user-stories", "directoryReady");
  state = setGate(state, "generate-user-stories", "minGeneratedStories");
  state = setGate(state, "generate-user-stories", "storiesFromCrawl");
  return completeStep(
    state,
    "generate-user-stories",
    "N/A — user supplied stories via zip or Jira. GeneratedUser stories/ is not created.",
  );
}

export function draftGeneratedUserStories() {
  let state = loadState();
  if (state.userStories?.source !== "generate") {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message:
        "GeneratedUser stories/ is only created when Question 2 was generate-from-system. Zip/Jira runs skip this step.",
      requiredStep: "generate-user-stories",
    });
  }
  state = beginStep(state, "generate-user-stories");
  if (state.screens.length < 1) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Round 1 and Round 2 must capture screens before stories can be generated from the system.",
      requiredStep: "round-2-crawl",
    });
  }
  const stories = draftStoriesFromCrawl(state);
  if (!state.userStories) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Question 2 was not recorded.",
      requiredStep: "ask-user-stories",
    });
  }
  state.userStories.count = stories.length;
  state.userStories.generatePending = false;
  state = setGate(state, "generate-user-stories", "directoryReady");
  state = setGate(state, "generate-user-stories", "storiesFromCrawl");
  if (stories.length >= 3) state = setGate(state, "generate-user-stories", "minGeneratedStories");
  saveState(state);
  writeFile(
    path.join(DIRS.general, "02-generated-stories.md"),
    `# Generated user stories

- Directory: \`GeneratedUser stories/\`
- Count: ${stories.length}
- Downstream test cases must use this set.

${stories.map((s) => `- ${s.title}`).join("\n")}
`,
  );
  return {
    ...publicStatus(state),
    directory: DIRS.generatedUserStories,
    stories: stories.map((s) => s.filename),
    instruction:
      "Review every file in GeneratedUser stories/. Use a high-end reasoning model to refine them against the screenshots, then call qafusionx_complete_generated_user_stories. Test cases will be based only on this directory.",
  };
}

export function saveGeneratedUserStory(input: { title: string; body: string }) {
  let state = loadState();
  if (state.userStories?.source !== "generate") {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Saving into GeneratedUser stories/ is only allowed for generate-from-system runs.",
      requiredStep: "generate-user-stories",
    });
  }
  state = beginStep(state, "generate-user-stories");
  const file = saveGeneratedStory(input.title, input.body);
  const stories = listGeneratedStories();
  if (stories.length >= 3) state = setGate(state, "generate-user-stories", "minGeneratedStories");
  state = setGate(state, "generate-user-stories", "directoryReady");
  saveState(state);
  return { saved: file, count: stories.length };
}

export function completeGeneratedUserStories() {
  let state = loadState();
  if (state.userStories?.source !== "generate") {
    state = settleGeneratedStoriesStep(state);
    return publicStatus(state);
  }
  state = beginStep(state, "generate-user-stories");
  const stories = listGeneratedStories();
  if (stories.length < 3) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `GeneratedUser stories/ needs at least 3 real stories drafted from the crawl. Found ${stories.length}.`,
      requiredStep: "generate-user-stories",
      missingGates: ["minGeneratedStories"],
    });
  }
  if (!state.userStories) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Question 2 was not recorded.",
      requiredStep: "ask-user-stories",
    });
  }
  state.userStories.count = stories.length;
  state.userStories.generatePending = false;
  state = setGate(state, "generate-user-stories", "directoryReady");
  state = setGate(state, "generate-user-stories", "minGeneratedStories");
  state = setGate(state, "generate-user-stories", "storiesFromCrawl");
  state = completeStep(
    state,
    "generate-user-stories",
    `${stories.length} stories generated from the crawled system. Test cases must use GeneratedUser stories/.`,
  );
  return { ...publicStatus(state), stories: stories.map((s) => s.filename) };
}

export function saveSystemMap(markdown: string) {
  let state = loadState();
  state = beginStep(state, "system-map");
  if (markdown.trim().length < 2500) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `complete-system-map.md is too short (${markdown.trim().length} chars). It must be a full end-to-end idea of the product, not a summary. Minimum 2500 characters.`,
      requiredStep: "system-map",
      missingGates: ["systemMapMinLength"],
    });
  }
  writeFile(path.join(DIRS.screens, "complete-system-map.md"), markdown);
  state = setGate(state, "system-map", "systemMapExists");
  state = setGate(state, "system-map", "systemMapMinLength");
  state = completeStep(state, "system-map", "Exhaustive system map saved.");
  return publicStatus(state);
}

export function saveHumanTestCase(tc: HumanTestCase) {
  let state = loadState();
  state = beginStep(state, "human-testcases");
  const md = formatHumanTestCase(tc);
  const errors = validateHumanMarkdown(md);
  if (errors.length) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `Test case format invalid: ${errors.join("; ")}`,
      requiredStep: "human-testcases",
    });
  }
  const rel = path.join(DIRS.testCaseHuman, `${tc.id}.md`);
  writeFile(rel, md);
  writeFile(path.join(DIRS.testCaseHuman, `${tc.id}.json`), JSON.stringify(tc, null, 2));
  return { saved: rel, title: tc.assertion, count: countFiles(DIRS.testCaseHuman, ".md") };
}

export function saveHumanQaResearch(markdown: string) {
  let state = loadState();
  state = beginStep(state, "human-testcases");
  writeFile(path.join(DIRS.general, "human-qa-research.md"), markdown);
  state = setGate(state, "human-testcases", "humanQaResearch");
  saveState(state);
  return { saved: path.join(DIRS.general, "human-qa-research.md") };
}

export function completeHumanTestCases() {
  let state = loadState();
  state = beginStep(state, "human-testcases");
  const active = listActiveStories(state.userStories?.source);
  if (state.userStories?.source === "generate" && active.length < 3) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message:
        "Generate-from-system runs must write test cases against GeneratedUser stories/. That directory is empty or incomplete.",
      requiredStep: "generate-user-stories",
    });
  }
  const count = countFiles(DIRS.testCaseHuman, ".md");
  if (count < 5) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `Need at least 5 human test cases covering GUI and API. Found ${count}.`,
      requiredStep: "human-testcases",
      missingGates: ["minTestcases"],
    });
  }
  if (!readFile(path.join(DIRS.general, "human-qa-research.md"))) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "General/human-qa-research.md is required. Research how a human QA would test this product.",
      requiredStep: "human-testcases",
      missingGates: ["humanQaResearch"],
    });
  }
  state = setGate(state, "human-testcases", "minTestcases");
  state = setGate(state, "human-testcases", "formatValid");
  state = setGate(state, "human-testcases", "humanQaResearch");
  state = completeStep(state, "human-testcases", `${count} Jira-format test cases saved.`);
  return publicStatus(state);
}

export async function uploadJiraTestCases() {
  let state = loadState();
  state = beginStep(state, "jira-upload-testcases");
  const jsonFiles = listFiles(DIRS.testCaseHuman, ".json");
  const cfg = readJiraConfig({
    baseUrl: state.project?.jiraBaseUrl,
    projectKey: state.project?.jiraProjectKey,
  });
  const log: string[] = [];
  for (const file of jsonFiles) {
    const tc = JSON.parse(fs.readFileSync(abs(path.join(DIRS.testCaseHuman, file)), "utf8")) as HumanTestCase;
    const summary = `[${tc.module}] [${tc.submodule}][${tc.feature}][${tc.typeCode}] - ${tc.assertion}`;
    const description = testCaseDescription(tc);
    const payload = { summary, description, issuetype: "Test", labels: tc.labels, priority: tc.priority };
    if (cfg) {
      try {
        const created = await createIssue(cfg, payload);
        log.push(`${tc.id} → ${created.key}`);
        writeFile(path.join(DIRS.jiraTestcases, `${tc.id}.json`), JSON.stringify({ ...created, payload }, null, 2));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        writeOfflinePayload("testcase", tc.id, { payload, error: msg });
        log.push(`${tc.id} → OFFLINE (${msg})`);
      }
    } else {
      writeOfflinePayload("testcase", tc.id, payload);
      writeFile(path.join(DIRS.jiraTestcases, `${tc.id}.json`), JSON.stringify({ mode: "offline", payload }, null, 2));
      log.push(`${tc.id} → offline payload (Jira credentials not configured)`);
    }
  }
  writeFile(path.join("jira", "upload-log.md"), `# Jira test case upload\n\n${log.map((l) => `- ${l}`).join("\n")}\n`);
  state = setGate(state, "jira-upload-testcases", "allUploadedOrOffline");
  state = completeStep(state, "jira-upload-testcases", `${jsonFiles.length} test cases uploaded or saved offline.`);
  return { ...publicStatus(state), log };
}

export function convertYaml() {
  let state = loadState();
  state = beginStep(state, "testc2ai");
  const jsonFiles = listFiles(DIRS.testCaseHuman, ".json");
  for (const file of jsonFiles) {
    const tc = JSON.parse(fs.readFileSync(abs(path.join(DIRS.testCaseHuman, file)), "utf8")) as HumanTestCase;
    const doc = {
      id: tc.id,
      key: tc.key ?? tc.id,
      title: `[${tc.module}] [${tc.submodule}][${tc.feature}][${tc.typeCode}] - ${tc.assertion}`,
      module: tc.module,
      submodule: tc.submodule,
      feature: tc.feature,
      type_code: tc.typeCode,
      test_case_type: tc.testCaseType,
      priority: tc.priority,
      labels: tc.labels,
      parent: tc.parent ?? null,
      linked: tc.linked ?? null,
      layer: tc.layer,
      affects_versions: tc.affectsVersions,
      preconditions: tc.preconditions,
      steps: tc.steps.map((action, i) => ({
        id: i + 1,
        action,
        expected: i === tc.steps.length - 1 ? tc.expected : "The application continues without error.",
      })),
      comments: tc.comments ?? "None.",
      expected_result: tc.expected,
      actual_result: tc.actual ?? "None.",
      automation: {
        gui: `AutomatedScripts/gui/${tc.id}.spec.ts`,
        api: `AutomatedScripts/api/${tc.id}.spec.ts`,
      },
    };
    writeFile(path.join(DIRS.testc2ai, `${tc.id}.yml`), yamlStringify(doc));
  }
  const yamlCount = countFiles(DIRS.testc2ai, ".yml");
  if (yamlCount !== jsonFiles.length) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `YAML count ${yamlCount} does not match human test cases ${jsonFiles.length}.`,
      requiredStep: "testc2ai",
    });
  }
  state = setGate(state, "testc2ai", "yamlCountMatchesHuman");
  state = completeStep(state, "testc2ai", `${yamlCount} YAML files written to testc2ai/.`);
  return publicStatus(state);
}

export function generateScripts() {
  let state = loadState();
  state = beginStep(state, "automated-scripts");
  const target = state.project?.targetUrl ?? "http://127.0.0.1:43181/sample/login";
  const apiBase = new URL(target).origin;
  const jsonFiles = listFiles(DIRS.testCaseHuman, ".json");
  for (const file of jsonFiles) {
    const tc = JSON.parse(fs.readFileSync(abs(path.join(DIRS.testCaseHuman, file)), "utf8")) as HumanTestCase;
    writeFile(path.join(DIRS.automatedGui, `${tc.id}.spec.ts`), guiSpec(tc, target));
    writeFile(path.join(DIRS.automatedApi, `${tc.id}.spec.ts`), apiSpec(tc, apiBase));
  }
  const gui = countFiles(DIRS.automatedGui, ".ts");
  const api = countFiles(DIRS.automatedApi, ".ts");
  if (gui < jsonFiles.length || api < jsonFiles.length) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: "Every human test case must have GUI and API scripts.",
      requiredStep: "automated-scripts",
    });
  }
  state = setGate(state, "automated-scripts", "guiCount");
  state = setGate(state, "automated-scripts", "apiCount");
  state = completeStep(state, "automated-scripts", `Wrote ${gui} GUI and ${api} API scripts.`);
  return publicStatus(state);
}

export interface SuiteEvent {
  id: string;
  layer: "gui" | "api";
  title: string;
  status: "running" | "passed" | "failed" | "error";
  actual?: string;
  proof?: string;
}

export async function runSuite(): Promise<{ results: SuiteEvent[]; status: ReturnType<typeof publicStatus> }> {
  let state = loadState();
  state = beginStep(state, "execute-suite");
  state.suite = { running: true, passed: 0, failed: 0, skipped: 0, lastMessage: "Starting suite..." };
  saveState(state);

  const jsonFiles = listFiles(DIRS.testCaseHuman, ".json");
  const results: SuiteEvent[] = [];
  const page = await openVisibleBrowser();
  state = setGate(state, "execute-suite", "visibleBrowserOpened");
  saveState(state);
  const targetUrl = state.project?.targetUrl ?? "http://127.0.0.1:43181/sample/login";
  const origin = new URL(targetUrl).origin;
  bus.emitEvent(
    "suite:watch",
    `LOCKED: headed suite on this device. Priority=PASS via real flows. Honest retries up to ${MAX_SUITE_ROUNDS} rounds per case; never invent a pass.`,
  );

  // Login once up front for FusionX / auth-gated targets so GUI+API share a real session.
  try {
    const loginNote = await ensureAuthenticatedSession(page, targetUrl);
    bus.emitEvent("suite:watch", `Session ready: ${loginNote}`);
    if (!state.suite) {
      state.suite = { running: true, passed: 0, failed: 0, skipped: 0 };
    }
    state.suite.lastMessage = `Session ready (max ${MAX_SUITE_ROUNDS} honest rounds per case)`;
    saveState(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emitEvent("suite:watch", `Login incomplete — cases will still retry honestly: ${msg}`);
  }

  for (const file of jsonFiles) {
    const tc = JSON.parse(fs.readFileSync(abs(path.join(DIRS.testCaseHuman, file)), "utf8")) as HumanTestCase;
    for (const layer of ["gui", "api"] as const) {
      const event: SuiteEvent = { id: `${tc.id}:${layer}`, layer, title: tc.assertion, status: "running" };
      bus.emitEvent("suite:test", `${tc.id} ${layer} running (up to ${MAX_SUITE_ROUNDS} honest rounds)`, {
        data: event as unknown as Record<string, unknown>,
      });
      try {
        if (layer === "gui") {
          const verdict = await evaluateGuiWithRetries(page, targetUrl, tc);
          const shotRel = path.join(DIRS.proofs, `${tc.id}-gui.png`);
          await page.screenshot({ path: abs(shotRel), fullPage: true }).catch(() => undefined);
          event.status = verdict.ok ? "passed" : "failed";
          event.actual = verdict.actual;
          event.proof = shotRel;
        } else {
          const verdict = await evaluateApiWithRetries(origin, targetUrl, tc);
          event.status = verdict.ok ? "passed" : "failed";
          event.actual = verdict.actual;
          event.proof = verdict.proof ?? "";
        }
      } catch (err) {
        event.status = "error";
        event.actual = err instanceof Error ? err.message : String(err);
      }
      results.push(event);
      if (!state.suite) {
        state.suite = { running: true, passed: 0, failed: 0, skipped: 0 };
      }
      if (event.status === "passed") state.suite.passed += 1;
      else state.suite.failed += 1;
      state.suite.lastMessage = `${event.id} ${event.status}`;
      saveState(state);
      bus.emitEvent("suite:result", `${event.id} ${event.status}`, {
        data: event as unknown as Record<string, unknown>,
      });
    }
  }

  writeFile(path.join(DIRS.reports, "suite-results.json"), JSON.stringify(results, null, 2));
  if (!state.suite) {
    state.suite = { running: false, passed: 0, failed: 0, skipped: 0 };
  }
  writeFile(
    path.join(DIRS.reports, "last-run.md"),
    `# Last run\n\n- Passed: ${state.suite.passed}\n- Failed: ${state.suite.failed}\n- Honest max rounds per case: ${MAX_SUITE_ROUNDS}\n- Rule: try to PASS via real flows; never invent a pass; FAIL only after ${MAX_SUITE_ROUNDS} attempts.\n\n${results
      .map((r) => `- ${r.status.toUpperCase()} ${r.id} — ${r.title} (${r.actual ?? ""})`)
      .join("\n")}\n`,
  );
  state.suite.running = false;
  const passed = state.suite.passed;
  const failed = state.suite.failed;
  state = setGate(state, "execute-suite", "allScriptsRan");
  state = completeStep(
    state,
    "execute-suite",
    `Suite finished. ${passed} passed, ${failed} failed (honest retries ≤${MAX_SUITE_ROUNDS}/case).`,
  );
  return { results, status: publicStatus(state) };
}

export async function exportIssues() {
  let state = loadState();
  state = beginStep(state, "issues-export");
  const raw = readFile(path.join(DIRS.reports, "suite-results.json"));
  const results = raw ? (JSON.parse(raw) as SuiteEvent[]) : [];
  const fails = results.filter((r) => r.status !== "passed");
  const rows: IssueRow[] = fails.map((r) => {
    const id = r.id.split(":")[0];
    const jsonPath = abs(path.join(DIRS.testCaseHuman, `${id}.json`));
    const tc = fs.existsSync(jsonPath) ? (JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HumanTestCase) : null;
    return {
      id: r.id,
      module: tc?.module ?? "Unknown",
      title: r.title,
      status: r.status === "failed" ? "Fail" : "Error",
      priority: tc?.priority ?? "Medium",
      layer: r.layer,
      preconditions: tc?.preconditions.join(" | ") ?? "",
      steps: tc?.steps.join(" | ") ?? "",
      expected: tc?.expected ?? "",
      actual: r.actual ?? "",
      proof: r.proof ?? "",
    };
  });
  const files = await writeIssuesWorkbook(rows);
  state.issues = { count: rows.length, csvPath: files.csv, xlsxPath: files.xlsx };
  state = setGate(state, "issues-export", "xlsxExists");
  state = setGate(state, "issues-export", "csvExists");
  state = completeStep(state, "issues-export", `${rows.length} issues exported with proof columns.`);
  return { ...publicStatus(state), files, rows };
}

export async function fileBugs() {
  let state = loadState();
  state = beginStep(state, "jira-bugs");
  const raw = readFile(path.join(DIRS.reports, "QAFusionX-Issues.csv"));
  const resultsRaw = readFile(path.join(DIRS.reports, "suite-results.json"));
  const results = resultsRaw ? (JSON.parse(resultsRaw) as SuiteEvent[]) : [];
  const fails = results.filter((r) => r.status !== "passed");
  const cfg = readJiraConfig({
    baseUrl: state.project?.jiraBaseUrl,
    projectKey: state.project?.jiraProjectKey,
  });
  const filed: string[] = [];
  for (const fail of fails) {
    const id = fail.id.split(":")[0];
    const jsonPath = abs(path.join(DIRS.testCaseHuman, `${id}.json`));
    const tc = fs.existsSync(jsonPath) ? (JSON.parse(fs.readFileSync(jsonPath, "utf8")) as HumanTestCase) : null;
    const subject = `[BUG] [${tc?.module ?? "Module"}] ${fail.title}`;
    const description = bugDescription({
      precondition: tc?.preconditions.join("\n") ?? "User is logged in.",
      steps: tc?.steps ?? ["Reproduce from automated run."],
      expected: tc?.expected ?? "The behaviour described by the test case.",
      actual: fail.actual ?? "See proof.",
      proof: fail.proof ?? "See reports/proof",
    });
    const md = `# ${subject}

## Precondition
${tc?.preconditions.map((p, i) => `${i + 1}. ${p}`).join("\n") ?? "1. User is logged in."}

## Test Steps
${(tc?.steps ?? ["Reproduce from automated run."]).map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Expected Result
${tc?.expected ?? "The behaviour described by the test case."}

## Actual Result
${fail.actual ?? "See proof."}

## Proof
${fail.proof ?? "See reports/proof"}
`;
    writeFile(path.join(DIRS.bugs, `${id}-${fail.layer}.md`), md);
    const payload = { summary: subject, description, issuetype: "Bug", labels: ["qafusionx", "automated"] };
    if (cfg) {
      try {
        const created = await createIssue(cfg, payload);
        filed.push(`${fail.id} → ${created.key}`);
        writeFile(path.join(DIRS.jiraBugs, `${id}-${fail.layer}.json`), JSON.stringify(created, null, 2));
        const proofPath = fail.proof?.trim();
        if (proofPath) {
          const candidates = [proofPath, abs(proofPath), abs(path.join("reports/proof", proofPath))];
          for (const p of candidates) {
            if (fs.existsSync(p) && p.toLowerCase().endsWith(".png")) {
              await attachProof(cfg, created.key, p);
              break;
            }
          }
        }
      } catch (err) {
        writeOfflinePayload("bug", `${id}-${fail.layer}`, { payload, error: String(err) });
        filed.push(`${fail.id} → OFFLINE`);
      }
    } else {
      writeOfflinePayload("bug", `${id}-${fail.layer}`, payload);
      writeFile(path.join(DIRS.jiraBugs, `${id}-${fail.layer}.json`), JSON.stringify({ mode: "offline", payload }, null, 2));
      filed.push(`${fail.id} → offline payload`);
    }
  }
  state.bugs = { count: fails.length };
  state = setGate(state, "jira-bugs", "bugsFiledOrOffline");
  state = completeStep(state, "jira-bugs", `${fails.length} bug tickets filed or saved offline.`);
  void raw;
  return { ...publicStatus(state), filed };
}

/** Upload all proof PNGs to open Jira bugs (skips filenames already attached). Required after headed QA. */
export async function attachBugProofs(bugKeys?: string[]) {
  const packKeys = bugKeys ?? [...new Set(Object.values(STORY_BUG_MAP).flat())].sort();
  const attachRoot = abs(path.join("jira", "attachments"));
  fs.mkdirSync(attachRoot, { recursive: true });
  const manifest: Record<string, string[]> = {};
  for (const bug of packKeys) {
    const dir = path.join(attachRoot, bug);
    fs.mkdirSync(dir, { recursive: true });
    manifest[bug] = [];
    const seen = new Set<string>();
    for (const src of filesForBug(bug)) {
      const dest = path.join(dir, path.basename(src));
      if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
      if (!seen.has(dest)) {
        seen.add(dest);
        manifest[bug].push(dest);
      }
    }
  }
  writeFile(path.join(DIRS.reports, "jira-attachment-manifest.json"), JSON.stringify({ at: new Date().toISOString(), manifest }, null, 2));

  const out = await attachAllBugProofs(packKeys);
  if (!out.cfg) {
    return {
      ok: false,
      error:
        "Jira not configured (JIRA_API_TOKEN / JIRA_EMAIL / JIRA_BASE_URL). Proof PNGs packaged under jira/attachments/. Run: py scripts/upload-jira-bug-proofs.py after refreshing token.",
      manifest,
    };
  }
  const summary = out.results.map((r) => ({
    bug: r.bugKey,
    uploaded: r.uploaded.length,
    skipped: r.skipped.length,
    errors: r.errors,
  }));
  writeFile(path.join(DIRS.reports, "jira-attachment-log.json"), JSON.stringify({ at: new Date().toISOString(), results: out.results }, null, 2));
  const totalUploaded = out.results.reduce((n, r) => n + r.uploaded.length, 0);
  return { ok: totalUploaded > 0 || out.results.some((r) => r.skipped.length > 0), summary, results: out.results, manifest };
}

/** Generate iPay Lite Testing.xlsx-format workbook (≥110 rows × 11 story sheets for PF-57868). */
export function generateIpayExcel() {
  const out = generatePf57868IpayExcel();
  return {
    ok: out.ok,
    paths: out.paths,
    stdout: out.stdout,
    stderr: out.stderr,
    columns: ["Area", "Concern", "User story", "Status", "Change made?", "Change / verification notes (English)", "Commit / cycle"],
    note: out.ok
      ? "Saved to Downloads, reports/, and artifacts/. Same column contract as iPay Lite Testing.xlsx."
      : "Generator failed — see reports/ipay-lite-generate-log.txt",
  };
}

export { resetState, closeBrowser, loadState, json, STEPS, browserSessionAlive };

export function artifactTree(rel = ""): { name: string; type: "file" | "dir"; path: string }[] {
  const dir = abs(rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).map((ent) => ({
    name: ent.name,
    type: ent.isDirectory() ? "dir" : "file",
    path: path.join(rel, ent.name),
  }));
}

export function readArtifact(rel: string): { path: string; content: string; binary: boolean } {
  const file = abs(rel);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    throw new Error("Not a file");
  }
  const ext = path.extname(file).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".xlsx"].includes(ext)) {
    return { path: rel, content: fs.readFileSync(file).toString("base64"), binary: true };
  }
  return { path: rel, content: fs.readFileSync(file, "utf8"), binary: false };
}
