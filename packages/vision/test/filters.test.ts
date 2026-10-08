import assert from "node:assert/strict";
import test from "node:test";
import { DurationDebouncer } from "../src/filters/debounce.ts";
import { ExponentialMovingAverage } from "../src/filters/ema.ts";
import { HysteresisComparator } from "../src/filters/hysteresis.ts";

test("EMA seeds on first sample then blends", () => {
  const ema = new ExponentialMovingAverage(0.5);
  assert.equal(ema.update(10), 10);
  assert.equal(ema.update(0), 5);
  ema.reset();
  assert.equal(ema.getValue(), 0);
});

test("hysteresis does not chatter between thresholds", () => {
  const gate = new HysteresisComparator(0.8, 0.2);
  assert.equal(gate.evaluate(0.5), false);
  assert.equal(gate.evaluate(0.8), true);
  assert.equal(gate.evaluate(0.5), true);
  assert.equal(gate.evaluate(0.2), false);
});

test("debouncer fires only after the hold duration", () => {
  const hold = new DurationDebouncer(200);
  assert.equal(hold.update(true, 0), false);
  assert.equal(hold.update(true, 199), false);
  assert.equal(hold.update(true, 200), true);
  assert.equal(hold.update(true, 400), false);
  assert.equal(hold.update(false, 500), false);
});
