type GeminiFailure = {
  error?: { code?: number; message?: string; status?: string };
};
type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
};
type GeminiPart =
  { text: string } | { inlineData: { mimeType: string; data: string } };

const geminiRequestTimeoutMs = 30_000;

function createGenerationConfig(schema: object, thinkingBudget?: number) {
  return {
    responseMimeType: "application/json",
    responseJsonSchema: schema,
    maxOutputTokens: 4_096,
    ...(thinkingBudget === undefined
      ? {}
      : { thinkingConfig: { thinkingBudget } }),
  };
}

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

function parseGeminiJson(payload: GeminiResponse): unknown {
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  if (!text) {
    throw new Error("Gemini returned no analysis output.");
  }

  let raw: unknown;
  const normalizedText = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    raw = JSON.parse(normalizedText) as unknown;
  } catch {
    console.warn(
      `Gemini returned invalid candidate JSON: finishReason=${candidate?.finishReason || "unknown"}, characters=${text.length}, beginning=${JSON.stringify(text.slice(0, 160))}, ending=${JSON.stringify(text.slice(-160))}.`,
    );
    throw new Error(
      "Gemini returned incomplete analysis data. Try again with a simpler or clearer drawing.",
    );
  }

  // Some models wrap the requested object in a single-item array.
  // Callers still validate the unwrapped value at their domain boundary.
  return Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
}

export async function requestGeminiJson({
  instruction,
  parts,
  schema,
  thinkingBudget,
}: {
  instruction: string;
  parts: GeminiPart[];
  schema: object;
  thinkingBudget?: number;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geminiRequestTimeoutMs);
  let response: Response;

  console.info(
    `Gemini request started: model=${model}, parts=${parts.length}, timeout=${geminiRequestTimeoutMs}ms, thinkingBudget=${thinkingBudget ?? "default"}.`,
  );

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents: [{ parts }],
          generationConfig: createGenerationConfig(schema, thinkingBudget),
        }),
      },
    );
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    if (controller.signal.aborted) {
      console.warn(`Gemini request timed out after ${elapsedMs}ms.`);
      throw new Error("Gemini analysis timed out after 30 seconds.");
    }

    console.error(`Gemini request failed after ${elapsedMs}ms.`, error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  console.info(
    `Gemini response received: status=${response.status}, elapsed=${Date.now() - startedAt}ms.`,
  );

  if (!response.ok) {
    throw await createGeminiRequestError(response);
  }

  const payload = (await response.json()) as GeminiResponse;

  const responseCharacters = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text?.length || 0)
    .reduce((total, length) => total + length, 0);
  console.info(
    `Gemini response parsed: outputCharacters=${responseCharacters || 0}, elapsed=${Date.now() - startedAt}ms.`,
  );

  return parseGeminiJson(payload);
}
