import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ count: 0 });

  const count =
    user.role === "ADMIN"
      ? await prisma.supportMessage.count({
          where: { fromAdmin: false, readByAdmin: false },
        })
      : await prisma.supportMessage.count({
          where: { userId: user.id, fromAdmin: true, readByUser: false },
        });

  return NextResponse.json({ count });
}
