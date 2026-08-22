import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: "InfoIns Sales & Marketing",
    module: "Intermediary Management",
    version: "1.2.25-QA",
  });
}
