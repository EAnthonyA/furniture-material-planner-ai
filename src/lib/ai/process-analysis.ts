import { prisma } from "@/lib/db/prisma";
import { analyzeWithGemini } from "@/lib/ai/gemini";
import { readPrivateObject } from "@/lib/storage/local";

const maxInlineRequestBytes = 18 * 1024 * 1024;

export async function processAnalysisRun(runId: string) {
  const run = await prisma.analysisRun.findUnique({
    where: { id: runId },
    include: { project: { include: { drawings: true } } },
  });

  if (!run) {
    return;
  }

  await prisma.analysisRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", error: null },
  });

  console.info(`Analysis run ${run.id} started for project ${run.projectId}.`);

  try {
    const drawings = await Promise.all(
      run.project.drawings.map(async (drawing) => ({
        mediaType: drawing.mediaType,
        data: await readPrivateObject(drawing.objectKey),
      })),
    );
    const totalBytes = drawings.reduce(
      (total, drawing) => total + drawing.data.length,
      0,
    );

    if (totalBytes > maxInlineRequestBytes) {
      throw new Error(
        "The selected drawings exceed Gemini's inline request limit. Upload fewer or smaller images.",
      );
    }

    const output = await analyzeWithGemini(drawings);

    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", output },
    });

    console.info(`Analysis run ${run.id} completed.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";

    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message },
    });

    console.error(`Analysis run ${run.id} failed: ${message}`);
  }
}
