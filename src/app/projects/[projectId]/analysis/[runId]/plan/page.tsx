import Link from "next/link";
import { notFound } from "next/navigation";
import { CuttingPlanResult } from "@/components/cutting-plan-result";
import { prisma } from "@/lib/db/prisma";
import {
  calculateCuttingPlan,
  type CutRequirement,
  type CuttingPlanResult as CuttingPlan,
  type StockBoard,
} from "@/lib/domain/cutting-plan";
import { drawingExtractionSchema } from "@/lib/domain/drawing-extraction";
import { savedPurchasePlanSnapshotSchema } from "@/lib/domain/saved-purchase-plan";

type ProductDimensions = {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
};

function hasProductDimensions(value: unknown): value is ProductDimensions {
  if (!value || typeof value !== "object") {
    return false;
  }

  const dimensions = value as Record<string, unknown>;
  return ["lengthMm", "widthMm", "thicknessMm"].every(
    (key) => typeof dimensions[key] === "number" && Number(dimensions[key]) > 0,
  );
}

function requirementsFromExtraction(
  extraction: ReturnType<typeof drawingExtractionSchema.parse>,
): CutRequirement[] {
  return extraction.observedPieces.flatMap((piece, index) => {
    if (
      piece.category === "PANEL" &&
      piece.widthMm !== null &&
      piece.heightMm !== null
    ) {
      return [
        {
          id: `panel-${index}`,
          label: piece.label,
          quantity: piece.quantity,
          lengthMm: piece.widthMm,
          widthMm: piece.heightMm,
        },
      ];
    }

    if (
      piece.category === "TIMBER" &&
      piece.lengthMm !== null &&
      piece.widthMm !== null
    ) {
      return [
        {
          id: `timber-${index}`,
          label: piece.label,
          quantity: piece.quantity,
          lengthMm: piece.lengthMm,
          widthMm: piece.widthMm,
        },
      ];
    }

    return [];
  });
}

export default async function CuttingPlanPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;
  const run = await prisma.analysisRun.findFirst({
    where: { id: runId, projectId, status: "COMPLETED" },
    include: {
      project: {
        include: {
          materialGroups: true,
          currentRevision: {
            include: {
              plans: {
                where: { complete: true },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { snapshot: true },
              },
            },
          },
        },
      },
    },
  });

  if (!run) {
    notFound();
  }

  const extraction = drawingExtractionSchema.safeParse(run.output);
  const material = run.project.materialGroups[0];

  if (!extraction.success || !material) {
    notFound();
  }

  const savedSnapshot = savedPurchasePlanSnapshotSchema.safeParse(
    run.project.currentRevision?.plans[0]?.snapshot,
  );
  const savedPlan =
    savedSnapshot.success &&
    savedSnapshot.data.runId === runId &&
    savedSnapshot.data.result.ok
      ? savedSnapshot.data
      : null;
  let requirements: CutRequirement[];
  let result: CuttingPlan;

  if (savedPlan) {
    requirements = savedPlan.requirements;
    result = savedPlan.result;
  } else {
    const products = await prisma.storeProduct.findMany({
      where: { store: "SENUKAI", material: material.kind },
      select: {
        id: true,
        title: true,
        url: true,
        dimensionsMm: true,
        observations: {
          orderBy: { observedAt: "desc" },
          take: 1,
          select: { availability: true, priceCents: true },
        },
      },
    });
    const requiredThicknessMm = Number(material.thicknessMm);
    const stock: StockBoard[] = products.flatMap((product) => {
      const dimensions = product.dimensionsMm;
      const observation = product.observations[0];

      if (
        !hasProductDimensions(dimensions) ||
        observation?.availability !== "PARDUODAMA" ||
        Math.abs(dimensions.thicknessMm - requiredThicknessMm) > 0.01
      ) {
        return [];
      }

      return [
        {
          id: product.id,
          label: product.title,
          lengthMm: dimensions.lengthMm,
          widthMm: dimensions.widthMm,
          priceCents: observation.priceCents,
          url: product.url,
        },
      ];
    });

    requirements = requirementsFromExtraction(extraction.data);
    result = calculateCuttingPlan(requirements, stock);
  }

  return (
    <main className="cutting-plan-page">
      <Link
        className="cutting-back"
        href={`/projects/${projectId}/analysis/${runId}`}
      >
        ← Grįžti prie detalių
      </Link>
      <p className="eyebrow">04 · Pirkimas ir pjovimas</p>
      <h1>
        Tikras
        <br />
        <em>pjovimo planas.</em>
      </h1>
      <p className="cutting-page-lead">
        Patvirtintos tekstinės detalės palygintos tik su šiuo metu
        parduodamomis, pasirinkto storio plokštėmis. Rekomendacija priimama tik
        tada, kai visos detalės turi vietą konkrečiose plokštėse.
      </p>
      {result.ok ? (
        savedPlan ? (
          <section className="plan-save-confirmation" aria-live="polite">
            <div>
              <p className="eyebrow">Išsaugotas projektas</p>
              <h2>Skaičiavimas jau paruoštas parduotuvei.</h2>
              <p>
                Šis pirkinių sąrašas ir pjovimo planas išsaugoti tokie, kokie
                parodyti žemiau.
              </p>
            </div>
            <Link href="/">
              Peržiūrėti projektus <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : (
          <section
            className="plan-save-callout"
            aria-labelledby="save-plan-title"
          >
            <div>
              <p className="eyebrow">Pabaikite projektą</p>
              <h2 id="save-plan-title">
                Išsaugokite prieš eidami į parduotuvę.
              </h2>
              <p>
                Išsaugosime šį pirkinių sąrašą ir pjovimo planą, kad vėliau
                galėtumėte juos atsidaryti iš projektų sąrašo.
              </p>
            </div>
            <form
              action={`/api/projects/${projectId}/analysis/${runId}/plan/save`}
              method="post"
            >
              <button className="submit-button" type="submit">
                Išsaugoti skaičiavimą <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        )
      ) : null}
      <CuttingPlanResult requirements={requirements} result={result} />
    </main>
  );
}
