import { z } from "zod";

export const materialKindSchema = z.enum([
  "LMDP",
  "SPRUCE_PANEL",
  "BIRCH_PANEL",
  "OTHER",
]);
export const workflowStateSchema = z.enum([
  "DRAFT",
  "ANALYSIS_REVIEW",
  "APPROVED",
  "PLANNED",
]);

/** Millimetres are persisted in tenths to keep geometry exact in the solver. */
export const millimetresSchema = z.number().finite().positive().multipleOf(0.1);

export const materialGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: materialKindSchema,
  thicknessMm: millimetresSchema,
  species: z.string().trim().max(80).optional(),
  decor: z.string().trim().max(120).optional(),
});

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120),
  materialGroup: materialGroupInputSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type MaterialGroupInput = z.infer<typeof materialGroupInputSchema>;
