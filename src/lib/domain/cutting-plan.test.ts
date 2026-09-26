import assert from "node:assert/strict";
import test from "node:test";
import { calculateCuttingPlan } from "@/lib/domain/cutting-plan";

const stock = {
  id: "stock-2000-600",
  label: "2000 × 600 mm",
  lengthMm: 2000,
  widthMm: 600,
  priceCents: 2999,
  url: "https://example.test/stock",
};

test("does not claim one 2000 × 600 board can yield three 700 × 450 cuts", () => {
  const result = calculateCuttingPlan(
    [
      {
        id: "door",
        label: "Door",
        quantity: 3,
        lengthMm: 700,
        widthMm: 450,
      },
    ],
    [stock],
    0,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.boards.length, 2);
    assert.equal(result.plan.boards[0].placements.length, 2);
    assert.equal(result.plan.boards[1].placements.length, 1);
  }
});

test("includes saw kerf in the fit calculation", () => {
  const result = calculateCuttingPlan(
    [
      {
        id: "panel",
        label: "Panel",
        quantity: 2,
        lengthMm: 1000,
        widthMm: 450,
      },
    ],
    [stock],
    3,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.boards.length, 2);
  }
});

test("chooses the lowest priced verified stock alternative", () => {
  const result = calculateCuttingPlan(
    [
      {
        id: "shelf",
        label: "Shelf",
        quantity: 1,
        lengthMm: 700,
        widthMm: 450,
      },
    ],
    [
      stock,
      {
        ...stock,
        id: "cheaper",
        label: "Cheaper board",
        priceCents: 1999,
      },
    ],
    0,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.stock.id, "cheaper");
  }
});

test("rotates a rectangular cut when that is the only way it fits", () => {
  const result = calculateCuttingPlan(
    [
      {
        id: "side",
        label: "Side panel",
        quantity: 1,
        lengthMm: 432,
        widthMm: 825,
      },
    ],
    [stock],
    0,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.boards[0].placements[0].rotated, true);
  }
});

test("reports when no available board can contain the cut", () => {
  const result = calculateCuttingPlan(
    [
      {
        id: "large-top",
        label: "Large top",
        quantity: 1,
        lengthMm: 2100,
        widthMm: 600,
      },
    ],
    [stock],
    0,
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "NO_FITTING_STOCK",
    oversizedRequirements: [
      {
        id: "large-top",
        label: "Large top",
        quantity: 1,
        lengthMm: 2100,
        widthMm: 600,
      },
    ],
  });
});
