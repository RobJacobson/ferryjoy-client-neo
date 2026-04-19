/**
 * Steady-state processing for vessels on the **active trip** path (no
 * trip-completion / replacement handoff — that lives in `processCompletedTrips`).
 *
 * ## Pipeline (one orchestrator tick)
 *
 * 1. **Parallel build** — Each vessel runs {@link buildTripCore} under
 *    `Promise.allSettled` so one failure does not block the rest.
 * 2. **Keep successes** — Rejected builds are logged and discarded.
 * 3. **Collect artifacts** — Lifecycle upsert when strip-shaped row differs;
 *    timeline messages when overlay-relevant fields differ (can run
 *    without an upsert for prediction-only ticks). Writes are assembled in
 *    `timelineEventAssembler` after this branch returns.
 * 4. **Early exit** — If nothing to upsert and no overlay work, return empty
 *    fragment (no Convex mutations here).
 * 5. **Apply phase** (functions applier) — Batch upsert when needed, then
 *    leave-dock hooks for successful upserts only.
 * 6. **Return messages** — For the event assembler; items tied to an upsert
 *    carry `requiresSuccessfulUpsert` for filtering after persistence.
 */

import type {
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import type { BuildTripCoreResult } from "./buildTrip";
import type { ProcessCompletedTripsDeps } from "./processCompletedTrips";
import {
  logActualProjectionTick,
  logTripsComputeDiagnostics,
} from "./processCurrentTripsTickLogging";
import { tripWriteSuppressionFlags } from "./tripEquality";
import type { TripEvents } from "./tripEventTypes";
import type {
  ActiveTripsBranch,
  PendingLeaveDockEffect,
} from "./vesselTripsComputeBundle";

type CurrentTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTripWithPredictions;
  events: TripEvents;
};

type CurrentTripBuildResult = CurrentTripTransition & {
  tripCore: BuildTripCoreResult;
};

type CurrentTripArtifacts = {
  activeUpserts: ConvexVesselTripWithPredictions[];
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

/**
 * Runs the active-trip build and artifact collection for one orchestrator tick.
 * Convex mutations run in the functions-layer applier.
 *
 * @param currentTrips - Current-trip transitions for this tick
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param deps - Trip builder and injected function-layer adapters
 * @returns Pre-mutation fragment for the tick write applier
 */
export const processCurrentTrips = async (
  currentTrips: CurrentTripTransition[],
  shouldRunPredictionFallback: boolean,
  deps: Pick<ProcessCompletedTripsDeps, "buildTripCore" | "buildTripAdapters">
): Promise<ActiveTripsBranch> => {
  const buildResults = await Promise.allSettled(
    currentTrips.map(async (transition) => {
      const buildResult = {
        ...transition,
        tripCore: await deps.buildTripCore(
          transition.currLocation,
          transition.existingTrip,
          false,
          transition.events,
          shouldRunPredictionFallback,
          deps.buildTripAdapters
        ),
      };
      logTripsComputeDiagnostics(buildResult);
      return buildResult;
    })
  );

  const successfulBuildResults = buildResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }
    console.error(
      "[VesselTrips] buildTripCore failed for current-trip batch entry",
      { index, transition: currentTrips[index], reason: result.reason }
    );
    return [];
  });

  const collectedArtifacts = successfulBuildResults.reduce(
    mergeCurrentTripArtifacts,
    createEmptyCurrentTripArtifacts()
  );

  const hasTimelineMessageWork =
    collectedArtifacts.pendingActualMessages.length > 0 ||
    collectedArtifacts.pendingPredictedMessages.length > 0;

  if (
    collectedArtifacts.activeUpserts.length === 0 &&
    !hasTimelineMessageWork
  ) {
    return emptyActiveTripsBranch();
  }

  return {
    activeUpserts: collectedArtifacts.activeUpserts,
    pendingActualMessages: collectedArtifacts.pendingActualMessages,
    pendingPredictedMessages: collectedArtifacts.pendingPredictedMessages,
    pendingLeaveDockEffects: collectedArtifacts.pendingLeaveDockEffects,
  };
};

