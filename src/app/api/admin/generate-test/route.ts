import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { generateQuestionsFromPassage } from "@/lib/vertexai";

export async function POST(req: NextRequest) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { passage?: unknown; skill?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.passage !== "string" || !body.passage.trim()) {
    return NextResponse.json({ error: "passage is required" }, { status: 400 });
  }
  if (typeof body.skill !== "string" || !["READING_WRITING", "MATH"].includes(body.skill)) {
    return NextResponse.json({ error: "skill must be READING_WRITING or MATH" }, { status: 400 });
  }

  const count = typeof body.count === "number" && body.count > 0 && body.count <= 20 ? body.count : 5;

  try {
    const questions = await generateQuestionsFromPassage(body.passage.trim(), body.skill, count);
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
