/**
 * Tests for `computeOrchestratorTripWrites`: empty tick write shape with stub
 * schedule and prediction deps.
 */

import { describe, expect, it } from "bun:test";
import { computeOrchestratorTripWrites } from "../computeOrchestratorTripWrites";
import type { ScheduledSegmentLookup } from "../updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "../updateVesselTrips/processTick/defaultProcessVesselTripsDeps";

const stubLookup: ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: async () => null,
  getScheduledDockEventsForSailingDay: async () => [],
};

describe("computeOrchestratorTripWrites", () => {
  it("returns stubbed tick time and empty trip writes for an empty batch", async () => {
    const tickStartedAt = 1_718_000_000_000;
    const deps = createDefaultProcessVesselTripsDeps(stubLookup);

    const result = await computeOrchestratorTripWrites(
      {
        convexLocations: [],
        activeTrips: [],
      },
      deps,
      { tickStartedAt }
    );

    expect(result.tickStartedAt).toBe(tickStartedAt);
    expect(result.tripWrites.completedHandoffs).toEqual([]);
    expect(result.tripWrites.current.activeUpserts).toEqual([]);
    expect(result.tripWrites.current.pendingActualMessages).toEqual([]);
    expect(result.tripWrites.current.pendingPredictedMessages).toEqual([]);
    expect(result.tripWrites.current.pendingLeaveDockEffects).toEqual([]);
  });
});
