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
import { fetchWsfVesselLocations } from "adapters";
import {
  getPassengerTerminalAbbrevs,
  runVesselOrchestratorTick,
  type UpdateVesselOrchestratorResult,
} from "domain/vesselOrchestration";
import {
  assertOrchestratorIdentityReady,
  terminalsIdentityNeedsBootstrap,
  vesselsIdentityNeedsBootstrap,
} from "domain/vesselOrchestration/orchestratorTickReadModelBootstrap";
import { runUpdateVesselLocationsTick } from "domain/vesselOrchestration/updateVesselLocations/runUpdateVesselLocationsTick";
import type { TimelineTickProjectionInput } from "domain/vesselOrchestration/updateVesselTrips";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/defaultProcessVesselTripsDeps";
import { processVesselTripsWithDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips";
import { syncBackendTerminalTable } from "functions/terminals/actions";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { syncBackendVesselTable } from "functions/vessels/actions";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";

/**
 * Orchestrator action that fetches vessel locations once and fans out to domain
 * tick processing with robust error isolation.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same converted data to both processing functions. Failures
 * in one function do not prevent the other from executing.
 *
 * Four concerns (`architecture.md` §10), wired into `runVesselOrchestratorTick`:
 * - **updateVesselLocations** — `runUpdateVesselLocationsTick` → `bulkUpsert`
 * - **updateVesselTrips** — `processVesselTripsWithDeps` with
 *   `createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx))`
 *   (**updateVesselPredictions** is
 *   `applyVesselPredictions` after `buildTripCore` inside the trip pipeline, not a
 *   separate orchestrator hop)
 * - **updateTimeline** — `applyTickEventWrites` with `tripResult.tickEventWrites`
 *
 * Flow:
 * 1. Fetch vessel locations via fetchVesselLocations()
 * 2. Load vessels, terminals, and active trips in one internal query (with
 *    bootstrap refreshes when identity tables are empty)
 * 3. Obtain `ConvexVesselLocation` rows from the WSF adapter (fetch + identity map)
 * 4. Capture one tick timestamp for downstream consumers
 * 5. Run domain tick pipeline with injected adapters (locations branch vs trip
 *    branch: **updateVesselTrips** then **updateTimeline**)
 *
 * @param ctx - Convex action context
 * @returns {@link UpdateVesselOrchestratorResult} — domain tick result with
 *   `tickMetrics` after fetch, or fetch-only failure without `tickMetrics`
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (ctx): Promise<UpdateVesselOrchestratorResult> => {
    let convexLocations: ConvexVesselLocation[] = [];
    let passengerTerminalAbbrevs = new Set<string>();
    let activeTripsForTick: TickActiveTrip[] = [];

    try {
      const { vessels, terminals, activeTrips } =
        await loadOrchestratorTickReadModelOrThrow(ctx);
      activeTripsForTick = activeTrips;
      passengerTerminalAbbrevs = getPassengerTerminalAbbrevs(terminals);
      // TODO: Optionally isolate per-row conversion failures so one bad feed row
      // does not fail the entire tick; today the adapter throws on first error.
      convexLocations = await fetchWsfVesselLocations(vessels, terminals);
    } catch (error) {
      const err = toError(error);
      console.error("Failed to fetch or process vessel locations:", err);

      return {
        locationsSuccess: false,
        tripsSuccess: false,
        errors: {
          fetch: { message: err.message, stack: err.stack },
        },
      };
    }

    const tickStartedAt = Date.now();

    // Deps: persistLocations → updateVesselLocations; processVesselTrips →
    // updateVesselTrips; applyTickEventWrites → updateTimeline.
    return runVesselOrchestratorTick(
      {
        convexLocations,
        passengerTerminalAbbrevs,
        tickStartedAt,
        activeTrips: activeTripsForTick,
      },
      {
        persistLocations: (locations) =>
          runUpdateVesselLocationsTick(locations, (args) =>
            ctx.runMutation(
              api.functions.vesselLocation.mutations.bulkUpsert,
              args
            )
          ),
        processVesselTrips: (locations, tick, activeTrips, options) =>
          processVesselTripsWithDeps(
            ctx,
            locations,
            tick,
            createDefaultProcessVesselTripsDeps(
              createScheduledSegmentLookup(ctx)
            ),
            activeTrips,
            options
          ),
        applyTickEventWrites: (writes) => applyTickEventWrites(ctx, writes),
      }
    );
  },
});

/**
 * **updateTimeline** — applies per-tick `eventsActual` / `eventsPredicted` writes
 * after lifecycle persistence.
 *
 * This helper stays local to the orchestrator action module because it is only
 * used by the trip branch that `updateVesselOrchestrator` wires into the
 * domain pipeline.
 *
 * @param ctx - Convex action context
 * @param writes - **updateTimeline** input (`TimelineTickProjectionInput` /
 *   `TickEventWrites`) from `tripResult.tickEventWrites`
 * @returns `undefined` after all per-tick writes settle
 */
export const applyTickEventWrites = async (
  ctx: ActionCtx,
  writes: TimelineTickProjectionInput
): Promise<void> => {
  await Promise.all([
    writes.actualDockWrites.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsActual.mutations
            .projectActualDockWrites,
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
 * Schedule lookup callbacks backed by internal `eventsScheduled` queries.
 * Feeds {@link createDefaultProcessVesselTripsDeps} for trip ticks.
 *
 * @param ctx - Convex action context for query execution
 * @returns Lookup callbacks for docked continuity and schedule enrichment
 */
const createScheduledSegmentLookup = (
  ctx: ActionCtx
): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (segmentKey: string) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey }
    ),
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      args
    ),
});

/**
 * Load orchestrator DB snapshots in one query, refreshing identity tables when
 * they are empty (same behavior as the former split loaders).
 *
 * @param ctx - Convex action context
 * @returns Vessels, terminals, and active trips for this tick
 */
async function loadOrchestratorTickReadModelOrThrow(ctx: ActionCtx): Promise<{
  vessels: VesselIdentity[];
  terminals: TerminalIdentity[];
  activeTrips: TickActiveTrip[];
}> {
  const readModelRef =
    internal.functions.vesselOrchestrator.queries
      .getOrchestratorTickReadModelInternal;

  let snapshot = await ctx.runQuery(readModelRef);
  let refreshedIdentity = false;

  if (vesselsIdentityNeedsBootstrap(snapshot)) {
    await syncBackendVesselTable(ctx);
    refreshedIdentity = true;
  }

  if (terminalsIdentityNeedsBootstrap(snapshot)) {
    await syncBackendTerminalTable(ctx);
    refreshedIdentity = true;
  }

  if (refreshedIdentity) {
    snapshot = await ctx.runQuery(readModelRef);
  }

  assertOrchestratorIdentityReady(snapshot);

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
