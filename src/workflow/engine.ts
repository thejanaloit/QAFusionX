import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ASK_MODE_BANNER } from "../protocol.ts";
import { bus } from "../events.ts";
import { STEPS, stepById, stepByKey, type StepDefinition } from "./steps.ts";
import { abs, ensureLayout, writeFile } from "./paths.ts";
import type { BlockError, GateMap, StepRuntime, WorkflowState } from "./types.ts";

const STATE_REL = "state.json";

function now(): string {
  return new Date().toISOString();
}

function emptyGates(def: StepDefinition): GateMap {
  return Object.fromEntries(def.gates.map((g) => [g, false]));
}

function freshState(): WorkflowState {
  const steps: Record<string, StepRuntime> = {};
  for (const def of STEPS) {
    steps[def.key] = {
      status: def.id === 1 ? "available" : "locked",
      gates: emptyGates(def),
    };
  }
  return {
    version: 1,
    runId: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now(),
    askMode: {
      required: true,
      projectAsked: false,
      projectAnswered: false,
      storiesAsked: false,
      storiesAnswered: false,
      unlocked: false,
    },
    currentStepId: 1,
    steps,
    screens: [],
    crawlQueue: [],
  };
}

export function loadState(): WorkflowState {
  const file = abs(STATE_REL);
  if (!fs.existsSync(file)) return freshState();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as WorkflowState;
    return migrateState(parsed);
  } catch {
    return freshState();
  }
}

function migrateState(state: WorkflowState): WorkflowState {
  let dirty = false;
  for (const def of STEPS) {
    if (!state.steps[def.key]) {
      const prev = def.id > 1 ? STEPS.find((s) => s.id === def.id - 1) : undefined;
      const prevDone = prev ? state.steps[prev.key]?.status === "done" : false;
      state.steps[def.key] = {
        status: prevDone ? "available" : "locked",
        gates: emptyGates(def),
      };
      dirty = true;
    } else {
      for (const gate of def.gates) {
        if (state.steps[def.key].gates[gate] === undefined) {
          state.steps[def.key].gates[gate] = false;
          dirty = true;
        }
      }
    }
  }
  const generated = state.steps["generate-user-stories"];
  if (
    generated &&
    generated.status !== "done" &&
    state.userStories?.source !== "generate" &&
    (state.steps["round-2-crawl"]?.status === "done" || state.steps["system-map"]?.status === "done")
  ) {
    generated.status = "done";
    generated.note = "N/A — user supplied stories via zip or Jira.";
    for (const gate of Object.keys(generated.gates)) generated.gates[gate] = true;
    dirty = true;
  }
  if (dirty) saveState(state);
  return state;
}

export function saveState(state: WorkflowState): WorkflowState {
  state.updatedAt = now();
  ensureLayout();
  fs.writeFileSync(abs(STATE_REL), JSON.stringify(state, null, 2), "utf8");
  return state;
}

export function resetState(): WorkflowState {
  const artifacts = abs(".");
  if (fs.existsSync(artifacts)) {
    fs.rmSync(artifacts, { recursive: true, force: true });
  }
  ensureLayout();
  const state = freshState();
  saveState(state);
  writeStepFile(1, "available", "Run reset. Ask mode lock is on.");
  bus.emitEvent("reset", "Workflow reset. Ask mode lock engaged.", { stepId: 1 });
  return state;
}

export function isBlocked(error: unknown): error is BlockError {
  return Boolean(error && typeof error === "object" && (error as BlockError).blocked);
}

export class WorkflowBlocked extends Error implements BlockError {
  blocked = true as const;
  code: BlockError["code"];
  requiredStep?: string;
  missingGates?: string[];
  askBanner?: string;

  constructor(init: Omit<BlockError, "blocked">) {
    super(init.message);
    this.name = "WorkflowBlocked";
    this.code = init.code;
    this.requiredStep = init.requiredStep;
    this.missingGates = init.missingGates;
    this.askBanner = init.askBanner;
  }

  toJSON(): BlockError {
    return {
      blocked: true,
      code: this.code,
      message: this.message,
      requiredStep: this.requiredStep,
      missingGates: this.missingGates,
      askBanner: this.askBanner,
    };
  }
}

function previousDone(state: WorkflowState, stepId: number): boolean {
  if (stepId <= 1) return true;
  const prev = stepById(stepId - 1);
  return state.steps[prev.key]?.status === "done";
}

export function assertCanEnter(state: WorkflowState, key: string): StepDefinition {
  const def = stepByKey(key);

  if (def.id > 2 && !state.askMode.unlocked) {
    throw new WorkflowBlocked({
      code: "ASK_MODE",
      message:
        "ASK MODE LOCK. Complete Question 1 (project + URL + screenshot) and Question 2 (user stories) before any later step.",
      requiredStep: state.askMode.projectAnswered ? "ask-user-stories" : "ask-project",
      askBanner: ASK_MODE_BANNER,
    });
  }

  if (def.id === 2 && !state.askMode.projectAnswered) {
    throw new WorkflowBlocked({
      code: "ASK_MODE",
      message: "Question 1 is not answered. Ask for the project, what to test, the URL, and a screenshot first.",
      requiredStep: "ask-project",
      askBanner: ASK_MODE_BANNER,
    });
  }

  if (!previousDone(state, def.id) && def.id > 1) {
    const prev = stepById(def.id - 1);
    throw new WorkflowBlocked({
      code: "STEP_GATE",
      message: `BLOCKED: Step ${prev.id} (${prev.title}) is not DONE. Completing the previous step is compulsory. You cannot skip.`,
      requiredStep: prev.key,
    });
  }

  const runtime = state.steps[def.key];
  if (runtime.status === "locked") {
    throw new WorkflowBlocked({
      code: "STEP_GATE",
      message: `Step ${def.id} is locked. Finish the previous step and write the tick in step-by-step/.`,
      requiredStep: def.id > 1 ? stepById(def.id - 1).key : def.key,
    });
  }

  return def;
}

