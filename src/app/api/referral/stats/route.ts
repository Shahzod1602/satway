import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ count: 0, rewarded: 0 });
  }

  const [count, rewarded] = await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.user.count({ where: { referredById: user.id, referralRewarded: true } }),
  ]);

  return NextResponse.json({ count, rewarded });
}
