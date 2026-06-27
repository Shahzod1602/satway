import { currentUser } from "./session";
import { prisma } from "./prisma";

// Re-validate the role against the DB on every check — the JWT role is baked at
// login, so a demoted admin would otherwise keep access until the token expires.
export async function requireAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  return dbUser?.role === "ADMIN";
}
