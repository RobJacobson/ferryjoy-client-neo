/**
 * Unit tests for overlay-aligned prediction comparison helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  normalizeConvexPredictionForOverlayEquality,
  overlayPredictionProjectionsEqual,
} from "domain/vesselOrchestration/updateVesselPredictions";

const base = {
  PredTime: 1_000,
  MinTime: 900,
  MaxTime: 1_100,
  MAE: 2,
  StdDev: 1,
};

describe("overlayPredictionProjectionsEqual", () => {
  it("is true when only MAE and interval fields differ", () => {
    expect(
      overlayPredictionProjectionsEqual(
        { ...base, MAE: 1 },
        {
          ...base,
          MAE: 99,
          MinTime: base.MinTime + 5,
          MaxTime: base.MaxTime + 5,
        }
      )
    ).toBe(true);
  });

  it("is false when PredTime differs", () => {
    expect(
      overlayPredictionProjectionsEqual(base, { ...base, PredTime: 2_000 })
    ).toBe(false);
  });

  it("is false when Actual differs", () => {
    expect(
      overlayPredictionProjectionsEqual(
        { ...base, Actual: 100 },
        { ...base, Actual: 200 }
      )
    ).toBe(false);
  });

  it("is false when DeltaTotal differs", () => {
    expect(
      overlayPredictionProjectionsEqual(
        { ...base, DeltaTotal: 1 },
        { ...base, DeltaTotal: 2 }
      )
    ).toBe(false);
  });
});

describe("normalizeConvexPredictionForOverlayEquality", () => {
  it("drops ML-only keys from projection", () => {
    expect(
      normalizeConvexPredictionForOverlayEquality({
        ...base,
        MAE: 50,
      })
    ).toEqual({ PredTime: base.PredTime });
  });
});
