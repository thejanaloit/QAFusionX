import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MCP_INSTRUCTIONS } from "../protocol.ts";
import * as actions from "../actions/index.ts";
import { isBlocked } from "../workflow/engine.ts";
import { abs } from "../workflow/paths.ts";
import { STEPS } from "../workflow/steps.ts";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  if (isBlocked(err)) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify(err, null, 2) }],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }] };
}

export function createQaFusionXServer(): McpServer {
  const server = new McpServer(
    { name: "QAFusionX", version: "1.0.0" },
    {
      instructions: MCP_INSTRUCTIONS,
      capabilities: { tools: {}, resources: {}, prompts: {} },
    },
  );

  server.registerTool(
    "qafusionx_status",
    {
      title: "QAFusionX status",
      description:
        "Always-allowed. Returns the numbered todo list, Ask-mode lock, current step, and missing gates. Call this at the start of every turn.",
    },
    async () => ok(actions.status()),
  );

  server.registerTool(
    "qafusionx_begin",
    {
      title: "Begin QAFusionX (Ask mode)",
      description:
        "Start a run and lock Ask mode. Returns Question 1. You MUST switch Cursor to Ask mode and ask the user what the project is, what to test, the URL, and a screenshot.",
    },
    async () => ok(actions.begin()),
  );

  server.registerTool(
    "qafusionx_submit_project",
    {
      title: "Submit Question 1 — project & target",
      description: "Record project name, what to test, live URL, and screenshot. Unlocks Question 2 only.",
      inputSchema: {
        name: z.string(),
        whatToTest: z.string(),
        targetUrl: z.string().url(),
        screenshotPath: z.string().optional(),
        screenshotBase64: z.string().optional(),
        affectsVersion: z.string().optional(),
        jiraBaseUrl: z.string().optional(),
        jiraProjectKey: z.string().optional(),
        assignee: z.string().optional(),
        reporter: z.string().optional(),
        parent: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return ok(actions.submitProject(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_submit_user_stories",
    {
      title: "Submit Question 2 — user stories",
      description:
        "MANDATORY second Ask-mode step. source=zip|jira|generate. For zip pass zipPath or files[]. For jira pass jiraLink. For generate records the choice; stories are drafted after the crawl.",
      inputSchema: {
        source: z.enum(["zip", "jira", "generate"]),
        zipPath: z.string().optional(),
        files: z.array(z.object({ name: z.string(), content: z.string() })).optional(),
        jiraLink: z.string().optional(),
        jiraBaseUrl: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return ok(await actions.submitUserStories(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_persist_workspace",
    {
      title: "Step 3 — persist User stories + General",
      description: "Creates User stories/ and General/ and writes the target brief. Required before crawling.",
    },
    async () => {
      try {
        return ok(actions.persistWorkspace());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_open_target",
    {
      title: "Open the target URL",
      description: "Opens the recorded application URL in the headed/headless crawler. Round 1.",
    },
    async () => {
      try {
        return ok(await actions.crawlOpen());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_capture_screen",
    {
      title: "Capture current screen",
      description:
        "Screenshot the current page (including popups). Saves under Screens/round one|two/screenshots. Then YOU must read the PNG with a high-end reasoning model and call qafusionx_save_screen_reference.",
      inputSchema: {
        round: z.union([z.literal(1), z.literal(2)]),
        analysis: z.string().optional(),
        parentId: z.string().optional(),
        clickedControl: z.string().optional(),
        isPopup: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        return ok(await actions.crawlCapture(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_save_screen_reference",
    {
      title: "Save screenshot analysis MD",
      description:
        "After reading the PNG, save the reference MD listing every button and reachable screen. Update pending/visited controls.",
      inputSchema: {
        screenId: z.string(),
        analysis: z.string(),
        pendingControls: z.array(z.string()).optional(),
        visitedControls: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        return ok(actions.saveScreenReference(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_click",
    {
      title: "Click a control by index",
      description:
        "Click the interactive control at index from the last capture. Then immediately capture the next screen or popup.",
      inputSchema: {
        index: z.number().int().nonnegative(),
        label: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return ok(await actions.crawlClick(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_fill",
    {
      title: "Fill a field",
      inputSchema: {
        locator: z.string(),
        value: z.string(),
      },
    },
    async (args) => {
      try {
        return ok(await actions.crawlFill(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_complete_round",
    {
      title: "Complete a crawl round",
      description: "Mark Round 1 (and its living plan) or Round 2 complete. Fails if screenshots lack references.",
      inputSchema: {
        round: z.union([z.literal(1), z.literal(2)]),
        coverageNote: z.string(),
      },
    },
    async (args) => {
      try {
        return ok(actions.completeRound(args.round, args.coverageNote));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_draft_generated_user_stories",
    {
      title: "Draft GeneratedUser stories from the crawl",
      description:
        "ONLY when Question 2 was generate-from-system. After Round 2, create GeneratedUser stories/ and draft one user story per discovered screen/flow. Later test cases must use this directory.",
    },
    async () => {
      try {
        return ok(actions.draftGeneratedUserStories());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_save_generated_user_story",
    {
      title: "Save or refine one generated user story",
      description: "Write one markdown user story into GeneratedUser stories/. Method 3 only.",
      inputSchema: {
        title: z.string(),
        body: z.string(),
      },
    },
    async (args) => {
      try {
        return ok(actions.saveGeneratedUserStory(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_complete_generated_user_stories",
    {
      title: "Complete generated user stories step",
      description:
        "Gate: at least 3 stories in GeneratedUser stories/ when method 3 was chosen. Marks N/A automatically for zip/Jira.",
    },
    async () => {
      try {
        return ok(actions.completeGeneratedUserStories());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_save_system_map",
    {
      title: "Save complete system map",
      description:
        "Write Screens/complete-system-map.md. Must be long and exhaustive (minimum 2500 characters). Cover every path.",
      inputSchema: { markdown: z.string() },
    },
    async (args) => {
      try {
        return ok(actions.saveSystemMap(args.markdown));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_save_human_testcase",
    {
      title: "Save one Jira-format human test case",
      description:
        "Writes testCase Human/<id>.md. Title shape: [Module] [Sub][Feature][FP] - Validate that ... Required: preconditions, steps, expected, actual, labels, type, priority.",
      inputSchema: {
        id: z.string(),
        key: z.string().optional(),
        module: z.string(),
        submodule: z.string(),
        feature: z.string(),
        typeCode: z.enum(["FP", "NF", "API", "GUI"]),
        assertion: z.string(),
        affectsVersions: z.string(),
        testCaseType: z.string(),
        priority: z.enum(["Highest", "High", "Medium", "Low"]),
        labels: z.array(z.string()),
        parent: z.string().optional(),
        linked: z.string().optional(),
        assignee: z.string().optional(),
        reporter: z.string().optional(),
        preconditions: z.array(z.string()),
        steps: z.array(z.string()),
        comments: z.string().optional(),
        expected: z.string(),
        actual: z.string().optional(),
        layer: z.enum(["gui", "api", "both"]),
      },
    },
    async (args) => {
      try {
        return ok(actions.saveHumanTestCase(args));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_save_human_qa_research",
    {
      title: "Save human-QA research notes",
      description: "Required before completing human test cases. Research how a human QA would test this product.",
      inputSchema: { markdown: z.string() },
    },
    async (args) => ok(actions.saveHumanQaResearch(args.markdown)),
  );

  server.registerTool(
    "qafusionx_complete_human_testcases",
    {
      title: "Complete human test case step",
      description: "Gate: at least 5 valid Jira-format cases plus General/human-qa-research.md.",
    },
    async () => {
      try {
        return ok(actions.completeHumanTestCases());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_upload_jira_testcases",
    {
      title: "Upload test cases to Jira",
      description: "Creates Jira issues or writes offline payloads under jira/payloads if credentials are missing.",
    },
    async () => {
      try {
        return ok(await actions.uploadJiraTestCases());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_convert_yaml",
    {
      title: "Convert test cases to YAML (testc2ai)",
      description: "One YAML file per human test case, machine-readable for the AI runner.",
    },
    async () => {
      try {
        return ok(actions.convertYaml());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_generate_scripts",
    {
      title: "Generate AutomatedScripts (GUI + API)",
      description: "Playwright GUI specs and HTTP API specs for every YAML/human case.",
    },
    async () => {
      try {
        return ok(actions.generateScripts());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_run_suite",
    {
      title: "Run the automated suite",
      description: "Executes every generated script. Results stream to the Control Console GUI.",
    },
    async () => {
      try {
        return ok(await actions.runSuite());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_export_issues",
    {
      title: "Export issues CSV/XLSX with proof",
      description: "Writes reports/QAFusionX-Issues.xlsx and .csv. Every failure includes proof.",
    },
    async () => {
      try {
        return ok(await actions.exportIssues());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_file_bugs",
    {
      title: "File Jira bug tickets",
      description:
        "One bug per failure: subject, precondition, test steps, expected result, actual result, and proof.",
    },
    async () => {
      try {
        return ok(await actions.fileBugs());
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "qafusionx_reset",
    {
      title: "Reset workflow",
      description: "Deletes artifacts and re-engages the Ask-mode lock. Destructive.",
    },
    async () => ok(actions.resetState()),
  );

  server.registerResource(
    "qafusionx-protocol",
    "qafusionx://protocol",
    {
      title: "QAFusionX protocol",
      description: "Mandatory Ask-mode lock and sequential workflow rules.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{ uri: "qafusionx://protocol", text: MCP_INSTRUCTIONS, mimeType: "text/markdown" }],
    }),
  );

  server.registerResource(
    "qafusionx-status",
    "qafusionx://status",
    {
      title: "Live workflow status",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "qafusionx://status",
          text: JSON.stringify(actions.status(), null, 2),
          mimeType: "application/json",
        },
      ],
    }),
  );

  server.registerResource(
    "qafusionx-steps",
    "qafusionx://steps",
    { title: "Step catalogue", mimeType: "application/json" },
    async () => ({
      contents: [{ uri: "qafusionx://steps", text: JSON.stringify(STEPS, null, 2), mimeType: "application/json" }],
    }),
  );

  server.registerPrompt(
    "qafusionx_ask_mode",
    {
      title: "Ask-mode opening",
      description: "Use this the moment QAFusionX is connected. Forces the two mandatory questions.",
    },
    async () => ({
      description: "Mandatory Ask-mode start",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Switch to Ask mode. Follow QAFusionX.\n\n${MCP_INSTRUCTIONS}\n\nCall qafusionx_begin now, then ask Question 1, then Question 2. Do not skip.`,
          },
        },
      ],
    }),
  );

  void abs;
  return server;
}
