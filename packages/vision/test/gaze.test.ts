import assert from "node:assert/strict";
import test from "node:test";
import { averageBlendshapePair } from "../src/features/gaze-blend.ts";

test("gaze averages left and right blendshapes independently", () => {
  assert.equal(averageBlendshapePair(1, undefined), 0.5);
  assert.equal(averageBlendshapePair(1, 1), 1);
  assert.equal(averageBlendshapePair(undefined, undefined), 0);
});
