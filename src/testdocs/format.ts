export interface HumanTestCase {
  id: string;
  key?: string;
  module: string;
  submodule: string;
  feature: string;
  typeCode: "FP" | "NF" | "API" | "GUI";
  assertion: string;
  affectsVersions: string;
  testCaseType: string;
  priority: "Highest" | "High" | "Medium" | "Low";
  labels: string[];
  parent?: string;
  linked?: string;
  assignee?: string;
  reporter?: string;
  preconditions: string[];
  steps: string[];
  comments?: string;
  expected: string;
  actual?: string;
  layer: "gui" | "api" | "both";
}

const TITLE_RE =
  /^#\s+\[[^\]]+]\s+\[[^\]]+]\[[^\]]+]\[[^\]]+]\s+-\s+.+/;

export function formatHumanTestCase(tc: HumanTestCase): string {
  const title = `[${tc.module}] [${tc.submodule}][${tc.feature}][${tc.typeCode}] - ${tc.assertion}`;
  return `# ${title}

**Key:** ${tc.key ?? tc.id}
**Affects versions:** ${tc.affectsVersions}
**Status:** New
**Assignee:** ${tc.assignee ?? "Unassigned"}
**Reporter:** ${tc.reporter ?? "QAFusionX"}
**Labels:** ${tc.labels.join(", ")}
**Test Case Type:** ${tc.testCaseType}
**Priority:** ${tc.priority}
**Parent:** ${tc.parent ?? "—"}
**Linked work items:** ${tc.linked ?? "—"}
**Layer:** ${tc.layer}

## Preconditions
${tc.preconditions.map((p, i) => `${i + 1}. ${p}`).join("\n")}

## Test Steps
${tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Test Comments
${tc.comments ?? "None."}

## Expected Result
${tc.expected}

## Actual Result
${tc.actual ?? "None."}
`;
}

export function validateHumanMarkdown(md: string): string[] {
  const errors: string[] = [];
  const first = md.split("\n").find((l) => l.startsWith("# "));
  if (!first || !TITLE_RE.test(first)) {
    errors.push(
      "Title must match: # [Module] [Submodule][Feature][FP] - Validate that ...",
    );
  }
  for (const heading of [
    "## Preconditions",
    "## Test Steps",
    "## Test Comments",
    "## Expected Result",
    "## Actual Result",
  ]) {
    if (!md.includes(heading)) errors.push(`Missing section ${heading}`);
  }
  for (const field of ["**Affects versions:**", "**Labels:**", "**Test Case Type:**", "**Priority:**"]) {
    if (!md.includes(field)) errors.push(`Missing field ${field}`);
  }
  return errors;
}

export function toYamlDoc(tc: HumanTestCase): string {
  const steps = tc.steps.map((action, i) => ({
    id: i + 1,
    action,
    expected: i === tc.steps.length - 1 ? tc.expected : "The application continues without error.",
  }));
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
    steps,
    comments: tc.comments ?? "None.",
    expected_result: tc.expected,
    actual_result: tc.actual ?? "None.",
    automation: {
      gui: `AutomatedScripts/gui/${tc.id}.spec.ts`,
      api: `AutomatedScripts/api/${tc.id}.spec.ts`,
    },
  };
  return stringifyYaml(doc);
}

function stringifyYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    if (value.includes("\n") || /[:#]/.test(value) || value.length > 80) {
      const lines = value.split("\n");
      return `|\n${lines.map((l) => `${"  ".repeat(indent + 1)}${l}`).join("\n")}`;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return (
      "\n" +
      value
        .map((item) => {
          if (item && typeof item === "object") {
            const inner = stringifyYaml(item, indent + 1).replace(/^\n/, "");
            const [first, ...rest] = inner.split("\n");
            return `${pad}- ${first.trim()}\n${rest.map((l) => `${pad}  ${l.trimStart() === l ? l : l}`).join("\n")}`.trimEnd();
          }
          return `${pad}- ${stringifyYaml(item, indent + 1)}`;
        })
        .join("\n")
    );
  }
  const obj = value as Record<string, unknown>;
  const lines = Object.entries(obj).map(([k, v]) => {
    const rendered = stringifyYaml(v, indent + 1);
    if (rendered.startsWith("\n") || rendered.startsWith("|")) {
      const body = rendered.startsWith("|") ? rendered : rendered;
      return `${pad}${k}: ${body}`;
    }
    return `${pad}${k}: ${rendered}`;
  });
  return indent === 0 ? lines.join("\n") + "\n" : "\n" + lines.join("\n");
}
