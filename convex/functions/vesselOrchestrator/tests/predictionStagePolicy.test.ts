import { describe, expect, it, mock } from "bun:test";
import type { ActionCtx } from "_generated/server";
import { updateVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
import { loadPredictionContext } from "../pipeline/updateVesselPredictions";

describe("prediction stage off-ramp policy", () => {
  it("skips prediction model context query when prediction inputs are empty", async () => {
    const runQuery = mock(async () => ({}));
    const ctx = { runQuery } as unknown as ActionCtx;
    const tripUpdate = {
      vesselAbbrev: "CHE",
      existingActiveTrip: undefined,
      activeVesselTripUpdate: undefined,
      completedVesselTripUpdate: undefined,
    };

    const predictionContext = await loadPredictionContext(ctx, tripUpdate);
    expect(predictionContext).toEqual({});
    expect(runQuery).toHaveBeenCalledTimes(0);

    const result = await updateVesselPredictions({
      tripUpdate,
      predictionContext,
    });

    expect(result.predictionRows).toEqual([]);
    expect(result.mlTimelineOverlays).toEqual([]);
  });
});
