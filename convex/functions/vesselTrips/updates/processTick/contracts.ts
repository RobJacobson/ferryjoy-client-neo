/**
 * Stage 1 tick contracts for vessel trip updates.
 *
 * Explicit types for the orchestrator tick plan and merged projection payloads.
 * These mirror current runtime shapes without changing behavior; Stage 2+
 * refactors can narrow or split them further.
 */

import type { ConvexActualBoundaryPatch } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";

/**
 * How active trips were resolved for this tick.
 *
 * - `preloaded` — caller passed `activeTrips` (e.g. orchestrator bundled read;
 *   minimum shape is {@link TickActiveTrip} / storage-native rows).
 * - `query` — loaded via `getActiveTrips` inside `processVesselTripsWithDeps`
 *   (hydrated for API parity with public queries).
 */
export type ActiveTripsSourceKind = "preloaded" | "query";

/**
 * Tick-scoped inputs shared across transition build and branch processors.
 *
 * @remarks
 * Keeps the minimal surface named in the lifecycle refactor PRD; expand only
 * when a later stage needs additional plan fields.
 */
export type TripTickPlan = {
  locations: ConvexVesselLocation[];
  tickStartedAt: number;
  activeTripsSource: ActiveTripsSourceKind;
  shouldRunPredictionFallback: boolean;
};

/**
 * Merged overlay payloads emitted after lifecycle persistence for one tick.
 *
 * Matches the combined `actualPatches` / `predictedEffects` passed to
 * `projectActualBoundaryPatches` and `projectPredictedBoundaryEffects`.
 */
export type ProjectionBatch = {
  actualPatches: ConvexActualBoundaryPatch[];
  predictedEffects: ConvexPredictedBoundaryProjectionEffect[];
};

/**
 * Builds a tick plan object from resolved tick inputs.
 *
 * @param locations - Vessel locations for this orchestrator tick
 * @param tickStartedAt - Orchestrator-owned tick timestamp (ms)
 * @param activeTripsArg - When set, active trips came from the caller bundle
 *   (storage-native {@link TickActiveTrip} minimum)
 * @param shouldRunPredictionFallback - First seconds-of-minute fallback window
 * @returns Tick plan record for downstream use
 */
export const buildTripTickPlan = (
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  activeTripsArg: ReadonlyArray<TickActiveTrip> | undefined,
  shouldRunPredictionFallback: boolean
): TripTickPlan => ({
  locations,
  tickStartedAt,
  activeTripsSource: activeTripsArg !== undefined ? "preloaded" : "query",
  shouldRunPredictionFallback,
});

/**
 * Merges completed- and current-branch projection batches in documented order.
 *
 * @param completed - Overlay batch from the completed-trip branch (first)
 * @param current - Overlay batch from the current-trip branch (second)
 * @returns Single batch for timeline projection mutations
 */
export const mergeProjectionBatches = (
  completed: ProjectionBatch,
  current: ProjectionBatch
): ProjectionBatch => ({
  actualPatches: [...completed.actualPatches, ...current.actualPatches],
  predictedEffects: [
    ...completed.predictedEffects,
    ...current.predictedEffects,
  ],
});
