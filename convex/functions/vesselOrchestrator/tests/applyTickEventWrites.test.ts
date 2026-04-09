/**
 * Parity tests for orchestrator timeline write application.
 */

import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import { applyTickEventWrites } from "../applyTickEventWrites";

describe("applyTickEventWrites", () => {
  it("does not invoke mutations when both write lists are empty", async () => {
    const mutationCalls: unknown[] = [];
    const ctx = {
      runMutation: async () => {
        mutationCalls.push("mutation");
        return null;
      },
    } as unknown as ActionCtx;

    await applyTickEventWrites(ctx, {
      actualPatches: [],
      predictedEffects: [],
    });

    expect(mutationCalls).toHaveLength(0);
  });
});