/**
 * Queues leave-dock work that must run only after the active trip upsert.
 *
 * @param events - Detected events for the current tick
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for effect tagging
 * @returns Pending leave-dock effect, or null when none should run
 */
const buildLeaveDockPostPersistEffect = (
  events: TripEvents,
  proposedCore: ConvexVesselTripWithPredictions,
  vesselAbbrev: string
): PendingLeaveDockEffect | null =>
  events.didJustLeaveDock && proposedCore.LeftDockActual !== undefined
    ? {
        vesselAbbrev,
        trip: proposedCore,
      }
    : null;

/**
 * Turns one fulfilled build into batch upsert and side-effect queues.
 *
 * @param buildResult - Successful current-trip build result
 * @returns Array-backed artifacts suitable for reducer-based accumulation
 */
const collectCurrentTripArtifacts = (
  buildResult: CurrentTripBuildResult
): CurrentTripArtifacts => {
  const { existingTrip, currLocation, events, tripCore } = buildResult;
  const proposedCore = tripCore.withFinalSchedule;

  const { needsStorageUpsert: persist, needsOverlayRefresh: refresh } =
    tripWriteSuppressionFlags(existingTrip, proposedCore);

  if (!persist && !refresh) {
    return createEmptyCurrentTripArtifacts();
  }

  logActualProjectionTick(buildResult, persist, refresh);

  const leaveDockEffect = persist
    ? buildLeaveDockPostPersistEffect(
        events,
        proposedCore,
        currLocation.VesselAbbrev
      )
    : null;

  const upsertGate = persist;

  return {
    activeUpserts: persist ? [proposedCore] : [],
    pendingActualMessages: refresh
      ? [
          {
            events,
            tripCore,
            vesselAbbrev: currLocation.VesselAbbrev,
            requiresSuccessfulUpsert: upsertGate,
          },
        ]
      : [],
    pendingPredictedMessages: refresh
      ? [
          {
            existingTrip,
            tripCore,
            vesselAbbrev: currLocation.VesselAbbrev,
            requiresSuccessfulUpsert: upsertGate,
          },
        ]
      : [],
    pendingLeaveDockEffects: leaveDockEffect !== null ? [leaveDockEffect] : [],
  };
};

/**
 * Reducer step: appends one vessel’s artifacts to the running batch.
 *
 * @param accumulated - Running accumulator for all successful build results
 * @param buildResult - Successful current-trip build result
 * @returns Merged artifacts accumulator
 */
const mergeCurrentTripArtifacts = (
  accumulated: CurrentTripArtifacts,
  buildResult: CurrentTripBuildResult
): CurrentTripArtifacts => {
  const next = collectCurrentTripArtifacts(buildResult);

  return {
    activeUpserts: [...accumulated.activeUpserts, ...next.activeUpserts],
    pendingActualMessages: [
      ...accumulated.pendingActualMessages,
      ...next.pendingActualMessages,
    ],
    pendingPredictedMessages: [
      ...accumulated.pendingPredictedMessages,
      ...next.pendingPredictedMessages,
    ],
    pendingLeaveDockEffects: [
      ...accumulated.pendingLeaveDockEffects,
      ...next.pendingLeaveDockEffects,
    ],
  };
};

/**
 * Initial value for `reduce` when folding vessels into one batch.
 *
 * @returns Empty accumulator for reducer-based collection
 */
const createEmptyCurrentTripArtifacts = (): CurrentTripArtifacts => ({
  activeUpserts: [],
  pendingActualMessages: [],
  pendingPredictedMessages: [],
  pendingLeaveDockEffects: [],
});

/**
 * Empty pre-mutation fragment when no upsert and no overlay work was queued.
 *
 * @returns Empty arrays (matches prior `emptyCurrentTripBranchResult` minus
 *   `successfulVessels`, which the applier fills)
 */
const emptyActiveTripsBranch = (): ActiveTripsBranch => ({
  activeUpserts: [],
  pendingActualMessages: [],
  pendingPredictedMessages: [],
  pendingLeaveDockEffects: [],
});
