import { z } from "zod";
import { analysisDraftSchema, type AnalysisDraft } from "@/lib/domain/analysis";

const translatedTextSchema = z.string().trim().min(1);

export const analysisTranslationResponseSchema = z
  .object({
    entries: z.array(
      z.object({ key: z.string(), text: translatedTextSchema }).strict(),
    ),
  })
  .strict();

export const analysisOutputSchema = analysisDraftSchema.extend({
  translations: z
    .object({
      lt: z.record(z.string(), translatedTextSchema),
    })
    .optional(),
});

export type AnalysisTranslation = Record<string, string>;

/** Only display text crosses the translation boundary, never geometry or provenance. */
export function getAnalysisText(draft: AnalysisDraft) {
  const entries: Array<{ key: string; text: string }> = [];
  const add = (key: string, text: string | null) => {
    if (text) {
      entries.push({ key, text });
    }
  };

  add("furnitureType", draft.furnitureType);
  add("proposedTemplate", draft.proposedTemplate);
  draft.questions.forEach((question, index) =>
    add(`questions.${index}.prompt`, question.prompt),
  );
  draft.parts.forEach((part, index) => {
    add(`parts.${index}.label`, part.label);
    add(`parts.${index}.role`, part.role);
    add(`parts.${index}.materialGroupName`, part.materialGroupName);
  });

  return entries;
}

export function parseAnalysisTranslation(
  draft: AnalysisDraft,
  raw: unknown,
): AnalysisTranslation {
  const { entries } = analysisTranslationResponseSchema.parse(raw);
  const expectedKeys = new Set(getAnalysisText(draft).map(({ key }) => key));
  const receivedKeys = new Set(entries.map(({ key }) => key));

  if (
    entries.length !== expectedKeys.size ||
    receivedKeys.size !== expectedKeys.size ||
    entries.some(({ key }) => !expectedKeys.has(key))
  ) {
    throw new Error(
      "Analysis translation must contain each display text key exactly once.",
    );
  }

  return Object.fromEntries(entries.map(({ key, text }) => [key, text]));
}

/** A display-only copy. Downstream reasoning must use the original English draft. */
export function localizeAnalysis(
  draft: AnalysisDraft,
  translation: AnalysisTranslation,
): AnalysisDraft {
  const texts = parseAnalysisTranslation(draft, {
    entries: Object.entries(translation).map(([key, text]) => ({ key, text })),
  });

  return {
    ...draft,
    furnitureType: draft.furnitureType === null ? null : texts.furnitureType,
    proposedTemplate: draft.proposedTemplate
      ? texts.proposedTemplate
      : draft.proposedTemplate,
    questions: draft.questions.map((question, index) => ({
      ...question,
      prompt: texts[`questions.${index}.prompt`],
    })),
    parts: draft.parts.map((part, index) => ({
      ...part,
      label: texts[`parts.${index}.label`],
      role: texts[`parts.${index}.role`],
      materialGroupName: texts[`parts.${index}.materialGroupName`],
    })),
  };
}

export function getLithuanianAnalysis(raw: unknown): AnalysisDraft | null {
  const output = analysisOutputSchema.safeParse(raw);

  if (!output.success || !output.data.translations) {
    return null;
  }

  try {
    return localizeAnalysis(output.data, output.data.translations.lt);
  } catch {
    return null;
  }
}
