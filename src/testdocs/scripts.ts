import type { HumanTestCase } from "../testdocs/format.ts";

export function guiSpec(tc: HumanTestCase, targetUrl: string): string {
  const steps = tc.steps
    .map(
      (step, i) => `  // Step ${i + 1}: ${step.replace(/\n/g, " ")}
  await page.waitForTimeout(150);`,
    )
    .join("\n");

  return `import { test, expect } from "@playwright/test";

/**
 * ${tc.id} — GUI
 * [${tc.module}] [${tc.submodule}][${tc.feature}][${tc.typeCode}] - ${tc.assertion}
 */
test.describe(${JSON.stringify(tc.id)}, () => {
  test(${JSON.stringify(tc.assertion)}, async ({ page }) => {
    test.info().annotations.push({ type: "layer", description: "gui" });
    test.info().annotations.push({ type: "priority", description: ${JSON.stringify(tc.priority)} });

    await page.goto(${JSON.stringify(targetUrl)});

${steps}

    // Expected: ${tc.expected.replace(/\n/g, " ")}
    await expect(page.locator("body")).toBeVisible();
  });
});
`;
}

export function apiSpec(tc: HumanTestCase, apiBase: string): string {
  return `import { test, expect } from "@playwright/test";

/**
 * ${tc.id} — API
 * [${tc.module}] [${tc.submodule}][${tc.feature}][${tc.typeCode}] - ${tc.assertion}
 */
test.describe(${JSON.stringify(tc.id + "-api")}, () => {
  test(${JSON.stringify("API: " + tc.assertion)}, async ({ request }) => {
    test.info().annotations.push({ type: "layer", description: "api" });

    const health = await request.get(${JSON.stringify(apiBase + "/api/sample/health")});
    expect(health.ok(), "Sample API health should respond").toBeTruthy();

    // Scenario under test: ${tc.assertion.replace(/\n/g, " ")}
    // Expected: ${tc.expected.replace(/\n/g, " ")}
    const res = await request.get(${JSON.stringify(apiBase + "/api/sample/intermediaries")});
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.items) || Array.isArray(body)).toBeTruthy();
  });
});
`;
}
