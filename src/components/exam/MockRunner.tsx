"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ExamRunner, { type MockResult } from "./ExamRunner";
import type { ClientTest } from "@/lib/types";

export default function MockRunner({
  tests,
  userName,
}: {
  tests: ClientTest[];
  userName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = R&W, 1 = Math
  const [rwResult, setRwResult] = useState<MockResult | null>(null);
  const [mathResult, setMathResult] = useState<MockResult | null>(null);

  const currentTest = tests[step];
  if (!currentTest) {
    // All done — navigate to results summary
    router.push("/progress");
    return null;
  }

  return (
    <ExamRunner
      test={currentTest}
      userName={userName}
      mockMode
      mockProgress={{ step: step + 1, total: 2 }}
      onSubmitted={(r) => {
        if (step === 0) {
          setRwResult(r);
          setStep(1);
        } else {
          setMathResult(r);
          // Show summary, then redirect
          const totalScore = (rwResult?.scaledScore ?? 0) + (r.scaledScore ?? 0);
          alert(
            `Mock complete!\nReading & Writing: ${rwResult?.scaledScore ?? "—"}\nMath: ${r.scaledScore ?? "—"}\nTotal: ${totalScore}`,
          );
          router.push("/progress");
        }
      }}
    />
  );
}
