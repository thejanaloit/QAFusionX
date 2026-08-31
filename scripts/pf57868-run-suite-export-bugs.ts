import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve("C:/Users/ThejanaD/QAFusionX/.env.local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* ignore */
}

process.env.QAFUSIONX_WORKSPACE =
  process.env.QAFUSIONX_WORKSPACE || "E:/QAFusionX/workspaces/PF-57868";
process.env.QAFUSIONX_HEADED = "1";
// Honest retries, capped for known-fail cases (EMPTY/AML) while staying multi-round.
process.env.QAFUSIONX_SUITE_MAX_ROUNDS = process.env.QAFUSIONX_SUITE_MAX_ROUNDS || "3";

async function main() {
  const { runSuite, exportIssues, fileBugs, status } = await import("../src/actions/index.ts");
  console.log("starting suite…", status().currentStep?.key);
  const suite = await runSuite();
  console.log(
    "suite done",
    suite.status.suite,
    suite.results?.map((r) => `${r.status}:${r.id}`).join(", "),
  );
  const exp = await exportIssues();
  console.log("export", exp.todos?.find((t) => t.id === 14)?.checkbox, exp.todos?.find((t) => t.id === 14)?.note);
  const bugs = await fileBugs();
  console.log("bugs", bugs.todos?.find((t) => t.id === 15)?.checkbox, bugs.todos?.find((t) => t.id === 15)?.note);
  console.log("final", status().todos?.map((t) => t.checkbox).join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
