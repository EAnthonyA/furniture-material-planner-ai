import Link from "next/link";
import { notFound } from "next/navigation";
import { CuttingPlanResult } from "@/components/cutting-plan-result";
import { prisma } from "@/lib/db/prisma";
import {
  calculateCuttingPlan,
  type CutRequirement,
  type StockBoard,
} from "@/lib/domain/cutting-plan";
import { drawingExtractionSchema } from "@/lib/domain/drawing-extraction";

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
    include: { project: { include: { materialGroups: true } } },
  });

  if (!run) {
    notFound();
  }

  const extraction = drawingExtractionSchema.safeParse(run.output);
  const material = run.project.materialGroups[0];

  if (!extraction.success || !material) {
    notFound();
  }

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
  const requirements = requirementsFromExtraction(extraction.data);
  const result = calculateCuttingPlan(requirements, stock);

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
      <CuttingPlanResult requirements={requirements} result={result} />
    </main>
  );
}
