import { z } from "zod";

const sourceSchema = z.enum(["DRAWING", "OWNER_INPUT", "DERIVED", "AI_PROPOSAL", "MANUAL"]);
const dimensionSchema = z.object({
  valueMm: z.number().positive().multipleOf(0.1).nullable(),
  source: sourceSchema,
  confidence: z.number().min(0).max(1).nullable(),
});

/** The only analysis format allowed to cross the provider boundary. */
export const analysisDraftSchema = z.object({
  furnitureType: z.string().trim().min(1).max(100).nullable(),
  overallDimensions: z.object({ length: dimensionSchema, width: dimensionSchema, height: dimensionSchema }),
  proposedTemplate: z.string().trim().max(100).nullable(),
  questions: z.array(z.object({ id: z.string().uuid(), prompt: z.string().trim().min(1), required: z.boolean() })).max(30),
  parts: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(80),
    quantity: z.number().int().positive(),
    length: dimensionSchema,
    width: dimensionSchema,
    thickness: dimensionSchema,
    materialGroupName: z.string().trim().min(1),
  })).max(200),
});

export type AnalysisDraft = z.infer<typeof analysisDraftSchema>;
