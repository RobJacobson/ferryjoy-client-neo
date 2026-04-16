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
import { DEFAULT_PROCESS_VESSEL_TRIPS_DEPS } from "adapters/vesselTrips/processTick";
import { fetchWsfVesselLocations } from "adapters/wsf/fetchVesselLocations";
import {
  getPassengerTerminalAbbrevs,
  runVesselOrchestratorTick,
} from "domain/vesselOrchestration";
import { processVesselTripsWithDeps } from "domain/vesselTrips/processTick/processVesselTrips";
import type { TickEventWrites } from "domain/vesselTrips/processTick/tickEventWrites";
import { syncBackendTerminalTable } from "functions/terminals/actions";
import type { Terminal } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";
import { syncBackendVesselTable } from "functions/vessels/actions";
import type { Vessel } from "functions/vessels/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

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
          processVesselTripsWithDeps(
            ctx,
            locations,
            tick,
            DEFAULT_PROCESS_VESSEL_TRIPS_DEPS,
            activeTrips,
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
 * @returns `undefined` after the location snapshot upsert completes
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
 * Applies per-tick timeline table writes after lifecycle persistence.
 *
 * This helper stays local to the orchestrator action module because it is only
 * used by the trip branch that `updateVesselOrchestrator` wires into the
 * domain pipeline.
 *
 * @param ctx - Convex action context
 * @param writes - Combined actual and predicted timeline writes for one tick
 * @returns `undefined` after all per-tick writes settle
 */
export const applyTickEventWrites = async (
  ctx: ActionCtx,
  writes: TickEventWrites
): Promise<void> => {
  await Promise.all([
    writes.actualDockWrites.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsActual.mutations.projectActualDockWrites,
          {
            Writes: writes.actualDockWrites,
          }
        )
      : Promise.resolve(),
    writes.predictedDockWriteBatches.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsPredicted.mutations
            .projectPredictedDockWriteBatches,
          {
            Batches: writes.predictedDockWriteBatches,
          }
        )
      : Promise.resolve(),
  ]);
};

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
