import type { StepStatus } from "./steps.ts";

export type StorySource = "zip" | "jira" | "generate";

export interface GateMap {
  [gate: string]: boolean;
}

export interface StepRuntime {
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  note?: string;
  gates: GateMap;
}

export interface ProjectInfo {
  name: string;
  whatToTest: string;
  targetUrl: string;
  screenshotPath?: string;
  affectsVersion?: string;
  jiraBaseUrl?: string;
  jiraProjectKey?: string;
  assignee?: string;
  reporter?: string;
  parent?: string;
}

export interface UserStoriesInfo {
  source: StorySource;
  jiraLink?: string;
  zipPath?: string;
  count: number;
  generatePending?: boolean;
}

export interface ScreenNode {
  id: string;
  round: 1 | 2;
  seq: number;
  url: string;
  title: string;
  screenshotRel: string;
  referenceRel: string;
  parentId?: string;
  clickedControl?: string;
  buttons: string[];
  pendingControls: string[];
  visitedControls: string[];
  isPopup?: boolean;
  notes?: string;
}

export interface WorkflowState {
  version: 1;
  runId: string;
  createdAt: string;
  updatedAt: string;
  askMode: {
    required: true;
    projectAsked: boolean;
    projectAnswered: boolean;
    storiesAsked: boolean;
    storiesAnswered: boolean;
    unlocked: boolean;
  };
  currentStepId: number;
  steps: Record<string, StepRuntime>;
  project?: ProjectInfo;
  userStories?: UserStoriesInfo;
  screens: ScreenNode[];
  crawlQueue: string[];
  suite?: {
    running: boolean;
    passed: number;
    failed: number;
    skipped: number;
    lastMessage?: string;
  };
  issues?: {
    count: number;
    csvPath?: string;
    xlsxPath?: string;
  };
  bugs?: {
    count: number;
  };
}

export interface BlockError {
  blocked: true;
  code: "ASK_MODE" | "STEP_GATE" | "VALIDATION";
  message: string;
  requiredStep?: string;
  missingGates?: string[];
  askBanner?: string;
}
