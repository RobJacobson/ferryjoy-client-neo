/**
 * Top-level real-time vessel orchestrator.
 *
 * Fetches one batch of WSF vessel locations, converts it into backend-owned
 * identity, then fans that same batch out to location storage and trip/timeline
 * processing.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import {
  getPassengerTerminalAbbrevs,
  runVesselOrchestratorTick,
} from "domain/vesselOrchestration";
import { syncBackendTerminalTable } from "functions/terminals/actions";
import type { Terminal } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";
import { syncBackendVesselTable } from "functions/vessels/actions";
import type { Vessel } from "functions/vessels/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { processVesselTrips } from "functions/vesselTrips/updates";
import { fetchWsfVesselLocations } from "shared/fetchWsfVesselLocations";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { applyTickEventWrites } from "./applyTickEventWrites";

/**
 * Orchestrator action that fetches vessel locations once and delegates to both
 * updateVesselLocations and processVesselTrips subroutines with robust error isolation.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same converted data to both processing functions. Failures
 * in one function do not prevent the other from executing.
 *
 * Flow:
 * 1. Fetch vessel locations via fetchVesselLocations()
 * 2. Load vessels, terminals, and active trips in one internal query (with
 *    bootstrap refreshes when identity tables are empty)
 * 3. Convert each WSF payload to `ConvexVesselLocation`
 * 4. Capture one tick timestamp for downstream consumers
 * 5. Run domain tick pipeline with injected adapters (locations branch vs trip
 *    branch with lifecycle then timeline writes)
 *
 * @param ctx - Convex action context
 * @returns Result object indicating success/failure of each subroutine
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    locationsSuccess: boolean;
    tripsSuccess: boolean;
    errors?: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    };
  }> => {
    const errors: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    } = {};

    let convexLocations: ConvexVesselLocation[] = [];
    let passengerTerminalAbbrevs = new Set<string>();
    let activeTripsForTick: TickActiveTrip[] = [];

    try {
      const { vessels, terminals, activeTrips } =
        await loadOrchestratorTickReadModelOrThrow(ctx);
      activeTripsForTick = activeTrips;
      passengerTerminalAbbrevs = getPassengerTerminalAbbrevs(terminals);
      const rawLocations =
        (await fetchWsfVesselLocations()) as unknown as DottieVesselLocation[];

      convexLocations = rawLocations.flatMap((rawLocation) => {
        try {
          return [toConvexVesselLocation(rawLocation, vessels, terminals)];
        } catch (error) {
          const err = toError(error);
          console.error("Skipping vessel location due to unresolved vessel:", {
            VesselID: rawLocation.VesselID,
            VesselName: rawLocation.VesselName,
            error: err.message,
          });

          return [];
        }
      });
    } catch (error) {
      const err = toError(error);
      errors.fetch = { message: err.message, stack: err.stack };
      console.error("Failed to fetch or process vessel locations:", err);

      return {
        locationsSuccess: false,
        tripsSuccess: false,
        errors,
      };
    }

    const tickStartedAt = Date.now();

    return runVesselOrchestratorTick(
      {
        convexLocations,
        passengerTerminalAbbrevs,
        tickStartedAt,
        activeTrips: activeTripsForTick,
      },
      {
        persistLocations: (locations) => updateVesselLocations(ctx, locations),
        processVesselTrips: (locations, tick, activeTrips, options) =>
          processVesselTrips(
            ctx,
            [...locations],
            tick,
            [...activeTrips],
            options
          ),
        applyTickEventWrites: (writes) => applyTickEventWrites(ctx, writes),
      }
    );
  },
});

/**
 * Subroutine function for updating vessel locations in the database.
 *
 * Stores vessel locations to the database using bulk upsert mutation.
 * This is called as a subroutine within the orchestrator action.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to store
 */
async function updateVesselLocations(
  ctx: ActionCtx,
  locations: ReadonlyArray<ConvexVesselLocation>
): Promise<void> {
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations: [...locations],
  });
}

/**
 * Load orchestrator DB snapshots in one query, refreshing identity tables when
 * they are empty (same behavior as the former split loaders).
 *
 * @param ctx - Convex action context
 * @returns Vessels, terminals, and active trips for this tick
 */
async function loadOrchestratorTickReadModelOrThrow(ctx: ActionCtx): Promise<{
  vessels: Vessel[];
  terminals: Terminal[];
  activeTrips: TickActiveTrip[];
}> {
  const readModelRef =
    internal.functions.vesselOrchestrator.queries
      .getOrchestratorTickReadModelInternal;

  let snapshot = await ctx.runQuery(readModelRef);
  let refreshedIdentity = false;

  if (snapshot.vessels.length === 0) {
    await syncBackendVesselTable(ctx);
    refreshedIdentity = true;
  }

  if (snapshot.terminals.length === 0) {
    await syncBackendTerminalTable(ctx);
    refreshedIdentity = true;
  }

  if (refreshedIdentity) {
    snapshot = await ctx.runQuery(readModelRef);
  }

  if (snapshot.vessels.length === 0) {
    throw new Error(
      "Backend vessels table is still empty after bootstrap refresh."
    );
  }

  if (snapshot.terminals.length === 0) {
    throw new Error(
      "Backend terminals table is still empty after bootstrap refresh."
    );
  }

  return snapshot;
}

/**
 * Coerce a `catch` binding or `PromiseSettledResult.reason` to `Error` so
 * branch-level logging and the orchestrator result shape stay consistent.
 *
 * @param value - Unknown rejection or throw value
 * @returns Original `Error` when applicable; otherwise `Error` with
 *   `String(value)` as the message
 */
const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