export function beginStep(state: WorkflowState, key: string): WorkflowState {
  const def = assertCanEnter(state, key);
  const runtime = state.steps[def.key];
  if (runtime.status !== "done") {
    runtime.status = "in_progress";
    runtime.startedAt ??= now();
    state.currentStepId = def.id;
    writeStepFile(def.id, "in_progress", runtime.note ?? "In progress.");
    bus.emitEvent("step:start", `Step ${def.id} started: ${def.title}`, { stepId: def.id });
  }
  return saveState(state);
}

export function setGate(state: WorkflowState, key: string, gate: string, value = true): WorkflowState {
  const def = stepByKey(key);
  if (!def.gates.includes(gate)) {
    throw new Error(`Unknown gate "${gate}" on step ${key}`);
  }
  state.steps[def.key].gates[gate] = value;
  return saveState(state);
}

export function missingGates(state: WorkflowState, key: string): string[] {
  const def = stepByKey(key);
  const gates = state.steps[def.key].gates;
  return def.gates.filter((g) => !gates[g]);
}

export function completeStep(state: WorkflowState, key: string, note?: string): WorkflowState {
  const def = stepByKey(key);
  assertCanEnter(state, key);
  const missing = missingGates(state, key);
  if (missing.length) {
    throw new WorkflowBlocked({
      code: "VALIDATION",
      message: `Cannot complete step ${def.id} (${def.title}). Missing gates: ${missing.join(", ")}`,
      requiredStep: def.key,
      missingGates: missing,
    });
  }
  const runtime = state.steps[def.key];
  runtime.status = "done";
  runtime.completedAt = now();
  if (note) runtime.note = note;

  writeStepFile(def.id, "done", note ?? "All gates passed.");

  const next = STEPS.find((s) => s.id === def.id + 1);
  if (next && state.steps[next.key].status === "locked") {
    state.steps[next.key].status = "available";
    writeStepFile(next.id, "available", "Unlocked by previous step tick.");
  }
  state.currentStepId = next ? next.id : def.id;
  bus.emitEvent("step:done", `Step ${def.id} DONE: ${def.title}`, { stepId: def.id });
  return saveState(state);
}

export function writeStepFile(id: number, status: string, note: string): void {
  const def = stepById(id);
  const tick = status === "done" ? "[x]" : "[ ]";
  const body = `# Step ${String(id).padStart(2, "0")} — ${def.title}

**Status:** ${status === "done" ? "DONE ✓" : status.toUpperCase()}
**Updated:** ${now()}
**Mode:** ${def.mode}

## Tick
${tick} Step ${id} complete

## Note
${note}

## Gates
${def.gates.map((g) => `- [ ] ${g}`).join("\n")}

## Produces
${def.produces.map((p) => `- \`${p}\``).join("\n")}

## Operator instructions
${def.agentInstructions}

> A DONE tick in this file is the only way the next step unlocks. Skipping is forbidden.
`;
  // Preserve checked gates from state if present
  const stateFile = abs(STATE_REL);
  let gatesBlock = def.gates.map((g) => `- [ ] ${g}`).join("\n");
  try {
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as WorkflowState;
      const runtime = state.steps[def.key];
      if (runtime) {
        gatesBlock = def.gates
          .map((g) => `- [${runtime.gates[g] ? "x" : " "}] ${g}`)
          .join("\n");
      }
    }
  } catch {
    // ignore
  }
  const finalBody = body.replace(
    /## Gates\n[\s\S]*?\n\n## Produces/,
    `## Gates\n${gatesBlock}\n\n## Produces`,
  );
  writeFile(path.join("step-by-step", `${String(id).padStart(2, "0")}-${def.key}.md`), finalBody);
}

export function todoList(state: WorkflowState) {
  return STEPS.map((def) => {
    const runtime = state.steps[def.key];
    const mark =
      runtime.status === "done" ? "x" : runtime.status === "in_progress" ? "~" : " ";
    return {
      id: def.id,
      key: def.key,
      title: def.title,
      mode: def.mode,
      status: runtime.status,
      checkbox: `[${mark}] ${def.id}. ${def.title}`,
      missingGates: missingGates(state, def.key),
      note: runtime.note,
    };
  });
}

export function publicStatus(state: WorkflowState) {
  const current = stepById(state.currentStepId);
  return {
    runId: state.runId,
    updatedAt: state.updatedAt,
    askMode: state.askMode,
    askBanner: state.askMode.unlocked ? null : ASK_MODE_BANNER,
    currentStep: {
      id: current.id,
      key: current.key,
      title: current.title,
      mode: current.mode,
      status: state.steps[current.key].status,
      instructions: current.agentInstructions,
      missingGates: missingGates(state, current.key),
    },
    todos: todoList(state),
    project: state.project ?? null,
    userStories: state.userStories ?? null,
    screenCount: state.screens.length,
    suite: state.suite ?? null,
    issues: state.issues ?? null,
    bugs: state.bugs ?? null,
    rule: "Completing the previous step is compulsory. You cannot skip.",
  };
}
