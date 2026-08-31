import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local into process.env
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

async function main() {
  const {
    status,
    uploadJiraTestCases,
    convertYaml,
    generateScripts,
  } = await import("../src/actions/index.ts");

  console.log(
    "before",
    status().currentStep?.key,
    status()
      .todos?.filter((t) => t.id >= 10 && t.id <= 12)
      .map((t) => t.checkbox),
  );

  const u = await uploadJiraTestCases();
  console.log(
    "upload",
    u.todos?.find((t) => t.id === 10)?.checkbox,
    u.todos?.find((t) => t.id === 10)?.note,
  );

  const y = convertYaml();
  console.log("yaml", y);

  const g = generateScripts();
  console.log("scripts", g);

  console.log(
    "after",
    status().currentStep?.key,
    status()
      .todos?.filter((t) => t.id >= 10 && t.id <= 13)
      .map((t) => t.checkbox),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
