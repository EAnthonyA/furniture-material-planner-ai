import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewPurchasePlanWithGemini } from "@/lib/ai/purchase-plan-review";
import { prisma } from "@/lib/db/prisma";
import {
  calculateCuttingPlan,
  type CutRequirement,
  type StockBoard,
} from "@/lib/domain/cutting-plan";
import { drawingExtractionSchema } from "@/lib/domain/drawing-extraction";

const routeParamsSchema = z.object({
  projectId: z.string().cuid(),
  runId: z.string().cuid(),
});

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

function planUrl(projectId: string, runId: string, request: Request) {
  return new URL(`/projects/${projectId}/analysis/${runId}/plan`, request.url);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) {
  const routeParams = routeParamsSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const { projectId, runId } = routeParams.data;
  const run = await prisma.analysisRun.findFirst({
    where: { id: runId, projectId, status: "COMPLETED" },
    include: { project: { include: { materialGroups: true } } },
  });
  const extraction = drawingExtractionSchema.safeParse(run?.output);
  const material = run?.project.materialGroups[0];

  if (!run || !extraction.success || !material) {
    return NextResponse.redirect(planUrl(projectId, runId, request), 303);
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
  const availableStock: StockBoard[] = products.flatMap((product) => {
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
  const result = calculateCuttingPlan(requirements, availableStock);

  try {
    const review = await reviewPurchasePlanWithGemini({
      requirements,
      availableStock,
      result,
    });

    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        output: {
          ...extraction.data,
          purchasePlanReview: review,
        },
      },
    });
    console.info(
      `Purchase-plan AI review completed for analysis run ${run.id}: requirements=${requirements.length}, stock=${availableStock.length}.`,
    );
  } catch (error) {
    console.error(
      `Purchase-plan AI review failed for analysis run ${run.id}.`,
      error,
    );
    const url = planUrl(projectId, runId, request);
    url.searchParams.set("ai", "failed");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(planUrl(projectId, runId, request), 303);
}
