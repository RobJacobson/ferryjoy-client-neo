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
import { syncBackendTerminalTable } from "functions/terminals/actions";
import type { Terminal } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";
import { syncBackendVesselTable } from "functions/vessels/actions";
import type { Vessel } from "functions/vessels/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { processVesselTrips } from "functions/vesselTrips/updates";
import { computeShouldRunPredictionFallback } from "functions/vesselTrips/updates/processTick/tickPredictionPolicy";
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
 * 5. Call updateVesselLocations() with error isolation
 * 6. Call processVesselTrips() then applyTickEventWrites() with error isolation
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
    // Track errors from each processing branch
    const errors: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    } = {};

    // Step 1: Fetch and convert vessel locations
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
    const tripEligibleLocations = convexLocations.filter((location) =>
      isTripEligibleLocation(location, passengerTerminalAbbrevs)
    );

    const runTripLifecycleAndTimeline = async () => {
      const tripResult = await processVesselTrips(
        ctx,
        tripEligibleLocations,
        tickStartedAt,
        activeTripsForTick,
        {
          shouldRunPredictionFallback:
            computeShouldRunPredictionFallback(tickStartedAt),
        }
      );
      await applyTickEventWrites(ctx, tripResult.tickEventWrites);
    };

    const branchResults: [
      PromiseSettledResult<void>,
      PromiseSettledResult<void>,
    ] = await Promise.allSettled([
      updateVesselLocations(ctx, convexLocations),
      runTripLifecycleAndTimeline(),
    ]);

    const [locationsResult, tripsResult] = branchResults;

    if (locationsResult.status === "rejected") {
      const err = toError(locationsResult.reason);
      errors.locations = { message: err.message, stack: err.stack };
      console.error("updateVesselLocations failed:", err);
    }

    if (tripsResult.status === "rejected") {
      const err = toError(tripsResult.reason);
      errors.trips = { message: err.message, stack: err.stack };
      console.error("processVesselTrips failed:", err);
    }

    return {
      locationsSuccess: locationsResult.status === "fulfilled",
      tripsSuccess: tripsResult.status === "fulfilled",
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };
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
 * Collect the passenger-terminal abbreviations that are eligible for trip
 * processing.
 *
 * Non-passenger marine locations can still be stored in `vesselLocations`,
 * but they are intentionally excluded from trip lifecycle derivation.
 *
 * @param terminals - Backend terminal snapshot
 * @returns Set of terminal abbreviations eligible for trip processing
 */
export const getPassengerTerminalAbbrevs = (
  terminals: ReadonlyArray<{
    TerminalAbbrev: string;
    IsPassengerTerminal?: boolean;
  }>
) =>
  new Set(
    terminals
      .filter((terminal) => terminal.IsPassengerTerminal !== false)
      .map((terminal) => terminal.TerminalAbbrev)
  );

/**
 * Test whether a terminal abbreviation participates in passenger trip logic.
 *
 * @param terminalAbbrev - Candidate terminal abbreviation
 * @param passengerTerminalAbbrevs - Allow-list derived from the terminals table
 * @returns True when the abbreviation is trip-eligible
 */
export const isPassengerTerminalAbbrev = (
  terminalAbbrev: string | undefined,
  passengerTerminalAbbrevs: ReadonlySet<string>
) =>
  terminalAbbrev !== undefined && passengerTerminalAbbrevs.has(terminalAbbrev);

/**
 * Decide whether a resolved vessel location should enter the trip pipeline.
 *
 * The location branch stores more raw fidelity than the trip branch. This gate
 * keeps trip derivation constrained to passenger-terminal movements only.
 *
 * @param location - Converted vessel location for the current tick
 * @param passengerTerminalAbbrevs - Allow-list derived from the terminals table
 * @returns True when the location should be processed by `vesselTrips`
 */
export const isTripEligibleLocation = (
  location: Pick<
    ConvexVesselLocation,
    "DepartingTerminalAbbrev" | "ArrivingTerminalAbbrev"
  >,
  passengerTerminalAbbrevs: ReadonlySet<string>
) =>
  isPassengerTerminalAbbrev(
    location.DepartingTerminalAbbrev,
    passengerTerminalAbbrevs
  ) &&
  (location.ArrivingTerminalAbbrev === undefined ||
    isPassengerTerminalAbbrev(
      location.ArrivingTerminalAbbrev,
      passengerTerminalAbbrevs
    ));

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
