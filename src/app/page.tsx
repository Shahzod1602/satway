import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import Landing from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect("/dashboard");
  return <Landing />;
}
