/**
 * Worker entry point. Queue registration deliberately follows the shared domain
 * contracts; jobs will be added after pg-boss is wired in the next slice.
 *
 * It stays alive in the meantime so the Docker service has the same lifecycle
 * it will have once it is consuming durable jobs.
 */
import { prisma } from "@/lib/db/prisma";
import { processAnalysisRun } from "@/lib/ai/process-analysis";

console.info("Furniture planner worker started.");

async function processPendingRuns() {
  const run = await prisma.analysisRun.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (run) {
    await processAnalysisRun(run.id);
  }
}

void processPendingRuns();
const poll = setInterval(() => void processPendingRuns(), 5_000);

function stop(signal: NodeJS.Signals) {
  console.info(`Furniture planner worker received ${signal}; stopping.`);
  clearInterval(poll);
  process.exit(0);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
