/**
 * Tests for `computeVesselTripsWithClock`: empty compute shape with stub schedule and
 * prediction deps.
 */

import { describe, expect, it } from "bun:test";
import { computeVesselTripsWithClock } from "../computeVesselTripsWithClock";
import { computeShouldRunPredictionFallback } from "../updateVesselTrips";
import type { ScheduledSegmentLookup } from "../updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "../updateVesselTrips/processTick/defaultProcessVesselTripsDeps";

const stubLookup: ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: () => null,
  getScheduledDockEventsForSailingDay: () => [],
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

  it("echoes injected tick; policy helper agrees with seconds-of-minute for those instants", async () => {
    const deps = createDefaultProcessVesselTripsDeps(stubLookup);
    const tickEarlyInMinute = new Date("2026-03-13T12:00:03.000Z").getTime();
    const tickLateInMinute = new Date("2026-03-13T12:00:42.000Z").getTime();

    const early = await computeVesselTripsWithClock(
      { convexLocations: [], activeTrips: [] },
      deps,
      { tickStartedAt: tickEarlyInMinute }
    );
    const late = await computeVesselTripsWithClock(
      { convexLocations: [], activeTrips: [] },
      deps,
      { tickStartedAt: tickLateInMinute }
    );

    expect(early.tickStartedAt).toBe(tickEarlyInMinute);
    expect(late.tickStartedAt).toBe(tickLateInMinute);
    // Same helper drives `processOptions` inside `computeVesselTripsBundle` / `processVesselTrips`.
    expect(computeShouldRunPredictionFallback(early.tickStartedAt)).toBe(true);
    expect(computeShouldRunPredictionFallback(late.tickStartedAt)).toBe(false);
  });
});
