import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { drawings: true },
  });

  if (!project || project.drawings.length === 0) {
    return NextResponse.redirect(
      new URL(
        `/projects/${projectId}/drawings?upload=missing-file`,
        request.url,
      ),
      303,
    );
  }

  const run = await prisma.analysisRun.create({
    data: {
      projectId,
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      promptVersion: "1",
      schemaVersion: "1",
    },
  });

  return NextResponse.redirect(
    new URL(`/projects/${projectId}/analysis/${run.id}`, request.url),
    303,
  );
}
