/**
 * Tests for {@link computeVesselTripsBundle}: empty batch → empty bundle (smoke).
 */

import { describe, expect, it } from "bun:test";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/shared";
import { createDefaultProcessVesselTripsDeps } from "../processTick/defaultProcessVesselTripsDeps";
import { computeVesselTripsBundle } from "../processTick/processVesselTrips";

const stubLookup: ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: () => null,
  getScheduledDockEventsForSailingDay: () => [],
};

describe("computeVesselTripsBundle", () => {
  it("returns empty trips compute for an empty batch", async () => {
    const deps = createDefaultProcessVesselTripsDeps(stubLookup);

    const { bundle } = await computeVesselTripsBundle([], deps, []);

    expect(bundle.completedHandoffs).toEqual([]);
    expect(bundle.current.activeUpserts).toEqual([]);
    expect(bundle.current.pendingActualMessages).toEqual([]);
    expect(bundle.current.pendingPredictedMessages).toEqual([]);
    expect(bundle.current.pendingLeaveDockEffects).toEqual([]);
  });
});
