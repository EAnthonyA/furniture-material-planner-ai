import { z } from "zod";
import type {
  CutRequirement,
  CuttingPlanResult,
} from "@/lib/domain/cutting-plan";

const cutRequirementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  quantity: z.number().int().positive(),
  lengthMm: z.number().positive(),
  widthMm: z.number().positive(),
});

const stockBoardSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  lengthMm: z.number().positive(),
  widthMm: z.number().positive(),
  priceCents: z.number().int().nonnegative().nullable(),
  url: z.string().url(),
});

const cutPlacementSchema = z.object({
  requirementId: z.string().min(1),
  label: z.string().min(1),
  lengthMm: z.number().positive(),
  widthMm: z.number().positive(),
  rotated: z.boolean(),
  xMm: z.number().nonnegative(),
  yMm: z.number().nonnegative(),
});

const purchasePlanSchema = z.object({
  stock: stockBoardSchema,
  boards: z.array(
    z.object({
      boardNumber: z.number().int().positive(),
      placements: z.array(cutPlacementSchema),
      remainingAreaMm2: z.number().nonnegative(),
    }),
  ),
  totalCents: z.number().int().nonnegative().nullable(),
  sawKerfMm: z.number().positive(),
});

const cuttingPlanResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    plan: purchasePlanSchema,
    alternatives: z.array(purchasePlanSchema),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["NO_REQUIREMENTS", "NO_FITTING_STOCK"]),
    oversizedRequirements: z.array(cutRequirementSchema),
  }),
]);

export const savedPurchasePlanSnapshotSchema = z.object({
  runId: z.string().cuid(),
  requirements: z.array(cutRequirementSchema),
  result: cuttingPlanResultSchema,
});

export type SavedPurchasePlanSnapshot = z.infer<
  typeof savedPurchasePlanSnapshotSchema
>;

export function createSavedPurchasePlanSnapshot({
  runId,
  requirements,
  result,
}: {
  runId: string;
  requirements: CutRequirement[];
  result: CuttingPlanResult;
}): SavedPurchasePlanSnapshot {
  return savedPurchasePlanSnapshotSchema.parse({ runId, requirements, result });
}
