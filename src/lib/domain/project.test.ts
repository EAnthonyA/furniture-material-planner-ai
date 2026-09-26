import assert from "node:assert/strict";
import test from "node:test";
import { createProjectInputSchema, millimetresSchema } from "./project";

test("accepts a project with tenths-of-a-millimetre thickness", () => {
  const result = createProjectInputSchema.safeParse({
    name: "Prieškambario spintelė",
    materialGroup: { name: "Korpusas", kind: "LMDP", thicknessMm: 18.0, decor: "Ąžuolas" },
  });

  assert.equal(result.success, true);
});

test("rejects geometry that would lose precision in the solver", () => {
  assert.equal(millimetresSchema.safeParse(18.05).success, false);
  assert.equal(millimetresSchema.safeParse(-18).success, false);
});

test("requires a non-empty project name", () => {
  const result = createProjectInputSchema.safeParse({
    name: "   ",
    materialGroup: { name: "Korpusas", kind: "LMDP", thicknessMm: 18 },
  });

  assert.equal(result.success, false);
});
