import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET() {
  const sessionUser = await currentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      avatarUrl: true,
      country: true,
      nativeLanguage: true,
      phone: true,
      targetScore: true,
      targetMathScore: true,
      targetRWScore: true,
      examDate: true,
      emailNotifications: true,
      plan: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PUT(req: NextRequest) {
  const sessionUser = await currentUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if ("phone" in body) {
    data.phone = body.phone == null || body.phone === "" ? null : String(body.phone).slice(0, 60);
  }

  if ("country" in body) {
    data.country = body.country == null || body.country === "" ? null : String(body.country).slice(0, 60);
  }

  if ("nativeLanguage" in body) {
    data.nativeLanguage =
      body.nativeLanguage == null || body.nativeLanguage === "" ? null : String(body.nativeLanguage).slice(0, 60);
  }

  if ("targetScore" in body) {
    if (body.targetScore === null || body.targetScore === "") {
      data.targetScore = null;
    } else {
      const s = Number(body.targetScore);
      if (!Number.isFinite(s) || s < 200 || s > 1600) {
        return NextResponse.json({ error: "Target score must be between 200 and 1600" }, { status: 400 });
      }
      data.targetScore = Math.round(s / 10) * 10;
    }
  }

  if ("targetMathScore" in body) {
    if (body.targetMathScore === null || body.targetMathScore === "") {
      data.targetMathScore = null;
    } else {
      const s = Number(body.targetMathScore);
      if (!Number.isFinite(s) || s < 200 || s > 800) {
        return NextResponse.json({ error: "Math target must be between 200 and 800" }, { status: 400 });
      }
      data.targetMathScore = Math.round(s / 10) * 10;
    }
  }

  if ("targetRWScore" in body) {
    if (body.targetRWScore === null || body.targetRWScore === "") {
      data.targetRWScore = null;
    } else {
      const s = Number(body.targetRWScore);
      if (!Number.isFinite(s) || s < 200 || s > 800) {
        return NextResponse.json({ error: "Reading & Writing target must be between 200 and 800" }, { status: 400 });
      }
      data.targetRWScore = Math.round(s / 10) * 10;
    }
  }

  if ("examDate" in body) {
    if (!body.examDate) {
      data.examDate = null;
    } else {
      const d = new Date(String(body.examDate));
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid exam date" }, { status: 400 });
      }
      data.examDate = d;
    }
  }

  if ("emailNotifications" in body) {
    data.emailNotifications = Boolean(body.emailNotifications);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: sessionUser.id }, data });
  return NextResponse.json({ ok: true });
}
