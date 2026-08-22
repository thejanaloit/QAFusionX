import { NextResponse } from "next/server";
import { getIntermediary, listIntermediaries, upsertIntermediary, type Intermediary } from "@/lib/sample-store";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return NextResponse.json({ items: listIntermediaries(q) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Intermediary;
  if (!body.id) body.id = `IM-${Date.now()}`;
  if (!body.code) body.code = body.id;
  upsertIntermediary(body);
  return NextResponse.json(body, { status: 201 });
}
