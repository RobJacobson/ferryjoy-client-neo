/**
 * Explicit write plan for one vessel-orchestrator tick: completed handoffs and
 * current-branch artifacts. The functions-layer applier runs Convex mutations
 * from this plan; {@link buildTimelineTickProjectionInput} runs only after apply
 * (orchestrator trip branch).
 */

import type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripPredictedEventMessage,
} from "domain/vesselOrchestration/updateTimeline/types";
import type { ConvexVesselTripWithML } from "functions/vesselTrips/schemas";

/**
 * Leave-dock backfill queued during current-trip processing; runs only after a
 * successful active-trip upsert for that vessel.
 */
export type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTripWithML;
};

/**
 * Pre-mutation state for the active-trip branch: batch upsert candidates,
 * timeline messages, and leave-dock intents.
 */
export type CurrentTripTickWriteFragment = {
  activeUpserts: ConvexVesselTripWithML[];
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

/**
 * Full tick write plan: completed-boundary builds (successful only) plus current
 * artifacts. Mutation payloads are derived at apply time (strip once in applier).
 */
export type VesselTripTickWritePlan = {
  /** Successful `buildTrip` results only, stable tick input order. */
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
  current: CurrentTripTickWriteFragment;
};
