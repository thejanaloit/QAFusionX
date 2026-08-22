export type StepStatus = "locked" | "available" | "in_progress" | "done";
export type StepMode = "ask" | "agent";

export interface StepDefinition {
  id: number;
  key: string;
  title: string;
  mode: StepMode;
  summary: string;
  agentInstructions: string;
  gates: string[];
  produces: string[];
}

/**
 * Ordered, non-skippable QAFusionX pipeline.
 * Completing step N is the only way to unlock step N+1.
 */
export const STEPS: StepDefinition[] = [
  {
    id: 1,
    key: "ask-project",
    title: "Ask — project identity & target",
    mode: "ask",
    summary:
      "Mandatory Ask-mode question: what is this project, what must be tested, and the live URL plus a screenshot.",
    agentInstructions:
      "Stay in Ask mode. Ask: (1) project name, (2) what to test, (3) the application URL, (4) a screenshot of the target. Do not continue until all four are provided.",
    gates: ["projectName", "whatToTest", "targetUrl", "screenshot"],
    produces: ["General/01-target.md", "General/target-screenshot"],
  },
  {
    id: 2,
    key: "ask-user-stories",
    title: "Ask — upload user stories",
    mode: "ask",
    summary:
      "Mandatory Ask-mode question: provide user stories as a zip, a Jira link, or generate-from-system.",
    agentInstructions:
      "Stay in Ask mode. Ask the user to choose exactly one source: (1) zip/files, (2) Jira link, (3) generate from the crawled system. This question is compulsory whenever QAFusionX is used.",
    gates: ["sourceChosen", "sourcePayload"],
    produces: ["User stories/"],
  },
  {
    id: 3,
    key: "persist-workspace",
    title: "Persist User stories + General brief",
    mode: "agent",
    summary:
      "Create the User stories and General directories and save every story plus the target brief markdown.",
    agentInstructions:
      "Write every user story into User stories/. Write General/01-target.md describing what will be tested and the URL. Tick this step only after files exist on disk.",
    gates: ["userStoriesDir", "generalBrief", "storiesCount"],
    produces: ["User stories/", "General/01-target.md"],
  },
  {
    id: 4,
    key: "round-1-crawl",
    title: "Round 1 — capture, analyze, navigate every screen",
    mode: "agent",
    summary:
      "Open the target URL. Capture every screen and popup. After each shot, reason over it, write a reference MD of every button, then choose the next click. Continue until no unvisited screen remains.",
    agentInstructions:
      "LOCKED: open a SEPARATE visible browser window on THIS user's device. Do not run the crawl as a silent pipeline job. The user watches every screen. Use a high-end reasoning/vision model. Loop: capture → save PNG under Screens/round one/screenshots → read the image → write Screens/round one/references/<n>.md listing EVERY button and reachable screen → update the living plan → click the next unvisited control (prefer first unvisited). Include popups/modals/drawers. Do not stop early.",
    gates: ["openedTarget", "visibleBrowserOpened", "atLeastOneScreen", "referencesMatchScreenshots", "noPendingQueue"],
    produces: ["Screens/round one/screenshots/", "Screens/round one/references/"],
  },
  {
    id: 5,
    key: "round-1-plan",
    title: "Round 1 — living plan complete",
    mode: "agent",
    summary:
      "The Round 1 plan is a continuously updated todo list of every discovered screen and remaining path.",
    agentInstructions:
      "Screens/round one/plan/living-plan.md and todo.md must list every visited node, every skipped/blocked path, and remaining work. Status must be complete before Round 2.",
    gates: ["livingPlan", "todoList", "coverageNote"],
    produces: ["Screens/round one/plan/living-plan.md", "Screens/round one/plan/todo.md"],
  },
  {
    id: 6,
    key: "round-2-crawl",
    title: "Round 2 — missed screens & second pass",
    mode: "agent",
    summary:
      "Re-read Round 1. Visit anything missed. Recreate the Round 1 directory structure under Round 2.",
    agentInstructions:
      "LOCKED: keep the same SEPARATE visible browser window on this user's device. Mirror Round 1 structure under Screens/round two/. Hunt for missed popups, error states, empty states, validation, and alternate buttons. Same capture → refer → MD → click loop. Never switch to a silent/headless pass.",
    gates: ["round2Screens", "round2References", "missedReview"],
    produces: ["Screens/round two/screenshots/", "Screens/round two/references/", "Screens/round two/plan/"],
  },
  {
    id: 7,
    key: "generate-user-stories",
    title: "Generate user stories from the crawled system",
    mode: "agent",
    summary:
      "Only when Question 2 was “generate from our own system”. After Round 2, write GeneratedUser stories/ from every captured screen. Later testing is based on those stories only.",
    agentInstructions:
      "This step runs ONLY if the user chose generate-from-system. After Round 2, create GeneratedUser stories/. Use a high-end reasoning model with every Round 1 and Round 2 screenshot + reference MD. Write one user story per capability (As a / I want / so that + acceptance). Do not start the system map or test cases until this directory has real stories. If the user uploaded zip or Jira stories, this step is marked N/A automatically — do not invent a second story set.",
    gates: ["directoryReady", "minGeneratedStories", "storiesFromCrawl"],
    produces: ["GeneratedUser stories/"],
  },
  {
    id: 8,
    key: "system-map",
    title: "Complete end-to-end system map",
    mode: "agent",
    summary:
      "Write a long, exhaustive markdown map of the whole system: every screen, every path, how to go from anywhere to anywhere.",
    agentInstructions:
      "Screens/complete-system-map.md must NOT be short. It is the full idea of the product: modules, screens, buttons, flows, data, empty/loading/error states, and a path matrix. Thousands of words if the product warrants it.",
    gates: ["systemMapExists", "systemMapMinLength"],
    produces: ["Screens/complete-system-map.md"],
  },
  {
    id: 9,
    key: "human-testcases",
    title: "Human-readable test cases (Jira format)",
    mode: "agent",
    summary:
      "Using the system map AND user stories, write full-system test cases a human QA can read — same shape as a Jira functional ticket.",
    agentInstructions:
      "Compulsory: use a high-end reasoning model with BOTH the system map and the active user stories. If Question 2 was generate-from-system, the active set is GeneratedUser stories/ — not the placeholder in User stories/. Otherwise use User stories/. Write one markdown file per test case under testCase Human/. Format: bracketed title, affects versions, preconditions, steps, comments, expected, actual, labels, type, priority, parent, linked items. Also write General/human-qa-research.md after checking how a human QA would approach this product.",
    gates: ["minTestcases", "formatValid", "humanQaResearch"],
    produces: ["testCase Human/", "General/human-qa-research.md"],
  },
  {
    id: 10,
    key: "jira-upload-testcases",
    title: "Upload test cases to Jira",
    mode: "agent",
    summary: "Create Jira issues for every human test case (or write offline payloads if Jira is not configured).",
    agentInstructions:
      "POST each test case to Jira with the functional-test fields. If credentials are missing, write jira/payloads/*.json and mark the offline fallback — never skip the step.",
    gates: ["allUploadedOrOffline"],
    produces: ["jira/testcases/", "jira/upload-log.md"],
  },
  {
    id: 11,
    key: "testc2ai",
    title: "Convert to YAML (testc2ai)",
    mode: "agent",
    summary:
      "Store every human test case as a machine-readable YAML file so an AI runner can execute it.",
    agentInstructions:
      "One YAML file per test case under testc2ai/. Must include id, title, module, preconditions, steps with expected, labels, gui locator hints, and api hints.",
    gates: ["yamlCountMatchesHuman"],
    produces: ["testc2ai/"],
  },
  {
    id: 12,
    key: "automated-scripts",
    title: "Generate AutomatedScripts (GUI + API)",
    mode: "agent",
    summary: "Generate Playwright GUI specs and HTTP API specs for every YAML test case.",
    agentInstructions:
      "AutomatedScripts/gui and AutomatedScripts/api. Every YAML case must have both a GUI script and an API script (API may assert 501/not-exposed when the product has no matching endpoint, but the file must exist).",
    gates: ["guiCount", "apiCount"],
    produces: ["AutomatedScripts/gui/", "AutomatedScripts/api/"],
  },
  {
    id: 13,
    key: "execute-suite",
    title: "Execute automated suite (visible GUI)",
    mode: "agent",
    summary:
      "Open a separate browser on this user's device and run every GUI script there. Also stream results to the Control Console.",
    agentInstructions:
      "LOCKED: open a separate visible browser window on this user's device and run GUI scripts there. Do not execute GUI tests as a silent pipeline job. API scripts may run without a window. Do not mark complete until every script has a pass/fail/error outcome. The Control Console live runner must receive events.",
    gates: ["visibleBrowserOpened", "allScriptsRan"],
    produces: ["reports/suite-results.json", "reports/last-run.md"],
  },
  {
    id: 14,
    key: "issues-export",
    title: "Export issues CSV/XLSX with proof",
    mode: "agent",
    summary:
      "Every failing case becomes a row in an Excel/CSV workbook with attached proof (screenshot path, trace, log). Shape matches iPay Lite Testing.xlsx style.",
    agentInstructions:
      "Write reports/QAFusionX-Issues.xlsx and reports/QAFusionX-Issues.csv. Columns: id, module, title, status, preconditions, steps, expected, actual, proof. Include every failure. Passes may be listed separately. Proof paths must be real files under reports/proof/.",
    gates: ["xlsxExists", "csvExists"],
    produces: ["reports/QAFusionX-Issues.xlsx", "reports/QAFusionX-Issues.csv"],
  },
  {
    id: 15,
    key: "jira-bugs",
    title: "File Jira bug tickets with proof",
    mode: "agent",
    summary:
      "Open a bug ticket per issue: subject, precondition, test steps, expected, actual, proof.",
    agentInstructions:
      "One bug per confirmed failure. Structure must include subject, precondition, test steps, expected result, actual result, and proof attachment. Offline payloads if Jira is not configured.",
    gates: ["bugsFiledOrOffline"],
    produces: ["jira/bugs/", "bugs/"],
  },
];

export function stepById(id: number): StepDefinition {
  const step = STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown step id ${id}`);
  return step;
}

export function stepByKey(key: string): StepDefinition {
  const step = STEPS.find((s) => s.key === key);
  if (!step) throw new Error(`Unknown step key ${key}`);
  return step;
}
