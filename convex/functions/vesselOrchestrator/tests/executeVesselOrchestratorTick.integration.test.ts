/**
 * Integration tests for {@link executeVesselOrchestratorTick} with fake
 * `ActionCtx` stubs (no real Convex).
 */

import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { executeVesselOrchestratorTick } from "../executeVesselOrchestratorTick";
import { makeOrchestratorTickTestLocation } from "./orchestratorTickTestFixtures";

/**
 * Minimal fake `ActionCtx` for stubs that never touch real Convex.
 *
 * @returns Object cast to `ActionCtx`
 */
const fakeActionCtx = (): ActionCtx =>
  ({
    runMutation: async () => undefined,
    runQuery: async () => null,
  }) as unknown as ActionCtx;

/**
 * Stubs `runMutation` by payload shape so trip batch upsert returns a valid
 * `perVessel` result without relying on function-reference identity.
 *
 * @returns Object cast to `ActionCtx`
 */
const fakeActionCtxOrchestratorHappyPath = (): ActionCtx =>
  ({
    runMutation: async (_ref: unknown, args?: Record<string, unknown>) => {
      if (args && typeof args === "object" && "activeUpserts" in args) {
        const ups = args.activeUpserts;
        return {
          perVessel: Array.isArray(ups)
            ? ups.map((t: { VesselAbbrev: string }) => ({
                vesselAbbrev: t.VesselAbbrev,
                ok: true,
              }))
            : [],
        };
      }
      if (args && typeof args === "object" && "locations" in args) {
        return null;
      }
      return undefined;
    },
    runQuery: async () => null,
  }) as unknown as ActionCtx;

describe("executeVesselOrchestratorTick (integration stubs)", () => {
  it("completes for empty locations and no active trips", async () => {
    const tickStartedAt = 1_700_000_000_000;
    const input = {
      convexLocations: [] as ConvexVesselLocation[],
      passengerTerminalAbbrevs: new Set<string>(),
      tickStartedAt,
      activeTrips: [] as TickActiveTrip[],
    };

    const ctx = fakeActionCtx();
    const result = await executeVesselOrchestratorTick(ctx, input);

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(true);
    expect(result.errors).toBeUndefined();
    for (const key of Object.keys(result.tickMetrics) as Array<
      keyof typeof result.tickMetrics
    >) {
      const ms = result.tickMetrics[key];
      expect(typeof ms).toBe("number");
      expect(ms).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports trip branch outcome when trip mutations receive undefined results", async () => {
    const tickStartedAt = new Date("2026-06-01T12:00:02Z").getTime();
    const input = {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: new Set(["ANA", "ORI"]),
      tickStartedAt,
      activeTrips: [] as TickActiveTrip[],
    };

    const ctx = fakeActionCtx();
    const result = await executeVesselOrchestratorTick(ctx, input);

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(false);
    expect(result.errors?.trips?.message).toBeDefined();
    expect(result.errors?.locations).toBeUndefined();
    expect(result.tickMetrics.processVesselTripsMs).toBeGreaterThanOrEqual(0);
  });

  it("succeeds on happy path with trip batch upsert stub", async () => {
    const tickStartedAt = new Date("2026-06-01T12:00:02Z").getTime();
    const input = {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: new Set(["ANA", "ORI"]),
      tickStartedAt,
      activeTrips: [] as TickActiveTrip[],
    };

    const ctx = fakeActionCtxOrchestratorHappyPath();
    const result = await executeVesselOrchestratorTick(ctx, input);

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(true);
    expect(result.errors).toBeUndefined();

    expect(result.tickMetrics.persistLocationsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.processVesselTripsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.applyTickEventWritesMs).toBeGreaterThanOrEqual(0);
  });
});
