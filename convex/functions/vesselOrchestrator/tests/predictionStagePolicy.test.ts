import { describe, expect, it, mock } from "bun:test";
import type { ActionCtx } from "_generated/server";
import { runStage3UpdateVesselPredictions } from "../action/pipeline/stage-3-updateVesselPredictions";

describe("prediction stage off-ramp policy", () => {
  it("skips prediction model context query when prediction inputs are empty", async () => {
    const runQuery = mock(async () => ({}));
    const ctx = { runQuery } as unknown as ActionCtx;

    const result = await runStage3UpdateVesselPredictions(ctx, {
      activeTrip: undefined,
      completedHandoff: undefined,
    });

    expect(result.predictionRows).toEqual([]);
    expect(result.mlTimelineOverlays).toEqual([]);
    expect(runQuery).toHaveBeenCalledTimes(0);
  });
});
