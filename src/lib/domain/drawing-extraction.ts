import { z } from "zod";

export const observedPieceSchema = z.object({
  category: z.enum(["PANEL", "TIMBER", "HINGE", "ADJUSTABLE_LEG"]),
  label: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive(),
  lengthMm: z.number().positive().multipleOf(0.1).nullable(),
  widthMm: z.number().positive().multipleOf(0.1).nullable(),
  heightMm: z.number().positive().multipleOf(0.1).nullable(),
});

/** A transcription of visible rectangles and their explicitly written dimensions. */
export const drawingExtractionSchema = z.object({
  observedPieces: z.array(observedPieceSchema).max(30),
  unreadableItems: z.array(z.string().trim().min(1).max(200)).max(10),
});

export type DrawingExtraction = z.infer<typeof drawingExtractionSchema>;

export const manualObservedPieceSchema = observedPieceSchema.superRefine(
  (piece, context) => {
    if (
      piece.category === "PANEL" &&
      (piece.widthMm === null || piece.heightMm === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Panel dimensions require width and height.",
      });
    }

    if (
      piece.category === "TIMBER" &&
      (piece.lengthMm === null ||
        piece.widthMm === null ||
        piece.heightMm === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Timber dimensions require length, width and thickness.",
      });
    }
  },
);
