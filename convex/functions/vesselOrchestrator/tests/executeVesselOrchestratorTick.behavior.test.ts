/**
 * Branch isolation and metrics for {@link executeVesselOrchestratorTick} using
 * `ActionCtx` fakes that route on mutation **payload shape** (Convex function
 * references are not reliably `===` across bundles).
 */

import { describe, expect, it } from "bun:test";
import type { ActionCtx } from "_generated/server";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { executeVesselOrchestratorTick } from "../executeVesselOrchestratorTick";
import { makeOrchestratorTickTestLocation } from "./orchestratorTickTestFixtures";

/**
 * Args for `vesselLocation.mutations.bulkUpsert` (location snapshot only — not
 * trip batch `activeUpserts`).
 *
 * @param args - Mutation arguments
 * @returns Whether this is the orchestrator location bulk upsert
 */
const isLocationBulkUpsertArgs = (args?: Record<string, unknown>): boolean =>
  !!(
    args &&
    typeof args === "object" &&
    "locations" in args &&
    !("activeUpserts" in args)
  );

/**
 * Trip branch happy-path stub (batch upsert shape) for mutations after location
 * bulk upsert.
 *
 * @param args - Mutation arguments
 * @returns Stubbed mutation results
 */
const stubTripHappyPath = async (
  args?: Record<string, unknown>
): Promise<unknown> => {
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
  if (isLocationBulkUpsertArgs(args)) {
    return null;
  }
  return undefined;
};

describe("executeVesselOrchestratorTick (branch isolation)", () => {
  const passengerAbbrevs = new Set(["ANA", "ORI"]);
  const tickStartedAt = new Date("2026-06-01T12:00:02Z").getTime();

  it("isolates location branch failure from trip branch success", async () => {
    const ctx = {
      runMutation: async (_ref: unknown, args?: Record<string, unknown>) => {
        if (isLocationBulkUpsertArgs(args)) {
          throw new Error("bulk upsert failed");
        }
        return stubTripHappyPath(args);
      },
      runQuery: async () => null,
    } as unknown as ActionCtx;

    const result = await executeVesselOrchestratorTick(ctx, {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: passengerAbbrevs,
      tickStartedAt,
      activeTrips: [],
    });

    expect(result.locationsSuccess).toBe(false);
    expect(result.tripsSuccess).toBe(true);
    expect(result.errors?.locations?.message).toBe("bulk upsert failed");
    expect(result.errors?.trips).toBeUndefined();
  });

  it("isolates trip branch failure from location branch success", async () => {
    const ctx = {
      runMutation: async (_ref: unknown, args?: Record<string, unknown>) => {
        if (isLocationBulkUpsertArgs(args)) {
          return null;
        }
        throw new Error("trip pipeline failed");
      },
      runQuery: async () => null,
    } as unknown as ActionCtx;

    const result = await executeVesselOrchestratorTick(ctx, {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: passengerAbbrevs,
      tickStartedAt,
      activeTrips: [],
    });

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(false);
    expect(result.errors?.trips?.message).toBe("trip pipeline failed");
    expect(result.errors?.locations).toBeUndefined();
  });

  it("omits errors when both branches succeed", async () => {
    const ctx = {
      runMutation: async (_ref: unknown, args?: Record<string, unknown>) =>
        stubTripHappyPath(args),
      runQuery: async () => null,
    } as unknown as ActionCtx;

    const result = await executeVesselOrchestratorTick(ctx, {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: passengerAbbrevs,
      tickStartedAt,
      activeTrips: [] as TickActiveTrip[],
    });

    expect(result.locationsSuccess).toBe(true);
    expect(result.tripsSuccess).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.tickMetrics.persistLocationsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.processVesselTripsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.applyTickEventWritesMs).toBeGreaterThanOrEqual(0);
  });

  it("records persistLocationsMs when the location branch fails", async () => {
    const ctx = {
      runMutation: async (_ref: unknown, args?: Record<string, unknown>) => {
        if (isLocationBulkUpsertArgs(args)) {
          throw new Error("bulk upsert failed");
        }
        return stubTripHappyPath(args);
      },
      runQuery: async () => null,
    } as unknown as ActionCtx;

    const result = await executeVesselOrchestratorTick(ctx, {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: passengerAbbrevs,
      tickStartedAt,
      activeTrips: [],
    });

    expect(result.tickMetrics.persistLocationsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.processVesselTripsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.applyTickEventWritesMs).toBeGreaterThanOrEqual(0);
  });

  it("records processVesselTripsMs when the trip branch fails before timeline", async () => {
    const ctx = {
      runMutation: async (_ref: unknown, args?: Record<string, unknown>) => {
        if (isLocationBulkUpsertArgs(args)) {
          return null;
        }
        throw new Error("trip pipeline failed");
      },
      runQuery: async () => null,
    } as unknown as ActionCtx;

    const result = await executeVesselOrchestratorTick(ctx, {
      convexLocations: [makeOrchestratorTickTestLocation()],
      passengerTerminalAbbrevs: passengerAbbrevs,
      tickStartedAt,
      activeTrips: [],
    });

    expect(result.tickMetrics.processVesselTripsMs).toBeGreaterThanOrEqual(0);
    expect(result.tickMetrics.applyTickEventWritesMs).toBeUndefined();
  });
});
