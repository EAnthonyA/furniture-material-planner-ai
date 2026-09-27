import assert from "node:assert/strict";
import test from "node:test";
import { calculateCuttingPlan } from "@/lib/domain/cutting-plan";
import {
  createSavedPurchasePlanSnapshot,
  savedPurchasePlanSnapshotSchema,
} from "@/lib/domain/saved-purchase-plan";

test("preserves a verified plan as a readable saved snapshot", () => {
  const requirements = [
    {
      id: "shelf",
      label: "Lentyna",
      quantity: 1,
      lengthMm: 700,
      widthMm: 450,
    },
  ];
  const result = calculateCuttingPlan(requirements, [
    {
      id: "stock",
      label: "2400 × 600 mm plokštė",
      lengthMm: 2400,
      widthMm: 600,
      priceCents: 4878,
      url: "https://example.test/stock",
    },
  ]);

  const snapshot = createSavedPurchasePlanSnapshot({
    runId: "c123456789012345678901234",
    requirements,
    result,
  });

  assert.equal(
    savedPurchasePlanSnapshotSchema.safeParse(snapshot).success,
    true,
  );
  assert.equal(snapshot.result.ok, true);
});

test("rejects an incomplete saved plan snapshot", () => {
  assert.equal(
    savedPurchasePlanSnapshotSchema.safeParse({
      runId: "c123456789012345678901234",
      requirements: [],
      result: { ok: true },
    }).success,
    false,
  );
});
