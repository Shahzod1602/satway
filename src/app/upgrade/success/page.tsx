import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";

// Where Click's return_url lands after the hosted payment page. The webhook that grants
// Premium races this redirect — usually it has already won, but the page must not
// assume: it polls until the grant shows up rather than declaring success on arrival.
export default async function UpgradeSuccessPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return <SuccessClient />;
}
