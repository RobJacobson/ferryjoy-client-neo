/**
 * Trip compute output for one orchestrator pass: completed handoffs and
 * active-branch artifacts. `convex/functions` runs mutations from this bundle;
 * {@link buildTimelineTickProjectionInput} runs after apply.
 */

import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";

/**
 * Leave-dock backfill queued during active-trip processing; runs only after a
 * successful active-trip upsert for that vessel.
 */
export type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTripWithPredictions;
};

/**
 * Pre-mutation state for the active-trip branch: batch upsert candidates,
 * timeline messages, and leave-dock intents.
 */
export type ActiveTripsBranch = {
  /** Schedule-shaped rows from {@link buildTripCore} (ML stripped at upsert). */
  activeUpserts: ConvexVesselTripWithPredictions[];
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

/**
 * Completed-boundary builds (successful only) plus active-branch artifacts.
 * Mutation payloads are derived at apply time (strip once in applier).
 */
export type VesselTripsComputeBundle = {
  /** Successful boundary handoffs only, stable input order. */
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
  current: ActiveTripsBranch;
};
