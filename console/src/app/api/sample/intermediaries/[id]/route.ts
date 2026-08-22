import { NextResponse } from "next/server";
import { getIntermediary, upsertIntermediary, type Intermediary } from "@/lib/sample-store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = getIntermediary(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = getIntermediary(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as Partial<Intermediary>;
  const next = { ...existing, ...body, id };
  upsertIntermediary(next);
  return NextResponse.json(next);
}
