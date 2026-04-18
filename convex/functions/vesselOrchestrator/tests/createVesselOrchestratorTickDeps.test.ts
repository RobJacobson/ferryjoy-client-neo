/**
 * Smoke tests for {@link createVesselOrchestratorTickDeps}.
 */

import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import { createVesselOrchestratorTickDeps } from "../createVesselOrchestratorTickDeps";

/**
 * Minimal fake `ActionCtx` for factory construction. The factory only closes
 * over `ctx`; integration behavior is covered by orchestrator / domain tests.
 *
 * @returns Object cast to `ActionCtx`
 */
const fakeActionCtx = (): ActionCtx =>
  ({
    runMutation: async () => undefined,
    runQuery: async () => null,
  }) as unknown as ActionCtx;

describe("createVesselOrchestratorTickDeps", () => {
  it("returns deps with three async callables matching VesselOrchestratorTickDeps", () => {
    const deps = createVesselOrchestratorTickDeps(fakeActionCtx());

    expect(typeof deps.persistLocations).toBe("function");
    expect(typeof deps.processVesselTrips).toBe("function");
    expect(typeof deps.applyTickEventWrites).toBe("function");
  });
});
