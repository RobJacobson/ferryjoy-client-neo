/**
 * Tests for `computeVesselTripsWithClock`: empty compute shape with stub schedule and
 * prediction deps.
 */

import { describe, expect, it } from "bun:test";
import { computeVesselTripsWithClock } from "../computeVesselTripsWithClock";
import type { ScheduledSegmentLookup } from "../updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "../updateVesselTrips/processTick/defaultProcessVesselTripsDeps";

const stubLookup: ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: async () => null,
  getScheduledDockEventsForSailingDay: async () => [],
};

describe("computeVesselTripsWithClock", () => {
  it("returns stubbed tick time and empty trips compute for an empty batch", async () => {
    const tickStartedAt = 1_718_000_000_000;
    const deps = createDefaultProcessVesselTripsDeps(stubLookup);

    const result = await computeVesselTripsWithClock(
      {
        convexLocations: [],
        activeTrips: [],
      },
      deps,
      { tickStartedAt }
    );

    expect(result.tickStartedAt).toBe(tickStartedAt);
    expect(result.tripsCompute.completedHandoffs).toEqual([]);
    expect(result.tripsCompute.current.activeUpserts).toEqual([]);
    expect(result.tripsCompute.current.pendingActualMessages).toEqual([]);
    expect(result.tripsCompute.current.pendingPredictedMessages).toEqual([]);
    expect(result.tripsCompute.current.pendingLeaveDockEffects).toEqual([]);
  });
});
