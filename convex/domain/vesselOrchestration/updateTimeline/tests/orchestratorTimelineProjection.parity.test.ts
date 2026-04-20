/**
 * Locks projection assembly behavior for the timeline ML merge path (Stage F).
 */

import { describe, expect, it } from "bun:test";
import {
  buildTimelineProjectionAssemblyFromTripComputations,
  mergePredictedComputationsIntoTimelineProjectionAssembly,
  runUpdateVesselTimeline,
} from "../orchestratorTimelineProjection";

describe("orchestratorTimelineProjection parity", () => {
  it("empty handoffs and predictions yield stable empty assembly", () => {
    const assembly = buildTimelineProjectionAssemblyFromTripComputations([]);
    const merged = mergePredictedComputationsIntoTimelineProjectionAssembly(
      assembly,
      []
    );
    expect(merged).toEqual({
      completedFacts: [],
      currentBranch: {
        successfulVessels: new Set(),
        pendingActualMessages: [],
        pendingPredictedMessages: [],
      },
    });
  });

  it("runUpdateVesselTimeline emits no predicted rows when Stage C/D handoffs are empty", () => {
    const tickStartedAt = 1_701_000_000_000;
    const out = runUpdateVesselTimeline({
      tickStartedAt,
      tripComputations: [],
      predictedTripComputations: [],
    });
    expect(out.actualEvents).toEqual([]);
    expect(out.predictedEvents).toEqual([]);
  });
});
