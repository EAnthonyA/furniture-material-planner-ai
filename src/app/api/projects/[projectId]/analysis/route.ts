import { NextResponse } from "next/server";
import { z } from "zod";
import { ownerAnswerSchema } from "@/lib/ai/gemini";
import { prisma } from "@/lib/db/prisma";
import { analysisDraftSchema } from "@/lib/domain/analysis";

const analysisRequestSchema = z.object({
  ownerContext: z.string().trim().max(2_000).optional(),
  sourceRunId: z.string().trim().min(1).optional(),
});

function drawingsPageUrl(projectId: string, request: Request, status: string) {
  return new URL(
    `/projects/${projectId}/drawings?upload=${status}`,
    request.url,
  );
}

function analysisPageUrl(
  projectId: string,
  runId: string,
  request: Request,
  status: string,
) {
  return new URL(
    `/projects/${projectId}/analysis/${runId}?answers=${status}`,
    request.url,
  );
}

type SourceAnswerInput = {
  ownerContext: string | null;
  ownerAnswers: z.infer<typeof ownerAnswerSchema>[];
};

type SourceAnswerError = { redirect: URL };

function optionalFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" && value ? value : undefined;
}

function parseAnalysisRequest(formData: FormData) {
  return analysisRequestSchema.safeParse({
    ownerContext: optionalFormValue(formData, "ownerContext"),
    sourceRunId: optionalFormValue(formData, "sourceRunId"),
  });
}

async function hasDrawings(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { drawings: { select: { id: true }, take: 1 } },
  });

  return Boolean(project?.drawings.length);
}

async function createAnalysisRun({
  projectId,
  ownerContext,
  ownerAnswers,
}: SourceAnswerInput & { projectId: string }) {
  const [run] = await prisma.$transaction([
    prisma.analysisRun.create({
      data: {
        projectId,
        provider: "gemini",
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        promptVersion: "9",
        schemaVersion: "5",
        ownerContext,
        ownerAnswers,
        activity: "Laukiame, kol galėsime pradėti jūsų brėžinių analizę",
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { state: "ANALYSIS_REVIEW" },
    }),
  ]);

  return run;
}

async function getSourceAnswerInput({
  sourceRunId,
  projectId,
  formData,
  request,
}: {
  sourceRunId: string;
  projectId: string;
  formData: FormData;
  request: Request;
}): Promise<SourceAnswerInput | SourceAnswerError> {
  const sourceRun = await prisma.analysisRun.findFirst({
    where: { id: sourceRunId, projectId, status: "COMPLETED" },
    select: { id: true, ownerContext: true, output: true },
  });

  if (!sourceRun) {
    return {
      redirect: drawingsPageUrl(projectId, request, "invalid-context"),
    };
  }

  const sourceDraft = analysisDraftSchema.safeParse(sourceRun.output);

  if (!sourceDraft.success) {
    return {
      redirect: analysisPageUrl(projectId, sourceRun.id, request, "invalid"),
    };
  }

  const answers = sourceDraft.data.questions.flatMap((question) => {
    const value = formData.get(`answer-${question.id}`);

    if (typeof value !== "string" || !value.trim()) {
      return [];
    }

    return [
      { questionId: question.id, question: question.prompt, answer: value },
    ];
  });
  const parsedAnswers = ownerAnswerSchema.array().max(30).safeParse(answers);
  const requiredAnswered = sourceDraft.data.questions
    .filter((question) => question.required)
    .every((question) =>
      parsedAnswers.data?.some((answer) => answer.questionId === question.id),
    );

  if (!parsedAnswers.success || !requiredAnswered || answers.length === 0) {
    return {
      redirect: analysisPageUrl(projectId, sourceRun.id, request, "missing"),
    };
  }

  return {
    ownerContext: sourceRun.ownerContext,
    ownerAnswers: parsedAnswers.data,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  if (!(await hasDrawings(projectId))) {
    return NextResponse.redirect(
      drawingsPageUrl(projectId, request, "missing-file"),
      303,
    );
  }

  const formData = await request.formData();
  const parsedRequest = parseAnalysisRequest(formData);

  if (!parsedRequest.success) {
    return NextResponse.redirect(
      drawingsPageUrl(projectId, request, "invalid-context"),
      303,
    );
  }

  const sourceAnswerInput = parsedRequest.data.sourceRunId
    ? await getSourceAnswerInput({
        sourceRunId: parsedRequest.data.sourceRunId,
        projectId,
        formData,
        request,
      })
    : null;

  if (sourceAnswerInput && "redirect" in sourceAnswerInput) {
    return NextResponse.redirect(sourceAnswerInput.redirect, 303);
  }

  const run = await createAnalysisRun({
    projectId,
    ownerContext:
      sourceAnswerInput?.ownerContext ||
      parsedRequest.data.ownerContext ||
      null,
    ownerAnswers: sourceAnswerInput?.ownerAnswers || [],
  });

  return NextResponse.redirect(
    new URL(`/projects/${projectId}/analysis/${run.id}`, request.url),
    303,
  );
}
