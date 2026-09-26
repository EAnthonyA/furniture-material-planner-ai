import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import {
  drawingExtractionResponseJsonSchema,
  extractDrawingDimensions,
} from "@/lib/ai/gemini";

function mockGemini(t: TestContext, output: unknown) {
  const previousApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-api-key";

  t.after(() => {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  });

  return t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
    }),
  );
}

test("transcribes only visible piece dimensions", async (t) => {
  const output = {
    sharedMeasurements: {
      overallWidthMm: 750,
      overallHeightMm: 825,
      overallDepthMm: 432,
      doorHeightMm: 750,
      plinthHeightMm: 100,
    },
    observedPieces: [
      {
        category: "PANEL",
        label: "door with handle",
        quantity: 2,
        lengthMm: null,
        widthMm: 373,
        heightMm: 750,
      },
      {
        category: "HINGE",
        label: "hinges for doors",
        quantity: 4,
        lengthMm: null,
        widthMm: null,
        heightMm: null,
      },
      {
        category: "PANEL",
        label: "left rectangle",
        quantity: 1,
        lengthMm: null,
        widthMm: 452,
        heightMm: 825,
      },
      {
        category: "TIMBER",
        label: "sink support frame",
        quantity: 2,
        lengthMm: 750,
        widthMm: 100,
        heightMm: 25,
      },
    ],
    unreadableItems: ["Top rectangle: no legible pair of dimensions."],
  };
  const fetchMock = mockGemini(t, output);

  const extraction = await extractDrawingDimensions([
    { mediaType: "image/png", data: Buffer.from("test drawing") },
  ]);

  assert.deepEqual(extraction.observedPieces, output.observedPieces);
  assert.deepEqual(extraction.unreadableItems, output.unreadableItems);

  const [, options] = fetchMock.mock.calls[0].arguments;
  const request = JSON.parse(String(options?.body));

  assert.deepEqual(request.generationConfig, {
    responseMimeType: "application/json",
    responseJsonSchema: drawingExtractionResponseJsonSchema,
    maxOutputTokens: 4_096,
    thinkingConfig: { thinkingBudget: 2_048 },
  });
  assert.match(
    request.systemInstruction.parts[0].text,
    /Do not calculate dimensions/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /Do not infer joinery, cut sizes, materials, thickness, furniture type/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /pair explicitly written dimensions from complementary front, side, or top views/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /two front doors each labelled 373 wide, with a shared door height labelled 750/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /Dashed lines represent hidden internal parts or edges/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /Never treat graph-paper lines, ruled-paper lines, shading, hatching/,
  );
  assert.match(
    request.systemInstruction.parts[0].text,
    /Never return screws, nails, brackets, handles, glue, fasteners/,
  );
});

test("completes standard cabinet panels from explicitly transcribed shared dimensions", async (t) => {
  mockGemini(t, {
    sharedMeasurements: {
      overallWidthMm: 750,
      overallHeightMm: 825,
      overallDepthMm: 432,
      doorHeightMm: 750,
      plinthHeightMm: 100,
    },
    observedPieces: [
      {
        category: "PANEL",
        label: "left door",
        quantity: 1,
        lengthMm: null,
        widthMm: 373,
        heightMm: null,
      },
      {
        category: "PANEL",
        label: "right side panel",
        quantity: 1,
        lengthMm: null,
        widthMm: 432,
        heightMm: null,
      },
      {
        category: "PANEL",
        label: "front plinth panel",
        quantity: 1,
        lengthMm: null,
        widthMm: 100,
        heightMm: null,
      },
    ],
    unreadableItems: [],
  });

  const extraction = await extractDrawingDimensions([
    { mediaType: "image/png", data: Buffer.from("test drawing") },
  ]);

  assert.deepEqual(extraction.observedPieces, [
    {
      category: "PANEL",
      label: "left door",
      quantity: 1,
      lengthMm: null,
      widthMm: 373,
      heightMm: 750,
    },
    {
      category: "PANEL",
      label: "right side panel",
      quantity: 1,
      lengthMm: null,
      widthMm: 432,
      heightMm: 825,
    },
    {
      category: "PANEL",
      label: "front plinth panel",
      quantity: 1,
      lengthMm: null,
      widthMm: 750,
      heightMm: 100,
    },
  ]);
});

test("rejects an invalid transcribed dimension", async (t) => {
  mockGemini(t, {
    observedPieces: [
      {
        category: "PANEL",
        label: "door",
        quantity: 1,
        lengthMm: null,
        widthMm: -373,
        heightMm: 750,
      },
    ],
    unreadableItems: [],
  });

  await assert.rejects(() =>
    extractDrawingDimensions([
      { mediaType: "image/png", data: Buffer.from("test drawing") },
    ]),
  );
});
