import ExcelJS from "exceljs";
import path from "node:path";
import { abs, DIRS, writeFile } from "../workflow/paths.ts";

export interface IssueRow {
  id: string;
  module: string;
  title: string;
  status: "Fail" | "Pass" | "Blocked" | "Error";
  priority: string;
  preconditions: string;
  steps: string;
  expected: string;
  actual: string;
  proof: string;
  layer: string;
}

export async function writeIssuesWorkbook(rows: IssueRow[]): Promise<{ xlsx: string; csv: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QAFusionX";
  workbook.created = new Date();

  const fails = workbook.addWorksheet("Issues");
  fails.columns = [
    { header: "Test Case ID", key: "id", width: 18 },
    { header: "Module", key: "module", width: 28 },
    { header: "Title", key: "title", width: 70 },
    { header: "Status", key: "status", width: 12 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Layer", key: "layer", width: 10 },
    { header: "Preconditions", key: "preconditions", width: 40 },
    { header: "Test Steps", key: "steps", width: 50 },
    { header: "Expected Result", key: "expected", width: 40 },
    { header: "Actual Result", key: "actual", width: 40 },
    { header: "Proof", key: "proof", width: 50 },
  ];
  fails.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  fails.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111827" },
  };
  for (const row of rows) fails.addRow(row);

  const xlsxRel = path.join(DIRS.reports, "QAFusionX-Issues.xlsx");
  const csvRel = path.join(DIRS.reports, "QAFusionX-Issues.csv");
  await workbook.xlsx.writeFile(abs(xlsxRel));

  const header = fails.columns.map((c) => c.header).join(",");
  const csvLines = rows.map((r) =>
    [r.id, r.module, r.title, r.status, r.priority, r.layer, r.preconditions, r.steps, r.expected, r.actual, r.proof]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  writeFile(csvRel, [header, ...csvLines].join("\n"));

  return { xlsx: xlsxRel, csv: csvRel };
}
