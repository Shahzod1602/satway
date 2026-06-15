import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) {
    updateData.title = body.title.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    const existing = await prisma.test.findUnique({ where: { slug: body.slug.trim() } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
    updateData.slug = body.slug.trim();
  }
  if (typeof body.skill === "string" && ["READING_WRITING", "MATH"].includes(body.skill)) {
    updateData.skill = body.skill;
  }
  if (typeof body.type === "string" && ["DIGITAL", "PAPER"].includes(body.type)) {
    updateData.type = body.type;
  }
  if (typeof body.description === "string") {
    updateData.description = body.description;
  }
  if (typeof body.durationSec === "number" && body.durationSec > 0) {
    updateData.durationSec = body.durationSec;
  }
  if (typeof body.published === "boolean") {
    updateData.published = body.published;
  }

  const updated = await prisma.test.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ id: updated.id, title: updated.title, slug: updated.slug });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  await prisma.test.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
