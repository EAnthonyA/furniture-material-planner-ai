import { z } from "zod";
import { analysisDraftSchema, type AnalysisDraft } from "@/lib/domain/analysis";

type DrawingInput = { mediaType: string; data: Buffer };
type GeminiFailure = {
  error?: { code?: number; message?: string; status?: string };
};
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

const prompt = `You analyze hand-drawn furniture sketches. Return JSON only. Do not invent measurements: use null when unreadable or absent. Suggest parts and construction choices but mark every suggestion as AI_PROPOSAL. Use DRAWING only for values visibly labelled in the images. Each question needs a short stable id. The owner must later review every result.`;

async function createGeminiRequestError(response: Response) {
  const failure = (await response
    .json()
    .catch(() => null)) as GeminiFailure | null;
  const providerError = failure?.error;
  const detail =
    providerError?.message ||
    providerError?.status ||
    "No diagnostic was returned by Gemini.";

  return new Error(
    `Gemini request failed (${providerError?.code || response.status}): ${detail}`,
  );
}

function parseGeminiResponse(response: GeminiResponse): AnalysisDraft {
  const parts = response.candidates?.[0]?.content?.parts;
  const text = parts?.map((part) => part.text || "").join("");

  if (!text) {
    throw new Error("Gemini returned no analysis output.");
  }

  const raw = JSON.parse(text) as unknown;
  // Some models occasionally wrap one requested object in a single-item array.
  // Unwrap only that harmless shape; everything else must pass the full schema.
  const draft = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;

  return analysisDraftSchema.parse(draft);
}

export async function analyzeWithGemini(
  drawings: DrawingInput[],
): Promise<AnalysisDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  if (drawings.length === 0) {
    throw new Error("No drawings were supplied for analysis.");
  }

  const requestBody = {
    systemInstruction: { parts: [{ text: prompt }] },
    contents: [
      {
        parts: [
          {
            text: "Extract the furniture requirements from these drawings.",
          },
          ...drawings.map((drawing) => ({
            inlineData: {
              mimeType: drawing.mediaType,
              data: drawing.data.toString("base64"),
            },
          })),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(analysisDraftSchema),
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const error = await createGeminiRequestError(response);

    throw error;
  }

  const payload = (await response.json()) as GeminiResponse;

  return parseGeminiResponse(payload);
}
