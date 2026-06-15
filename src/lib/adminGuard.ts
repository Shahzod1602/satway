import { currentUser } from "./session";

export async function requireAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.role === "ADMIN";
}
