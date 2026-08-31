import ExcelJS from "exceljs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { abs, DIRS, writeFile } from "../workflow/paths.ts";

/** iPay Lite Testing.xlsx column contract */
export const IPAY_LITE_COLUMNS = [
  "Area",
  "Concern",
  "User story",
  "Status",
  "Change made?",
  "Change / verification notes (English)",
  "Commit / cycle",
] as const;

export type IpayLiteRow = {
  area: string;
  concern: string;
  userStory: string;
  status: string;
  changeMade?: string;
  notes: string;
  cycle: string;
};

function statusFill(status: string): ExcelJS.Fill | undefined {
  if (status.startsWith("Fail")) {
    return { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8CBAD" } };
  }
  if (status.startsWith("Pass")) {
    return { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
  }
  if (status.startsWith("Blocked")) {
    return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD966" } };
  }
  return undefined;
}

export async function writeIpayLiteWorkbook(
  sheetName: string,
  rows: IpayLiteRow[],
  outBasename = "QAFusionX-iPay-Lite.xlsx",
): Promise<{ xlsx: string; rowCount: number }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QAFusionX";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(sheetName.slice(0, 31));
  ws.columns = IPAY_LITE_COLUMNS.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: [18, 55, 14, 28, 14, 70, 42][i],
  }));
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  headerRow.alignment = { wrapText: true, vertical: "top" };

  for (const r of rows) {
    const row = ws.addRow([
      r.area,
      r.concern,
      r.userStory,
      r.status,
      r.changeMade ?? "No",
      r.notes,
      r.cycle,
    ]);
    row.alignment = { wrapText: true, vertical: "top" };
    const fill = statusFill(r.status);
    if (fill) row.getCell(4).fill = fill;
  }

  ws.autoFilter = { from: "A1", to: `G${ws.rowCount}` };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const xlsxRel = path.join(DIRS.reports, outBasename);
  await workbook.xlsx.writeFile(abs(xlsxRel));
  return { xlsx: xlsxRel, rowCount: rows.length };
}

/** Run the exhaustive PF-57868 Python generator (≥110 rows × 11 sheets). */
export function generatePf57868IpayExcel(): {
  ok: boolean;
  stdout: string;
  stderr: string;
  paths: string[];
} {
  const script = path.resolve(process.env.QAFUSIONX_REPO ?? "C:/Users/ThejanaD/QAFusionX", "scripts/generate-ipay-excel-pf57868.py");
  const proc = spawnSync("py", [script], { encoding: "utf8", cwd: path.dirname(script) });
  const paths = [
    "C:/Users/ThejanaD/Downloads/PF-57868-Kenya-UAT-all-11-ipay-lite.xlsx",
    "E:/QAFusionX/workspaces/PF-57868/reports/PF-57868-Kenya-UAT-all-11-ipay-lite.xlsx",
    "E:/QAFusionX/workspaces/PF-57868/artifacts/PF-57868-Kenya-UAT-all-11-ipay-lite.xlsx",
  ];
  writeFile(
    path.join(DIRS.reports, "ipay-lite-generate-log.txt"),
    [proc.stdout, proc.stderr].filter(Boolean).join("\n"),
  );
  return {
    ok: proc.status === 0,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
    paths,
  };
}

/**
 * Book1 visual Excel — same shape as iPay Lite Testing (1).xlsx:
 * Sheet1 columns Area | Issue | Screenshot (embedded), one workbook per story.
 * Fine-tuned red-box annotations. Output: reports/book1-per-story/
 */
export function generatePf57868Book1PerStoryExcel(): {
  ok: boolean;
  stdout: string;
  stderr: string;
  paths: string[];
} {
  const repo = process.env.QAFUSIONX_REPO ?? "C:/Users/ThejanaD/QAFusionX";
  const script = path.resolve(repo, "scripts/pf57868-finalize-book1-per-story.py");
  const proc = spawnSync("py", [script], {
    encoding: "utf8",
    cwd: path.dirname(script),
    timeout: 300_000,
  });
  const paths = [
    "E:/QAFusionX/workspaces/PF-57868/reports/book1-per-story/",
    "C:/Users/ThejanaD/Downloads/PF-57868-book1-per-story/",
    "E:/QAFusionX/workspaces/PF-57868/artifacts/book1-per-story/",
  ];
  writeFile(
    path.join(DIRS.reports, "book1-per-story-generate-log.txt"),
    [proc.stdout, proc.stderr].filter(Boolean).join("\n"),
  );
  return {
    ok: proc.status === 0,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
    paths,
  };
}
