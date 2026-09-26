import { prisma } from "@/lib/db/prisma";
import { extractDrawingDimensions } from "@/lib/ai/gemini";
import { readPrivateObject } from "@/lib/storage/local";

const maxInlineRequestBytes = 18 * 1024 * 1024;

export async function processAnalysisRun(runId: string) {
  const startedAt = Date.now();
  let phase = "loading analysis run";
  const run = await prisma.analysisRun.findUnique({
    where: { id: runId },
    include: { project: { include: { drawings: true } } },
  });

  if (!run) {
    return;
  }

  await prisma.analysisRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      error: null,
      activity: "Nuskaitome jūsų brėžinius iš saugyklos",
    },
  });

  console.info(
    `Analysis run ${run.id} started for project ${run.projectId}: drawings=${run.project.drawings.length}.`,
  );

  try {
    phase = "reading drawing files";
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
    console.info(
      `Analysis run ${run.id}: read ${drawings.length} drawings (${totalBytes} bytes) in ${Date.now() - startedAt}ms.`,
    );

    if (totalBytes > maxInlineRequestBytes) {
      throw new Error(
        "The selected drawings exceed Gemini's inline request limit. Upload fewer or smaller images.",
      );
    }

    phase = "requesting Gemini transcription";
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        activity: "Gemini nuskaito plokštes ir tik būtiną furnitūrą",
      },
    });

    console.info(`Analysis run ${run.id}: requesting Gemini transcription.`);
    const output = await extractDrawingDimensions(drawings);
    console.info(
      `Analysis run ${run.id}: Gemini returned ${output.observedPieces.length} pieces and ${output.unreadableItems.length} unreadable items in ${Date.now() - startedAt}ms.`,
    );

    phase = "saving transcription";
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", output, activity: null },
    });

    console.info(
      `Analysis run ${run.id} completed in ${Date.now() - startedAt}ms.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";

    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message, activity: null },
    });

    console.error(
      `Analysis run ${run.id} failed during ${phase} after ${Date.now() - startedAt}ms: ${message}`,
    );
  }
}
