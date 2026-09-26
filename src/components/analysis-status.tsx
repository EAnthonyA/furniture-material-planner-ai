"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AnalysisStatusProps = {
  activity: string;
};

export function AnalysisStatus({ activity }: AnalysisStatusProps) {
  const router = useRouter();

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      router.refresh();
    }, 5_000);

    return () => window.clearInterval(refreshInterval);
  }, [router]);

  return (
    <p className="drawing-lead analysis-status" aria-live="polite">
      {activity}
      <span className="loading-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  );
}
