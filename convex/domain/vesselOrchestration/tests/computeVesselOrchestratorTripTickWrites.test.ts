/**
 * Tests for `computeVesselOrchestratorTripTickWrites`: trip-eligible gating and
 * empty tick write shape with stub schedule and prediction deps.
 */

import { describe, expect, it } from "bun:test";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import type { TerminalIdentity } from "functions/terminals/schemas";
import { computeVesselOrchestratorTripTickWrites } from "../computeVesselOrchestratorTripTickWrites";
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

const testTerminals: TerminalIdentity[] = [
  {
    TerminalID: 1,
    TerminalName: "Anacortes",
    TerminalAbbrev: "ANA",
    IsPassengerTerminal: true,
  },
  {
    TerminalID: 15,
    TerminalName: "Orcas Island",
    TerminalAbbrev: "ORI",
    IsPassengerTerminal: true,
  },
];

describe("computeVesselOrchestratorTripTickWrites", () => {
  it("returns stubbed tick time and empty trip writes for an empty batch", async () => {
    const tickStartedAt = 1_718_000_000_000;
    const deps = createDefaultProcessVesselTripsDeps(
      stubLookup,
      noopPredictionModelAccess
    );

    const result = await computeVesselOrchestratorTripTickWrites(
      {
        convexLocations: [],
        terminalsIdentity: testTerminals,
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
