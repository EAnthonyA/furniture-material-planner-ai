"use client";

import { useState, useTransition } from "react";
import { deleteProject } from "@/app/actions/projects";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
};

export function DeleteProjectButton({
  projectId,
  projectName,
}: DeleteProjectButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function removeProject() {
    const confirmed = window.confirm(
      `Pašalinti projektą „${projectName}“? Bus ištrinti brėžiniai ir analizės.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteProject(projectId);

      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="delete-project-control">
      <button
        className="delete-project-button"
        type="button"
        onClick={removeProject}
        disabled={isPending}
      >
        {isPending ? "Šalinama…" : "Pašalinti"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
