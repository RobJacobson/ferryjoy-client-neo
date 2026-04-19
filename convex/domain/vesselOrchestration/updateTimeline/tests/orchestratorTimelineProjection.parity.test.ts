/**
 * Locks projection assembly behavior for the timeline ML merge path (Stage F).
 */

import { describe, expect, it } from "bun:test";
import {
  buildTimelineProjectionAssemblyFromTripComputations,
  mergePredictedComputationsIntoTimelineProjectionAssembly,
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
});
