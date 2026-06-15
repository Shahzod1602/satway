import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  const messages = await prisma.supportMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  await prisma.supportMessage.updateMany({
    where: { userId: user.id, fromAdmin: true, readByUser: false },
    data: { readByUser: true },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  let body: { body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const text = String(body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const message = await prisma.supportMessage.create({
    data: { userId: user.id, body: text, fromAdmin: false, readByUser: true },
  });

  return NextResponse.json({ ok: true, message });
}
