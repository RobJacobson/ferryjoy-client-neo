/**
 * Completed-trip processing for vessel trip updates.
 *
 * Handles trip-boundary transitions outside the top-level orchestrator while
 * preserving atomic persistence and boundary projection behavior.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryProjectionEffect,
} from "domain/vesselTimeline/normalizedEvents";
import type { ConvexActualBoundaryPatch } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildArrivalActualPatchForTrip,
  buildDepartureActualPatchForTrip,
} from "../actualBoundaryPatchesFromTrip";
import { buildCompletedTrip } from "../buildCompletedTrip";
import { buildTrip } from "../buildTrip";
import type { TripEvents } from "../eventDetection";

type CompletedTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip;
  events: TripEvents;
};

type ProjectionResults = {
  actualPatches: ConvexActualBoundaryPatch[];
  predictedEffects: ConvexPredictedBoundaryProjectionEffect[];
};

export type ProcessCompletedTripsDeps = {
  buildCompletedTrip: typeof buildCompletedTrip;
  buildTrip: typeof buildTrip;
};

const DEFAULT_PROCESS_COMPLETED_TRIPS_DEPS: ProcessCompletedTripsDeps = {
  buildCompletedTrip,
  buildTrip,
};

/**
 * Process trip-boundary transitions that complete the active trip and start a replacement.
 *
 * @param ctx - Convex action context
 * @param completedTrips - Trip-boundary transitions for this tick
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @param deps - Injectable helpers for completed-trip processing
 * @returns Projection payloads derived from successfully processed boundaries
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
  deps: ProcessCompletedTripsDeps = DEFAULT_PROCESS_COMPLETED_TRIPS_DEPS
): Promise<ProjectionResults> => {
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
  ).reduce(mergeProjectionResults, createEmptyProjectionResults());
};

/**
 * Process one completed-trip transition end-to-end.
 *
 * @param ctx - Convex action context
 * @param transition - Trip-boundary transition for one vessel
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param deps - Injectable helpers for completed-trip processing
 * @returns Boundary projection payloads derived from the persisted trips
 */
const processCompletedTripTransition = async (
  ctx: ActionCtx,
  transition: CompletedTripTransition,
  shouldRunPredictionFallback: boolean,
  deps: ProcessCompletedTripsDeps
): Promise<ProjectionResults> => {
  const { existingTrip, currLocation, events } = transition;
  const tripToComplete = deps.buildCompletedTrip(existingTrip, currLocation);
  const newTrip = await deps.buildTrip(
    ctx,
    currLocation,
    tripToComplete,
    true,
    events,
    shouldRunPredictionFallback
  );

  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    {
      completedTrip: tripToComplete,
      newTrip,
    }
  );

  return buildCompletedTripEffects(existingTrip, tripToComplete, newTrip);
};

/**
 * Convert settled per-vessel results into successful projection payloads.
 *
 * @param completedTrips - Original transition list
 * @param settledResults - Settled results in input order
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @returns Successful projection results only
 */
const normalizeCompletedTripResults = (
  completedTrips: CompletedTripTransition[],
  settledResults: PromiseSettledResult<ProjectionResults>[],
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void
): ProjectionResults[] =>
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

/**
 * Build boundary projection payloads from the completed and replacement trips.
 *
 * @param existingTrip - Previously persisted active trip being replaced
 * @param tripToComplete - Finalized completed trip
 * @param newTrip - Replacement active trip
 * @returns Actual patches and predicted effects for downstream projection
 */
const buildCompletedTripEffects = (
  existingTrip: ConvexVesselTrip,
  tripToComplete: ConvexVesselTripWithML,
  newTrip: ConvexVesselTripWithML
): ProjectionResults => ({
  actualPatches: [
    buildDepartureActualPatchForTrip(tripToComplete),
    buildArrivalActualPatchForTrip(tripToComplete),
  ].filter((patch): patch is ConvexActualBoundaryPatch => Boolean(patch)),
  predictedEffects: [
    buildPredictedBoundaryClearEffect(existingTrip),
    buildPredictedBoundaryProjectionEffect(newTrip),
  ].filter((effect): effect is ConvexPredictedBoundaryProjectionEffect =>
    Boolean(effect)
  ),
});

/**
 * Merge one projection result into the accumulator.
 *
 * @param accumulated - Running projection accumulator
 * @param next - One successful per-vessel projection result
 * @returns Merged projection result
 */
const mergeProjectionResults = (
  accumulated: ProjectionResults,
  next: ProjectionResults
): ProjectionResults => ({
  actualPatches: [...accumulated.actualPatches, ...next.actualPatches],
  predictedEffects: [...accumulated.predictedEffects, ...next.predictedEffects],
});

/**
 * Create an empty projection accumulator.
 *
 * @returns Empty projection result object
 */
const createEmptyProjectionResults = (): ProjectionResults => ({
  actualPatches: [],
  predictedEffects: [],
});
