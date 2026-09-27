import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  drawingExtractionSchema,
  manualObservedPieceSchema,
  type ObservedPiece,
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

const updatePieceFormSchema = manualPieceFormSchema.extend({
  pieceIndex: z.coerce.number().int().min(0),
});

function optionalNumber(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value : null;
}

function analysisUrl(projectId: string, runId: string, request: Request) {
  return new URL(`/projects/${projectId}/analysis/${runId}`, request.url);
}

function pieceSubmissionFrom(formData: FormData) {
  const submittedPiece = {
    category: formData.get("category"),
    label: formData.get("label"),
    quantity: formData.get("quantity"),
    lengthMm: optionalNumber(formData, "lengthMm"),
    widthMm: optionalNumber(formData, "widthMm"),
    heightMm: optionalNumber(formData, "heightMm"),
  };
  const isUpdate = formData.get("operation") === "update";
  const parsedUpdate = isUpdate
    ? updatePieceFormSchema.safeParse({
        ...submittedPiece,
        pieceIndex: formData.get("pieceIndex"),
      })
    : null;
  const parsedPiece = isUpdate
    ? parsedUpdate
    : manualPieceFormSchema.safeParse(submittedPiece);
  const parsedObservedPiece = parsedPiece?.success
    ? manualObservedPieceSchema.safeParse(parsedPiece.data)
    : null;

  if (!parsedObservedPiece?.success) {
    return null;
  }

  return {
    isUpdate,
    piece: parsedObservedPiece.data,
    pieceIndex: parsedUpdate?.success ? parsedUpdate.data.pieceIndex : null,
  };
}

function canSavePiece({
  isUpdate,
  pieceIndex,
  pieces,
}: {
  isUpdate: boolean;
  pieceIndex: number | null;
  pieces: ObservedPiece[];
}) {
  if (!isUpdate) {
    return pieces.length < 30;
  }

  return pieceIndex !== null && pieceIndex < pieces.length;
}

function updatedPieces({
  isUpdate,
  piece,
  pieceIndex,
  pieces,
}: {
  isUpdate: boolean;
  piece: ObservedPiece;
  pieceIndex: number | null;
  pieces: ObservedPiece[];
}) {
  if (!isUpdate) {
    return [...pieces, piece];
  }

  return pieces.map((existingPiece, index) =>
    index === pieceIndex ? piece : existingPiece,
  );
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
  const submission = pieceSubmissionFrom(formData);

  if (!submission) {
    const url = analysisUrl(projectId, runId, request);
    url.searchParams.set("manual", "invalid");
    return NextResponse.redirect(url, 303);
  }

  const run = await prisma.analysisRun.findFirst({
    where: { id: runId, projectId, status: "COMPLETED" },
    select: { output: true },
  });
  const extraction = drawingExtractionSchema.safeParse(run?.output);

  if (
    !extraction.success ||
    !canSavePiece({
      isUpdate: submission.isUpdate,
      pieceIndex: submission.pieceIndex,
      pieces: extraction.data.observedPieces,
    })
  ) {
    const url = analysisUrl(projectId, runId, request);
    url.searchParams.set("manual", "unavailable");
    return NextResponse.redirect(url, 303);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.analysisRun.update({
      where: { id: runId },
      data: {
        output: {
          ...extraction.data,
          observedPieces: updatedPieces({
            isUpdate: submission.isUpdate,
            piece: submission.piece,
            pieceIndex: submission.pieceIndex,
            pieces: extraction.data.observedPieces,
          }),
        },
      },
    });

    await transaction.project.update({
      where: { id: projectId },
      data: { currentRevisionId: null, state: "ANALYSIS_REVIEW" },
    });
  });

  const url = analysisUrl(projectId, runId, request);
  url.searchParams.set("manual", submission.isUpdate ? "updated" : "added");
  return NextResponse.redirect(url, 303);
}
