/**
 * Tests for `computeOrchestratorTripWrites`: empty tick write shape with stub
 * schedule and prediction deps.
 */

import { describe, expect, it } from "bun:test";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import { computeOrchestratorTripWrites } from "../computeOrchestratorTripWrites";
import type { ScheduledSegmentLookup } from "../updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "../updateVesselTrips/processTick/defaultProcessVesselTripsDeps";

const noopPredictionModelAccess: VesselTripPredictionModelAccess = {
  loadModelForProductionPair: async () => null,
  loadModelsForProductionPairBatch: async () =>
    ({}) as Record<
      ModelType,
      | import("domain/ml/prediction/vesselTripPredictionModelAccess").ProductionModelParameters
      | null
    >,
};

const stubLookup: ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: async () => null,
  getScheduledDockEventsForSailingDay: async () => [],
};

describe("computeOrchestratorTripWrites", () => {
  it("returns stubbed tick time and empty trip writes for an empty batch", async () => {
    const tickStartedAt = 1_718_000_000_000;
    const deps = createDefaultProcessVesselTripsDeps(
      stubLookup,
      noopPredictionModelAccess
    );

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
