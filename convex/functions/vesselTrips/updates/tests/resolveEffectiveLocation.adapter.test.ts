/**
 * Thin adapter tests: Convex wiring for resolveEffectiveLocation only.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { resolveEffectiveLocation } from "../tripLifecycle/resolveEffectiveLocation";

describe("resolveEffectiveLocation adapter", () => {
  it("returns the location unchanged when not at dock without running queries", async () => {
    let runQueryCount = 0;
    const location = {
      AtDock: false,
      LeftDock: undefined,
      TimeStamp: Date.now(),
    } as ConvexVesselLocation;

    const out = await resolveEffectiveLocation(
      {
        runQuery: async () => {
          runQueryCount += 1;
          return null;
        },
      } as never,
      location,
      undefined
    );

    expect(runQueryCount).toBe(0);
    expect(out).toBe(location);
  });
});
