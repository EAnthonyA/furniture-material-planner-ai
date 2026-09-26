import assert from "node:assert/strict";
import test from "node:test";
import { manualObservedPieceSchema } from "@/lib/domain/drawing-extraction";

test("accepts a complete manually entered panel", () => {
  const result = manualObservedPieceSchema.safeParse({
    category: "PANEL",
    label: "viršutinė juosta",
    quantity: 2,
    lengthMm: null,
    widthMm: 750,
    heightMm: 35,
  });

  assert.equal(result.success, true);
});

test("rejects a manually entered panel with a missing dimension", () => {
  const result = manualObservedPieceSchema.safeParse({
    category: "PANEL",
    label: "viršutinė juosta",
    quantity: 2,
    lengthMm: null,
    widthMm: 750,
    heightMm: null,
  });

  assert.equal(result.success, false);
});

test("allows manually entered hinge quantities without dimensions", () => {
  const result = manualObservedPieceSchema.safeParse({
    category: "HINGE",
    label: "lankstai durelėms",
    quantity: 4,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
  });

  assert.equal(result.success, true);
});
