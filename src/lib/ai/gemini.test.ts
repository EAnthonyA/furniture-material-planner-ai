import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { ZodError } from "zod";
import { analyzeWithGemini, geminiResponseJsonSchema } from "@/lib/ai/gemini";
import type { AnalysisDraft } from "@/lib/domain/analysis";
import { translateAnalysisToLithuanian } from "@/lib/ai/translate-analysis";
import {
  getAnalysisText,
  getLithuanianAnalysis,
} from "@/lib/domain/analysis-localization";
import type { MaterialGroupInput } from "@/lib/domain/project";

const stateExpandingKeywords = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "anyOf",
  "oneOf",
  "enum",
];

test("Gemini response schema keeps the output shape without state-expanding constraints", () => {
  const serializedSchema = JSON.stringify(geminiResponseJsonSchema);

  for (const keyword of stateExpandingKeywords) {
    assert.equal(serializedSchema.includes(`\"${keyword}\"`), false);
  }

  assert.deepEqual(geminiResponseJsonSchema.properties.parts.items.properties, {
    label: { type: "string" },
    role: { type: "string" },
    quantity: { type: "integer" },
    length: { $ref: "#/$defs/dimension" },
    width: { $ref: "#/$defs/dimension" },
    thickness: { $ref: "#/$defs/dimension" },
    materialGroupName: { type: "string" },
  });
});

const drawings = [
  { mediaType: "image/png", data: Buffer.from("test drawing") },
];

function createDraft(): AnalysisDraft {
  return {
    furnitureType: "Cabinet",
    overallDimensions: {
      length: { valueMm: 800, source: "DRAWING", confidence: 0.9 },
      width: { valueMm: null, source: "DRAWING", confidence: null },
      height: { valueMm: 720, source: "DRAWING", confidence: 0.8 },
    },
    proposedTemplate: null,
    questions: [{ id: "depth", prompt: "What is the depth?", required: true }],
    parts: [
      {
        label: "Side",
        role: "side",
        quantity: 2,
        length: { valueMm: 720, source: "DRAWING", confidence: 0.8 },
        width: { valueMm: null, source: "AI_PROPOSAL", confidence: null },
        thickness: { valueMm: 18.1, source: "AI_PROPOSAL", confidence: 0.5 },
        materialGroupName: "Korpusas",
      },
    ],
  };
}

function mockGemini(t: TestContext, response: Response) {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-api-key";

  t.after(() => {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  });

  return t.mock.method(globalThis, "fetch", async () => response);
}

function analysisResponse(output: unknown) {
  return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
  });
}

test("sends the simplified schema and returns validated analysis with unknown dimensions", async (t) => {
  const draft = createDraft();
  const fetchMock = mockGemini(t, analysisResponse(draft));

  assert.deepEqual(await analyzeWithGemini(drawings), draft);
  assert.equal(fetchMock.mock.callCount(), 1);

  const [, options] = fetchMock.mock.calls[0].arguments;
  const request = JSON.parse(String(options?.body));

  assert.deepEqual(request.generationConfig, {
    responseMimeType: "application/json",
    responseJsonSchema: geminiResponseJsonSchema,
    maxOutputTokens: 4_096,
  });
  assert.deepEqual(request.contents[0].parts[1].inlineData, {
    mimeType: "image/png",
    data: drawings[0].data.toString("base64"),
  });
  assert.ok(options?.signal instanceof AbortSignal);
});

test("reports malformed Gemini candidate JSON clearly", async (t) => {
  mockGemini(
    t,
    Response.json({
      candidates: [{ content: { parts: [{ text: '{"parts": [' }] } }],
    }),
  );

  await assert.rejects(analyzeWithGemini(drawings), {
    message:
      "Gemini returned incomplete analysis data. Try again with a simpler or clearer drawing.",
  });
});

test("accepts Gemini JSON wrapped in a code fence", async (t) => {
  const draft = createDraft();
  mockGemini(
    t,
    Response.json({
      candidates: [
        {
          content: {
            parts: [{ text: `\`\`\`json\n${JSON.stringify(draft)}\n\`\`\`` }],
          },
        },
      ],
    }),
  );

  assert.deepEqual(await analyzeWithGemini(drawings), draft);
});

