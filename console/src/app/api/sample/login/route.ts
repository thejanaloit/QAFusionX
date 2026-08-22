import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; password?: string };
  if (body.username === "qa.analyst" && body.password === "FusionX@2026") {
    return NextResponse.json({ ok: true, token: "demo-token", displayName: "QA Analyst" });
  }
  return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
}
