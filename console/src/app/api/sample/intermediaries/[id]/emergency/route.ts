import { NextResponse } from "next/server";
import { getIntermediary } from "@/lib/sample-store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const item = getIntermediary(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const emergency = item.emergency;
  return NextResponse.json({
    intermediaryId: id,
    name: emergency?.name ?? null,
    relationshipType: emergency?.relationshipType ?? null,
    contact: emergency?.contact ?? null,
    address: emergency?.address ?? null,
    addressRequired: true,
  });
}