test("includes every configured material thickness and keeps analysis instructions in English", async (t) => {
  const materials: MaterialGroupInput[] = [
    { name: "Korpusas", kind: "LMDP", thicknessMm: 18.1, decor: "Ąžuolas" },
    { name: "Nugarėlė", kind: "OTHER", thicknessMm: 3 },
  ];
  const fetchMock = mockGemini(t, analysisResponse(createDraft()));

  await analyzeWithGemini(drawings, materials);

  const [, options] = fetchMock.mock.calls[0].arguments;
  const request = JSON.parse(String(options?.body));
  const materialJson = request.contents[0].parts[0].text.split("\n")[1];

  assert.deepEqual(JSON.parse(materialJson), {
    materialGroups: materials,
    ownerContext: null,
    ownerAnswers: [],
  });
  assert.match(
    request.systemInstruction.parts[0].text,
    /Perform the analysis in English/,
  );
  assert.match(request.systemInstruction.parts[0].text, /source OWNER_INPUT/);
  assert.match(
    request.systemInstruction.parts[0].text,
    /Do not ask the owner for a thickness already supplied/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /750 mm and two 18 mm side panels, its cut width is 714 mm/,
  );
  assert.match(request.systemInstruction.parts[0].text, /source DERIVED/);
  assert.match(
    request.systemInstruction.parts[0].text,
    /complementary views of the same 3D furniture/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /Assume rectangular panels and a rectangular cabinet by default/,
  );
});

test("sends owner context as project data and preserves its requested scope", async (t) => {
  const fetchMock = mockGemini(t, analysisResponse(createDraft()));
  const ownerContext =
    "Kriauklė bus ant stalviršio, todėl stalviršio į pjovinių sąrašą neįtraukite.";

  await analyzeWithGemini(drawings, [], ownerContext);

  const [, options] = fetchMock.mock.calls[0].arguments;
  const request = JSON.parse(String(options?.body));
  const projectData = request.contents[0].parts[0].text.split("\n")[1];

  assert.deepEqual(JSON.parse(projectData), {
    materialGroups: [],
    ownerContext,
    ownerAnswers: [],
  });
  assert.match(
    request.systemInstruction.parts[0].text,
    /do not include the worktop as a part/,
  );
});

test("sends owner answers as project data for a follow-up analysis", async (t) => {
  const fetchMock = mockGemini(t, analysisResponse(createDraft()));
  const ownerAnswers = [
    { questionId: "depth", question: "What is the depth?", answer: "432 mm" },
  ];

  await analyzeWithGemini(drawings, [], undefined, ownerAnswers);

  const [, options] = fetchMock.mock.calls[0].arguments;
  const request = JSON.parse(String(options?.body));
  const projectData = request.contents[0].parts[0].text.split("\n")[1];

  assert.deepEqual(JSON.parse(projectData).ownerAnswers, ownerAnswers);
  assert.match(
    request.systemInstruction.parts[0].text,
    /Do not ask a question again when it has a clear owner answer/,
  );
});

