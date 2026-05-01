import { describe, expect, it, mock } from "bun:test";
import type { ActionCtx } from "_generated/server";
import { loadPredictionContext } from "../actions/ping/updateVesselPredictions";

describe("prediction stage off-ramp policy", () => {
  it("skips prediction model context query when there are no preload requests", async () => {
    const runQuery = mock(async () => ({}));
    const ctx = { runQuery } as unknown as ActionCtx;

    const predictionContext = await loadPredictionContext(ctx, null);
    expect(predictionContext).toEqual({});
    expect(runQuery).toHaveBeenCalledTimes(0);
  });
});
