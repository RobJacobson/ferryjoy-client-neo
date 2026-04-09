/**
 * Stage 1 tick contracts for vessel trip updates.
 *
 * Explicit types for the orchestrator tick plan, lifecycle branch metadata, and
 * merged projection payloads. These mirror current runtime shapes without
 * changing behavior; Stage 2+ refactors can narrow or split them further.
 */

import type { ConvexActualBoundaryPatch } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * How active trips were resolved for this tick.
 *
 * - `preloaded` — caller passed `activeTrips` (e.g. orchestrator bundled read).
 * - `query` — loaded via `getActiveTrips` inside `processVesselTripsWithDeps`.
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
 * Describes work scheduled for one lifecycle branch in order.
 *
 * Stage 1 uses this as documentation and ordering guardrails; processors are
 * still invoked explicitly (`processCompletedTrips` then `processCurrentTrips`).
 */
export type LifecycleCommand =
  | { kind: "completedTrips"; transitionCount: number }
  | { kind: "currentTrips"; transitionCount: number };

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
 * @param shouldRunPredictionFallback - First seconds-of-minute fallback window
 * @returns Tick plan record for downstream use
 */
export const buildTripTickPlan = (
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  activeTripsArg: ConvexVesselTrip[] | undefined,
  shouldRunPredictionFallback: boolean
): TripTickPlan => ({
  locations,
  tickStartedAt,
  activeTripsSource: activeTripsArg !== undefined ? "preloaded" : "query",
  shouldRunPredictionFallback,
});

/**
 * Merges completed- and current-branch projection results in documented order.
 *
 * @param completed - Artifacts from `processCompletedTrips` (first)
 * @param current - Artifacts from `processCurrentTrips` (second)
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

/**
 * Builds lifecycle branch commands from transition counts.
 *
 * @param completedCount - Number of trip-boundary transitions this tick
 * @param currentCount - Number of non-boundary transitions this tick
 * @returns Tuple in execution order: completed branch, then current branch
 */
export const buildLifecycleCommands = (
  completedCount: number,
  currentCount: number
): readonly [LifecycleCommand, LifecycleCommand] => [
  { kind: "completedTrips", transitionCount: completedCount },
  { kind: "currentTrips", transitionCount: currentCount },
];

/**
 * Ensures lifecycle branch kinds match the sequential completed-then-current
 * contract. Throws only if ordering metadata is wrong (internal invariant).
 *
 * @param first - Must be `completedTrips`
 * @param second - Must be `currentTrips`
 */
export const assertSequentialLifecycleOrder = (
  first: LifecycleCommand,
  second: LifecycleCommand
): void => {
  if (first.kind !== "completedTrips" || second.kind !== "currentTrips") {
    throw new Error(
      "VesselTrips: lifecycle branches must run completed then current"
    );
  }
};
