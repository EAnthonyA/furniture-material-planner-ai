import Link from "next/link";
import { notFound } from "next/navigation";
import { DrawingExtractionResult } from "@/components/drawing-extraction-result";
import { AnalysisStatus } from "@/components/analysis-status";
import { ManualPieceForm } from "@/components/manual-piece-form";
import { prisma } from "@/lib/db/prisma";
import { drawingExtractionSchema } from "@/lib/domain/drawing-extraction";

const inProgressStatuses = new Set(["PENDING", "RUNNING"]);

function getActivity(status: string, activity: string | null) {
  if (activity) {
    return activity;
  }

  if (status === "PENDING") {
    return "Laukiame, kol galėsime pradėti jūsų brėžinių analizę";
  }

  return "Ruošiame jūsų brėžinių analizę";
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;
  const run = await prisma.analysisRun.findFirst({
    where: { id: runId, projectId },
    include: { project: true },
  });

  if (!run) {
    notFound();
  }

  if (inProgressStatuses.has(run.status)) {
    const activity = getActivity(run.status, run.activity);

    return (
      <main className="analysis-page">
        <p className="eyebrow">Brėžinio analizė</p>
        <h1>
          Skaitome
          <br />
          <em>brėžinį.</em>
        </h1>
        <AnalysisStatus activity={activity} />
      </main>
    );
  }

  if (run.status === "FAILED") {
    return (
      <main className="analysis-page">
        <p className="eyebrow">Analizė nepavyko</p>
        <h1>
          Reikia
          <br />
          <em>patikslinimo.</em>
        </h1>
        <p className="form-error">
          {run.error || "Nepavyko nuskaityti brėžinių. Bandykite dar kartą."}
        </p>
        <Link className="text-link" href={`/projects/${projectId}/drawings`}>
          Grįžti prie brėžinių
        </Link>
      </main>
    );
  }

  const extraction = drawingExtractionSchema.safeParse(run.output);

  if (!extraction.success) {
    return (
      <main className="analysis-page">
        <p className="eyebrow">Brėžinio analizė</p>
        <h1>
          Atnaujinkite <em>analizę.</em>
        </h1>
        <p className="drawing-lead">
          Šio rezultato formatas nebeatitinka brėžinio nuskaitymo žingsnio.
          Atlikite analizę iš naujo.
        </p>
        <form action={`/api/projects/${projectId}/analysis`} method="post">
          <button className="submit-button" type="submit">
            Analizuoti iš naujo
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="analysis-page">
      <p className="eyebrow">Analizė paruošta</p>
      <h1>
        Patikrinkite
        <br />
        <em>matmenis.</em>
      </h1>
      <p className="drawing-lead">
        Rodomos tik plokštės, mediniai tašai bei lentos, du lankstai kiekvienoms
        aiškiai matomoms durelėms ir reguliuojamos kojelės, jei jos pažymėtos.
        Varžtų, vinių ir kitų pasiūlymų čia nėra.
      </p>
      <ManualPieceForm
        action={`/api/projects/${projectId}/analysis/${runId}/pieces`}
      />
      <DrawingExtractionResult extraction={extraction.data} />
      <Link className="text-link" href={`/projects/${projectId}/drawings`}>
        Peržiūrėti brėžinius
      </Link>
    </main>
  );
}
