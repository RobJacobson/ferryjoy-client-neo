/**
 * Tests for `computeOrchestratorTripTick`: empty tick shape with stub schedule and
 * prediction deps.
 */

import { describe, expect, it } from "bun:test";
import { computeOrchestratorTripTick } from "../computeOrchestratorTripTick";
import type { ScheduledSegmentLookup } from "../updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "../updateVesselTrips/processTick/defaultProcessVesselTripsDeps";

const stubLookup: ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: async () => null,
  getScheduledDockEventsForSailingDay: async () => [],
};

describe("computeOrchestratorTripTick", () => {
  it("returns stubbed tick time and empty trip tick for an empty batch", async () => {
    const tickStartedAt = 1_718_000_000_000;
    const deps = createDefaultProcessVesselTripsDeps(stubLookup);

    const result = await computeOrchestratorTripTick(
      {
        convexLocations: [],
        activeTrips: [],
      },
      deps,
      { tickStartedAt }
    );

    expect(result.tickStartedAt).toBe(tickStartedAt);
    expect(result.vesselTripTick.completedHandoffs).toEqual([]);
    expect(result.vesselTripTick.current.activeUpserts).toEqual([]);
    expect(result.vesselTripTick.current.pendingActualMessages).toEqual([]);
    expect(result.vesselTripTick.current.pendingPredictedMessages).toEqual([]);
    expect(result.vesselTripTick.current.pendingLeaveDockEffects).toEqual([]);
  });
});
