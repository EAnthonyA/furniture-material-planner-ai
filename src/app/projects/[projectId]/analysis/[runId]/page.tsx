import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

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

  if (run.status === "PENDING" || run.status === "RUNNING") {
    return (
      <main className="analysis-page">
        <meta httpEquiv="refresh" content="3" />
        <p className="eyebrow">Brėžinio analizė</p>
        <h1>
          Skaitome
          <br />
          <em>brėžinį.</em>
        </h1>
        <p className="drawing-lead">
          Gemini analizuoja jūsų užrašytus matmenis ir konstrukcijos ženklus.
          Šis puslapis atsinaujins automatiškai.
        </p>
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
        <p className="form-error">{run.error}</p>
        <Link className="text-link" href={`/projects/${projectId}/drawings`}>
          Grįžti prie brėžinių
        </Link>
      </main>
    );
  }

  const output = run.output as {
    furnitureType?: string | null;
    questions?: Array<{ prompt: string }>;
  } | null;
  return (
    <main className="analysis-page">
      <p className="eyebrow">Analizė paruošta</p>
      <h1>
        Peržiūrėkite
        <br />
        <em>siūlymą.</em>
      </h1>
      <p className="drawing-lead">
        Atpažinta: {output?.furnitureType || "nepatikslinta"}. Prieš
        skaičiuojant medžiagas kiekvieną pasiūlymą dar reikės patvirtinti.
      </p>
      {output?.questions?.length ? (
        <section className="drawing-list">
          <p className="eyebrow">Klausimai</p>
          <ul>
            {output.questions.map((question, index) => (
              <li key={index}>{question.prompt}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <Link className="text-link" href={`/projects/${projectId}/drawings`}>
        Peržiūrėti brėžinius
      </Link>
    </main>
  );
}
