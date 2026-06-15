import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sessionUser = await currentUser();
  if (!sessionUser) redirect("/login");

  const dbUser = await prisma.user.findUnique({
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

  if (!dbUser) redirect("/login");

  return <ProfileClient user={JSON.parse(JSON.stringify(dbUser))} />;
}
