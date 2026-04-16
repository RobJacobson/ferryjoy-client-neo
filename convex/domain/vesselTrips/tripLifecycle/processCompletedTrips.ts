/**
 * Completed-trip processing for vessel trip updates.
 *
 * Handles trip-boundary transitions outside the top-level orchestrator while
 * preserving atomic persistence. Timeline writes are assembled in
 * `timelineEventAssembler` from returned facts.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import type { CompletedTripBoundaryFact } from "../projection/lifecycleEventTypes";
import type { VesselTripsBuildTripAdapters } from "../vesselTripsBuildTripAdapters";
import type { buildCompletedTrip } from "./buildCompletedTrip";
import type { buildTrip } from "./buildTrip";
import { stripTripPredictionsForStorage } from "./stripTripPredictionsForStorage";
import type { TripEvents } from "./tripEventTypes";

type CompletedTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTripWithPredictions;
  events: TripEvents;
};

export type ProcessCompletedTripsDeps = {
  buildCompletedTrip: typeof buildCompletedTrip;
  buildTrip: typeof buildTrip;
  buildTripAdapters: VesselTripsBuildTripAdapters;
};

/**
 * Process trip-boundary transitions that complete the active trip and start a replacement.
 *
 * @param ctx - Convex action context
 * @param completedTrips - Trip-boundary transitions for this tick
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @param deps - Injectable helpers for completed-trip processing
 * @returns Boundary facts for successful transitions (empty for failures)
 */
export const processCompletedTrips = async (
  ctx: ActionCtx,
  completedTrips: CompletedTripTransition[],
  shouldRunPredictionFallback: boolean,
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void,
  deps: ProcessCompletedTripsDeps
): Promise<CompletedTripBoundaryFact[]> => {
  const settledResults = await Promise.allSettled(
    completedTrips.map((transition) =>
      processCompletedTripTransition(
        ctx,
        transition,
        shouldRunPredictionFallback,
        deps
      )
    )
  );

  return normalizeCompletedTripResults(
    completedTrips,
    settledResults,
    logVesselProcessingError
  );
};

/**
 * Process one completed-trip transition end-to-end.
 *
 * @param ctx - Convex action context
 * @param transition - Trip-boundary transition for one vessel
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param deps - Injectable helpers for completed-trip processing
 * @returns Single fact for timeline assembly after persistence
 */
const processCompletedTripTransition = async (
  ctx: ActionCtx,
  transition: CompletedTripTransition,
  shouldRunPredictionFallback: boolean,
  deps: ProcessCompletedTripsDeps
): Promise<CompletedTripBoundaryFact> => {
  const { existingTrip, currLocation, events } = transition;
  const tripToComplete = deps.buildCompletedTrip(
    existingTrip,
    currLocation,
    events.didJustArriveAtDock
  );
  const newTrip = await deps.buildTrip(
    ctx,
    currLocation,
    tripToComplete,
    true,
    events,
    shouldRunPredictionFallback,
    deps.buildTripAdapters
  );

  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    {
      completedTrip: stripTripPredictionsForStorage(tripToComplete),
      newTrip: stripTripPredictionsForStorage(newTrip),
    }
  );

  return {
    existingTrip,
    tripToComplete,
    newTrip,
  };
};

/**
 * Convert settled per-vessel results into successful boundary facts.
 *
 * @param completedTrips - Original transition list
 * @param settledResults - Settled results in input order
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @returns Successful facts only
 */
const normalizeCompletedTripResults = (
  completedTrips: CompletedTripTransition[],
  settledResults: PromiseSettledResult<CompletedTripBoundaryFact>[],
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void
): CompletedTripBoundaryFact[] =>
  settledResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    const transition = completedTrips[index];
    logVesselProcessingError(
      transition?.currLocation.VesselAbbrev ?? "unknown",
      "completed-trip processing",
      result.reason
    );
    return [];
  });
