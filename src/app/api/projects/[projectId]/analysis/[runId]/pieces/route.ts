import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  drawingExtractionSchema,
  manualObservedPieceSchema,
} from "@/lib/domain/drawing-extraction";

const routeParamsSchema = z.object({
  projectId: z.string().cuid(),
  runId: z.string().cuid(),
});

const manualPieceFormSchema = z.object({
  category: z.enum(["PANEL", "TIMBER", "HINGE", "ADJUSTABLE_LEG"]),
  label: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(99),
  lengthMm: z.coerce.number().positive().multipleOf(0.1).nullable(),
  widthMm: z.coerce.number().positive().multipleOf(0.1).nullable(),
  heightMm: z.coerce.number().positive().multipleOf(0.1).nullable(),
});

function optionalNumber(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value : null;
}

function analysisUrl(projectId: string, runId: string, request: Request) {
  return new URL(`/projects/${projectId}/analysis/${runId}`, request.url);
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
  const formData = await request.formData();
  const parsedForm = manualPieceFormSchema.safeParse({
    category: formData.get("category"),
    label: formData.get("label"),
    quantity: formData.get("quantity"),
    lengthMm: optionalNumber(formData, "lengthMm"),
    widthMm: optionalNumber(formData, "widthMm"),
    heightMm: optionalNumber(formData, "heightMm"),
  });
  const piece = parsedForm.success
    ? manualObservedPieceSchema.safeParse(parsedForm.data)
    : null;

  if (!piece?.success) {
    const url = analysisUrl(projectId, runId, request);
    url.searchParams.set("manual", "invalid");
    return NextResponse.redirect(url, 303);
  }

  const run = await prisma.analysisRun.findFirst({
    where: { id: runId, projectId, status: "COMPLETED" },
    select: { output: true },
  });
  const extraction = drawingExtractionSchema.safeParse(run?.output);

  if (!extraction.success || extraction.data.observedPieces.length >= 30) {
    const url = analysisUrl(projectId, runId, request);
    url.searchParams.set("manual", "unavailable");
    return NextResponse.redirect(url, 303);
  }

  await prisma.analysisRun.update({
    where: { id: runId },
    data: {
      output: {
        ...extraction.data,
        observedPieces: [...extraction.data.observedPieces, piece.data],
      },
    },
  });

  const url = analysisUrl(projectId, runId, request);
  url.searchParams.set("manual", "added");
  return NextResponse.redirect(url, 303);
}
