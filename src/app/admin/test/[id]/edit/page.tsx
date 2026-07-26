import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TestEditClient from "./TestEditClient";

export const dynamic = "force-dynamic";

export default async function AdminTestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!test) redirect("/admin");

  return <TestEditClient test={JSON.parse(JSON.stringify(test))} />;
}