test("rejects invalid configured thickness before sending a Gemini request", async (t) => {
  const fetchMock = mockGemini(t, analysisResponse(createDraft()));

  await assert.rejects(
    analyzeWithGemini(drawings, [
      { name: "Korpusas", kind: "LMDP", thicknessMm: 18.05 },
    ]),
    ZodError,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("translates only display text and keeps the English analysis and geometry intact", async (t) => {
  const draft = createDraft();
  const original = structuredClone(draft);
  const lt = {
    furnitureType: "Spintelė",
    "questions.0.prompt": "Koks gylis?",
    "parts.0.label": "Šonas",
    "parts.0.role": "šoninė plokštė",
    "parts.0.materialGroupName": "Korpusas",
  };
  const entries = Object.entries(lt).map(([key, text]) => ({ key, text }));
  // Order is not identity: translation entries may come back reordered.
  const fetchMock = mockGemini(
    t,
    analysisResponse({ entries: [...entries].reverse() }),
  );

  const translation = await translateAnalysisToLithuanian(draft);
  const [, options] = fetchMock.mock.calls[0].arguments;
  const request = JSON.parse(String(options?.body));

  assert.deepEqual(JSON.parse(request.contents[0].parts[0].text), {
    entries: getAnalysisText(draft),
  });
  assert.equal(request.contents[0].parts.length, 1);
  assert.match(request.systemInstruction.parts[0].text, /natural Lithuanian/);
  for (const keyword of stateExpandingKeywords) {
    assert.equal(
      JSON.stringify(request.generationConfig.responseJsonSchema).includes(
        `"${keyword}"`,
      ),
      false,
    );
  }

  assert.deepEqual(translation, lt);
  assert.deepEqual(draft, original);

  const displayed = getLithuanianAnalysis({
    ...draft,
    translations: { lt: translation },
  });
  assert.ok(displayed);
  assert.equal(displayed.furnitureType, "Spintelė");
  assert.deepEqual(displayed.questions, [
    { id: "depth", prompt: "Koks gylis?", required: true },
  ]);
  assert.deepEqual(displayed.overallDimensions, draft.overallDimensions);
  assert.deepEqual(displayed.parts[0], {
    ...draft.parts[0],
    label: "Šonas",
    role: "šoninė plokštė",
  });
});

for (const failure of [
  "missing",
  "duplicate",
  "unexpected",
  "blank",
] as const) {
  test(`rejects ${failure} translated text instead of mixing languages or changing data`, async (t) => {
    const draft = createDraft();
    const entries = getAnalysisText(draft);

    if (failure === "missing") entries.pop();
    if (failure === "duplicate") entries[1] = entries[0];
    if (failure === "unexpected")
      entries[0] = { key: "parts.0.thickness.valueMm", text: "99" };
    if (failure === "blank") entries[0].text = " ";
    mockGemini(t, analysisResponse({ entries }));

    await assert.rejects(translateAnalysisToLithuanian(draft));
  });
}

test("does not send a translation request when there is no display text", async (t) => {
  const fetchMock = mockGemini(t, analysisResponse({ entries: [] }));
  const draft = {
    ...createDraft(),
    furnitureType: null,
    questions: [],
    parts: [],
  };

  assert.deepEqual(await translateAnalysisToLithuanian(draft), {});
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(
    getLithuanianAnalysis({ ...draft, translations: { lt: {} } })
      ?.furnitureType,
    null,
  );
});

test("legacy or incomplete translations require a new analysis instead of showing English", () => {
  const draft = createDraft();

  assert.equal(getLithuanianAnalysis(draft), null);
  assert.equal(
    getLithuanianAnalysis({ ...draft, translations: { lt: {} } }),
    null,
  );
  assert.equal(getLithuanianAnalysis(null), null);
});

test("validates an analysis wrapped in a single-item array", async (t) => {
  const draft = createDraft();
  mockGemini(t, analysisResponse([draft]));

  assert.deepEqual(await analyzeWithGemini(drawings), draft);
});

const invalidDrafts: Array<[string, (draft: AnalysisDraft) => unknown]> = [
  [
    "negative dimensions",
    (draft) => ({
      ...draft,
      overallDimensions: {
        ...draft.overallDimensions,
        length: { ...draft.overallDimensions.length, valueMm: -1 },
      },
    }),
  ],
  [
    "unsupported dimension precision",
    (draft) => ({
      ...draft,
      parts: [
        {
          ...draft.parts[0],
          thickness: { ...draft.parts[0].thickness, valueMm: 18.05 },
        },
      ],
    }),
  ],
  [
    "out-of-range confidence",
    (draft) => ({
      ...draft,
      overallDimensions: {
        ...draft.overallDimensions,
        length: { ...draft.overallDimensions.length, confidence: 1.1 },
      },
    }),
  ],
  [
    "unknown sources",
    (draft) => ({
      ...draft,
      overallDimensions: {
        ...draft.overallDimensions,
        length: { ...draft.overallDimensions.length, source: "GUESSED" },
      },
    }),
  ],
  [
    "zero quantities",
    (draft) => ({ ...draft, parts: [{ ...draft.parts[0], quantity: 0 }] }),
  ],
  [
    "fractional quantities",
    (draft) => ({ ...draft, parts: [{ ...draft.parts[0], quantity: 1.5 }] }),
  ],
  [
    "too many questions",
    (draft) => ({
      ...draft,
      questions: Array.from({ length: 31 }, () => draft.questions[0]),
    }),
  ],
  [
    "too many parts",
    (draft) => ({
      ...draft,
      parts: Array.from({ length: 201 }, () => draft.parts[0]),
    }),
  ],
  [
    "overlong furniture names",
    (draft) => ({ ...draft, furnitureType: "a".repeat(101) }),
  ],
  [
    "blank part labels",
    (draft) => ({ ...draft, parts: [{ ...draft.parts[0], label: "  " }] }),
  ],
];

for (const [description, invalidate] of invalidDrafts) {
  test(`rejects ${description} locally despite the relaxed provider schema`, async (t) => {
    mockGemini(t, analysisResponse(invalidate(createDraft())));

    await assert.rejects(analyzeWithGemini(drawings), ZodError);
  });
}

test("preserves Gemini error details when the provider rejects a request", async (t) => {
  const message =
    "The specified schema produces a constraint that has too many states for serving.";
  mockGemini(
    t,
    Response.json({ error: { code: 400, message } }, { status: 400 }),
  );

  await assert.rejects(analyzeWithGemini(drawings), {
    message: `Gemini request failed (400): ${message}`,
  });
});
